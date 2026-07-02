'use strict';
// The game brain: FSRS spaced repetition (v0.6, via ts-fsrs), the daily
// queue, clear-the-daily streaks, and weekly goals. Queue/streak math
// lives in pure functions; file orchestration below.
const fs = require('fs');
const path = require('path');
const { createEmptyCard, fsrs, Rating } = require('ts-fsrs');
const { PROGRESS_DIR } = require('./paths');
const { isUnlocked } = require('./unlock');

// Long-term (daily-granularity) scheduling only: with short-term steps on,
// a freshly passed exercise comes "due" 10 minutes later, same day.
const SCHEDULER = fsrs({ request_retention: 0.9, enable_short_term: false });

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

/* ── FSRS card handling ── */

// Cards persist as JSON (ISO date strings); ts-fsrs wants Date objects.
function rehydrateCard(stored) {
  return {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

function serializeCard(card, extra = {}) {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
    ...extra,
  };
}

// The local calendar day this card becomes due — daily-queue granularity.
function cardDueDay(stored) {
  return localDateString(new Date(stored.due));
}

// Rate a card: pass -> Good, fail -> Again (binary tests; see v0.6 spec).
function rateCard(stored, rating, when = new Date()) {
  const card = stored ? rehydrateCard(stored) : createEmptyCard(when);
  return SCHEDULER.next(card, when, rating).card;
}

// A card whose due date is preserved from pre-FSRS data: fresh memory
// state, inherited schedule. Self-corrects within a couple of reviews.
function freshCardDue(dueDay, when = new Date()) {
  const card = createEmptyCard(when);
  card.due = new Date(`${dueDay}T12:00:00`);
  return card;
}

// Curriculum order = prerequisite depth, then id. Alphabetical order would
// serve binary-search before reverse-string. Memoized (v0.9.2): the naive
// recursion was exponential on fan-in graphs and ran on every state load.
function ladderDepth(exercise, byId, memo = new Map(), visiting = new Set()) {
  if (memo.has(exercise.id)) return memo.get(exercise.id);
  if (visiting.has(exercise.id)) return 0; // cycle guard; content is lint-validated acyclic
  visiting.add(exercise.id);
  const prereqs = (exercise.prerequisites || []).map((p) => byId[p]).filter(Boolean);
  const depth = prereqs.length
    ? 1 + Math.max(...prereqs.map((p) => ladderDepth(p, byId, memo, visiting)))
    : 0;
  visiting.delete(exercise.id);
  memo.set(exercise.id, depth);
  return depth;
}

// One pass over the whole catalog -> Map(id -> depth), for sorts.
function computeDepths(exercises) {
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const memo = new Map();
  for (const e of exercises) ladderDepth(e, byId, memo);
  return memo;
}

// Due reviews first (most overdue first), then the next new rungs.
function generateDailyQueue(exercises, completions, cards, today) {
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));

  const due = Object.entries(cards)
    .filter(([id, c]) => byId[id] && cardDueDay(c) <= today)
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0]))
    .map(([id]) => id);

  const depths = computeDepths(exercises);
  const newRung = exercises
    .filter((e) => e.track !== 'onboarding')
    .filter((e) => !completedIds.has(e.id) && isUnlocked(e, completions))
    .sort((a, b) => depths.get(a.id) - depths.get(b.id) || a.id.localeCompare(b.id))
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

// Durable reads/writes: atomic renames, loud corruption recovery (store.js).
const { readJson, writeJson } = require('./store');

// Read review state, migrating pre-FSRS (SM-2-lite) data on sight: each
// old schedule becomes a fresh card that keeps its existing next-review
// date, so the upgrade changes nothing about tomorrow's queue.
function getReviews() {
  const data = readJson(REVIEWS_FILE, { cards: {} });
  if (data.schedules) {
    const cards = {};
    for (const [id, old] of Object.entries(data.schedules)) {
      cards[id] = serializeCard(freshCardDue(old.next_review));
    }
    const migrated = { cards };
    writeJson(REVIEWS_FILE, migrated);
    return migrated;
  }
  if (!data.cards) data.cards = {};
  return data;
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
    if (!reviews.cards[c.exercise_id]) {
      reviews.cards[c.exercise_id] = serializeCard(freshCardDue(today));
      changed = true;
    }
  }
  if (changed) writeJson(REVIEWS_FILE, reviews);
  return reviews;
}

