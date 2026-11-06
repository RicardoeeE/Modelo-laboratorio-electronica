import { getState, setCircuit, setFG, setPSU, setScope } from '../state.js';
import { autoscale } from '../instruments/autoscale.js';

let _experiments = [];
let _sidebarEl   = null;
let _guideEl     = null;
let _onSelect    = () => {};

export async function init(sidebarEl, guideEl, onSelect) {
  _sidebarEl = sidebarEl;
  _guideEl   = guideEl;
  _onSelect  = onSelect ?? _onSelect;

  const resp = await fetch('./data/experiments.json');
  const data = await resp.json();
  _experiments = data.experiments;

  _renderList();
  loadExperiment(_experiments[0].id);
}

export function getExperiments() {
  return _experiments;
}

export function loadExperiment(id) {
  const exp = _experiments.find(e => e.id === id);
  if (!exp) return;

  setFG({ ...exp.defaultFG });
  setPSU({ vPos: exp.defaultPSU.vPos, vNeg: exp.defaultPSU.vNeg });

  setCircuit({
    activeExperiment: exp.id,
    params: exp.defaultParams,
    replaceParams: true,
    mode: 'experiment',
    currentStep: 0,
  });

  const freq = exp.defaultFG.freq;
  const timeDiv = _autoTimeDiv(freq);
  setScope({ timeDiv });
  autoscale();

  _renderList();
  _renderGuide(exp);
}

function _autoTimeDiv(freq) {
  const period = 1 / freq;
  return +(period / 4).toPrecision(2);
}

function _groupName(id) {
  if (id.startsWith('rc-') || id.startsWith('rl-')) return 'Filtros pasivos';
  if (id.startsWith('opamp-')) return 'Amplificador operacional';
  if (id.startsWith('bjt-')) return 'Transistor';
  return 'Diodos';
}

function _renderList() {
  if (!_sidebarEl) return;
  const current = getState().circuit.activeExperiment;

  let group = null;
  _sidebarEl.innerHTML = _experiments.map(exp => {
    const name = _groupName(exp.id);
    const header = name !== group ? `<div class="exp-group">${name}</div>` : '';
    group = name;
    return `${header}
    <button class="exp-item ${exp.id === current ? 'active' : ''}" data-id="${exp.id}">
      <span class="exp-icon">${exp.icon}</span>
      <span class="exp-name">${exp.title}</span>
    </button>`;
  }).join('');

  _sidebarEl.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      loadExperiment(el.dataset.id);
      _onSelect();
    });
  });
}

function _renderGuide(exp) {
  if (!_guideEl) return;

  const state    = getState();
  const step     = state.circuit.currentStep ?? 0;
  const totalSteps = exp.steps.length;

  _guideEl.innerHTML = `
    <div class="guide-header">
      <div class="guide-title">${exp.title}</div>
      <div class="guide-formula">${exp.formula ?? ''}</div>
    </div>
    <div class="guide-desc">${exp.description}</div>

    <div class="guide-probes">
      ${Object.entries(exp.probes).map(([ch, desc]) =>
        `<div class="probe-row"><span class="probe-ch probe-${ch.toLowerCase()}">${ch}</span><span class="probe-desc">${desc}</span></div>`
      ).join('')}
    </div>

    <div class="guide-params" id="guide-params"></div>

    <div class="guide-step">
      <div class="step-header">Paso ${step + 1} / ${totalSteps}: ${exp.steps[step].title}</div>
      <div class="step-text">${exp.steps[step].text}</div>
    </div>

    <div class="guide-nav">
      <button class="nav-btn" id="step-prev" ${step === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="nav-btn" id="step-next" ${step === totalSteps - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>
  `;

  _renderParams(exp);

  _guideEl.querySelector('#step-prev')?.addEventListener('click', () => {
    const s = getState().circuit.currentStep ?? 0;
    if (s > 0) { setCircuit({ currentStep: s - 1 }); _renderGuide(exp); }
  });
  _guideEl.querySelector('#step-next')?.addEventListener('click', () => {
    const s = getState().circuit.currentStep ?? 0;
    if (s < totalSteps - 1) { setCircuit({ currentStep: s + 1 }); _renderGuide(exp); }
  });
}

