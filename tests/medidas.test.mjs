// Contrasta las medidas del osciloscopio con el calculo. Ejecutar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measureFrequency, measurePhase, measureVpp, measureVmax, measureVmin, visibleWindow, chooseVdiv,
} from '../js/engine/measurements.js';
import { computeOutput } from '../js/engine/circuit-engine.js';
import { generateSamples } from '../js/engine/waveform.js';
import { operatingPoint } from '../js/experiments/circuits/bjt-common-emitter.js';

const seno = (f, sr, n, fase = 0, amp = 1, offset = 0) => Float32Array.from(
  { length: n }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr + fase) + offset);
const cerca = (real, esperado, tol, nombre) =>
  assert.ok(Math.abs(real - esperado) <= tol, `${nombre}: ${real} frente a ${esperado} (tol ${tol})`);
const grados = rad => rad * 180 / Math.PI;

test('frecuencia exacta aunque el buffer no tenga ciclos enteros', () => {
  for (const f of [50, 249, 1592, 20000]) {
    const sr = Math.max(8000, f * 160);
    cerca(measureFrequency(seno(f, sr, 1200), sr), f, f * 1e-3, `f=${f}`);
  }
});

test('frecuencia con continua y con senal plana', () => {
  cerca(measureFrequency(seno(249, 39840, 1200, 0, 1, 3), 39840), 249, 0.3, 'offset');
  assert.equal(measureFrequency(new Float32Array(1200), 39840), 0);
});

test('fase: signo, adelanto, retraso e inversion', () => {
  for (const fase of [-170, -90, -45, -8.9, 0, 45, 90, 170]) {
    const ch2 = seno(249, 39840, 1200, fase * Math.PI / 180, 0.5);
    cerca(measurePhase(seno(249, 39840, 1200), ch2, 39840), fase, 0.2, `${fase}`);
  }
  cerca(Math.abs(measurePhase(seno(249, 39840, 1200), seno(249, 39840, 1200, Math.PI), 39840)), 180, 0.2, 'inversion');
});

test('fase indefinida sin senal', () => {
  const plana = new Float32Array(1200);
  assert.equal(measurePhase(seno(249, 39840, 1200), plana, 39840), null);
  assert.equal(measurePhase(plana, seno(249, 39840, 1200), 39840), null);
});

function circuito(id, params, f, amp = 1) {
  const { ch1, ch2, sampleRate } = computeOutput({
    fg: { freq: f, amplitude: amp, waveform: 'sine', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: id, params },
  });
  return { f: measureFrequency(ch1, sampleRate), fase: measurePhase(ch1, ch2, sampleRate), vpp: measureVpp(ch2) };
}

const FC_RC = 1 / (2 * Math.PI * 1000 * 1e-7);
const FC_RL = 100 / (2 * Math.PI * 0.01);
const W = 2 * Math.PI * 249;
const CASOS = [
  ['RC paso bajo, corte', 'rc-lowpass', { R: 1000, C: 1e-7 }, FC_RC, -45, 2 / Math.SQRT2],
  ['RC paso bajo, 249 Hz', 'rc-lowpass', { R: 1000, C: 1e-7 }, 249, grados(-Math.atan(249 / FC_RC)), 2 / Math.hypot(1, 249 / FC_RC)],
  ['RC paso alto, corte', 'rc-highpass', { R: 1000, C: 1e-7 }, FC_RC, 45, 2 / Math.SQRT2],
  ['RL paso bajo, corte', 'rl-lowpass', { R: 100, L: 0.01 }, FC_RL, -45, 2 / Math.SQRT2],
  ['RL paso alto, corte', 'rl-highpass', { R: 100, L: 0.01 }, FC_RL, 45, 2 / Math.SQRT2],
  // Vout = -(1/RC) integral de Vin: una entrada sin(wt) da +cos(wt), es decir, adelanta 90.
  // Con Rf en paralelo con C, H = -(Rf/R)/(1 + jwRfC): angulo 180 - atan(wRfC).
  ['Integrador inversor', 'opamp-integrator', { R: 10000, C: 1e-7, Rf: 1e6 }, 249,
    180 - grados(Math.atan(W * 0.1)), 2 / (W * 1e-3)],
  // Vout = -RC dVin/dt: sin(wt) da -cos(wt), retrasa 90. Rs anade un polo.
  ['Diferenciador inversor', 'opamp-differentiator', { R: 10000, C: 1e-7, Rs: 100 }, 249,
    -90 - grados(Math.atan(W * 100 * 1e-7)), 2 * W * 1e-3 / Math.hypot(1, W * 100 * 1e-7)],
];

