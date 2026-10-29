const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, normalizeSettings, greeting, loadSettings, saveSettings, visiblePosition } = require('../src/core.cjs');

test('first run, personalization and restart preserve the greeting', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikuai-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.json');
  assert.deepEqual(loadSettings(file), DEFAULTS);
  assert.match(greeting(loadSettings(file).name), /¿Cómo te llamas\?/);
  saveSettings(file, { ...DEFAULTS, name: '  Bastián  ', voice: 'Prueba', muted: true });
  assert.equal(greeting(loadSettings(file).name), '¡Bienvenido, Bastián-sama!');
  assert.equal(loadSettings(file).muted, true);
  assert.equal(loadSettings(file).voice, 'Prueba');
});
test('corrupt settings recover; invalid values cannot escape limits', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikuai-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{broken');
  assert.deepEqual(loadSettings(file), DEFAULTS);
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
  const value = normalizeSettings({ name: ' <Miku>\u0000  sama ', volume: 500, pitch: NaN, rate: -100, muted: 'false', alwaysOnTop: false, extra: 'ignored' });
  assert.equal(value.name, 'Miku sama');
  assert.equal(value.volume, 1);
  assert.equal(value.pitch, DEFAULTS.pitch);
  assert.equal(value.rate, -3);
  assert.equal(value.muted, false);
  assert.equal(value.alwaysOnTop, false);
  assert.equal('extra' in value, false);
});
test('restoring on disconnected screens falls back, and edge positions stay accessible', () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const size = { width: 400, height: 700 };
  assert.equal(visiblePosition({ x: -1600, y: 300 }, displays, size), undefined);
  assert.deepEqual(visiblePosition({ x: 1700, y: 1000 }, displays, size), { x: 1520, y: 380 });
  assert.equal(visiblePosition({ x: '100', y: 0 }, displays, size), undefined);
});
