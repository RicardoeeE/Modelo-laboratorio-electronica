// BJT NPN common-emitter amplifier — small-signal model
export function compute(inputSamples, params, psu, sampleRate) {
  const R1   = params.R1   ?? 100000;
  const R2   = params.R2   ?? 22000;
  const Rc   = params.Rc   ?? 4700;
  const RE   = params.RE   ?? 1000;
  const beta = params.beta ?? 200;
  const Cin  = params.Cin  ?? 10e-6;
  const Cout = params.Cout ?? 10e-6;

  const Vcc = psu.vPos;
  const VT  = 0.026;

  const VB  = Vcc * R2 / (R1 + R2);
  const VE  = VB - 0.7;
  if (VE <= 0.01) {
    return { ch1: inputSamples, ch2: new Float32Array(inputSamples.length) };
  }
  const IC  = VE / RE;
  const gm  = IC / VT;
  const re  = VT / IC;
  const Av  = -gm * Rc;
  const VCE_Q = Vcc - IC * Rc;

  const Rth = (R1 * R2) / (R1 + R2);
  const Rin_total = Rth * (beta * re) / (Rth + beta * re);

  const fc_in  = 1 / (2 * Math.PI * Rin_total * Cin);
  const fc_out = 1 / (2 * Math.PI * Rc * Cout);

  const dt = 1 / sampleRate;
  const alpha_in  = Math.exp(-dt * 2 * Math.PI * Math.max(fc_in, fc_out));
  const alpha_out = Math.exp(-dt * 2 * Math.PI * fc_out);

  const vMin = 0.2;
  const vMax = Vcc - 0.2;

  const coupled = new Float32Array(inputSamples.length);
  coupled[0] = 0;
  for (let i = 1; i < inputSamples.length; i++) {
    coupled[i] = alpha_in * (coupled[i - 1] + inputSamples[i] - inputSamples[i - 1]);
  }

  const preOut = new Float32Array(inputSamples.length);
  for (let i = 0; i < inputSamples.length; i++) {
    const v = VCE_Q + Av * coupled[i];
    preOut[i] = Math.max(vMin, Math.min(vMax, v));
  }

  const output = new Float32Array(inputSamples.length);
  output[0] = 0;
  for (let i = 1; i < inputSamples.length; i++) {
    output[i] = alpha_out * (output[i - 1] + preOut[i] - preOut[i - 1]);
  }

  return { ch1: inputSamples, ch2: output };
}
