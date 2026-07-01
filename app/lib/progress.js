'use strict';
const fs = require('fs');
const { PROFILE_FILE, COMPLETIONS_FILE } = require('./paths');

const DEFAULT_PROFILE = {
  xp: 0,
  level: 1,
  streak_days: 0,
  last_active_date: null,
  last_cleared_date: null,
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function getProfile() {
  return { ...DEFAULT_PROFILE, ...readJson(PROFILE_FILE, {}) };
}

function getCompletions() {
  return readJson(COMPLETIONS_FILE, { completions: [] });
}

function isCompleted(exerciseId) {
  return getCompletions().completions.some((c) => c.exercise_id === exerciseId);
}

// Single tunable level curve: level 2 at 50 XP, 3 at 200, 4 at 450...
function levelForXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

// XP threshold at which `level` ends and level+1 begins.
function xpForNextLevel(level) {
  return 50 * level * level;
}

function xpForLevelStart(level) {
  return 50 * (level - 1) * (level - 1);
}

// Streak math uses the LOCAL calendar date, not UTC — an evening pass
// must not count as tomorrow.
function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Record a passing run. First pass awards XP and appends a completion;
// re-practice awards 0. Since v0.3 the streak belongs to the scheduler
// (consecutive days the daily was cleared), not to individual passes.
function recordPass(exercise) {
  const profile = getProfile();
  const completions = getCompletions();
  const already = completions.completions.some((c) => c.exercise_id === exercise.id);
  const today = localDateString();

  const awardedXp = already ? 0 : exercise.xp;
  const before = JSON.stringify(profile);

  profile.xp += awardedXp;
  profile.level = levelForXp(profile.xp);
  profile.last_active_date = today;

  const profileChanged = JSON.stringify(profile) !== before;
  if (profileChanged) writeJson(PROFILE_FILE, profile);

  if (!already) {
    completions.completions.push({
      exercise_id: exercise.id,
      passed_at: new Date().toISOString(),
      xp_awarded: awardedXp,
    });
    writeJson(COMPLETIONS_FILE, completions);
  }

  return { profile, awardedXp, firstCompletion: !already, changed: profileChanged || !already };
}

// Scheduler bonuses (daily clear, weekly goal) and streak updates arrive
// as an already-mutated profile copy — persist it and re-derive level.
function saveProfile(profile) {
  profile.level = levelForXp(profile.xp);
  writeJson(PROFILE_FILE, profile);
  return profile;
}

function ensureFiles() {
  if (!fs.existsSync(PROFILE_FILE)) writeJson(PROFILE_FILE, DEFAULT_PROFILE);
  if (!fs.existsSync(COMPLETIONS_FILE)) writeJson(COMPLETIONS_FILE, { completions: [] });
}

module.exports = {
  getProfile,
  getCompletions,
  isCompleted,
  recordPass,
  saveProfile,
  ensureFiles,
  levelForXp,
  xpForNextLevel,
  xpForLevelStart,
  localDateString,
};
