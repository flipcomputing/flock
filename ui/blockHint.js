// Shows the focused/selected block's tooltip text in a floating box over the
// top-right of the workspace.

function getContainer() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHint');
}

function getTextElement() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHintText');
}

// Strips the "Keyword: word" suffix — that's a toolbox search term, only
// useful before a block is placed, not for a hint about one already selected.
const KEYWORD_RE = /\s*Keyword:\s*\S+/;

// Matches the app's mobile breakpoint (style.css: @media (max-width: 1024px)):
// hints default off there, since screen space is tight, but stay toggleable
// from the Tools menu.
function isMobileLayout() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 1024px)').matches;
}

let enabled = !isMobileLayout();
let suppressed = false;
let lastHintText = '';

export function areBlockHintsEnabled() {
  return enabled;
}

export function setBlockHintsEnabled(value) {
  enabled = value;
  if (!enabled) {
    hideBlockHint();
  } else {
    renderBlockHint(suppressed ? '' : lastHintText);
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
  element.append(content.replace(KEYWORD_RE, '').trim());

  container.hidden = false;
}

export function showBlockHint(text) {
  lastHintText = text || '';
  renderBlockHint(enabled && !suppressed ? text : '');
}

// Shows a one-off message in the same box regardless of the enabled/disabled
// toggle — e.g. the startup tip, which needs to appear even when hints are
// off (that's exactly when it's telling the user how to turn them on).
// boldPart, if given and found in text, renders as <strong> instead of plain text.
export function showBlockHintMessage(text, { boldPart } = {}) {
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

  container.hidden = false;
}

export function clearBlockHint() {
  showBlockHint('');
}

// Hides the current hint without clearing its text, so a future caller could
// still wire this up to a dismiss control.
export function hideBlockHint() {
  const container = getContainer();
  if (container) container.hidden = true;
}
