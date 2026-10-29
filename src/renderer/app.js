'use strict';
const $ = id => document.getElementById(id);
let settings, audio, audioUrl, speechGeneration = 0, speaking = false, returnFocus;

function errorMessage(message = '') { $('error').textContent = message; $('error').hidden = !message; }
function stopAudio() {
  speechGeneration++;
  if (audio) { audio.pause(); audio.onended = null; audio.onerror = null; audio = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  speaking = false;
  document.body.classList.remove('speaking');
}
function setMessage() {
  $('message').textContent = settings.name ? `¡Bienvenido, ${settings.name}-sama!` : '¡Hola! Soy Miku.';
  $('subtitle').textContent = settings.name ? 'Qué bueno tenerte por aquí. ♡' : 'Me alegra conocerte. ¿Cómo te llamas?';
  $('name-form').hidden = Boolean(settings.name);
  $('greet').disabled = !settings.name;
  $('mute').setAttribute('aria-pressed', String(settings.muted));
  $('mute').textContent = settings.muted ? '♩' : '♫';
  $('mute').setAttribute('aria-label', settings.muted ? 'Activar voz' : 'Silenciar voz');
  $('mute').title = settings.muted ? 'Activar voz' : 'Silenciar voz';
}
async function speak(kind) {
  stopAudio();
  errorMessage();
  if (settings.muted) return;
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
    audio.onended = () => { stopAudio(); $('greet').disabled = !settings.name; };
    audio.onerror = () => { stopAudio(); errorMessage('No pude reproducir la voz. Prueba otra voz en Ajustes.'); };
    await audio.play();
    document.body.classList.add('speaking');
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

window.miku.onSettings(value => {
  settings = value;
  if (settings.muted) stopAudio();
  setMessage();
});
window.miku.onPause(stopAudio);
$('name-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    settings = await window.miku.save({ name: $('first-name').value });
    setMessage();
    await speak('welcome');
  } catch (error) { errorMessage(error.message); }
});
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    settings = await window.miku.save({ name: $('name').value, voice: $('voice').value, pitch: Number($('pitch').value), rate: Number($('rate').value), volume: Number($('volume').value), alwaysOnTop: $('always-on-top').checked });
    closeSettings();
    setMessage();
    await speak('welcome');
  } catch (error) { $('save-error').textContent = error.message; $('save-error').hidden = false; }
});
$('greet').addEventListener('click', () => speak('welcome'));
$('mute').addEventListener('click', async () => {
  try { settings = await window.miku.save({ muted: !settings.muted }); setMessage(); }
  catch { errorMessage('No pude guardar el ajuste.'); }
});
$('settings-button').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('hide').addEventListener('click', () => window.miku.hide());
$('quit').addEventListener('click', () => window.miku.quit());
for (const id of ['pitch', 'rate', 'volume']) $(id).addEventListener('input', rangeLabels);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (!$('settings').hidden) closeSettings(); else window.miku.hide(); }
  if (event.key === 'Tab' && !$('settings').hidden) {
    const controls = [...$('settings').querySelectorAll('button, input, select')];
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
  for (const voice of result.voices) {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} · ${voice.language}`;
    $('voice').append(option);
  }
  if (!result.shortcutAvailable) $('shortcut-hint').textContent = 'ARRÁSTRAME · PUEDES MOSTRARME DESDE LA BANDEJA';
  setMessage();
  if (!settings.name) $('first-name').focus();
  if (result.voiceError) errorMessage(result.voiceError);
  else await speak(settings.name ? 'welcome' : 'introduction');
}
init().catch(() => { $('message').textContent = 'No pude iniciar.'; errorMessage('Cierra MikuAI desde la bandeja e intenta abrirla otra vez.'); });
