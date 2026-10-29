'use strict';
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, screen, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { normalizeSettings, greeting, loadSettings, saveSettings, visiblePosition } = require('./core.cjs');
const { WindowsVoice } = require('./voice.cjs');

if (process.env.MIKUAI_DATA_DIR) app.setPath('userData', path.resolve(process.env.MIKUAI_DATA_DIR));
const singleInstance = app.requestSingleInstanceLock();
let win, tray, settings, voice, quitting = false, positionTimer;
const size = { width: 400, height: 700 };
const html = path.join(__dirname, 'renderer', 'index.html');
const rendererUrl = pathToFileURL(html).href;
const dataFile = () => path.join(app.getPath('userData'), 'settings.json');
const positionFile = () => path.join(app.getPath('userData'), 'position.json');

function show() { if (win && !win.isDestroyed()) { win.show(); win.focus(); } }
function hide() { win?.webContents.send('miku:pause'); win?.hide(); }
function toggle() { if (win?.isVisible()) hide(); else show(); }
function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar Miku', click: show },
    { label: 'Ocultar Miku', click: hide },
    { type: 'separator' },
    { label: 'Siempre visible', type: 'checkbox', checked: settings.alwaysOnTop, click: item => updateSettings({ alwaysOnTop: item.checked }) },
    { label: 'Silenciar', type: 'checkbox', checked: settings.muted, click: item => updateSettings({ muted: item.checked }) },
    { type: 'separator' },
    { label: 'Salir de MikuAI', click: () => app.quit() },
  ]));
}
function updateSettings(patch) {
  const next = saveSettings(dataFile(), { ...settings, ...patch });
  settings = next;
  win.setAlwaysOnTop(settings.alwaysOnTop);
  win.webContents.send('miku:settings', settings);
  trayMenu();
  return settings;
}
function bind(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('Origen no permitido.');
    return handler(...args);
  });
}

async function createWindow() {
  settings = loadSettings(dataFile());
  voice = new WindowsVoice(app.isPackaged ? path.join(process.resourcesPath, 'windows-voice.ps1') : path.join(__dirname, '..', 'scripts', 'windows-voice.ps1'));
  const area = screen.getPrimaryDisplay().workArea;
  size.height = Math.min(700, area.height);
  let stored;
  try { stored = JSON.parse(fs.readFileSync(positionFile(), 'utf8')); } catch {}
  const position = visiblePosition(stored, screen.getAllDisplays(), size) || { x: area.x + area.width - size.width - 20, y: area.y + Math.max(0, area.height - size.height) };
  win = new BrowserWindow({
    ...size, ...position, title: 'MikuAI', frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, fullscreenable: false, show: false, hasShadow: false,
    alwaysOnTop: settings.alwaysOnTop, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.on('close', event => { if (!quitting) { event.preventDefault(); hide(); } });
  win.on('moved', () => {
    clearTimeout(positionTimer);
    positionTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        try { fs.writeFileSync(positionFile(), JSON.stringify(win.getBounds())); } catch (error) { console.error('No se pudo guardar la posición:', error.message); }
      }
    }, 250);
  });
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('MikuAI · Ctrl + Alt + M');
  tray.on('click', toggle);
  trayMenu();
  const shortcutAvailable = globalShortcut.register('CommandOrControl+Alt+M', toggle);

  bind('miku:load', async () => {
    let voices = [], voiceError = '';
    try { voices = await voice.list(); } catch { voiceError = 'No pude cargar las voces. Revisa que Windows tenga una voz instalada.'; }
    return { settings, voices, voiceError, shortcutAvailable, greeting: greeting(settings.name) };
  });
  bind('miku:save', patch => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Ajustes inválidos.');
    if ('name' in patch && !normalizeSettings({ name: patch.name }).name) throw new Error('Escribe tu nombre (hasta 40 caracteres).');
    return updateSettings(patch);
  });
  bind('miku:speak', async kind => {
    if (settings.muted) return { muted: true };
    const text = kind === 'welcome' ? greeting(settings.name) : kind === 'introduction' ? greeting('') : null;
    if (!text) throw new Error('Frase no disponible.');
    try { return await voice.synthesize(text, settings); }
    catch { return { error: 'No pude generar el audio. Prueba otra voz en Ajustes.' }; }
  });
  bind('miku:hide', hide);
  bind('miku:quit', () => app.quit());
  // Forward mouse movement through empty space while keeping visible controls clickable.
  bind('miku:interactive', interactive => {
    if (typeof interactive !== 'boolean') return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  win.once('ready-to-show', show);
  await win.loadFile(html);
}

if (!singleInstance) app.quit();
else {
  app.on('second-instance', show);
  app.whenReady().then(createWindow).catch(error => { console.error(error); app.quit(); });
  app.on('activate', show);
  app.on('before-quit', () => { quitting = true; clearTimeout(positionTimer); voice?.dispose(); globalShortcut.unregisterAll(); });
  app.on('window-all-closed', () => app.quit());
}