for (const [nombre, id, params, f, fase, vpp] of CASOS) {
  test(`circuito: ${nombre}`, () => {
    const r = circuito(id, params, f);
    cerca(r.f, f, f * 2e-3, 'frecuencia');
    cerca(r.fase, fase, 1, 'fase');
    cerca(r.vpp, vpp, vpp * 0.03, 'Vpp');
  });
}

test('amplificadores: inversor a 180 y no inversor en fase', () => {
  cerca(Math.abs(circuito('opamp-inverting', { Rin: 10000, Rf: 100000 }, 1000, 0.5).fase), 180, 1.5, 'inversor');
  cerca(circuito('opamp-noninverting', { R1: 10000, Rf: 90000 }, 1000, 0.5).fase, 0, 1.5, 'no inversor');
});

// ── Transistor: punto de trabajo (Thevenin de la base) y ganancia contra la formula ──
const BJT = { R1: 100000, R2: 22000, Rc: 4700, RE: 1000, beta: 200 };
const VCC12 = { vPos: 12, vNeg: -15 };

function bjtTeoria({ R1, R2, Rc, RE, beta }, vcc) {
  const Rth = R1 * R2 / (R1 + R2);
  const IB = (vcc * R2 / (R1 + R2) - 0.7) / (Rth + (beta + 1) * RE);
  const IC = beta * IB;
  const VE = (beta + 1) * IB * RE;
  return { IC, VE, VB: VE + 0.7, VCE: vcc - IC * Rc - VE, Av: -beta * Rc / (beta * 0.026 / IC + (beta + 1) * RE) };
}

function bjt(amp, { params = BJT, f = 1000, psu = VCC12 } = {}) {
  const { ch1, ch2, sampleRate } = computeOutput({
    fg: { freq: f, amplitude: amp, waveform: 'sine', offset: 0, enabled: true },
    psu,
    circuit: { activeExperiment: 'bjt-common-emitter', params },
  });
  return { fase: measurePhase(ch1, ch2, sampleRate), vpp: measureVpp(ch2) };
}

test('transistor: punto de trabajo de la guia (VB 2,04 V, IC 1,34 mA, VCE 4,4 V)', () => {
  const op = operatingPoint(BJT, 12);
  const t = bjtTeoria(BJT, 12);
  assert.equal(op.region, 'activa');
  cerca(op.IC, t.IC, 1e-9, 'IC');
  cerca(op.IC, 1.34e-3, 0.01e-3, 'IC de la guia');
  cerca(op.VB, 2.04, 0.01, 'VB de la guia');
  cerca(op.VC - op.VE, t.VCE, 1e-6, 'VCE');
  cerca(op.VC - op.VE, 4.4, 0.05, 'VCE de la guia');
});

test('transistor: ganancia −Rc/(re+RE) e inversion, no −gm·Rc', () => {
  const t = bjtTeoria(BJT, 12);
  cerca(t.Av, -4.59, 0.01, 'Av teorica');
  const r = bjt(0.02);
  const esperado = 2 * 0.02 * Math.abs(t.Av);
  cerca(r.vpp, esperado, esperado * 0.02, 'Vpp a 20 mVp');
  cerca(Math.abs(r.fase), 180, 0.5, 'inversion a 1 kHz');
});

test('transistor: la ganancia casi no depende de beta (RE sin desacoplar)', () => {
  for (const beta of [100, 400]) {
    const esperado = 0.04 * Math.abs(bjtTeoria({ ...BJT, beta }, 12).Av);
    cerca(bjt(0.02, { params: { ...BJT, beta } }).vpp, esperado, esperado * 0.02, `beta ${beta}`);
    cerca(esperado / 0.04, 4.59, 0.1, `Av con beta ${beta}`);
  }
});

test('transistor: recorte en saturacion y en corte donde dice la guia', () => {
  const op = operatingPoint(BJT, 12);
  const vcSat = 12 - (12 - 0.2) / (BJT.Rc + BJT.RE) * BJT.Rc;
  cerca(op.vcMin, vcSat, 1e-6, 'VC de saturacion');
  cerca((op.VC - vcSat) / Math.abs(op.Av), 0.75, 0.03, 'Vin al que empieza a saturar');
  cerca((12 - op.VC) / Math.abs(op.Av), 1.4, 0.05, 'Vin al que empieza a cortar');
  // Por debajo sigue lineal; con los dos recortes, el Vpp queda limitado a Vcc − VCsat.
  cerca(bjt(0.6).vpp, 1.2 * Math.abs(op.Av), 0.06, 'lineal a 0,6 Vp');
  cerca(bjt(5).vpp, 12 - vcSat, 0.05, 'recorte total');
});

