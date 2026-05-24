const BUTTON_KEYS = {
  0: [" "],   // A / Cross         -> BUTTON4
  1: ["e", "PageUp"],   // B / Circle        -> BUTTON1 + fly up
  2: ["f", "PageDown"], // X / Square        -> BUTTON3 + fly down
  3: ["r"],   // Y / Triangle      -> BUTTON2
  6: ["r"],   // Left trigger      -> BUTTON2
  7: ["r"],   // Right trigger     -> BUTTON2
  12: ["w"],  // D-pad up          -> FORWARD
  13: ["s"],  // D-pad down        -> BACKWARD
  14: ["a"],  // D-pad left        -> LEFT
  15: ["d"],  // D-pad right       -> RIGHT
};

const AXES = {
  0: { name: "MOVE_X", shimKeys: { neg: "a", pos: "d" } },
  1: { name: "MOVE_Y", shimKeys: { neg: "w", pos: "s" } },
  2: { name: "LOOK_X" },
  3: { name: "LOOK_Y" },
};

const SHOULDERS = { 4: -1, 5: +1 };
const TOUCHPAD_BUTTON = 17;
const DEAD_ZONE = 0.2;
const SHIM_THRESHOLD = 0.5;

export class GamepadSource {
  #inputManager;
  #scene;
  #canvas;
  #getGamepads;
  #started = false;
  #observer = null;
  #pointerMoveListener = null;
  #heldKeys = new Set();
  #lastTouchpadPressed = false;
  #lastPointerClientX = 0;
  #lastPointerClientY = 0;

  constructor(
    inputManager,
    { scene, canvas, getGamepads = () => navigator.getGamepads?.() ?? [] } = {},
  ) {
    this.#inputManager = inputManager;
    this.#scene = scene;
    this.#canvas = canvas;
    this.#getGamepads = getGamepads;
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    const rect = this.#canvas.getBoundingClientRect?.() ?? {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    };
    this.#lastPointerClientX = rect.left + rect.width / 2;
    this.#lastPointerClientY = rect.top + rect.height / 2;

    this.#pointerMoveListener = (e) => {
      this.#lastPointerClientX = e.clientX;
      this.#lastPointerClientY = e.clientY;
    };
    this.#canvas.addEventListener("pointermove", this.#pointerMoveListener);

    this.#observer = this.#scene.onBeforeRenderObservable.add(() =>
      this.#poll(),
    );
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    this.releaseAllKeys();
    for (const { name } of Object.values(AXES)) {
      this.#inputManager._setAxis(name, 0);
    }
    this.#inputManager._setAxis("TURN", 0);
    if (this.#observer) {
      this.#scene.onBeforeRenderObservable.remove(this.#observer);
      this.#observer = null;
    }
    if (this.#pointerMoveListener) {
      this.#canvas.removeEventListener("pointermove", this.#pointerMoveListener);
      this.#pointerMoveListener = null;
    }
  }

  releaseAllKeys() {
    for (const key of this.#heldKeys) {
      this.#inputManager._setKey(key, false);
    }
    this.#heldKeys.clear();
  }

  #poll() {
    const gamepad = this.#getGamepads().find((g) => g);

    if (!gamepad) {
      this.releaseAllKeys();
      for (const { name } of Object.values(AXES)) {
        this.#inputManager._setAxis(name, 0);
      }
      this.#inputManager._setAxis("TURN", 0);
      return;
    }

    // Build the set of keys the gamepad wants held this frame.
    const wantedKeys = new Set();

    for (const [index, keys] of Object.entries(BUTTON_KEYS)) {
      const button = gamepad.buttons?.[Number(index)];
      if (button?.pressed || button?.value > 0.5) {
        for (const k of keys) wantedKeys.add(k);
      }
    }

    for (const [axisIndex, axis] of Object.entries(AXES)) {
      if (!axis.shimKeys) continue;
      const value = gamepad.axes?.[Number(axisIndex)] ?? 0;
      if (value < -SHIM_THRESHOLD) wantedKeys.add(axis.shimKeys.neg);
      else if (value > SHIM_THRESHOLD) wantedKeys.add(axis.shimKeys.pos);
    }

    // Diff against currently held keys.
    for (const key of wantedKeys) {
      if (!this.#heldKeys.has(key)) {
        this.#inputManager._setKey(key, true);
      }
    }
    for (const key of this.#heldKeys) {
      if (!wantedKeys.has(key)) {
        this.#inputManager._setKey(key, false);
      }
    }
    this.#heldKeys = new Set(wantedKeys);

    // Axes with dead zone.
    for (const [axisIndex, axis] of Object.entries(AXES)) {
      const raw = gamepad.axes?.[Number(axisIndex)] ?? 0;
      this.#inputManager._setAxis(axis.name, Math.abs(raw) > DEAD_ZONE ? raw : 0);
    }

    // Shoulder buttons contribute to a virtual TURN axis.
    let turn = 0;
    for (const [index, delta] of Object.entries(SHOULDERS)) {
      const button = gamepad.buttons?.[Number(index)];
      if (button?.pressed || button?.value > 0.5) turn += delta;
    }
    this.#inputManager._setAxis("TURN", turn);

    // Touchpad (button 17 on PS4/PS5) → synthetic pointer events.
    const touchpadButton = gamepad.buttons?.[TOUCHPAD_BUTTON];
    const touchpadPressed = Boolean(
      touchpadButton?.pressed || touchpadButton?.value > 0.5,
    );
    if (touchpadPressed && !this.#lastTouchpadPressed) {
      this.#fireTouchpadEvent("pointerdown");
    } else if (!touchpadPressed && this.#lastTouchpadPressed) {
      this.#fireTouchpadEvent("pointerup");
    }
    this.#lastTouchpadPressed = touchpadPressed;
  }

  #fireTouchpadEvent(type) {
    this.#canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: this.#lastPointerClientX,
        clientY: this.#lastPointerClientY,
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
      }),
    );
  }
}
