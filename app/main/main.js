'use strict';
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const content = require('../lib/content');
const progress = require('../lib/progress');
const { runTests } = require('../lib/verify-python');
const { runChecks } = require('../lib/verify-artifact');
const { isUnlocked } = require('../lib/unlock');
const { ensureLab, resetLab } = require('../lib/lab');
const schedule = require('../lib/schedule');
const { scaffoldDraft } = require('../lib/devlog');
const { commitProgress } = require('../lib/git');
const publishLib = require('../lib/publish');
const digestLib = require('../lib/digest');
const aiHint = require('../lib/ai-hint');
const aiHelpLog = require('../lib/ai-help-log');
const chat = require('../lib/chat');

// Dashboard grouping: the ladder reads as the story of the climb —
// grouped by track, ordered by prerequisite depth (curriculum order,
// same as the daily queue), never alphabetically.
function ladderGroup(e) {
  if ((e.track || '').startsWith('project:')) return `project: ${e.track.slice(8)}`;
  if (e.track === 'security') return 'security';
  if (e.type === 'shell-challenge') return 'terminal';
  return 'python';
}

function buildState() {
  const { exercises, errors } = content.loadExercises();
  const completions = progress.getCompletions();
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));
  const titleById = new Map(exercises.map((e) => [e.id, e.title]));

  const depths = schedule.computeDepths(exercises); // one memoized pass
  const groupOrder = ['python', 'security', 'terminal']; // project groups follow
  const sorted = [...exercises].sort((a, b) => {
    const ga = ladderGroup(a);
    const gb = ladderGroup(b);
    if (ga !== gb) {
      const ia = groupOrder.indexOf(ga);
      const ib = groupOrder.indexOf(gb);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || ga.localeCompare(gb);
    }
    return depths.get(a.id) - depths.get(b.id) || a.id.localeCompare(b.id);
  });

  return {
    profile: progress.getProfile(),
    levelCurve: {
      currentLevelStart: null, // filled below per-profile
    },
    onboardingDone: completedIds.has('onboarding'),
    exercises: sorted.filter((e) => e.track !== 'onboarding').map((e) => ({
      id: e.id,
      title: e.title,
      xp: e.xp,
      type: e.type,
      prerequisites: e.prerequisites || [],
      completed: completedIds.has(e.id),
      locked: !isUnlocked(e, completions),
      group: ladderGroup(e),
      requires: (e.prerequisites || [])
        .filter((id) => !completedIds.has(id))
        .map((id) => titleById.get(id) || id),
    })),
    contentErrors: errors,
  };
}

function stateForRenderer() {
  const state = buildState();
  const level = state.profile.level;
  state.levelCurve = {
    currentLevelStart: progress.xpForLevelStart(level),
    nextLevelAt: progress.xpForNextLevel(level),
  };

  // The scheduler's view of today: the daily queue, weekly goals, and the
  // streak as it stands (a missed day shows 0 without waiting for a write).
  const { exercises } = content.loadExercises();
  const completions = progress.getCompletions();
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const today = progress.localDateString();
  const daily = schedule.ensureDaily(exercises, completions, today);
  const weekly = schedule.ensureWeekly(today);

  state.daily = {
    date: daily.date,
    cleared: daily.bonus_awarded,
    bonusXp: daily.bonus_xp,
    items: daily.queue
      .filter((id) => byId.has(id))
      .map((id) => ({
        id,
        title: byId.get(id).title,
        xp: byId.get(id).xp,
        type: byId.get(id).type,
        kind: (daily.kinds && daily.kinds[id]) || (completedIds.has(id) ? 'review' : 'new'),
        done: daily.completed.includes(id),
      })),
  };
  state.weekly = weekly;
  state.profile.streak_days = schedule.effectiveStreak(state.profile, today);

  // ── Dashboard data (v0.9.2) ──
  // The record: passes bucketed by local day, last 182 days.
  const activity = {};
  let firstPass = null;
  for (const c of completions.completions) {
    const day = progress.localDateString(new Date(c.passed_at));
    activity[day] = activity[day] || { passes: 0, xp: 0 };
    activity[day].passes += 1;
    activity[day].xp += c.xp_awarded || 0;
    if (!firstPass || day < firstPass) firstPass = day;
  }
  state.activity = { days: activity, firstPass, today };

  // The forecast: next due cards, FSRS's view of the coming week.
  const reviews = schedule.getReviews();
  state.reviewForecast = Object.entries(reviews.cards)
    .filter(([id]) => byId.has(id))
    .map(([id, card]) => ({
      id,
      title: byId.get(id).title,
      dueDay: schedule.cardDueDay(card),
      stability: Math.round((card.stability || 0) * 10) / 10,
    }))
    .sort((a, b) => a.dueDay.localeCompare(b.dueDay) || a.id.localeCompare(b.id))
    .slice(0, 5);

  // The handoff: once today is cleared, what tomorrow holds (as of now).
  if (daily.bonus_awarded) {
    const tomorrow = schedule.addDays(today, 1);
    const tq = schedule.generateDailyQueue(exercises, completions, reviews.cards, tomorrow);
    state.tomorrow = tq.map((id) => ({
      title: byId.get(id) ? byId.get(id).title : id,
      kind: completedIds.has(id) ? 'review' : 'new',
    }));
  }
  return state;
}

