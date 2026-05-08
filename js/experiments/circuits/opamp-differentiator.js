// Differentiator: Vout = -RC * dVin/dt
export function compute(inputSamples, params, psu, sampleRate) {
  const R  = params.R  ?? 10000;
  const C  = params.C  ?? 1e-7;
  const Rs = params.Rs ?? 100;

  const dt = 1 / sampleRate;
  const diffGain = -R * C;

  const wlim = 1 / (Rs * C);
  const alpha = Math.exp(-dt * wlim);

  const vMin = psu.vNeg + 1.5;
  const vMax = psu.vPos - 1.5;

  const output = new Float32Array(inputSamples.length);
  let filtered = 0;
  for (let i = 1; i < inputSamples.length; i++) {
    const dvdt = (inputSamples[i] - inputSamples[i - 1]) / dt;
    const ideal = diffGain * dvdt;
    filtered = alpha * filtered + (1 - alpha) * ideal;
    output[i] = Math.max(vMin, Math.min(vMax, filtered));
  }
  output[0] = output[1];

  return { ch1: inputSamples, ch2: output };
}
