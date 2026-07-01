'use strict';
// The game brain (v0.3): SM-2-lite spaced repetition, the daily queue,
// clear-the-daily streaks, and weekly goals. Interval/queue/streak math
// lives in pure functions up top; file orchestration below.
const fs = require('fs');
const path = require('path');
const { PROGRESS_DIR } = require('./paths');
const { isUnlocked } = require('./unlock');

const REVIEWS_FILE = path.join(PROGRESS_DIR, 'reviews.json');
const DAILY_FILE = path.join(PROGRESS_DIR, 'daily.json');
const WEEKLY_FILE = path.join(PROGRESS_DIR, 'weekly.json');

const DAILY_CAP = 5;
const DAILY_MAX_NEW = 2;
const DAILY_BONUS_XP = 15;
const DEFAULT_GOALS = [
  { kind: 'clear_daily_days', target: 5, bonus_xp: 60 },
  { kind: 'new_exercises', target: 3, bonus_xp: 40 },
];

/* ── Pure date helpers (local calendar, consistent with progress.js) ── */

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateString(d);
}

/* ── Pure scheduling math (SM-2-lite) ── */

// prev=null means first completion. Returns the new schedule record.
function nextSchedule(prev, result, today, reviewIntervalDays) {
  if (!prev) {
    const interval = reviewIntervalDays || 1;
    return {
      interval_days: interval,
      ease: 2.3,
      next_review: addDays(today, interval),
      last_result: 'pass',
    };
  }
  if (result === 'pass') {
    const interval = Math.max(1, Math.round(prev.interval_days * prev.ease));
    return {
      interval_days: interval,
      ease: Math.min(3.0, prev.ease + 0.1),
      next_review: addDays(today, interval),
      last_result: 'pass',
    };
  }
  return {
    interval_days: 1,
    ease: Math.max(1.3, prev.ease - 0.2),
    next_review: addDays(today, 1),
    last_result: 'fail',
  };
}

// Curriculum order = prerequisite depth, then id. Alphabetical order would
// serve binary-search before reverse-string.
function ladderDepth(exercise, byId, seen = new Set()) {
  if (seen.has(exercise.id)) return 0; // cycle guard; content is validated acyclic
  seen.add(exercise.id);
  const prereqs = (exercise.prerequisites || []).map((p) => byId[p]).filter(Boolean);
  if (!prereqs.length) return 0;
  return 1 + Math.max(...prereqs.map((p) => ladderDepth(p, byId, new Set(seen))));
}

// Due reviews first (most overdue first), then the next new rungs.
function generateDailyQueue(exercises, completions, schedules, today) {
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));

  const due = Object.entries(schedules)
    .filter(([id, s]) => byId[id] && s.next_review <= today)
    .sort((a, b) => a[1].next_review.localeCompare(b[1].next_review) || a[0].localeCompare(b[0]))
    .map(([id]) => id);

  const newRung = exercises
    .filter((e) => e.track !== 'onboarding')
    .filter((e) => !completedIds.has(e.id) && isUnlocked(e, completions))
    .sort((a, b) => ladderDepth(a, byId) - ladderDepth(b, byId) || a.id.localeCompare(b.id))
    .slice(0, DAILY_MAX_NEW)
    .map((e) => e.id);

  const queue = due.slice(0, DAILY_CAP);
  for (const id of newRung) {
    if (queue.length >= DAILY_CAP) break;
    if (!queue.includes(id)) queue.push(id);
  }
  return queue;
}

// Streak transition when today's daily is cleared.
function streakAfterClear(lastClearedDate, prevStreak, today) {
  return lastClearedDate === addDays(today, -1) ? prevStreak + 1 : 1;
}

// What the streak is worth right now: yesterday (or today) cleared keeps
// it alive; an uncleared gap means it's already dead — show 0.
function effectiveStreak(profile, today) {
  const last = profile.last_cleared_date;
  if (!last) return 0;
  if (last === today || last === addDays(today, -1)) return profile.streak_days;
  return 0;
}

/* ── File-backed state ── */

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

function getReviews() {
  return readJson(REVIEWS_FILE, { schedules: {} });
}

// Lessons are read-once (nothing to re-solve) and onboarding is a
// mechanics demo — neither belongs in spaced repetition.
function isSchedulable(exercise) {
  return exercise && exercise.type !== 'lesson' && exercise.track !== 'onboarding';
}

// Completions that predate the scheduler get a schedule due immediately —
// migration means your existing wins enter the review pool, not vanish.
function backfillSchedules(completions, today, byId = {}) {
  const reviews = getReviews();
  let changed = false;
  for (const c of completions.completions) {
    if (byId[c.exercise_id] && !isSchedulable(byId[c.exercise_id])) continue;
    if (!reviews.schedules[c.exercise_id]) {
      reviews.schedules[c.exercise_id] = {
        interval_days: 1,
        ease: 2.3,
        next_review: today,
        last_result: 'pass',
      };
      changed = true;
    }
  }
  if (changed) writeJson(REVIEWS_FILE, reviews);
  return reviews;
}

