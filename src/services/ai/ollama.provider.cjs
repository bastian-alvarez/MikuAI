'use strict';

const DEFAULT_URL = 'http://127.0.0.1:11434';
const DEFAULT_TIMEOUT = 60000;

function normalizeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return DEFAULT_URL;
  return url.trim().replace(/\/+$/, '');
}

function createOllamaProvider(options = {}) {
  const baseUrl = normalizeUrl(options.baseUrl);
  const model = typeof options.model === 'string' ? options.model.trim() : '';
  const timeout = Number.isFinite(options.timeout) ? options.timeout : DEFAULT_TIMEOUT;
  const fetchFn = typeof options.fetch === 'function' ? options.fetch : fetch;

  async function request(pathname, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchFn(`${baseUrl}${pathname}`, { ...init, signal: controller.signal });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = new Error(text || `Ollama respondió con estado ${response.status}.`);
        error.code = 'HTTP_ERROR';
        error.status = response.status;
        throw error;
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  function modelMatches(availableModels, wanted) {
    if (!wanted) return false;
    if (availableModels.includes(wanted)) return true;
    if (!wanted.includes(':') && availableModels.includes(`${wanted}:latest`)) return true;
    return false;
  }

  async function isAvailable() {
    try {
      const response = await request('/api/tags', { method: 'GET' });
      const data = await response.json();
      const models = Array.isArray(data?.models) ? data.models.map(m => m?.name).filter(Boolean) : [];
      if (!model) {
        return { available: false, models, error: 'Selecciona y guarda un modelo en Ajustes.' };
      }
      if (!modelMatches(models, model)) {
        return { available: false, models, error: `El modelo "${model}" no está instalado. Disponibles: ${models.join(', ') || 'ninguno'}.` };
      }
      return { available: true, models };
    } catch (error) {
      return { available: false, models: [], error: friendlyError(error) };
    }
  }

  async function chat(messages, chatOptions = {}) {
    const chosenModel = (chatOptions.model || model || '').trim();
    if (!chosenModel) {
      const err = new Error('No hay un modelo de Ollama configurado. Elige uno en Ajustes.');
      err.code = 'NO_MODEL';
      throw err;
    }
    const body = {
      model: chosenModel,
      messages: Array.isArray(messages) ? messages : [],
      stream: false,
      options: {
        temperature: Number.isFinite(chatOptions.temperature) ? chatOptions.temperature : 0.7
      }
    };
    const response = await request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const err = new Error('Ollama devolvió una respuesta vacía.');
      err.code = 'EMPTY_RESPONSE';
      throw err;
    }
    return { text: content.trim(), raw: data };
  }

  return { name: 'ollama', baseUrl, model, isAvailable, chat };
}

function friendlyError(error) {
  if (!error) return 'No se pudo conectar con Ollama.';
  if (error.name === 'AbortError') return 'Ollama tardó demasiado en responder. Intenta otra vez.';
  const message = String(error.message || error);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message)) {
    return 'No pude conectar con Ollama. Comprueba que esté instalado y ejecutándose en http://127.0.0.1:11434.';
  }
  if (error.status === 404) return 'Ollama no encontró el modelo configurado. Descárgalo con "ollama pull <modelo>".';
  return message.slice(0, 200);
}

module.exports = { createOllamaProvider, friendlyError, DEFAULT_URL };