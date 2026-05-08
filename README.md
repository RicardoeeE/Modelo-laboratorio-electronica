# Lab Virtual de Electrónica

Simulador web interactivo de laboratorio de electrónica analógica.

## Equipos simulados

| Equipo | Modelo real |
|---|---|
| Osciloscopio de 2 canales | RS PRO RSDS 1052DL+ |
| Fuente triple de alimentación | HAMEG HM 8030-5 |
| Generador de funciones | HAMEG HM 8030 |
| Protoboard | KBH GL-23 |

## Experimentos incluidos

1. Filtro RC Paso Bajo
2. Filtro RC Paso Alto
3. Filtro RL Paso Bajo
4. Filtro RL Paso Alto
5. Amplificador Inversor (Op-Amp)
6. Amplificador No Inversor (Op-Amp)
7. **Integrador con Op-Amp** ← circuito del laboratorio real
8. Diferenciador con Op-Amp
9. Amplificador Emisor Común (BJT)
10. Rectificador de Media Onda
11. Rectificador de Onda Completa (Puente)

Cada experimento incluye guía paso a paso, parámetros ajustables en tiempo real,
y medidas automáticas en el osciloscopio (frecuencia, Vpp CH1/CH2, desfase de fase).

## Cómo usar

```bash
# Cualquier servidor HTTP estático funciona:
python3 -m http.server 8080
# Luego abre http://localhost:8080
```

> **No** abrir con `file://` — los ES Modules requieren HTTP.

## Tecnología

- HTML5 + CSS3 + JavaScript ES Modules puro — sin frameworks ni build tools
- Canvas API para el osciloscopio (persistencia de fósforo, grid CRT)
- Motor analítico de circuitos (filtros IIR digitales equivalentes a H(jω))
