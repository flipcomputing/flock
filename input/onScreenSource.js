import { normaliseKey } from './normaliseKey.js';

const KEY_CODE_MAP = {
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  PageUp: { code: 'PageUp', keyCode: 33 },
  PageDown: { code: 'PageDown', keyCode: 34 },
  ' ': { code: 'Space', keyCode: 32 },
  a: { code: 'KeyA', keyCode: 65 },
  d: { code: 'KeyD', keyCode: 68 },
  e: { code: 'KeyE', keyCode: 69 },
  f: { code: 'KeyF', keyCode: 70 },
  q: { code: 'KeyQ', keyCode: 81 },
  r: { code: 'KeyR', keyCode: 82 },
  s: { code: 'KeyS', keyCode: 83 },
  w: { code: 'KeyW', keyCode: 87 },
  z: { code: 'KeyZ', keyCode: 90 },
};

function codeFor(key) {
  return KEY_CODE_MAP[key]?.code ?? key;
}

function keyCodeFor(key) {
  return KEY_CODE_MAP[key]?.keyCode ?? 0;
}

export class OnScreenSource {
  #inputManager;
  #pressedKeys = new Map(); // normalized key -> press count
  #target;
  #pausedBy = new Set();
  #scene = null;
  #repeatObserver = null;

  get #paused() {
    return this.#pausedBy.size > 0;
  }

  constructor(inputManager, { target, scene } = {}) {
    this.#inputManager = inputManager;
    this.#target = target ?? (typeof document !== 'undefined' ? document : null);
    this.#scene = scene;
  }

  start(scene = null) {
    // Emit repeat ticks for all held keys every render frame
    if (this.#repeatObserver) return;
    this.#scene = scene ?? this.#scene;
    if (!this.#scene) return;
    this.#repeatObserver = this.#scene.onBeforeRenderObservable.add(() => {
      if (!this.#paused) {
        for (const key of this.#pressedKeys.keys()) {
          this.#inputManager._repeatKey(key);
        }
      }
    });
  }

  stop() {
    if (this.#repeatObserver && this.#scene) {
      this.#scene.onBeforeRenderObservable.remove(this.#repeatObserver);
    }
    this.#repeatObserver = null;
  }

  // Suspend InputManager updates while still dispatching DOM events. Owners
  // (fly camera, mobile gizmo HUD) pause independently, so input only resumes
  // once every owner has released.
  pause(owner = 'default') {
    const wasPaused = this.#paused;
    this.#pausedBy.add(owner);
    if (wasPaused) return;
    for (const [key, count] of this.#pressedKeys) {
      for (let i = 0; i < count; i++) this.#inputManager._setKey(key, false);
    }
  }

  // Releases any keys held during the paused period.
  resume(owner = 'default') {
    if (!this.#pausedBy.delete(owner)) return;
    if (this.#paused) return;
    this.releaseAll();
  }

  #dispatchKey(type, normalizedKey) {
    const target = this.#target;
    if (!target) return;
    const event = new KeyboardEvent(type, {
      key: normalizedKey,
      code: codeFor(normalizedKey),
      keyCode: keyCodeFor(normalizedKey),
      which: keyCodeFor(normalizedKey),
      bubbles: true,
      cancelable: true,
    });
    event.__flockSynthetic = true;
    target.dispatchEvent(event);
  }

  press(key) {
    const normalized = normaliseKey(key);
    const count = this.#pressedKeys.get(normalized) ?? 0;
    this.#pressedKeys.set(normalized, count + 1);
    if (!this.#paused) this.#inputManager._setKey(normalized, true);
    if (count === 0) {
      this.#dispatchKey('keydown', normalized);
    }
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
      if (!this.#paused) this.#inputManager._setKey(normalized, false);
      if (next === 0) {
        this.#dispatchKey('keyup', normalized);
      }
    }
  }

  releaseAll() {
    const keys = [...this.#pressedKeys.keys()];
    for (const key of keys) {
      const count = this.#pressedKeys.get(key) ?? 0;
      for (let i = 0; i < count; i++) {
        this.#inputManager._setKey(key, false);
      }
      this.#dispatchKey('keyup', key);
    }
    this.#pressedKeys.clear();
  }
}
