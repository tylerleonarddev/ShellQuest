'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { labDir, readFlagHash } = require('./lab');

const TIMEOUT_MS = 5000;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Relative paths resolve against the challenge's lab dir; ~/... and
// absolute paths are honored as written.
function resolvePath(p, exerciseId) {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (path.isAbsolute(p)) return p;
  return path.join(labDir(exerciseId), p);
}

function describe(check) {
  switch (check.kind) {
    case 'flag': return 'flag matches';
    case 'file-exists': return `${check.path} exists`;
    case 'file-contains': return `${check.path} contains /${check.pattern}/`;
    case 'command-output': return `output of \`${check.command}\``;
    default: return check.kind;
  }
}

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    execFile(
      'bash',
      ['-c', command],
      { cwd, timeout: TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err, stdout) => {
        if (err && err.killed) return resolve({ error: `timed out after ${TIMEOUT_MS / 1000}s` });
        if (err) return resolve({ error: err.message.split('\n')[0] });
        resolve({ stdout });
      }
    );
  });
}

// Answers live in the public repo only as SHA-256 hashes; the submission
// (and command output) is hashed with surrounding whitespace trimmed.
async function runChecks(exercise, { flag = '' } = {}) {
  const results = [];

  for (const check of exercise.verification.checks) {
    const r = { kind: check.kind, detail: describe(check), passed: false };
    try {
      switch (check.kind) {
        case 'flag': {
          // Static: hash in the content file. Dynamic: hash generated at
          // lab materialization (planted flags never live in the repo).
          const expected = check.expected_sha256 || readFlagHash(exercise.id);
          if (!expected) r.error = 'lab not set up — open the challenge to plant it';
          else if (!flag.trim()) r.error = 'no flag submitted';
          else if (sha256(flag.trim()) === expected) r.passed = true;
          else r.error = 'that is not the flag';
          break;
        }
        case 'file-exists': {
          if (fs.existsSync(resolvePath(check.path, exercise.id))) r.passed = true;
          else r.error = 'not found';
          break;
        }
        case 'file-contains': {
          const full = resolvePath(check.path, exercise.id);
          if (!fs.existsSync(full)) {
            r.error = 'file not found';
          } else if (new RegExp(check.pattern, 'm').test(fs.readFileSync(full, 'utf8'))) {
            r.passed = true;
          } else {
            r.error = 'pattern not found in file';
          }
          break;
        }
        case 'command-output': {
          const out = await runCommand(check.command, labDir(exercise.id));
          if (out.error) r.error = out.error;
          else if (sha256(out.stdout.trim()) === check.expected_sha256) r.passed = true;
          else r.error = 'output did not match';
          break;
        }
        default:
          r.error = `unknown check kind: ${check.kind}`;
      }
    } catch (err) {
      r.error = err.message;
    }
    results.push(r);
  }

  return { passed: results.length > 0 && results.every((r) => r.passed), results };
}

module.exports = { runChecks, sha256 };
