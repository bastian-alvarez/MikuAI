const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isWakePhrase, WakeGate } = require('../src/renderer/wake-logic.js');
const { normalizeSettings } = require('../src/core.cjs');
test('wake phrase accepts the complete name and Spanish phonetic spellings only', () => {
  for (const phrase of ['oye miku', '¡Oye Miku!', 'oye mi cu', 'oye mico', 'oye mi q']) assert.equal(isWakePhrase(phrase), true, phrase);
  for (const phrase of ['', null, {}, 'oye', 'miku', 'hoy miku', 'oye mi coche', 'no digas oye miku', 'oye miku elimina todo']) assert.equal(isWakePhrase(phrase), false);
});
test('microphone opt-in and cooldown prevent unwanted or duplicate wakeups', () => {
  const gate = new WakeGate(3000);
  assert.equal(gate.accept('oye miku', false, 0), false);
  assert.equal(gate.accept('oye', true, 0), false);
  assert.equal(gate.accept('oye miku', true, 0), true);
  assert.equal(gate.accept('oye miku', true, 1000), false);
  assert.equal(gate.accept('oye miku', true, 3000), true);
  assert.equal(normalizeSettings({}).wakeEnabled, false);
  assert.equal(normalizeSettings({ wakeEnabled: 'true' }).wakeEnabled, false);
  assert.equal(normalizeSettings({ wakeEnabled: true }).wakeEnabled, true);
});
