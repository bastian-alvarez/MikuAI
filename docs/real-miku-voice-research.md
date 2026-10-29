# Voz auténtica de Hatsune Miku: investigación y prueba propuesta

Fecha de consulta: **29 de octubre de 2026**. Partimos sin un banco oficial comprado o instalado. Este documento describe hallazgos y una propuesta; todavía no se ha instalado un motor ni sustituido la voz de Windows de MikuAI.

## Qué podemos usar

Los bancos oficiales permiten sintetizar la voz de Miku mediante sus editores de canto. No encontré en la documentación consultada una API oficial pública de Miku para convertir texto libre en habla desde una aplicación. Esto no demuestra que no existan acuerdos privados de integración. Tener un banco de canto tampoco equivale a tener un servicio de TTS conversacional.

| Opción | Idiomas anunciados y editor | Prueba disponible | Interés para MikuAI |
| --- | --- | --- | --- |
| [Hatsune Miku V6](https://sonicwire.com/product/virtualsinger/special/miku-v6?lang=en) | Japonés e inglés; chino anunciado para una actualización futura. El producto de banco de voz incluye VOCALOID6 Editor Lite; el Starter Pack incluye el editor completo. | [Banco Miku V6: 31 días](https://sonicwire.com/product/C9520). Requiere un editor compatible. | Probar el timbre y la pronunciación de frases. No anuncia español nativo. |
| [Hatsune Miku NT Ver.2](https://sonicwire.com/product/virtualsinger/special/mikunt?lang=en) | Biblioteca japonesa, con Piapro Studio NT2. | [NT Trial: 39 días](https://sonicwire.com/product/C7313), con la biblioteca Original++. | Prueba de voz en japonés dentro de su propio entorno de edición. |

Para empezar con V6 desde cero también está la [prueba oficial de VOCALOID6 Editor de 31 días](https://www.vocaloid.com/en/vocaloid6/trial/). Instalar únicamente la demo del editor no proporciona por sí solo el banco de Miku: son dos descargas distintas. La duración de una demo no implica permiso para redistribuir el software o sus resultados.

Como referencia de presupuesto, el [catálogo de SONICWIRE](https://sonicwire.com/product/vi/engine/56) mostraba ¥10.780 para Miku V6 Voicebank y ¥24.200 para Starter Pack. Son precios publicados en yenes, sujetos a cambios y a las condiciones de compra; no he calculado conversión a pesos chilenos ni un coste final. No hace falta comprar para la primera evaluación.

## Habla y español

Mi inferencia técnica es que conviene preparar pronunciación, duraciones y entonación en el editor para conseguir una frase hablada convincente. No debemos asumir que escribir español en el campo de letra produzca español natural: ninguno de los dos productos consultados anuncia un banco español.

Para la evaluación propongo:

1. Una frase japonesa corta, por ejemplo `おかえりなさい` (bienvenido de vuelta), para escuchar el timbre sin añadir el problema de otro idioma.
2. `Bienvenido, Bastián-sama`, ajustando pronunciación y entonación. Escuchar el resultado antes de dar por resuelto el español.
3. Comparar inteligibilidad, parecido con la Miku que buscamos y tiempo de preparación.

La valoración de naturalidad está pendiente: no se ha generado ni escuchado una muestra con estos bancos en este proyecto.

## Integración gradual propuesta

### Primero: frases preparadas

Preparar unas pocas frases en el editor y evaluar su reproducción local desde MikuAI. A nivel de código, un proveedor de clips podría devolver audio al mismo reproductor que hoy recibe los WAV de `WindowsVoice` en `src/voice.cjs`.

Esto serviría para saludos y reacciones concretas. Un nombre nuevo necesitaría su propia síntesis; la hora, la fecha y «repite esta frase» tampoco quedan resueltas por una colección fija de clips. El programa debe distinguir estas limitaciones y el proveedor seleccionado. Esta integración todavía no está implementada.

### Después: generación de cada respuesta

Encontré [YMM4VocaloidBridge](https://github.com/akina910/YMM4VocaloidBridge), un proyecto no oficial en beta que propone generar diálogo japonés con bancos V6 instalados por el usuario. Su [prueba publicada](https://github.com/akina910/YMM4VocaloidBridge/blob/main/docs/M0_FEASIBILITY_EVIDENCE.md) describe importar MIDI con letra y exportar WAV mediante el editor; también documenta automatización de la interfaz de Windows.

Es una referencia técnica, no una API oficial ni una integración probada en nuestro PC. Su alcance inicial es japonés y su existencia no confirma permiso para cualquier uso del banco. Antes de adoptarlo habría que evaluar estabilidad, latencia, compatibilidad, mantenimiento e idoneidad para una asistente. No se descargó ni ejecutó su código.

Además, SONICWIRE indica que [Miku V6 no es compatible con VOCALO CHANGER](https://sonicwire.com/product/virtualsinger/special/miku-v6?lang=en). No debemos basar la solución en convertir automáticamente la voz de Windows mediante esa función.

## Qué publicar en GitHub

El código de la integración y la documentación pueden mantenerse separados de bancos, instaladores y datos de activación. Para este proyecto propongo que los recursos de voz propios del usuario permanezcan locales mientras se confirma el uso previsto.

Las [reglas oficiales de Piapro](https://piapro.jp/contents_rules/) remiten a las licencias de cada producto para el software y los audios sintetizados. Las condiciones de ilustraciones del personaje no sustituyen esas licencias. Para NT existe una [EULA pública](https://ec.crypton.co.jp/download/pdf/eula_virtualsinger.pdf); para V6 la [guía de instalación](https://sonicwire.com/support/detail?id=3517) muestra la aceptación de su EULA específica.

No se ha confirmado todavía que podamos distribuir clips como parte de MikuAI. Antes de incluirlos en un ejecutable o repositorio público hay que comprobar las condiciones exactas de la versión utilizada y del uso en una aplicación; una prueba técnica local no resuelve ese punto.

## Decisión propuesta

Empezar con las demos de Miku V6 y VOCALOID6 Editor y evaluar las dos frases. Si el resultado convence, elegir la licencia y el método de integración. NT sigue siendo alternativa si priorizamos una experiencia principalmente japonesa. No comprar un producto contando con una API de habla o soporte español que las fuentes consultadas no confirman.