test('transistor: fuera de zona activa no hay ganancia', () => {
  assert.equal(operatingPoint({ ...BJT, Rc: 20000 }, 12).region, 'saturacion');
  assert.equal(bjt(0.02, { params: { ...BJT, Rc: 20000 } }).vpp, 0);
  assert.equal(operatingPoint(BJT, 3).region, 'corte');
  assert.equal(bjt(0.02, { psu: { vPos: 3, vNeg: -15 } }).vpp, 0);
});

test('transistor: el condensador de entrada solo influye a muy baja frecuencia', () => {
  const op = operatingPoint(BJT, 12);
  cerca(1 / (2 * Math.PI * op.Rin * 10e-6), 0.96, 0.01, 'fc de entrada');
});

// ── Rectificadores ──
function rect(id, params, amp, f = 50) {
  const { ch1, ch2, sampleRate } = computeOutput({
    fg: { freq: f, amplitude: amp, waveform: 'sine', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: id, params },
  });
  // Media en ciclos enteros, para no sesgarla con un trozo de ciclo.
  const perCycle = Math.round(sampleRate / f);
  const n = Math.floor(ch2.length / perCycle) * perCycle;
  let suma = 0;
  for (let i = 0; i < n; i++) suma += ch2[i];
  return {
    f1: measureFrequency(ch1, sampleRate), f2: measureFrequency(ch2, sampleRate),
    fase: measurePhase(ch1, ch2, sampleRate), vpp: measureVpp(ch2),
    max: measureVmax(ch2), min: measureVmin(ch2), media: suma / n,
  };
}

// Media exacta de max(A·sen − Vd, 0) en un periodo: conduce entre a y pi − a.
const mediaExacta = (A, Vd) => {
  const a = Math.asin(Vd / A);
  return (2 * A * Math.cos(a) - Vd * (Math.PI - 2 * a)) / (2 * Math.PI);
};

test('media onda: pico Vin − 0,7, cero en el semiciclo negativo, media exacta y en fase', () => {
  for (const A of [5, 10, 2]) {
    const r = rect('diode-half-wave', { Rload: 10000, Csmooth: 0 }, A);
    cerca(r.max, A - 0.7, 1e-3, `pico ${A}`);
    assert.equal(r.min, 0);
    cerca(r.media, mediaExacta(A, 0.7), 0.01, `media ${A}`);
    cerca(r.f2, 50, 0.1, 'misma frecuencia');
    cerca(r.fase, 0, 0.1, 'en fase');
  }
});

test('media onda: por debajo de 0,7 V no conduce', () => {
  const r = rect('diode-half-wave', { Rload: 10000, Csmooth: 0 }, 0.5);
  assert.equal(r.vpp, 0);
  assert.equal(r.fase, null);
});

test('media onda con condensador: rizado V/(f·R·C)', () => {
  for (const [Rload, Csmooth] of [[10000, 1e-4], [1000, 1e-4], [1000, 4.7e-4]]) {
    const r = rect('diode-half-wave', { Rload, Csmooth }, 5);
    cerca(r.max, 4.3, 1e-3, 'pico');
    const teoria = 4.3 / (50 * Rload * Csmooth);
    cerca(r.vpp, teoria, teoria * 0.2, `rizado R=${Rload}`);
  }
});

test('puente: |Vin| − 1,4, frecuencia doble y sin fundamental', () => {
  for (const f of [50, 100, 1000]) {
    const r = rect('diode-full-wave', { Rload: 10000, Csmooth: 0 }, 10, f);
    cerca(r.max, 8.6, 1e-3, 'pico');
    assert.equal(r.min, 0);
    cerca(r.media, 2 * mediaExacta(10, 1.4), 0.02, 'media');
    cerca(r.f1, f, f * 1e-3, 'f CH1');
    cerca(r.f2, 2 * f, 2 * f * 1e-3, 'f CH2');
    assert.equal(r.fase, null, 'sin componente a la frecuencia de CH1 no hay fase');
  }
});

