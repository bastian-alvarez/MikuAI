// Reproducibly separate the pinned upstream worker from the renderer library.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'node_modules/vosk-browser/dist/vosk.js'), 'utf8');
const workerPattern = /var WorkerFactory = createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'[^;]*;/;
const match = source.match(workerPattern);
if (!match) throw new Error('Unexpected vosk-browser bundle format.');
const worker = Buffer.from(match[1], 'base64').toString('utf8');
// Only the isolated worker needs Emscripten dynamic code generation. The UI keeps
// its restrictive CSP. Replace unused bundled UUID algorithms with Web Crypto.
const client = source.replace(workerPattern, "var WorkerFactory = function () { return new Worker('miku://app/assets/vendor/vosk-worker.js'); };")
  .replace(/\/\/ Unique ID creation[\s\S]*?(?=    function decodeBase64)/, 'function v4() { return crypto.randomUUID(); }\n\n');
const dir = path.join(root, 'assets/vendor');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'vosk.js'), client);
fs.writeFileSync(path.join(dir, 'vosk-worker.js'), worker);
fs.writeFileSync(path.join(dir, 'vosk-build.json'), JSON.stringify({ package: 'vosk-browser', version: '0.0.8', upstreamSha256: crypto.createHash('sha256').update(source).digest('hex'), changes: ['Extract embedded worker as a local file', 'Use Web Crypto randomUUID in client instead of bundled UUID routines'] }, null, 2));
