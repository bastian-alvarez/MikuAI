const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MemoryService } = require('../src/services/memory/memory.service.cjs');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'miku-memory-')); }

test('memory saves and retrieves personal memories', () => {
  const dir = tmpDir();
  const m = new MemoryService({ dataDir: dir, enabled: true });
  const r = m.addPersonalMemory('me llamo Edes');
  assert.equal(r.ok, true);
  assert.equal(r.duplicate, false);
  assert.equal(m.getPersonalMemories().length, 1);
  m.save();
  const m2 = new MemoryService({ dataDir: dir, enabled: true });
  assert.equal(m2.getPersonalMemories().length, 1);
  assert.equal(m2.getPersonalMemories()[0].text, 'me llamo Edes');
});

test('memory avoids duplicates', () => {
  const dir = tmpDir();
  const m = new MemoryService({ dataDir: dir, enabled: true });
  m.addPersonalMemory('me gusta la música');
  const r = m.addPersonalMemory('ME GUSTA LA MÚSICA');
  assert.equal(r.duplicate, true);
  assert.equal(m.getPersonalMemories().length, 1);
});

test('memory remove and clear', () => {
  const dir = tmpDir();
  const m = new MemoryService({ dataDir: dir, enabled: true });
  const r = m.addPersonalMemory('proyecto videojuego');
  m.removePersonalMemory(r.memory.id);
  assert.equal(m.getPersonalMemories().length, 0);
  m.addPersonalMemory('otro');
  m.clearPersonalMemories();
  assert.equal(m.getPersonalMemories().length, 0);
});

test('memory history and clear', () => {
  const dir = tmpDir();
  const m = new MemoryService({ dataDir: dir, enabled: true });
  m.addHistory('user', 'hola');
  m.addHistory('assistant', 'hola!');
  assert.equal(m.getRecentHistory(10).length, 2);
  m.clearHistory();
  assert.equal(m.getRecentHistory(10).length, 0);
});

test('memory can be disabled', () => {
  const dir = tmpDir();
  const m = new MemoryService({ dataDir: dir, enabled: false });
  const r = m.addPersonalMemory('secreto');
  assert.equal(r.ok, false);
  assert.equal(m.getPersonalMemories().length, 0);
  m.setEnabled(true);
  assert.equal(m.addPersonalMemory('ahora sí').ok, true);
});