test('puente con condensador: rizado V/(2f·R·C), la mitad que en media onda', () => {
  const r = rect('diode-full-wave', { Rload: 1000, Csmooth: 1e-4 }, 10);
  const teoria = 8.6 / (2 * 50 * 1000 * 1e-4);
  cerca(r.vpp, teoria, teoria * 0.2, 'rizado');
  const media = rect('diode-half-wave', { Rload: 1000, Csmooth: 1e-4 }, 10);
  assert.ok(r.vpp < media.vpp * 0.6, `${r.vpp} frente a ${media.vpp}`);
});

// ── Señales del generador ──
test('generador: cuadrada y triangular dan el Vpp pedido y la fase del seno', () => {
  const seno160 = generateSamples(249, 1, 'sine', 0, 39840, 1600);
  for (const waveform of ['square', 'triangle']) {
    const s = generateSamples(249, 1, waveform, 0, 39840, 1600);
    cerca(measureVpp(s), 2, 1e-2, `Vpp ${waveform}`);
    cerca(measureFrequency(s, 39840), 249, 0.3, `f ${waveform}`);
    cerca(measurePhase(seno160, s, 39840), 0, 2.5, `fase ${waveform}`);
  }
});

test('integrador con cuadrada: triangular de Vpp = V·T/(2RC)', () => {
  const { ch2 } = computeOutput({
    fg: { freq: 249, amplitude: 1, waveform: 'square', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: 'opamp-integrator', params: { R: 10000, C: 1e-7, Rf: 1e6 } },
  });
  const teoria = 1 / 249 / (2 * 1e-3);
  cerca(measureVpp(ch2), teoria, teoria * 0.02, 'Vpp');
});

test('diferenciador con triangular: cuadrada de ±RC·4Af', () => {
  const { ch2 } = computeOutput({
    fg: { freq: 249, amplitude: 1, waveform: 'triangle', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: 'opamp-differentiator', params: { R: 10000, C: 1e-7, Rs: 100 } },
  });
  const teoria = 2 * 1e-3 * 4 * 249;
  cerca(measureVpp(ch2), teoria, teoria * 0.02, 'Vpp');
});

// ── Osciloscopio: lo que se ve en pantalla ──
test('pantalla: CH2 usa el disparo de CH1, asi que el desfase se ve', () => {
  const { ch1, ch2, sampleRate } = computeOutput({
    fg: { freq: 249, amplitude: 1, waveform: 'sine', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: 'opamp-integrator', params: { R: 10000, C: 1e-7, Rf: 1e6 } },
    scope: { timeDiv: 1e-3 },
  });
  const { start } = visibleWindow(ch1, sampleRate, 1e-3, 0);
  cerca(ch1[start], 0, 0.05, 'CH1 arranca en el disparo');
  // Integrador: CH2 adelanta casi 90, asi que esta cerca de su maximo cuando CH1 cruza cero.
  assert.ok(ch2[start] > 0.6, `CH2 en el disparo: ${ch2[start]}`);
});

test('pantalla: con t/div grande el buffer cubre la ventana y la traza no se corta', () => {
  for (const timeDiv of [5e-3, 0.02, 0.05]) {
    const { ch1, sampleRate } = computeOutput({
      fg: { freq: 249, amplitude: 1, waveform: 'sine', offset: 0, enabled: true },
      psu: { vPos: 15, vNeg: -15 },
      circuit: { activeExperiment: 'rc-lowpass', params: { R: 1000, C: 1e-7 } },
      scope: { timeDiv },
    });
    const { start, count } = visibleWindow(ch1, sampleRate, timeDiv, 0);
    assert.ok(start + count <= ch1.length, `t/div ${timeDiv}: ${start}+${count} de ${ch1.length}`);
    assert.ok(start > 0, `t/div ${timeDiv}: sin disparo`);
  }
});

test('pantalla: t/div muy pequeno todavia deja dos muestras para trazar', () => {
  const s = generateSamples(249, 1, 'sine', 0, 39840, 1600);
  assert.ok(visibleWindow(s, 39840, 1e-6, 0).count >= 2);
});

test('V/div automatico: la senal cabe y aprovecha la pantalla', () => {
  assert.equal(chooseVdiv(5), 2);
  assert.equal(chooseVdiv(10), 5);
  assert.equal(chooseVdiv(0.02), 0.01);
  assert.equal(chooseVdiv(1), 0.5);
  assert.equal(chooseVdiv(1000), 20);
});
