import { getState, setCircuit, setFG, setPSU, setScope } from '../state.js';

let _experiments = [];
let _sidebarEl   = null;
let _guideEl     = null;

export async function init(sidebarEl, guideEl) {
  _sidebarEl = sidebarEl;
  _guideEl   = guideEl;

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
    params: { ...exp.defaultParams },
    mode: 'experiment',
    currentStep: 0,
  });

  const freq = exp.defaultFG.freq;
  const timeDiv = _autoTimeDiv(freq);
  setScope({ timeDiv });

  _renderList();
  _renderGuide(exp);
}

function _autoTimeDiv(freq) {
  const period = 1 / freq;
  return +(period / 4).toPrecision(2);
}

function _renderList() {
  if (!_sidebarEl) return;
  const current = getState().circuit.activeExperiment;

  _sidebarEl.innerHTML = _experiments.map(exp => `
    <div class="exp-item ${exp.id === current ? 'active' : ''}" data-id="${exp.id}">
      <span class="exp-icon">${exp.icon}</span>
      <span class="exp-name">${exp.title}</span>
    </div>
  `).join('');

  _sidebarEl.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => loadExperiment(el.dataset.id));
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
      <button class="nav-btn" id="step-prev" ${step === 0 ? 'disabled' : ''}>◄ Anterior</button>
      <button class="nav-btn" id="step-next" ${step === totalSteps - 1 ? 'disabled' : ''}>Siguiente ►</button>
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
        setCircuit({ params: { [key]: val * scale } });
        _renderGuide(exp);
      }
    });
  });
}

export function onCircuitChange() {
  const exp = _experiments.find(e => e.id === getState().circuit.activeExperiment);
  if (exp) _renderGuide(exp);
}
