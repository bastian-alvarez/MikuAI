# Reconocimiento local de voz

- **Modelo:** vosk-model-small-es-0.42, de Alpha Cephei / AC Technologies LLC. Copyright 2022-2050 AC Technologies LLC, según el README del modelo. Licencia Apache-2.0, indicada en https://alphacephei.com/vosk/models.
- **Fuente:** https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip. Se volvió a empaquetar la carpeta del modelo como `es-small.tar.gz` para vosk-browser, sin modificar sus parámetros.
- **SHA-256 de es-small.tar.gz:** dacc7608e3833a18c5f5a9440d5546762d2960942a7d1205b67939c91321bcd0.
- **vosk-browser 0.0.8:** Ciaran O'Reilly, Apache-2.0. Fuente publicada en https://www.npmjs.com/package/vosk-browser. Motor Vosk: https://github.com/alphacep/vosk-api (Apache-2.0).
- El cliente y el worker se guardan en `assets/vendor/`. `scripts/prepare-speech.cjs` extrae el worker, sustituye los generadores UUID del cliente por Web Crypto y registra la huella del paquete original en `assets/vendor/vosk-build.json`. Se conservan los avisos de copyright presentes en el código distribuido, incluidos los de Microsoft/TypeScript.
- Texto de licencia: `APACHE-2.0.txt`. Aviso y métricas originales del modelo: `MODEL-README.txt`.

El audio del micrófono se procesa temporalmente en memoria. El motor puede conservar una copia local del modelo en el perfil de Electron; esa caché no contiene grabaciones ni un historial de transcripciones.
