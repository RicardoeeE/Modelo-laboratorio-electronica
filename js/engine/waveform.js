const N_HARMONICS = 20;
const MIN_SAMPLE_RATE = 8000;

export function computeSampleRate(freq) {
  return Math.max(MIN_SAMPLE_RATE, freq * N_HARMONICS * 2 * 4);
}

export function computeBufferSize(freq, sampleRate, cycles = 6) {
  return Math.max(1200, Math.round(cycles * sampleRate / freq));
}

export function generateSamples(freq, amplitude, waveform, offset, sampleRate, numSamples) {
  const samples = new Float32Array(numSamples);
  const dt = 1 / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    let v = 0;

    switch (waveform) {
      case 'sine':
        v = amplitude * Math.sin(2 * Math.PI * freq * t);
        break;
      case 'square':
        for (let n = 1; n <= N_HARMONICS * 2 - 1; n += 2) {
          v += (4 * amplitude / (n * Math.PI)) * Math.sin(2 * Math.PI * n * freq * t);
        }
        break;
      case 'triangle':
        for (let n = 1; n <= N_HARMONICS * 2 - 1; n += 2) {
          const sign = Math.pow(-1, (n - 1) / 2);
          v += sign * (8 * amplitude / (Math.PI * Math.PI * n * n)) * Math.sin(2 * Math.PI * n * freq * t);
        }
        break;
      default:
        v = amplitude * Math.sin(2 * Math.PI * freq * t);
    }

    samples[i] = v + offset;
  }

  return samples;
}