ipcMain.handle('state:get', () => stateForRenderer());

// Gating is enforced here, not just in the UI — a locked exercise can't
// be opened or run even by a renderer bug.
function getUnlockedExercise(id) {
  const exercise = content.getExercise(id);
  if (!exercise) return { error: `Unknown exercise: ${id}` };
  if (!isUnlocked(exercise, progress.getCompletions())) {
    return { error: `Locked: complete ${(exercise.prerequisites || []).join(', ')} first.` };
  }
  return { exercise };
}

// Study-companion chat: streams a grounded local-LLM reply. Chunks flow
// back as chat:chunk events (correlated by id); the handler resolves when
// the stream ends. Snapshot is rebuilt fresh on every send.
ipcMain.handle('chat:send', async (ev, { id, messages }) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 240_000);
  try {
    const { exercises } = content.loadExercises();
    const clean = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const full = await chat.streamChat(
      exercises,
      clean,
      (piece) => { if (!ev.sender.isDestroyed()) ev.sender.send('chat:chunk', { id, piece }); },
      ctl.signal
    );
    return { ok: true, full };
  } catch (err) {
    const offline = /fetch failed|ECONNREFUSED/i.test(String(err.message));
    return { ok: false, reason: offline ? 'offline' : err.message };
  } finally {
    clearTimeout(timer);
  }
});

// One Socratic AI hint about the learner's actual code + failing test.
// Usage is recorded FIRST (before generation, so a crash can't dodge the
// ledger) — an AI-assisted pass grades Hard in FSRS, see applyPass.
ipcMain.handle('ai:hint', async (_ev, { id, code, failure }) => {
  const { exercise, error } = getUnlockedExercise(String(id || ''));
  if (error) return { hint: null, reason: error };
  if (exercise.type !== 'python-kata') return { hint: null, reason: 'not a kata' };
  aiHelpLog.record(exercise.id, progress.localDateString());
  return aiHint.generateHint({
    prompt: exercise.prompt,
    code: String(code || '').slice(0, 4000),
    failure: failure || null,
    aiContext: exercise.ai_context || null,
  });
});

ipcMain.handle('exercise:get', (_ev, id) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return null;

  const common = {
    id: exercise.id,
    type: exercise.type,
    title: exercise.title,
    xp: exercise.xp,
    prompt: exercise.prompt,
    completed: progress.isCompleted(exercise.id),
    // Optional tiered "Explain this" help — pure content data. Absent =>
    // no Help button. example.solution is deliberately withheld from the
    // renderer payload only if we ever want to; today the whole block
    // ships since it's an ANALOGOUS problem, not this kata's answer.
    help: exercise.help || null,
    // Optional "More info" task details — clarifies WHAT is being asked
    // (restatement, io examples, term definitions), never HOW to solve it.
    // Absent => no More info button.
    details: exercise.details || null,
  };
  if (exercise.type === 'lesson') {
    return { ...common, body: exercise.body };
  }
  if (exercise.type === 'shell-challenge') {
    return {
      ...common,
      labPath: ensureLab(exercise),
      needsFlag: exercise.verification.checks.some((c) => c.kind === 'flag'),
      checkCount: exercise.verification.checks.length,
    };
  }
  return {
    ...common,
    starter_code: exercise.starter_code || '',
    testCount: (exercise.verification.tests || exercise.verification.expect_contains || []).length,
  };
});

