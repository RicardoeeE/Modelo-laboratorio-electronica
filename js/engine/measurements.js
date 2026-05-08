export function measureFrequency(samples, sampleRate) {
  let crossings = 0;
  let prevSign = samples[0] >= 0 ? 1 : -1;

  for (let i = 1; i < samples.length; i++) {
    const sign = samples[i] >= 0 ? 1 : -1;
    if (sign !== prevSign && prevSign === -1) {
      crossings++;
    }
    prevSign = sign;
  }

  const duration = samples.length / sampleRate;
  return crossings / duration;
}

export function measureVpp(samples) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
    if (samples[i] > max) max = samples[i];
  }
  return max - min;
}

export function measureVmax(samples) {
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > max) max = samples[i];
  }
  return max;
}

export function measureVmin(samples) {
  let min = Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
  }
  return min;
}

export function measureRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

export function measurePhase(ch1, ch2, sampleRate) {
  const len = Math.min(ch1.length, ch2.length, 2000);
  const maxLag = Math.floor(len / 4);
  let maxCorr = -Infinity;
  let bestLag = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = maxLag; i < len - maxLag; i++) {
      const j = i + lag;
      if (j >= 0 && j < ch2.length) {
        corr += ch1[i] * ch2[j];
        count++;
      }
    }
    if (count > 0) corr /= count;
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  const freq = measureFrequency(ch1, sampleRate);
  if (freq <= 0) return 0;

  const period = 1 / freq;
  const timeLag = bestLag / sampleRate;
  const phase = (timeLag / period) * 360;

  return ((phase % 360) + 540) % 360 - 180;
}

export function findTriggerPoint(samples, level, slope = 'rising', searchLimit = null) {
  const limit = searchLimit ?? samples.length - 1;
  for (let i = 1; i < limit; i++) {
    if (slope === 'rising' && samples[i - 1] < level && samples[i] >= level) return i;
    if (slope === 'falling' && samples[i - 1] > level && samples[i] <= level) return i;
  }
  return 0;
}
