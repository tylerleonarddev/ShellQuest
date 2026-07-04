#!/usr/bin/env node
'use strict';
// ShellQuest regression suite. Self-contained, runs against the repo it
// lives in (never touches progress data). `npm test`.
//
// Covers the invariants that must never regress:
//   1. Every python kata passes its reference solution (bad test = caught).
//   2. Ladder integrity: no dangling prereqs, valid DAG, one root/track.
//   3. Help examples never solve their own kata.
//   4. The python runner's safety behaviors (exit/sentinel/NaN/timeout).
const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const content = require(path.join(ROOT, 'app/lib/content'));
const schedule = require(path.join(ROOT, 'app/lib/schedule'));
const { isUnlocked } = require(path.join(ROOT, 'app/lib/unlock'));
const { runTests } = require(path.join(ROOT, 'app/lib/verify-python'));
const REFS = require('./references');

let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.error(`  ✗ ${m}`); failed++; };

async function main() {
  const { exercises, errors } = content.loadExercises();

  console.log('content loads');
  if (errors.length) bad(`content errors: ${JSON.stringify(errors)}`);
  else ok(`${exercises.length} exercises load clean`);
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));

  console.log('every python kata passes its reference solution');
  const katas = exercises.filter(
    (e) => e.type === 'python-kata' && (e.verification || {}).runner !== 'project-run' && e.track !== 'onboarding'
  );
  for (const k of katas) {
    if (!REFS[k.id]) { bad(`${k.id}: no reference solution in tests/references.js`); continue; }
    const res = await runTests(k, REFS[k.id]);
    if (res.passed) ok(`${k.id} (${(k.verification.tests || []).length} tests)`);
    else bad(`${k.id}: reference failed — ${JSON.stringify(res.results?.filter((r) => !r.passed) || res)}`);
  }

  console.log('ladder integrity');
  let dangling = 0;
  for (const e of exercises) for (const p of e.prerequisites || []) if (!byId[p]) { bad(`${e.id} -> unknown prereq ${p}`); dangling++; }
  if (!dangling) ok('no dangling prerequisites');
  // DAG
  const state = {};
  let cycle = false;
  const visit = (id, trail) => {
    if (state[id] === 2) return;
    if (state[id] === 1) { bad(`prereq cycle: ${[...trail, id].join(' -> ')}`); cycle = true; return; }
    state[id] = 1;
    for (const p of (byId[id].prerequisites || [])) if (byId[p]) visit(p, [...trail, id]);
    state[id] = 2;
  };
  for (const e of exercises) visit(e.id, []);
  if (!cycle) ok('prerequisite graph is a DAG');
  // one root per track group
  const rootsByGroup = {};
  for (const e of exercises) {
    if (e.track === 'onboarding') continue;
    if ((e.prerequisites || []).length === 0) {
      const g = (e.track || '').startsWith('project:') ? e.track : e.type === 'shell-challenge' ? 'terminal' : 'python';
      (rootsByGroup[g] = rootsByGroup[g] || []).push(e.id);
    }
  }
  let multiRoot = false;
  for (const [g, roots] of Object.entries(rootsByGroup)) if (roots.length > 1) { bad(`${g}: ${roots.length} roots (${roots})`); multiRoot = true; }
  if (!multiRoot) ok('one entry point per track');

  console.log('help examples never solve their own kata');
  let helpChecked = 0;
  for (const e of exercises) {
    const sol = e.help && e.help.example && e.help.example.solution;
    if (!sol || e.type !== 'python-kata' || (e.verification || {}).runner === 'project-run') continue;
    const res = await runTests(e, sol);
    if (res.passed) bad(`${e.id}: help.example.solution PASSES its own tests`);
    else { ok(`${e.id}: help example is a genuinely different problem`); helpChecked++; }
  }
  if (!helpChecked) console.log('  (no help examples to check)');

  console.log('python runner safety');
  const fn = { verification: { runner: 'python-test', tests: [{ call: 'f(2)', expect: 4 }] } };
  let r = await runTests(fn, 'def f(x):\n    return x*2\nexit()\n');
  r.fatal ? ok('exit() -> friendly fatal') : bad(`exit() not handled: ${JSON.stringify(r)}`);
  r = await runTests(fn, 'def f(x):\n    print("__SHELLQUEST_RESULTS__")\n    return x*2\n');
  r.passed ? ok('sentinel spoof cannot break parsing') : bad('sentinel spoof broke the run');
  r = await runTests(fn, 'def f(x):\n    return float("nan")\n');
  (r.results && r.results[0].error) ? ok('NaN handled as non-comparable') : bad('NaN not handled');
  r = await runTests(fn, 'def f(x):\n    while True:\n        pass\n');
  (r.error && /Timed out/.test(r.error)) ? ok('infinite loop times out') : bad('timeout not enforced');

  console.log('AI hint safety filter (mechanical, no model needed)');
  const { checkHint } = require(path.join(ROOT, 'app/lib/ai-hint'));
  const mustReject = [
    ['def char_count(s):\n    counts = {}', 'a function definition'],
    ['Just write: return {c: s.count(c) for c in s}', 'return plus code'],
    ['Try counts[c] = counts.get(c, 0) + 1 inside your loop.', 'an assignment'],
    ['```python\nprint(42)\n```', 'a code fence'],
    ['Use x == 0 to test for zero.', 'a comparison operator'],
    ['Here is the fix:\n    counts.update(s)', 'an indented body'],
    ['>>> char_count("hi")', 'a REPL transcript'],
    ['', 'an empty reply'],
    ['w'.repeat(400), 'an over-long reply'],
  ];
  for (const [text, label] of mustReject) {
    checkHint(text).ok ? bad(`filter passed ${label}`) : ok(`filter rejects ${label}`);
  }
  const mustAllow = [
    'Your code counts every character once — what should happen the second time you meet the same one?',
    'Look at what your loop does when the list is empty. Does it ever start?',
    'You are comparing the whole list to the target instead of one item at a time.',
  ];
  for (const text of mustAllow) {
    checkHint(text).ok ? ok('filter allows a clean Socratic hint') : bad(`filter wrongly rejected: "${text}"`);
  }

  console.log('\n' + (failed ? `FAILED: ${failed} check(s)` : 'ALL TESTS PASSED'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SUITE CRASHED:', e.stack || e.message); process.exit(1); });
