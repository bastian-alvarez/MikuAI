'use strict';
class MikuListener {
  constructor(onStatus, onWake, onCommand = () => {}, onTimeout = () => {}) {
    this.onStatus = onStatus;
    this.onWake = onWake;
    this.onCommand = onCommand;
    this.onTimeout = onTimeout;
    this.mode = 'wake';
    this.commandEpoch = 0;
    this.commandDeadline = 0;
    this.commandTimer = null;
    this.token = 0;
    this.active = false;
    this.outputActive = false;
    this.blockedUntil = 0;
    this.gate = new MikuWake.WakeGate();
    this.resources = null;
  }
  status(state, message = '') { this.onStatus({ state, message }); }
  output(active) {
    this.outputActive = active;
    if (!active) { this.blockedUntil = Date.now() + 350; this.resetRecognizer(); }
  }
  resetRecognizer() {
    const resources = this.resources;
    if (!resources?.recognizer || !this.active) return;
    resources.recognizer.remove();
    this.createRecognizer(resources, this.token);
  }
  createRecognizer(resources, token) {
    const recognizer = resources.recognizer = new resources.model.KaldiRecognizer(resources.context.sampleRate);
    recognizer.on('result', event => {
      if (token !== this.token || resources.recognizer !== recognizer || !this.active || this.outputActive || Date.now() < this.blockedUntil) return;
      this.handleResult(event.result?.text);
    });
  }
  handleResult(text) {
    if (typeof text !== 'string' || !text.trim() || ['prompting', 'executing', 'settling'].includes(this.mode)) return;
    if (MikuWake.isWakePhrase(text)) {
      if (!this.gate.accept(text, true)) return;
      clearTimeout(this.commandTimer);
      const epoch = ++this.commandEpoch;
      this.mode = 'prompting';
      Promise.resolve(this.onWake(text)).then(accepted => {
        if (!accepted && epoch === this.commandEpoch) this.cancelCommand();
      }).catch(() => { if (epoch === this.commandEpoch) this.cancelCommand(); });
      return;
    }
    if (this.mode !== 'command') return;
    if (Date.now() >= this.commandDeadline) return this.expireCommand();
    clearTimeout(this.commandTimer);
    const epoch = this.commandEpoch;
    this.mode = 'executing';
    this.status('answering', 'Procesando tu orden…');
    Promise.resolve(this.onCommand(text)).catch(() => {}).finally(() => {
      if (epoch === this.commandEpoch && this.active) this.cancelCommand();
    });
  }
  beginPrompt() {
    ++this.commandEpoch;
    clearTimeout(this.commandTimer);
    this.commandDeadline = 0;
    this.mode = 'prompting';
    this.resetRecognizer();
    this.status('answering', 'Un momento, te respondo…');
  }
  awaitCommand(deadline) {
    if (!this.active || !Number.isFinite(deadline) || deadline <= Date.now()) return this.cancelCommand();
    clearTimeout(this.commandTimer);
    this.commandDeadline = deadline;
    this.mode = 'settling';
    const epoch = this.commandEpoch;
    let previousSeconds = -1;
    const tick = () => {
      if (!this.active || epoch !== this.commandEpoch) return;
      const seconds = Math.ceil((deadline - Date.now()) / 1000);
      if (seconds <= 0) return this.expireCommand();
      if (previousSeconds !== seconds) { previousSeconds = seconds; this.status('command', `Te escucho: di una orden (${seconds} s).`); }
      this.commandTimer = setTimeout(tick, 250);
    };
    this.commandTimer = setTimeout(() => {
      if (!this.active || epoch !== this.commandEpoch) return;
      this.resetRecognizer();
      this.mode = 'command';
      tick();
    }, Math.max(350, this.blockedUntil - Date.now()));
  }
  expireCommand() { this.cancelCommand(); this.onTimeout(); }
  cancelCommand() {
    ++this.commandEpoch;
    clearTimeout(this.commandTimer);
    this.commandTimer = null;
    this.commandDeadline = 0;
    this.mode = 'wake';
    this.resetRecognizer();
    if (this.active && this.resources?.recognizer) this.status('listening', 'Di «oye Miku» para hablar conmigo.');
  }
  async start() {
    if (this.active) return;
    this.active = true;
    const token = ++this.token;
    const resources = this.resources = {};
    this.status('starting', 'Preparando el micrófono…');
    try {
      resources.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (token !== this.token) return this.release(resources);
      resources.stream.getAudioTracks()[0].addEventListener('ended', () => {
        if (token === this.token && this.active) this.fail('Se desconectó el micrófono. Vuelve a activar la escucha.');
      });
      this.status('starting', 'Cargando reconocimiento en español…');
      resources.model = new Vosk.Model(new URL('../../assets/speech/es-small.tar.gz', location.href).href, -2);
      await new Promise((resolve, reject) => {
        const finish = error => {
          clearTimeout(timer);
          resources.cancelLoad = null;
          if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => finish(new Error('El reconocimiento tardó demasiado en cargar.')), 90000);
        resources.cancelLoad = () => finish(new Error('Escucha cancelada.'));
        resources.model.on('load', event => event.result ? finish() : finish(new Error('No pude cargar el reconocimiento en español.')));
        const failed = () => {
          if (token !== this.token) return;
          if (resources.recognizer) this.fail('Se detuvo el reconocimiento local. Vuelve a activar la escucha.');
          else finish(new Error('No pude iniciar el reconocimiento local.'));
        };
        resources.model.on('error', failed);
        resources.model.worker.addEventListener('error', failed);
      });
      if (token !== this.token) return this.release(resources);
      resources.context = new AudioContext({ sampleRate: 16000 });
      await resources.context.audioWorklet.addModule('microphone-worklet.js');
      if (token !== this.token) return this.release(resources);
      this.createRecognizer(resources, token);
      resources.source = resources.context.createMediaStreamSource(resources.stream);
      resources.processor = new AudioWorkletNode(resources.context, 'miku-microphone');
      resources.processor.port.onmessage = event => {
        if (token !== this.token || this.outputActive || Date.now() < this.blockedUntil || ['prompting', 'executing', 'settling'].includes(this.mode)) return;
        try { resources.recognizer.acceptWaveformFloat(event.data, resources.context.sampleRate); }
        catch { this.fail('Se detuvo el reconocimiento local. Vuelve a activar la escucha.'); }
      };
      resources.silent = resources.context.createGain();
      resources.silent.gain.value = 0;
      resources.source.connect(resources.processor);
      resources.processor.connect(resources.silent);
      resources.silent.connect(resources.context.destination);
      await resources.context.resume();
      if (token !== this.token) return this.release(resources);
      this.mode = 'wake';
      this.status('listening', 'Di «oye Miku» para hablar conmigo.');
    } catch (error) {
      if (token !== this.token) return this.release(resources);
      const message = error.name === 'NotAllowedError' ? 'Windows no permitió usar el micrófono. Revisa sus permisos y vuelve a intentarlo.'
        : error.name === 'NotFoundError' ? 'No encontré un micrófono conectado.'
          : error.name === 'NotReadableError' ? 'No pude abrir el micrófono. Comprueba que esté disponible.'
            : error.message || 'No pude iniciar la escucha.';
      this.fail(message);
    }
  }
  fail(message) { this.stop(false); this.status('error', message); }
  stop(notify = true) {
    this.active = false;
    this.cancelCommand();
    ++this.token;
    this.release(this.resources);
    this.resources = null;
    if (notify) this.status('off', 'Micrófono apagado.');
  }
  release(resources) {
    if (!resources) return;
    resources.cancelLoad?.();
    resources.stream?.getTracks().forEach(track => track.stop());
    resources.source?.disconnect();
    resources.processor?.disconnect();
    if (resources.processor) resources.processor.port.onmessage = null;
    resources.silent?.disconnect();
    resources.recognizer?.remove();
    resources.model?.worker.terminate();
    resources.context?.close().catch(() => {});
  }
}
window.MikuListener = MikuListener;
