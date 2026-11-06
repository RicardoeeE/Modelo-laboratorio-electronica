import { getState, setBreadboard } from '../state.js';
import { parseValue, formatValue } from './netlist-builder.js';
import { montajeOf } from './montajes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const COMPONENT_COLORS = {
  R:      '#e8a000',
  C:      '#4488ff',
  L:      '#44cc44',
  D:      '#ff4444',
  LED:    '#ff44ff',
  OPAMP:  '#44ffff',
  BJT:    '#ffaa44',
  WIRE:   '#aaaaaa',
  GEN:    '#e8e000',
  CH2:    '#d040e0',
};

// Una entrada por pata, en el orden en que se pide con cada clic.
const PINS = {
  R: ['una pata', 'la otra pata'],
  C: ['una pata', 'la otra pata'],
  L: ['una pata', 'la otra pata'],
  WIRE: ['un extremo', 'el otro extremo'],
  D: ['el ánodo', 'el cátodo'],
  LED: ['el ánodo', 'el cátodo'],
  OPAMP: ['el pin −', 'el pin +', 'la salida'],
  BJT: ['la base', 'el colector', 'el emisor'],
  GEN: ['la salida del generador'],
  CH2: ['la punta de la sonda'],
};
const PIN_MARKS = { OPAMP: ['−', '+', 'S'], BJT: ['B', 'C', 'E'], D: ['A', 'K'], LED: ['A', 'K'] };

const DEFAULT_VALUES = { R: 1000, C: 1e-7, L: 0.01, D: 0.7, LED: 2.1 };
const UNITS = { R: 'Ω', C: 'F', L: 'H', D: 'V', LED: 'V' };
const LABELS = { R: 'R', C: 'C', L: 'L', D: 'D', LED: 'LED', OPAMP: 'U', BJT: 'Q', WIRE: 'W' };

let _containerEl = null;
let _svgEl = null;
let _idCounter = 0;

export function init(containerEl, svgEl) {
  _containerEl = containerEl;
  _svgEl = svgEl;

  containerEl.addEventListener('click', _onClick);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && getState().breadboard.pending.length) _cancelPending();
  });
  document.getElementById('comp-value').addEventListener('change', _onValueChange);
  window.addEventListener('resize', renderComponents);

  renderComponents();
}

function _inFreeform() {
  return getState().circuit.mode === 'freeform';
}

function _onClick(e) {
  if (!_inFreeform()) return;

  const body = e.target.closest?.('[data-comp-id]');
  if (body) {
    const tool = getState().breadboard.selectedTool;
    if (tool === 'delete') _delete(body.dataset.compId);
    if (tool === 'select') _select(body.dataset.compId);
    return;
  }

  const hole = e.target.closest('.hole');
  if (!hole) return;

  const holeId = hole.dataset.holeId;
  const s = getState().breadboard;
  const owner = s.components.find(c => c.pins.includes(holeId));

  if (s.selectedTool === 'delete') {
    if (owner) _delete(owner.id);
    return;
  }
  if (s.selectedTool === 'select') {
    _select(owner?.id ?? null);
    return;
  }

  if (s.pending.includes(holeId)) {
    _cancelPending();
    return;
  }
  if (owner) {
    setHint(`Ese agujero ya lo usa ${owner.label}. Usa otro de la misma columna: conducen entre sí.`);
    return;
  }

  const pending = [...s.pending, holeId];
  if (pending.length === PINS[s.selectedTool].length) {
    _place(s.selectedTool, pending);
    setBreadboard({ pending: [] });
    setHint(promptFor(s.selectedTool, 0));
  } else {
    setBreadboard({ pending });
    setHint(promptFor(s.selectedTool, pending.length));
  }
  renderComponents();
}

function _cancelPending() {
  const { selectedTool } = getState().breadboard;
  setBreadboard({ pending: [] });
  setHint(promptFor(selectedTool, 0));
  renderComponents();
}

