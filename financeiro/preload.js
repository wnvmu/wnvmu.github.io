const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fsAPI', {
  login: (user, pass, createIfMissing) => ipcRenderer.invoke('login', {user, pass, createIfMissing}),
  save: (csv) => ipcRenderer.invoke('save', {csv})
});
