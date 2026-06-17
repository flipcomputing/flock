import { DEFAULT_BINDINGS } from './bindings.js';
import { normaliseKey } from './normaliseKey.js';

// Reverse maps built from DEFAULT_BINDINGS (static — overrides not reflected here).
const ACTION_KEYS = new Map(
  Object.entries(DEFAULT_BINDINGS).map(([action, keys]) => [action, keys])
);

const KEY_TO_ACTIONS = new Map();
for (const [action, keys] of ACTION_KEYS) {
  for (const key of keys) {
    if (!KEY_TO_ACTIONS.has(key)) KEY_TO_ACTIONS.set(key, []);
    KEY_TO_ACTIONS.get(key).push(action);
  }
}

class SimpleObservable {
  #listeners = [];

  add(callback) {
    this.#listeners.push(callback);
    // Return an observer object for reliable removal — matching Babylon.js pattern
    return { _callback: callback };
  }

  remove(observer) {
    this.#listeners = this.#listeners.filter((l) => l !== observer._callback);
  }

  notifyObservers(data) {
    for (const l of this.#listeners) l(data);
  }
}

// Rate limit for "while held" repeats: fire at most once per this interval (ms)
const REPEAT_INTERVAL_MS = 100;

export class InputManager {
  // Refcount: key → number of active presses across all sources.
  // Entries are deleted when count reaches 0, so all entries have count > 0.
  #keys = new Map();
  #axes = new Map();
  #actionOverrides = new Map();
  #lastKeyRepeatTime = new Map(); // key → timestamp of last repeat
  #lastActionRepeatTime = new Map(); // action → timestamp of last repeat

  onKeyDownObservable = new SimpleObservable();
  onKeyUpObservable = new SimpleObservable();
  onActionDownObservable = new SimpleObservable();
  onActionUpObservable = new SimpleObservable();
  onRawKeyDownObservable = new SimpleObservable();
  // Fired on held keys/actions at a rate-limited interval. Used by "while held"
  // event blocks (when key/action pressed) to fire continuously. Deliberately
  // separate from the down observables so refcount, movement, a11y, and
  // interaction stay edge-only (they must not re-fire on every repeat tick).
  onKeyRepeatObservable = new SimpleObservable();
  onActionRepeatObservable = new SimpleObservable();

  _setKey(key, pressed) {
    const count = this.#keys.get(key) ?? 0;
    if (pressed) {
      this.#keys.set(key, count + 1);
      if (count === 0) {
        this.onKeyDownObservable.notifyObservers(key);
        this._notifyActionDown(key);
      }
    } else {
      if (count === 0) return;
      const next = count - 1;
      if (next === 0) {
        this.#keys.delete(key);
        this.#lastKeyRepeatTime.delete(key); // Clean up repeat timestamp
        this.onKeyUpObservable.notifyObservers(key);
        this._notifyActionUp(key);
      } else {
        this.#keys.set(key, next);
      }
    }
  }

  // OS auto-repeat tick for a held key. Does not touch refcount/movement;
  // only emits the repeat signals consumed by "while held" event blocks.
  // Rate-limited to prevent excessive firing on fast input sources (e.g. gamepad polling).
  _repeatKey(key) {
    const now = Date.now();
    const lastTime = this.#lastKeyRepeatTime.get(key) ?? 0;
    if (now - lastTime < REPEAT_INTERVAL_MS) return;

    this.#lastKeyRepeatTime.set(key, now);
    this.onKeyRepeatObservable.notifyObservers(key);
    for (const action of this._getActionsForKey(key)) {
      const lastActionTime = this.#lastActionRepeatTime.get(action) ?? 0;
      if (now - lastActionTime >= REPEAT_INTERVAL_MS) {
        this.#lastActionRepeatTime.set(action, now);
        this.onActionRepeatObservable.notifyObservers(action);
      }
    }
  }

  _notifyActionDown(key) {
    for (const action of this._getActionsForKey(key)) {
      const wasAlreadyActive = this._getActionKeys(action).some(
        (k) => k !== key && (this.#keys.get(k) ?? 0) > 0
      );
      if (!wasAlreadyActive) {
        this.onActionDownObservable.notifyObservers(action);
      }
    }
  }

  _notifyActionUp(key) {
    for (const action of this._getActionsForKey(key)) {
      const stillActive = this._getActionKeys(action).some((k) => (this.#keys.get(k) ?? 0) > 0);
      if (!stillActive) {
        this.#lastActionRepeatTime.delete(action); // Clean up repeat timestamp
        this.onActionUpObservable.notifyObservers(action);
      }
    }
  }

  // Case-insensitive: stored keys are already canonical (lowercase single chars).
  isKeyDown(key) {
    return (this.#keys.get(key) ?? 0) > 0 || (this.#keys.get(key.toLowerCase()) ?? 0) > 0;
  }

  isActionDown(action) {
    return this._getActionKeys(action).some((k) => (this.#keys.get(k) ?? 0) > 0);
  }

  setActionKey(action, key) {
    this.#actionOverrides.set(action, [normaliseKey(key)]);
  }

  resetActionKeys() {
    this.#actionOverrides.clear();
  }

  hasActionOverride(action) {
    return this.#actionOverrides.has(action);
  }

  _getActionKeys(action) {
    return this.#actionOverrides.get(action) ?? ACTION_KEYS.get(action) ?? [];
  }

  _getActionsForKey(key) {
    const actions = new Set();
    // Only include static bindings for actions without overrides.
    for (const action of KEY_TO_ACTIONS.get(key) ?? []) {
      if (!this.#actionOverrides.has(action)) actions.add(action);
    }
    // Add actions bound to this key via active overrides.
    for (const [action, keys] of this.#actionOverrides) {
      if (keys.includes(key)) actions.add(action);
    }
    return actions;
  }

  _setAxis(name, value) {
    this.#axes.set(name, value);
  }

  getAxis(name) {
    return this.#axes.get(name) ?? 0;
  }

  _notifyRawKeyDown(event) {
    this.onRawKeyDownObservable.notifyObservers(event);
  }

  // Test-only utility: clears all held keys regardless of source.
  _clearAllKeys() {
    const held = [...this.#keys.keys()];
    const activeActions = new Set();
    for (const key of held) {
      for (const action of this._getActionsForKey(key)) {
        activeActions.add(action);
      }
    }
    this.#keys.clear();
    this.#lastKeyRepeatTime.clear();
    this.#lastActionRepeatTime.clear();
    for (const key of held) {
      this.onKeyUpObservable.notifyObservers(key);
    }
    for (const action of activeActions) {
      this.onActionUpObservable.notifyObservers(action);
    }
  }

  heldKeyCount() {
    return this.#keys.size;
  }

  _keys() {
    return this.#keys.keys();
  }
}
