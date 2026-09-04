// Visibility preferences for the buttons drawn on the canvas. Owned here so the
// Tools panel, the player controls block's AUTO mode and the gizmo HUD agree.
const PLAYER_CONTROLS_KEY = 'flock-player-controls';
const GIZMO_CONTROLS_KEY = 'flock-gizmo-controls';

// Only keys localStorage refused, so private mode still honours the choice.
const unpersisted = new Map();
const listeners = new Set();

function read(key) {
  if (unpersisted.has(key)) return unpersisted.get(key);
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : raw === '1';
  } catch {
    return null; // storage disabled — fall back to the default
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
    unpersisted.delete(key);
  } catch {
    unpersisted.set(key, value);
  }
  listeners.forEach((fn) => fn());
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

// Until the user picks, follow the touch rule AUTO used to apply alone.
export function getPlayerControlsEnabled() {
  const stored = read(PLAYER_CONTROLS_KEY);
  return stored === null ? isTouchDevice() : stored;
}

export function setPlayerControlsEnabled(enabled) {
  write(PLAYER_CONTROLS_KEY, !!enabled);
}

export function getGizmoControlsEnabled() {
  const stored = read(GIZMO_CONTROLS_KEY);
  return stored === null ? true : stored;
}

export function setGizmoControlsEnabled(enabled) {
  write(GIZMO_CONTROLS_KEY, !!enabled);
}

// Returns an unsubscribe function.
export function onControlPreferenceChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
