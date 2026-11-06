const MIN_SIGNAL = 1e-6;   // V: por debajo no hay senal que medir
const MAX_DFT_SAMPLES = 20000;

function _mean(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i];
  return sum / samples.length;
}

// Periodo medio entre el primer y el ultimo flanco de subida, interpolando el cruce.
// Dividir por la duracion del buffer da error si no contiene ciclos enteros.
export function measureFrequency(samples, sampleRate) {
  const level = _mean(samples);
  let first = -1, last = -1, crossings = 0;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] - level;
    const b = samples[i] - level;
    if (a < 0 && b >= 0) {
      const at = i - 1 + a / (a - b);
      if (first < 0) first = at;
      last = at;
      crossings++;
    }
  }

  if (crossings < 2 || last <= first) return 0;
  return (crossings - 1) * sampleRate / (last - first);
}

export function measureVpp(samples) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
    if (samples[i] > max) max = samples[i];
  }
  return max - min;
}

export function measureVmax(samples) {
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > max) max = samples[i];
  }
  return max;
}

export function measureVmin(samples) {
  let min = Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
  }
  return min;
}

export function measureRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// Componente fundamental (sin continua) de un tramo de la senal.
function _fundamental(samples, start, count, cycles) {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += samples[start + i];
  const level = sum / count;
  const w = 2 * Math.PI * cycles / count;
  let re = 0, im = 0;
  for (let i = 0; i < count; i++) {
    const v = samples[start + i] - level;
    re += v * Math.cos(w * i);
    im -= v * Math.sin(w * i);
  }
  return { re, im, amplitude: 2 * Math.hypot(re, im) / count };
}

// Fase de CH2 respecto a CH1 en (-180, 180]: positiva si CH2 adelanta.
// Se mide la fundamental en los ultimos ciclos enteros, ya sin transitorio.
// Devuelve null si alguna senal no tiene componente a esa frecuencia.
export function measurePhase(ch1, ch2, sampleRate) {
  const freq = measureFrequency(ch1, sampleRate);
  if (freq <= 0) return null;

  const len = Math.min(ch1.length, ch2.length);
  const perCycle = sampleRate / freq;
  const available = Math.floor(len / perCycle);
  if (available < 1) return null;

  const cycles = Math.max(1, Math.min(available, Math.floor(MAX_DFT_SAMPLES / perCycle)));
  const count = Math.round(cycles * perCycle);
  const start = len - count;
  const a = _fundamental(ch1, start, count, cycles);
  const b = _fundamental(ch2, start, count, cycles);
  if (a.amplitude < MIN_SIGNAL || b.amplitude < MIN_SIGNAL) return null;

  // Producto conjugado: el resultado sale directamente en (-180, 180].
  return Math.atan2(b.im * a.re - b.re * a.im, b.re * a.re + b.im * a.im) * 180 / Math.PI;
}

export function findTriggerPoint(samples, level, slope = 'rising', searchLimit = null) {
  const limit = searchLimit ?? samples.length - 1;
  for (let i = 1; i < limit; i++) {
    if (slope === 'rising' && samples[i - 1] < level && samples[i] >= level) return i;
    if (slope === 'falling' && samples[i - 1] > level && samples[i] <= level) return i;
  }
  return 0;
}