function ensureDaily(exercises, completions, today) {
  let daily = readJson(DAILY_FILE, null);
  if (!daily || daily.date !== today) {
    const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
    const reviews = backfillSchedules(completions, today, byId);
    const queue = generateDailyQueue(exercises, completions, reviews.schedules, today);
    // Why each item was queued, frozen at generation time — a "new" item
    // passed later today must not start reading as a "review".
    const completedIds = new Set(completions.completions.map((c) => c.exercise_id));
    const kinds = Object.fromEntries(
      queue.map((id) => [id, completedIds.has(id) ? 'review' : 'new'])
    );
    daily = {
      date: today,
      queue,
      kinds,
      completed: [],
      bonus_awarded: false,
      bonus_xp: DAILY_BONUS_XP,
    };
    writeJson(DAILY_FILE, daily);
  }
  return daily;
}

function ensureWeekly(today) {
  const weekStart = mondayOf(today);
  let weekly = readJson(WEEKLY_FILE, null);
  if (!weekly || weekly.week_start !== weekStart) {
    // Rolling over: the ending week's stats live only in this file, so
    // auto-draft its digest before they're replaced. Lazy require avoids
    // a schedule <-> digest cycle.
    if (weekly && weekly.week_start < weekStart) {
      const hadActivity =
        (weekly.stats && weekly.stats.xp_gained > 0) ||
        (weekly.goals || []).some((g) => g.progress > 0);
      if (hadActivity) {
        try {
          const digest = require('./digest');
          if (!digest.digestExists(weekly.week_start)) {
            digest.generateDigest(weekly.week_start, weekly);
          }
        } catch {
          // digest drafting must never block the scheduler
        }
      }
    }
    const defs = weekly ? weekly.goals : DEFAULT_GOALS;
    weekly = {
      week_start: weekStart,
      goals: defs.map((g) => ({ kind: g.kind, target: g.target, bonus_xp: g.bonus_xp, progress: 0 })),
      bonus_awarded: false,
      // Running counters for the weekly digest — daily.json is overwritten
      // each day and reviews.json holds only current state, so the week's
      // activity is tallied here as it happens.
      stats: { reviews_cleared: 0, xp_gained: 0 },
    };
    writeJson(WEEKLY_FILE, weekly);
  }
  return weekly;
}

function bumpWeekly(weekly, kind, by = 1) {
  for (const g of weekly.goals) {
    if (g.kind === kind) g.progress += by;
  }
}

/* ── The two hooks the run pipeline calls ── */

// After a pass. Returns the events the renderer's reward beat needs plus
// bonus XP to award. `firstCompletion` comes from progress.recordPass.
function applyPass(exercise, firstCompletion, exercises, completions, profile, today = localDateString(), awardedXp = 0) {
  const reviews = getReviews();
  const daily = ensureDaily(exercises, completions, today);
  const weekly = ensureWeekly(today);
  const events = { review: false, dailyCleared: false, weeklyCompleted: false, bonusXp: 0 };

  if (isSchedulable(exercise)) {
    const prev = reviews.schedules[exercise.id];
    if (!prev) {
      reviews.schedules[exercise.id] = nextSchedule(null, 'pass', today, exercise.review_interval_days);
    } else if (prev.next_review <= today) {
      reviews.schedules[exercise.id] = nextSchedule(prev, 'pass', today);
      events.review = true;
    }
    writeJson(REVIEWS_FILE, reviews);
  }

  if (firstCompletion) bumpWeekly(weekly, 'new_exercises');

  if (daily.queue.includes(exercise.id) && !daily.completed.includes(exercise.id)) {
    daily.completed.push(exercise.id);
  }
  const cleared = daily.queue.length > 0 && daily.queue.every((id) => daily.completed.includes(id));
  if (cleared && !daily.bonus_awarded) {
    daily.bonus_awarded = true;
    events.dailyCleared = true;
    events.bonusXp += daily.bonus_xp;
    profile.streak_days = streakAfterClear(profile.last_cleared_date, profile.streak_days, today);
    profile.last_cleared_date = today;
    bumpWeekly(weekly, 'clear_daily_days');
  }
  writeJson(DAILY_FILE, daily);

  if (!weekly.bonus_awarded && weekly.goals.every((g) => g.progress >= g.target)) {
    weekly.bonus_awarded = true;
    events.weeklyCompleted = true;
    events.bonusXp += weekly.goals.reduce((sum, g) => sum + (g.bonus_xp || 0), 0);
  }

  if (!weekly.stats) weekly.stats = { reviews_cleared: 0, xp_gained: 0 };
  if (events.review) weekly.stats.reviews_cleared += 1;
  weekly.stats.xp_gained += awardedXp + events.bonusXp;
  writeJson(WEEKLY_FILE, weekly);

  return events;
}

// After a failed run: only a DUE review takes the hit; casual failures on
// unscheduled or not-yet-due exercises don't touch the schedule.
function applyFailure(exercise, today = localDateString()) {
  const reviews = getReviews();
  const prev = reviews.schedules[exercise.id];
  if (prev && prev.next_review <= today && prev.last_result !== 'fail') {
    reviews.schedules[exercise.id] = nextSchedule(prev, 'fail', today);
    writeJson(REVIEWS_FILE, reviews);
    return { reviewFailed: true };
  }
  return { reviewFailed: false };
}

module.exports = {
  // pure — exported for tests and future scheduler versions
  nextSchedule,
  generateDailyQueue,
  streakAfterClear,
  effectiveStreak,
  ladderDepth,
  addDays,
  mondayOf,
  // state
  getReviews,
  ensureDaily,
  ensureWeekly,
  applyPass,
  applyFailure,
  DAILY_CAP,
  DAILY_BONUS_XP,
};