// The on-pass sequence: progress -> scheduler -> devlog draft -> scoped
// git commit. Shared by every verification runner.
async function onPass(exercise, run, userCode) {
  const record = progress.recordPass(exercise);

  // Error containment: recordPass has happened — from here on, any step
  // that throws must degrade to a reported warning, never a rejected IPC
  // that swallows the pass and loses first-completion artifacts.
  const stepErrors = [];
  let events = { review: false, dailyCleared: false, weeklyCompleted: false, bonusXp: 0 };
  let assembly = null;
  let devlogFile = null;
  let commit = { committed: false };

  try {
    const { exercises } = content.loadExercises();
    const profile = progress.getProfile();
    events = schedule.applyPass(
      exercise,
      record.firstCompletion,
      exercises,
      progress.getCompletions(),
      profile,
      progress.localDateString(),
      record.awardedXp,
      aiHelpLog.usedToday(exercise.id, progress.localDateString())
    );
    if (events.bonusXp) profile.xp += events.bonusXp;
    if (events.bonusXp || events.dailyCleared) progress.saveProfile(profile);
  } catch (err) {
    stepErrors.push(`scheduler: ${err.message}`);
  }

  let message = record.firstCompletion
    ? `Complete ${exercise.title} (+${record.awardedXp} XP)`
    : `Practice ${exercise.title}`;
  if (events.dailyCleared) message += ' · daily cleared';
  if (events.weeklyCompleted) message += ' · weekly goal met';
  if (events.bonusXp) message += ` (+${events.bonusXp} bonus XP)`;

  // Project build steps assemble the verified solution into the real
  // tool under projects/<name>/ (and only ever there).
  try {
    if (exercise.project && exercise.project.function && userCode) {
      assembly = require('../lib/project').assembleStep(exercise, userCode);
    }
  } catch (err) {
    assembly = { assembled: false, error: err.message };
  }

  // Lessons and onboarding aren't achievements to write up.
  try {
    const devloggable = exercise.type !== 'lesson' && exercise.track !== 'onboarding';
    if (record.firstCompletion && devloggable) {
      devlogFile = scaffoldDraft(exercise, userCode, run.results, record.awardedXp);
    }
  } catch (err) {
    stepErrors.push(`devlog: ${err.message}`);
  }

  try {
    commit = await commitProgress(message);
  } catch (err) {
    commit = { committed: false, error: err.message };
  }

  return {
    ...run,
    awardedXp: record.awardedXp,
    firstCompletion: record.firstCompletion,
    events,
    assembly,
    devlogFile,
    commit,
    stepErrors,
    state: stateForRenderer(),
  };
}

ipcMain.handle('kata:run', async (_ev, { id, code }) => {
  const { exercise, error } = getUnlockedExercise(String(id || ''));
  if (error) return { passed: false, error };
  if (exercise.type !== 'python-kata') {
    return { passed: false, error: `${exercise.title} isn't a code kata.` };
  }

  const run = await runTests(exercise, String(code ?? ''));
  // A failed run only counts against the FSRS card when it was a real
  // graded attempt (per-test results exist) — environment failures,
  // timeouts, and syntax errors aren't evidence of forgetting.
  if (!run.passed) {
    const penalty = run.results && run.results.length ? schedule.applyFailure(exercise) : {};
    return { ...run, ...penalty };
  }
  return onPass(exercise, run, String(code ?? ''));
});

