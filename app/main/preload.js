'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shellquest', {
  getState: () => ipcRenderer.invoke('state:get'),
  getExercise: (id) => ipcRenderer.invoke('exercise:get', id),
  runKata: (id, code) => ipcRenderer.invoke('kata:run', { id, code }),
  runChallenge: (id, flag) => ipcRenderer.invoke('challenge:run', { id, flag }),
  resetLab: (id) => ipcRenderer.invoke('lab:reset', id),
});
