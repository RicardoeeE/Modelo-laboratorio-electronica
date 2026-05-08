import { getState, setBreadboard } from '../state.js';
import { markHoleOccupied, getNodeForHole } from './breadboard.js';

let _containerEl = null;
let _svgEl       = null;

const COMPONENT_COLORS = {
  R:      '#e8a000',
  C:      '#4488ff',
  L:      '#44cc44',
  D:      '#ff4444',
  LED:    '#ff44ff',
  OPAMP:  '#44ffff',
  BJT:    '#ffaa44',
  WIRE:   '#aaaaaa',
};

export function init(containerEl, svgEl) {
  _containerEl = containerEl;
  _svgEl       = svgEl;

  containerEl.addEventListener('click', _onHoleClick);
  containerEl.addEventListener('mouseover', _onHoleHover);
  containerEl.addEventListener('mouseout',  _onHoleOut);

  renderComponents();
}

function _onHoleClick(e) {
  const hole = e.target.closest('.hole');
  if (!hole) return;

  const holeId = hole.dataset.holeId;
  const s = getState().breadboard;

  if (s.selectedTool === 'delete') {
    _deleteAtHole(holeId);
    return;
  }

  if (s.selectedTool === 'select') {
    return;
  }

  if (!s.pendingFirst) {
    setBreadboard({ pendingFirst: holeId });
    hole.classList.add('hole-pending');
  } else {
    const h1 = s.pendingFirst;
    const h2 = holeId;

    if (h1 !== h2) {
      _placeComponent(s.selectedTool, h1, h2);
    }

    document.querySelectorAll('.hole-pending').forEach(el => el.classList.remove('hole-pending'));
    setBreadboard({ pendingFirst: null });
  }
}

function _onHoleHover(e) {
  const hole = e.target.closest('.hole');
  if (hole) hole.classList.add('hole-hover');
}

function _onHoleOut(e) {
  const hole = e.target.closest('.hole');
  if (hole) hole.classList.remove('hole-hover');
}

function _placeComponent(type, h1, h2) {
  const s = getState().breadboard;
  const newComp = {
    id:       `comp_${Date.now()}`,
    type,
    terminal1: h1,
    terminal2: h2,
    value:    _defaultValue(type),
    label:    _defaultLabel(type, s.components.length + 1),
  };

  const comps = [...s.components, newComp];
  setBreadboard({ components: comps });
  markHoleOccupied(h1, true);
  markHoleOccupied(h2, true);
  renderComponents();
}

function _deleteAtHole(holeId) {
  const s = getState().breadboard;
  const comps = s.components.filter(c => c.terminal1 !== holeId && c.terminal2 !== holeId);
  setBreadboard({ components: comps });
  markHoleOccupied(holeId, false);
  renderComponents();
}

export function renderComponents() {
  if (!_svgEl || !_containerEl) return;
  _svgEl.innerHTML = '';

  const rect = _containerEl.getBoundingClientRect();
  _svgEl.setAttribute('width',  rect.width);
  _svgEl.setAttribute('height', rect.height);

  const s = getState().breadboard;

  s.components.forEach(comp => {
    const el1 = document.querySelector(`[data-hole-id="${comp.terminal1}"]`);
    const el2 = document.querySelector(`[data-hole-id="${comp.terminal2}"]`);
    if (!el1 || !el2) return;

    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();

    const x1 = r1.left - rect.left + r1.width  / 2;
    const y1 = r1.top  - rect.top  + r1.height / 2;
    const x2 = r2.left - rect.left + r2.width  / 2;
    const y2 = r2.top  - rect.top  + r2.height / 2;

    const color = COMPONENT_COLORS[comp.type] ?? '#888';
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    if (comp.type === 'WIRE') {
      _svgLine(_svgEl, x1, y1, x2, y2, color, 2);
    } else {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return;
      const ux = dx / len, uy = dy / len;

      const bodyLen = Math.min(len * 0.5, 20);
      const bx1 = mx - ux * bodyLen / 2;
      const by1 = my - uy * bodyLen / 2;
      const bx2 = mx + ux * bodyLen / 2;
      const by2 = my + uy * bodyLen / 2;

      _svgLine(_svgEl, x1, y1, bx1, by1, color, 1.5);
      _svgLine(_svgEl, bx2, by2, x2, y2, color, 1.5);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const hw = bodyLen / 2, hh = 5;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      g.setAttribute('x', mx - hw);
      g.setAttribute('y', my - hh);
      g.setAttribute('width', bodyLen);
      g.setAttribute('height', hh * 2);
      g.setAttribute('rx', comp.type === 'C' ? 0 : 2);
      g.setAttribute('fill',   color);
      g.setAttribute('stroke', '#111');
      g.setAttribute('stroke-width', '1');
      g.setAttribute('transform', `rotate(${angle}, ${mx}, ${my})`);
      _svgEl.appendChild(g);

      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', mx);
      t.setAttribute('y', my - 8);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '9');
      t.setAttribute('fill', '#eee');
      t.setAttribute('font-family', 'monospace');
      t.textContent = `${comp.label}`;
      _svgEl.appendChild(t);
    }
  });
}

function _svgLine(svg, x1, y1, x2, y2, color, width) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', width);
  svg.appendChild(line);
}

function _defaultValue(type) {
  const map = { R: 1000, C: 1e-7, L: 1e-3, D: 0.7, LED: 2.1, OPAMP: null, BJT: null, WIRE: null };
  return map[type] ?? null;
}

function _defaultLabel(type, n) {
  const map = { R: 'R', C: 'C', L: 'L', D: 'D', LED: 'LED', OPAMP: 'U', BJT: 'Q', WIRE: 'W' };
  return `${map[type] ?? type}${n}`;
}

export function setValueForComponent(compId, value) {
  const s = getState().breadboard;
  const comps = s.components.map(c => c.id === compId ? { ...c, value } : c);
  setBreadboard({ components: comps });
}
