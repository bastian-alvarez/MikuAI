'use strict';
const { greeting, normalizeSettings } = require('./core.cjs');

const EXPRESSIONS = Object.freeze([
  { id: 'normal', label: 'Normal', icon: '♡', file: 'miku.png' },
  { id: 'shy', label: 'Tímida', icon: '◡', file: 'expressions/shy.png' },
  { id: 'blush', label: 'Sonrojada', icon: '⁄⁄⁄', file: 'expressions/blush.png' },
  { id: 'happy', label: 'Feliz', icon: '✧', file: 'expressions/happy.png' },
  { id: 'surprised', label: 'Sorprendida', icon: '!', file: 'expressions/surprised.png' },
  { id: 'pout', label: 'Enfurruñada', icon: '⌢', file: 'expressions/pout.png' },
  { id: 'sleepy', label: 'Soñolienta', icon: 'zZ', file: 'expressions/sleepy.png' },
]);
const EXAMPLES = Object.freeze([
  { label: 'Saludar', command: 'Hola, Miku' },
  { label: 'Cambiar mi nombre', command: 'Llámame Bastián' },
  { label: 'Ponerse tímida', command: 'Ponte tímida' },
  { label: 'Sonrojarse', command: 'Sonrójate' },
  { label: 'Alegrarse', command: 'Ponte feliz' },
  { label: 'Sorprenderse', command: 'Ponte sorprendida' },
  { label: 'Enfurruñarse', command: 'Ponte enfurruñada' },
  { label: 'Descansar', command: 'Descansa' },
  { label: 'Volver al inicio', command: 'Expresión normal' },
  { label: 'Decir la hora', command: '¿Qué hora es?' },
  { label: 'Decir la fecha', command: '¿Qué día es hoy?' },
  { label: 'Repetir una frase', command: 'Di que tengas un lindo día' },
  { label: 'Ajustar volumen', command: 'Volumen al 30%' },
  { label: 'Subir volumen', command: 'Sube el volumen' },
  { label: 'Bajar volumen', command: 'Baja el volumen' },
  { label: 'Silenciar', command: 'Silencio' },
  { label: 'Activar voz', command: 'Activa la voz' },
  { label: 'Hablar más rápido', command: 'Habla más rápido' },
  { label: 'Hablar más despacio', command: 'Habla más despacio' },
  { label: 'Fijar sobre ventanas', command: 'Siempre visible' },
  { label: 'Desfijar ventana', command: 'Desactiva siempre visible' },
  { label: 'Abrir ajustes', command: 'Abre ajustes' },
  { label: 'Ocultarse', command: 'Ocúltate' },
]);
const fold = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const moods = { normal: 'normal', original: 'normal', timida: 'shy', timido: 'shy', sonrojada: 'blush', sonrojado: 'blush', feliz: 'happy', alegre: 'happy', sorprendida: 'surprised', sorprendido: 'surprised', enfurrunada: 'pout', enfadada: 'pout', enojada: 'pout', puchero: 'pout', somnolienta: 'sleepy', sonolienta: 'sleepy', dormida: 'sleepy', sleepy: 'sleepy' };
const moodReplies = { normal: '¡Ya estoy de vuelta! ♡', shy: 'E-eh… me da un poquito de vergüenza.', blush: '¡A-ah! Me hiciste sonrojar…', happy: '¡Yay! Me alegra estar contigo. ♡', surprised: '¡¿Eh?! ¡Eso sí que no me lo esperaba!', pout: '¡Hmph! Estoy haciendo un pequeño puchero.', sleepy: 'Mmm… cinco minutitos más…' };
const moodActions = { sonrojate: 'blush', descansa: 'sleepy', sonrie: 'happy', sorprendete: 'surprised', 'haz un puchero': 'pout', 'vuelve a la normalidad': 'normal' };

