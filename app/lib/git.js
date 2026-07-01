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

// Stage ONLY progress/ — never `git add -A`. Drafts are gitignored and
// nothing else in the repo should ride along on an auto-commit.
async function commitProgress(message) {
  try {
    await git(['add', 'progress']);
    const status = await git(['status', '--porcelain', 'progress']);
    if (!status) return { committed: false };
    await git(['commit', '-m', message]);
    return { committed: true };
  } catch (err) {
    // A failed auto-commit (e.g. missing git identity) must never block
    // the pass itself — surface it, don't throw.
    return { committed: false, error: err.message };
  }
}

module.exports = { commitProgress };
