// H(jω) = jωL/(R+jωL) — RL high-pass (voltage across L)
export function compute(inputSamples, params, psu, sampleRate) {
  const R = params.R ?? 100;
  const L = params.L ?? 1e-2;
  const tau = L / R;
  const dt = 1 / sampleRate;
  const alpha = Math.exp(-dt / tau);
  const gain = (1 - alpha) * tau / dt;

  const output = new Float32Array(inputSamples.length);
  output[0] = 0;
  for (let i = 1; i < inputSamples.length; i++) {
    // Solucion exacta de dy/dt + y/tau = dx/dt con x lineal en cada paso. Multiplicar
    // por alpha solo vale si dt << tau: a 50 Hz daba la mitad del Vpp.
    output[i] = alpha * output[i - 1] + gain * (inputSamples[i] - inputSamples[i - 1]);
  }

  return { ch1: inputSamples, ch2: output };
}
