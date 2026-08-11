// Shows the focused/selected block's tooltip text in a floating box over the
// top-right of the workspace.

function getContainer() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHint');
}

function getTextElement() {
  return typeof document === 'undefined' ? null : document.getElementById('blockHintText');
}

// Matches "Keyword: word" (or "Keyword:word") so it can be pulled out to the
// front as "[key emoji]word - rest of the description".
const KEYWORD_RE = /Keyword:\s*(\S+)/;

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
  const match = KEYWORD_RE.exec(content);
  if (!match) {
    element.append(content);
  } else {
    const description = (
      content.slice(0, match.index) + content.slice(match.index + match[0].length)
    ).trim();

    const word = document.createElement('span');
    word.className = 'block-hint__keyword';
    word.textContent = match[1];
    element.append('🔑', word);
    if (description) element.append(` - ${description}`);
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
