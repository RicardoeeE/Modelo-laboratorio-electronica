import { getState, setFG } from '../state.js';

export function init(containerEl) {
  containerEl.innerHTML = _html();
  _bind(containerEl);
  _refresh(containerEl);
}

function _html() {
  return `
<div class="instr-panel fg-panel">
  <div class="instr-title">FUNCIÓN GENERADOR</div>
  <div class="instr-brand">HAMEG HM 8030</div>

  <div class="fg-display">
    <span class="disp-label">FREQ</span>
    <span class="disp-value seg7" id="fg-freq-disp">249</span>
    <span class="disp-unit" id="fg-freq-unit">Hz</span>
  </div>

  <div class="fg-row">
    <label class="ctrl-label">Frecuencia</label>
    <div class="stepper-group">
      <button class="step-btn" data-action="freq-decade-down" title="÷10">«</button>
      <button class="step-btn" data-action="freq-coarse-down" title="-10%">‹</button>
      <input type="number" id="fg-freq-input" class="num-input" min="0.1" max="8000000" step="1" value="249">
      <button class="step-btn" data-action="freq-coarse-up" title="+10%">›</button>
      <button class="step-btn" data-action="freq-decade-up" title="×10">»</button>
    </div>
  </div>

  <div class="fg-row">
    <label class="ctrl-label">Amplitud (Vp)</label>
    <div class="stepper-group">
      <button class="step-btn" data-action="amp-down">‹</button>
      <input type="number" id="fg-amp-input" class="num-input" min="0.01" max="20" step="0.1" value="1.0">
      <button class="step-btn" data-action="amp-up">›</button>
    </div>
  </div>

  <div class="fg-row">
    <label class="ctrl-label">Offset (V)</label>
    <div class="stepper-group">
      <button class="step-btn" data-action="offset-down">‹</button>
      <input type="number" id="fg-offset-input" class="num-input" min="-10" max="10" step="0.1" value="0">
      <button class="step-btn" data-action="offset-up">›</button>
    </div>
  </div>

  <div class="fg-row">
    <label class="ctrl-label">Forma de onda</label>
    <div class="wave-btns" id="fg-wave-btns">
      <button class="wave-btn active" data-wave="sine">∿ Seno</button>
      <button class="wave-btn" data-wave="square">⊓ Cuadra</button>
      <button class="wave-btn" data-wave="triangle">⋀ Trián</button>
    </div>
  </div>

  <div class="fg-row">
    <label class="ctrl-label">Salida</label>
    <button class="toggle-btn active" id="fg-enable-btn" data-action="toggle-enable">ON</button>
  </div>
</div>
`;
}

function _bind(el) {
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action, el));
  });

  el.querySelectorAll('[data-wave]').forEach(btn => {
    btn.addEventListener('click', () => {
      setFG({ waveform: btn.dataset.wave });
      _refresh(el);
    });
  });

  el.querySelector('#fg-freq-input').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) { setFG({ freq: v }); _refresh(el); }
  });
  el.querySelector('#fg-amp-input').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) { setFG({ amplitude: v }); _refresh(el); }
  });
  el.querySelector('#fg-offset-input').addEventListener('change', e => {
    setFG({ offset: parseFloat(e.target.value) || 0 });
  });
}

function _handleAction(action, el) {
  const s = getState().fg;
  switch (action) {
    case 'freq-decade-up':   setFG({ freq: Math.min(8e6, s.freq * 10) }); break;
    case 'freq-decade-down': setFG({ freq: Math.max(0.1, s.freq / 10) }); break;
    case 'freq-coarse-up':   setFG({ freq: Math.min(8e6, s.freq * 1.259) }); break;
    case 'freq-coarse-down': setFG({ freq: Math.max(0.1, s.freq / 1.259) }); break;
    case 'amp-up':   setFG({ amplitude: Math.min(20, +(s.amplitude + 0.1).toFixed(2)) }); break;
    case 'amp-down': setFG({ amplitude: Math.max(0.01, +(s.amplitude - 0.1).toFixed(2)) }); break;
    case 'offset-up':   setFG({ offset: Math.min(10, +(s.offset + 0.1).toFixed(2)) }); break;
    case 'offset-down': setFG({ offset: Math.max(-10, +(s.offset - 0.1).toFixed(2)) }); break;
    case 'toggle-enable': setFG({ enabled: !s.enabled }); break;
  }
  _refresh(el);
}

function _refresh(el) {
  const s = getState().fg;

  const freqInput = el.querySelector('#fg-freq-input');
  if (freqInput && document.activeElement !== freqInput) {
    freqInput.value = +s.freq.toFixed(3);
  }
  const ampInput = el.querySelector('#fg-amp-input');
  if (ampInput && document.activeElement !== ampInput) {
    ampInput.value = s.amplitude.toFixed(2);
  }
  const offInput = el.querySelector('#fg-offset-input');
  if (offInput && document.activeElement !== offInput) {
    offInput.value = s.offset.toFixed(2);
  }

  const disp = el.querySelector('#fg-freq-disp');
  const unit = el.querySelector('#fg-freq-unit');
  if (disp && unit) {
    if (s.freq >= 1e6)      { disp.textContent = (s.freq / 1e6).toFixed(3); unit.textContent = 'MHz'; }
    else if (s.freq >= 1e3) { disp.textContent = (s.freq / 1e3).toFixed(2); unit.textContent = 'kHz'; }
    else                    { disp.textContent = s.freq.toFixed(1);          unit.textContent = 'Hz';  }
  }

  el.querySelectorAll('[data-wave]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wave === s.waveform);
  });

  const enBtn = el.querySelector('#fg-enable-btn');
  if (enBtn) {
    enBtn.textContent = s.enabled ? 'ON' : 'OFF';
    enBtn.classList.toggle('active', s.enabled);
  }
}

export function refreshUI(containerEl) {
  _refresh(containerEl);
}
