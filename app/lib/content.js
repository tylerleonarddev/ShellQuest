'use strict';
const fs = require('fs');
const path = require('path');
const { CONTENT_DIR } = require('./paths');

const REQUIRED_FIELDS = ['id', 'type', 'title', 'xp', 'prompt', 'verification'];

// Recursively load every *.json under content/. Bad files are reported,
// never fatal — one malformed exercise must not take down the app.
function loadExercises() {
  const exercises = [];
  const errors = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        try {
          const exercise = JSON.parse(fs.readFileSync(full, 'utf8'));
          const missing = REQUIRED_FIELDS.filter((f) => exercise[f] === undefined);
          if (missing.length) {
            errors.push({ file: full, error: `missing fields: ${missing.join(', ')}` });
          } else {
            exercises.push(exercise);
          }
        } catch (err) {
          errors.push({ file: full, error: err.message });
        }
      }
    }
  }

  walk(CONTENT_DIR);
  exercises.sort((a, b) => a.id.localeCompare(b.id));
  return { exercises, errors };
}

function getExercise(id) {
  const { exercises } = loadExercises();
  return exercises.find((e) => e.id === id) || null;
}

module.exports = { loadExercises, getExercise };
