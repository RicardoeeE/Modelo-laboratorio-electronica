// H(jω) = jωRC/(1+jωRC) — first-order RC high-pass filter
export function compute(inputSamples, params, psu, sampleRate) {
  const R = params.R ?? 1000;
  const C = params.C ?? 1e-7;
  const wc = 1 / (R * C);
  const dt = 1 / sampleRate;
  const alpha = Math.exp(-dt * wc);

  const output = new Float32Array(inputSamples.length);
  output[0] = 0;
  for (let i = 1; i < inputSamples.length; i++) {
    output[i] = alpha * (output[i - 1] + inputSamples[i] - inputSamples[i - 1]);
  }

  return { ch1: inputSamples, ch2: output };
}
