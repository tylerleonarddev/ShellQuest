'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shellquest', {
  getState: () => ipcRenderer.invoke('state:get'),
  getExercise: (id) => ipcRenderer.invoke('exercise:get', id),
  runKata: (id, code) => ipcRenderer.invoke('kata:run', { id, code }),
  runChallenge: (id, flag) => ipcRenderer.invoke('challenge:run', { id, flag }),
  resetLab: (id) => ipcRenderer.invoke('lab:reset', id),
  completeLesson: (id) => ipcRenderer.invoke('lesson:complete', id),
  getGlossary: () => ipcRenderer.invoke('glossary:get'),
  listDevlogs: () => ipcRenderer.invoke('devlogs:list'),
  publishDevlog: (file) => ipcRenderer.invoke('devlogs:publish', file),
  readDevlog: (file) => ipcRenderer.invoke('devlogs:read', file),
  saveReflection: (file, text) => ipcRenderer.invoke('devlogs:save-reflection', { file, text }),
  gitPush: () => ipcRenderer.invoke('git:push'),
  draftDigest: () => ipcRenderer.invoke('devlogs:digest'),
  getAiHint: (id, code, failure) => ipcRenderer.invoke('ai:hint', { id, code, failure }),
  chatSend: (id, messages) => ipcRenderer.invoke('chat:send', { id, messages }),
  onChatChunk: (cb) => ipcRenderer.on('chat:chunk', (_ev, data) => cb(data)),
});
