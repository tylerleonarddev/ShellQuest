#!/usr/bin/env node
'use strict';
// Generate the static stats page (site/index.html) from the source of
// truth: progress/*.json + published devlogs. Built now, HOSTED LATER —
// enabling GitHub Pages is a deliberate v0.5 decision.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { loadExercises } = require(path.join(ROOT, 'app/lib/content'));
const progress = require(path.join(ROOT, 'app/lib/progress'));
const schedule = require(path.join(ROOT, 'app/lib/schedule'));
const { listPublished } = require(path.join(ROOT, 'app/lib/publish'));

const TYPE_LABELS = { 'python-kata': 'Python', 'shell-challenge': 'Terminal', lesson: 'Lessons' };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const profile = progress.getProfile();
const completions = progress.getCompletions().completions;
const { exercises } = loadExercises();
const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
const today = progress.localDateString();
const streak = schedule.effectiveStreak(profile, today);
const published = listPublished();

const perType = {};
for (const c of completions) {
  const t = byId[c.exercise_id] ? byId[c.exercise_id].type : 'other';
  perType[t] = (perType[t] || 0) + 1;
}
const totalByType = {};
for (const e of exercises) totalByType[e.type] = (totalByType[e.type] || 0) + 1;

const trackRows = Object.keys(totalByType)
  .sort()
  .map((t) => {
    const done = perType[t] || 0;
    const total = totalByType[t];
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="track"><span class="track-name">${esc(TYPE_LABELS[t] || t)}</span>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <span class="track-count">${done} / ${total}</span></div>`;
  })
  .join('\n');

const postItems = published
  .slice(0, 8)
  .map((p) => `<li><span class="post-date">${esc(p.file.slice(0, 10))}</span> ${esc(p.title)}</li>`)
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>shellquest — learning in public</title>
<style>
  :root {
    --bg:#0a0e12; --surface:#11161d; --line:#1d2530; --text:#c8d3de;
    --muted:#6b7a8c; --faint:#44546a; --accent:#3dd68c;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body {
    background:var(--bg); color:var(--text);
    font-family:'JetBrains Mono','Fira Code',ui-monospace,monospace;
    font-size:15px; line-height:1.6; padding:48px 20px;
  }
  .wrap { max-width:680px; margin:0 auto; }
  h1 { font-size:20px; letter-spacing:.14em; }
  h1 .cursor { color:var(--accent); }
  .sub { color:var(--muted); font-size:13px; margin:6px 0 36px; }
  .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:36px; }
  .tile { background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:18px; }
  .tile .label { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); }
  .tile .value { font-size:34px; font-weight:700; margin-top:4px; }
  .tile .value small { font-size:14px; color:var(--muted); font-weight:400; }
  .streak-tile { border-color:rgba(61,214,140,.35); }
  .streak-tile .value { color:var(--accent); }
  h2 { font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); margin:34px 0 14px; }
  .track { display:flex; align-items:center; gap:14px; margin-top:8px; }
  .track-name { min-width:90px; font-size:13px; }
  .bar { flex:1; height:6px; background:var(--surface); border:1px solid var(--line); border-radius:3px; overflow:hidden; }
  .fill { height:100%; background:var(--accent); }
  .track-count { font-size:12px; color:var(--muted); min-width:60px; text-align:right; }
  ul { list-style:none; }
  li { padding:7px 0; border-bottom:1px solid var(--line); font-size:14px; }
  .post-date { color:var(--faint); font-size:12px; margin-right:10px; }
  .empty { color:var(--faint); font-size:13px; }
  footer { margin-top:44px; color:var(--faint); font-size:11px; letter-spacing:.08em; }
  a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>shellquest<span class="cursor">▌</span></h1>
  <p class="sub">learning the craft in public — every number below is a git commit</p>

  <div class="hero">
    <div class="tile"><div class="label">Level</div><div class="value">${profile.level}</div></div>
    <div class="tile"><div class="label">Total XP</div><div class="value">${profile.xp}</div></div>
    <div class="tile streak-tile"><div class="label">Streak</div><div class="value">${streak}<small> days</small></div></div>
  </div>

  <h2>// progress by track</h2>
  ${trackRows}

  <h2>// recent devlogs</h2>
  ${postItems ? `<ul>\n${postItems}\n</ul>` : '<p class="empty">first posts incoming</p>'}

  <footer>generated ${today} · <a href="https://github.com/tylerleonarddev/ShellQuest">github.com/tylerleonarddev/ShellQuest</a></footer>
</div>
</body>
</html>
`;

const out = path.join(ROOT, 'site', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`stats page: ${path.relative(ROOT, out)} (level ${profile.level}, ${profile.xp} XP, ${streak}d streak, ${published.length} posts)`);
