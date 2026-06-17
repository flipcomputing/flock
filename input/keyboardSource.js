import { normaliseKey } from "./normaliseKey.js";

export class KeyboardSource {
  #inputManager;
  #target;
  #onBlur;
  #started = false;
  #heldKeys = new Set();
  #flyMode = false;

  // Bound handlers kept so stop() can remove them.
  #onKeyDown;
  #onKeyUp;
  #onTargetBlur;
  #onWindowBlur;
  #onDocKeyDown;

  constructor(inputManager, { target, onBlur } = {}) {
    this.#inputManager = inputManager;
    this.#target = target;
    this.#onBlur = onBlur ?? null;

    this.#onDocKeyDown = (event) => {
      if (event.__flockSynthetic) return;
      this.#inputManager._notifyRawKeyDown(event);
    };

    this.#onKeyDown = (event) => {
      if (event.__flockSynthetic) return;
      const key = normaliseKey(event.key);
      if (event.repeat) {
        // OS auto-repeat while held: drive "while held" event blocks via the
        // repeat signal, but leave refcount/movement (the down edge) alone.
        if (!this.#flyMode && this.#heldKeys.has(key)) {
          this.#inputManager._repeatKey(key);
        }
        return;
      }
      if (this.#heldKeys.has(key)) return;
      this.#heldKeys.add(key);
      if (!this.#flyMode) this.#inputManager._setKey(key, true);
    };
    this.#onKeyUp = (event) => {
      if (event.__flockSynthetic) return;
      const key = normaliseKey(event.key);
      if (!this.#heldKeys.has(key)) return;
      this.#heldKeys.delete(key);
      if (!this.#flyMode) this.#inputManager._setKey(key, false);
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

  // Physical key state — always reflects the real keyboard, regardless of fly mode.
  // Use this for internal engine reads (e.g. camera movement) so fly mode
  // blocking of InputManager doesn't prevent the camera from moving.
  isKeyDown(key) {
    return this.#heldKeys.has(normaliseKey(key));
  }

  setFlyMode(enabled) {
    if (!!enabled === this.#flyMode) return;
    this.#flyMode = !!enabled;
    if (this.#flyMode) {
      // Release keys that were held before entering fly mode.
      this.#releaseAll();
    } else {
      // Discard any keys tracked during fly mode — InputManager was never told
      // about them, so no corresponding release is needed.
      this.#heldKeys.clear();
    }
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    document.addEventListener("keydown", this.#onDocKeyDown, true);
    this.#target.addEventListener("keydown", this.#onKeyDown);
    this.#target.addEventListener("keyup", this.#onKeyUp);
    this.#target.addEventListener("blur", this.#onTargetBlur);
    window.addEventListener("blur", this.#onWindowBlur);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    document.removeEventListener("keydown", this.#onDocKeyDown, true);
    this.#target.removeEventListener("keydown", this.#onKeyDown);
    this.#target.removeEventListener("keyup", this.#onKeyUp);
    this.#target.removeEventListener("blur", this.#onTargetBlur);
    window.removeEventListener("blur", this.#onWindowBlur);
  }
}
