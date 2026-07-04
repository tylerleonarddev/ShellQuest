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

  // Setup paths are content-authored data — enforce the same isolation
  // rule as project assembly: nothing materializes outside the lab dir.
  const inLab = (p) => {
    const rel = path.relative(dir, path.resolve(dir, p));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  for (const d of setup.dirs || []) {
    if (!inLab(d)) continue; // linter rejects these; refuse at runtime too
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }
  for (const f of setup.files || []) {
    if (!inLab(f.path)) continue;
    const full = path.resolve(dir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    // v1.5 setup extensions — still pure data, no scripts:
    //   base64: true          -> contents is base64 (archives, binaries);
    //                            no {{FLAG}} substitution inside
    //   mode: "0755"          -> octal file mode (default umask otherwise)
    //   mtime_days_ago: 30    -> age the file (find -newer / ls -t missions)
    if (f.base64) {
      fs.writeFileSync(full, Buffer.from(f.contents, 'base64'));
    } else {
      fs.writeFileSync(full, f.contents.replaceAll('{{FLAG}}', setup._flag || ''));
    }
    if (f.mode) fs.chmodSync(full, parseInt(f.mode, 8));
    if (typeof f.mtime_days_ago === 'number') {
      const t = new Date(Date.now() - f.mtime_days_ago * 86400 * 1000);
      fs.utimesSync(full, t, t);
    }
  }
  // Symlinks: { link, target } — target is stored as written (relative,
  // so labs survive being moved) but must resolve inside the lab.
  for (const s of setup.symlinks || []) {
    if (!inLab(s.link)) continue;
    const full = path.resolve(dir, s.link);
    const resolvedTarget = path.resolve(path.dirname(full), s.target);
    if (path.relative(dir, resolvedTarget).startsWith('..')) continue;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    try {
      fs.symlinkSync(s.target, full);
    } catch { /* already present on re-materialize */ }
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
