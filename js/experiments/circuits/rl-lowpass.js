// H(jω) = R/(R+jωL) — RL low-pass (voltage across R)
export function compute(inputSamples, params, psu, sampleRate) {
  const R = params.R ?? 100;
  const L = params.L ?? 1e-2;
  const tau = L / R;
  const dt = 1 / sampleRate;
  const alpha = Math.exp(-dt / tau);

  const output = new Float32Array(inputSamples.length);
  output[0] = inputSamples[0] * (1 - alpha);
  for (let i = 1; i < inputSamples.length; i++) {
    output[i] = alpha * output[i - 1] + (1 - alpha) * inputSamples[i];
  }

  return { ch1: inputSamples, ch2: output };
}