ipcMain.handle('challenge:run', async (_ev, { id, flag }) => {
  const { exercise, error } = getUnlockedExercise(String(id || ''));
  if (error) return { passed: false, error };
  if (exercise.type !== 'shell-challenge') {
    return { passed: false, error: `${exercise.title} isn't a terminal challenge.` };
  }

  const run = await runChecks(exercise, { flag: String(flag ?? '') });
  if (!run.passed) {
    const penalty = run.results && run.results.length ? schedule.applyFailure(exercise) : {};
    return { ...run, ...penalty };
  }
  return onPass(exercise, run, null);
});

ipcMain.handle('lab:reset', (_ev, id) => {
  const { exercise, error } = getUnlockedExercise(String(id || ''));
  if (error) return { error };
  if (exercise.type !== 'shell-challenge') return { error: 'Only terminal challenges have labs.' };
  try {
    return { labPath: resetLab(exercise) };
  } catch (err) {
    return { error: `Could not reset the lab: ${err.message}` };
  }
});

ipcMain.handle('lesson:complete', async (_ev, id) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { passed: false, error };
  if (exercise.type !== 'lesson') return { passed: false, error: 'Not a lesson.' };
  return onPass(exercise, { passed: true, results: [] }, null);
});

ipcMain.handle('glossary:get', () => {
  try {
    const file = require('path').join(require('../lib/paths').CONTENT_DIR, 'glossary.json');
    return JSON.parse(require('fs').readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
});

ipcMain.handle('devlogs:list', () => ({
  drafts: publishLib.listDrafts(),
  published: publishLib.listPublished(),
}));

ipcMain.handle('devlogs:publish', (_ev, file) => publishLib.publishDraft(file));

ipcMain.handle('devlogs:read', (_ev, file) => publishLib.readDraft(file));

ipcMain.handle('devlogs:save-reflection', (_ev, { file, text }) =>
  publishLib.saveReflection(file, text)
);

ipcMain.handle('git:push', () => require('../lib/git').push());

ipcMain.handle('devlogs:digest', () => {
  const today = progress.localDateString();
  const weekStart = schedule.mondayOf(today);
  const weekly = schedule.ensureWeekly(today);
  const file = digestLib.generateDigest(weekStart, weekly);
  return { file: require('path').basename(file) };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#0a0e12',
    title: 'ShellQuest',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Debug affordance: SQ_SCREENSHOT=/path.png captures the window after
  // load, relays renderer console errors to stdout, then quits.
  if (process.env.SQ_SCREENSHOT) {
    win.webContents.on('console-message', (_ev, level, message) => {
      if (level >= 2) console.log(`[renderer:${level}] ${message}`);
    });
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          if (process.env.SQ_SCREENSHOT_CLICK) {
            await win.webContents.executeJavaScript(
              `{ const el = document.querySelector(${JSON.stringify(process.env.SQ_SCREENSHOT_CLICK)});
                 if (el) { el.click(); setTimeout(() => (document.querySelector(${JSON.stringify(
                   process.env.SQ_SCREENSHOT_SCROLL || 'body'
                 )}) || el).scrollIntoView({ block: 'center' }), 300); } }`
            );
            await new Promise((r) => setTimeout(r, 800));
          }
          // Optional second click (e.g. open an exercise, THEN a panel in
          // it). Same contract as SQ_SCREENSHOT_CLICK, runs after it.
          if (process.env.SQ_SCREENSHOT_CLICK2) {
            await win.webContents.executeJavaScript(
              `{ const el = document.querySelector(${JSON.stringify(process.env.SQ_SCREENSHOT_CLICK2)});
                 if (el) { el.click(); setTimeout(() => (document.querySelector(${JSON.stringify(
                   process.env.SQ_SCREENSHOT_SCROLL || 'body'
                 )}) || el).scrollIntoView({ block: 'center' }), 300); } }`
            );
            await new Promise((r) => setTimeout(r, 800));
          }
          const image = await win.webContents.capturePage();
          require('fs').writeFileSync(process.env.SQ_SCREENSHOT, image.toPNG());
        } catch (err) {
          console.error('[screenshot] capture failed:', err.message);
        } finally {
          app.quit(); // never leave a headless capture run alive
        }
      }, 1500);
    });
  }
}

app.whenReady().then(() => {
  progress.ensureFiles();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
