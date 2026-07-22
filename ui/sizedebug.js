import { flock } from '../flock.js';

// Temporary on-device instrumentation for the canvas/buffer sizing bug.
// Three-finger tap toggles the readout. Remove once the numbers are known.

const MAX_SAMPLES = 40;
const samples = [];
let panel = null;
let listEl = null;
let gestureHandled = false;

function sample(label) {
  const canvas = flock.canvas || document.getElementById('renderCanvas');
  if (!canvas) return;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const bufW = canvas.width;
  const bufH = canvas.height;
  const renderW = flock.engine?.getRenderWidth?.() ?? 0;
  const renderH = flock.engine?.getRenderHeight?.() ?? 0;
  const ratio = cssW > 0 ? bufW / cssW : 0;
  const scale = flock.displayScale ?? 0;
  samples.unshift({
    label,
    t: Math.round(performance.now()),
    win: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    css: `${cssW}x${cssH}`,
    buf: `${bufW}x${bufH}`,
    render: `${renderW}x${renderH}`,
    ratio,
    scale,
    // What a 70px control actually measures on screen. Should stay ~52 CSS px.
    btn: ratio > 0 ? (70 * scale) / ratio : 0,
  });
  if (samples.length > MAX_SAMPLES) samples.length = MAX_SAMPLES;
  if (panel && panel.style.display !== 'none') render();
}

function asText() {
  return samples
    .map(
      (s) =>
        `${s.t}ms ${s.label}\n  win ${s.win} dpr ${s.dpr}\n  css ${s.css} buf ${s.buf} render ${s.render}\n  ratio ${s.ratio.toFixed(3)} scale ${s.scale.toFixed(3)} btn ${s.btn.toFixed(1)}px`
    )
    .join('\n');
}

function render() {
  if (!listEl) return;
  listEl.textContent = samples.length ? asText() : 'No samples yet — rotate the device.';
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText =
    'font:inherit;padding:6px 10px;margin-right:6px;background:#333;color:#fff;border:1px solid #666;border-radius:4px;';
  b.addEventListener('click', onClick);
  return b;
}

function buildPanel() {
  panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed;inset:8px;z-index:2147483647;display:none;',
    'background:rgba(0,0,0,0.9);color:#0f0;',
    'font:11px/1.35 monospace;padding:10px;border-radius:6px;',
    'overflow:auto;-webkit-overflow-scrolling:touch;',
  ].join('');

  const bar = document.createElement('div');
  bar.style.cssText = 'margin-bottom:8px;';
  bar.appendChild(
    button('Copy', () => {
      navigator.clipboard?.writeText(asText()).catch(() => {
        // Clipboard blocked on this device; the text is still readable on screen.
      });
    })
  );
  bar.appendChild(
    button('Clear', () => {
      samples.length = 0;
      render();
    })
  );
  bar.appendChild(button('Sample', () => sample('manual')));
  bar.appendChild(button('Close', toggle));

  listEl = document.createElement('pre');
  listEl.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;';

  panel.appendChild(bar);
  panel.appendChild(listEl);
  document.body.appendChild(panel);
}

function toggle() {
  if (!panel) buildPanel();
  const showing = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = showing ? 'block' : 'none';
  if (showing) {
    sample('opened');
    render();
  }
}

export function initSizeDebug() {
  if (typeof window === 'undefined' || window.__flockSizeDebug) return;
  if (!flock.isDebugLoggingEnabled()) return;

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length >= 3 && !gestureHandled) {
        gestureHandled = true;
        toggle();
      }
    },
    { passive: true }
  );
  // touchcancel too: a stolen gesture may never deliver a touchend, which would
  // leave the toggle stuck until reload.
  const endGesture = (e) => {
    if (e.touches.length === 0) gestureHandled = false;
  };
  document.addEventListener('touchend', endGesture, { passive: true });
  document.addEventListener('touchcancel', endGesture, { passive: true });

  window.addEventListener('orientationchange', () => {
    sample('orientationchange');
    // The settle window the rotation fix targets.
    [100, 300, 700, 1500].forEach((ms) => setTimeout(() => sample(`+${ms}ms`), ms));
  });
  window.addEventListener('resize', () => sample('resize'));
  window.addEventListener('flock:canvas-resize', () => sample('canvas-resize'));
  window.visualViewport?.addEventListener('resize', () => sample('visualViewport'));

  window.__flockSizeDebug = { toggle, sample, samples, asText };
}
