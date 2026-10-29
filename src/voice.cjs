'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

// Local adapter. A future licensed voice engine can replace this module.
class WindowsVoice {
  constructor(script) { this.script = script; this.active = new Set(); this.speaking = false; }

  run(mode, payload) {
    if (process.platform !== 'win32') return Promise.reject(new Error('La voz local requiere Windows.'));
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', this.script, '-Mode', mode],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.active.add(child);
      let stdout = '', stderr = '', settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.active.delete(child);
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => { child.kill(); finish(new Error('La voz tardó demasiado. Intenta otra vez.')); }, 20000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', data => {
        stdout += data;
        if (stdout.length > 12_000_000) { child.kill(); finish(new Error('El audio supera el límite.')); }
      });
      child.stderr.on('data', data => { stderr = (stderr + data).slice(0, 2000); });
      child.on('error', error => finish(error));
      child.stdin.on('error', () => {});
      child.on('close', code => {
        if (code !== 0) return finish(new Error(stderr || 'No se pudo iniciar la voz de Windows.'));
        try { finish(null, JSON.parse(stdout.replace(/^\uFEFF/, ''))); }
        catch { finish(new Error('Windows devolvió una respuesta de voz inválida.')); }
      });
      child.stdin.end(payload ? JSON.stringify(payload) : '');
    });
  }

  list() { return this.run('voices'); }
  async synthesize(text, settings) {
    if (this.speaking) throw new Error('Ya estoy preparando una frase.');
    this.speaking = true;
    try { return await this.run('speak', { text, voice: settings.voice, rate: settings.rate }); }
    finally { this.speaking = false; }
  }
  dispose() { for (const child of this.active) child.kill(); }
}
module.exports = { WindowsVoice };
