const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOllamaProvider } = require('../src/services/ai/ollama.provider.cjs');

test('ollama provider reports unavailable on connection error', async () => {
  const provider = createOllamaProvider({ baseUrl: 'http://127.0.0.1:1', model: 'llama3.2', fetch: async () => { throw new Error('ECONNREFUSED'); } });
  const status = await provider.isAvailable();
  assert.equal(status.available, false);
  assert.match(status.error, /No pude conectar/);
});

test('ollama provider chat succeeds with mocked fetch', async () => {
  const fetchMock = async (url, init) => {
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'llama3.2' }] }) };
    return { ok: true, json: async () => ({ message: { content: '{"reply":"Hola","emotion":"happy"}' } }) };
  };
  const provider = createOllamaProvider({ baseUrl: 'http://localhost:11434', model: 'llama3.2', fetch: fetchMock });
  const status = await provider.isAvailable();
  assert.equal(status.available, true);
  const result = await provider.chat([{ role: 'user', content: 'hola' }], { temperature: 0.5 });
  assert.match(result.text, /Hola/);
});

test('ollama provider requires model', async () => {
  const provider = createOllamaProvider({ baseUrl: 'http://localhost:11434', model: '', fetch: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(() => provider.chat([{ role: 'user', content: 'hola' }], {}), /No hay un modelo/);
});