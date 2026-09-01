import * as Blockly from 'blockly';

// How long a typed prefix stays live between keystrokes, matching a native <select>.
const BUFFER_TIMEOUT_MS = 1000;

// FieldVariable appends these after the variable list. They stay prefix-matchable
// ("r" reaches Rename) but are barred from the substring fallback, because
// "Delete the 'box' variable" contains the variable's own name.
const ACTION_VALUES = new Set([Blockly.RENAME_VARIABLE_ID, Blockly.DELETE_VARIABLE_ID]);

// AltGr arrives as ctrl+alt on Windows and types real characters, so only a lone Ctrl
// (or any Meta) rules a key out. Shift has to reach us — it types capitals.
function isPrintable(event) {
  if (event.metaKey || (event.ctrlKey && !event.altKey)) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  return typeof event.key === 'string' && Array.from(event.key).length === 1;
}

// MenuItem.createDom puts the option's computed label on the element, which already
// accounts for image alt text and explicitly supplied option labels.
function labelOf(item) {
  const element = item.getElement?.();
  if (!element) return '';
  return (element.getAttribute('aria-label') || element.textContent || '').toLowerCase();
}

function find(items, from, test) {
  for (let i = 0; i < items.length; i++) {
    const item = items[(from + i) % items.length];
    if (item.isEnabled?.() === false) continue;
    if (test(labelOf(item), item)) return item;
  }
  return null;
}

function highlightMatch(menu, items, buffer, cycle) {
  const needle = buffer.toLowerCase();
  // A run of one character searches for that character alone, so pressing "b" again — or
  // holding it down — steps through the options starting with it.
  const characters = [...needle];
  const repeated = characters.every((character) => character === characters[0]);
  const term = repeated ? characters[0] : needle;

  const current = items.findIndex((item) =>
    item.getElement?.()?.classList.contains('blocklyMenuItemHighlight')
  );
  const from = (cycle || current < 0 ? current + 1 : current) % items.length;

  const match =
    find(items, from, (label) => label.startsWith(term)) ??
    find(
      items,
      from,
      (label, item) => !ACTION_VALUES.has(item.getValue?.()) && label.includes(term)
    );
  if (match) menu.setHighlighted(match);
}

// True when the key belonged to the search rather than to the menu.
function handleTypeahead(menu, event) {
  const items = menu.getMenuItems?.() ?? [];
  if (!items.length) return false;

  if (!menu.flockTypeahead) menu.flockTypeahead = { buffer: '', at: 0 };
  const search = menu.flockTypeahead;
  if (search.buffer && Date.now() - search.at > BUFFER_TIMEOUT_MS) search.buffer = '';

  if (event.key === 'Backspace') {
    // Consumed even with nothing buffered: Backspace is Blockly's delete shortcut, which
    // must not reach the workspace from behind an open menu.
    search.buffer = search.buffer.slice(0, -1);
    search.at = Date.now();
    if (search.buffer) highlightMatch(menu, items, search.buffer, false);
    return true;
  }
  // Space selects the highlighted item unless a search is already in flight.
  if (event.key === ' ' && !search.buffer) return false;
  if (!isPrintable(event)) return false;

  // Pressing the same key again steps past the current match; the first keystroke of a
  // search does not, so typing a name lands on it rather than skipping it.
  const sameKeyAgain =
    search.buffer.length > 0 &&
    [...search.buffer].every((character) => character.toLowerCase() === event.key.toLowerCase());
  search.buffer += event.key;
  search.at = Date.now();
  highlightMatch(menu, items, search.buffer, sameKeyAgain);
  return true;
}

// Lets an open menu — a variable or other dropdown field, or a context menu — be
// navigated by typing an option's name, the way a native <select> is.
export function installDropdownTypeahead() {
  const proto = Blockly.Menu?.prototype;
  const original = proto?.handleKeyEvent;
  // Blockly's own key handling is private. Without it there is no typeahead, but menus
  // keep working on the arrow keys.
  if (typeof original !== 'function' || proto.flockTypeaheadInstalled) return;

  proto.flockTypeaheadInstalled = true;
  proto.handleKeyEvent = function (event) {
    if (handleTypeahead(this, event)) {
      // Blockly binds its global shortcut handler to the drop-down div itself, so an
      // unconsumed letter reaches the workspace: "c" tidies it, "l" disables the block.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Enter, Escape, Tab and the arrows all end the search.
    if (this.flockTypeahead) this.flockTypeahead.buffer = '';
    return original.call(this, event);
  };
}
