// Montaje de referencia de cada experimento. `tests/protoboard.test.mjs` comprueba que el
// detector de la protoboard reconoce cada uno como su experimento y con sus valores.
// `param` enlaza el valor con el parametro del experimento.

const serie = (first, second) => [
  { type: 'GEN', pins: ['A5'], label: 'Gen' },
  { ...first, pins: ['B5', 'B15'] },
  { type: 'CH2', pins: ['A15'], label: 'CH2' },
  { ...second, pins: ['E15', 'PWR_BOTTOM_15'] },
];
const R = (label, param) => ({ type: 'R', label, param });
const C = (label, param) => ({ type: 'C', label, param });
const L = (label, param) => ({ type: 'L', label, param });

const OPAMP_INV = { type: 'OPAMP', pins: ['E20', 'F20', 'E28'], label: 'U1' };
const MASA_MAS = { type: 'WIRE', pins: ['G20', 'PWR_BOTTOM_20'], label: 'W' };
const GEN = { type: 'GEN', pins: ['A5'], label: 'Gen' };
const SONDA = { type: 'CH2', pins: ['D28'], label: 'CH2' };

const MONTAJES = {
  'rc-lowpass': serie(R('R', 'R'), C('C', 'C')),
  'rc-highpass': serie(C('C', 'C'), R('R', 'R')),
  'rl-lowpass': serie(L('L', 'L'), R('R', 'R')),
  'rl-highpass': serie(R('R', 'R'), L('L', 'L')),
  'opamp-inverting': [
    GEN, SONDA, OPAMP_INV, MASA_MAS,
    { ...R('Rin', 'Rin'), pins: ['B5', 'B20'] },
    { ...R('Rf', 'Rf'), pins: ['A20', 'A28'] },
  ],
  'opamp-noninverting': [
    { type: 'GEN', pins: ['J5'], label: 'Gen' }, SONDA,
    OPAMP_INV,
    { type: 'WIRE', pins: ['I5', 'I20'], label: 'W' },
    { ...R('R1', 'R1'), pins: ['D20', 'PWR_BOTTOM_21'] },
    { ...R('Rf', 'Rf'), pins: ['A20', 'A28'] },
  ],
  'opamp-integrator': [
    GEN, SONDA, OPAMP_INV, MASA_MAS,
    { ...R('R', 'R'), pins: ['B5', 'B20'] },
    { ...C('C', 'C'), pins: ['A20', 'A28'] },
    { ...R('Rf', 'Rf'), pins: ['C20', 'C28'] },
  ],
  'opamp-differentiator': [
    GEN, SONDA, OPAMP_INV, MASA_MAS,
    { ...C('C', 'C'), pins: ['B5', 'B12'] },
    { ...R('Rs', 'Rs'), pins: ['C12', 'B20'] },
    { ...R('R', 'R'), pins: ['A20', 'A28'] },
  ],
  'bjt-common-emitter': [
    GEN,
    { type: 'BJT', pins: ['E20', 'E28', 'F24'], label: 'Q1' },
    { ...C('Cin', 'Cin'), pins: ['B5', 'B20'], value: 10e-6 },
    { ...R('R1', 'R1'), pins: ['A20', 'PWR_TOP_20'] },
    { ...R('R2', 'R2'), pins: ['D20', 'PWR_BOTTOM_18'] },
    { ...R('Rc', 'Rc'), pins: ['A28', 'PWR_TOP_28'] },
    { ...R('RE', 'RE'), pins: ['G24', 'PWR_BOTTOM_24'] },
    { ...C('Cout', 'Cout'), pins: ['B28', 'B35'], value: 10e-6 },
    { type: 'CH2', pins: ['A35'], label: 'CH2' },
  ],
  'diode-half-wave': [
    GEN,
    { type: 'D', pins: ['B5', 'B15'], label: 'D', value: 0.7 },
    { type: 'CH2', pins: ['A15'], label: 'CH2' },
    { ...R('Rload', 'Rload'), pins: ['E15', 'PWR_BOTTOM_15'] },
    { ...C('Csuav', 'Csmooth'), pins: ['D15', 'PWR_BOTTOM_16'] },
  ],
  'diode-full-wave': [
    GEN,
    { type: 'WIRE', pins: ['C5', 'C10'], label: 'W' },
    { type: 'D', pins: ['A10', 'A20'], label: 'D1', value: 0.7 },
    { type: 'D', pins: ['B24', 'B10'], label: 'D2', value: 0.7 },
    { type: 'D', pins: ['F10', 'F20'], label: 'D3', value: 0.7 },
    { type: 'D', pins: ['G24', 'G10'], label: 'D4', value: 0.7 },
    { type: 'WIRE', pins: ['H10', 'PWR_BOTTOM_10'], label: 'W' },
    { type: 'WIRE', pins: ['E20', 'H20'], label: 'W' },
    { type: 'WIRE', pins: ['D24', 'I24'], label: 'W' },
    { ...R('Rload', 'Rload'), pins: ['C20', 'C24'] },
    { ...C('Csuav', 'Csmooth'), pins: ['D20', 'E24'] },
    { type: 'CH2', pins: ['B20'], label: 'CH2' },
  ],
};

// Componentes del montaje con los valores actuales; un parametro a 0 quita su componente.
export function montajeOf(id, params = {}) {
  return (MONTAJES[id] ?? [])
    .filter(c => !c.param || params[c.param] === undefined || params[c.param] > 0)
    .map((c, i) => ({ ...c, id: `montaje_${i}`, value: c.param ? params[c.param] ?? c.value ?? null : c.value ?? null }));
}

export const MONTAJE_IDS = Object.keys(MONTAJES);
