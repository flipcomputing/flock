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
      // Don't feed scene/input events to the running project while the user is
      // interacting with an open modal dialog (e.g. navigating the demo picker
      // with arrow keys) — the focused control, not the scene, owns the key.
      if (event.target?.closest?.(".modal:not(.hidden)")) return;
      this.#inputManager._notifyRawKeyDown(event);
    };

    this.#onKeyDown = (event) => {
      if (event.__flockSynthetic) return;
      // Shortcut chords (Ctrl+Z undo, ⌘S…) belong to the app/browser, not
      // gameplay — without this, undo on a focused canvas walks the player
      // ("z" is bound to FORWARD for AZERTY keyboards).
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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
      // macOS browsers suppress keyup for keys released while ⌘ is held, so
      // anything still tracked when ⌘ comes up would be stuck down forever.
      if (event.key === "Meta") {
        this.#releaseAll();
        return;
      }
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

  // In fly mode held keys were never reported to InputManager, so releasing
  // them there would corrupt refcounts owned by other sources (e.g. gamepad).
  #releaseAll({ notifyInputManager = !this.#flyMode } = {}) {
    if (notifyInputManager) {
      for (const key of this.#heldKeys) {
        this.#inputManager._setKey(key, false);
      }
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
      // Release keys that were held before entering fly mode — those were
      // reported to InputManager while fly mode was still off.
      this.#releaseAll({ notifyInputManager: true });
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
