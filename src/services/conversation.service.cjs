'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CHARACTER_PATH = path.join(__dirname, '..', 'personality', 'miku.character.json');
const EMOTION_MAP_PATH = path.join(__dirname, '..', 'personality', 'emotion-map.json');

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function buildSystemPrompt(character, userName, memoryContext) {
  const base = character?.systemPrompt || 'Eres Miku, una compañera virtual amable.';
  const rules = Array.isArray(character?.styleRules) ? character.styleRules.join(' ') : '';
  const safety = Array.isArray(character?.safetyRules) ? character.safetyRules.join(' ') : '';
  const format = character?.responseFormat || '';
  const nameLine = userName ? `El nombre del usuario es ${userName}.` : '';
  const parts = [base, rules, safety, format, nameLine];
  if (memoryContext) parts.push(memoryContext);
  return parts.filter(Boolean).join('\n');
}

function parseAiResponse(content) {
  const allowed = new Set(['neutral', 'happy', 'shy', 'blush', 'surprised', 'pout', 'sleepy', 'concerned']);
  let reply = '';
  let emotion = 'neutral';
  if (typeof content !== 'string') return { reply: '', emotion };
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.reply === 'string') reply = parsed.reply.trim();
    if (parsed && typeof parsed.emotion === 'string' && allowed.has(parsed.emotion)) emotion = parsed.emotion;
    if (reply) return { reply, emotion };
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed.reply === 'string') reply = parsed.reply.trim();
      if (parsed && typeof parsed.emotion === 'string' && allowed.has(parsed.emotion)) emotion = parsed.emotion;
      if (reply) return { reply, emotion };
    } catch {}
  }
  const tagMatch = trimmed.match(/\[emotion:\s*([a-z]+)\]/i);
  if (tagMatch && allowed.has(tagMatch[1].toLowerCase())) emotion = tagMatch[1].toLowerCase();
  reply = trimmed.replace(/\[emotion:\s*[a-z]+\]/gi, '').trim();
  return { reply: reply || trimmed, emotion };
}

