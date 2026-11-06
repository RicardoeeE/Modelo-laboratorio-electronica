import { getState, setScopeMeasurements } from '../state.js';
import {
  measureFrequency, measureVpp, measureVmax, measurePhase, visibleWindow
} from '../engine/measurements.js';

const GRID_H = 10;
const GRID_V = 8;

let canvas, ctx, dpr;
let rafId = null;
let _ch1 = null, _ch2 = null, _sampleRate = 10000;
let _pending = null;

export function init(canvasEl) {
  canvas = canvasEl;
  dpr = window.devicePixelRatio || 1;
  _resize();
  window.addEventListener('resize', _resize);
  _clearScreen();
}

function _resize() {
  const w = canvas.clientWidth  || 600;
  const h = canvas.clientHeight || 220;
  if (w === 0 || h === 0) {
    requestAnimationFrame(_resize);
    return;
  }
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  _clearScreen();
}

function _clearScreen() {
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = '#001400';
  ctx.fillRect(0, 0, w, h);
  _drawGrid(w, h);
}

// Con STOP, la pantalla se queda con lo capturado; los datos nuevos esperan a RUN.
export function update(ch1, ch2, sampleRate) {
  _pending = { ch1, ch2, sampleRate };
  if (getState().scope.running) _applyPending();
}

function _applyPending() {
  if (!_pending) return;
  _ch1 = _pending.ch1;
  _ch2 = _pending.ch2;
  _sampleRate = _pending.sampleRate;
  _pending = null;
}

