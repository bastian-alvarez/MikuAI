'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

class MemoryService {
  constructor(options = {}) {
    this.dataDir = options.dataDir;
    this.enabled = options.enabled !== false;
    this.personalFile = path.join(this.dataDir, 'personal.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.personal = [];
    this.history = [];
    ensureDir(this.dataDir);
    this.load();
  }

  load() {
    const personal = readJson(this.personalFile, []);
    const history = readJson(this.historyFile, []);
    this.personal = Array.isArray(personal) ? personal.filter(item => item && typeof item.text === 'string') : [];
    this.history = Array.isArray(history) ? history.filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string') : [];
  }

  save() {
    ensureDir(this.dataDir);
    writeJsonAtomic(this.personalFile, this.personal);
    writeJsonAtomic(this.historyFile, this.history);
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  isEnabled() { return this.enabled; }

  normalize(text) {
    return String(text || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');
  }

  getPersonalMemories() {
    if (!this.enabled) return [];
    return this.personal.map(item => ({ ...item }));
  }

  addPersonalMemory(text) {
    if (!this.enabled) return { ok: false, error: 'La memoria está desactivada.' };
    const clean = String(text || '').replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 240);
    if (!clean) return { ok: false, error: 'Dime qué quieres que recuerde.' };
    const norm = this.normalize(clean);
    const existing = this.personal.find(item => this.normalize(item.text) === norm);
    if (existing) return { ok: true, duplicate: true, memory: { ...existing } };
    const memory = { id: crypto.randomUUID(), text: clean, createdAt: new Date().toISOString() };
    this.personal.push(memory);
    if (this.personal.length > 200) this.personal = this.personal.slice(-200);
    this.save();
    return { ok: true, duplicate: false, memory: { ...memory } };
  }

  removePersonalMemory(id) {
    if (!this.enabled) return { ok: false, error: 'La memoria está desactivada.' };
    const before = this.personal.length;
    this.personal = this.personal.filter(item => item.id !== id);
    if (this.personal.length === before) return { ok: false, error: 'No encontré ese recuerdo.' };
    this.save();
    return { ok: true };
  }

  updatePersonalMemory(id, text) {
    if (!this.enabled) return { ok: false, error: 'La memoria está desactivada.' };
    const clean = String(text || '').replace(/[\\p{C}<>]/gu, '').trim().replace(/\\s+/g, ' ').slice(0, 240);
    if (!clean) return { ok: false, error: 'Dime qué quieres recordar.' };
    const idx = this.personal.findIndex(item => item.id === id);
    if (idx === -1) return { ok: false, error: 'No encontré ese recuerdo.' };
    this.personal[idx].text = clean;
    this.personal[idx].updatedAt = new Date().toISOString();
    this.save();
    return { ok: true, memory: { ...this.personal[idx] } };
  }

  clearPersonalMemories() {
    this.personal = [];
    this.save();
    return { ok: true };
  }

  addHistory(role, content) {
    if (!this.enabled) return;
    const clean = String(content || '').trim().slice(0, 500);
    if (!clean) return;
    this.history.push({ id: crypto.randomUUID(), role, content: clean, createdAt: new Date().toISOString() });
    if (this.history.length > 500) this.history = this.history.slice(-500);
    this.save();
  }

  getRecentHistory(limit = 8) {
    if (!this.enabled) return [];
    const n = Math.max(0, Math.min(50, Number(limit) || 8));
    return this.history.slice(-n).map(item => ({ role: item.role, content: item.content }));
  }

  clearHistory() {
    this.history = [];
    this.save();
    return { ok: true };
  }

  getRelevantPersonal(query, limit = 20) {
    if (!this.enabled) return [];
    const q = this.normalize(query);
    const words = q.split(' ').filter(w => w.length > 2);
    let result = this.personal;
    if (q) {
      result = this.personal.filter(item => {
        const t = this.normalize(item.text);
        return t.includes(q) || words.some(w => t.includes(w));
      });
      if (result.length === 0) result = this.personal;
    }
    return result.slice(-limit).map(item => ({ ...item }));
  }

  findPersonalMemoryCandidates(query) {
    if (!this.enabled) return [];
    const stop = new Set(['me', 'te', 'que', 'los', 'las', 'el', 'la', 'un', 'una', 'y', 'o', 'de', 'a', 'en', 'con', 'para', 'por', 'gusta', 'gustan', 'gustar', 'crear', 'mi', 'tu']);
    const targetWords = this.normalize(query).split(' ').filter(w => w.length > 1);
    const meaningfulTarget = targetWords.filter(w => !stop.has(w));
    const keys = meaningfulTarget.length ? meaningfulTarget : targetWords;
    const candidates = this.personal.map(item => {
      const itemWords = this.normalize(item.text).split(' ').filter(w => w.length > 1);
      const meaningfulItem = itemWords.filter(w => !stop.has(w));
      const common = keys.filter(w => meaningfulItem.includes(w));
      const score = keys.length ? common.length / keys.length : 0;
      return { item: { ...item }, score, common };
    }).filter(c => c.common.length > 0 && (c.score >= 0.5 || c.common.some(w => w.length >= 5)));
    candidates.sort((a, b) => b.score - a.score || b.common.length - a.common.length);
    return candidates;
  }

  stats() {
    return { enabled: this.enabled, personalCount: this.personal.length, historyCount: this.history.length };
  }
}

module.exports = { MemoryService };