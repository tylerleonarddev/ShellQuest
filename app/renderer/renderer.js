'use strict';
/* Renderer orchestration: dashboard <-> exercise view, run loop, reward beat.
   All data comes through the preload bridge (window.shellquest). */

const $ = (id) => document.getElementById(id);

let editor = null;
let currentExercise = null;

/* ── Dashboard ── */

async function showDashboard() {
  const state = await window.shellquest.getState();
  renderStats(state);

  const list = $('kata-list');
  list.innerHTML = '';
  for (const ex of state.exercises) {
    const li = document.createElement('li');
    li.className = 'kata-item' + (ex.completed ? ' completed' : '');
    const title = document.createElement('span');
    title.className = 'kata-item-title';
    title.textContent = ex.title;
    const meta = document.createElement('span');
    meta.className = 'kata-item-meta';
    const xp = document.createElement('span');
    xp.className = 'kata-item-xp';
    xp.textContent = ex.completed ? 'mastered' : `+${ex.xp} XP`;
    meta.appendChild(xp);
    li.append(title, meta);
    li.addEventListener('click', () => openExercise(ex.id));
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
  $('hud-streak-sub').textContent = p.last_active_date
    ? `last active ${p.last_active_date}`
    : 'pass a kata to start one';

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

async function openExercise(id) {
  const ex = await window.shellquest.getExercise(id);
  if (!ex) return;
  currentExercise = ex;

  $('exercise-title').textContent = ex.title;
  $('exercise-prompt').textContent = ex.prompt;
  $('exercise-xp').textContent = `+${ex.xp} XP`;
  $('exercise-done-badge').hidden = !ex.completed;
  $('test-count').textContent = `${ex.testCount} hidden tests`;
  $('results').hidden = true;
  $('results').innerHTML = '';

  if (editor) editor.destroy();
  editor = SQEditor.create($('editor-host'), ex.starter_code);

  $('view-dashboard').hidden = true;
  $('view-exercise').hidden = false;
  editor.focus();
}

async function runCurrent() {
  if (!currentExercise) return;
  const btn = $('btn-run');
  btn.disabled = true;
  btn.textContent = '… running';

  try {
    const res = await window.shellquest.runKata(currentExercise.id, editor.getValue());
    renderResults(res);
    if (res.passed) rewardBeat(res);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run tests';
  }
}

function renderResults(res) {
  const box = $('results');
  box.innerHTML = '';
  box.hidden = false;

  if (res.error || res.fatal) {
    const pre = document.createElement('div');
    pre.className = 'result-error';
    pre.textContent = res.error || res.fatal;
    box.appendChild(pre);
    return;
  }

  for (const r of res.results) {
    const line = document.createElement('div');
    line.className = 'result-line ' + (r.passed ? 'pass' : 'fail');
    const mark = document.createElement('span');
    mark.className = 'result-mark';
    mark.textContent = r.passed ? '✓' : '✗';
    const call = document.createElement('span');
    call.className = 'result-call';
    call.textContent = r.call;
    const detail = document.createElement('span');
    detail.className = 'result-detail';
    if (r.passed) {
      detail.textContent = `→ ${JSON.stringify(r.expected)}`;
    } else if (r.error) {
      detail.textContent = r.error;
    } else {
      detail.textContent = `expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)}`;
    }
    line.append(mark, call, detail);
    box.appendChild(line);
  }
}

/* ── The reward beat: overlay, XP count-up, back to dashboard ── */

function rewardBeat(res) {
  const overlay = $('reward-overlay');
  const counter = $('reward-xp-count');
  const streakLine = $('reward-streak');

  const xp = res.awardedXp || 0;
  const streak = res.state.profile.streak_days;
  streakLine.textContent = res.firstCompletion
    ? `streak: ${streak} day${streak === 1 ? '' : 's'}`
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

$('btn-back').addEventListener('click', showDashboard);
$('btn-run').addEventListener('click', runCurrent);
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.key === 'Enter' && !$('view-exercise').hidden) {
    ev.preventDefault();
    runCurrent();
  }
});

showDashboard();
