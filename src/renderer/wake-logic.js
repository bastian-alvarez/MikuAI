(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MikuWake = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function isWakePhrase(value) {
    if (typeof value !== 'string' || value.length > 100) return false;
    const text = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().replace(/\s+/g, ' ');
    // Spanish ASR can spell the name phonetically as "mi cu" or "mico".
    // Require the whole phrase: ordinary occurrences of "oye" never activate it.
    return /^oye (?:miku|micu|mico|mi cu|mi q|mi mico)$/.test(text);
  }
  class WakeGate {
    constructor(cooldown = 3000) { this.cooldown = cooldown; this.lastWake = -Infinity; }
    accept(text, enabled, now = Date.now()) {
      if (!enabled || !isWakePhrase(text) || now - this.lastWake < this.cooldown) return false;
      this.lastWake = now;
      return true;
    }
  }
  class VoiceCommandWindow {
    constructor(duration = 12000) { this.duration = duration; this.cancel(); }
    begin(id, now = Date.now()) { this.id = id; this.phase = 'prompting'; this.expiresAt = now + 45000; }
    arm(id, now = Date.now()) {
      if (!id || id !== this.id || this.phase !== 'prompting' || now >= this.expiresAt) return null;
      this.phase = 'command';
      this.expiresAt = now + this.duration;
      return this.expiresAt;
    }
    consume(id, now = Date.now()) {
      if (!id || id !== this.id || this.phase !== 'command' || now >= this.expiresAt) return false;
      this.cancel();
      return true;
    }
    cancel(id) { if (id && id !== this.id) return; this.id = null; this.phase = 'idle'; this.expiresAt = 0; }
  }
  return { isWakePhrase, WakeGate, VoiceCommandWindow };
});
