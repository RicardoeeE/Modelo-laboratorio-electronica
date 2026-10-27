// Inverting amplifier: Av = -Rf/Rin
export function compute(inputSamples, params, psu, sampleRate) {
  const Rin = params.Rin ?? 10000;
  const Rf  = params.Rf  ?? 100000;
  const GBW = params.GBW ?? 1e6;

  const Av = -Rf / Rin;
  const bw = GBW / Math.abs(Av);
  const wbw = 2 * Math.PI * bw;
  const dt = 1 / sampleRate;
  const alpha = Math.exp(-dt * wbw);

  const vMin = psu.vNeg + 1.5;
  const vMax = psu.vPos - 1.5;

  const output = new Float32Array(inputSamples.length);
  let filtered = 0;
  for (let i = 0; i < inputSamples.length; i++) {
    const ideal = Av * inputSamples[i];
    filtered = alpha * filtered + (1 - alpha) * ideal;
    output[i] = Math.max(vMin, Math.min(vMax, filtered));
  }

  return { ch1: inputSamples, ch2: output };
}
