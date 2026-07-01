'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Shell challenges play out in a real directory the user works on with a
// real terminal: ~/shellquest-lab/<challenge-id>/. The environment is
// declared as DATA in the content file ("setup": { dirs, files }) — never
// as a script — in keeping with the content-is-data rule.
const LAB_ROOT = path.join(os.homedir(), 'shellquest-lab');

function labDir(exerciseId) {
  return path.join(LAB_ROOT, exerciseId);
}

// Planted flags are DYNAMIC: content files carry a {{FLAG}} placeholder,
// never an answer. A random flag is generated per materialization and only
// its hash is stored (outside the lab dir, outside the repo) — so the
// public repo contains no secrets and every machine gets fresh flags.
function verifyFile(exerciseId) {
  return path.join(LAB_ROOT, '.verify', `${exerciseId}.json`);
}

function readFlagHash(exerciseId) {
  try {
    return JSON.parse(fs.readFileSync(verifyFile(exerciseId), 'utf8')).flag_sha256;
  } catch {
    return null;
  }
}

function materialize(exercise) {
  const dir = labDir(exercise.id);
  fs.mkdirSync(dir, { recursive: true });
  const setup = exercise.setup || {};

  const needsFlag = (setup.files || []).some((f) => f.contents.includes('{{FLAG}}'));
  if (needsFlag) {
    const flag = `SQ{${crypto.randomBytes(4).toString('hex')}}`;
    const hash = crypto.createHash('sha256').update(flag).digest('hex');
    fs.mkdirSync(path.dirname(verifyFile(exercise.id)), { recursive: true });
    fs.writeFileSync(verifyFile(exercise.id), JSON.stringify({ flag_sha256: hash }) + '\n');
    setup._flag = flag;
  }

  for (const d of setup.dirs || []) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }
  for (const f of setup.files || []) {
    const full = path.join(dir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents.replaceAll('{{FLAG}}', setup._flag || ''));
  }
  delete setup._flag;
  return dir;
}

// Plant the lab on first open; leave it alone afterwards so the user's
// in-progress work survives app restarts.
function ensureLab(exercise) {
  const dir = labDir(exercise.id);
  if (!fs.existsSync(dir)) materialize(exercise);
  return dir;
}

// Wipe and re-plant — the escape hatch when the user has mangled the lab.
function resetLab(exercise) {
  const dir = labDir(exercise.id);
  fs.rmSync(dir, { recursive: true, force: true });
  return materialize(exercise);
}

module.exports = { labDir, ensureLab, resetLab, readFlagHash, LAB_ROOT };
