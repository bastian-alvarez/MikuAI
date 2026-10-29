# MikuAI

Una primera compañera para el escritorio de Windows, inspirada en Hatsune Miku.

<img src="assets/miku.png" alt="Miku, compañera de escritorio" width="240">

## Primera versión · 0.1.0

- Personaje 2D sobre el escritorio con fondo transparente y animación suave.
- Pregunta tu nombre la primera vez. Después te recibe con **«¡Bienvenido, nombre-sama!»** al abrir la aplicación.
- Saludo hablado sin conexión, usando una voz instalada de Windows.
- Recuerda nombre, voz, volumen, tono, velocidad, visibilidad superior y posición.
- Arrastra el personaje para moverlo. Las zonas vacías dejan pasar los clics.
- Oculta o muestra Miku con **Ctrl + Alt + M**, o con el icono de la bandeja.
- El botón **−** y **Escape** la ocultan; **Salir de MikuAI** la cierra por completo.

La ilustración es estática con movimiento por CSS; todavía no tiene rig, gestos ni sincronización de labios. La voz de esta versión es **TTS de Windows, no la voz oficial de Hatsune Miku**. El control de tono también modifica la rapidez de reproducción. En Ajustes puedes seleccionar entre las voces que Windows exponga a `System.Speech`.

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

El archivo portable queda en `release/MikuAI-0.1.0-Windows.exe`. No necesita instalador. El ejecutable aún no tiene firma digital. Para generar la carpeta ejecutable sin empaquetado portable:

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
```

Las pruebas cubren primer inicio, saludo personalizado después de reiniciar, recuperación de ajustes dañados, validación de valores y restauración de posición cuando se desconecta una pantalla. La voz y la transparencia requieren además una comprobación en Windows.

## Datos locales y arquitectura

Los ajustes se guardan en `%APPDATA%/MikuAI/` (la ubicación exacta sigue `app.getPath('userData')` de Electron); no se suben al repositorio. No hay telemetría, micrófono, reconocimiento de órdenes ni conexión a un modelo de IA en esta versión. Para pruebas aisladas puede definirse `MIKUAI_DATA_DIR` con una carpeta de datos alternativa.

- `src/main.cjs`: ventana transparente, bandeja, atajo e IPC.
- `src/preload.cjs`: interfaz limitada entre la ventana y el proceso principal.
- `src/core.cjs`: ajustes, saludo y posición.
- `src/voice.cjs` y `scripts/windows-voice.ps1`: adaptador de voz local; el texto se envía como JSON por stdin, sin interpolarlo en comandos.
- `src/renderer/`: interfaz en español y animaciones.
- `assets/`: personaje e iconos locales. [Procedencia y prompts](docs/assets.md).

El renderer usa aislamiento de contexto, sandbox, una política de contenido local y permisos denegados. No expone Node.js ni permite navegar a páginas externas.

## Siguientes pasos

1. Elegir contigo el estilo final del personaje y pasar a un modelo animado si hace falta.
2. Integrar un motor o banco de voz compatible y autorizado para acercarnos a la voz de Miku.
3. Incorporar conversación y, después, órdenes concretas con permisos claros.

Proyecto de fan independiente, sin afiliación con Crypton Future Media. Hatsune Miku y sus elementos asociados pertenecen a sus respectivos titulares. La ilustración generada no otorga derechos sobre el personaje; antes de distribuir comercialmente, habrá que revisar las condiciones aplicables. No se incluye un banco de voz propietario. El código aún no tiene una licencia de redistribución elegida.
