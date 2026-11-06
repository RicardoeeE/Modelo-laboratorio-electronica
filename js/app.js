import { getState, on, setScope, setScopeCh1, setScopeCh2, setCircuit, setBreadboard } from './state.js';
import { computeOutput } from './engine/circuit-engine.js';
import * as Scope      from './instruments/oscilloscope.js';
import * as FG         from './instruments/function-generator.js';
import * as PSU        from './instruments/power-supply.js';
import { buildGrid }   from './breadboard/breadboard.js';
import { init as initPlacer, renderComponents, onToolChange, setHint } from './breadboard/component-placer.js';
import { buildNetlist } from './breadboard/netlist-builder.js';
import {
  init as initExperiments, loadExperiment, getExperiments, renderFreeformHelp, circuitTitle,
} from './experiments/experiment-manager.js';
import { autoscale } from './instruments/autoscale.js';
import { VDIV_STEPS } from './engine/measurements.js';
import { init as initTheory, show as showTheory, hide as hideTheory } from './theory/theory-panel.js';

// ── V/div sequence (standard scope steps) ──────────────────────────────────────────
const TDIV_STEPS = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4,
                    1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];

function stepUp(arr, val)   { const i = arr.indexOf(_nearest(arr, val)); return arr[Math.min(i + 1, arr.length - 1)]; }
function stepDown(arr, val) { const i = arr.indexOf(_nearest(arr, val)); return arr[Math.max(i - 1, 0)]; }
function _nearest(arr, val) { return arr.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a); }

// ── Recompute and render ──────────────────────────────────────────────────────
let _pending = false;
let _lastExperimentId = null;
let _mode = 'experiment';
let _detectedId = null;

function recompute() {
  if (_pending) return;
  _pending = true;
  requestAnimationFrame(() => {
    _pending = false;
    const state = getState();
    const { ch1, ch2, sampleRate } = computeOutput(state);

    Scope.update(ch1, ch2, sampleRate);
    _updateScopeControlsUI();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Instruments
  FG.init(document.getElementById('fg-container'));
  PSU.init(document.getElementById('psu-container'));
  Scope.init(document.getElementById('scope-canvas'));

  // Breadboard
  const bbEl  = document.getElementById('breadboard');
  const svgEl = document.getElementById('bb-svg');
  buildGrid(bbEl);
  initPlacer(bbEl, svgEl);

  // Experiments
  await initExperiments(
    document.getElementById('sidebar-list'),
    document.getElementById('guide-panel'),
    () => _showMode('experiment')
  );
  _showMode('experiment');

  await initTheory(document.getElementById('theory-panel'));

  // Scope controls
  _bindScopeControls();

  // Mode toggle
  document.getElementById('btn-mode-experiment').addEventListener('click', () => _setMode('experiment'));
  document.getElementById('btn-mode-freeform').addEventListener('click',   () => _setMode('freeform'));
  document.getElementById('btn-mode-theory').addEventListener('click',     () => _setMode('theory'));

  // Palette
  _bindPalette();

  // Clear board
  document.getElementById('clear-board').addEventListener('click', () => {
    setBreadboard({ components: [], pending: [], selectedId: null });
    onToolChange();
  });

  // Subscribe to state changes
  on('change:fg',       recompute);
  on('change:fg',       () => FG.refreshUI(document.getElementById('fg-container')));
  on('change:psu',      recompute);
  on('change:psu',      () => PSU.refreshUI(document.getElementById('psu-container')));
  on('change:circuit',  recompute);
  on('change:circuit',  renderComponents);
  on('change:breadboard', _onBreadboardChange);
  on('change:scope', () => { _updateScopeControlsUI(); if (!getState().scope.running) Scope.forceRender(); });

  // Start scope loop
  Scope.startLoop();

  // Initial render
  recompute();
  _updateScopeControlsUI();
});

// ── Scope control bindings ──────────────────────────────────────────────────
function _bindScopeControls() {
  document.getElementById('scope-run-stop').addEventListener('click', () => {
    const running = !getState().scope.running;
    setScope({ running });
    if (running) Scope.startLoop(); else Scope.stopLoop();
    const btn = document.getElementById('scope-run-stop');
    btn.textContent = running ? 'RUN' : 'STOP';
    btn.classList.toggle('stopped', !running);
  });

  document.getElementById('ch1-vdiv-up').addEventListener('click',   () => { setScopeCh1({ vdiv: stepUp(VDIV_STEPS, getState().scope.ch1.vdiv) });   _updateScopeControlsUI(); });
  document.getElementById('ch1-vdiv-down').addEventListener('click', () => { setScopeCh1({ vdiv: stepDown(VDIV_STEPS, getState().scope.ch1.vdiv) }); _updateScopeControlsUI(); });
  document.getElementById('ch2-vdiv-up').addEventListener('click',   () => { setScopeCh2({ vdiv: stepUp(VDIV_STEPS, getState().scope.ch2.vdiv) });   _updateScopeControlsUI(); });
  document.getElementById('ch2-vdiv-down').addEventListener('click', () => { setScopeCh2({ vdiv: stepDown(VDIV_STEPS, getState().scope.ch2.vdiv) }); _updateScopeControlsUI(); });

  document.getElementById('tdiv-up').addEventListener('click',   () => { setScope({ timeDiv: stepUp(TDIV_STEPS, getState().scope.timeDiv) });   recompute(); });
  document.getElementById('tdiv-down').addEventListener('click', () => { setScope({ timeDiv: stepDown(TDIV_STEPS, getState().scope.timeDiv) }); recompute(); });

  document.getElementById('ch1-pos-up').addEventListener('click',   () => { setScopeCh1({ position: getState().scope.ch1.position + 0.5 }); });
  document.getElementById('ch1-pos-down').addEventListener('click', () => { setScopeCh1({ position: getState().scope.ch1.position - 0.5 }); });
  document.getElementById('ch2-pos-up').addEventListener('click',   () => { setScopeCh2({ position: getState().scope.ch2.position + 0.5 }); });
  document.getElementById('ch2-pos-down').addEventListener('click', () => { setScopeCh2({ position: getState().scope.ch2.position - 0.5 }); });

  document.getElementById('trig-up').addEventListener('click',   () => { setScope({ triggerLevel: +(getState().scope.triggerLevel + 0.1).toFixed(2) }); _updateScopeControlsUI(); });
  document.getElementById('trig-down').addEventListener('click', () => { setScope({ triggerLevel: +(getState().scope.triggerLevel - 0.1).toFixed(2) }); _updateScopeControlsUI(); });

  document.getElementById('ch1-toggle').addEventListener('click', () => {
    const en = !getState().scope.ch1.enabled;
    setScopeCh1({ enabled: en });
    document.getElementById('ch1-toggle').classList.toggle('off', !en);
  });
  document.getElementById('ch2-toggle').addEventListener('click', () => {
    const en = !getState().scope.ch2.enabled;
    setScopeCh2({ enabled: en });
    document.getElementById('ch2-toggle').classList.toggle('off', !en);
  });
}

function _updateScopeControlsUI() {
  const s = getState().scope;
  document.getElementById('ch1-vdiv-val').textContent = _fmtV(s.ch1.vdiv);
  document.getElementById('ch2-vdiv-val').textContent = _fmtV(s.ch2.vdiv);
  document.getElementById('tdiv-val').textContent     = _fmtT(s.timeDiv);
  document.getElementById('trig-val').textContent     = s.triggerLevel.toFixed(1) + 'V';
}

// ── Palette ───────────────────────────────────────────────────────────────────
function _bindPalette() {
  document.querySelectorAll('#palette-bar [data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#palette-bar [data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setBreadboard({ selectedTool: btn.dataset.tool });
      onToolChange();
    });
  });
}

