'use strict';

// Contract for AI providers. Implementations must return { text, emotion, raw }.
function createProvider() {
  return {
    name: 'base',
    isAvailable: async () => false,
    chat: async () => { throw new Error('Not implemented'); }
  };
}

module.exports = { createProvider };