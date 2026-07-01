'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shellquest', {
  getState: () => ipcRenderer.invoke('state:get'),
  getExercise: (id) => ipcRenderer.invoke('exercise:get', id),
  runKata: (id, code) => ipcRenderer.invoke('kata:run', { id, code }),
});
