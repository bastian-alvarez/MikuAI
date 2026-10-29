'use strict';
class MikuListener {
  constructor(onStatus, onWake) {
    this.onStatus = onStatus;
    this.onWake = onWake;
    this.token = 0;
    this.active = false;
    this.outputActive = false;
    this.blockedUntil = 0;
    this.gate = new MikuWake.WakeGate();
    this.resources = null;
  }
  status(state, message = '') { this.onStatus({ state, message }); }
  output(active) { this.outputActive = active; if (!active) this.blockedUntil = Date.now() + 1000; }
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
      resources.recognizer = new resources.model.KaldiRecognizer(resources.context.sampleRate);
      resources.recognizer.on('result', event => {
        if (token !== this.token || !this.active || this.outputActive || Date.now() < this.blockedUntil) return;
        if (this.gate.accept(event.result?.text, true)) this.onWake(event.result.text);
      });
      resources.source = resources.context.createMediaStreamSource(resources.stream);
      resources.processor = new AudioWorkletNode(resources.context, 'miku-microphone');
      resources.processor.port.onmessage = event => {
        if (token !== this.token || this.outputActive || Date.now() < this.blockedUntil) return;
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
      this.status('listening', 'Di «oye Miku» para mostrarme.');
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
