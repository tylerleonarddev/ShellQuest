'use strict';
/* Renderer orchestration: dashboard <-> exercise view, run loop, reward beat.
   All data comes through the preload bridge (window.shellquest). */

const $ = (id) => document.getElementById(id);

// Keyboard/screen-reader access for clickable list items: every actionable
// row is a focusable button, not a click-only <li>.
function makeActionable(el, fn) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.addEventListener('click', fn);
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      fn();
    }
  });
}

let editor = null;
let currentExercise = null;

/* ── Dashboard ── */

const GOAL_LABELS = {
  clear_daily_days: 'days cleared',
  new_exercises: 'new exercises',
};

/* ── The prompt line: one glance answers "what do I do next" ── */

let promptTarget = null;

function renderPromptLine(state) {
  const line = $('prompt-line');
  const next =
    state.daily.items.find((i) => !i.done) ||
    state.exercises.find((e) => !e.locked && !e.completed);
  promptTarget = next ? next.id : null;

  line.hidden = false;
  if (!next) {
    $('prompt-label').textContent = state.daily.cleared
      ? 'daily cleared — all caught up'
      : 'all caught up';
    $('prompt-meta').textContent = '';
    line.classList.add('prompt-done');
    return;
  }
  line.classList.remove('prompt-done');
  $('prompt-label').textContent = `next: ${next.title}`;
  const kind = next.kind || (next.completed ? 'review' : 'new');
  $('prompt-meta').textContent = `${kind} · +${next.xp} XP`;
}

/* ── The record: every pass, bucketed by day, 26 weeks ── */

function renderRecord(state) {
  const section = $('record-section');
  const days = state.activity.days || {};
  if (!state.activity.firstPass) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const grid = $('record-grid');
  grid.innerHTML = '';
  const today = new Date(`${state.activity.today}T12:00:00`);
  // Start 181 days back, aligned to the top of the week column.
  const start = new Date(today);
  start.setDate(start.getDate() - 181 - ((today.getDay() + 6) % 7));
  let totalPasses = 0;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const info = days[key];
    const cell = document.createElement('span');
    const n = info ? info.passes : 0;
    totalPasses += n;
    cell.className = 'record-cell' + (n ? ` r${Math.min(4, n)}` : '');
    if (key === state.activity.today) cell.classList.add('record-today');
    cell.title = info ? `${key} · ${n} pass${n === 1 ? '' : 'es'} · ${info.xp} XP` : key;
    grid.appendChild(cell);
  }
  const daysSince = Math.round((today - new Date(`${state.activity.firstPass}T12:00:00`)) / 86400000) + 1;
  $('record-caption').textContent = `day ${daysSince} · ${totalPasses} passes`;
}

/* ── The forecast: FSRS's schedule, rendered like an atq listing ── */

