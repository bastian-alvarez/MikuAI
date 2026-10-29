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
    return /^oye (?:miku|micu|mico|mi cu|mi q)$/.test(text);
  }
  class WakeGate {
    constructor(cooldown = 3000) { this.cooldown = cooldown; this.lastWake = -Infinity; }
    accept(text, enabled, now = Date.now()) {
      if (!enabled || !isWakePhrase(text) || now - this.lastWake < this.cooldown) return false;
      this.lastWake = now;
      return true;
    }
  }
  return { isWakePhrase, WakeGate };
});
