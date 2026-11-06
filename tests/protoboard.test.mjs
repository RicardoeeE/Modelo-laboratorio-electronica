// La protoboard reconoce el circuito por su conexion real. Ejecutar: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNetlist, nodeOf, parseValue, formatValue } from '../js/breadboard/netlist-builder.js';
import { montajeOf, MONTAJE_IDS } from '../js/breadboard/montajes.js';
import { computeOutput } from '../js/engine/circuit-engine.js';
import { measurePhase, measureVpp } from '../js/engine/measurements.js';

const experimentos = JSON.parse(fs.readFileSync(new URL('../data/experiments.json', import.meta.url))).experiments;

const comp = (type, value, ...pins) => ({ type, value, pins, label: `${type}${pins[0]}` });
const R = (a, b, v = 1000) => comp('R', v, a, b);
const C = (a, b, v = 1e-7) => comp('C', v, a, b);
const L = (a, b, v = 0.01) => comp('L', v, a, b);
const D = (anodo, catodo) => comp('D', 0.7, anodo, catodo);
const W = (a, b) => comp('WIRE', null, a, b);
const GEN = (h) => comp('GEN', null, h);
const CH2 = (h) => comp('CH2', null, h);
const OP = (menos, mas, salida) => comp('OPAMP', null, menos, mas, salida);
const GND = n => `PWR_BOTTOM_${n}`;
const VCC = n => `PWR_TOP_${n}`;

test('nodos: columnas separadas por el canal central y carriles enteros', () => {
  assert.equal(nodeOf('A5'), nodeOf('E5'));
  assert.notEqual(nodeOf('E5'), nodeOf('F5'));
  assert.equal(nodeOf('F5'), nodeOf('J5'));
  assert.notEqual(nodeOf('A5'), nodeOf('A6'));
  assert.equal(nodeOf('PWR_BOTTOM_1'), nodeOf('PWR_BOTTOM_63'));
  assert.equal(nodeOf('PWR_TOP_1'), nodeOf('PWR_TOP_63'));
  assert.notEqual(nodeOf('PWR_TOP_1'), nodeOf('PWR_BOTTOM_1'));
});

test('filtros: el orden de los componentes decide paso bajo o paso alto', () => {
  const R_serie = [GEN('A5'), R('B5', 'B15'), CH2('A15')];
  assert.deepEqual(buildNetlist([...R_serie, C('C15', GND(15))]), { id: 'rc-lowpass', params: { R: 1000, C: 1e-7 } });
  assert.equal(buildNetlist([GEN('A5'), C('B5', 'B15'), CH2('A15'), R('C15', GND(15))]).id, 'rc-highpass');
  // RL: la salida sobre R es paso bajo y sobre L, paso alto.
  assert.equal(buildNetlist([GEN('A5'), L('B5', 'B15'), CH2('A15'), R('C15', GND(15))]).id, 'rl-lowpass');
  assert.equal(buildNetlist([...R_serie, L('C15', GND(15))]).id, 'rl-highpass');
});

test('filtros: los valores montados llegan al circuito', () => {
  const r = buildNetlist([GEN('A5'), R('B5', 'B15', 4700), CH2('A15'), C('C15', GND(15), 2.2e-8)]);
  assert.deepEqual(r.params, { R: 4700, C: 2.2e-8 });
});

test('cables y carriles unen nodos', () => {
  const conCables = [
    GEN('A1'), W('B1', 'B5'), R('C5', 'C15'), W('D15', 'D25'), CH2('A25'),
    C('B25', GND(40)),
  ];
  assert.equal(buildNetlist(conCables).id, 'rc-lowpass');
  // El otro extremo del carril de masa es la misma masa.
  const r = buildNetlist([GEN('A5'), R('B5', 'B15'), CH2('A15'), C('C15', 'F15'), W('G15', GND(60))]);
  assert.equal(r.id, 'rc-lowpass');
});

test('el canal central separa: sin cable no hay circuito', () => {
  const r = buildNetlist([GEN('A5'), R('B5', 'E15'), CH2('F15'), C('G15', GND(15))]);
  assert.equal(r.id, null);
  assert.match(r.reason, /filtro/);
});

test('sin componentes en el sitio no se inventa el circuito', () => {
  assert.equal(buildNetlist([R('A5', 'A10'), C('A20', 'A25')]).id, null, 'sin Gen');
  assert.match(buildNetlist([R('A5', 'A10')]).reason, /generador/);
  assert.match(buildNetlist([GEN('A1'), R('A5', 'A10')]).reason, /sonda/);
  assert.equal(buildNetlist([GEN('A1'), CH2('A2'), R('A5', 'A10'), C('A20', 'A25')]).id, null, 'desconectados');
  assert.equal(buildNetlist([GEN('A1'), CH2('A2'), comp('OPAMP', null, 'E10', 'F10', 'E12'), R('A5', 'A6'), R('A7', 'A8')]).id, null);
  assert.equal(buildNetlist([GEN('A1'), CH2('A2'), comp('BJT', null, 'E10', 'E11', 'E12'), R('A5', 'A6'), R('A7', 'A8')]).id, null);
  assert.equal(buildNetlist([]).reason, '');
});

