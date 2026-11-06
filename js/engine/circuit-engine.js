import { generateSamples, computeSampleRate, computeBufferSize } from './waveform.js';
import { compute as rcLowpass }       from '../experiments/circuits/rc-lowpass.js';
import { compute as rcHighpass }      from '../experiments/circuits/rc-highpass.js';
import { compute as rlLowpass }       from '../experiments/circuits/rl-lowpass.js';
import { compute as rlHighpass }      from '../experiments/circuits/rl-highpass.js';
import { compute as opampInverting }  from '../experiments/circuits/opamp-inverting.js';
import { compute as opampNonInv }     from '../experiments/circuits/opamp-noninverting.js';
import { compute as opampIntegrator } from '../experiments/circuits/opamp-integrator.js';
import { compute as opampDiff }       from '../experiments/circuits/opamp-differentiator.js';
import { compute as bjtCE }           from '../experiments/circuits/bjt-common-emitter.js';
import { compute as diodeHalf }       from '../experiments/circuits/diode-half-wave.js';
import { compute as diodeFull }       from '../experiments/circuits/diode-full-wave.js';

const SETTLE_TAUS = 5;
const MIN_SETTLE_CYCLES = 2;
const MAX_SETTLE_SAMPLES = 200000;

const circuitMap = {
  'rc-lowpass':          rcLowpass,
  'rc-highpass':         rcHighpass,
  'rl-lowpass':          rlLowpass,
  'rl-highpass':         rlHighpass,
  'opamp-inverting':     opampInverting,
  'opamp-noninverting':  opampNonInv,
  'opamp-integrator':    opampIntegrator,
  'opamp-differentiator':opampDiff,
  'bjt-common-emitter':  bjtCE,
  'diode-half-wave':     diodeHalf,
  'diode-full-wave':     diodeFull,
};

// Constante de tiempo dominante, para arrancar el osciloscopio en regimen permanente.
function _settlingTau(id, p) {
  switch (id) {
    case 'rc-lowpass':
    case 'rc-highpass':          return (p.R ?? 1000) * (p.C ?? 1e-7);
    case 'rl-lowpass':
    case 'rl-highpass':          return (p.L ?? 0.01) / (p.R ?? 100);
    case 'opamp-integrator':     return (p.Rf ?? 1e6) * (p.C ?? 1e-7);
    case 'opamp-differentiator': return (p.Rs ?? 100) * (p.C ?? 1e-7);
    case 'diode-half-wave':
    case 'diode-full-wave':      return (p.Rload ?? 10000) * (p.Csmooth ?? 0);
    default:                     return 0;
  }
}

// Ciclos enteros previos al tramo visible: asi CH1 conserva su fase y CH2 ya no lleva transitorio.
function _settlingSamples(id, params, freq, sampleRate) {
  const cycles = Math.max(MIN_SETTLE_CYCLES, Math.ceil(SETTLE_TAUS * _settlingTau(id, params) * freq));
  const perCycle = sampleRate / freq;
  return Math.round(Math.min(cycles, Math.max(1, Math.floor(MAX_SETTLE_SAMPLES / perCycle))) * perCycle);
}

export function computeOutput(state) {
  const { fg, psu, circuit } = state;

  const sampleRate  = computeSampleRate(fg.freq);
  const bufferSize  = computeBufferSize(fg.freq, sampleRate, 6, (state.scope?.timeDiv ?? 0) * 10);
  const computeFn   = circuitMap[circuit.activeExperiment];

  if (!fg.enabled || !computeFn) {
    const ch1 = fg.enabled
      ? generateSamples(fg.freq, fg.amplitude, fg.waveform, fg.offset, sampleRate, bufferSize)
      : new Float32Array(bufferSize);
    if (!computeFn) return { ch1, ch2: new Float32Array(bufferSize), sampleRate };
    const { ch2 } = computeFn(ch1, circuit.params, psu, sampleRate);
    return { ch1, ch2, sampleRate };
  }

  const settle = _settlingSamples(circuit.activeExperiment, circuit.params, fg.freq, sampleRate);
  const total  = settle + bufferSize;
  const input  = generateSamples(fg.freq, fg.amplitude, fg.waveform, fg.offset, sampleRate, total);
  const { ch1, ch2 } = computeFn(input, circuit.params, psu, sampleRate);

  return { ch1: ch1.subarray(settle), ch2: ch2.subarray(settle), sampleRate };
}

export { circuitMap };
