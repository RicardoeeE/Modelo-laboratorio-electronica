// Reconoce el circuito montado mirando la conexion real: nodos, cables, carriles,
// generador, sonda CH2 y polaridad. Sin DOM, para poder probarlo con node --test.
//
// Componente: { type, pins: [agujero, ...], value, label }
//   R, C, L, WIRE: dos patas · D, LED: anodo, catodo · OPAMP: -, +, salida
//   BJT: base, colector, emisor · GEN, CH2: un agujero
// No resuelve circuitos arbitrarios: compara con los 11 experimentos del laboratorio.

export const NODE_GND = 'GND';
export const NODE_VCC = 'V+';

// Columnas A-E y F-J conducen por separado; cada carril es un solo nodo.
export function nodeOf(hole) {
  if (hole.startsWith('PWR_TOP')) return NODE_VCC;
  if (hole.startsWith('PWR_BOTTOM')) return NODE_GND;
  const m = /^([A-J])(\d+)$/.exec(hole);
  if (!m) return hole;
  return ('ABCDE'.includes(m[1]) ? 'T' : 'B') + m[2];
}

const PASSIVE_TYPES = ['R', 'C', 'L'];
const DIODE_TYPES = ['D', 'LED'];

function _nodeResolver(components) {
  const parent = new Map();
  const find = n => {
    if (!parent.has(n)) parent.set(n, n);
    while (parent.get(n) !== n) {
      parent.set(n, parent.get(parent.get(n)));
      n = parent.get(n);
    }
    return n;
  };
  components.filter(c => c.type === 'WIRE').forEach(w => {
    parent.set(find(nodeOf(w.pins[0])), find(nodeOf(w.pins[1])));
  });
  return hole => find(nodeOf(hole));
}

const _isBetween = (el, a, b) =>
  (el.nodes[0] === a && el.nodes[1] === b) || (el.nodes[0] === b && el.nodes[1] === a);

function _take(list, a, b) {
  const i = list.findIndex(el => _isBetween(el, a, b));
  return i < 0 ? null : list.splice(i, 1)[0];
}

const _counts = (p, want) => ['R', 'C', 'L', 'diodes', 'opamps', 'bjts']
  .every(k => (want[k] ?? 0) === p[k].length);

export function buildNetlist(components) {
  if (components.length === 0) return { id: null, reason: '' };

  const resolve = _nodeResolver(components);
  const parts = components.map(c => ({ ...c, nodes: c.pins.map(resolve) }));

  const gens = parts.filter(c => c.type === 'GEN');
  const probes = parts.filter(c => c.type === 'CH2');
  if (gens.length > 1) return { id: null, reason: 'Hay más de un generador: deja solo uno.' };
  if (probes.length > 1) return { id: null, reason: 'Hay más de una sonda CH2: deja solo una.' };

  const shorted = parts.find(c => [...PASSIVE_TYPES, ...DIODE_TYPES].includes(c.type) && c.nodes[0] === c.nodes[1]);
  if (shorted) {
    return { id: null, reason: `${shorted.label} está en cortocircuito: sus dos patas están en el mismo nodo.` };
  }

  if (gens.length === 0) return { id: null, reason: 'Falta el generador: pulsa Gen y coloca la entrada del circuito.' };
  if (probes.length === 0) return { id: null, reason: 'Falta la sonda: pulsa CH2 y colócala en la salida.' };

  const ctx = {
    input: gens[0].nodes[0],
    output: probes[0].nodes[0],
    gnd: resolve('PWR_BOTTOM_1'),
    vcc: resolve('PWR_TOP_1'),
    R: parts.filter(c => c.type === 'R'),
    C: parts.filter(c => c.type === 'C'),
    L: parts.filter(c => c.type === 'L'),
    diodes: parts.filter(c => DIODE_TYPES.includes(c.type)),
    opamps: parts.filter(c => c.type === 'OPAMP'),
    bjts: parts.filter(c => c.type === 'BJT'),
  };

  if (ctx.gnd === ctx.vcc) return { id: null, reason: 'V+ y GND están unidos por un cable: es un cortocircuito de la fuente.' };
  if (ctx.input === ctx.output) return { id: null, reason: 'CH2 está en el mismo nodo que el generador: mide la entrada.' };

  return _matchFilter(ctx) ?? _matchDiode(ctx) ?? _matchOpamp(ctx) ?? _matchBjt(ctx) ?? {
    id: null,
    reason: _hint(ctx),
  };
}

