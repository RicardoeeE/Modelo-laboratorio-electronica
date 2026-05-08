import { getState, setPSU } from '../state.js';

export function init(containerEl) {
  containerEl.innerHTML = _html();
  _bind(containerEl);
  _refresh(containerEl);
}

function _html() {
  return `
<div class="instr-panel psu-panel">
  <div class="instr-title">FUENTE DE ALIMENTACIÓN</div>
  <div class="instr-brand">HAMEG HM 8030-5</div>

  <div class="psu-displays">
    <div class="psu-ch">
      <div class="psu-ch-label">CH A</div>
      <div class="disp-value seg7 psu-disp" id="psu-vpos-disp">15.0</div>
      <div class="disp-unit">V</div>
    </div>
    <div class="psu-ch">
      <div class="psu-ch-label">CH B</div>
      <div class="disp-value seg7 psu-disp" id="psu-vneg-disp">−15.0</div>
      <div class="disp-unit">V</div>
    </div>
    <div class="psu-ch psu-ch-fixed">
      <div class="psu-ch-label">5V</div>
      <div class="disp-value seg7 psu-disp">5.0</div>
      <div class="disp-unit">V</div>
    </div>
  </div>

  <div class="psu-row">
    <label class="ctrl-label">V+ (0 – 20 V)</label>
    <div class="stepper-group">
      <button class="step-btn" data-action="vpos-down">‹</button>
      <input type="number" id="psu-vpos-input" class="num-input" min="0" max="20" step="0.5" value="15">
      <button class="step-btn" data-action="vpos-up">›</button>
    </div>
  </div>

  <div class="psu-row">
    <label class="ctrl-label">V− (−20 – 0 V)</label>
    <div class="stepper-group">
      <button class="step-btn" data-action="vneg-down">‹</button>
      <input type="number" id="psu-vneg-input" class="num-input" min="-20" max="0" step="0.5" value="-15">
      <button class="step-btn" data-action="vneg-up">›</button>
    </div>
  </div>

  <div class="psu-terminals">
    <div class="terminal red"   title="V+">V+</div>
    <div class="terminal black" title="GND">GND</div>
    <div class="terminal blue"  title="V−">V−</div>
    <div class="terminal red"   title="+5V">+5V</div>
  </div>
</div>
`;
}

function _bind(el) {
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => _handleAction(btn.dataset.action, el));
  });

  el.querySelector('#psu-vpos-input').addEventListener('change', e => {
    const v = Math.max(0, Math.min(20, parseFloat(e.target.value) || 0));
    setPSU({ vPos: v }); _refresh(el);
  });
  el.querySelector('#psu-vneg-input').addEventListener('change', e => {
    const v = Math.max(-20, Math.min(0, parseFloat(e.target.value) || 0));
    setPSU({ vNeg: v }); _refresh(el);
  });
}

function _handleAction(action, el) {
  const s = getState().psu;
  switch (action) {
    case 'vpos-up':   setPSU({ vPos: Math.min(20, +(s.vPos + 0.5).toFixed(1)) }); break;
    case 'vpos-down': setPSU({ vPos: Math.max(0,  +(s.vPos - 0.5).toFixed(1)) }); break;
    case 'vneg-up':   setPSU({ vNeg: Math.min(0,  +(s.vNeg + 0.5).toFixed(1)) }); break;
    case 'vneg-down': setPSU({ vNeg: Math.max(-20, +(s.vNeg - 0.5).toFixed(1)) }); break;
  }
  _refresh(el);
}

function _refresh(el) {
  const s = getState().psu;

  const vposInput = el.querySelector('#psu-vpos-input');
  if (vposInput && document.activeElement !== vposInput) {
    vposInput.value = s.vPos.toFixed(1);
  }
  const vnegInput = el.querySelector('#psu-vneg-input');
  if (vnegInput && document.activeElement !== vnegInput) {
    vnegInput.value = s.vNeg.toFixed(1);
  }

  const posDisp = el.querySelector('#psu-vpos-disp');
  if (posDisp) posDisp.textContent = s.vPos.toFixed(1);
  const negDisp = el.querySelector('#psu-vneg-disp');
  if (negDisp) negDisp.textContent = (s.vNeg < 0 ? '−' : '') + Math.abs(s.vNeg).toFixed(1);
}

export function refreshUI(containerEl) {
  _refresh(containerEl);
}
