const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createConversationService } = require('../src/services/conversation.service.cjs');

test('parseAiResponse extracts JSON reply and emotion', () => {
  const { parseAiResponse } = require('../src/services/conversation.service.cjs');
  const result = parseAiResponse('{"reply":"Hola, me alegra verte.","emotion":"happy"}');
  assert.equal(result.reply, 'Hola, me alegra verte.');
  assert.equal(result.emotion, 'happy');
});

test('parseAiResponse falls back to plain text', () => {
  const { parseAiResponse } = require('../src/services/conversation.service.cjs');
  const result = parseAiResponse('Hola, ¿cómo estás?');
  assert.equal(result.reply, 'Hola, ¿cómo estás?');
  assert.equal(result.emotion, 'neutral');
});

test('conversation service rejects empty input', async () => {
  const service = createConversationService({ providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"hola","emotion":"happy"}' }) }) });
  const result = await service.chat('', {});
  assert.equal(result.ok, false);
});

test('conversation service returns provider error when unavailable', async () => {
  const service = createConversationService({ providerFactory: () => ({ isAvailable: async () => ({ available: false, error: 'sin conexión' }), chat: async () => ({ text: '' }) }) });
  const result = await service.chat('hola', {});
  assert.equal(result.ok, false);
  assert.match(result.error, /sin conexión/);
});

test('conversation service returns parsed reply', async () => {
  const service = createConversationService({ providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"¡Hola!","emotion":"happy"}' }) }) });
  const result = await service.chat('hola', { name: 'Bastián' });
  assert.equal(result.ok, true);
  assert.equal(result.text, '¡Hola!');
  assert.equal(result.emotion, 'happy');
  assert.equal(result.expression, 'happy');
});