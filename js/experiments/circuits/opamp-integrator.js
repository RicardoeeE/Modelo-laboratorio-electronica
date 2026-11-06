// Leaky integrator: Vout = -1/(RC) ∫Vin dt
export function compute(inputSamples, params, psu, sampleRate) {
  const R  = params.R  ?? 10000;
  const C  = params.C  ?? 1e-7;
  const Rf = params.Rf ?? 1e6;

  const dt = 1 / sampleRate;
  const integGain = -1 / (R * C);
  const leakAlpha = Math.exp(-dt / (Rf * C));

  const vMin = psu.vNeg + 1.5;
  const vMax = psu.vPos - 1.5;

  let integral = 0;
  const output = new Float32Array(inputSamples.length);
  let prev = inputSamples[0];
  for (let i = 0; i < inputSamples.length; i++) {
    integral = leakAlpha * integral + integGain * 0.5 * (inputSamples[i] + prev) * dt;
    prev = inputSamples[i];
    integral = Math.max(vMin, Math.min(vMax, integral));
    output[i] = integral;
  }

  return { ch1: inputSamples, ch2: output };
}
