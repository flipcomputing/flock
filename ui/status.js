// Status line for the editor's own tools. Not flock.printText: that is the
// program-facing API and paints into the canvas. One slot, last write wins.

let hideTimer = null;
let owner = null;

function getElement() {
  return typeof document === 'undefined' ? null : document.getElementById('gizmoStatus');
}

function cancelHide() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// duration 0 keeps the message up until something replaces or clears it.
export function showStatus(text, { duration = 0, owner: nextOwner = null } = {}) {
  const element = getElement();
  if (!element) return;

  cancelHide();
  owner = nextOwner;
  element.textContent = text;

  const seconds = Number(duration);
  if (Number.isFinite(seconds) && seconds > 0) {
    hideTimer = setTimeout(() => clearStatus(), seconds * 1000);
  }
}

// Passing an owner clears only that owner's message. Teardowns that run on
// every click (cleanupPlacementMode, cleanupScenePick) must pass one, or they
// wipe whatever another tool just put up. No owner clears unconditionally.
export function clearStatus(forOwner = null) {
  if (forOwner !== null && owner !== forOwner) return;
  cancelHide();
  owner = null;
  const element = getElement();
  if (element) element.textContent = '';
}
