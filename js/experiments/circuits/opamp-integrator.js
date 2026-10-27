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

  // Pre-run 3× buffer to settle the transient
  let integral = 0;
  const settleLen = inputSamples.length * 3;
  for (let i = 0; i < settleLen; i++) {
    const s = inputSamples[i % inputSamples.length];
    integral = leakAlpha * integral + integGain * s * dt;
    integral = Math.max(vMin, Math.min(vMax, integral));
  }

  const output = new Float32Array(inputSamples.length);
  for (let i = 0; i < inputSamples.length; i++) {
    integral = leakAlpha * integral + integGain * inputSamples[i] * dt;
    integral = Math.max(vMin, Math.min(vMax, integral));
    output[i] = integral;
  }

  return { ch1: inputSamples, ch2: output };
}