function _hint(ctx) {
  if (ctx.bjts.length) return 'No coincide con el emisor común: R1 de V+ a base, R2 de base a GND, Rc de V+ a colector, RE de emisor a GND, C de Gen a base y C de colector a CH2.';
  if (ctx.opamps.length) return 'No coincide con un montaje de op-amp: revisa qué llega a cada pin (−, + y salida) y que CH2 esté en la salida.';
  if (ctx.diodes.length) return 'No coincide con un rectificador: ánodo al Gen y cátodo a CH2 con R a GND, o un puente de 4 diodos con R entre + y −.';
  if (ctx.R.length + ctx.C.length + ctx.L.length) return 'No coincide con un filtro: un componente de Gen a CH2 y el otro de CH2 a GND (carril inferior).';
  return 'Coloca componentes entre el generador y la sonda CH2.';
}

function _matchFilter(ctx) {
  const { input, output, gnd } = ctx;
  const forPair = (other, otherKey, ids) => {
    if (!_counts(ctx, { R: 1, [otherKey]: 1 })) return null;
    const R = ctx.R[0];
    if (_isBetween(R, input, output) && _isBetween(other[0], output, gnd)) return ids.rSeries(R, other[0]);
    if (_isBetween(other[0], input, output) && _isBetween(R, output, gnd)) return ids.otherSeries(R, other[0]);
    return null;
  };
  return forPair(ctx.C, 'C', {
    rSeries: (R, C) => ({ id: 'rc-lowpass', params: { R: R.value, C: C.value } }),
    otherSeries: (R, C) => ({ id: 'rc-highpass', params: { R: R.value, C: C.value } }),
  }) ?? forPair(ctx.L, 'L', {
    rSeries: (R, L) => ({ id: 'rl-highpass', params: { R: R.value, L: L.value } }),
    otherSeries: (R, L) => ({ id: 'rl-lowpass', params: { R: R.value, L: L.value } }),
  });
}

function _matchDiode(ctx) {
  const { input, output, gnd, diodes } = ctx;
  if (ctx.L.length || ctx.opamps.length || ctx.bjts.length || ctx.R.length !== 1 || ctx.C.length > 1) return null;
  const R = ctx.R[0];
  const C = ctx.C[0];

  if (diodes.length === 1) {
    const [anode, cathode] = diodes[0].nodes;
    const loadOk = _isBetween(R, output, gnd) && (!C || _isBetween(C, output, gnd));
    if (loadOk && anode === output && cathode === input) {
      return { id: null, reason: `${diodes[0].label} está invertido: daría el semiciclo negativo, que este modelo no simula. Pon el ánodo hacia el generador.` };
    }
    if (loadOk && anode === input && cathode === output) {
      return { id: 'diode-half-wave', params: { Rload: R.value, Csmooth: C?.value ?? 0, Vf: diodes[0].value } };
    }
    return null;
  }

  if (diodes.length === 4) {
    // Puente: Gen y GND son la alterna; salida + y salida − son los nodos donde coinciden
    // dos catodos y dos anodos.
    const cathodes = diodes.map(d => d.nodes[1]);
    const anodes = diodes.map(d => d.nodes[0]);
    const twice = list => [...new Set(list)].filter(n => list.filter(x => x === n).length === 2);
    const plus = twice(cathodes).find(n => n !== input && n !== gnd);
    const minus = twice(anodes).find(n => n !== input && n !== gnd);
    if (plus === undefined || minus === undefined || plus !== output) return null;
    const feeds = ac => diodes.some(d => d.nodes[0] === ac && d.nodes[1] === plus)
      && diodes.some(d => d.nodes[0] === minus && d.nodes[1] === ac);
    if (!feeds(input) || !feeds(gnd)) return null;
    if (!_isBetween(R, plus, minus) || (C && !_isBetween(C, plus, minus))) return null;
    return {
      id: 'diode-full-wave',
      params: { Rload: R.value, Csmooth: C?.value ?? 0, Vf: diodes[0].value },
      note: 'CH2 mide entre + y −, como una sonda diferencial.',
    };
  }
  return null;
}

