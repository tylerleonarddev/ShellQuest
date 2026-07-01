'use strict';
const fs = require('fs');
const path = require('path');
const { DRAFTS_DIR } = require('./paths');
const { PUBLISHED_DIR } = require('./publish');
const { loadExercises } = require('./content');
const { getProfile, getCompletions, localDateString } = require('./progress');
const { addDays, mondayOf } = require('./schedule');

// Local calendar date of an ISO completion timestamp.
function localDayOf(iso) {
  return localDateString(new Date(iso));
}

function digestFilename(weekStart) {
  return `weekly-${weekStart}.md`;
}

function digestExists(weekStart) {
  const name = digestFilename(weekStart);
  return (
    fs.existsSync(path.join(DRAFTS_DIR, name)) ||
    fs.existsSync(path.join(PUBLISHED_DIR, name))
  );
}

// Draft a "this week I learned" summary for the week starting `weekStart`.
// `weeklyStats` should be the weekly.json that covered that week (its
// stats/goals), which the caller has on hand both for the live week and
// at rollover time.
function generateDigest(weekStart, weeklyStats) {
  const weekEnd = addDays(weekStart, 6);
  const { exercises } = loadExercises();
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const profile = getProfile();

  const week = getCompletions().completions.filter((c) => {
    const d = localDayOf(c.passed_at);
    return d >= weekStart && d <= weekEnd;
  });

  const byTrack = {};
  for (const c of week) {
    const ex = byId[c.exercise_id];
    const track = ex ? ex.type : 'other';
    (byTrack[track] = byTrack[track] || []).push(ex ? ex.title : c.exercise_id);
  }

  const trackLines = Object.entries(byTrack)
    .map(([track, titles]) => `**${track}** — ${titles.map((t) => `${t}`).join(' · ')}`)
    .join('\n\n');

  const stats = (weeklyStats && weeklyStats.stats) || { reviews_cleared: 0, xp_gained: 0 };
  const daysCleared =
    (weeklyStats && (weeklyStats.goals || []).find((g) => g.kind === 'clear_daily_days')) || {};

  const body = `# This week I learned — week of ${weekStart}

*${weekStart} → ${weekEnd}*

## New ground

${trackLines || '_No new exercises this week — reviews only._'}

## The numbers

- New exercises completed: **${week.length}**
- Reviews cleared: **${stats.reviews_cleared}**
- Dailies cleared: **${daysCleared.progress ?? 0}${daysCleared.target ? ` / ${daysCleared.target}` : ''}**
- XP gained: **${stats.xp_gained}**
- Streak: **${profile.streak_days} day${profile.streak_days === 1 ? '' : 's'}**

## Reflection

<!-- One thing from this week you'd explain differently now than before you learned it: -->

`;

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const file = path.join(DRAFTS_DIR, digestFilename(weekStart));
  fs.writeFileSync(file, body);
  return file;
}

module.exports = { generateDigest, digestExists, digestFilename };
