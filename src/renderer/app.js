'use strict';
const $ = id => document.getElementById(id);
let settings, audio, audioUrl, speechGeneration = 0, speaking = false, returnFocus;
let expressions = [], expressionRequest = 0;
let microphoneState = { state: 'off', message: 'Micrófono apagado.' };
let listeningPreference = false;
let voiceTurnId = null, speechDone = null;
const listener = new MikuListener(status => {
  if (['off', 'error'].includes(status.state) && voiceTurnId) cancelVoiceTurn();
  microphoneState = status;
  renderMicrophone();
  window.miku.microphoneStatus(status).catch(() => {});
}, text => window.miku.wakeHeard(text), async text => {
  const id = voiceTurnId;
  voiceTurnId = null;
  if (id) await runCommand(text, id);
}, () => {
  cancelVoiceTurn();
  $('subtitle').textContent = 'No oí una orden. Di «oye Miku» para volver a llamar.';
});

function cancelVoiceTurn() {
  if (voiceTurnId) window.miku.endVoiceTurn(voiceTurnId).catch(() => {});
  voiceTurnId = null;
  listener.cancelCommand();
}

function renderMicrophone() {
  const labels = { off: 'Activar «oye Miku»', starting: 'Preparando escucha…', listening: 'Escuchando «oye Miku»', answering: 'Respondiendo…', command: microphoneState.message, error: 'Reintentar micrófono' };
  $('microphone').dataset.state = microphoneState.state;
  $('microphone-label').textContent = labels[microphoneState.state];
  $('microphone').setAttribute('aria-pressed', String(settings?.wakeEnabled || false));
  $('microphone').setAttribute('aria-label', microphoneState.state === 'error' ? 'Reintentar escucha por micrófono' : settings?.wakeEnabled ? 'Apagar escucha por micrófono' : 'Activar escucha por micrófono');
  $('microphone').title = microphoneState.message;
  $('microphone-detail').textContent = microphoneState.message;
  $('wake-enabled').checked = settings?.wakeEnabled || false;
}
function syncListening() {
  renderMicrophone();
  if (listeningPreference === settings.wakeEnabled) return;
  listeningPreference = settings.wakeEnabled;
  if (listeningPreference) listener.start(); else listener.stop();
}

