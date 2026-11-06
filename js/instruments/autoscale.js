import { getState, setScope, setScopeCh1, setScopeCh2 } from '../state.js';
import { computeOutput } from '../engine/circuit-engine.js';
import { chooseVdiv } from '../engine/measurements.js';

const MIN_SIGNAL = 1e-6;

function _peak(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
}

// Al cargar un circuito, deja cada canal a una escala en la que la senal se vea entera.
export function autoscale() {
  const { ch1, ch2 } = computeOutput(getState());
  const peak1 = _peak(ch1), peak2 = _peak(ch2);
  setScopeCh1({ position: 0, ...(peak1 > MIN_SIGNAL && { vdiv: chooseVdiv(peak1) }) });
  setScopeCh2({ position: 0, ...(peak2 > MIN_SIGNAL && { vdiv: chooseVdiv(peak2) }) });
  setScope({ triggerLevel: 0 });
}
