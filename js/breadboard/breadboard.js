import { nodeOf } from './netlist-builder.js';

const COLS = 63;
const ROWS_TOP = ['A','B','C','D','E'];
const ROWS_BOT = ['F','G','H','I','J'];

export function buildGrid(containerEl) {
  const wrap = document.createElement('div');
  wrap.className = 'bb-wrap';

  wrap.appendChild(_makeRail('top', 'V+', COLS));

  const topGrid = document.createElement('div');
  topGrid.className = 'bb-grid';
  ROWS_TOP.forEach(row => topGrid.appendChild(_makeRow(row, COLS)));
  wrap.appendChild(topGrid);

  const gap = document.createElement('div');
  gap.className = 'bb-gap';
  gap.innerHTML = _makeColumnNumbers(COLS);
  wrap.appendChild(gap);

  const botGrid = document.createElement('div');
  botGrid.className = 'bb-grid';
  ROWS_BOT.forEach(row => botGrid.appendChild(_makeRow(row, COLS)));
  wrap.appendChild(botGrid);

  wrap.appendChild(_makeRail('bottom', 'GND', COLS));

  // Delante del SVG de los componentes: vaciar el contenedor se lo llevaria por delante.
  containerEl.insertBefore(wrap, containerEl.firstChild);
}

function _makeRail(side, name, cols) {
  const rail = document.createElement('div');
  rail.className = `bb-rail bb-rail-${side}`;

  const label = document.createElement('span');
  label.className = 'bb-rail-label';
  label.textContent = name;
  rail.appendChild(label);

  for (let c = 1; c <= cols; c++) {
    const h = document.createElement('div');
    h.className = 'hole rail-hole';
    h.dataset.holeId = `PWR_${side.toUpperCase()}_${c}`;
    h.title = name;
    rail.appendChild(h);
  }
  return rail;
}

function _makeRow(rowLetter, cols) {
  const row = document.createElement('div');
  row.className = 'bb-row';

  const label = document.createElement('span');
  label.className = 'bb-row-label';
  label.textContent = rowLetter;
  row.appendChild(label);

  for (let c = 1; c <= cols; c++) {
    const h = document.createElement('div');
    h.className = 'hole';
    h.dataset.holeId = `${rowLetter}${c}`;
    h.dataset.node = nodeOf(h.dataset.holeId);
    row.appendChild(h);
  }
  return row;
}

function _makeColumnNumbers(cols) {
  const divs = ['<span class="bb-row-label-spacer"></span>'];
  for (let c = 1; c <= cols; c++) {
    divs.push(`<span class="bb-col-num">${c % 5 === 0 ? c : ''}</span>`);
  }
  return divs.join('');
}
