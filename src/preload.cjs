'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('miku', {
  load: () => ipcRenderer.invoke('miku:load'),
  save: patch => ipcRenderer.invoke('miku:save', patch),
  speak: kind => ipcRenderer.invoke('miku:speak', kind),
  stopSpeaking: () => ipcRenderer.invoke('miku:stop-speaking'),
  command: text => ipcRenderer.invoke('miku:command', text),
  microphoneStatus: status => ipcRenderer.invoke('miku:microphone-status', status),
  wakeHeard: text => ipcRenderer.invoke('miku:wake-heard', text),
  hide: () => ipcRenderer.invoke('miku:hide'),
  quit: () => ipcRenderer.invoke('miku:quit'),
  interactive: value => ipcRenderer.invoke('miku:interactive', value),
  onSettings: callback => ipcRenderer.on('miku:settings', (_event, value) => callback(value)),
  onPause: callback => ipcRenderer.on('miku:pause', () => callback()),
  onWake: callback => ipcRenderer.on('miku:wake', () => callback()),
});