// Clear the day: streak advances, last_cleared_date set, profile saved
// IMMEDIATELY (crash-safety: the streak day must never depend on a later
// save). Rest days (nothing due) keep the chain alive without bonus XP.
function markCleared(daily, today, awardBonus) {
  const progress = require('./progress'); // lazy: keeps the import graph flat
  const profile = progress.getProfile();
  if (profile.last_cleared_date !== today) {
    profile.streak_days = streakAfterClear(profile.last_cleared_date, profile.streak_days, today);
    profile.last_cleared_date = today;
    if (awardBonus) profile.xp += daily.bonus_xp || DAILY_BONUS_XP;
    progress.saveProfile(profile);
  }
  daily.bonus_awarded = true;
}

function ensureDaily(exercises, completions, today) {
  let daily = readJson(DAILY_FILE, null);
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));

  // A clock that moved BACKWARDS (timezone travel, manual fix) must not
  // wipe an in-progress day — keep the newest state we have.
  if (daily && daily.date > today) return daily;

  if (!daily || daily.date !== today) {
    const reviews = backfillSchedules(completions, today, byId);
    const queue = generateDailyQueue(exercises, completions, reviews.cards, today);
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
    // Fully caught up — nothing due, nothing new. That's an earned rest
    // day, not a broken streak: auto-clear it (no bonus XP).
    if (queue.length === 0) {
      daily.rest_day = true;
      markCleared(daily, today, false);
    }
    writeJson(DAILY_FILE, daily);
    return daily;
  }

  // Same-day reconcile: content changes (a pull, a rename) can strand ids
  // in today's frozen queue that no longer resolve — which would make the
  // daily silently unclearable. Drop ghosts and re-evaluate.
  const ghosts = daily.queue.filter((id) => !byId[id]);
  if (ghosts.length) {
    daily.queue = daily.queue.filter((id) => byId[id]);
    daily.completed = daily.completed.filter((id) => byId[id]);
    for (const g of ghosts) delete (daily.kinds || {})[g];
    if (!daily.bonus_awarded) {
      if (daily.queue.length === 0) {
        daily.rest_day = true;
        markCleared(daily, today, false);
      } else if (daily.queue.every((id) => daily.completed.includes(id))) {
        markCleared(daily, today, true); // they earned it — award the bonus
      }
    }
    writeJson(DAILY_FILE, daily);
  }
  return daily;
}

function ensureWeekly(today) {
  const weekStart = mondayOf(today);
  let weekly = readJson(WEEKLY_FILE, null);
  // Backwards clock must not wipe the running week (see ensureDaily).
  if (weekly && weekly.week_start > weekStart) return weekly;
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
  // ensureDaily FIRST: it may backfill cards into reviews.json, and a
  // reviews snapshot taken before it would clobber that write.
  const daily = ensureDaily(exercises, completions, today);
  const weekly = ensureWeekly(today);
  const reviews = getReviews();
  const events = { review: false, dailyCleared: false, weeklyCompleted: false, bonusXp: 0 };

  if (isSchedulable(exercise)) {
    const prev = reviews.cards[exercise.id];
    if (!prev) {
      reviews.cards[exercise.id] = serializeCard(rateCard(null, Rating.Good));
    } else if (cardDueDay(prev) <= today) {
      reviews.cards[exercise.id] = serializeCard(rateCard(prev, Rating.Good));
      events.review = true;
    }
    writeJson(REVIEWS_FILE, reviews);
  }

  // Lessons and the onboarding demo aren't "new exercises" for the weekly
  // goal — only real, schedulable work counts.
  if (firstCompletion && isSchedulable(exercise)) bumpWeekly(weekly, 'new_exercises');

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
    // Persist the streak day NOW — a crash before the caller's later
    // profile save must not eat a cleared day. (The caller saves again
    // with bonus XP; this write is the safety floor.)
    require('./progress').saveProfile({ ...profile });
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
// Only a DUE review takes the hit (Rating.Again), and only once per day —
// repeated attempts while relearning don't compound. Casual failures on
// unscheduled or not-yet-due exercises never touch the card.
function applyFailure(exercise, today = localDateString()) {
  const reviews = getReviews();
  const prev = reviews.cards[exercise.id];
  if (prev && cardDueDay(prev) <= today && prev.sq_last_failed_on !== today) {
    reviews.cards[exercise.id] = serializeCard(rateCard(prev, Rating.Again), {
      sq_last_failed_on: today,
    });
    writeJson(REVIEWS_FILE, reviews);
    return { reviewFailed: true };
  }
  return { reviewFailed: false };
}

module.exports = {
  // exported for tests and future scheduler versions
  rateCard,
  serializeCard,
  cardDueDay,
  freshCardDue,
  Rating,
  generateDailyQueue,
  streakAfterClear,
  effectiveStreak,
  ladderDepth,
  computeDepths,
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