function _renderParams(exp) {
  const paramsEl = _guideEl.querySelector('#guide-params');
  if (!paramsEl || !exp.paramControls) return;

  const state = getState();

  paramsEl.innerHTML = exp.paramControls.map(ctrl => {
    const scale  = ctrl.scale ?? 1;
    const rawVal = state.circuit.params[ctrl.key] ?? ctrl.default * scale;
    const dispVal = +(rawVal / scale).toFixed(ctrl.step < 1 ? 2 : 0);
    return `
      <div class="param-row">
        <label class="param-label">${ctrl.label} (${ctrl.unit})</label>
        <div class="stepper-group">
          <button class="step-btn param-step" data-key="${ctrl.key}" data-dir="-1"
            data-step="${ctrl.step}" data-scale="${scale}" data-min="${ctrl.min}" data-max="${ctrl.max}">‹</button>
          <input type="number" class="num-input param-input" data-key="${ctrl.key}" data-scale="${scale}"
            value="${dispVal}" min="${ctrl.min}" max="${ctrl.max}" step="${ctrl.step}">
          <button class="step-btn param-step" data-key="${ctrl.key}" data-dir="1"
            data-step="${ctrl.step}" data-scale="${scale}" data-min="${ctrl.min}" data-max="${ctrl.max}">›</button>
        </div>
      </div>
    `;
  }).join('');

  paramsEl.querySelectorAll('.param-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const { key, dir, step, scale, min, max } = btn.dataset;
      const cur = (getState().circuit.params[key] ?? 0) / parseFloat(scale);
      const nxt = Math.max(parseFloat(min), Math.min(parseFloat(max), cur + parseFloat(dir) * parseFloat(step)));
      setCircuit({ params: { [key]: nxt * parseFloat(scale) } });
      _renderGuide(exp);
    });
  });

  paramsEl.querySelectorAll('.param-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const key   = inp.dataset.key;
      const scale = parseFloat(inp.dataset.scale);
      const val   = parseFloat(inp.value);
      if (!isNaN(val)) {
        // El limite evita valores sin sentido físico (R negativa hace diverger el filtro).
        const limited = Math.max(parseFloat(inp.min), Math.min(parseFloat(inp.max), val));
        setCircuit({ params: { [key]: limited * scale } });
        _renderGuide(exp);
      }
    });
  });
}

export function renderFreeformHelp() {
  _renderList();
  if (!_guideEl) return;
  _guideEl.innerHTML = `
    <div class="guide-header">
      <div class="guide-title">Protoboard libre</div>
      <div class="guide-formula">Monta el circuito y mide</div>
    </div>
    <ol class="freeform-steps">
      <li><b>Gen</b>: coloca la salida del generador. Ahí mide CH1.</li>
      <li><b>Componentes</b>: elige uno y haz un clic por pata. Cada columna A–E conduce, y cada columna F–J también, pero no entre ellas.</li>
      <li><b>Carriles</b>: el de abajo es GND y el de arriba, V+ de la fuente. <b>Cable</b> une dos nodos.</li>
      <li><b>CH2</b>: coloca la sonda en la salida. Si el montaje es correcto, verás la señal.</li>
      <li><b>Selec.</b>: clic en un componente para cambiar su valor (10k, 100n, 4,7u).</li>
    </ol>
    <div class="guide-desc">Reconoce los 11 circuitos de la lista. No es un resolvedor general: otro montaje no da señal en CH2. El op-amp y el transistor toman la alimentación de la fuente.</div>
  `;
}

export function circuitTitle(id) {
  return _experiments.find(e => e.id === id)?.title ?? id;
}
