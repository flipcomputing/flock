// CSS keywords that resolve against surrounding context and so have no
// meaning for a Babylon material colour; treated as invalid.
const CONTEXT_DEPENDENT_KEYWORDS = new Set([
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

// True when the string is something colour_from_string can turn into a real
// colour: bare 3/6-digit hex, or any CSS colour the browser accepts (named,
// rgb(), hsl(), transparent, ...), excluding the context-dependent keywords
// and var() references (which resolve against surrounding custom properties).
export function isValidColourInput(raw) {
  const value = typeof raw === 'string' ? raw.trim().replace(/^#/, '') : '';
  if (!value) return false;
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return true;
  // var() references only resolve against a surrounding context we don't have,
  // yet the CSSOM probe below accepts them, so reject them explicitly.
  if (/var\s*\(/i.test(value)) return false;
  if (CONTEXT_DEPENDENT_KEYWORDS.has(value.toLowerCase())) return false;
  const probe = new Option().style;
  probe.color = '';
  probe.color = value;
  return probe.color !== '';
}

export function normaliseColourInput(raw) {
  const value = (raw || '').trim();
  if (!isValidColourInput(value)) return null;
  const hexBody = value.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hexBody)) {
    return `#${hexBody
      .split('')
      .map((component) => component + component)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hexBody)) return `#${hexBody}`;
  return value;
}
