import { normaliseKey } from "./normaliseKey.js";

export class KeyboardSource {
  #inputManager;
  #target;
  #onBlur;
  #started = false;
  #heldKeys = new Set();

  // Bound handlers kept so stop() can remove them.
  #onKeyDown;
  #onKeyUp;
  #onTargetBlur;
  #onWindowBlur;

  constructor(inputManager, { target, onBlur } = {}) {
    this.#inputManager = inputManager;
    this.#target = target;
    this.#onBlur = onBlur ?? null;

    this.#onKeyDown = (event) => {
      if (event.repeat) return;
      const key = normaliseKey(event.key);
      if (this.#heldKeys.has(key)) return;
      this.#heldKeys.add(key);
      this.#inputManager._setKey(key, true);
    };
    this.#onKeyUp = (event) => {
      const key = normaliseKey(event.key);
      if (!this.#heldKeys.has(key)) return;
      this.#heldKeys.delete(key);
      this.#inputManager._setKey(key, false);
    };
    this.#onTargetBlur = () => {
      this.#releaseAll();
      this.#onBlur?.();
    };
    this.#onWindowBlur = () => {
      this.#releaseAll();
      this.#onBlur?.();
    };
  }

  #releaseAll() {
    for (const key of this.#heldKeys) {
      this.#inputManager._setKey(key, false);
    }
    this.#heldKeys.clear();
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#target.addEventListener("keydown", this.#onKeyDown);
    this.#target.addEventListener("keyup", this.#onKeyUp);
    this.#target.addEventListener("blur", this.#onTargetBlur);
    window.addEventListener("blur", this.#onWindowBlur);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    this.#target.removeEventListener("keydown", this.#onKeyDown);
    this.#target.removeEventListener("keyup", this.#onKeyUp);
    this.#target.removeEventListener("blur", this.#onTargetBlur);
    window.removeEventListener("blur", this.#onWindowBlur);
  }
}
