'use strict';
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const content = require('../lib/content');
const progress = require('../lib/progress');
const { runTests } = require('../lib/verify-python');
const { runChecks } = require('../lib/verify-artifact');
const { isUnlocked } = require('../lib/unlock');
const { ensureLab, resetLab } = require('../lib/lab');
const { scaffoldDraft } = require('../lib/devlog');
const { commitProgress } = require('../lib/git');

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
    exercises: exercises.map((e) => ({
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
    testCount: exercise.verification.tests.length,
  };
});

// The on-pass sequence: progress -> devlog draft -> scoped git commit.
// Shared by every verification runner.
async function onPass(exercise, run, userCode) {
  const record = progress.recordPass(exercise);
  let devlogFile = null;
  let commit = { committed: false };

  if (record.firstCompletion) {
    devlogFile = scaffoldDraft(exercise, userCode, run.results, record.awardedXp);
    commit = await commitProgress(`Complete ${exercise.title} (+${record.awardedXp} XP)`);
  } else if (record.changed) {
    commit = await commitProgress(`Practice ${exercise.title}`);
  }

  return {
    ...run,
    awardedXp: record.awardedXp,
    firstCompletion: record.firstCompletion,
    devlogFile,
    commit,
    state: stateForRenderer(),
  };
}

ipcMain.handle('kata:run', async (_ev, { id, code }) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { passed: false, error };

  const run = await runTests(exercise, code);
  if (!run.passed) return run;
  return onPass(exercise, run, code);
});

ipcMain.handle('challenge:run', async (_ev, { id, flag }) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { passed: false, error };

  const run = await runChecks(exercise, { flag });
  if (!run.passed) return run;
  return onPass(exercise, run, null);
});

ipcMain.handle('lab:reset', (_ev, id) => {
  const { exercise, error } = getUnlockedExercise(id);
  if (error) return { error };
  return { labPath: resetLab(exercise) };
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
            `document.querySelector(${JSON.stringify(process.env.SQ_SCREENSHOT_CLICK)})?.click()`
          );
          await new Promise((r) => setTimeout(r, 600));
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
