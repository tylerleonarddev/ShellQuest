'use strict';
/* Renderer orchestration: dashboard <-> exercise view, run loop, reward beat.
   All data comes through the preload bridge (window.shellquest). */

const $ = (id) => document.getElementById(id);

let editor = null;
let currentExercise = null;

/* ── Dashboard ── */

const GOAL_LABELS = {
  clear_daily_days: 'days cleared',
  new_exercises: 'new exercises',
};

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
    if (!item.done) li.addEventListener('click', () => openExercise(item.id));
    list.appendChild(li);
  }

  $('today-status').textContent = daily.cleared
    ? `daily cleared ✓ streak safe at ${state.profile.streak_days}`
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

async function renderDevlogs() {
  const { drafts, published } = await window.shellquest.listDevlogs();

  const list = $('devlog-drafts');
  list.innerHTML = '';
  for (const d of drafts) {
    const li = document.createElement('li');
    li.className = 'devlog-item';
    const title = document.createElement('span');
    title.className = 'devlog-title';
    title.textContent = d.title;
    const file = document.createElement('span');
    file.className = 'devlog-file';
    file.textContent = `drafts/${d.file}`;
    const btn = document.createElement('button');
    btn.className = 'btn-ghost btn-small';
    btn.textContent = '↗ publish';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const res = await window.shellquest.publishDevlog(d.file);
      if (!res.published) btn.textContent = res.error || 'failed';
      else renderDevlogs();
    });
    li.append(title, file, btn);
    list.appendChild(li);
  }
  if (!drafts.length) {
    const li = document.createElement('li');
    li.className = 'devlog-empty';
    li.textContent = 'no drafts waiting — pass something new';
    list.appendChild(li);
  }

  $('devlog-published').textContent = published.length
    ? `${published.length} published · latest: ${published[0].title}`
    : 'nothing published yet — publishing is always your deliberate act';
}

async function showDashboard() {
  const state = await window.shellquest.getState();
  renderStats(state);
  renderToday(state);
  renderDevlogs();

  const list = $('kata-list');
  list.innerHTML = '';
  for (const ex of state.exercises) {
    const li = document.createElement('li');
    li.className =
      'kata-item' + (ex.completed ? ' completed' : '') + (ex.locked ? ' locked' : '');
    const title = document.createElement('span');
    title.className = 'kata-item-title';
    title.textContent = (ex.locked ? '🔒 ' : '') + ex.title;
    const meta = document.createElement('span');
    meta.className = 'kata-item-meta';
    if (ex.type === 'shell-challenge') {
      const kind = document.createElement('span');
      kind.className = 'kata-item-kind';
      kind.textContent = 'terminal';
      meta.appendChild(kind);
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
    if (!ex.locked) li.addEventListener('click', () => openExercise(ex.id));
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
  $('chip-level').innerHTML = `lvl <b>${p.level}</b>`;
  $('chip-xp').innerHTML = `<b>${p.xp}</b> xp`;
  $('chip-streak').innerHTML = `<b>${p.streak_days}</b>d streak`;
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
  const isChallenge = currentExercise.type === 'shell-challenge';
  const btn = $(isChallenge ? 'btn-verify' : 'btn-run');
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

  dailyLine.hidden = !(events.dailyCleared || events.weeklyCompleted);
  dailyLine.textContent = [
    events.dailyCleared ? 'DAILY CLEARED' : '',
    events.weeklyCompleted ? 'WEEKLY GOAL MET' : '',
  ].filter(Boolean).join(' · ');

  streakLine.textContent = events.dailyCleared
    ? `streak: ${streak} day${streak === 1 ? '' : 's'} 🔥`
    : res.firstCompletion
      ? `streak: ${streak} day${streak === 1 ? '' : 's'}`
      : events.review
        ? 'review passed — interval extended'
        : 'already mastered — practice reps still count';

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
  setTimeout(() => {
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
  if (ev.key === 'Enter') runCurrent();
});
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.key === 'Enter' && !$('view-exercise').hidden) {
    ev.preventDefault();
    runCurrent();
  }
});

// First launch: one unfailable exercise that teaches only the mechanics.
// Once it's completed it never appears again.
(async function init() {
  const state = await window.shellquest.getState();
  if (!state.onboardingDone) openExercise('onboarding');
  else showDashboard();
})();