function renderForecast(state) {
  const box = $('forecast');
  const cards = state.reviewForecast || [];
  if (!cards.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const rows = $('forecast-rows');
  rows.innerHTML = '';
  for (const c of cards) {
    const row = document.createElement('div');
    row.className = 'forecast-row';
    const due = document.createElement('span');
    due.className = 'forecast-due';
    if (c.dueDay < state.activity.today) {
      due.textContent = 'overdue';
      due.classList.add('overdue');
    } else if (c.dueDay === state.activity.today) {
      due.textContent = 'today';
      due.classList.add('due-today');
    } else {
      const gap = Math.round((new Date(`${c.dueDay}T12:00:00`) - new Date(`${state.activity.today}T12:00:00`)) / 86400000);
      due.textContent = `in ${gap}d`;
    }
    const title = document.createElement('span');
    title.className = 'forecast-title-cell';
    title.textContent = c.title;
    const stab = document.createElement('span');
    stab.className = 'forecast-stab';
    stab.textContent = `↻ ${c.stability}d`;
    stab.title = 'memory stability — how long this skill holds';
    row.append(due, title, stab);
    rows.appendChild(row);
  }
}

function renderToday(state) {
  const daily = state.daily;
  const doneCount = daily.items.filter((i) => i.done).length;
  $('today-progress').textContent = `${doneCount} / ${daily.items.length}`;

  const list = $('today-list');
  list.innerHTML = '';
  for (const item of daily.items) {
    const li = document.createElement('li');
    li.className = 'today-item' + (item.done ? ' done' : '');
    const mark = document.createElement('span');
    mark.className = 'today-mark';
    mark.textContent = item.done ? '✓' : '○';
    const title = document.createElement('span');
    title.className = 'today-title';
    title.textContent = item.title;
    const kind = document.createElement('span');
    kind.className = `today-kind ${item.kind}`;
    kind.textContent = item.kind;
    li.append(mark, title, kind);
    if (!item.done) makeActionable(li, () => openExercise(item.id));
    list.appendChild(li);
  }

  const handoff = (state.tomorrow || []).length
    ? ` · tomorrow: ${state.tomorrow.filter((t) => t.kind === 'review').length} review${state.tomorrow.filter((t) => t.kind === 'review').length === 1 ? '' : 's'}${state.tomorrow.some((t) => t.kind === 'new') ? ` + ${state.tomorrow.find((t) => t.kind === 'new').title}` : ''}`
    : '';
  $('today-status').textContent = daily.cleared
    ? (daily.items.length
        ? `daily cleared ✓ streak safe at ${state.profile.streak_days}${handoff}`
        : `rest day — nothing due, streak safe at ${state.profile.streak_days}${handoff}`)
    : daily.items.length
      ? `clear all ${daily.items.length} to keep the streak (+${daily.bonusXp} XP)`
      : 'nothing due — the ladder awaits';

  const goals = $('weekly-goals');
  goals.innerHTML = '';
  for (const g of state.weekly.goals) {
    const row = document.createElement('div');
    row.className = 'goal-row';
    const label = document.createElement('span');
    label.className = 'goal-label';
    label.textContent = `${GOAL_LABELS[g.kind] || g.kind} ${Math.min(g.progress, g.target)}/${g.target}`;
    const bar = document.createElement('div');
    bar.className = 'goal-bar';
    const fill = document.createElement('div');
    fill.className = 'goal-bar-fill';
    fill.style.width = `${Math.min(100, Math.round((g.progress / g.target) * 100))}%`;
    bar.appendChild(fill);
    row.append(label, bar);
    goals.appendChild(row);
  }
}

let expandedDraft = null;

// Build the expandable editor under a draft row: preview, reflection
// textarea, Save, and one Publish button that also pushes and reports
// the real outcome.
async function buildDraftEditor(file) {
  const draft = await window.shellquest.readDevlog(file);
  const box = document.createElement('div');
  box.className = 'devlog-editor';
  if (draft.error) {
    box.textContent = draft.error;
    return box;
  }

  const preview = document.createElement('pre');
  preview.className = 'devlog-preview';
  preview.textContent = draft.head;

  const label = document.createElement('div');
  label.className = 'devlog-editor-label';
  label.textContent = '## Reflection — yours to write:';

  const ta = document.createElement('textarea');
  ta.className = 'devlog-reflection';
  ta.rows = 3;
  ta.placeholder = 'One honest sentence: what tripped you up, or what clicked?';
  ta.value = draft.reflection;

  const row = document.createElement('div');
  row.className = 'run-row';
  const save = document.createElement('button');
  save.className = 'btn-ghost btn-small';
  save.textContent = '💾 save draft';
  const pub = document.createElement('button');
  pub.className = 'btn-accent btn-small-accent';
  pub.textContent = '↗ publish & push';
  const status = document.createElement('span');
  status.className = 'devlog-status';

  save.addEventListener('click', async () => {
    const res = await window.shellquest.saveReflection(file, ta.value);
    status.textContent = res.saved ? 'saved ✓' : res.error;
  });

  pub.addEventListener('click', async () => {
    pub.disabled = true;
    status.textContent = '… publishing';
    const saved = await window.shellquest.saveReflection(file, ta.value);
    if (!saved.saved) {
      status.textContent = saved.error;
      pub.disabled = false;
      return;
    }
    const res = await window.shellquest.publishDevlog(file);
    if (!res.published) {
      status.textContent = res.error || 'publish failed';
      pub.disabled = false;
    } else if (res.push.pushed) {
      status.textContent = 'published & pushed ✓ it’s public';
      setTimeout(renderDevlogs, 1200);
    } else {
      // Persistent: this guidance must outlive a 2.5s glance — the user
      // needs it to find the retry button.
      status.textContent = `committed locally, but push failed — ${res.push.reason}. Use "⇡ push now" below to retry.`;
    }
  });

  row.append(save, pub, status);
  box.append(preview, label, ta, row);
  return box;
}

let devlogsRenderSeq = 0;

async function renderDevlogs() {
  const seq = ++devlogsRenderSeq;
  const { drafts, published } = await window.shellquest.listDevlogs();
  if (seq !== devlogsRenderSeq) return; // a newer render superseded us

  const list = $('devlog-drafts');
  list.innerHTML = '';
  for (const d of drafts) {
    const li = document.createElement('li');
    li.className = 'devlog-item';
    const head = document.createElement('div');
    head.className = 'devlog-item-head';
    const title = document.createElement('span');
    title.className = 'devlog-title';
    title.textContent = d.title;
    const file = document.createElement('span');
    file.className = 'devlog-file';
    file.textContent = `drafts/${d.file}`;
    const btn = document.createElement('button');
    btn.className = 'btn-ghost btn-small';
    btn.textContent = expandedDraft === d.file ? '▾ close' : '✎ edit & publish';
    btn.addEventListener('click', () => {
      expandedDraft = expandedDraft === d.file ? null : d.file;
      renderDevlogs();
    });
    head.append(title, file, btn);
    li.appendChild(head);
    if (expandedDraft === d.file) {
      const editorBox = await buildDraftEditor(d.file);
      if (seq !== devlogsRenderSeq) return; // superseded mid-await
      li.appendChild(editorBox);
    }
    list.appendChild(li);
  }
  if (!drafts.length) {
    const li = document.createElement('li');
    li.className = 'devlog-empty';
    li.textContent = 'no drafts waiting — pass something new';
    list.appendChild(li);
  }

  const pubBox = $('devlog-published');
  pubBox.innerHTML = '';
  const pubText = document.createElement('span');
  pubText.textContent = published.length
    ? `${published.length} published · latest: ${published[0].title}`
    : 'nothing published yet — publishing is always your deliberate act';
  pubBox.appendChild(pubText);

  // Unpushed commits (e.g. a publish that failed offline) get a retry.
  const retry = document.createElement('button');
  retry.className = 'btn-ghost btn-small';
  retry.textContent = '⇡ push now';
  retry.title = 'push any local commits to GitHub';
  retry.addEventListener('click', async () => {
    retry.disabled = true;
    const res = await window.shellquest.gitPush();
    retry.textContent = res.pushed ? 'pushed ✓' : `push failed — ${res.reason}`;
    setTimeout(() => {
      retry.textContent = '⇡ push now';
      retry.disabled = false;
    }, 3000);
  });
  pubBox.appendChild(retry);
}

async function showDashboard() {
  const state = await window.shellquest.getState();
  renderStats(state);
  renderPromptLine(state);
  renderRecord(state);
  renderToday(state);
  renderForecast(state);
  renderDevlogs();

  const list = $('kata-list');
  list.innerHTML = '';
  let currentGroup = null;
  const nextMarked = new Set(); // one "next up" highlight per group
  for (const ex of state.exercises) {
    if (ex.group !== currentGroup) {
      currentGroup = ex.group;
      const done = state.exercises.filter((e) => e.group === ex.group && e.completed).length;
      const total = state.exercises.filter((e) => e.group === ex.group).length;
      const header = document.createElement('li');
      header.className = 'ladder-group';
      const name = document.createElement('span');
      name.textContent = ex.group;
      const count = document.createElement('span');
      count.className = 'ladder-group-count';
      count.textContent = `${done} / ${total}`;
      header.append(name, count);
      list.appendChild(header);
    }

    const isNext = !ex.locked && !ex.completed && !nextMarked.has(ex.group);
    if (isNext) nextMarked.add(ex.group);

    const li = document.createElement('li');
    li.className =
      'kata-item' +
      (ex.completed ? ' completed' : '') +
      (ex.locked ? ' locked' : '') +
      (isNext ? ' next-up' : '');
    const title = document.createElement('span');
    title.className = 'kata-item-title';
    title.textContent = (ex.locked ? '🔒 ' : '') + ex.title;
    const meta = document.createElement('span');
    meta.className = 'kata-item-meta';
    if (ex.type === 'lesson') {
      const kind = document.createElement('span');
      kind.className = 'kata-item-kind';
      kind.textContent = 'lesson';
      meta.appendChild(kind);
    }
    if (isNext) {
      const next = document.createElement('span');
      next.className = 'kata-item-next';
      next.textContent = 'next up';
      meta.appendChild(next);
    }
    const xp = document.createElement('span');
    xp.className = 'kata-item-xp';
    if (ex.locked) {
      xp.textContent = `requires: ${ex.requires.join(', ')}`;
      xp.classList.add('kata-item-requires');
    } else {
      xp.textContent = ex.completed ? 'mastered' : `+${ex.xp} XP`;
    }
    meta.appendChild(xp);
    li.append(title, meta);
    if (!ex.locked) makeActionable(li, () => openExercise(ex.id));
    list.appendChild(li);
  }

  const errBox = $('content-errors');
  if (state.contentErrors.length) {
    errBox.hidden = false;
    errBox.textContent =
      'Some content files failed to load: ' +
      state.contentErrors.map((e) => `${e.file} (${e.error})`).join('; ');
  } else {
    errBox.hidden = true;
  }

  $('view-exercise').hidden = true;
  $('view-dashboard').hidden = false;
}

function renderStats(state) {
  const p = state.profile;
  $('hud-level').textContent = p.level;
  $('hud-xp').textContent = p.xp;
  $('hud-streak').textContent = p.streak_days;
  $('hud-streak-sub').textContent = p.last_cleared_date
    ? `last cleared ${p.last_cleared_date}`
    : 'clear the daily to start one';

  const { currentLevelStart, nextLevelAt } = state.levelCurve;
  const span = nextLevelAt - currentLevelStart;
  const into = p.xp - currentLevelStart;
  $('xp-bar-fill').style.width = `${Math.min(100, Math.round((into / span) * 100))}%`;
  $('hud-xp-detail').textContent = `${into} / ${span} XP to level ${p.level + 1}`;

  $('topbar-stats').hidden = false;
  const chip = (id, pre, val, post) => {
    const el = $(id);
    el.textContent = '';
    if (pre) el.append(pre);
    const b = document.createElement('b');
    b.textContent = String(val);
    el.append(b);
    if (post) el.append(post);
  };
  chip('chip-level', 'lvl ', p.level, '');
  chip('chip-xp', '', p.xp, ' xp');
  chip('chip-streak', '', p.streak_days, 'd streak');
}

/* ── Exercise view ── */

// Minimal safe markdown for lesson bodies: *italic*, `code`, "quotes" stay
// literal; everything is escaped first.
function lessonHtml(body) {
  const esc = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p}</p>`)
    .join('');
}

async function openExercise(id) {
  const ex = await window.shellquest.getExercise(id);
  if (!ex) return;
  currentExercise = ex;

  const isChallenge = ex.type === 'shell-challenge';
  const isLesson = ex.type === 'lesson';

  $('exercise-title').textContent = ex.title;
  $('exercise-prompt').textContent = isLesson ? '' : ex.prompt;
  $('exercise-xp').textContent = `+${ex.xp} XP`;
  $('exercise-done-badge').hidden = !ex.completed;
  $('results').hidden = true;
  $('results').innerHTML = '';

  $('kata-panel').hidden = isChallenge || isLesson;
  $('challenge-panel').hidden = !isChallenge;
  $('lesson-panel').hidden = !isLesson;

  if (isLesson) {
    if (editor) { editor.destroy(); editor = null; }
    $('lesson-body').innerHTML = lessonHtml(ex.body);
    $('btn-gotit').disabled = false;
  } else if (isChallenge) {
    if (editor) { editor.destroy(); editor = null; }
    $('lab-path').textContent = ex.labPath;
    $('flag-row').hidden = !ex.needsFlag;
    $('flag-input').value = '';
    $('check-count').textContent = `${ex.checkCount} check${ex.checkCount === 1 ? '' : 's'}`;
  } else {
    $('test-count').textContent = `${ex.testCount} hidden tests`;
    if (editor) editor.destroy();
    editor = SQEditor.create($('editor-host'), ex.starter_code);
  }

  $('view-dashboard').hidden = true;
  $('view-exercise').hidden = false;
  if (isChallenge && ex.needsFlag) $('flag-input').focus();
  else if (!isChallenge && !isLesson) editor.focus();
}

async function completeCurrentLesson() {
  if (!currentExercise || currentExercise.type !== 'lesson') return;
  const btn = $('btn-gotit');
  btn.disabled = true;
  const res = await window.shellquest.completeLesson(currentExercise.id);
  if (res.passed) rewardBeat(res);
  else btn.disabled = false;
}

async function runCurrent() {
  if (!currentExercise) return;
  // Lessons have no runner — Ctrl+Enter means "Got it".
  if (currentExercise.type === 'lesson') return completeCurrentLesson();
  const isChallenge = currentExercise.type === 'shell-challenge';
  const btn = $(isChallenge ? 'btn-verify' : 'btn-run');
  if (btn.disabled) return; // keyboard paths must respect an in-flight run
  const idleLabel = isChallenge ? '▶ Verify' : '▶ Run tests';
  btn.disabled = true;
  btn.textContent = '… running';

  try {
    const res = isChallenge
      ? await window.shellquest.runChallenge(currentExercise.id, $('flag-input').value)
      : await window.shellquest.runKata(currentExercise.id, editor.getValue());
    renderResults(res);
    if (res.passed) rewardBeat(res);
  } finally {
    btn.disabled = false;
    btn.textContent = idleLabel;
  }
}

async function resetLab() {
  if (!currentExercise) return;
  const res = await window.shellquest.resetLab(currentExercise.id);
  if (res.labPath) {
    $('lab-path').textContent = res.labPath;
    $('results').hidden = true;
    $('results').innerHTML = '';
  }
}

function renderResults(res) {
  const box = $('results');
  box.innerHTML = '';
  box.hidden = false;

  if (res.error || res.fatal) {
    const wrap = document.createElement('div');
    wrap.className = 'result-error';
    if (res.fatal) {
      const friendly = friendlyError(res.fatal.trim().split('\n').pop() || res.fatal);
      wrap.textContent = friendly.plain;
      wrap.appendChild(rawDetails(res.fatal));
    } else {
      wrap.textContent = res.error;
    }
    box.appendChild(wrap);
    return;
  }

  if (res.reviewFailed) {
    const note = document.createElement('div');
    note.className = 'result-line fail';
    note.textContent = '↩ review missed — this one comes back tomorrow';
    box.appendChild(note);
  }

  for (const r of res.results) {
    const line = document.createElement('div');
    line.className = 'result-line ' + (r.passed ? 'pass' : 'fail');
    const mark = document.createElement('span');
    mark.className = 'result-mark';
    mark.textContent = r.passed ? '✓' : '✗';
    const call = document.createElement('span');
    call.className = 'result-call';
    call.textContent = r.call || r.detail;
    const detail = document.createElement('span');
    detail.className = 'result-detail';
    if (r.passed) {
      detail.textContent = r.expected !== undefined ? `→ ${JSON.stringify(r.expected)}` : '';
    } else if (r.error) {
      const friendly = friendlyError(r.error);
      detail.textContent = friendly.plain;
      if (friendly.raw) line.appendChild(rawDetails(friendly.raw));
    } else {
      detail.textContent = `your code gave back ${JSON.stringify(r.actual)}, but the challenge expected ${JSON.stringify(r.expected)}`;
    }
    line.append(mark, call, detail);
    box.appendChild(line);
  }

  // A pass whose auto-commit failed must say so — progress is saved to
  // disk either way, but the git trail (and the graph) didn't advance.
  if (res.passed && res.commit && !res.commit.committed && res.commit.error) {
    const note = document.createElement('div');
    note.className = 'result-line fail';
    note.textContent = `⚠ progress saved, but the git commit failed — ${res.commit.error}`;
    box.appendChild(note);
    box.hidden = false;
  }

  // Assembly must never fail silently: the learner earned the XP but the
  // tool didn't get their function — say so, with the reason.
  if (res.passed && res.assembly && !res.assembly.assembled && res.assembly.error) {
    const note = document.createElement('div');
    note.className = 'result-line fail';
    note.textContent = `⚠ passed, but your solution was NOT written into the project — ${res.assembly.error}`;
    box.appendChild(note);
    box.hidden = false;
  }
  if (res.passed && res.assembly && res.assembly.assembled && res.assembly.gitHidden === false) {
    const note = document.createElement('div');
    note.className = 'result-line fail';
    note.textContent = '⚠ heads up: git could not be told to ignore your assembled file — avoid committing projects/ by hand';
    box.appendChild(note);
    box.hidden = false;
  }
  for (const e of res.stepErrors || []) {
    const note = document.createElement('div');
    note.className = 'result-line fail';
    note.textContent = `⚠ pass recorded, but one step hiccuped — ${e}`;
    box.appendChild(note);
    box.hidden = false;
  }

  // project-run failures show the tool's real output so the learner can
  // see what's off.
  if (!res.passed && res.output) {
    const out = document.createElement('div');
    out.className = 'result-error';
    out.textContent = 'your tool printed:';
    const pre = document.createElement('pre');
    pre.textContent = res.output;
    out.appendChild(pre);
    box.appendChild(out);
  }
}

/* ── Beginner-friendly error translation ── */

const ERROR_EXPLANATIONS = {
  NameError: "You used a name Python doesn't recognize — check the spelling, or make sure it's defined.",
  SyntaxError: "Python couldn't read this — often a missing : or an unclosed quote or bracket.",
  IndentationError: 'The spacing at the start of a line is off — Python is strict about indentation.',
  TypeError: "You mixed two kinds of value that don't go together (like a number and text).",
  IndexError: 'You reached past the end of a list or string.',
  KeyError: "You asked a dict for a key it doesn't have.",
  ValueError: "A value was the right kind but didn't make sense there.",
  ZeroDivisionError: 'Something divided by zero.',
  RecursionError: 'Your function kept calling itself and never stopped — check the base case.',
  AttributeError: "You asked a value for something it doesn't have — check the method name and the value's type.",
};

// Runner errors look like "TypeError: can only concatenate str…".
function friendlyError(raw) {
  const name = (raw.match(/^([A-Za-z]+Error)\b/) || [])[1];
  if (name && ERROR_EXPLANATIONS[name]) return { plain: ERROR_EXPLANATIONS[name], raw };
  if (name) return { plain: `Your code hit an error: ${name}.`, raw };
  return { plain: raw, raw: null };
}

function rawDetails(raw) {
  const det = document.createElement('details');
  det.className = 'result-raw';
  const sum = document.createElement('summary');
  sum.textContent = 'show details';
  const pre = document.createElement('pre');
  pre.textContent = raw;
  det.append(sum, pre);
  return det;
}

/* ── The reward beat: overlay, XP count-up, back to dashboard ── */

function rewardBeat(res) {
  const overlay = $('reward-overlay');
  const counter = $('reward-xp-count');
  const streakLine = $('reward-streak');
  const dailyLine = $('reward-daily');

  const events = res.events || {};
  const xp = (res.awardedXp || 0) + (events.bonusXp || 0);
  const streak = res.state.profile.streak_days;

  const assembled = res.assembly && res.assembly.assembled;
  dailyLine.hidden = !(events.dailyCleared || events.weeklyCompleted || assembled);
  dailyLine.textContent = [
    events.dailyCleared ? 'DAILY CLEARED' : '',
    events.weeklyCompleted ? 'WEEKLY GOAL MET' : '',
    assembled ? `⚙ ${res.assembly.function}() → ${res.assembly.file}` : '',
  ].filter(Boolean).join(' · ');

  streakLine.textContent = events.dailyCleared
    ? `streak: ${streak} day${streak === 1 ? '' : 's'} 🔥`
    : res.firstCompletion
      ? `streak: ${streak} day${streak === 1 ? '' : 's'}`
      : events.review
        ? 'review passed — interval extended'
        : 'already mastered — practice reps still count';

  // The handoff: plant tomorrow's hook at the moment of maximum attention.
  const tomorrowLine = $('reward-tomorrow');
  const tm = res.state.tomorrow || [];
  if (events.dailyCleared && tm.length) {
    const reviews = tm.filter((t) => t.kind === 'review').length;
    const firstNew = tm.find((t) => t.kind === 'new');
    tomorrowLine.textContent =
      'tomorrow: ' +
      [reviews ? `${reviews} review${reviews === 1 ? '' : 's'}` : '', firstNew ? `new: ${firstNew.title}` : '']
        .filter(Boolean)
        .join(' · ');
    tomorrowLine.hidden = false;
  } else {
    tomorrowLine.hidden = true;
  }

  overlay.hidden = false;
  const t0 = performance.now();
  const DURATION = 900;
  function tick(now) {
    if (overlay.hidden) return;
    const k = Math.min(1, (now - t0) / DURATION);
    const eased = 1 - Math.pow(1 - k, 3);
    counter.textContent = `+${Math.round(eased * xp)}`;
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const dismiss = () => {
    overlay.hidden = true;
    overlay.removeEventListener('click', dismiss);
    showDashboard();
  };
  overlay.addEventListener('click', dismiss);
  // Track the auto-dismiss timer: a stale timer from a previous beat must
  // not cut the next one short.
  if (rewardBeat._timer) clearTimeout(rewardBeat._timer);
  rewardBeat._timer = setTimeout(() => {
    if (!overlay.hidden) dismiss();
  }, 3200);
}

/* ── Wiring ── */

/* ── Glossary ── */

let glossaryTerms = null;

function renderGlossaryList(filter = '') {
  const list = $('glossary-list');
  list.innerHTML = '';
  const q = filter.toLowerCase();
  for (const { term, definition } of glossaryTerms) {
    if (q && !term.toLowerCase().includes(q) && !definition.toLowerCase().includes(q)) continue;
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = definition;
    list.append(dt, dd);
  }
  if (!list.children.length) {
    const dd = document.createElement('dd');
    dd.textContent = 'no matching terms';
    list.appendChild(dd);
  }
}

async function openGlossary() {
  if (!glossaryTerms) glossaryTerms = await window.shellquest.getGlossary();
  renderGlossaryList($('glossary-search').value);
  $('glossary-overlay').hidden = false;
  $('glossary-search').focus();
}

$('btn-glossary').addEventListener('click', openGlossary);
$('btn-glossary-close').addEventListener('click', () => { $('glossary-overlay').hidden = true; });
$('glossary-overlay').addEventListener('click', (ev) => {
  if (ev.target === $('glossary-overlay')) $('glossary-overlay').hidden = true;
});
$('glossary-search').addEventListener('input', (ev) => renderGlossaryList(ev.target.value));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') $('glossary-overlay').hidden = true;
});

/* ── Wiring ── */

$('btn-digest').addEventListener('click', async () => {
  await window.shellquest.draftDigest();
  renderDevlogs();
});
$('btn-back').addEventListener('click', showDashboard);
$('btn-run').addEventListener('click', runCurrent);
$('btn-verify').addEventListener('click', runCurrent);
$('btn-gotit').addEventListener('click', completeCurrentLesson);
$('btn-reset-lab').addEventListener('click', resetLab);
$('flag-input').addEventListener('keydown', (ev) => {
  // Plain Enter only — Ctrl+Enter belongs to the global handler, and
  // matching both fired two runs from one keystroke.
  if (ev.key === 'Enter' && !ev.ctrlKey) runCurrent();
});
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.key === 'Enter' && !$('view-exercise').hidden) {
    ev.preventDefault();
    runCurrent();
  }
  // Dashboard: plain Enter follows the ❯ prompt line to the next item.
  if (
    ev.key === 'Enter' && !ev.ctrlKey &&
    !$('view-dashboard').hidden &&
    $('glossary-overlay').hidden &&
    promptTarget &&
    !/^(INPUT|TEXTAREA|BUTTON|A)$/.test((ev.target && ev.target.tagName) || '') &&
    (!ev.target || ev.target.getAttribute('role') !== 'button')
  ) {
    ev.preventDefault();
    openExercise(promptTarget);
  }
});

$('prompt-line').addEventListener('click', () => {
  if (promptTarget) openExercise(promptTarget);
});

// First launch: one unfailable exercise that teaches only the mechanics.
// Once it's completed it never appears again.
(async function init() {
  const state = await window.shellquest.getState();
  if (!state.onboardingDone) openExercise('onboarding');
  else showDashboard();
})();
