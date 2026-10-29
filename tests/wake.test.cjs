const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isWakePhrase, WakeGate, VoiceCommandWindow } = require('../src/renderer/wake-logic.js');
const { normalizeSettings, wakeQuestion } = require('../src/core.cjs');
test('wake phrase accepts the complete name and Spanish phonetic spellings only', () => {
  for (const phrase of ['oye miku', '¡Oye Miku!', 'oye mi cu', 'oye mico', 'oye mi q', 'oye mi mico']) assert.equal(isWakePhrase(phrase), true, phrase);
  for (const phrase of ['', null, {}, 'oye', 'miku', 'hoy miku', 'oye mi coche', 'no digas oye miku', 'oye miku elimina todo']) assert.equal(isWakePhrase(phrase), false);
});

test('personalized wake question and one spoken order per authorized turn', () => {
  assert.equal(wakeQuestion('  María José  '), '¿Qué necesitas, María José-sama?');
  assert.equal(wakeQuestion(''), '¿Qué necesitas?');
  const turn = new VoiceCommandWindow(12000);
  assert.equal(turn.consume('old', 0), false);
  turn.begin('first', 0);
  assert.equal(turn.consume('first', 1), false, 'Do not execute commands during the question');
  assert.equal(turn.arm('other', 1000), null);
  assert.equal(turn.arm('first', 1000), 13000);
  assert.equal(turn.consume('first', 12999), true);
  assert.equal(turn.consume('first', 12999), false, 'A second command needs a new wake phrase');
  turn.begin('second', 20000);
  turn.arm('second', 21000);
  assert.equal(turn.consume('second', 33000), false, 'Expired turns cannot execute');
  turn.cancel();
  turn.begin('third', 40000);
  turn.begin('fourth', 41000);
  turn.cancel('third');
  assert.equal(turn.arm('fourth', 42000), 54000, 'Cancelling an old turn cannot cancel a newer one');
  turn.cancel('fourth');
  assert.equal(turn.consume('fourth', 42001), false);
  turn.begin('stalled', 0);
  assert.equal(turn.arm('stalled', 45000), null, 'Abandoned questions expire too');
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