export function promptFor(tool, pinIndex) {
  if (tool === 'select') return 'Clic en un componente para cambiar su valor.';
  if (tool === 'delete') return 'Clic en un componente para quitarlo.';
  const name = document.querySelector(`#palette-bar [data-tool="${tool}"]`)?.textContent.trim() ?? tool;
  return `${name}: clic en el agujero de ${PINS[tool][pinIndex]}. Esc o repetir el clic cancela.`;
}

export function setHint(text) {
  const el = document.getElementById('bb-hint');
  if (el) el.textContent = text;
}

function _place(type, pins) {
  const s = getState().breadboard;
  const prefix = LABELS[type];
  const taken = s.components.filter(c => c.type === type)
    .map(c => parseInt(c.label.slice(prefix?.length ?? 0), 10) || 0);
  const label = prefix ? `${prefix}${Math.max(0, ...taken) + 1}` : type === 'GEN' ? 'Gen' : 'CH2';
  const comp = { id: `comp_${++_idCounter}`, type, pins, value: DEFAULT_VALUES[type] ?? null, label };
  setBreadboard({ components: [...s.components, comp] });
}

function _delete(id) {
  const s = getState().breadboard;
  const selectedId = s.selectedId === id ? null : s.selectedId;
  setBreadboard({ components: s.components.filter(c => c.id !== id), selectedId });
  _refreshEditor();
  renderComponents();
}

function _select(id) {
  setBreadboard({ selectedId: id });
  _refreshEditor();
  renderComponents();
}

function _refreshEditor() {
  const { components, selectedId } = getState().breadboard;
  const comp = components.find(c => c.id === selectedId);
  const editor = document.getElementById('comp-editor');
  const editable = comp && UNITS[comp.type];
  editor.hidden = !editable;
  if (!editable) return;
  document.getElementById('comp-label').textContent = `${comp.label} =`;
  const input = document.getElementById('comp-value');
  input.value = formatValue(comp.value, UNITS[comp.type]);
  input.classList.remove('invalid');
}

function _onValueChange(e) {
  const { components, selectedId } = getState().breadboard;
  const value = parseValue(e.target.value);
  if (value === null) {
    e.target.classList.add('invalid');
    setHint('No entiendo ese valor. Prueba 10k, 100n, 4,7u o 1M.');
    return;
  }
  setBreadboard({ components: components.map(c => (c.id === selectedId ? { ...c, value } : c)) });
  _refreshEditor();
  renderComponents();
}

// Reinicia lo que depende de la herramienta elegida en la paleta.
export function onToolChange() {
  const { selectedTool } = getState().breadboard;
  setBreadboard({ pending: [], selectedId: null });
  _refreshEditor();
  setHint(promptFor(selectedTool, 0));
  renderComponents();
}

function _visibleComponents() {
  const { circuit, breadboard } = getState();
  if (circuit.mode === 'experiment') return montajeOf(circuit.activeExperiment, circuit.params);
  return breadboard.components;
}

export function renderComponents() {
  if (!_svgEl || !_containerEl) return;
  _svgEl.innerHTML = '';

  const rect = _containerEl.getBoundingClientRect();
  if (rect.width === 0) return;
  _svgEl.setAttribute('width', rect.width);
  _svgEl.setAttribute('height', rect.height);

  const { selectedTool, selectedId, pending } = getState().breadboard;
  _svgEl.classList.toggle('interactive', _inFreeform() && ['select', 'delete'].includes(selectedTool));

  const comps = _visibleComponents();
  const center = hole => {
    const r = document.querySelector(`[data-hole-id="${hole}"]`)?.getBoundingClientRect();
    return r && { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
  };

  document.querySelectorAll('.hole-occupied, .hole-pending').forEach(el => {
    el.classList.remove('hole-occupied', 'hole-pending');
  });
  comps.flatMap(c => c.pins).forEach(h => {
    document.querySelector(`[data-hole-id="${h}"]`)?.classList.add('hole-occupied');
  });
  if (_inFreeform()) {
    pending.forEach(h => document.querySelector(`[data-hole-id="${h}"]`)?.classList.add('hole-pending'));
  }

  comps.forEach(comp => {
    const points = comp.pins.map(center);
    if (points.some(p => !p)) return;
    const g = _el('g', { 'data-comp-id': comp.id, class: comp.id === selectedId ? 'comp selected' : 'comp' }, _svgEl);
    const color = COMPONENT_COLORS[comp.type] ?? '#888';
    if (comp.pins.length === 1) _drawProbe(g, points[0], comp, color);
    else if (comp.pins.length === 3) _drawThreePin(g, points, comp, color);
    else if (comp.type === 'WIRE') _drawWire(g, points, color);
    else _drawTwoPin(g, points, comp, color);
  });
}

function _el(name, attrs, parent) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  parent?.appendChild(el);
  return el;
}

