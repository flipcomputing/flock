// Shows the focused/selected block's tooltip text in a floating box over the
// top-right of the workspace.

function getContainer() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHint');
}

function getTextElement() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHintText');
}

// Wired on first render rather than at import: the tests mount the hint
// elements themselves, without the button.
function wireClose() {
  const button = document.getElementById('blockHintClose');
  if (!button || button.dataset.blockHintCloseWired) return;
  button.addEventListener('click', () => {
    setBlockHintsEnabled(false);
    document.getElementById('blockHintsBtn')?.focus();
  });
  button.dataset.blockHintCloseWired = 'true';
}

const EXPANDED_KEY = 'flock-block-hints-expanded';

// null means "never chosen", so the default applies.
function readStoredExpanded() {
  try {
    const stored = localStorage.getItem(EXPANDED_KEY);
    return stored === null ? null : stored === '1';
  } catch {
    return null; // storage disabled
  }
}

function writeStoredExpanded(value) {
  try {
    localStorage.setItem(EXPANDED_KEY, value ? '1' : '0');
  } catch {
    /* storage disabled — the session-local flag still works */
  }
}

// Off until the workspace toolbar's info button turns them on.
let enabled = readStoredExpanded() ?? false;
let suppressed = false;
let lastHintText = '';
let dismissMessage = null;

function removeMessageDismissal() {
  if (!dismissMessage || typeof document === 'undefined') return;
  document.removeEventListener('pointerdown', dismissMessage, true);
  dismissMessage = null;
}

function addMessageDismissal() {
  removeMessageDismissal();
  if (typeof document === 'undefined') return;

  dismissMessage = () => {
    removeMessageDismissal();
    hideBlockHint();
  };
  document.addEventListener('pointerdown', dismissMessage, true);
}

export function areBlockHintsEnabled() {
  return enabled;
}

export function setBlockHintsEnabled(value) {
  enabled = value;
  writeStoredExpanded(enabled);
  if (!enabled) {
    hideBlockHint();
  } else {
    renderBlockHint(suppressed ? '' : lastHintText);
  }
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('flock-block-hints-changed', { detail: { enabled } })
    );
  }
}

export function setBlockHintsSuppressed(value) {
  suppressed = value;
  if (suppressed) {
    hideBlockHint();
  } else {
    renderBlockHint(enabled ? lastHintText : '');
  }
}

function renderBlockHint(text) {
  removeMessageDismissal();
  const container = getContainer();
  const element = getTextElement();
  if (!container || !element) return;

  const content = text || '';
  if (!content) {
    container.hidden = true;
    element.replaceChildren();
    return;
  }

  element.replaceChildren();
  element.append(content.trim());

  wireClose();
  container.hidden = false;
}

export function showBlockHint(text) {
  lastHintText = text || '';
  renderBlockHint(enabled && !suppressed ? text : '');
}

// Shows a one-off message in the same box even while hints are collapsed, and
// dismisses it on the next click. boldPart, if given and found in text,
// renders as <strong> instead of plain text.
export function showBlockHintMessage(text, { boldPart } = {}) {
  removeMessageDismissal();
  const container = getContainer();
  const element = getTextElement();
  if (!container || !element) return;

  if (suppressed) {
    container.hidden = true;
    return;
  }

  const content = text || '';
  if (!content) {
    container.hidden = true;
    element.replaceChildren();
    return;
  }

  element.replaceChildren();
  const boldIndex = boldPart ? content.indexOf(boldPart) : -1;
  if (boldIndex === -1) {
    element.append(content);
  } else {
    const before = content.slice(0, boldIndex);
    const after = content.slice(boldIndex + boldPart.length);
    const strong = document.createElement('strong');
    strong.textContent = boldPart;
    element.append(before, strong, after);
  }

  wireClose();
  container.hidden = false;
  addMessageDismissal();
}

export function clearBlockHint() {
  showBlockHint('');
}

// Hides the current hint without clearing its remembered block text.
export function hideBlockHint() {
  removeMessageDismissal();
  const container = getContainer();
  if (container) container.hidden = true;
}
