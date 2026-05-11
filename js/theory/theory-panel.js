let _data = null;
let _containerEl = null;
let _selectedId = null;

export async function init(containerEl) {
  _containerEl = containerEl;
  const resp = await fetch('./data/theory.json');
  _data = await resp.json();
  _buildShell();
}

export function show() { _containerEl.style.display = 'flex'; }
export function hide() { _containerEl.style.display = 'none'; }

function _buildShell() {
  _containerEl.innerHTML = `
    <div id="theory-sidebar">
      <div class="theory-sidebar-header">Referencia de Circuitos</div>
      <div id="theory-list"></div>
    </div>
    <div id="theory-detail">
      <div class="theory-placeholder">← Selecciona un circuito de la lista</div>
    </div>
  `;
  _renderList();
}

function _renderList() {
  const listEl = _containerEl.querySelector('#theory-list');
  listEl.innerHTML = _data.categories.map(cat => `
    <div class="theory-cat-header">${cat.name}</div>
    ${cat.circuits.map(c => `
      <div class="theory-item${c.id === _selectedId ? ' active' : ''}" data-id="${c.id}">
        <span class="theory-item-practica">${c.practica ?? ''}</span>
        <span class="theory-item-name">${c.name}</span>
      </div>
    `).join('')}
  `).join('');

  listEl.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      _selectedId = el.dataset.id;
      _renderList();
      _renderDetail(_findCircuit(_selectedId));
    });
  });
}

function _findCircuit(id) {
  for (const cat of _data.categories) {
    const found = cat.circuits.find(c => c.id === id);
    if (found) return found;
  }
  return null;
}

function _renderDetail(c) {
  if (!c) return;
  const detailEl = _containerEl.querySelector('#theory-detail');
  detailEl.innerHTML = `
    <div class="theory-detail-inner">
      <div class="theory-header">
        <div class="theory-title">${c.name}</div>
        <div class="theory-meta">
          ${c.type}
          ${c.practica ? ` &middot; <span class="theory-practica">${c.practica}</span>` : ''}
        </div>
      </div>
      <div class="theory-body">
        <div class="theory-left">
          <div class="theory-schematic-box">
            <div class="theory-schematic-label">Esquema del circuito</div>
            ${c.schematic}
          </div>
          <div class="theory-scope-box">
            <div class="theory-scope-label">Osciloscopio — conexión de sondas</div>
            <div class="theory-probe-row">
              <span class="probe-ch probe-ch1">CH1</span>
              <span class="probe-text">${c.scope_ch1}</span>
            </div>
            <div class="theory-probe-row">
              <span class="probe-ch probe-ch2">CH2</span>
              <span class="probe-text">${c.scope_ch2}</span>
            </div>
            <div class="theory-scope-notes">${c.scope_notes}</div>
          </div>
          <div class="theory-section">
            <div class="theory-section-title">Componentes / Señal de entrada</div>
            <div class="theory-components">${c.components}</div>
            ${c.signal ? `<div class="theory-signal">Señal: ${c.signal}</div>` : ''}
          </div>
        </div>
        <div class="theory-right">
          <div class="theory-section">
            <div class="theory-section-title">Función de transferencia y fórmulas</div>
            ${c.key_formulas.map(f => `<div class="theory-formula">${f}</div>`).join('')}
          </div>
          <div class="theory-section">
            <div class="theory-section-title">Medidas a realizar en laboratorio</div>
            ${c.measurements.map((m, i) => `
              <div class="theory-measure">
                <span class="theory-measure-num">${i + 1}</span>
                <span>${m}</span>
              </div>`).join('')}
          </div>
          <div class="theory-section">
            <div class="theory-section-title">Pasos de montaje</div>
            ${c.steps.map((s, i) => `
              <div class="theory-step">
                <span class="theory-step-num">${i + 1}</span>
                <span>${s}</span>
              </div>`).join('')}
          </div>
          ${c.warning ? `<div class="theory-warning">&#9888; ${c.warning}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}
