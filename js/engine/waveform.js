const SAMPLES_PER_CYCLE = 160;
const MIN_SAMPLE_RATE = 8000;
const MIN_BUFFER = 1200;
const MAX_BUFFER = 400000;

export function computeSampleRate(freq) {
  return Math.max(MIN_SAMPLE_RATE, freq * SAMPLES_PER_CYCLE);
}

// Muestras por calcular: al menos 6 ciclos y, si se pide, la ventana visible mas 2 ciclos
// para que el disparo tenga donde buscar sin cortar la traza.
export function computeBufferSize(freq, sampleRate, cycles = 6, windowSeconds = 0) {
  const perCycle = sampleRate / freq;
  const needed = Math.max(MIN_BUFFER, cycles * perCycle, windowSeconds * sampleRate + 2 * perCycle);
  return Math.round(Math.min(MAX_BUFFER, needed));
}

// Formas exactas, sin serie de Fourier: truncarla daba +18 % de Vpp en la cuadrada (Gibbs).
export function generateSamples(freq, amplitude, waveform, offset, sampleRate, numSamples) {
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const cycle = freq * i / sampleRate;
    const p = cycle - Math.floor(cycle);
    let v;

    switch (waveform) {
      case 'square':
        v = p < 0.5 ? amplitude : -amplitude;
        break;
      case 'triangle':
        if (p < 0.25) v = 4 * amplitude * p;
        else if (p < 0.75) v = amplitude * (2 - 4 * p);
        else v = amplitude * (4 * p - 4);
        break;
      default:
        v = amplitude * Math.sin(2 * Math.PI * cycle);
    }

    samples[i] = v + offset;
  }

  return samples;
}
