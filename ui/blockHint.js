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

export function areBlockHintsEnabled() {
  return enabled;
}

export function setBlockHintsEnabled(value) {
  enabled = value;
  if (!enabled) hideBlockHint();
}

export function showBlockHint(text) {
  const container = getContainer();
  const element = getTextElement();
  if (!container || !element) return;

  const content = enabled ? text || '' : '';
  if (!content) {
    container.hidden = true;
    element.replaceChildren();
    return;
  }

  element.replaceChildren();
  element.append(content.replace(KEYWORD_RE, '').trim());

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
