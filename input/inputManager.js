class SimpleObservable {
  #listeners = [];

  add(callback) {
    this.#listeners.push(callback);
    return this;
  }

  remove(callback) {
    this.#listeners = this.#listeners.filter((l) => l !== callback);
  }

  notifyObservers(data) {
    for (const l of this.#listeners) l(data);
  }
}

export class InputManager {
  #keys = new Set();

  onKeyDownObservable = new SimpleObservable();
  onKeyUpObservable = new SimpleObservable();

  _setKey(key, pressed) {
    if (pressed) {
      if (!this.#keys.has(key)) {
        this.#keys.add(key);
        this.onKeyDownObservable.notifyObservers(key);
      }
    } else {
      if (this.#keys.has(key)) {
        this.#keys.delete(key);
        this.onKeyUpObservable.notifyObservers(key);
      }
    }
  }

  // Case-insensitive: stored keys are already canonical (lowercase single chars).
  isKeyDown(key) {
    return this.#keys.has(key) || this.#keys.has(key.toLowerCase());
  }

  // Clears held keys only — does not affect axes or gamepad state.
  _clearAllKeys() {
    for (const key of this.#keys) {
      this.onKeyUpObservable.notifyObservers(key);
    }
    this.#keys.clear();
  }

  heldKeyCount() {
    return this.#keys.size;
  }

  _keys() {
    return this.#keys[Symbol.iterator]();
  }
}
