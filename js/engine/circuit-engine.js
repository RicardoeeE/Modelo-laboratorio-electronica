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

export function computeOutput(state) {
  const { fg, psu, circuit } = state;

  const sampleRate  = computeSampleRate(fg.freq);
  const bufferSize  = computeBufferSize(fg.freq, sampleRate);

  const inputSamples = fg.enabled
    ? generateSamples(fg.freq, fg.amplitude, fg.waveform, fg.offset, sampleRate, bufferSize)
    : new Float32Array(bufferSize);

  const computeFn = circuitMap[circuit.activeExperiment];

  if (!computeFn) {
    return {
      ch1: inputSamples,
      ch2: new Float32Array(bufferSize),
      sampleRate
    };
  }

  const { ch1, ch2 } = computeFn(inputSamples, circuit.params, psu, sampleRate);

  return { ch1, ch2, sampleRate };
}

export { circuitMap };
