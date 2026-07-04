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

  console.log('streak armor math (pure)');
  {
    const { computeStreakClear, maybeEarnFreeze, effectiveStreak } = schedule;
    const eq = (got, want, label) =>
      JSON.stringify(got) === JSON.stringify(want) ? ok(label) : bad(`${label}: got ${JSON.stringify(got)}`);
    eq(computeStreakClear(5, '2026-07-03', 0, '2026-07-04'), { streak: 6, freezes: 0, spent: 0 }, 'consecutive day extends');
    eq(computeStreakClear(5, '2026-07-04', 1, '2026-07-04'), { streak: 5, freezes: 1, spent: 0 }, 'same-day re-clear is a no-op');
    eq(computeStreakClear(5, '2026-07-02', 0, '2026-07-04'), { streak: 1, freezes: 0, spent: 0 }, '1-day gap, no armor -> reset');
    eq(computeStreakClear(5, '2026-07-02', 1, '2026-07-04'), { streak: 6, freezes: 0, spent: 1 }, '1-day gap, 1 token -> held and spent');
    eq(computeStreakClear(5, '2026-07-01', 1, '2026-07-04'), { streak: 1, freezes: 1, spent: 0 }, '2-day gap, 1 token -> reset, token kept');
    eq(computeStreakClear(5, '2026-07-01', 2, '2026-07-04'), { streak: 6, freezes: 0, spent: 2 }, '2-day gap, 2 tokens -> held');
    eq(computeStreakClear(0, null, 2, '2026-07-04'), { streak: 1, freezes: 2, spent: 0 }, 'first clear ever starts at 1');
    eq(maybeEarnFreeze(7, 0), { freezes: 1, earned: true }, 'day 7 earns a token');
    eq(maybeEarnFreeze(8, 1), { freezes: 1, earned: false }, 'day 8 earns nothing');
    eq(maybeEarnFreeze(14, 2), { freezes: 2, earned: false }, 'cap of 2 holds');
    const armored = { last_cleared_date: '2026-07-02', streak_days: 9, streak_freezes: 1 };
    effectiveStreak(armored, '2026-07-04') === 9
      ? ok('armored gap still shows the streak standing')
      : bad('armored streak displayed as dead');
    effectiveStreak({ ...armored, streak_freezes: 0 }, '2026-07-04') === 0
      ? ok('unarmored gap shows 0')
      : bad('dead streak still displayed');
  }

  console.log('lab setup extensions (mode/mtime/symlink/base64)');
  // lab.js resolves HOME at require time, so exercise it in a child
  // process with an isolated HOME — same pattern as the cold-start walk.
  {
    const { execFileSync } = require('child_process');
    const os = require('os');
    const tmpHome = require('fs').mkdtempSync(path.join(os.tmpdir(), 'sq-labtest-'));
    const child = `
      const fs = require('fs');
      const { resetLab, labDir } = require(${JSON.stringify(path.join(ROOT, 'app/lib/lab'))});
      const ex = { id: 'labtest', setup: {
        dirs: ['d'],
        files: [
          { path: 'plain.txt', contents: 'hello {{FLAG}}\\n' },
          { path: 'exec.sh', contents: '#!/bin/bash\\n', mode: '0755' },
          { path: 'old.txt', contents: 'aged\\n', mtime_days_ago: 30 },
          { path: 'bin.dat', contents: 'aGVsbG8=', base64: true },
        ],
        symlinks: [
          { link: 'd/ptr', target: '../plain.txt' },
          { link: 'evil', target: '../../outside' },
        ],
      } };
      resetLab(ex);
      const dir = labDir('labtest');
      const out = {
        flagged: /SQ\\{[0-9a-f]+\\}/.test(fs.readFileSync(dir + '/plain.txt', 'utf8')),
        mode: (fs.statSync(dir + '/exec.sh').mode & 0o777).toString(8),
        aged: (Date.now() - fs.statSync(dir + '/old.txt').mtimeMs) > 29 * 86400e3,
        b64: fs.readFileSync(dir + '/bin.dat', 'utf8') === 'hello',
        link: fs.readlinkSync(dir + '/d/ptr') === '../plain.txt',
        evilBlocked: !fs.existsSync(dir + '/evil'),
      };
      console.log(JSON.stringify(out));
    `;
    const got = JSON.parse(execFileSync('node', ['-e', child], { env: { ...process.env, HOME: tmpHome } }).toString());
    got.flagged ? ok('dynamic flag substitutes') : bad('flag not substituted');
    got.mode === '755' ? ok('mode applies') : bad(`mode wrong: ${got.mode}`);
    got.aged ? ok('mtime_days_ago ages the file') : bad('mtime not applied');
    got.b64 ? ok('base64 contents decode') : bad('base64 not decoded');
    got.link ? ok('symlink materializes') : bad('symlink missing');
    got.evilBlocked ? ok('escaping symlink refused') : bad('ESCAPING SYMLINK CREATED');
    require('fs').rmSync(tmpHome, { recursive: true, force: true });
  }

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