test('avisos: cortocircuito, dos generadores, CH2 en la entrada y fuente en corto', () => {
  assert.match(buildNetlist([GEN('A1'), CH2('A2'), R('A5', 'B5')]).reason, /cortocircuito/);
  assert.match(buildNetlist([GEN('A1'), GEN('A2'), CH2('A3')]).reason, /más de un generador/);
  assert.match(buildNetlist([GEN('A1'), CH2('B1')]).reason, /mide la entrada/);
  assert.match(buildNetlist([GEN('A1'), CH2('A2'), W(VCC(1), GND(1))]).reason, /cortocircuito de la fuente/);
});

test('un componente de mas evita el reconocimiento', () => {
  const r = buildNetlist([GEN('A5'), R('B5', 'B15'), CH2('A15'), C('C15', GND(15)), R('D15', GND(16))]);
  assert.equal(r.id, null);
});

test('diodo: la polaridad importa y la carga va a masa', () => {
  const base = [GEN('A5'), CH2('A15'), R('E15', GND(15))];
  const ok = buildNetlist([...base, D('B5', 'B15')]);
  assert.deepEqual(ok, { id: 'diode-half-wave', params: { Rload: 1000, Csmooth: 0, Vf: 0.7 } });
  assert.match(buildNetlist([...base, D('B15', 'B5')]).reason, /invertido/);
  assert.equal(buildNetlist([...base, D('B5', 'B15'), C('D15', GND(16))]).params.Csmooth, 1e-7);
});

test('el LED rectifica con su propia caida de tension', () => {
  const led = comp('LED', 2.1, 'B5', 'B15');
  const r = buildNetlist([GEN('A5'), CH2('A15'), R('E15', GND(15)), led]);
  assert.equal(r.params.Vf, 2.1);
  const { ch2 } = computeOutput({
    fg: { freq: 50, amplitude: 5, waveform: 'sine', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: r.id, params: r.params },
  });
  assert.ok(Math.abs(measureVpp(ch2) - 2.9) < 1e-3, `${measureVpp(ch2)}`);
});

test('puente: reconoce la topologia y rechaza un diodo girado', () => {
  const puente = invertir => [
    GEN('A10'),
    D('B10', 'B20'),
    invertir ? D('C10', 'C24') : D('C24', 'C10'),
    W('D10', 'D11'),
    W('F10', GND(10)),
    D('G10', 'G20'), D('H24', 'H10'),
    W('E20', 'I20'), W('E24', 'I24'),
    R('A20', 'A24'),
    CH2('C20'),
  ];
  const r = buildNetlist(puente(false));
  assert.equal(r.id, 'diode-full-wave');
  assert.equal(r.params.Rload, 1000);
  assert.equal(buildNetlist(puente(true)).id, null);
});

test('op-amp: inversor, no inversor, seguidor, integrador y diferenciador', () => {
  const inv = [GEN('A5'), CH2('A28'), OP('E20', 'F20', 'E28'), W('G20', GND(20))];
  const conR = buildNetlist([...inv, R('B5', 'B20', 10000), R('C20', 'C28', 100000)]);
  assert.deepEqual(conR, { id: 'opamp-inverting', params: { Rin: 10000, Rf: 100000 } });

  const integ = buildNetlist([...inv, R('B5', 'B20', 10000), C('C20', 'C28')]);
  assert.equal(integ.id, 'opamp-integrator');
  assert.equal(integ.params.Rf, 1e6);
  assert.match(integ.note, /1 MΩ/);
  assert.equal(buildNetlist([...inv, R('B5', 'B20', 10000), C('C20', 'C28'), R('D20', 'D28', 470000)]).params.Rf, 470000);

  assert.deepEqual(
    buildNetlist([...inv, C('B5', 'B20'), R('C20', 'C28', 10000)]),
    { id: 'opamp-differentiator', params: { R: 10000, C: 1e-7, Rs: 0 } },
  );
  assert.equal(buildNetlist([...inv, C('B5', 'B12'), R('C12', 'B20', 100), R('C20', 'C28', 10000)]).params.Rs, 100);
  assert.equal(buildNetlist([...inv, R('B5', 'B12', 100), C('C12', 'B20'), R('C20', 'C28', 10000)]).params.Rs, 100);

  const noInv = [GEN('J5'), W('I5', 'I20'), CH2('A28'), OP('E20', 'F20', 'E28')];
  assert.deepEqual(
    buildNetlist([...noInv, R('B20', GND(20), 10000), R('C20', 'C28', 90000)]),
    { id: 'opamp-noninverting', params: { R1: 10000, Rf: 90000 } },
  );
  const seguidor = buildNetlist([...noInv, W('B20', 'B28')]);
  assert.equal(seguidor.id, 'opamp-noninverting');
  assert.equal(seguidor.params.Rf, 0);
});

