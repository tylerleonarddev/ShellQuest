'use strict';
// Anti-crutch ledger: every AI hint request is recorded per exercise per
// day in progress/ai-help.json. Two consumers: applyPass grades an
// AI-assisted pass Rating.Hard instead of Good (the kata resurfaces
// sooner in FSRS — usage is a diagnostic, not just a crutch), and the
// raw counts stay inspectable for future "this concept isn't solid"
// surfacing.
const path = require('path');
const { PROGRESS_DIR } = require('./paths');
const { readJson, writeJson } = require('./store');

const AI_HELP_FILE = path.join(PROGRESS_DIR, 'ai-help.json');

function load() {
  return readJson(AI_HELP_FILE, { days: {} });
}

function record(exerciseId, today) {
  const data = load();
  const day = (data.days[today] = data.days[today] || {});
  day[exerciseId] = (day[exerciseId] || 0) + 1;
  writeJson(AI_HELP_FILE, data);
  return day[exerciseId];
}

function usedToday(exerciseId, today) {
  const day = load().days[today];
  return !!(day && day[exerciseId]);
}

module.exports = { record, usedToday, AI_HELP_FILE };
