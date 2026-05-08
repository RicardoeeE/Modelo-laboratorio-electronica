const _listeners = {};

const _state = {
  fg: {
    freq: 249,
    amplitude: 1.0,
    waveform: 'sine',
    offset: 0.0,
    enabled: true
  },
  psu: {
    vPos: 15.0,
    vNeg: -15.0,
    v5: 5.0
  },
  scope: {
    running: true,
    ch1: { vdiv: 0.5, enabled: true, position: 0, color: '#e8e000', label: 'CH1' },
    ch2: { vdiv: 0.5, enabled: true, position: 0, color: '#d040e0', label: 'CH2' },
    timeDiv: 2e-3,
    triggerLevel: 0,
    triggerSlope: 'rising',
    measurements: { freq: 0, vpp1: 0, vpp2: 0, phase: 0, rms1: 0 }
  },
  circuit: {
    activeExperiment: 'rc-lowpass',
    params: { R: 1000, C: 1e-7 },
    mode: 'experiment',
    currentStep: 0
  },
  breadboard: {
    components: [],
    connections: [],
    selectedTool: 'select',
    pendingFirst: null,
    detectedCircuit: null
  }
};

function emit(event) {
  (_listeners[event] ?? []).forEach(cb => cb());
  (_listeners['*'] ?? []).forEach(cb => cb(event));
}

export function on(event, cb) {
  (_listeners[event] ??= []).push(cb);
}

export function off(event, cb) {
  if (_listeners[event]) {
    _listeners[event] = _listeners[event].filter(l => l !== cb);
  }
}

export function getState() {
  return _state;
}

export function setFG(patch) {
  Object.assign(_state.fg, patch);
  emit('change:fg');
}

export function setPSU(patch) {
  Object.assign(_state.psu, patch);
  emit('change:psu');
}

export function setScope(patch) {
  Object.assign(_state.scope, patch);
  emit('change:scope');
}

export function setScopeCh1(patch) {
  Object.assign(_state.scope.ch1, patch);
  emit('change:scope');
}

export function setScopeCh2(patch) {
  Object.assign(_state.scope.ch2, patch);
  emit('change:scope');
}

export function setScopeMeasurements(patch) {
  Object.assign(_state.scope.measurements, patch);
  emit('change:measurements');
}

export function setCircuit(patch) {
  if (patch.params !== undefined) {
    Object.assign(_state.circuit.params, patch.params);
    const rest = { ...patch };
    delete rest.params;
    Object.assign(_state.circuit, rest);
  } else {
    Object.assign(_state.circuit, patch);
  }
  emit('change:circuit');
}

export function setBreadboard(patch) {
  Object.assign(_state.breadboard, patch);
  emit('change:breadboard');
}
