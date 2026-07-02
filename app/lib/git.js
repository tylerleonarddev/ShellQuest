'use strict';
const { execFile } = require('child_process');
const { REPO_ROOT } = require('./paths');

function git(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: REPO_ROOT }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

// Stage ONLY the given paths — never `git add -A`. Nothing else in the
// repo should ride along on an auto-commit.
async function commitPaths(paths, message) {
  try {
    await git(['add', '--', ...paths]);
    const status = await git(['status', '--porcelain', '--', ...paths]);
    if (!status) return { committed: false };
    // Pathspec-scoped commit: ONLY these paths land in the commit, even
    // if the user has other files manually staged — an unscoped commit
    // would sweep them into the auto-commit and push them.
    await git(['commit', '-m', message, '--', ...paths]);
    return { committed: true };
  } catch (err) {
    // A failed auto-commit (e.g. missing git identity) must never block
    // the action itself — surface it, don't throw.
    return { committed: false, error: err.message };
  }
}

function commitProgress(message) {
  return commitPaths(['progress'], message);
}

// Push with an honest, human-readable outcome — the UI repeats this
// verbatim, so "why" matters more than the raw git error.
async function push() {
  try {
    await git(['push']);
    return { pushed: true };
  } catch (err) {
    const msg = err.message || '';
    let reason = msg.split('\n')[0] || 'unknown error';
    // Auth patterns FIRST: HTTPS failures say "unable to access ... 403",
    // which the network pattern would otherwise misread as offline.
    if (/permission denied|publickey|authentication failed|401|403|could not read username/i.test(msg)) {
      reason = 'authentication failed — check your SSH key or credentials';
    } else if (/no configured push destination|does not appear to be a git repository/i.test(msg)) {
      reason = 'no remote configured';
    } else if (/could not resolve host|network is unreachable|connection (refused|timed out)|unable to access/i.test(msg)) {
      reason = 'no internet connection';
    } else if (/rejected|non-fast-forward|fetch first/i.test(msg)) {
      reason = 'remote has newer commits — pull first';
    }
    return { pushed: false, reason };
  }
}

module.exports = { commitProgress, commitPaths, push };
