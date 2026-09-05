// Editor status line. Not flock.printText: that one paints into the canvas.
import { getGizmoHintsEnabled, onControlPreferenceChange } from './controlPreferences.js';

let hideTimer = null;
let owner = null;
let showingHint = false;

function getElement() {
  return typeof document === 'undefined' ? null : document.getElementById('gizmoStatus');
}

let closeWired = false;

// Wired on first use rather than at import: the button is part of the page,
// but the tests mount the status element on its own.
function wireClose() {
  if (closeWired) return;
  const button = document.getElementById('gizmoStatusClose');
  if (!button) return;
  button.addEventListener('click', () => clearStatus());
  closeWired = true;
}

function cancelHide() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// A segment is either a leaf ({ text, bold }) or a group ({ parts, barColor })
// whose parts sit behind a coloured rule.
function toNode({ text, bold, barColor, parts }) {
  if (parts) {
    const group = document.createElement('span');
    group.classList.add('gizmo-status__reading');
    // The rule is a ::before, so its colour has to travel as a custom property.
    if (barColor) group.style.setProperty('--axis-color', barColor);
    group.append(...parts.map(toNode));
    return group;
  }
  if (!bold) return document.createTextNode(text);
  const span = document.createElement('span');
  span.textContent = text;
  span.classList.add('gizmo-status__axis');
  return span;
}

function render(element, content) {
  if (typeof content === 'string') {
    element.textContent = content;
    return;
  }
  element.replaceChildren(...content.map(toNode));
}

// duration 0 keeps the message up until something replaces or clears it. A
// hint is one of the tools' prompts, which the Tools panel can turn off;
// readouts pass no flag and always show.
export function showStatus(content, { duration = 0, owner: nextOwner = null, hint = false } = {}) {
  const element = getElement();
  if (!element) return;
  if (hint && !getGizmoHintsEnabled()) return;

  cancelHide();
  wireClose();
  owner = nextOwner;
  showingHint = hint;
  render(element, content);

  const seconds = Number(duration);
  if (Number.isFinite(seconds) && seconds > 0) {
    hideTimer = setTimeout(() => clearStatus(), seconds * 1000);
  }
}

// Teardowns that run on every click must pass an owner, or they wipe whatever
// another tool just put up.
export function clearStatus(forOwner = null) {
  if (forOwner !== null && owner !== forOwner) return;
  cancelHide();
  owner = null;
  showingHint = false;
  const element = getElement();
  if (element) element.replaceChildren();
}

// Turning hints off in the Tools panel takes the one on screen with it.
onControlPreferenceChange(() => {
  if (showingHint && !getGizmoHintsEnabled()) clearStatus();
});
