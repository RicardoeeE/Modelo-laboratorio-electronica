import { getNodeForHole } from './breadboard.js';

export function buildNetlist(components) {
  if (components.length === 0) return null;

  const mapped = components.map(c => ({
    ...c,
    n1: getNodeForHole(c.terminal1),
    n2: getNodeForHole(c.terminal2),
  }));

  const passives = mapped.filter(c => ['R','C','L'].includes(c.type));
  const diodes   = mapped.filter(c => ['D','LED'].includes(c.type));
  const opamps   = mapped.filter(c => c.type === 'OPAMP');
  const bjts     = mapped.filter(c => c.type === 'BJT');

  if (passives.length === 2 && diodes.length === 0 && opamps.length === 0) {
    const [a, b] = passives;
    const shared = _sharedNode(a, b);
    if (shared) {
      const types = [a.type, b.type].sort().join('');
      if (types === 'CR') {
        const R = (a.type === 'R' ? a : b).value ?? 1000;
        const C = (a.type === 'C' ? a : b).value ?? 1e-7;
        return { id: 'rc-lowpass', params: { R, C } };
      }
      if (types === 'LR') {
        const R = (a.type === 'R' ? a : b).value ?? 100;
        const L = (a.type === 'L' ? a : b).value ?? 1e-3;
        return { id: 'rl-lowpass', params: { R, L } };
      }
    }
  }

  if (diodes.length >= 1 && passives.filter(c => c.type === 'R').length >= 1) {
    const R = passives.find(c => c.type === 'R')?.value ?? 10000;
    const C = passives.find(c => c.type === 'C')?.value ?? 0;
    if (diodes.length === 1) {
      return { id: 'diode-half-wave', params: { Rload: R, Csmooth: C } };
    }
    if (diodes.length >= 4) {
      return { id: 'diode-full-wave', params: { Rload: R, Csmooth: C } };
    }
  }

  if (opamps.length >= 1) {
    const resistors = passives.filter(c => c.type === 'R');
    const caps      = passives.filter(c => c.type === 'C');
    if (resistors.length >= 2 && caps.length === 0) {
      const Rin = resistors[0]?.value ?? 10000;
      const Rf  = resistors[1]?.value ?? 100000;
      return { id: 'opamp-inverting', params: { Rin, Rf } };
    }
    if (resistors.length >= 1 && caps.length >= 1) {
      const R = resistors[0]?.value ?? 10000;
      const C = caps[0]?.value ?? 1e-7;
      return { id: 'opamp-integrator', params: { R, C } };
    }
  }

  if (bjts.length >= 1) {
    const resistors = passives.filter(c => c.type === 'R');
    if (resistors.length >= 2) {
      return {
        id: 'bjt-common-emitter',
        params: {
          Rc: resistors[0]?.value ?? 4700,
          RE: resistors[1]?.value ?? 1000,
        }
      };
    }
  }

  return null;
}

function _sharedNode(a, b) {
  if (a.n1 === b.n1 || a.n1 === b.n2) return a.n1;
  if (a.n2 === b.n1 || a.n2 === b.n2) return a.n2;
  return null;
}
