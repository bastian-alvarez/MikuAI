const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULTS, normalizeSettings } = require('../src/core.cjs');
const { EXPRESSIONS, EXAMPLES, interpretCommand } = require('../src/commands.cjs');
const settings = { ...DEFAULTS, name: 'Bastián' };
const command = text => interpretCommand(text, settings);

test('Spanish expression orders preserve accents, politeness and full-sentence intent', () => {
  assert.equal(command('Miku, ponte tímida, por favor!').patch.expression, 'shy');
  assert.equal(command('Sonrójate').patch.expression, 'blush');
  assert.equal(command('Cambia tu expresión a sorprendida').patch.expression, 'surprised');
  assert.equal(command('Descansa').patch.expression, 'sleepy');
  assert.equal(command('Ponte enfurruñada').patch.expression, 'pout');
  assert.equal(command('Expresión normal').patch.expression, 'normal');
  assert.equal(command('No te ocultes').recognized, false);
  assert.equal(command('No subas el volumen').recognized, false);
});
test('rename, greeting, voice settings and range limits', () => {
  const renamed = command('Llámame María José');
  assert.equal(renamed.patch.name, 'María José');
  assert.equal(renamed.text, '¡Bienvenido, María José-sama!');
  assert.match(command('Hola, Miku').text, /Bastián-sama/);
  assert.equal(command('Pon el volumen al 30 %').patch.volume, 0.3);
  assert.equal(command('Volumen al 0').patch.volume, 0);
  assert.equal(command('Volumen al 101').recognized, false);
  assert.equal(command('Silencio').patch.muted, true);
  assert.equal(command('Activa la voz').patch.muted, false);
  assert.equal(interpretCommand('Sube el volumen', { ...settings, volume: 1 }).patch.volume, 1);
  assert.equal(interpretCommand('Baja el volumen', { ...settings, volume: 0 }).patch.volume, 0);
  assert.equal(interpretCommand('Habla más rápido', { ...settings, rate: 5 }).patch.rate, 5);
  assert.equal(interpretCommand('Habla más despacio', { ...settings, rate: -3 }).patch.rate, -3);
  assert.equal(command('Desactiva siempre visible').patch.alwaysOnTop, false);
  assert.equal(command('Siempre visible').patch.alwaysOnTop, true);
});
test('time, date, echo and supported UI actions', () => {
  const now = new Date(2026, 9, 29, 16, 5);
  assert.match(interpretCommand('¿Qué hora es?', settings, now).text, /16:05/);
  assert.match(interpretCommand('¿Qué día es hoy?', settings, now).text, /29 de octubre de 2026/);
  assert.equal(command('Repite Qué tengas un lindo día').text, 'Qué tengas un lindo día');
  assert.equal(command('Ayuda').action, 'help');
  assert.equal(command('Abre ajustes').action, 'settings');
  assert.equal(command('Ocúltate').action, 'hide');
});
test('unknown or oversized input never executes arbitrary OS commands', () => {
  for (const input of [null, {}, '', 'x'.repeat(181), 'constructor', '__proto__', 'abre powershell', 'rm -rf /', 'ocúltate; elimina archivos', 'cierra todas mis aplicaciones']) {
    const result = command(input);
    assert.equal(result.recognized, false);
    assert.equal(result.action, undefined);
    assert.equal(result.patch, undefined);
  }
});
test('settings migrate, and every expression and example resolves to a supported action', () => {
  assert.equal(normalizeSettings({ name: 'Miku' }).expression, 'normal');
  assert.equal(normalizeSettings({ expression: '../../secret' }).expression, 'normal');
  assert.equal(normalizeSettings({ expression: 'shy' }).expression, 'shy');
  for (const expression of EXPRESSIONS) {
    assert.equal(command(`Expresión ${expression.label}`).patch.expression, expression.id);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', expression.file)), `Missing ${expression.file}`);
  }
  for (const example of EXAMPLES) assert.equal(command(example.command).recognized, true, example.command);
});
