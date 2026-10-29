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
  const submit = async text => {
    await js(`document.getElementById('command').value = ${JSON.stringify(text)}; document.getElementById('command-form').requestSubmit();`);
    await waitFor(() => js("!document.getElementById('send-command').disabled"), `orden ${text}`);
  };
  for (const expression of loaded.expressions) {
    await submit(`Expresión ${expression.label}`);
    await waitFor(() => js(`document.getElementById('miku-art').dataset.expression === ${JSON.stringify(expression.id)}`), `imagen ${expression.id}`);
    assert.equal(await js("document.getElementById('miku-art').naturalWidth > 0"), true);
  }
  await submit('Volumen al 30%');
  assert.equal((await js('window.miku.load()')).settings.volume, 0.3);
  await submit('Llámame María José');
  assert.equal(await js("document.getElementById('message').textContent"), '¡Bienvenido, María José-sama!');
  await submit('¿Qué hora es?');
  assert.match(await js("document.getElementById('message').textContent"), /^Son las \d{2}:\d{2}\./);
  await submit('Di que tengas un lindo día');
  assert.equal(await js("document.getElementById('message').textContent"), 'que tengas un lindo día');
  await submit('abre powershell');
  assert.match(await js("document.getElementById('message').textContent"), /Todavía no entiendo/);
  await submit('Ayuda');
  assert.equal(await js("document.getElementById('help').hidden"), false);
  assert.equal(await js("document.querySelectorAll('.example').length"), loaded.examples.length);
  await js("document.getElementById('close-help').click()");
  await submit('Ponte sonrojada');
  await waitFor(() => js("document.getElementById('miku-art').dataset.expression === 'blush'"), 'última expresión');
  win.webContents.reload();
  await waitFor(async () => !win.webContents.isLoading() && js("document.getElementById('miku-art')?.dataset.expression === 'blush'"), 'restaurar expresión');
  const layout = await js("({top:document.querySelector('.bubble').getBoundingClientRect().top,bottom:document.querySelector('.toolbar').getBoundingClientRect().bottom,height:innerHeight})");
  assert.ok(layout.top >= 0 && layout.bottom <= layout.height, 'Controles dentro de la ventana');
  if (process.env.MIKUAI_CAPTURE) {
    const output = path.resolve(process.env.MIKUAI_CAPTURE);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'desktop-v02.png'), (await win.webContents.capturePage()).toPNG());
  }
  await submit('Ocúltate');
  assert.equal(win.isVisible(), false);
  win.show();
  // Small screens and a long response must keep the controls accessible.
  win.setResizable(true);
  win.setSize(400, 600);
  await submit(`Di ${'Un saludo muy largo para comprobar el tamaño. '.repeat(3)}`);
  const small = await js("({top:document.querySelector('.bubble').getBoundingClientRect().top,bottom:document.querySelector('.toolbar').getBoundingClientRect().bottom,height:innerHeight})");
  assert.ok(small.top >= 0 && small.bottom <= small.height, 'Controles dentro de una pantalla pequeña');
  await js('window.miku.hide()');
  assert.equal(win.isVisible(), false);
  win.show();
  assert.equal(win.isVisible(), true);
  console.log('Desktop OK: inicio, voz, siete expresiones, órdenes, ayuda, persistencia, ventana pequeña, ocultar y mostrar.');
}
check().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
