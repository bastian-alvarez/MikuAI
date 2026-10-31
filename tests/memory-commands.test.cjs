const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MemoryService } = require('../src/services/memory/memory.service.cjs');
const { createConversationService } = require('../src/services/conversation.service.cjs');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'miku-memcmd-')); }

function intentMock(intentJson, chatJson) {
  return {
    isAvailable: async () => ({ available: true }),
    chat: async (messages) => {
      const system = messages?.[0]?.content || '';
      if (system.includes('clasificador')) return { text: JSON.stringify(intentJson) };
      return { text: JSON.stringify(chatJson || { reply: 'ok', emotion: 'happy' }) };
    }
  };
}

test('memory query returns only stored memories', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me llamo Edes');
  memory.addPersonalMemory('me gusta crear videojuegos');
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"inventado","emotion":"happy"}' }) }) });
  const result = await service.chat('¿Qué recuerdas de mí?', { memoryEnabled: true });
  assert.equal(result.ok, true);
  assert.match(result.text, /Edes/);
  assert.match(result.text, /videojuegos/);
  assert.doesNotMatch(result.text, /narrativa/);
});

test('memory query with no memories does not invent', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"inventado","emotion":"happy"}' }) }) });
  const result = await service.chat('¿Qué sabes de mí?', { memoryEnabled: true });
  assert.equal(result.ok, true);
  assert.match(result.text, /No tengo recuerdos personales/);
});

test('remember command stores and reports correctly', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r1 = await service.chat('Recuerda que me llamo Edes', { memoryEnabled: true });
  assert.equal(r1.ok, true);
  assert.match(r1.text, /Recordaré que me llamo Edes/);
  const r2 = await service.chat('¿Te acuerdas de mi nombre?', { memoryEnabled: true });
  assert.match(r2.text, /me llamo Edes/);
});

test('forget with different wording removes the right memory', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me gusta crear videojuegos');
  memory.addPersonalMemory('me llamo Edes');
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r = await service.chat('olvida que me gustan los videojuegos', { memoryEnabled: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /He olvidado: me gusta crear videojuegos/);
  const remaining = memory.getPersonalMemories().map(m => m.text);
  assert.ok(!remaining.includes('me gusta crear videojuegos'));
  assert.ok(remaining.includes('me llamo Edes'));
});

test('forget nonexistent memory reports not found', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me llamo Edes');
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r = await service.chat('olvida que me gusta la música', { memoryEnabled: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /No tenía ese recuerdo guardado/);
  assert.equal(memory.getPersonalMemories().length, 1);
});

test('intent save via natural language', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => intentMock({ intent: 'save', memory: 'me llamo Edes', confidence: 0.95 }, { reply: 'ok', emotion: 'happy' }) });
  const r = await service.chat('Por cierto, me llamo Edes', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
  assert.match(r.text, /Recordaré que me llamo Edes/);
  assert.equal(memory.getPersonalMemories().length, 1);
});

test('intent delete via natural language', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me gusta crear videojuegos');
  const service = createConversationService({ memory, providerFactory: () => intentMock({ intent: 'delete', memory: 'videojuegos', confidence: 0.95 }, { reply: 'ok', emotion: 'happy' }) });
  const r = await service.chat('Ya no quiero que recuerdes mi gusto por los videojuegos', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
  assert.match(r.text, /He olvidado/);
  assert.equal(memory.getPersonalMemories().length, 0);
});

test('intent update via natural language', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me gusta crear videojuegos');
  const service = createConversationService({ memory, providerFactory: () => intentMock({ intent: 'update', memory: 'me gustan los videojuegos indie', confidence: 0.9 }, { reply: 'ok', emotion: 'happy' }) });
  const r = await service.chat('Ya no me gustan tanto los videojuegos, prefiero los indie', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
  assert.match(r.text, /actualizado/);
  assert.equal(memory.getPersonalMemories()[0].text, 'me gustan los videojuegos indie');
});

test('intent query returns real memories', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me llamo Edes');
  const service = createConversationService({ memory, providerFactory: () => intentMock({ intent: 'query', memory: null, confidence: 0.95 }, { reply: 'ok', emotion: 'happy' }) });
  const r = await service.chat('¿Qué sabes sobre mis gustos?', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
  assert.match(r.text, /me llamo Edes/);
});

test('low confidence asks for clarification', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => intentMock({ intent: 'delete', memory: 'videojuegos', confidence: 0.4 }, { reply: 'ok', emotion: 'happy' }) });
  const r = await service.chat('olvida los videojuegos', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
  assert.match(r.text, /claridad/);
  assert.equal(memory.getPersonalMemories().length, 0);
});

test('invalid JSON from intent falls back safely', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: 'not json' }) }) });
  const r = await service.chat('Hola Miku', { memoryEnabled: true, ollamaModel: 'llama3.2' });
  assert.equal(r.ok, true);
});

test('heuristic save personal statement', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: false }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r = await service.chat('Sí, me gusta crear videojuegos', { memoryEnabled: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /Recordaré que Sí, me gusta crear videojuegos/);
  assert.equal(memory.getPersonalMemories().length, 1);
});

test('heuristic delete natural phrase', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me gusta crear videojuegos');
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: false }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r = await service.chat('Ya no quiero que recuerdes mi gusto por los videojuegos', { memoryEnabled: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /He olvidado/);
  assert.equal(memory.getPersonalMemories().length, 0);
});

test('query phrase returns real memories', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  memory.addPersonalMemory('me llamo Edes');
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: false }), chat: async () => ({ text: '{"reply":"ok","emotion":"happy"}' }) }) });
  const r = await service.chat('¿Qué sabes sobre mí?', { memoryEnabled: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /me llamo Edes/);
});

test('normal chat still works with memory enabled', async () => {
  const dir = tmpDir();
  const memory = new MemoryService({ dataDir: dir, enabled: true });
  const service = createConversationService({ memory, providerFactory: () => ({ isAvailable: async () => ({ available: true }), chat: async () => ({ text: '{"reply":"Hola, ¿cómo estás?","emotion":"happy"}' }) }) });
  const result = await service.chat('Hola Miku', { memoryEnabled: true });
  assert.equal(result.ok, true);
  assert.equal(result.text, 'Hola, ¿cómo estás?');
});