function createConversationService(options = {}) {
  const character = options.character || loadJson(CHARACTER_PATH, {});
  const emotionMap = options.emotionMap || loadJson(EMOTION_MAP_PATH, {});
  const memory = options.memory || null;
  const providerFactory = options.providerFactory;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[¿?¡!.,]/g, '').replace(/\s+/g, ' ');
  }

  async function interpretMemoryIntent(input, settings, provider) {
    if (!provider) return null;
    const availability = await provider.isAvailable();
    if (!availability?.available) return null;
    const system = `Eres un clasificador de intenciones para la memoria de Miku. Responde SOLO con JSON válido: {"intent":"save|delete|update|query|none","memory":string|null,"confidence":number}. No agregues texto fuera del JSON.

Reglas:
- "save": el usuario comparte información personal o preferencias sobre sí mismo (nombre, gustos, proyectos, etc.), aunque no diga "recuerda".
- "delete": el usuario pide olvidar, borrar o dejar de recordar algo.
- "update": el usuario corrige o cambia un recuerdo anterior.
- "query": el usuario pregunta qué recuerdas o sabes sobre él.
- "none": conversación normal sin información personal nueva ni instrucción de memoria.

Ejemplos:
Usuario: "Por cierto, me llamo Edes" -> {"intent":"save","memory":"me llamo Edes","confidence":0.95}
Usuario: "Sí, me gusta crear videojuegos" -> {"intent":"save","memory":"me gusta crear videojuegos","confidence":0.9}
Usuario: "Ya no quiero que recuerdes mi gusto por los videojuegos" -> {"intent":"delete","memory":"videojuegos","confidence":0.95}
Usuario: "¿Qué sabes sobre mí?" -> {"intent":"query","memory":null,"confidence":0.95}
Usuario: "Hola, ¿cómo estás?" -> {"intent":"none","memory":null,"confidence":0.9}`;

    try {
      const result = await provider.chat([{ role: 'system', content: system }, { role: 'user', content: input }], { model: settings?.ollamaModel, temperature: 0 });
      const content = String(result?.text || '').trim();
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : content);
      const intent = ['save', 'delete', 'update', 'query', 'none'].includes(parsed?.intent) ? parsed.intent : 'none';
      const memory = typeof parsed?.memory === 'string' ? parsed.memory.trim().slice(0, 240) : null;
      const confidence = Number.isFinite(parsed?.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
      return { intent, memory, confidence };
    } catch {
      return null;
    }
  }

  function handleMemoryCommand(input, settings) {
    if (!memory || !settings?.memoryEnabled) return null;
    const clean = String(input || '').trim();
    const normalized = normalizeText(clean).replace(/^(?:miku[, :]\s*)+/, '');

    // Heuristic save for personal statements (only if not an explicit memory command).
    if (!/[?]/.test(clean) && !/^(?:recuerda|olvida|borra|no recuerdes)/.test(normalized)) {
      const savePatterns = [
        /(?:me llamo|mi nombre es)\s+(.+)$/i,
        /me gusta(?:n)?\s+(.+)$/i,
        /me encanta(?:n)?\s+(.+)$/i,
        /estoy\s+(.+)$/i,
        /soy\s+(.+)$/i
      ];
      for (const pattern of savePatterns) {
        const m = clean.match(pattern);
        if (m && m[1]) {
          const text = clean.replace(/^(?:miku[, :]\s*)+/i, '').trim();
          const result = memory.addPersonalMemory(text);
          if (!result.ok) return { ok: false, error: result.error };
          if (result.duplicate) return { ok: true, text: 'Ya lo tenía en mente. ♡', emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
          return { ok: true, text: `¡Claro! Recordaré que ${result.memory.text}. ♡`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
        }
      }
    }

    // Heuristic delete.
    if (/(olvida|borra|no recuerdes|ya no quiero que recuerdes)/.test(normalized)) {
      const candidates = memory.findPersonalMemoryCandidates(clean);
      if (candidates.length === 0) return { ok: true, text: 'No tenía ese recuerdo guardado.', emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
      if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
        const list = candidates.map(c => `• ${c.item.text}`).join('\\n');
        return { ok: true, text: `Encontré varios recuerdos parecidos:\\n${list}\\n¿Cuál quieres que olvide?`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
      }
      const found = candidates[0].item;
      memory.removePersonalMemory(found.id);
      return { ok: true, text: `He olvidado: ${found.text}.`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
    }

    const rememberMatch = clean.match(/recuerda que (.+)$/i) || clean.match(/recuerda:\s*(.+)$/i);
    if (/^recuerda(?: que|:)/.test(normalized) && rememberMatch) {
      const result = memory.addPersonalMemory(rememberMatch[1].replace(/[.!?]+$/, '').trim());
      if (!result.ok) return { ok: false, error: result.error };
      if (result.duplicate) return { ok: true, text: 'Ya lo tenía en mente. ♡', emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
      return { ok: true, text: `¡Claro! Recordaré que ${result.memory.text}. ♡`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
    }

    const forgetMatch = clean.match(/olvida que (.+)$/i);
    if (/^olvida que/.test(normalized) && forgetMatch) {
      const candidates = memory.findPersonalMemoryCandidates(forgetMatch[1]);
      if (candidates.length === 0) {
        return { ok: true, text: 'No tenía ese recuerdo guardado.', emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
      }
      if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
        const list = candidates.map(c => `• ${c.item.text}`).join('\n');
        return { ok: true, text: `Encontré varios recuerdos parecidos:\n${list}\n¿Cuál quieres que olvide?`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
      }
      const found = candidates[0].item;
      memory.removePersonalMemory(found.id);
      return { ok: true, text: `He olvidado: ${found.text}.`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
    }

    if (/^(?:olvida todo|borra (?:mi )?memoria|olvida todo lo que sabes de mi)$/.test(normalized)) {
      memory.clearPersonalMemories();
      memory.clearHistory();
      return { ok: true, text: 'He borrado mis recuerdos de ti. Empezamos de cero. ♡', emotion: 'shy', expression: emotionMap.shy || 'shy', memory: true };
    }

    const isMemoryQuery = /(recuerdas|sabes|te acuerdas|te he contado|mis recuerdos|mi nombre|sobre mi)/.test(normalized);
    if (isMemoryQuery) {
      const memories = memory.getPersonalMemories();
      if (memories.length === 0) {
        return { ok: true, text: 'No tengo recuerdos personales guardados todavía. Si quieres, puedes contarme algo para recordarlo. ♡', emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
      }
      const list = memories.map(item => `• ${item.text}`).join('\n');
      return { ok: true, text: `Esto es lo que recuerdo de ti:\n${list}`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
    }

    return null;
  }

  async function chat(input, settings = {}, history = []) {
    const clean = typeof input === 'string' ? input.trim() : '';
    if (!clean) return { ok: false, error: 'Escribe un mensaje para empezar.' };
    if (clean.length > 500) return { ok: false, error: 'El mensaje es demasiado largo (máximo 500 caracteres).' };

    const memoryEnabled = Boolean(settings?.memoryEnabled) && memory;

    if (memoryEnabled) {
      const provider = providerFactory ? providerFactory(settings) : null;
      const intent = await interpretMemoryIntent(clean, settings, provider);
      if (intent && intent.confidence >= 0.7 && intent.intent !== 'none') {
        if (intent.intent === 'save') {
          if (!intent.memory) return { ok: true, text: 'No entendí qué quieres que recuerde. ¿Puedes decírmelo de otra forma? ♡', emotion: 'shy', expression: emotionMap.shy || 'shy', memory: true };
          const result = memory.addPersonalMemory(intent.memory);
          if (!result.ok) return { ok: false, error: result.error };
          if (result.duplicate) return { ok: true, text: 'Ya lo tenía en mente. ♡', emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
          return { ok: true, text: `¡Claro! Recordaré que ${result.memory.text}. ♡`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
        }
        if (intent.intent === 'query') {
          const memories = memory.getPersonalMemories();
          if (memories.length === 0) return { ok: true, text: 'No tengo recuerdos personales guardados todavía. Si quieres, puedes contarme algo para recordarlo. ♡', emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
          const list = memories.map(item => `• ${item.text}`).join('\\n');
          return { ok: true, text: `Esto es lo que recuerdo de ti:\\n${list}`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
        }
        if (intent.intent === 'delete') {
          if (!intent.memory) return { ok: true, text: 'No entendí qué quieres que olvide. ¿Puedes decírmelo de otra forma? ♡', emotion: 'shy', expression: emotionMap.shy || 'shy', memory: true };
          const candidates = memory.findPersonalMemoryCandidates(intent.memory);
          if (candidates.length === 0) return { ok: true, text: 'No tenía ese recuerdo guardado.', emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
          if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
            const list = candidates.map(c => `• ${c.item.text}`).join('\\n');
            return { ok: true, text: `Encontré varios recuerdos parecidos:\\n${list}\\n¿Cuál quieres que olvide?`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
          }
          const found = candidates[0].item;
          memory.removePersonalMemory(found.id);
          return { ok: true, text: `He olvidado: ${found.text}.`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
        }
        if (intent.intent === 'update') {
          if (!intent.memory) return { ok: true, text: 'No entendí qué quieres actualizar. ¿Puedes decírmelo de otra forma? ♡', emotion: 'shy', expression: emotionMap.shy || 'shy', memory: true };
          const candidates = memory.findPersonalMemoryCandidates(intent.memory);
          if (candidates.length === 0) {
            const result = memory.addPersonalMemory(intent.memory);
            if (!result.ok) return { ok: false, error: result.error };
            return { ok: true, text: `¡Claro! Recordaré que ${result.memory.text}. ♡`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
          }
          if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
            const list = candidates.map(c => `• ${c.item.text}`).join('\\n');
            return { ok: true, text: `Encontré varios recuerdos parecidos:\\n${list}\\n¿Cuál quieres actualizar?`, emotion: 'neutral', expression: emotionMap.neutral || 'normal', memory: true };
          }
          const found = candidates[0].item;
          memory.updatePersonalMemory(found.id, intent.memory);
          return { ok: true, text: `He actualizado mi recuerdo: ${intent.memory}. ♡`, emotion: 'happy', expression: emotionMap.happy || 'happy', memory: true };
        }
      }
      if (intent && intent.intent !== 'none' && intent.confidence < 0.7) {
        return { ok: true, text: '¿Quieres que haga eso con tu memoria? Dímelo con un poco más de claridad. ♡', emotion: 'shy', expression: emotionMap.shy || 'shy', memory: true };
      }
      const commandResult = handleMemoryCommand(clean, settings);
      if (commandResult) return commandResult;
    }

    const provider = providerFactory ? providerFactory(settings) : null;
    if (!provider) return { ok: false, error: 'No hay un proveedor de IA configurado.' };

    const available = await provider.isAvailable();
    if (!available?.available) {
      return { ok: false, error: available?.error || 'No pude conectar con el proveedor de IA.' };
    }

    let memoryContext = '';
    let recentHistory = Array.isArray(history) ? history : [];
    if (memoryEnabled) {
      const memories = memory.getRelevantPersonal(clean, 12);
      if (memories.length > 0) {
        memoryContext = 'Recuerdos personales del usuario (datos confirmados, no inventes otros):\n' + memories.map(item => `- ${item.text}`).join('\n');
      }
      const stored = memory.getRecentHistory(6);
      if (stored.length > 0) recentHistory = stored;
    }

    const systemPrompt = buildSystemPrompt(character, settings.name, memoryContext);
    const messages = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(recentHistory)) {
      for (const item of recentHistory.slice(-8)) {
        if (item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string') {
          messages.push({ role: item.role, content: item.content.slice(0, 500) });
        }
      }
    }
    messages.push({ role: 'user', content: clean });

    try {
      const result = await provider.chat(messages, {
        model: settings.ollamaModel,
        temperature: Number.isFinite(settings.aiTemperature) ? settings.aiTemperature : 0.7
      });
      const parsed = parseAiResponse(result.text);
      const expression = emotionMap?.[parsed.emotion] || emotionMap?.neutral || 'normal';
      if (memoryEnabled) {
        memory.addHistory('user', clean);
        memory.addHistory('assistant', parsed.reply);
      }
      return { ok: true, text: parsed.reply, emotion: parsed.emotion, expression };
    } catch (error) {
      return { ok: false, error: String(error?.message || error).slice(0, 300) };
    }
  }

  return { chat, buildSystemPrompt, parseAiResponse, handleMemoryCommand, normalizeText };
}

module.exports = { createConversationService, buildSystemPrompt, parseAiResponse };