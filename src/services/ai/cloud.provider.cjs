'use strict';

// Placeholder for future cloud providers. No network calls are implemented here.
function createCloudProvider(options = {}) {
  return {
    name: options.name || 'cloud',
    isAvailable: async () => ({ available: false, models: [], error: 'Proveedor en la nube no configurado todavía.' }),
    chat: async () => { throw new Error('Proveedor en la nube no disponible en esta etapa.'); }
  };
}

module.exports = { createCloudProvider };