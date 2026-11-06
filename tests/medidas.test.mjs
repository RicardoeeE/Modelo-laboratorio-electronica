// Contrasta las medidas del osciloscopio con el calculo. Ejecutar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { measureFrequency, measurePhase, measureVpp } from '../js/engine/measurements.js';
import { computeOutput } from '../js/engine/circuit-engine.js';

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
