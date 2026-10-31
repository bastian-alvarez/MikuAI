'use strict';
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, screen, session, protocol, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { normalizeSettings, greeting, wakeQuestion, loadSettings, saveSettings, visiblePosition } = require('./core.cjs');
const { WindowsVoice } = require('./voice.cjs');
const { EXPRESSIONS, EXAMPLES, interpretCommand } = require('./commands.cjs');
const { createConversationService } = require('./services/conversation.service.cjs');
const { createOllamaProvider } = require('./services/ai/ollama.provider.cjs');
const { createCloudProvider } = require('./services/ai/cloud.provider.cjs');
const { MemoryService } = require('./services/memory/memory.service.cjs');
const { WakeGate, VoiceCommandWindow } = require('./renderer/wake-logic.js');

protocol.registerSchemesAsPrivileged([{ scheme: 'miku', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (process.env.MIKUAI_DATA_DIR) app.setPath('userData', path.resolve(process.env.MIKUAI_DATA_DIR));
const singleInstance = app.requestSingleInstanceLock();
let win, tray, settings, voice, quitting = false, positionTimer, lastReply = '';
const size = { width: 400, height: 700 };
const rendererUrl = 'miku://app/src/renderer/index.html';
const wakeGate = new WakeGate();
const voiceTurn = new VoiceCommandWindow();
let memory = null;
let conversation = null;
let microphoneStatus = { state: 'off', message: 'Micrófono apagado.' };
const dataFile = () => path.join(app.getPath('userData'), 'settings.json');
const positionFile = () => path.join(app.getPath('userData'), 'position.json');

function show() { if (win && !win.isDestroyed()) { win.setIgnoreMouseEvents(false); win.show(); win.focus(); } }
function hide() { voiceTurn.cancel(); voice?.cancelSpeech(); win?.webContents.send('miku:pause'); win?.hide(); }
function toggle() { if (win?.isVisible()) hide(); else show(); }
function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar Miku', click: show },
    { label: 'Ocultar Miku', click: hide },
    { type: 'separator' },
    { label: 'Siempre visible', type: 'checkbox', checked: settings.alwaysOnTop, click: item => updateSettings({ alwaysOnTop: item.checked }) },
    { label: 'Silenciar', type: 'checkbox', checked: settings.muted, click: item => updateSettings({ muted: item.checked }) },
    { label: 'Escuchar «oye Miku»', type: 'checkbox', checked: settings.wakeEnabled, click: item => updateSettings({ wakeEnabled: item.checked }) },
    { type: 'separator' },
    { label: 'Salir de MikuAI', click: () => app.quit() },
  ]));
}
function updateSettings(patch) {
  const next = saveSettings(dataFile(), { ...settings, ...patch });
  settings = next;
  if (memory && Object.prototype.hasOwnProperty.call(patch, 'memoryEnabled')) memory.setEnabled(settings.memoryEnabled);
  if (!settings.wakeEnabled) voiceTurn.cancel();
  if (settings.muted) voice.cancelSpeech();
  win.setAlwaysOnTop(settings.alwaysOnTop);
  win.webContents.send('miku:settings', settings);
  trayMenu();
  return settings;
}
function executeCommand(input, fromVoice = false) {
  const result = interpretCommand(input, settings);
  if (fromVoice && !result.recognized) {
    result.text = 'No entendí esa orden. Puedes decir «ayuda» para ver ejemplos.';
    result.speak = true;
  }
  if (result.patch) updateSettings(result.patch);
  lastReply = result.text;
  if (result.action === 'hide') hide();
  return { ...result, settings };
}
function bind(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('Origen no permitido.');
    return handler(...args);
  });
}

