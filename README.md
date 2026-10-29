# MikuAI

Una primera compañera para el escritorio de Windows, inspirada en Hatsune Miku.

<img src="assets/miku.png" alt="Miku, compañera de escritorio" width="240">

## Versión 0.3.0 · «Oye Miku»

- Personaje 2D sobre el escritorio con fondo transparente y animación suave.
- Siete expresiones: original, tímida, sonrojada, feliz, sorprendida, enfurruñada y soñolienta. Cambia desde los botones bajo el personaje o mediante una orden. Recuerda la expresión elegida al volver a abrir la aplicación.
- Órdenes por texto en español, con ejemplos editables desde el botón **✎** de la barra.
- Activación por micrófono: di **«oye Miku»** para mostrarla aunque esté oculta en la bandeja. Reconocimiento local en español, apagado por defecto y con control visible.
- Pregunta tu nombre la primera vez. Después te recibe con **«¡Bienvenido, nombre-sama!»** al abrir la aplicación.
- Saludo hablado sin conexión, usando una voz instalada de Windows.
- Recuerda nombre, voz, volumen, tono, velocidad, visibilidad superior y posición.
- Arrastra el personaje para moverlo. Las zonas vacías dejan pasar los clics.
- Oculta o muestra Miku con **Ctrl + Alt + M**, o con el icono de la bandeja.
- El botón **−** y **Escape** la ocultan; **Salir de MikuAI** la cierra por completo.

Cada expresión es una ilustración estática con movimiento por CSS; todavía no tiene rig ni sincronización de labios. Todas las variantes se generaron a partir de la ilustración original, manteniendo diseño y pose. La voz de esta versión es **TTS de Windows, no la voz oficial de Hatsune Miku**. El control de tono también modifica la rapidez de reproducción. En Ajustes puedes seleccionar entre las voces que Windows exponga a `System.Speech`.

## Qué puedes pedirle

Después de guardar tu nombre aparece una caja de texto en el bocadillo. Escribe una orden y pulsa **Enter** o **↗**. El botón **✎** muestra ejemplos: tocar uno lo prepara para que puedas editarlo antes de enviarlo.

| Quiero… | Ejemplos |
| --- | --- |
| Un saludo | `Hola, Miku`, `Salúdame` |
| Cambiar mi nombre | `Me llamo María José`, `Llámame Bastián` |
| Cambiar su expresión | `Ponte tímida`, `Sonrójate`, `Ponte feliz`, `Ponte sorprendida`, `Haz un puchero`, `Descansa`, `Expresión normal` |
| Saber hora o fecha del PC | `¿Qué hora es?`, `¿Qué día es hoy?` |
| Escuchar una frase | `Di que tengas un lindo día`, `Repite hola mundo` |
| Ajustar el volumen | `Volumen al 30%`, `Sube el volumen`, `Baja el volumen` |
| Silenciar o activar la voz | `Silencio`, `Activa la voz` |
| Cambiar velocidad | `Habla más rápido`, `Habla más despacio` |
| Cambiar superposición | `Siempre visible`, `Desactiva siempre visible` |
| Abrir paneles | `Ayuda`, `¿Qué puedes hacer?`, `Abre ajustes` |
| Ocultarla | `Ocúltate` (volver desde la bandeja o con Ctrl + Alt + M) |

Las órdenes se reconocen localmente mediante frases y sinónimos; aceptan tildes, mayúsculas y «por favor». Si una frase no está soportada, Miku lo indica y ofrece la lista. Las respuestas habladas se interrumpen al enviar otra orden. El micrófono reconoce la llamada de activación; las órdenes se escriben en el bocadillo. No hay todavía conversación libre con un modelo de IA. Las órdenes cambian el estado de Miku; no ejecutan comandos del sistema ni controlan otras aplicaciones.

## Activación por micrófono

1. Abre MikuAI y pulsa **Activar «oye Miku»** debajo de la barra. También está en Ajustes y en el menú de la bandeja.
2. La primera activación carga el modelo incluido. Espera a que el indicador diga **Escuchando «oye Miku»**.
3. Oculta a Miku con **−** o **Ctrl + Alt + M** y di **«oye Miku»**. Al reconocer la frase, Miku aparece y enfoca la caja de texto.
4. Para dejar de escuchar, pulsa el mismo control, desmarca la opción en Ajustes/bandeja o sal de la aplicación. Silenciar la voz de salida y apagar el micrófono son controles independientes.

MikuAI tiene que seguir ejecutándose en segundo plano. No puede arrancar por voz después de cerrarla por completo y todavía no se configura para iniciar con Windows. La preferencia de escucha se recuerda entre aperturas.

El modelo español Vosk está incluido: no requiere cuenta, clave API, Python ni instalar un paquete de idioma de Windows. El audio se procesa en memoria en este equipo y no se guarda ni se sube a un servidor. Se usa el micrófono predeterminado de Windows. Si no aparece un micrófono o Windows deniega el acceso, la interfaz lo indica; revisa el dispositivo y los permisos de micrófono para aplicaciones de escritorio de Windows y vuelve a intentarlo. MikuAI no cambia esos permisos del sistema.