// ── Breadboard change → detect circuit ──────────────────────────────────────────
function _onBreadboardChange() {
  if (getState().circuit.mode !== 'freeform') return;

  const result = buildNetlist(getState().breadboard.components);
  const badge = document.getElementById('detected-circuit');
  const previous = _detectedId;
  _detectedId = result.id;

  badge.hidden = !result.id && !result.reason;
  badge.classList.toggle('unknown', !result.id);
  badge.textContent = result.id
    ? `${circuitTitle(result.id)}${result.note ? ` · ${result.note}` : ''}`
    : result.reason;

  if (result.id) {
    setCircuit({ activeExperiment: result.id, params: result.params, replaceParams: true });
    if (result.id !== previous) autoscale();
  } else {
    setCircuit({ activeExperiment: null });
  }
  renderComponents();
}

// ── Mode switch ──────────────────────────────────────────────────────────────────
function _showMode(mode) {
  _mode = mode;
  document.getElementById('btn-mode-experiment').classList.toggle('active', mode === 'experiment');
  document.getElementById('btn-mode-freeform').classList.toggle('active',   mode === 'freeform');
  document.getElementById('btn-mode-theory').classList.toggle('active',     mode === 'theory');

  const main = document.getElementById('main');
  main.classList.toggle('theory-mode',     mode === 'theory');
  main.classList.toggle('freeform-mode',   mode === 'freeform');
  main.classList.toggle('experiment-mode', mode === 'experiment');
  document.getElementById('workspace').style.display = mode === 'theory' ? 'none' : '';

  if (mode === 'experiment') {
    document.getElementById('detected-circuit').hidden = true;
    setHint('Montaje de referencia de este experimento. Para montarlo tú, abre Protoboard libre.');
  }
}

function _setMode(mode) {
  const previous = _mode;
  if (mode === previous) return;
  _showMode(mode);

  if (mode === 'theory') {
    showTheory();
    return;
  }
  hideTheory();

  if (mode === 'freeform') {
    if (getState().circuit.mode === 'experiment') _lastExperimentId = getState().circuit.activeExperiment;
    _detectedId = null;
    setCircuit({ mode, activeExperiment: null });
    renderFreeformHelp();
    onToolChange();
    _onBreadboardChange();
  } else if (previous === 'theory' && getState().circuit.mode === 'experiment') {
    // Se vuelve de leer la teoria: el experimento y sus ajustes siguen como estaban.
    renderComponents();
  } else {
    loadExperiment(_lastExperimentId ?? getExperiments()[0]?.id);
    _showMode('experiment');
  }
  recompute();
}

// ── Formatters ───────────────────────────────────────────────────────────────────
function _fmtV(v) {
  if (v >= 1)   return `${v}V`;
  return `${v * 1000}mV`;
}

function _fmtT(t) {
  if (t >= 1)     return `${t.toFixed(1)}s`;
  if (t >= 1e-3)  return `${(t * 1e3).toFixed(1)}ms`;
  if (t >= 1e-6)  return `${(t * 1e6).toFixed(1)}µs`;
  return `${(t * 1e9).toFixed(0)}ns`;
}
