const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('batteryAPI', {
  onTelemetry: (callback) => ipcRenderer.on('telemetry', (_event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('telemetry-error', (_event, data) => callback(data)),
  refresh: () => ipcRenderer.send('refresh')
});