function _line(parent, a, b, color, width) {
  return _el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-width': width }, parent);
}

function _text(parent, x, y, content, anchor = 'middle', fill = '#eee') {
  const t = _el('text', {
    x, y, 'text-anchor': anchor, 'font-size': 9, fill, 'font-family': 'monospace', stroke: '#0a0d10',
    'stroke-width': 2.5, 'paint-order': 'stroke',
  }, parent);
  t.textContent = content;
}

function _drawWire(g, [a, b], color) {
  _line(g, a, b, color, 2);
  _line(g, a, b, 'transparent', 8); // para poder hacer clic en un cable fino
}

function _drawProbe(g, p, comp, color) {
  _el('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: color, 'stroke-width': 2 }, g);
  _el('circle', { cx: p.x, cy: p.y, r: 2.5, fill: color }, g);
  _text(g, p.x, p.y - 9, comp.label, 'middle', color);
}

function _drawTwoPin(g, [a, b], comp, color) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const bodyLen = Math.min(len * 0.6, 22);
  const p1 = { x: mx - ux * bodyLen / 2, y: my - uy * bodyLen / 2 };
  const p2 = { x: mx + ux * bodyLen / 2, y: my + uy * bodyLen / 2 };

  _line(g, a, p1, color, 1.5);
  _line(g, p2, b, color, 1.5);
  _el('rect', {
    x: mx - bodyLen / 2, y: my - 5, width: bodyLen, height: 10, rx: comp.type === 'C' ? 0 : 2,
    fill: color, stroke: '#111', 'stroke-width': 1,
    transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}, ${mx}, ${my})`,
  }, g);
  if (PIN_MARKS[comp.type]) {
    // Banda del catodo, como en el diodo real.
    _line(g, { x: p2.x - uy * 5 - ux * 3, y: p2.y + ux * 5 - uy * 3 }, { x: p2.x + uy * 5 - ux * 3, y: p2.y - ux * 5 - uy * 3 }, '#111', 2.5);
  }
  const unit = UNITS[comp.type];
  const text = unit && comp.value && !PIN_MARKS[comp.type] ? `${comp.label} ${formatValue(comp.value, unit)}` : comp.label;
  _text(g, mx, my - 8, text);
}

function _drawThreePin(g, points, comp, color) {
  const cx = points.reduce((s, p) => s + p.x, 0) / 3;
  const cy = points.reduce((s, p) => s + p.y, 0) / 3;
  const marks = PIN_MARKS[comp.type];
  points.forEach((p, i) => {
    _line(g, p, { x: cx, y: cy }, color, 1.5);
    _text(g, p.x + 8, p.y - 6, marks[i], 'start', color);
  });
  const s = 11;
  const shape = comp.type === 'OPAMP'
    ? _el('polygon', { points: `${cx - s},${cy - s} ${cx + s},${cy} ${cx - s},${cy + s}` }, g)
    : _el('circle', { cx, cy, r: s - 1 }, g);
  shape.setAttribute('fill', color);
  shape.setAttribute('stroke', '#111');
  _text(g, cx, cy - s - 3, comp.label);
}
