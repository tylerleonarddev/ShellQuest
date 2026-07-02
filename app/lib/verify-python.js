'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const TIMEOUT_MS = 5000;
const SENTINEL = '__SHELLQUEST_RESULTS__';

// The harness execs the user's code in its own namespace, evals each test
// call, and compares results as JSON-shaped values (so [1,2,"Fizz"] from the
// content file compares cleanly against a Python list). Bool-vs-int is
// checked explicitly because in Python True == 1.
const HARNESS = `
import json, sys, traceback

def _match(a, b):
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_match(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(_match(a[k], b[k]) for k in a)
    return a == b

with open("solution.py") as f:
    _src = f.read()
with open("tests.json") as f:
    _tests = json.load(f)

_ns = {}
try:
    exec(compile(_src, "solution.py", "exec"), _ns)
except Exception:
    print("${SENTINEL}")
    print(json.dumps({"fatal": traceback.format_exc(limit=3)}))
    sys.exit(0)

_results = []
for _t in _tests:
    _r = {"call": _t["call"], "expected": _t["expect"], "passed": False}
    try:
        _actual = eval(_t["call"], _ns)
        try:
            _actual = json.loads(json.dumps(_actual))
            _r["actual"] = _actual
            _r["passed"] = _match(_actual, _t["expect"])
        except (TypeError, ValueError):
            _r["error"] = "result is not a JSON-comparable value: " + repr(_actual)
    except Exception as _e:
        _r["error"] = type(_e).__name__ + ": " + str(_e)
    _results.append(_r)

print("${SENTINEL}")
print(json.dumps({"results": _results}))
`;

// Multi-step runner (v0.7): each test gets a FRESH namespace with the
// user's code, runs its setup lines in order (shared state within the
// test), then evaluates each check. Same result shape as python-test so
// the renderer and on-pass pipeline need no special-casing.
const SCRIPT_HARNESS = `
import json, sys, traceback

def _match(a, b):
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_match(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(_match(a[k], b[k]) for k in a)
    return a == b

with open("solution.py") as f:
    _src = f.read()
with open("tests.json") as f:
    _tests = json.load(f)

try:
    compile(_src, "solution.py", "exec")
except Exception:
    print("${SENTINEL}")
    print(json.dumps({"fatal": traceback.format_exc(limit=3)}))
    sys.exit(0)

_results = []
for _t in _tests:
    _ns = {}
    exec(compile(_src, "solution.py", "exec"), _ns)
    _setup_ok = True
    for _line in _t.get("setup", []):
        try:
            exec(_line, _ns)
        except Exception as _e:
            _results.append({"call": "setup: " + _line, "passed": False,
                             "error": type(_e).__name__ + ": " + str(_e)})
            _setup_ok = False
            break
    if not _setup_ok:
        continue
    for _c in _t.get("checks", []):
        _r = {"call": _c["call"], "expected": _c["expect"], "passed": False}
        try:
            _actual = eval(_c["call"], _ns)
            try:
                _actual = json.loads(json.dumps(_actual))
                _r["actual"] = _actual
                _r["passed"] = _match(_actual, _c["expect"])
            except (TypeError, ValueError):
                _r["error"] = "result is not a JSON-comparable value: " + repr(_actual)
        except Exception as _e:
            _r["error"] = type(_e).__name__ + ": " + str(_e)
        _results.append(_r)

print("${SENTINEL}")
print(json.dumps({"results": _results}))
`;

function runHarness(harness, exercise, userCode) {
  return new Promise((resolve) => {
    let tmpDir;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellquest-'));
      fs.writeFileSync(path.join(tmpDir, 'solution.py'), userCode);
      fs.writeFileSync(path.join(tmpDir, 'tests.json'), JSON.stringify(exercise.verification.tests));
      fs.writeFileSync(path.join(tmpDir, 'harness.py'), harness);
    } catch (err) {
      return resolve({ passed: false, error: `Could not set up test run: ${err.message}` });
    }

    execFile(
      'python3',
      ['harness.py'],
      { cwd: tmpDir, timeout: TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        fs.rmSync(tmpDir, { recursive: true, force: true });

        if (err && err.killed) {
          return resolve({
            passed: false,
            error: `Timed out after ${TIMEOUT_MS / 1000}s — check for an infinite loop.`,
          });
        }

        const idx = stdout.lastIndexOf(SENTINEL);
        if (idx === -1) {
          const detail = (stderr || (err && err.message) || 'no output').trim();
          return resolve({ passed: false, error: `Test runner failed: ${detail}` });
        }

        let payload;
        try {
          payload = JSON.parse(stdout.slice(idx + SENTINEL.length).trim());
        } catch {
          return resolve({ passed: false, error: 'Test runner produced unreadable output.' });
        }

        if (payload.fatal) {
          return resolve({ passed: false, fatal: payload.fatal.trim() });
        }
        const results = payload.results || [];
        resolve({ passed: results.length > 0 && results.every((r) => r.passed), results });
      }
    );
  });
}

// Dispatch on the exercise's declared runner — content stays data.
function runTests(exercise, userCode) {
  const runner = exercise.verification.runner;
  if (runner === 'python-script') return runHarness(SCRIPT_HARNESS, exercise, userCode);
  return runHarness(HARNESS, exercise, userCode);
}

module.exports = { runTests, TIMEOUT_MS };
