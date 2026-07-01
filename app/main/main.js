'use strict';
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const content = require('../lib/content');
const progress = require('../lib/progress');
const { runTests } = require('../lib/verify-python');
const { scaffoldDraft } = require('../lib/devlog');
const { commitProgress } = require('../lib/git');

function buildState() {
  const { exercises, errors } = content.loadExercises();
  const completions = progress.getCompletions();
  const completedIds = new Set(completions.completions.map((c) => c.exercise_id));
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

ipcMain.handle('exercise:get', (_ev, id) => {
  const exercise = content.getExercise(id);
  if (!exercise) return null;
  return {
    id: exercise.id,
    title: exercise.title,
    xp: exercise.xp,
    prompt: exercise.prompt,
    starter_code: exercise.starter_code || '',
    completed: progress.isCompleted(exercise.id),
    testCount: exercise.verification.tests.length,
  };
});

ipcMain.handle('kata:run', async (_ev, { id, code }) => {
  const exercise = content.getExercise(id);
  if (!exercise) return { passed: false, error: `Unknown exercise: ${id}` };

  const run = await runTests(exercise, code);
  if (!run.passed) return run;

  // The on-pass sequence: progress -> devlog draft -> scoped git commit.
  const record = progress.recordPass(exercise);
  let devlogFile = null;
  let commit = { committed: false };

  if (record.firstCompletion) {
    devlogFile = scaffoldDraft(exercise, code, run.results, record.awardedXp);
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
