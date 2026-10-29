const assert = require('node:assert/strict');
const path = require('node:path');
const { WindowsVoice } = require('../src/voice.cjs');

async function main() {
  const engine = new WindowsVoice(path.join(__dirname, 'windows-voice.ps1'));
  try {
    const voices = await engine.list();
    assert.ok(voices.length > 0, 'Windows necesita al menos una voz instalada.');
    const result = await engine.synthesize('¡Bienvenido, Bastián-sama!', { voice: '', rate: 0 });
    const wav = Buffer.from(result.audio, 'base64');
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.ok(wav.length > 1000, 'El saludo debe contener audio.');
    const cancelled = engine.synthesize('Esta frase anterior se debe interrumpir antes de hablar.', { voice: '', rate: -3 }).then(() => false, () => true);
    const latest = await engine.synthesize('Hola de nuevo.', { voice: '', rate: 0 });
    assert.equal(await cancelled, true, 'Una frase nueva debe cancelar la anterior.');
    assert.equal(Buffer.from(latest.audio, 'base64').toString('ascii', 0, 4), 'RIFF');
    console.log(`Voz comprobada: ${result.voice}. WAV válido de ${wav.length} bytes. ${voices.length} voces disponibles.`);
  } finally { engine.dispose(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
