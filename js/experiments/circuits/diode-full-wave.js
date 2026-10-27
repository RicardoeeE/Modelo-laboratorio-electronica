// Full-wave bridge rectifier: both half-cycles rectified
export function compute(inputSamples, params, psu, sampleRate) {
  const Rload   = params.Rload   ?? 10000;
  const Csmooth = params.Csmooth ?? 0;
  const Vf      = 0.7;

  const output = new Float32Array(inputSamples.length);

  if (Csmooth > 0) {
    const dt = 1 / sampleRate;
    let vcap = 0;
    for (let i = 0; i < inputSamples.length; i++) {
      const vrect = Math.abs(inputSamples[i]) - 2 * Vf;
      if (vrect > vcap) {
        vcap = vrect;
      } else {
        vcap *= Math.exp(-dt / (Rload * Csmooth));
      }
      output[i] = Math.max(0, vcap);
    }
  } else {
    for (let i = 0; i < inputSamples.length; i++) {
      output[i] = Math.max(0, Math.abs(inputSamples[i]) - 2 * Vf);
    }
  }

  return { ch1: inputSamples, ch2: output };
}
