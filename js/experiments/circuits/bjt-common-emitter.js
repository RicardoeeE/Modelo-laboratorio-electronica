// Emisor comun NPN con divisor de base y RE sin desacoplar.
// Punto de trabajo con el equivalente Thevenin de la base; pequena senal con rpi y RE:
//   Av = -beta*Rc / (rpi + (beta+1)*RE), que con beta grande tiende a -Rc/RE.
const VBE = 0.7;
const VCE_SAT = 0.2;
const VT = 0.026;

const _defaults = p => ({
  R1:   p.R1   ?? 100000,
  R2:   p.R2   ?? 22000,
  Rc:   p.Rc   ?? 4700,
  RE:   p.RE   ?? 1000,
  beta: p.beta ?? 200,
  Cin:  p.Cin  ?? 10e-6,
  Cout: p.Cout ?? 10e-6,
});

export function operatingPoint(params, vcc) {
  const { R1, R2, Rc, RE, beta } = _defaults(params);
  const Rth = R1 * R2 / (R1 + R2);
  const Vth = vcc * R2 / (R1 + R2);
  const IB  = (Vth - VBE) / (Rth + (beta + 1) * RE);
  const icSat = (vcc - VCE_SAT) / (Rc + RE);

  if (IB <= 0) return { region: 'corte', IC: 0, VC: vcc, VE: 0, VB: Vth, Av: 0 };

  const IC = beta * IB;
  if (IC >= icSat) {
    const VE = icSat * RE;
    return { region: 'saturacion', IC: icSat, VC: VE + VCE_SAT, VE, VB: VE + VBE, Av: 0 };
  }

  const VE  = (beta + 1) * IB * RE;
  const VC  = vcc - IC * Rc;
  const rpi = beta * VT / IC;
  const Rb  = rpi + (beta + 1) * RE;
  return {
    region: 'activa', IC, VC, VE, VB: VE + VBE,
    Av: -beta * Rc / Rb,
    Rin: Rth * Rb / (Rth + Rb),
    vcMin: vcc - icSat * Rc,   // saturacion: VCE = 0,2 V
    vcMax: vcc,                // corte: no pasa corriente por Rc
  };
}

export function settlingTau(params) {
  const { R1, R2, Rc, Cin, Cout } = _defaults(params);
  return Math.max(R1 * R2 / (R1 + R2) * Cin, Rc * Cout);
}

export function compute(inputSamples, params, psu, sampleRate) {
  const { Rc, Cin, Cout } = _defaults(params);
  const op = operatingPoint(params, psu.vPos);
  const output = new Float32Array(inputSamples.length);
  if (op.region !== 'activa') return { ch1: inputSamples, ch2: output };

  const dt = 1 / sampleRate;
  const alphaIn  = Math.exp(-dt / (op.Rin * Cin));
  const alphaOut = Math.exp(-dt / (Rc * Cout));

  let base = 0;
  let prevVc = op.VC;
  for (let i = 1; i < inputSamples.length; i++) {
    base = alphaIn * (base + inputSamples[i] - inputSamples[i - 1]);
    const vc = Math.max(op.vcMin, Math.min(op.vcMax, op.VC + op.Av * base));
    output[i] = alphaOut * (output[i - 1] + vc - prevVc);
    prevVc = vc;
  }

  return { ch1: inputSamples, ch2: output };
}
