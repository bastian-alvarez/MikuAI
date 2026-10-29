# Recursos visuales

`assets/miku.png`: fan art de Hatsune Miku creado con la herramienta integrada de generación de imágenes. Recurso 2D provisional del prototipo; no es un modelo Live2D ni una ilustración oficial.

## Prompt inicial

> Use case: stylized-concept. Asset type: transparent character sprite for a Windows desktop companion app, fan art of Hatsune Miku. Full-body chibi Hatsune Miku, recognizable very long turquoise twin tails and pink black square hair accessories, teal eyes, gray sleeveless collared shirt with turquoise tie, black detached sleeves, short black pleated skirt with teal trim, black thigh-high boots. Charming refined anime illustration, crisp clean linework, soft cel shading, cool teal accents. Standing facing the viewer, cheerful warm smile, right hand raised in a small friendly wave; left hand relaxed. Entire character and all hair tips and boots fully visible with generous empty margin. Tall portrait composition. Transparent background with real alpha, no scene, no text, no watermark, no ground plane, no drop shadow. One character only. Keep silhouette compact so hair frames the body. Polished expressive face, tasteful cute chibi proportions, suitable as an idle desktop assistant.

## Edición para aislar el personaje

> Edit target: the attached Miku character image. Precise background extraction: remove the entire black background and all turquoise/blue background glow or halo. Output a clean isolated full-body character cutout with actual alpha transparency, no background pixels, no rectangular fill and no drop shadow. Keep the exact character design, face, pose, clothing, all twin-tail strands and boots, and the original illustration quality unchanged. Add a small transparent margin around all edges so hair and shoes do not touch the canvas.

`assets/tray.png` y `assets/icon.ico`: iconos geométricos originales, dibujados con código. No contienen ilustraciones oficiales.

## Expresiones · 0.2.0

Se generaron seis variantes con la herramienta integrada `image_gen`, en modo edición, usando `assets/miku.png` como referencia. Se mantuvieron pose, encuadre, ropa, cabello y proporciones; el cambio se concentra en el rostro. Todos los PNG tienen canal alfa y conservan las dimensiones 1024 × 1536.

| Archivo | Expresión |
| --- | --- |
| `assets/expressions/shy.png` | Tímida: mirada ligeramente desviada y sonrisa pequeña |
| `assets/expressions/blush.png` | Sonrojada: rubor intenso y gesto avergonzado |
| `assets/expressions/happy.png` | Feliz: ojos cerrados y gran sonrisa |
| `assets/expressions/surprised.png` | Sorprendida: ojos abiertos y boca en «O» |
| `assets/expressions/pout.png` | Enfurruñada: mejillas infladas y puchero |
| `assets/expressions/sleepy.png` | Soñolienta: ojos entrecerrados y bostezo |

La expresión normal sigue usando la ilustración original sin reemplazarla. Los prompts completos y las rutas finales de cada variante están en [expression-prompts.json](expression-prompts.json).