function interpretCommand(input, settings, now = new Date()) {
  const unknown = text => ({ recognized: false, text: text || 'Todavía no entiendo esa orden. Pulsa «Órdenes» para ver ejemplos.', speak: false });
  if (typeof input !== 'string' || input.length > 180) return unknown('Escribe una orden de hasta 180 caracteres.');
  const raw = input.replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ');
  if (!raw) return unknown('Escribe una orden para empezar.');
  // Full-sentence matching prevents accidental substring actions and shell execution.
  const clean = raw.replace(/^(?:miku[, :]\s*|por favor[, :]?\s*)+/i, '').replace(/[, ]+por favor[.!?]*$/i, '').replace(/[¿?¡!]+/g, '').replace(/[.]+$/, '').trim();
  const text = fold(clean);
  const reply = (message, patch, extra = {}) => ({ recognized: true, text: message, speak: true, ...(patch ? { patch } : {}), ...extra });
  if (/^(?:hola(?:,? miku)?|saluda(?:me)?|buenos dias|buenas tardes|buenas noches)$/.test(text)) return reply(greeting(settings.name), { expression: 'happy' });
  const rename = clean.match(/^(?:me llamo|mi nombre es|ll[aá]mame)\s+(.+)$/i);
  if (rename) {
    const name = normalizeSettings({ name: rename[1] }).name;
    if (!name) return unknown('Dime qué nombre quieres que use.');
    return reply(greeting(name), { name, expression: 'happy' });
  }
  const mood = text.replace(/^(?:ponte|expresion|muestra(?:me)?(?: tu)?(?: expresion)?|cambia(?: tu)? expresion a)\s+/, '');
  const expression = Object.hasOwn(moods, mood) ? moods[mood] : Object.hasOwn(moodActions, text) ? moodActions[text] : null;
  if (expression) return reply(moodReplies[expression], { expression });
  if (/^(?:que hora es|dime la hora|hora)$/.test(text)) return reply(`Son las ${new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}.`);
  if (/^(?:que dia es(?: hoy)?|que fecha es(?: hoy)?|dime la fecha|fecha)$/.test(text)) return reply(`Hoy es ${new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}.`);
  if (/^(?:silencio|silenciate|silenciar|callate|desactiva(?: la)? voz)$/.test(text)) return reply('De acuerdo, estaré en silencio. ♡', { muted: true }, { speak: false });
  if (/^(?:activa(?: la)? voz|habla de nuevo|quita el silencio)$/.test(text)) return reply('¡Ya puedes escucharme otra vez!', { muted: false });
  const volume = text.match(/^(?:(?:pon|ajusta|cambia)(?: el)? )?volumen(?: al| a)?\s+(\d{1,3})\s*(?:%|por ciento)?$/);
  if (volume) {
    const value = Number(volume[1]);
    if (value > 100) return unknown('El volumen debe estar entre 0 y 100 %.');
    return reply(`Volumen al ${value} %.`, { volume: value / 100 });
  }
  if (/^(?:sube|baja)(?: el)? volumen$/.test(text)) {
    const value = Math.round(Math.max(0, Math.min(1, settings.volume + (text.startsWith('sube') ? 0.1 : -0.1))) * 100);
    return reply(`Volumen al ${value} %.`, { volume: value / 100 });
  }
  if (/^habla mas (?:rapido|despacio|lento)$/.test(text)) {
    const rate = Math.max(-3, Math.min(5, settings.rate + (text.endsWith('rapido') ? 1 : -1)));
    return reply(text.endsWith('rapido') ? '¡Hablaré un poquito más rápido!' : 'Hablaré un poquito más despacio.', { rate });
  }
  if (/^(?:siempre visible|activa siempre visible|mantente (?:siempre )?visible|quedate encima)$/.test(text)) return reply('Me quedaré sobre las otras ventanas.', { alwaysOnTop: true });
  if (/^(?:desactiva siempre visible|deja de estar siempre visible|no estes siempre visible)$/.test(text)) return reply('He desactivado «Siempre visible».', { alwaysOnTop: false });
  if (/^(?:ayuda|ordenes|que puedes hacer|muestra(?:me)? (?:las )?ordenes)$/.test(text)) return reply('Puedes cambiar mi expresión, pedirme la hora, ajustar mi voz y más. Elige un ejemplo.', null, { action: 'help', speak: false });
  if (/^(?:ajustes|configuracion|abre (?:los )?ajustes)$/.test(text)) return reply('Vamos a dejar todo a tu gusto.', null, { action: 'settings', speak: false });
  if (/^(?:ocultate|escondete|ocultar)$/.test(text)) return reply('Me oculto. Puedes volver a mostrarme desde la bandeja o con Ctrl + Alt + M.', null, { action: 'hide', speak: false });
  const echo = clean.match(/^(?:di|repite)\s+(.+)$/i);
  if (echo) return reply(echo[1]);
  return unknown();
}
module.exports = { EXPRESSIONS, EXAMPLES, interpretCommand };