export function startLoop() {
  _applyPending();
  if (rafId) return;
  const loop = () => {
    _render();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

export function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  _render();
}

export function forceRender() {
  _render();
}

function _render() {
  if (!ctx || !canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const state = getState();
  const scope = state.scope;

  // Phosphor persistence: partial clear each frame
  ctx.fillStyle = 'rgba(0, 20, 0, 0.45)';
  ctx.fillRect(0, 0, w, h);

  _drawGrid(w, h);

  const divW = w / GRID_H;
  const divH = h / GRID_V;

  if (_ch1) {
    const view = visibleWindow(_ch1, _sampleRate, scope.timeDiv, scope.triggerLevel, GRID_H);
    const pixPerSample = w / (scope.timeDiv * GRID_H * _sampleRate);
    if (scope.ch1.enabled) _drawTrace(_ch1, view, pixPerSample, scope.ch1, divH, h);
    if (_ch2 && scope.ch2.enabled) _drawTrace(_ch2, view, pixPerSample, scope.ch2, divH, h);
  }

  _drawTrigger(scope.triggerLevel, scope.ch1.vdiv, scope.ch1.position, divH, w, h);
  _drawStatus(w, h, scope);

  // Compute and store measurements
  if (_ch1 && _ch2) {
    const freq  = measureFrequency(_ch1, _sampleRate);
    const freq2 = measureFrequency(_ch2, _sampleRate);
    const vpp1  = measureVpp(_ch1);
    const vpp2  = measureVpp(_ch2);
    const vmax1 = measureVmax(_ch1);
    const phase = measurePhase(_ch1, _ch2, _sampleRate);
    setScopeMeasurements({ freq, freq2, vpp1, vpp2, vmax1, phase });
    _drawMeasurements(w, h, { freq, freq2, vpp1, vpp2, vmax1, phase });
  }
}

function _drawGrid(w, h) {
  const divW = w / GRID_H;
  const divH = h / GRID_V;
  const subdiv = 5;

  ctx.lineWidth = 0.5;

  // Minor grid (subdivisions — dots style)
  ctx.fillStyle = 'rgba(0,200,60,0.18)';
  for (let i = 0; i <= GRID_H * subdiv; i++) {
    for (let j = 0; j <= GRID_V * subdiv; j++) {
      const x = i * (divW / subdiv);
      const y = j * (divH / subdiv);
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  }

  // Major grid lines
  for (let i = 0; i <= GRID_H; i++) {
    const x = i * divW;
    const isCentre = i === GRID_H / 2;
    ctx.strokeStyle = isCentre ? 'rgba(0,200,60,0.5)' : 'rgba(0,200,60,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 0; j <= GRID_V; j++) {
    const y = j * divH;
    const isCentre = j === GRID_V / 2;
    ctx.strokeStyle = isCentre ? 'rgba(0,200,60,0.5)' : 'rgba(0,200,60,0.22)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Tick marks on centre axes
  ctx.strokeStyle = 'rgba(0,200,60,0.6)';
  ctx.lineWidth = 1;
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i <= GRID_H * subdiv; i++) {
    const x = i * (divW / subdiv);
    ctx.beginPath(); ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); ctx.stroke();
  }
  for (let j = 0; j <= GRID_V * subdiv; j++) {
    const y = j * (divH / subdiv);
    ctx.beginPath(); ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y); ctx.stroke();
  }
}

function _drawTrace(samples, view, pixPerSample, chCfg, divH, h) {
  const { start: startIdx, count } = view;
  const yCenter = h / 2 - chCfg.position * divH;
  const yScale  = divH / chCfg.vdiv;

  ctx.save();
  ctx.shadowBlur  = 5;
  ctx.shadowColor = chCfg.color;
  ctx.strokeStyle = chCfg.color;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();

  let started = false;
  const end = Math.min(startIdx + count, samples.length);
  for (let i = startIdx; i < end; i++) {
    const x = (i - startIdx) * pixPerSample;
    const y = yCenter - samples[i] * yScale;
    if (!started) { ctx.moveTo(x, y); started = true; }
    else           ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Channel label
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = chCfg.color;
  ctx.fillText(chCfg.label ?? '', chCfg.label === 'CH2' ? 34 : 4, yCenter - 6);
}

function _drawTrigger(level, vdiv, position, divH, w, h) {
  const yCenter = h / 2 - position * divH;
  const yScale  = divH / (vdiv || 1);
  const y = yCenter - level * yScale;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,200,0,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trigger arrow
  ctx.fillStyle = 'rgba(255,200,0,0.8)';
  ctx.beginPath();
  ctx.moveTo(6, y);
  ctx.lineTo(0, y - 5);
  ctx.lineTo(0, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _drawStatus(w, h, scope) {
  ctx.font = '11px monospace';

  // Run/Stop indicator
  if (scope.running) {
    ctx.fillStyle = '#00ff66';
    ctx.fillText('RUN', w - 36, 14);
  } else {
    ctx.fillStyle = '#ff4444';
    ctx.fillText('STOP', w - 40, 14);
  }

  // V/div labels
  ctx.fillStyle = scope.ch1.color;
  ctx.fillText(`CH1 ${_fmtV(scope.ch1.vdiv)}/div`, 4, h - 26);
  ctx.fillStyle = scope.ch2.color;
  ctx.fillText(`CH2 ${_fmtV(scope.ch2.vdiv)}/div`, 4, h - 14);

  // Time/div
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`${_fmtT(scope.timeDiv)}/div`, w / 2 - 28, h - 6);
}

function _drawMeasurements(w, h, m) {
  const x = w - 150;
  const lineH = 14;
  let y = 30;

  ctx.fillStyle = 'rgba(0,12,0,0.72)';
  ctx.fillRect(x - 8, y - 12, 152, lineH * 5 + 6);

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(0,255,100,0.85)';
  ctx.fillText(`f CH1: ${_fmtHz(m.freq)}`, x, y); y += lineH;
  ctx.fillText(`f CH2: ${_fmtHz(m.freq2)}`, x, y); y += lineH;

  ctx.fillStyle = getState().scope.ch1.color;
  ctx.fillText(`CH1 Vpp: ${m.vpp1.toFixed(3)}V`, x, y); y += lineH;

  ctx.fillStyle = getState().scope.ch2.color;
  ctx.fillText(`CH2 Vpp: ${m.vpp2.toFixed(3)}V`, x, y); y += lineH;

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Fase CH2: ${_fmtPhase(m.phase)}`, x, y);
}

// ── Formatters ───────────────────────────────────────────────────────────────

function _fmtV(v) {
  if (v >= 1)    return `${v.toFixed(0)}V`;
  if (v >= 0.1)  return `${(v * 1000).toFixed(0)}mV`;
  return `${(v * 1000).toFixed(0)}mV`;
}

function _fmtT(t) {
  if (t >= 1)       return `${t.toFixed(1)}s`;
  if (t >= 1e-3)    return `${(t * 1e3).toFixed(1)}ms`;
  if (t >= 1e-6)    return `${(t * 1e6).toFixed(1)}µs`;
  return `${(t * 1e9).toFixed(1)}ns`;
}

function _fmtPhase(p) {
  if (p === null) return '—';
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}°`;
}

function _fmtHz(f) {
  if (!f) return '—';
  if (f >= 1e6) return `${(f / 1e6).toFixed(3)}MHz`;
  if (f >= 1e3) return `${(f / 1e3).toFixed(2)}kHz`;
  return `${f.toFixed(1)}Hz`;
}