function _matchOpamp(ctx) {
  const { input, output, gnd } = ctx;
  if (ctx.opamps.length !== 1 || ctx.L.length || ctx.diodes.length || ctx.bjts.length) return null;
  const [minus, plus, out] = ctx.opamps[0].nodes;
  if (out !== output) return null;

  const R = [...ctx.R];
  const C = [...ctx.C];

  if (plus === input && C.length === 0) {
    if (R.length === 0 && minus === out) {
      return { id: 'opamp-noninverting', params: { R1: 10000, Rf: 0 }, note: 'Seguidor: Av = 1.' };
    }
    const R1 = _take(R, minus, gnd);
    const Rf = _take(R, minus, out);
    if (R1 && Rf && R.length === 0) return { id: 'opamp-noninverting', params: { R1: R1.value, Rf: Rf.value } };
    return null;
  }

  if (plus !== gnd) return null;

  if (C.length === 0) {
    const Rin = _take(R, input, minus);
    const Rf = _take(R, minus, out);
    if (Rin && Rf && R.length === 0) return { id: 'opamp-inverting', params: { Rin: Rin.value, Rf: Rf.value } };
    return null;
  }

  if (C.length !== 1) return null;

  // Integrador: R a la entrada y C en la realimentacion, con Rf opcional en paralelo.
  if (_isBetween(C[0], minus, out)) {
    const Rin = _take(R, input, minus);
    const Rf = _take(R, minus, out);
    if (!Rin || R.length) return null;
    if (Rf) return { id: 'opamp-integrator', params: { R: Rin.value, C: C[0].value, Rf: Rf.value } };
    return {
      id: 'opamp-integrator',
      params: { R: Rin.value, C: C[0].value, Rf: 1e6 },
      note: 'Sin Rf se asume 1 MΩ en paralelo con C, para que la salida no derive.',
    };
  }

  // Diferenciador: C a la entrada, R en la realimentacion, y Rs opcional en serie con C.
  const Rf = _take(R, minus, out);
  if (!Rf) return null;
  if (_isBetween(C[0], input, minus) && R.length === 0) {
    return { id: 'opamp-differentiator', params: { R: Rf.value, C: C[0].value, Rs: 0 } };
  }
  if (R.length === 1) {
    const [a, b] = C[0].nodes;
    const mid = a === input || a === minus ? b : a;
    const inSeries = (_isBetween(C[0], input, mid) && _isBetween(R[0], mid, minus))
      || (_isBetween(R[0], input, mid) && _isBetween(C[0], mid, minus));
    if (inSeries) return { id: 'opamp-differentiator', params: { R: Rf.value, C: C[0].value, Rs: R[0].value } };
  }
  return null;
}

function _matchBjt(ctx) {
  const { input, output, gnd, vcc } = ctx;
  if (ctx.bjts.length !== 1 || !_counts(ctx, { R: 4, C: 2, bjts: 1 })) return null;
  const [base, collector, emitter] = ctx.bjts[0].nodes;
  const R = [...ctx.R];
  const C = [...ctx.C];
  const R1 = _take(R, vcc, base);
  const R2 = _take(R, base, gnd);
  const Rc = _take(R, vcc, collector);
  const RE = _take(R, emitter, gnd);
  const Cin = _take(C, input, base);
  const Cout = _take(C, collector, output);
  if (!R1 || !R2 || !Rc || !RE || !Cin || !Cout) return null;
  return {
    id: 'bjt-common-emitter',
    params: { R1: R1.value, R2: R2.value, Rc: Rc.value, RE: RE.value, Cin: Cin.value, Cout: Cout.value },
  };
}

// ── Valores: «10k», «100n», «4,7u», «1M» ─────────────────────────────────────────
const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6 };

export function parseValue(text) {
  const m = /^\s*([0-9]*[.,]?[0-9]+)\s*([pnuµmkKM]?)\s*[a-zA-ZΩ]*\s*$/.exec(String(text));
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.')) * (PREFIX[m[2]] ?? 1);
  return value > 0 ? value : null;
}

export function formatValue(value, unit) {
  const scales = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const [scale, prefix] = scales.find(([s]) => value >= s) ?? scales[scales.length - 1];
  const number = String(+(value / scale).toPrecision(3)).replace('.', ',');
  return `${number} ${prefix}${unit}`;
}