Para reducir activaciones por su propia voz, el reconocimiento ignora la salida hablada de Miku y un intervalo corto después de ella. Hay un intervalo entre activaciones repetidas. Como primera implementación usa reconocimiento de frases, no un detector de palabra clave especializado: ruido, altavoces o distintas pronunciaciones pueden producir errores. Se aceptan grafías fonéticas que el reconocedor puede dar al nombre, como «mico» y «mi cu». El modelo y sus [licencias y procedencia](assets/speech/NOTICE.md) se incluyen en el proyecto.

## Ejecutar desde el código

Requisitos: Windows 10/11, Node.js 24 LTS y una voz de escritorio instalada en Windows. Se usa Windows PowerShell 5.1 para acceder a `System.Speech`; no hace falta una clave API ni servicios de pago.

```powershell
npm ci
npm start
```

La primera apertura pregunta tu nombre por texto y voz. Escribe tu nombre y pulsa **Hola, Miku**. El nombre queda guardado para el siguiente inicio de la aplicación. Esta versión no se configura para abrirse al encender Windows.

## Crear el ejecutable

```powershell
npm run build
```

El archivo portable queda en `release/MikuAI-0.3.0-Windows.exe`. No necesita instalador. El ejecutable aún no tiene firma digital. Para generar la carpeta ejecutable sin empaquetado portable:

```powershell
npm run build:dir
```

GitHub Actions comprueba y empaqueta la aplicación en Windows con cada push; el ejecutable queda como artifact `MikuAI-Windows` en la ejecución de **Actions → Windows**.

## Comprobaciones

```powershell
npm run check
npm test
npm run test:voice
npm run test:desktop
npm run test:listener
```

Las pruebas de Node cubren ajustes, migraciones, órdenes, alias, límites, recursos y la compuerta de activación. `test:voice` genera un saludo WAV real. `test:desktop` comprueba la interfaz con un perfil separado en `.local/`. `test:listener` activa temporalmente el micrófono, comprueba el reconocedor con un WAV sintético de «oye Miku», la aparición de la ventana oculta y la liberación del dispositivo al desactivar la escucha. No graba audio del entorno. La calidad con la voz de cada persona necesita probarse con su micrófono.

## Datos locales y arquitectura

Los ajustes se guardan en `%APPDATA%/MikuAI/` (la ubicación exacta sigue `app.getPath('userData')` de Electron); no se suben al repositorio. Las órdenes y transcripciones no se guardan en un historial. No hay telemetría ni conexión a un modelo de conversación. El reconocedor puede guardar una caché local del modelo, sin grabaciones. Para pruebas aisladas puede definirse `MIKUAI_DATA_DIR` con una carpeta de datos alternativa.

- `src/main.cjs`: ventana transparente, bandeja, atajo e IPC.
- `src/preload.cjs`: interfaz limitada entre la ventana y el proceso principal.
- `src/core.cjs`: ajustes, saludo y posición.
- `src/commands.cjs`: intérprete local de órdenes, catálogo de expresiones y ejemplos.
- `src/voice.cjs` y `scripts/windows-voice.ps1`: adaptador de voz local; el texto se envía como JSON por stdin, sin interpolarlo en comandos.
- `src/renderer/`: interfaz en español y animaciones.
- `src/renderer/listener.js`, `microphone-worklet.js` y `wake-logic.js`: captura, reconocimiento local y validación de «oye Miku».
- `scripts/prepare-speech.cjs`: prepara el motor desde la dependencia fijada; `npm ci` lo ejecuta automáticamente.
- `assets/speech/` y `assets/vendor/`: modelo español, motor WebAssembly y licencias.
- `assets/`: personaje e iconos locales. [Procedencia y prompts](docs/assets.md).

El renderer usa aislamiento de contexto, sandbox, una política de contenido local y el protocolo seguro `miku://`. Solo se permite acceso al audio de entrada desde la ventana local después de activar la escucha; cámara y otros permisos siguen denegados. No expone Node.js ni permite navegar a páginas externas. El worker de reconocimiento está separado de la interfaz y dispone de la generación de código requerida por Emscripten; la interfaz conserva su prohibición de `eval`.

## Siguientes pasos

La [investigación sobre la voz auténtica de Miku](docs/real-miku-voice-research.md) queda para una etapa posterior. La salida hablada sigue usando la voz local de Windows; esta versión añade reconocimiento de entrada.

1. Elegir contigo el estilo final del personaje y pasar a un modelo animado si hace falta.
2. Integrar un motor o banco de voz compatible y autorizado para acercarnos a la voz de Miku.
3. Incorporar órdenes habladas después de la llamada y nuevas acciones concretas.

Proyecto de fan independiente, sin afiliación con Crypton Future Media. Hatsune Miku y sus elementos asociados pertenecen a sus respectivos titulares. La ilustración generada no otorga derechos sobre el personaje; antes de distribuir comercialmente, habrá que revisar las condiciones aplicables. No se incluye un banco de voz propietario. El código aún no tiene una licencia de redistribución elegida.
