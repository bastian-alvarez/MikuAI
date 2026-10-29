'use strict';
const fs = require('node:fs');
const path = require('node:path');

const EXPRESSION_IDS = Object.freeze(['normal', 'shy', 'blush', 'happy', 'surprised', 'pout', 'sleepy']);
const DEFAULTS = Object.freeze({ name: '', voice: '', pitch: 1.12, rate: 0, volume: 0.8, muted: false, alwaysOnTop: true, expression: 'normal' });

function normalizeSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const numeric = (key, min, max) => Number.isFinite(source[key])
    ? Math.max(min, Math.min(max, source[key])) : DEFAULTS[key];
  return {
    name: typeof source.name === 'string' ? source.name.replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 40) : '',
    voice: typeof source.voice === 'string' ? source.voice.slice(0, 150) : '',
    pitch: numeric('pitch', 0.8, 1.4),
    rate: Math.round(numeric('rate', -3, 5)),
    volume: numeric('volume', 0, 1),
    muted: typeof source.muted === 'boolean' ? source.muted : DEFAULTS.muted,
    alwaysOnTop: typeof source.alwaysOnTop === 'boolean' ? source.alwaysOnTop : DEFAULTS.alwaysOnTop,
    expression: EXPRESSION_IDS.includes(source.expression) ? source.expression : DEFAULTS.expression,
  };
}

function greeting(name) {
  const clean = normalizeSettings({ name }).name;
  return clean ? `¡Bienvenido, ${clean}-sama!` : '¡Hola! Soy Miku. ¿Cómo te llamas?';
}

function loadSettings(file) {
  try { return normalizeSettings(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return { ...DEFAULTS };
    throw error;
  }
}

function saveSettings(file, value) {
  const settings = normalizeSettings(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(settings, null, 2), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
  return settings;
}

function visiblePosition(position, displays, size) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return undefined;
  const area = displays.find(({ workArea: a }) => position.x + size.width / 2 >= a.x && position.x + size.width / 2 <= a.x + a.width && position.y + 40 >= a.y && position.y + 40 <= a.y + a.height)?.workArea;
  if (!area) return undefined;
  return { x: Math.round(Math.max(area.x, Math.min(position.x, area.x + Math.max(0, area.width - size.width)))), y: Math.round(Math.max(area.y, Math.min(position.y, area.y + Math.max(0, area.height - size.height)))) };
}

module.exports = { DEFAULTS, normalizeSettings, greeting, loadSettings, saveSettings, visiblePosition };
