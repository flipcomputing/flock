import { flock } from '../flock.js';

const FPS_KEY = 'flock-show-fps';
const UPDATE_MS = 500;

let timer = null;

function readEnabled() {
  try {
    return localStorage.getItem(FPS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabled(value) {
  try {
    localStorage.setItem(FPS_KEY, value ? '1' : '0');
  } catch {
    // storage disabled — the choice lasts for this session only
  }
}

function setVisible(counter, visible) {
  counter.hidden = !visible;
  clearInterval(timer);
  timer = null;
  if (!visible) return;
  const update = () => {
    const fps = flock.engine?.getFps();
    counter.textContent = Number.isFinite(fps) ? `${Math.round(fps)} FPS` : '-- FPS';
  };
  update();
  timer = setInterval(update, UPDATE_MS);
}

export function initFpsCounter() {
  const checkbox = document.getElementById('fpsCheckbox');
  const counter = document.getElementById('fpsCounter');
  if (!checkbox || !counter) return;

  checkbox.checked = readEnabled();
  setVisible(counter, checkbox.checked);

  checkbox.addEventListener('change', () => {
    writeEnabled(checkbox.checked);
    setVisible(counter, checkbox.checked);
  });
}
