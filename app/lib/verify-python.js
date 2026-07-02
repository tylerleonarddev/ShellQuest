'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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
except SystemExit:
    print("${SENTINEL}")
    print(json.dumps({"fatal": "SystemExit: your code called exit()/sys.exit() — remove it; just define the function and let the tests call it."}))
    sys.exit(0)
except BaseException:
    print("${SENTINEL}")
    print(json.dumps({"fatal": traceback.format_exc(limit=3)}))
    sys.exit(0)

_results = []
for _t in _tests:
    _r = {"call": _t["call"], "expected": _t["expect"], "passed": False}
    try:
        _actual = eval(_t["call"], _ns)
        try:
            _actual = json.loads(json.dumps(_actual, allow_nan=False))
            _r["actual"] = _actual
            _r["passed"] = _match(_actual, _t["expect"])
        except (TypeError, ValueError):
            _r["error"] = "result is not a JSON-comparable value: " + repr(_actual)
    except SystemExit:
        _r["error"] = "SystemExit: your code called exit()/sys.exit() — remove it and return a value instead"
    except BaseException as _e:
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
    # Top-level runtime errors in learner code must surface as the same
    # friendly "fatal" payload the single-expression harness uses — never
    # as a raw harness traceback.
    try:
        exec(compile(_src, "solution.py", "exec"), _ns)
    except SystemExit:
        print("${SENTINEL}")
        print(json.dumps({"fatal": "SystemExit: your code called exit()/sys.exit() — remove it; define the class and let the tests drive it."}))
        sys.exit(0)
    except BaseException:
        print("${SENTINEL}")
        print(json.dumps({"fatal": traceback.format_exc(limit=3)}))
        sys.exit(0)
    _setup_ok = True
    for _line in _t.get("setup", []):
        try:
            exec(_line, _ns)
        except SystemExit:
            _results.append({"call": "setup: " + _line, "passed": False,
                             "error": "SystemExit: your code called exit()/sys.exit()"})
            _setup_ok = False
            break
        except BaseException as _e:
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
                _actual = json.loads(json.dumps(_actual, allow_nan=False))
                _r["actual"] = _actual
                _r["passed"] = _match(_actual, _c["expect"])
            except (TypeError, ValueError):
                _r["error"] = "result is not a JSON-comparable value: " + repr(_actual)
        except SystemExit:
            _r["error"] = "SystemExit: your code called exit()/sys.exit() — remove it and return a value instead"
        except BaseException as _e:
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

    // detached => own process group, and the timeout kills the whole
    // group (-pid), so learner-spawned subprocesses die with the harness
    // instead of being orphaned.
    const child = spawn('python3', ['harness.py'], {
      cwd: tmpDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let oversize = false;

    const killGroup = () => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, TIMEOUT_MS);

    child.stdout.on('data', (d) => {
      stdout += d;
      if (stdout.length > 4 * 1024 * 1024 && !oversize) { oversize = true; killGroup(); }
    });
    child.stderr.on('data', (d) => { if (stderr.length < 64 * 1024) stderr += d; });

    child.on('error', (err) => {
      clearTimeout(timer);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      resolve({
        passed: false,
        error: err.code === 'ENOENT'
          ? 'python3 was not found on this machine — install Python 3 to run katas.'
          : `Test runner failed: ${err.message}`,
      });
    });

    child.on('close', () => {
      clearTimeout(timer);
      fs.rmSync(tmpDir, { recursive: true, force: true });

      if (timedOut) {
        return resolve({
          passed: false,
          error: `Timed out after ${TIMEOUT_MS / 1000}s — check for an infinite loop.`,
        });
      }
      if (oversize) {
        return resolve({
          passed: false,
          error: 'Your code printed far too much output — remove the print loop and try again.',
        });
      }

      // Line-based protocol: the payload is everything after the LAST
      // line that is exactly the sentinel. Learner output that merely
      // contains the sentinel string can't break parsing.
      const lines = stdout.split('\n');
      let mark = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() === SENTINEL) { mark = i; break; }
      }
      if (mark === -1) {
        const detail = (stderr || 'no output').trim();
        return resolve({ passed: false, error: `Test runner failed: ${detail}` });
      }

      let payload;
      try {
        payload = JSON.parse(lines.slice(mark + 1).join('\n').trim());
      } catch {
        return resolve({ passed: false, error: 'Test runner produced unreadable output.' });
      }

      if (payload.fatal) {
        return resolve({ passed: false, fatal: payload.fatal.trim() });
      }
      const results = payload.results || [];
      resolve({ passed: results.length > 0 && results.every((r) => r.passed), results });
    });
  });
}

// Dispatch on the exercise's declared runner — content stays data.
// (project-run lives in project.js; lazy require avoids a module cycle.)
function runTests(exercise, userCode) {
  const runner = exercise.verification.runner;
  if (runner === 'python-script') return runHarness(SCRIPT_HARNESS, exercise, userCode);
  if (runner === 'project-run') return require('./project').runProject(exercise);
  return runHarness(HARNESS, exercise, userCode);
}

module.exports = { runTests, TIMEOUT_MS };
