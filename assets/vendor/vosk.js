(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Vosk = {}));
})(this, (function (exports) { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function v4() { return crypto.randomUUID(); }

    function decodeBase64(base64, enableUnicode) {
        var binaryString = atob(base64);
        if (enableUnicode) {
            var binaryView = new Uint8Array(binaryString.length);
            for (var i = 0, n = binaryString.length; i < n; ++i) {
                binaryView[i] = binaryString.charCodeAt(i);
            }
            return String.fromCharCode.apply(null, new Uint16Array(binaryView.buffer));
        }
        return binaryString;
    }

    function createURL(base64, sourcemapArg, enableUnicodeArg) {
        var sourcemap = sourcemapArg === undefined ? null : sourcemapArg;
        var enableUnicode = enableUnicodeArg === undefined ? false : enableUnicodeArg;
        var source = decodeBase64(base64, enableUnicode);
        var start = source.indexOf('\n', 10) + 1;
        var body = source.substring(start) + (sourcemap ? '\/\/# sourceMappingURL=' + sourcemap : '');
        var blob = new Blob([body], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    function createBase64WorkerFactory(base64, sourcemapArg, enableUnicodeArg) {
        var url;
        return function WorkerFactory(options) {
            url = url || createURL(base64, sourcemapArg, enableUnicodeArg);
            return new Worker(url, options);
        };
    }

    var WorkerFactory = function () { return new Worker('miku://app/assets/vendor/vosk-worker.js'); };
    /* eslint-enable */

    var ClientMessage;
    (function (ClientMessage) {
        function isTerminateMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "terminate";
        }
        ClientMessage.isTerminateMessage = isTerminateMessage;
        function isLoadMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "load";
        }
        ClientMessage.isLoadMessage = isLoadMessage;
        function isSetMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "set";
        }
        ClientMessage.isSetMessage = isSetMessage;
        function isAudioChunkMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "audioChunk";
        }
        ClientMessage.isAudioChunkMessage = isAudioChunkMessage;
        function isRecognizerCreateMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "create";
        }
        ClientMessage.isRecognizerCreateMessage = isRecognizerCreateMessage;
        function isRecognizerRetrieveFinalResultMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "retrieveFinalResult";
        }
        ClientMessage.isRecognizerRetrieveFinalResultMessage = isRecognizerRetrieveFinalResultMessage;
        function isRecognizerRemoveMessage(message) {
            return (message === null || message === void 0 ? void 0 : message.action) === "remove";
        }
        ClientMessage.isRecognizerRemoveMessage = isRecognizerRemoveMessage;
    })(ClientMessage || (ClientMessage = {}));
    var ModelMessage;
    (function (ModelMessage) {
        function isLoadResult(message) {
            return (message === null || message === void 0 ? void 0 : message.event) === "load";
        }
        ModelMessage.isLoadResult = isLoadResult;
    })(ModelMessage || (ModelMessage = {}));
    var ServerMessage;
    (function (ServerMessage) {
        function isRecognizerMessage(message) {
            return ["result", "partialresult"].includes(message.event) || Reflect.has(message, 'recognizerId');
        }
        ServerMessage.isRecognizerMessage = isRecognizerMessage;
        function isResult(message) {
            var _a, _b;
            return ((_a = message === null || message === void 0 ? void 0 : message.result) === null || _a === void 0 ? void 0 : _a.text) != null || ((_b = message === null || message === void 0 ? void 0 : message.result) === null || _b === void 0 ? void 0 : _b.result) != null;
        }
        ServerMessage.isResult = isResult;
        function isPartialResult(message) {
            var _a;
            return ((_a = message === null || message === void 0 ? void 0 : message.result) === null || _a === void 0 ? void 0 : _a.partial) != null;
        }
        ServerMessage.isPartialResult = isPartialResult;
    })(ServerMessage || (ServerMessage = {}));

    class Logger {
        constructor(logLevel = 0) {
            this.logLevel = 0;
            this.setLogLevel(logLevel);
        }
        getLogLevel() {
            return this.logLevel;
        }
        setLogLevel(level) {
            if (typeof level != "number")
                return;
            this.logLevel = level;
        }
        error(message) {
            console.error(message);
        }
        warn(message) {
            if (this.logLevel < -1)
                return;
            console.warn(message);
        }
        info(message) {
            if (this.logLevel < 0)
                return;
            console.info(message);
        }
        verbose(message) {
            if (this.logLevel < 1)
                return;
            console.debug(message);
        }
        debug(message) {
            if (this.logLevel < 3)
                return;
            console.debug(message);
        }
    }

    class Model extends EventTarget {
        constructor(modelUrl, logLevel = 0) {
            super();
            this.modelUrl = modelUrl;
            this._ready = false;
            this.logger = new Logger();
            this.recognizers = new Map();
            this.logger.setLogLevel(logLevel);
            this.worker = new WorkerFactory();
            this.initialize();
        }
        initialize() {
            this.worker.addEventListener("message", (event) => this.handleMessage(event));
            this.postMessage({
                action: "set",
                key: "logLevel",
                value: this.logger.getLogLevel()
            });
            this.postMessage({
                action: "load",
                modelUrl: this.modelUrl,
            });
        }
        postMessage(message, options) {
            this.worker.postMessage(message, options);
        }
        handleMessage(event) {
            const message = event.data;
            if (message) {
                if (ModelMessage.isLoadResult(message)) {
                    this._ready = message.result;
                }
                const event = new CustomEvent(message.event, { detail: message });
                if (ServerMessage.isRecognizerMessage(message) && message.recognizerId) {
                    const recognizer = this.recognizers.get(message.recognizerId);
                    if (recognizer) {
                        recognizer.dispatchEvent(event);
                        return;
                    }
                }
                this.dispatchEvent(event);
            }
        }
        on(event, listener) {
            this.addEventListener(event, (event) => {
                if (event.detail && !ServerMessage.isRecognizerMessage(event.detail)) {
                    listener(event.detail);
                }
            });
        }
        registerPort(port) {
            this.logger.debug(`Registering port ${port}`);
            this.messagePort = port;
            this.messagePort.onmessage = this.forwardMessage.bind(this);
        }
        forwardMessage(event) {
            const message = event.data;
            if (ClientMessage.isAudioChunkMessage(message)) {
                this.postMessage(message, {
                    transfer: [message.data.buffer],
                });
            }
        }
        get ready() {
            return this._ready;
        }
        terminate() {
            this.postMessage({
                action: "terminate",
            });
            this._ready = false;
        }
        setLogLevel(level) {
            this.logger.setLogLevel(level);
            this.postMessage({
                action: "set",
                key: "logLevel",
                value: level
            });
        }
        registerRecognizer(recognizer) {
            this.recognizers.set(recognizer.id, recognizer);
        }
        unregisterRecognizer(recognizerId) {
            this.recognizers.delete(recognizerId);
        }
        /**
         * KaldiRecognizer anonymous class
         */
        get KaldiRecognizer() {
            const model = this;
            return class extends EventTarget {
                constructor(sampleRate, grammar) {
                    super();
                    this.id = v4();
                    if (!model.ready) {
                        throw new Error("Cannot create KaldiRecognizer. Model is either not ready or has been terminated");
                    }
                    model.registerRecognizer(this);
                    model.postMessage({
                        action: "create",
                        recognizerId: this.id,
                        sampleRate,
                        grammar,
                    });
                }
                on(event, listener) {
                    this.addEventListener(event, (event) => {
                        listener(event === null || event === void 0 ? void 0 : event.detail);
                    });
                }
                setWords(words) {
                    model.postMessage({
                        action: "set",
                        recognizerId: this.id,
                        key: "words",
                        value: words
                    });
                }
                acceptWaveform(buffer) {
                    if (buffer.numberOfChannels < 1) {
                        throw new Error(`AudioBuffer should contain at least one channel`);
                    }
                    this.acceptWaveformFloat(buffer.getChannelData(0), buffer.sampleRate);
                }
                acceptWaveformFloat(buffer, sampleRate) {
                    // AudioBuffer samples are represented as floating point numbers between -1.0 and 1.0 whilst
                    // Kaldi expects them to be between -32768 and 32767 (the range of a signed int16)
                    // Should this be handled by the library (better in the C codebase) or left to the end-user to decide?
                    const data = buffer.map((value) => value * 0x8000);
                    if (!(data instanceof Float32Array)) {
                        throw new Error(`Channel data is not a Float32Array as expected: ${data}`);
                    }
                    model.logger.debug(`Recognizer (id: ${this.id}): Sending audioChunk 0=${data[0]} ${data.length}=${data[data.length - 1]}`);
                    model.postMessage({
                        action: "audioChunk",
                        data,
                        recognizerId: this.id,
                        sampleRate: sampleRate,
                    }, {
                        transfer: [data.buffer],
                    });
                }
                retrieveFinalResult() {
                    model.postMessage({
                        action: "retrieveFinalResult",
                        recognizerId: this.id,
                    });
                }
                remove() {
                    model.unregisterRecognizer(this.id);
                    model.postMessage({
                        action: "remove",
                        recognizerId: this.id,
                    });
                }
            };
        }
    }
    function createModel(modelUrl, logLevel = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const model = new Model(modelUrl, logLevel);
            return new Promise((resolve, reject) => model.on("load", (message) => {
                if (message.result) {
                    resolve(model);
                }
                reject();
            }));
        });
    }

    exports.Model = Model;
    exports.createModel = createModel;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
