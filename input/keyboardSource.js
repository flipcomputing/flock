function normalise(key) {
  if (key === " " || key === "Spacebar") return " ";
  if (key.length === 1) return key.toLowerCase();
  return key;
}

export class KeyboardSource {
  #inputManager;
  #target;
  #onBlur;
  #started = false;

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
      this.#inputManager._setKey(normalise(event.key), true);
    };
    this.#onKeyUp = (event) => {
      this.#inputManager._setKey(normalise(event.key), false);
    };
    this.#onTargetBlur = () => {
      this.#inputManager._clearAllKeys();
      this.#onBlur?.();
    };
    this.#onWindowBlur = () => {
      this.#inputManager._clearAllKeys();
      this.#onBlur?.();
    };
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
    this.#started = false;
    this.#target.removeEventListener("keydown", this.#onKeyDown);
    this.#target.removeEventListener("keyup", this.#onKeyUp);
    this.#target.removeEventListener("blur", this.#onTargetBlur);
    window.removeEventListener("blur", this.#onWindowBlur);
  }
}
