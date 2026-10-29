# MikuAI

Una primera compañera para el escritorio de Windows, inspirada en Hatsune Miku.

<img src="assets/miku.png" alt="Miku, compañera de escritorio" width="240">

## Versión 0.2.0 · Expresiones y órdenes

- Personaje 2D sobre el escritorio con fondo transparente y animación suave.
- Siete expresiones: original, tímida, sonrojada, feliz, sorprendida, enfurruñada y soñolienta. Cambia desde los botones bajo el personaje o mediante una orden. Recuerda la expresión elegida al volver a abrir la aplicación.
- Órdenes por texto en español, con ejemplos editables desde el botón **✎** de la barra.
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

Las órdenes se reconocen localmente mediante frases y sinónimos; aceptan tildes, mayúsculas y «por favor». Si una frase no está soportada, Miku lo indica y ofrece la lista. Las respuestas habladas se interrumpen al enviar otra orden. No hay todavía conversación libre con un modelo de IA ni reconocimiento de voz por micrófono. Las órdenes cambian el estado de Miku; no ejecutan comandos del sistema ni controlan otras aplicaciones.

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

El archivo portable queda en `release/MikuAI-0.2.0-Windows.exe`. No necesita instalador. El ejecutable aún no tiene firma digital. Para generar la carpeta ejecutable sin empaquetado portable:

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

Las pruebas de Node cubren ajustes, migración desde 0.1, órdenes, alias, límites de volumen y velocidad, entradas no soportadas y recursos de las expresiones. `test:voice` genera un saludo WAV real. `test:desktop` comprueba el saludo reproducido, las siete expresiones, órdenes por texto, ayuda, persistencia y diseño en una ventana pequeña con un perfil separado en `.local/`.

## Datos locales y arquitectura

Los ajustes se guardan en `%APPDATA%/MikuAI/` (la ubicación exacta sigue `app.getPath('userData')` de Electron); no se suben al repositorio. Las órdenes escritas no se guardan en un historial. No hay telemetría, micrófono ni conexión a un modelo de IA en esta versión. Para pruebas aisladas puede definirse `MIKUAI_DATA_DIR` con una carpeta de datos alternativa.

- `src/main.cjs`: ventana transparente, bandeja, atajo e IPC.
- `src/preload.cjs`: interfaz limitada entre la ventana y el proceso principal.
- `src/core.cjs`: ajustes, saludo y posición.
- `src/commands.cjs`: intérprete local de órdenes, catálogo de expresiones y ejemplos.
- `src/voice.cjs` y `scripts/windows-voice.ps1`: adaptador de voz local; el texto se envía como JSON por stdin, sin interpolarlo en comandos.
- `src/renderer/`: interfaz en español y animaciones.
- `assets/`: personaje e iconos locales. [Procedencia y prompts](docs/assets.md).

El renderer usa aislamiento de contexto, sandbox, una política de contenido local y permisos denegados. No expone Node.js ni permite navegar a páginas externas.

## Siguientes pasos

1. Elegir contigo el estilo final del personaje y pasar a un modelo animado si hace falta.
2. Integrar un motor o banco de voz compatible y autorizado para acercarnos a la voz de Miku.
3. Incorporar conversación y nuevas acciones concretas, y después reconocimiento de voz si lo elegimos.

Proyecto de fan independiente, sin afiliación con Crypton Future Media. Hatsune Miku y sus elementos asociados pertenecen a sus respectivos titulares. La ilustración generada no otorga derechos sobre el personaje; antes de distribuir comercialmente, habrá que revisar las condiciones aplicables. No se incluye un banco de voz propietario. El código aún no tiene una licencia de redistribución elegida.
