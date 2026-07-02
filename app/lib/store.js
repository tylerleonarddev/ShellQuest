'use strict';
// Durable JSON storage for progress data (v0.9.2 hardening).
//
// Two guarantees the bare fs calls didn't give:
//  1. Writes are ATOMIC (temp file + rename) — a crash mid-write can never
//     leave a truncated file.
//  2. Corruption is LOUD and recoverable — a file that exists but doesn't
//     parse is backed up (<file>.corrupt-<ts>), then restored from the
//     last git-committed copy when possible. Only a missing file returns
//     the fallback silently; data is never wiped by a quiet default.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { REPO_ROOT } = require('./paths');

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function restoreFromGit(file) {
  const rel = path.relative(REPO_ROOT, file);
  try {
    const committed = execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
    return JSON.parse(committed);
  } catch {
    return undefined;
  }
}

function readJson(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return fallback; // genuinely absent — fallback is correct
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt file: preserve the evidence, then try the last committed copy.
    const backup = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      fs.copyFileSync(file, backup);
    } catch { /* keep going — recovery matters more than the backup */ }
    console.error(`[store] ${path.basename(file)} is corrupt; backed up to ${path.basename(backup)}`);
    const restored = restoreFromGit(file);
    if (restored !== undefined) {
      writeJson(file, restored);
      console.error(`[store] ${path.basename(file)} restored from last git commit`);
      return restored;
    }
    console.error(`[store] no committed copy of ${path.basename(file)}; using fallback`);
    return fallback;
  }
}

module.exports = { readJson, writeJson };
