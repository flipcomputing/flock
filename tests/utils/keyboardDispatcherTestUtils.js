import { KeyboardDispatcher } from '../../main/keyboardDispatcher.js';

/**
 * Returns the handler function at the top of KeyboardDispatcher's internal
 * mode stack — the mode most recently pushed by pushMode(), and the one that
 * would receive the next real keydown event. Tests call this directly rather
 * than dispatching a real DOM event through the whole input pipeline.
 * @returns {Function|undefined}
 */
export function topHandler() {
  const top = KeyboardDispatcher._modeStack[KeyboardDispatcher._modeStack.length - 1];
  return top?.handler;
}

/**
 * Builds a fake keyboard event sufficient for directly invoking a handler
 * retrieved via topHandler(). Only the fields the various keyboard-mode
 * handlers in this codebase actually read are included.
 * @param {object} overrides
 */
export function makeKeyEvent(overrides = {}) {
  return {
    target: document.body,
    key: '',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...overrides,
  };
}

/**
 * Dispatches a real keyup event on document — for handlers (like
 * ui/canvas-utils.js's) that listen for keyup directly rather than through
 * KeyboardDispatcher, so it can't be exercised via topHandler()/makeKeyEvent.
 * @param {string} key
 */
export function dispatchKeyup(key) {
  document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}
