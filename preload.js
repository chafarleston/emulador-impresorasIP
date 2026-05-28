const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerAPI', {
  onPrintData: (callback) => ipcRenderer.on('print-data', (_event, data) => callback(data)),
  onConnection: (callback) => ipcRenderer.on('connection', (_event, data) => callback(data)),
  onServerStatus: (callback) => ipcRenderer.on('server-status', (_event, data) => callback(data)),
  onShowAbout: (callback) => ipcRenderer.on('show-about', () => callback()),
  getServerConfig: () => ipcRenderer.invoke('get-server-config'),
  getAvailableIPs: () => ipcRenderer.invoke('get-available-ips'),
  restartServer: (config) => ipcRenderer.invoke('restart-server', config),
  setLanguage: (lang) => ipcRenderer.invoke('set-language', lang),
});
