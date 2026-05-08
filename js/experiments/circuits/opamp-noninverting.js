// Non-inverting amplifier: Av = 1 + Rf/R1
export function compute(inputSamples, params, psu, sampleRate) {
  const R1  = params.R1  ?? 10000;
  const Rf  = params.Rf  ?? 90000;
  const GBW = params.GBW ?? 1e6;

  const Av = 1 + Rf / R1;
  const bw = GBW / Av;
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