function errorMessage(message = '') { $('error').textContent = message; $('error').hidden = !message; }
function stopAudio() {
  if (speechDone) { const done = speechDone; speechDone = null; done(false); }
  speechGeneration++;
  window.miku.stopSpeaking().catch(() => {});
  listener.output(false);
  if (audio) { audio.pause(); audio.onended = null; audio.onerror = null; audio = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  speaking = false;
  document.body.classList.remove('speaking');
}
function setMessage() {
  $('message').textContent = settings.name ? `¡Bienvenido, ${settings.name}-sama!` : '¡Hola! Soy Miku.';
  $('subtitle').textContent = settings.name ? 'Qué bueno tenerte por aquí. ♡' : 'Me alegra conocerte. ¿Cómo te llamas?';
  $('message').classList.remove('long-message');
  syncControls();
}
function syncControls() {
  $('name-form').hidden = Boolean(settings.name);
  $('command-form').hidden = !settings.name;
  $('greet').disabled = !settings.name;
  $('mute').setAttribute('aria-pressed', String(settings.muted));
  $('mute').textContent = settings.muted ? '♩' : '♫';
  $('mute').setAttribute('aria-label', settings.muted ? 'Activar voz' : 'Silenciar voz');
  $('mute').title = settings.muted ? 'Activar voz' : 'Silenciar voz';
  applyExpression();
}
function applyExpression() {
  const expression = expressions.find(item => item.id === settings.expression);
  if (!expression) return;
  const request = ++expressionRequest;
  const path = `../../assets/${expression.file}`;
  $('expression-label').textContent = expression.label;
  for (const button of $('expression-picker').children) button.setAttribute('aria-pressed', String(button.dataset.expression === expression.id));
  if ($('miku-art').getAttribute('src') === path) {
    $('miku-art').dataset.expression = expression.id;
    $('miku-art').alt = `Miku con expresión ${expression.label.toLowerCase()}`;
    return;
  }
  const image = new Image();
  image.onload = () => {
    if (request !== expressionRequest) return;
    $('miku-art').src = path;
    $('miku-art').alt = `Miku con expresión ${expression.label.toLowerCase()}`;
    $('miku-art').dataset.expression = expression.id;
  };
  image.onerror = () => { if (request === expressionRequest) errorMessage('No pude cargar esta expresión. La ilustración anterior sigue visible.'); };
  image.src = path;
}
async function runCommand(text, voiceId = null) {
  if (!voiceId) cancelVoiceTurn();
  stopAudio();
  errorMessage();
  $('send-command').disabled = true;
  try {
    const result = voiceId ? await window.miku.voiceCommand(voiceId, text) : await window.miku.command(text);
    if (result.accepted === false) { $('subtitle').textContent = 'Se acabó el tiempo. Di «oye Miku» para volver a llamar.'; return; }
    settings = result.settings;
    syncControls();
    $('message').textContent = result.text;
    $('message').classList.toggle('long-message', result.text.length > 55);
    $('subtitle').textContent = result.recognized ? 'A tus órdenes. ♡' : 'Estoy aprendiendo, paso a paso.';
    $('heard').textContent = voiceId ? `Te escuché: «${text}»` : '';
    $('heard').hidden = !voiceId;
    if (result.action === 'help') openHelp();
    else if (result.action === 'settings') openSettings();
    if (result.recognized) $('command').value = '';
    $('send-command').disabled = false;
    if (result.speak) await speak('reply');
  } catch { errorMessage('No pude completar esa orden. Inténtalo otra vez.'); }
  finally { $('send-command').disabled = false; }
}
async function speak(kind) {
  stopAudio();
  errorMessage();
  if (settings.muted) return false;
  listener.output(true);
  const generation = speechGeneration;
  speaking = true;
  $('greet').disabled = true;
  try {
    const result = await window.miku.speak(kind);
    if (generation !== speechGeneration || settings.muted) return;
    if (result.error) throw new Error(result.error);
    if (result.muted) return;
    const bytes = Uint8Array.from(atob(result.audio), c => c.charCodeAt(0));
    audioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    audio = new Audio(audioUrl);
    audio.volume = settings.volume;
    audio.preservesPitch = false;
    audio.playbackRate = settings.pitch;
    const completed = new Promise(resolve => { speechDone = resolve; });
    const finish = success => {
      if (generation !== speechGeneration) return;
      const done = speechDone;
      speechDone = null;
      stopAudio();
      $('greet').disabled = !settings.name;
      done?.(success);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => { finish(false); errorMessage('No pude reproducir la voz. Prueba otra voz en Ajustes.'); };
    await audio.play();
    document.body.classList.add('speaking');
    return await completed;
  } catch (error) {
    if (generation === speechGeneration) { stopAudio(); errorMessage(error.message || 'No pude reproducir la voz.'); }
  } finally {
    if (generation === speechGeneration) speaking = false;
    $('greet').disabled = !settings.name || speaking;
  }
}
function rangeLabels() {
  $('pitch-value').textContent = `${Number($('pitch').value).toFixed(2)}×`;
  $('rate-value').textContent = $('rate').value;
  $('volume-value').textContent = `${Math.round(Number($('volume').value) * 100)}%`;
}
function openSettings() {
  closeHelp(false);
  returnFocus = document.activeElement;
  $('name').value = settings.name;
  $('voice').value = settings.voice;
  $('pitch').value = settings.pitch;
  $('rate').value = settings.rate;
  $('volume').value = settings.volume;
  $('always-on-top').checked = settings.alwaysOnTop;
  $('save-error').hidden = true;
  rangeLabels();
  $('settings').hidden = false;
  $('settings-button').setAttribute('aria-expanded', 'true');
  $('name').focus();
}
function closeSettings() {
  $('settings').hidden = true;
  $('settings-button').setAttribute('aria-expanded', 'false');
  returnFocus?.focus();
}
function openHelp() {
  if (!$('settings').hidden) closeSettings();
  returnFocus = document.activeElement;
  $('help').hidden = false;
  $('help-button').setAttribute('aria-expanded', 'true');
  $('close-help').focus();
}
function closeHelp(restore = true) {
  $('help').hidden = true;
  $('help-button').setAttribute('aria-expanded', 'false');
  if (restore) returnFocus?.focus();
}

window.miku.onSettings(value => {
  const previousName = settings?.name;
  settings = value;
  if (settings.muted) stopAudio();
  if (previousName !== settings.name) setMessage(); else syncControls();
  syncListening();
});
window.miku.onPause(() => { cancelVoiceTurn(); stopAudio(); });
window.miku.onWake(async turn => {
  cancelVoiceTurn();
  voiceTurnId = turn.id;
  listener.beginPrompt();
  stopAudio();
  if (!$('help').hidden) closeHelp(false);
  if (!$('settings').hidden) closeSettings();
  $('message').textContent = turn.text;
  $('message').classList.remove('long-message');
  $('subtitle').textContent = 'Cuando termine de responder, dime una orden. ♡';
  $('heard').hidden = true;
  (settings.name ? $('command') : $('first-name')).focus();
  await speak('wake');
  if (voiceTurnId !== turn.id || !settings.wakeEnabled) return;
  const deadline = await window.miku.armVoiceTurn(turn.id);
  if (voiceTurnId !== turn.id) return;
  if (deadline) {
    listener.awaitCommand(deadline);
    $('subtitle').textContent = 'Te escucho. Puedes decir «ponte feliz» o «qué hora es».';
  } else cancelVoiceTurn();
});
async function setListening(enabled) {
  try {
    settings = await window.miku.save({ wakeEnabled: enabled });
    syncListening();
  } catch { errorMessage('No pude guardar el ajuste de micrófono.'); }
}
$('microphone').addEventListener('click', () => {
  if (microphoneState.state === 'error' && settings.wakeEnabled) listener.start();
  else setListening(!settings.wakeEnabled);
});
$('wake-enabled').addEventListener('change', () => setListening($('wake-enabled').checked));
window.addEventListener('beforeunload', () => listener.stop());
$('name-form').addEventListener('submit', async event => {
  event.preventDefault();
  cancelVoiceTurn();
  try {
    settings = await window.miku.save({ name: $('first-name').value });
    setMessage();
    await speak('welcome');
  } catch (error) { errorMessage(error.message); }
});
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  cancelVoiceTurn();
  try {
    settings = await window.miku.save({ name: $('name').value, voice: $('voice').value, pitch: Number($('pitch').value), rate: Number($('rate').value), volume: Number($('volume').value), alwaysOnTop: $('always-on-top').checked });
    closeSettings();
    setMessage();
    await speak('welcome');
  } catch (error) { $('save-error').textContent = error.message; $('save-error').hidden = false; }
});
$('greet').addEventListener('click', () => runCommand('saluda'));
$('command-form').addEventListener('submit', event => { event.preventDefault(); runCommand($('command').value); });
$('help-button').addEventListener('click', openHelp);
$('close-help').addEventListener('click', () => closeHelp());
$('mute').addEventListener('click', async () => {
  try { settings = await window.miku.save({ muted: !settings.muted }); syncControls(); }
  catch { errorMessage('No pude guardar el ajuste.'); }
});
$('settings-button').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('hide').addEventListener('click', () => window.miku.hide());
$('quit').addEventListener('click', () => window.miku.quit());
for (const id of ['pitch', 'rate', 'volume']) $(id).addEventListener('input', rangeLabels);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (!$('settings').hidden) closeSettings(); else if (!$('help').hidden) closeHelp(); else window.miku.hide(); }
  const panel = !$('settings').hidden ? $('settings') : !$('help').hidden ? $('help') : null;
  if (event.key === 'Tab' && panel) {
    const controls = [...panel.querySelectorAll('button, input, select')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
let interactive = true;
document.addEventListener('mousemove', event => {
  const next = Boolean(event.target.closest('.interactive'));
  if (next !== interactive) { interactive = next; window.miku.interactive(next).catch(() => {}); }
});
document.addEventListener('mouseleave', () => {
  interactive = false;
  window.miku.interactive(false).catch(() => {});
});

async function init() {
  const result = await window.miku.load();
  settings = result.settings;
  expressions = result.expressions;
  for (const expression of expressions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expression-button';
    button.dataset.expression = expression.id;
    button.textContent = expression.icon;
    button.title = expression.label;
    button.setAttribute('aria-label', `Expresión ${expression.label.toLowerCase()}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => runCommand(`Expresión ${expression.label}`));
    $('expression-picker').append(button);
  }
  for (const example of result.examples) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'example';
    const label = document.createElement('strong');
    label.textContent = example.label;
    const command = document.createElement('small');
    command.textContent = example.command;
    button.append(label, command);
    button.addEventListener('click', () => {
      closeHelp(false);
      if (!settings.name) {
        $('first-name').focus();
        errorMessage('Primero dime tu nombre para habilitar las órdenes.');
        return;
      }
      $('command').value = example.command;
      $('command').focus();
      $('command').select();
    });
    $('command-examples').append(button);
  }
  for (const voice of result.voices) {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} · ${voice.language}`;
    $('voice').append(option);
  }
  if (!result.shortcutAvailable) $('shortcut-hint').textContent = 'ARRÁSTRAME · PUEDES MOSTRARME DESDE LA BANDEJA';
  setMessage();
  syncListening();
  if (!settings.name) $('first-name').focus();
  if (result.voiceError) errorMessage(result.voiceError);
  else await speak(settings.name ? 'welcome' : 'introduction');
}
init().catch(() => { $('message').textContent = 'No pude iniciar.'; errorMessage('Cierra MikuAI desde la bandeja e intenta abrirla otra vez.'); });
