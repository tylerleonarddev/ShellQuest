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

function buildState() {
  const { exercises, errors } = content.loadExercises();
  const completions = progress.getCompletions();
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));
  const titleById = new Map(exercises.map((e) => [e.id, e.title]));
  return {
    profile: progress.getProfile(),
    levelCurve: {
      currentLevelStart: null, // filled below per-profile
    },
    onboardingDone: completedIds.has('onboarding'),
    exercises: exercises.filter((e) => e.track !== 'onboarding').map((e) => ({
      id: e.id,
      title: e.title,
      xp: e.xp,
      type: e.type,
      prerequisites: e.prerequisites || [],
      completed: completedIds.has(e.id),
      locked: !isUnlocked(e, completions),
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

  // Scheduler hooks: schedule the review, tick the daily/weekly, and
  // collect any bonus XP + streak movement.
  const { exercises } = content.loadExercises();
  const profile = progress.getProfile();
  const events = schedule.applyPass(
    exercise,
    record.firstCompletion,
    exercises,
    progress.getCompletions(),
    profile,
    progress.localDateString(),
    record.awardedXp
  );
  if (events.bonusXp) profile.xp += events.bonusXp;
  if (events.bonusXp || events.dailyCleared) progress.saveProfile(profile);

  let devlogFile = null;
  let commit = { committed: false };
  let message = record.firstCompletion
    ? `Complete ${exercise.title} (+${record.awardedXp} XP)`
    : `Practice ${exercise.title}`;
  if (events.dailyCleared) message += ' · daily cleared';
  if (events.weeklyCompleted) message += ' · weekly goal met';
  if (events.bonusXp) message += ` (+${events.bonusXp} bonus XP)`;

  // Project build steps assemble the verified solution into the real
  // tool under projects/<name>/ (and only ever there).
  let assembly = null;
  if (exercise.project && exercise.project.function && userCode) {
    assembly = require('../lib/project').assembleStep(exercise, userCode);
  }

  // Lessons and onboarding aren't achievements to write up.
  const devloggable = exercise.type !== 'lesson' && exercise.track !== 'onboarding';
  if (record.firstCompletion && devloggable) {
    devlogFile = scaffoldDraft(exercise, userCode, run.results, record.awardedXp);
  }
  commit = await commitProgress(message);

  return {
    ...run,
    awardedXp: record.awardedXp,
    firstCompletion: record.firstCompletion,
    events,
    assembly,
    devlogFile,
    commit,
    state: stateForRenderer(),
  };
}

ipcMain.handle('kata:run', async (_ev, { id, code }) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { passed: false, error };

  const run = await runTests(exercise, code);
  if (!run.passed) return { ...run, ...schedule.applyFailure(exercise) };
  return onPass(exercise, run, code);
});

ipcMain.handle('challenge:run', async (_ev, { id, flag }) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { passed: false, error };

  const run = await runChecks(exercise, { flag });
  if (!run.passed) return { ...run, ...schedule.applyFailure(exercise) };
  return onPass(exercise, run, null);
});

ipcMain.handle('lab:reset', (_ev, id) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { error };
  return { labPath: resetLab(exercise) };
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
        if (process.env.SQ_SCREENSHOT_CLICK) {
          await win.webContents.executeJavaScript(
            `{ const el = document.querySelector(${JSON.stringify(process.env.SQ_SCREENSHOT_CLICK)});
               if (el) { el.click(); setTimeout(() => (document.querySelector(${JSON.stringify(
                 process.env.SQ_SCREENSHOT_SCROLL || 'body'
               )}) || el).scrollIntoView({ block: 'center' }), 300); } }`
          );
          await new Promise((r) => setTimeout(r, 800));
        }
        const image = await win.webContents.capturePage();
        require('fs').writeFileSync(process.env.SQ_SCREENSHOT, image.toPNG());
        app.quit();
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
