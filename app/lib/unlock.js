'use strict';

// The single pure gating rule (v0.2). The v0.3 scheduler reuses this —
// keep it free of I/O and app state.
function isUnlocked(exercise, completions) {
  const done = new Set(completions.completions.map((c) => c.exercise_id));
  return (exercise.prerequisites || []).every((id) => done.has(id));
}

module.exports = { isUnlocked };
