# Decisiones

Append-only. Una entrada por decisión, con fecha (norma: `dev-meta/NORMAS.md`).

## 2026-10-29 — Se abre el registro
Repo público a propósito (simulador web); excepción apuntada en `dev-meta/NORMAS.md`.

## 2026-11-06 — Medidas contrastadas con el cálculo y lavado de diseño
- **Fase:** se mide con la fundamental de ambos canales en ciclos enteros; la correlación anterior daba +90° donde tocaba −45°. Sin señal, muestra «—».
- **Frecuencia:** periodo entre flancos interpolados; dividir por la duración del buffer daba un 6,7 % de menos.
- **Régimen permanente:** el motor simula ciclos enteros previos al tramo visible (al menos 5 constantes de tiempo, con tope de 200 000 muestras), porque el transitorio inflaba el Vpp.
- **Modelos:** paso bajo e integrador usan el trapecio; sin él, la salida se adelantaba medio muestreo (1,1°).
- **Textos:** el integrador inversor adelanta +90° y el diferenciador inversor retrasa −90°; estaban al revés.
- **Diseño:** tipografía de sistema, tokens de color, lista agrupada, botones reales en la lista, y diseño apilado en pantallas estrechas. Sin dependencias nuevas.

## 2026-11-06 — La ayuda de IA se declara
- El README dice que el proyecto se ha hecho con ayuda de IA y qué medidas están contrastadas con la teoría.
- `CLAUDE.md` se reduce a lo que sirve en este repo.

## 2026-11-06 — Protoboard por conexión real y transistor contrastado
- **Protoboard:** el detector compara con los 11 experimentos mirando nodos, cables, carriles, Gen, CH2, polaridad y pines. No se hace un resolvedor MNA general: costaría mucho más y los modelos del motor ya están contrastados. Otro montaje no da señal en CH2 y lo dice.
- **Carriles:** arriba V+ y abajo GND, cada uno un solo nodo. El de la KBH GL-23 real tiene dos líneas por carril; aquí se simplifica a una.
- **Montajes de referencia:** cada experimento enseña el suyo, y las pruebas los pasan por el detector. Así guía, placa y motor no pueden divergir sin que falle una prueba.
- **Emisor común con RE sin desacoplar:** Av = −Rc/(re+RE) ≈ −4,6. El motor daba −gm·Rc ≈ −256 mientras la guía decía −4,7. Se sigue a la guía porque es el circuito que describe; RE desacoplada queda fuera.
- **Disparo:** lo manda CH1 para los dos canales. Con un disparo por canal las trazas salían alineadas y el desfase medido no se veía.
- **Señales exactas:** cuadrada y triangular dejan de ser series de Fourier truncadas, que daban +18 % de Vpp por Gibbs.
- **Sin licencia todavía:** pendiente de confirmar de quién es `data/theory.json`.

## 2026-11-06 — Paso alto exacto y barrido de frecuencias
- **Paso alto:** la fórmula `α(y + Δx)` solo vale si dt ≪ τ: daba −50 % de Vpp a 50 Hz y CH2 plano con τ muy pequeña. Se usa la solución exacta para entrada lineal en cada paso. No se usa la bilineal porque, con τ ≪ dt, su polo cerca de −1 deja una oscilación que tarda en apagarse.
- **Pruebas:** cada circuito lineal se compara con H(jω) de 50 Hz a 100 kHz, no solo en el corte, que era donde el fallo quedaba dentro de la tolerancia.
