import { normaliseKey } from "./normaliseKey.js";

export class OnScreenSource {
  #inputManager;
  #pressedKeys = new Map(); // key -> press count

  constructor(inputManager) {
    this.#inputManager = inputManager;
  }

  press(key) {
    const normalized = normaliseKey(key);
    const count = this.#pressedKeys.get(normalized) ?? 0;
    this.#pressedKeys.set(normalized, count + 1);
    this.#inputManager._setKey(normalized, true);
  }

  release(key) {
    const normalized = normaliseKey(key);
    const count = this.#pressedKeys.get(normalized) ?? 0;
    if (count > 0) {
      const next = count - 1;
      if (next === 0) {
        this.#pressedKeys.delete(normalized);
      } else {
        this.#pressedKeys.set(normalized, next);
      }
      this.#inputManager._setKey(normalized, false);
    }
  }

  releaseAll() {
    const keys = [...this.#pressedKeys.keys()];
    for (const key of keys) {
      const count = this.#pressedKeys.get(key) ?? 0;
      for (let i = 0; i < count; i++) {
        this.#inputManager._setKey(key, false);
      }
    }
    this.#pressedKeys.clear();
  }
}
