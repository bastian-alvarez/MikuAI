const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULTS } = require('../src/core.cjs');
const { WindowsVoice } = require('../src/voice.cjs');
const { isWakePhrase } = require('../src/renderer/wake-logic.js');
const dir = path.join(__dirname, '..', '.local', `listener-check-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ ...DEFAULTS, name: 'Prueba', muted: true }));
process.env.MIKUAI_DATA_DIR = dir;
require('../src/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { console.error('Listener check timed out'); app.exit(1); }, 120000);
async function waitFor(callback, label, timeout = 90000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await callback();
    if (value) return value;
    await delay(100);
  }
  throw new Error(`Tiempo agotado: ${label}`);
}
async function run() {
  await app.whenReady();
  const win = await waitFor(() => BrowserWindow.getAllWindows()[0], 'ventana');
  win.webContents.on('console-message', details => { if (details.level === 'error') console.log('Renderer:', details.message.slice(0, 400)); });
  const js = code => win.webContents.executeJavaScript(code);
  await waitFor(async () => !win.webContents.isLoading() && js("document.getElementById('command-form') && !document.getElementById('command-form').hidden"), 'interfaz');
  assert.equal(await js('location.protocol'), 'miku:');
  assert.equal(await js("fetch('miku://app/src/main.cjs').then(r=>r.status)"), 403);
  assert.equal(await js("navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return 'allowed';},e=>e.name)"), 'NotAllowedError');
  assert.equal(await js("window.miku.wakeHeard('oye miku')"), false);
  await js("window.miku.save({wakeEnabled:true})");
  await waitFor(async () => {
    const state = await js('microphoneState');
    if (state.state === 'error') throw new Error(state.message);
    return state.state === 'listening';
  }, 'carga del modelo y micrófono');
  assert.equal(await js("listener.resources.stream.getAudioTracks()[0].readyState"), 'live');
  assert.equal(await js("listener.resources.context.state"), 'running');
  const engine = new WindowsVoice(path.join(__dirname, 'windows-voice.ps1'));
  let audio;
  try { audio = (await engine.synthesize('Oye Miku', DEFAULTS)).audio; }
  finally { engine.dispose(); }
  await js('listener.resources.source.disconnect()');
  await js('window.miku.hide()');
  assert.equal(win.isVisible(), false);
  const recognized = await js(`(async () => {
    listener.blockedUntil = 0;
    listener.outputActive = false;
    const rec = listener.resources.recognizer;
    const raw = Uint8Array.from(atob(${JSON.stringify(audio)}), c=>c.charCodeAt(0));
    const buffer = await listener.resources.context.decodeAudioData(raw.buffer);
    return new Promise((resolve,reject)=>{
      const timeout = setTimeout(()=>reject(new Error('No ASR result')),20000);
      rec.on('result', message=>{clearTimeout(timeout);resolve(message.result.text);});
      rec.acceptWaveform(buffer);
      rec.acceptWaveformFloat(new Float32Array(16000*3),16000);
    });
  })()`);
  console.log('Synthetic wake phrase recognized:', JSON.stringify(recognized));
  assert.ok(isWakePhrase(recognized), 'El audio de «oye Miku» debe activar la frase');
  await waitFor(() => win.isVisible(), 'mostrar la ventana con audio reconocido', 5000);
  assert.match(await js("document.getElementById('message').textContent"), /Aquí estoy/);
  // While output audio plays, the same recognized phrase is ignored.
  await js("listener.output(true); window.miku.hide()");
  await js("listener.output(true); listener.resources.recognizer.dispatchEvent(new CustomEvent('result',{detail:{result:{text:'oye miku'}}}))");
  assert.equal(win.isVisible(), false);
  await js("window.savedTrack = listener.resources.stream.getAudioTracks()[0]; window.miku.save({wakeEnabled:false})");
  await waitFor(() => js("microphoneState.state === 'off'"), 'apagar micrófono');
  assert.equal(await js('window.savedTrack.readyState'), 'ended');
  assert.equal(await js('listener.resources'), null);
  assert.equal(await js("window.miku.wakeHeard('oye miku')"), false);
  console.log('Listener OK: permisos, reconocimiento local real, activación oculta, audio propio ignorado y micrófono liberado.');
}
run().then(() => { clearTimeout(deadline); app.exit(0); }).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
