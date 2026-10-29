// Integration test for our own Electron app, with an isolated profile.
const { app, BrowserWindow, globalShortcut } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dataDir = path.join(__dirname, '..', '.local', `desktop-check-${Date.now()}`);
fs.mkdirSync(dataDir, { recursive: true });
process.env.MIKUAI_DATA_DIR = dataDir;
require('../src/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(callback, description, timeout = 25000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const result = await callback();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Tiempo agotado: ${description}`);
}
async function check() {
  await app.whenReady();
  const win = await waitFor(() => BrowserWindow.getAllWindows()[0], 'crear ventana');
  const js = source => win.webContents.executeJavaScript(source);
  const read = source => js(`(() => { ${source} })()`);
  await waitFor(async () => !win.webContents.isLoading() && read("return document.getElementById('name-form') && !document.getElementById('name-form').hidden;"), 'primer inicio');
  assert.equal(win.isAlwaysOnTop(), true);
  assert.equal(win.webContents.getLastWebPreferences().contextIsolation, true);
  assert.equal(win.webContents.getLastWebPreferences().nodeIntegration, false);
  assert.equal(await js('typeof window.require'), 'undefined');
  const loaded = await js('window.miku.load()');
  assert.equal(loaded.shortcutAvailable, globalShortcut.isRegistered('CommandOrControl+Alt+M'));
  assert.equal(loaded.settings.name, '');
  assert.ok(loaded.voices.length > 0);
  await waitFor(() => js("document.getElementById('miku-art').complete && document.getElementById('miku-art').naturalWidth > 0"), 'imagen');
  // Let the initial spoken question finish before asking for the welcome.
  await delay(5000);
  await js("document.getElementById('first-name').value = 'Bastián'; document.getElementById('name-form').requestSubmit();");
  await waitFor(() => js("document.getElementById('message').textContent === '¡Bienvenido, Bastián-sama!'"), 'saludo personalizado');
  await waitFor(() => js("document.body.classList.contains('speaking')"), 'reproducción del saludo');
  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
  assert.equal(stored.name, 'Bastián');
  await js("document.getElementById('mute').click()");
  await waitFor(() => js("document.getElementById('mute').getAttribute('aria-pressed') === 'true'"), 'silenciar');
  assert.equal(await js("document.body.classList.contains('speaking')"), false);
  await js("document.getElementById('settings-button').click()");
  assert.equal(await js("document.getElementById('settings').hidden"), false);
  await js("document.getElementById('name').value = 'Miku'; document.getElementById('always-on-top').checked = false; document.getElementById('settings-form').requestSubmit();");
  await waitFor(() => !win.isAlwaysOnTop(), 'desactivar siempre visible');
  assert.equal(await js("document.getElementById('settings').hidden"), true);
  assert.equal(await js("document.getElementById('message').textContent"), '¡Bienvenido, Miku-sama!');
  // A fresh renderer must recover the persisted profile, including mute.
  win.webContents.reload();
  await waitFor(async () => !win.webContents.isLoading() && js("document.getElementById('message')?.textContent === '¡Bienvenido, Miku-sama!'"), 'restaurar perfil');
  assert.equal(await js("document.getElementById('mute').getAttribute('aria-pressed')"), 'true');
  await js('window.miku.hide()');
  assert.equal(win.isVisible(), false);
  win.show();
  assert.equal(win.isVisible(), true);
  console.log('Desktop OK: inicio, imagen, IPC aislado, voces, saludo reproducido, guardado, ajustes, recarga, ocultar y mostrar.');
}
check().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
