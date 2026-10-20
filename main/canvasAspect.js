const ASPECTS = { '16:9': 16 / 9, '9:16': 9 / 16 };
export const DEFAULT_CANVAS_ASPECT = '16:9';
export const PORTRAIT_CANVAS_ASPECT = '9:16';

let current = DEFAULT_CANVAS_ASPECT;

export function getCanvasAspectName() {
  return current;
}

export function getCanvasAspect() {
  return ASPECTS[current];
}

export function isPortraitCanvas() {
  return current === PORTRAIT_CANVAS_ASPECT;
}

export function setCanvasAspectName(name) {
  const next = Object.hasOwn(ASPECTS, name) ? name : DEFAULT_CANVAS_ASPECT;
  if (next === current) return;
  current = next;
  document.body.classList.toggle('portrait-canvas', isPortraitCanvas());
  window.dispatchEvent(new Event('flock:canvas-aspect'));
}
