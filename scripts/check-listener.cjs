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
const deadline = setTimeout(() => { console.error('Listener check timed out'); app.exit(1); }, 180000);
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
  assert.equal((await js("window.miku.voiceCommand('invalid','ponte feliz')")).accepted, false);
  await js("window.miku.save({wakeEnabled:true})");
  await waitFor(async () => {
    const state = await js('microphoneState');
    if (state.state === 'error') throw new Error(state.message);
    return state.state === 'listening';
  }, 'carga del modelo y micrófono');
  assert.equal(await js("listener.resources.stream.getAudioTracks()[0].readyState"), 'live');
  assert.equal(await js("listener.resources.context.state"), 'running');
  const engine = new WindowsVoice(path.join(__dirname, 'windows-voice.ps1'));
  const audio = {};
  try {
    for (const phrase of ['Oye Miku', 'Ponte feliz', 'Volumen al treinta por ciento', 'Qué hora es', 'Ocúltate']) audio[phrase] = (await engine.synthesize(phrase, DEFAULTS)).audio;
  }
  finally { engine.dispose(); }
  await js('listener.resources.source.disconnect()');
  const feed = async phrase => js(`(async () => {
    listener.resetRecognizer();
    const rec = listener.resources.recognizer;
    const raw = Uint8Array.from(atob(${JSON.stringify(audio[phrase])}), c=>c.charCodeAt(0));
    const buffer = await listener.resources.context.decodeAudioData(raw.buffer);
    return new Promise((resolve,reject)=>{
      const timeout = setTimeout(()=>reject(new Error('No ASR result')),20000);
      rec.on('result', message=>{clearTimeout(timeout);resolve(message.result.text);});
      rec.acceptWaveform(buffer);
      rec.acceptWaveformFloat(new Float32Array(16000*3),16000);
    });
  })()`);
  const wake = async (spoken = false) => {
    await js(`window.miku.save({muted:${!spoken}})`);
    await waitFor(() => js('!listener.outputActive && Date.now() >= listener.blockedUntil'), 'audio en reposo');
    const recognized = await feed('Oye Miku');
    assert.ok(isWakePhrase(recognized), `Llamada reconocida: ${recognized}`);
    await waitFor(() => win.isVisible(), 'mostrar con audio reconocido', 5000);
    assert.equal(await js("document.getElementById('message').textContent"), '¿Qué necesitas, Prueba-sama?');
    if (spoken) {
      await waitFor(() => js("document.body.classList.contains('speaking')"), 'pregunta reproducida');
      assert.equal(await js('listener.mode'), 'prompting');
      assert.equal((await js("window.miku.voiceCommand(voiceTurnId,'ponte feliz')")).accepted, false, 'No commands while Miku speaks');
    }
    await waitFor(() => js("listener.mode === 'command' && microphoneState.state === 'command'"), 'esperar la orden');
    return js('voiceTurnId');
  };
  await js('window.miku.hide()');
  assert.equal(win.isVisible(), false);
  const firstTurn = await wake(true);
  await js('window.miku.save({muted:true})');
  await waitFor(() => js('Date.now() >= listener.blockedUntil'), 'pausa de audio');
  const happy = await feed('Ponte feliz');
  console.log('Synthetic order recognized:', JSON.stringify(happy));
  await waitFor(() => js("settings.expression === 'happy' && listener.mode === 'wake'"), 'expresión por voz');
  assert.equal((await js(`window.miku.voiceCommand(${JSON.stringify(firstTurn)},'ponte sorprendida')`)).accepted, false, 'One command per turn');
  await waitFor(() => js('Date.now() - listener.gate.lastWake >= 3000'), 'intervalo entre llamadas');
  await wake();
  const volume = await feed('Volumen al treinta por ciento');
  console.log('Synthetic order recognized:', JSON.stringify(volume));
  await waitFor(() => js("settings.volume === 0.3 && listener.mode === 'wake'"), 'porcentaje hablado');
  await waitFor(() => js('Date.now() - listener.gate.lastWake >= 3000'), 'intervalo entre llamadas');
  await wake();
  await feed('Qué hora es');
  await waitFor(() => js("document.getElementById('message').textContent.startsWith('Son las') && listener.mode === 'wake'"), 'hora por voz');
  await waitFor(() => js('Date.now() - listener.gate.lastWake >= 3000'), 'intervalo entre llamadas');
  await wake();
  const hidden = await feed('Ocúltate');
  console.log('Synthetic order recognized:', JSON.stringify(hidden));
  await waitFor(() => !win.isVisible(), 'ocultar por voz');
  await waitFor(() => js('Date.now() - listener.gate.lastWake >= 3000'), 'intervalo entre llamadas');
  await wake();
  // Silence closes the command window without executing a background phrase.
  await waitFor(() => js("listener.mode === 'wake' && voiceTurnId === null"), 'fin de espera sin orden', 15000);
  assert.match(await js("document.getElementById('subtitle').textContent"), /No oí una orden/);
  // While output audio plays, the same recognized phrase is ignored.
  await js("listener.output(true); window.miku.hide()");
  await js("listener.output(true); listener.resources.recognizer.dispatchEvent(new CustomEvent('result',{detail:{result:{text:'oye miku'}}}))");
  assert.equal(win.isVisible(), false);
  await js("window.savedTrack = listener.resources.stream.getAudioTracks()[0]; window.miku.save({wakeEnabled:false})");
  await waitFor(() => js("microphoneState.state === 'off'"), 'apagar micrófono');
  assert.equal(await js('window.savedTrack.readyState'), 'ended');
  assert.equal(await js('listener.resources'), null);
  assert.equal(await js("window.miku.wakeHeard('oye miku')"), false);
  console.log('Listener OK: pregunta hablada personalizada, órdenes ASR reales, números hablados, un turno por llamada, espera, permisos y liberación del micrófono.');
}
run().then(() => { clearTimeout(deadline); app.exit(0); }).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