test('op-amp: la salida y el + tienen que estar donde tocan', () => {
  const sinMasa = [GEN('A5'), CH2('A28'), OP('E20', 'F20', 'E28'), R('B5', 'B20'), R('C20', 'C28')];
  assert.equal(buildNetlist(sinMasa).id, null, '+ al aire');
  const sondaFuera = [GEN('A5'), CH2('A40'), OP('E20', 'F20', 'E28'), W('G20', GND(20)), R('B5', 'B20'), R('C20', 'C28')];
  assert.equal(buildNetlist(sondaFuera).id, null, 'CH2 no esta en la salida');
});

test('transistor: exige el divisor, RE y los dos condensadores', () => {
  const Q = comp('BJT', null, 'E20', 'E28', 'F24');
  const r = [
    GEN('A5'), Q, C('B5', 'B20', 1e-5),
    R('A20', VCC(20), 100000), R('D20', GND(18), 22000),
    R('A28', VCC(28), 4700), R('G24', GND(24), 1000),
    C('B28', 'B35', 1e-5), CH2('A35'),
  ];
  const ok = buildNetlist(r);
  assert.equal(ok.id, 'bjt-common-emitter');
  assert.deepEqual([ok.params.R1, ok.params.R2, ok.params.Rc, ok.params.RE], [100000, 22000, 4700, 1000]);
  assert.equal(buildNetlist(r.filter(c => c.pins[0] !== 'G24')).id, null, 'sin RE');
});

test('cada experimento tiene un montaje que el detector reconoce como tal, con sus valores', () => {
  assert.equal(MONTAJE_IDS.length, 11);
  for (const exp of experimentos) {
    const montaje = montajeOf(exp.id, exp.defaultParams);
    assert.ok(montaje.length > 0, `${exp.id}: sin montaje`);
    const huecos = montaje.flatMap(c => c.pins);
    assert.equal(new Set(huecos).size, huecos.length, `${exp.id}: dos patas en el mismo agujero`);
    const r = buildNetlist(montaje);
    assert.equal(r.id, exp.id, `${exp.id}: ${r.reason}`);
    for (const c of exp.paramControls) {
      assert.equal(r.params[c.key], exp.defaultParams[c.key], `${exp.id}: ${c.key}`);
    }
  }
});

test('un montaje con condensador opcional lo incluye si el parametro no es cero', () => {
  const r = buildNetlist(montajeOf('diode-half-wave', { Rload: 1000, Csmooth: 1e-4 }));
  assert.equal(r.params.Csmooth, 1e-4);
});

test('de la placa a la medida: lo montado da la fase de la teoria', () => {
  const r = buildNetlist(montajeOf('rc-highpass', { R: 1000, C: 1e-7 }));
  const f = 1 / (2 * Math.PI * 1000 * 1e-7);
  const { ch1, ch2, sampleRate } = computeOutput({
    fg: { freq: f, amplitude: 1, waveform: 'sine', offset: 0, enabled: true },
    psu: { vPos: 15, vNeg: -15 },
    circuit: { activeExperiment: r.id, params: r.params },
  });
  assert.ok(Math.abs(measurePhase(ch1, ch2, sampleRate) - 45) < 1);
});

test('valores: se escriben como en el laboratorio', () => {
  assert.equal(parseValue('10k'), 10000);
  assert.equal(parseValue('4,7k'), 4700);
  assert.ok(Math.abs(parseValue('100n') - 1e-7) < 1e-15);
  assert.ok(Math.abs(parseValue('2.2u') - 2.2e-6) < 1e-14);
  assert.equal(parseValue('1M'), 1e6);
  assert.equal(parseValue('10 mH'), 0.01);
  assert.equal(parseValue('220'), 220);
  for (const malo of ['', 'abc', '-5', '0', '1k2k']) assert.equal(parseValue(malo), null, malo);
  assert.equal(formatValue(1000, 'Ω'), '1 kΩ');
  assert.equal(formatValue(4700, 'Ω'), '4,7 kΩ');
  assert.equal(formatValue(1e-7, 'F'), '100 nF');
  assert.equal(formatValue(0.01, 'H'), '10 mH');
});

test('la rejilla no borra el SVG donde se dibujan los componentes', async () => {
  // Regresion: buildGrid vaciaba el contenedor y el dibujo acababa fuera de la pagina.
  const nodo = () => ({
    children: [], dataset: {}, appendChild(h) { this.children.push(h); return h; },
    set innerHTML(v) { this.html = v; },
  });
  globalThis.document = { createElement: nodo };
  const { buildGrid } = await import('../js/breadboard/breadboard.js');
  const svg = nodo();
  let insertado = null;
  const contenedor = {
    firstChild: svg,
    set innerHTML(v) { assert.fail('buildGrid no debe vaciar el contenedor'); },
    insertBefore(nuevo, antes) { insertado = [nuevo, antes]; },
  };
  buildGrid(contenedor);
  assert.equal(insertado[1], svg, 'la rejilla va delante del SVG');
  const agujeros = insertado[0].children.flatMap(function recorre(n) {
    return n.dataset?.holeId ? [n.dataset.holeId] : (n.children ?? []).flatMap(recorre);
  });
  assert.equal(agujeros.length, 63 * 12, '63 columnas: 5 + 5 filas y 2 carriles');
  delete globalThis.document;
});