async function createWindow() {
  settings = loadSettings(dataFile());
  memory = new MemoryService({ dataDir: path.join(app.getPath('userData'), 'memory'), enabled: settings.memoryEnabled });
  conversation = createConversationService({
    providerFactory: current => current?.aiProvider === 'cloud'
      ? createCloudProvider({})
      : createOllamaProvider({ baseUrl: current?.ollamaUrl, model: current?.ollamaModel }),
    memory
  });
  protocol.handle('miku', request => {
    try {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname);
      if (url.host !== 'app' || !/^\/(?:assets|src\/renderer)\//.test(pathname) || pathname.includes('\\') || pathname.split('/').includes('..')) return new Response('Forbidden', { status: 403 });
      const root = path.resolve(__dirname, '..');
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).href).then(response => {
        // Emscripten's generated functions are confined to a worker without DOM,
        // Node.js or microphone access. The renderer does not allow eval.
        if (pathname === '/assets/vendor/vosk-worker.js') {
          const headers = new Headers(response.headers);
          headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self' data:");
          return new Response(response.body, { status: response.status, headers });
        }
        return response;
      });
    } catch { return new Response('Bad request', { status: 400 }); }
  });
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
  const trusted = contents => contents === win.webContents && contents.getURL() === rendererUrl;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(trusted(contents) && settings.wakeEnabled && permission === 'media' && details.mediaTypes?.includes('audio') && !details.mediaTypes.includes('video'));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
    trusted(contents) && settings.wakeEnabled && permission === 'media' && details.mediaType === 'audio');
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
    return { settings, voices, voiceError, shortcutAvailable, greeting: greeting(settings.name), expressions: EXPRESSIONS, examples: EXAMPLES, microphoneStatus };
  });
  bind('miku:save', patch => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Ajustes inválidos.');
    if ('name' in patch && !normalizeSettings({ name: patch.name }).name) throw new Error('Escribe tu nombre (hasta 40 caracteres).');
    return updateSettings(patch);
  });
  bind('miku:speak', async kind => {
    if (settings.muted) return { muted: true };
    const text = kind === 'welcome' ? greeting(settings.name) : kind === 'introduction' ? greeting('') : kind === 'reply' ? lastReply : kind === 'wake' ? wakeQuestion(settings.name) : null;
    if (!text) throw new Error('Frase no disponible.');
    try { return await voice.synthesize(text, settings); }
    catch { return { error: 'No pude generar el audio. Prueba otra voz en Ajustes.' }; }
  });
  bind('miku:stop-speaking', () => voice.cancelSpeech());
  bind('miku:command', input => {
    voiceTurn.cancel();
    return executeCommand(input);
  });
  bind('miku:chat', async (input, history) => {
    if (!settings.aiEnabled) return { ok: false, error: 'La IA está desactivada. Actívala en Ajustes.' };
    return conversation.chat(input, settings, Array.isArray(history) ? history : []);
  });
  bind('miku:ai-status', async () => {
    const provider = settings.aiProvider === 'cloud'
      ? createCloudProvider({})
      : createOllamaProvider({ baseUrl: settings.ollamaUrl, model: settings.ollamaModel });
    return provider.isAvailable();
  });
  bind('miku:memory-status', () => memory ? memory.stats() : { enabled: false, personalCount: 0, historyCount: 0 });
  bind('miku:memory-list', () => memory ? memory.getPersonalMemories() : []);
  bind('miku:memory-add', text => {
    if (!memory) return { ok: false, error: 'Memoria no disponible.' };
    if (typeof text !== 'string') return { ok: false, error: 'Texto inválido.' };
    return memory.addPersonalMemory(text);
  });
  bind('miku:memory-remove', id => {
    if (!memory) return { ok: false, error: 'Memoria no disponible.' };
    if (typeof id !== 'string') return { ok: false, error: 'Identificador inválido.' };
    return memory.removePersonalMemory(id);
  });
  bind('miku:memory-clear-personal', () => memory ? memory.clearPersonalMemories() : { ok: false, error: 'Memoria no disponible.' });
  bind('miku:memory-clear-history', () => memory ? memory.clearHistory() : { ok: false, error: 'Memoria no disponible.' });
  bind('miku:memory-set-enabled', value => {
    if (!memory) return { ok: false, error: 'Memoria no disponible.' };
    if (typeof value !== 'boolean') return { ok: false, error: 'Valor inválido.' };
    memory.setEnabled(value);
    return updateSettings({ memoryEnabled: value });
  });
  bind('miku:arm-voice-turn', id => settings.wakeEnabled ? voiceTurn.arm(id) : null);
  bind('miku:end-voice-turn', id => voiceTurn.cancel(id));
  bind('miku:voice-command', (id, input) => {
    if (!settings.wakeEnabled || !voiceTurn.consume(id)) return { accepted: false };
    return { ...executeCommand(input, true), accepted: true };
  });
  bind('miku:hide', hide);
  bind('miku:microphone-status', status => {
    if (!status || !['off', 'starting', 'listening', 'answering', 'command', 'error'].includes(status.state)) return;
    microphoneStatus = { state: status.state, message: typeof status.message === 'string' ? status.message.slice(0, 200) : '' };
    if (['off', 'error'].includes(status.state)) voiceTurn.cancel();
    win.webContents.setBackgroundThrottling(['off', 'error'].includes(status.state));
    const label = { listening: 'Escuchando «oye Miku»', command: 'Escuchando una orden', answering: 'Respondiendo', starting: 'Preparando micrófono', error: 'Error de micrófono', off: 'Micrófono apagado' };
    tray.setToolTip(`MikuAI · ${label[status.state]} · Ctrl + Alt + M`);
  });
  bind('miku:wake-heard', text => {
    if (!wakeGate.accept(text, settings.wakeEnabled && ['listening', 'command'].includes(microphoneStatus.state))) return false;
    const id = randomUUID();
    voiceTurn.begin(id);
    show();
    win.webContents.send('miku:wake', { id, text: wakeQuestion(settings.name) });
    return true;
  });
  bind('miku:quit', () => app.quit());
  // Forward mouse movement through empty space while keeping visible controls clickable.
  bind('miku:interactive', interactive => {
    if (typeof interactive !== 'boolean') return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  bind('miku:window-bounds', () => (win && !win.isDestroyed() ? win.getBounds() : null));
  bind('miku:set-window-position', (x, y) => {
    if (!win || win.isDestroyed()) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    win.setPosition(Math.round(x), Math.round(y));
  });
  win.once('ready-to-show', show);
  await win.loadURL(rendererUrl);
}

if (!singleInstance) app.quit();
else {
  app.on('second-instance', show);
  app.whenReady().then(createWindow).catch(error => { console.error(error); app.quit(); });
  app.on('activate', show);
  app.on('before-quit', () => { quitting = true; clearTimeout(positionTimer); memory?.save(); voice?.dispose(); globalShortcut.unregisterAll(); });
  app.on('window-all-closed', () => app.quit());
}
