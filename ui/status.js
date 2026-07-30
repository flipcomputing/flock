// Editor status line. Not flock.printText: that one paints into the canvas.

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

// duration 0 keeps the message up until something replaces or clears it.
export function showStatus(content, { duration = 0, owner: nextOwner = null } = {}) {
  const element = getElement();
  if (!element) return;

  cancelHide();
  owner = nextOwner;
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
  const element = getElement();
  if (element) element.replaceChildren();
}
