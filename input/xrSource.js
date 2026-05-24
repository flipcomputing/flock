const XR_BUTTON_KEYS = {
  left: {
    "x-button": ["e"],   // BUTTON1
    "y-button": ["r"],   // BUTTON2
  },
  right: {
    "a-button": [" "],   // BUTTON4
    "b-button": ["f"],   // BUTTON3
  },
};

const XR_AXES = {
  thumbstick: {
    axes: [
      { axisIndex: 0, name: "XR_MOVE_X", shimKeys: { neg: "a", pos: "d" } },
      { axisIndex: 1, name: "XR_MOVE_Y", shimKeys: { neg: "w", pos: "s" } },
    ],
  },
};

const SHIM_THRESHOLD = 0.5;
const DEAD_ZONE = 0.2;

export class XRSource {
  #inputManager;
  #xrHelper;
  #scene;
  #started = false;
  #controllerAddedObserver = null;
  #controllerRemovedObserver = null;
  #frameObserver = null;
  // inputSource → { mcObserver, mcObservable, btnObservers[], heldKeys, motionController, handedness }
  #controllerState = new Map();
  #thumbstickHeld = new Set();

  constructor(inputManager, { xrHelper, scene }) {
    this.#inputManager = inputManager;
    this.#xrHelper = xrHelper;
    this.#scene = scene ?? xrHelper.baseExperience?.scene;
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    this.#controllerAddedObserver =
      this.#xrHelper.input.onControllerAddedObservable.add((controller) =>
        this.#onControllerAdded(controller),
      );

    this.#controllerRemovedObserver =
      this.#xrHelper.input.onControllerRemovedObservable.add((controller) =>
        this.#onControllerRemoved(controller),
      );

    this.#frameObserver = this.#scene.onBeforeRenderObservable.add(() =>
      this.#pollThumbsticks(),
    );
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;

    this.#xrHelper.input.onControllerAddedObservable.remove(
      this.#controllerAddedObserver,
    );
    this.#controllerAddedObserver = null;

    this.#xrHelper.input.onControllerRemovedObservable.remove(
      this.#controllerRemovedObserver,
    );
    this.#controllerRemovedObserver = null;

    this.#scene.onBeforeRenderObservable.remove(this.#frameObserver);
    this.#frameObserver = null;

    for (const [, state] of this.#controllerState) {
      for (const { observable, observer } of state.btnObservers) {
        observable?.remove(observer);
      }
      if (state.mcObserver) {
        state.mcObservable?.remove(state.mcObserver);
      }
      this.#releaseControllerKeys(state);
    }
    this.#controllerState.clear();

    for (const key of this.#thumbstickHeld) {
      this.#inputManager._setKey(key, false);
    }
    this.#thumbstickHeld.clear();

    for (const { axes } of Object.values(XR_AXES)) {
      for (const { name } of axes) {
        this.#inputManager._setAxis(name, 0);
      }
    }
  }

  #releaseControllerKeys(state) {
    for (const key of state.heldKeys) {
      this.#inputManager._setKey(key, false);
    }
    state.heldKeys.clear();
  }

  #onControllerAdded(controller) {
    const handedness = controller.inputSource.handedness;
    const buttonMap = XR_BUTTON_KEYS[handedness];
    if (!buttonMap) return;

    const state = {
      mcObserver: null,
      mcObservable: controller.onMotionControllerInitObservable,
      btnObservers: [],
      heldKeys: new Set(),
      motionController: null,
      handedness,
    };
    this.#controllerState.set(controller.inputSource, state);

    state.mcObserver = controller.onMotionControllerInitObservable.addOnce(
      (motionController) => {
        state.motionController = motionController;
        state.mcObserver = null;

        for (const [componentId, keys] of Object.entries(buttonMap)) {
          const component = motionController.getComponent(componentId);
          if (!component) continue;

          let lastPressedState = false;
          const btnObserver = component.onButtonStateChangedObservable.add(
            () => {
              const isPressed = component.pressed;
              if (isPressed === lastPressedState) return;
              lastPressedState = isPressed;
              for (const key of keys) {
                this.#inputManager._setKey(key, isPressed);
                if (isPressed) {
                  state.heldKeys.add(key);
                } else {
                  state.heldKeys.delete(key);
                }
              }
            },
          );
          state.btnObservers.push({
            observable: component.onButtonStateChangedObservable,
            observer: btnObserver,
          });
        }
      },
    );
  }

  #onControllerRemoved(controller) {
    const state = this.#controllerState.get(controller.inputSource);
    if (!state) return;

    for (const { observable, observer } of state.btnObservers) {
      observable?.remove(observer);
    }
    if (state.mcObserver) {
      state.mcObservable?.remove(state.mcObserver);
    }
    this.#releaseControllerKeys(state);

    if (state.handedness === "right") {
      for (const key of this.#thumbstickHeld) {
        this.#inputManager._setKey(key, false);
      }
      this.#thumbstickHeld.clear();
      for (const { axes } of Object.values(XR_AXES)) {
        for (const { name } of axes) {
          this.#inputManager._setAxis(name, 0);
        }
      }
    }

    this.#controllerState.delete(controller.inputSource);
  }

  #pollThumbsticks() {
    let mc = null;
    for (const [, state] of this.#controllerState) {
      if (state.handedness === "right" && state.motionController) {
        mc = state.motionController;
        break;
      }
    }

    if (!mc) {
      for (const key of this.#thumbstickHeld) {
        this.#inputManager._setKey(key, false);
      }
      this.#thumbstickHeld.clear();
      for (const { axes } of Object.values(XR_AXES)) {
        for (const { name } of axes) {
          this.#inputManager._setAxis(name, 0);
        }
      }
      return;
    }

    const thumbstick = mc.getComponent("xr-standard-thumbstick");
    if (!thumbstick) return;

    const rawValues = [thumbstick.axes?.x ?? 0, thumbstick.axes?.y ?? 0];
    const wantedShims = new Set();

    for (const { axes } of Object.values(XR_AXES)) {
      for (const { axisIndex, name, shimKeys } of axes) {
        const raw = rawValues[axisIndex] ?? 0;
        this.#inputManager._setAxis(name, Math.abs(raw) > DEAD_ZONE ? raw : 0);
        if (shimKeys) {
          if (raw < -SHIM_THRESHOLD) wantedShims.add(shimKeys.neg);
          else if (raw > SHIM_THRESHOLD) wantedShims.add(shimKeys.pos);
        }
      }
    }

    for (const key of wantedShims) {
      if (!this.#thumbstickHeld.has(key)) {
        this.#inputManager._setKey(key, true);
      }
    }
    for (const key of this.#thumbstickHeld) {
      if (!wantedShims.has(key)) {
        this.#inputManager._setKey(key, false);
      }
    }
    this.#thumbstickHeld = new Set(wantedShims);
  }
}
