const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('node:path');
const { mergeDeviceReadings } = require('./device-cache');
const { snapshot } = require('./telemetry');

let window;
let macBusy = false;
let devicesBusy = false;
let deviceCache = new Map();

async function poll(kind) {
  if (!window || window.isDestroyed()) return;
  if (kind === 'mac' && macBusy) return;
  if (kind === 'devices' && devicesBusy) return;
  if (kind === 'mac') macBusy = true;
  else devicesBusy = true;

  try {
    const data = await snapshot(kind);
    if (Array.isArray(data.devices)) {
      const merged = mergeDeviceReadings(deviceCache, data.devices, Date.now());
      deviceCache = merged.cache;
      data.devices = merged.devices;
    }
    if (window && !window.isDestroyed()) {
      window.webContents.send('telemetry', data);
    }
  } catch (error) {
    if (window && !window.isDestroyed()) {
      window.webContents.send('telemetry-error', { kind, message: error.message });
    }
  } finally {
    if (kind === 'mac') macBusy = false;
    else devicesBusy = false;
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 430,
    height: 720,
    minWidth: 390,
    minHeight: 540,
    title: 'Volt Battery',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f3f5f3',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.once('did-finish-load', () => {
    poll('mac');
    poll('devices');
  });
}

app.whenReady().then(() => {
  createWindow();
  setInterval(() => poll('mac'), 2500);
  setInterval(() => poll('devices'), 10000);
  powerMonitor.on('resume', () => { poll('mac'); poll('devices'); });
  ipcMain.on('refresh', () => { poll('mac'); poll('devices'); });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
