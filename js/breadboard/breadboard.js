const COLS = 63;
const ROWS_TOP = ['A','B','C','D','E'];
const ROWS_BOT = ['F','G','H','I','J'];

let _nodeMap = {};

export function buildGrid(containerEl) {
  containerEl.innerHTML = '';
  _nodeMap = {};

  const wrap = document.createElement('div');
  wrap.className = 'bb-wrap';

  wrap.appendChild(_makeRail('top', COLS));

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

  wrap.appendChild(_makeRail('bottom', COLS));

  containerEl.appendChild(wrap);
}

function _makeRail(side, cols) {
  const rail = document.createElement('div');
  rail.className = `bb-rail bb-rail-${side}`;

  for (let c = 1; c <= cols; c++) {
    const h = document.createElement('div');
    h.className = 'hole rail-hole';
    h.dataset.holeId = `PWR_${side.toUpperCase()}_${c}`;
    h.dataset.node   = `PWR_${side.toUpperCase()}_${c > cols / 2 ? 'B' : 'A'}`;
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
    const holeId = `${rowLetter}${c}`;
    h.dataset.holeId = holeId;
    h.dataset.node   = _getNode(rowLetter, c);
    _nodeMap[holeId] = h.dataset.node;
    row.appendChild(h);
  }
  return row;
}

function _makeColumnNumbers(cols) {
  const divs = [];
  divs.push('<span class="bb-row-label-spacer"></span>');
  for (let c = 1; c <= cols; c++) {
    if (c % 5 === 0) {
      divs.push(`<span class="bb-col-num">${c}</span>`);
    } else {
      divs.push('<span class="bb-col-num"></span>');
    }
  }
  return divs.join('');
}

function _getNode(row, col) {
  const isTop = ROWS_TOP.includes(row);
  return isTop ? `T${col}` : `B${col}`;
}

export function getNodeForHole(holeId) {
  return _nodeMap[holeId] ?? holeId;
}

export function getConnectedHoles(holeId) {
  const node = getNodeForHole(holeId);
  return Object.entries(_nodeMap)
    .filter(([, n]) => n === node)
    .map(([id]) => id);
}

export function highlightHole(holeEl, active) {
  holeEl.classList.toggle('hole-highlight', active);
}

export function markHoleOccupied(holeId, occupied) {
  const el = document.querySelector(`[data-hole-id="${holeId}"]`);
  if (el) el.classList.toggle('hole-occupied', occupied);
}
