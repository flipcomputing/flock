const XR_BUTTON_KEYS = {
  left: {
    'x-button': ['f'], // BUTTON3
    'y-button': ['r'], // BUTTON1
  },
  right: {
    'a-button': [' '], // BUTTON4
    'b-button': ['e'], // BUTTON2
  },
};

const XR_AXES = {
  thumbstick: {
    axes: [
      { axisIndex: 0, name: 'XR_MOVE_X', shimActions: { neg: 'LEFT', pos: 'RIGHT' } },
      { axisIndex: 1, name: 'XR_MOVE_Y', shimActions: { neg: 'FORWARD', pos: 'BACKWARD' } },
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
  #allHeldKeys = new Set(); // Union of all held keys across buttons and thumbsticks
  #movementEnabled = true;
  #shimEnabled = true;
  #flyMode = false;

  constructor(inputManager, { xrHelper, scene }) {
    this.#inputManager = inputManager;
    this.#xrHelper = xrHelper;
    this.#scene = scene ?? xrHelper.baseExperience?.scene;
  }

  start() {
    if (this.#started) return;
    this.#started = true;

    this.#controllerAddedObserver = this.#xrHelper.input.onControllerAddedObservable.add(
      (controller) => this.#onControllerAdded(controller)
    );

    this.#controllerRemovedObserver = this.#xrHelper.input.onControllerRemovedObservable.add(
      (controller) => this.#onControllerRemoved(controller)
    );

    this.#frameObserver = this.#scene.onBeforeRenderObservable.add(() => {
      this.#pollTurnStick();
      this.#pollThumbsticks();
      // Emit repeat ticks for all held keys (buttons and thumbstick shims)
      for (const key of this.#allHeldKeys) {
        this.#inputManager._repeatKey(key);
      }
    });
  }

  setInputMode(mode) {
    const movementEnabled = mode === 'project' || mode === 'smooth' || mode === 'fly';
    const shimEnabled = mode === 'project';
    const flyMode = mode === 'fly';
    if (
      this.#movementEnabled === movementEnabled &&
      this.#shimEnabled === shimEnabled &&
      this.#flyMode === flyMode
    ) {
      return;
    }
    if (flyMode !== this.#flyMode) {
      for (const [, state] of this.#controllerState) {
        for (const key of state.heldKeys) this.#allHeldKeys.delete(key);
        this.#releaseControllerKeys(state);
      }
    }
    this.#movementEnabled = movementEnabled;
    this.#shimEnabled = shimEnabled;
    this.#flyMode = flyMode;
    if (!movementEnabled) this.#clearThumbstickMovement();
    else if (!shimEnabled) this.#clearThumbstickShims();
    if (!flyMode) this.#inputManager._setAxis('XR_MOVE_VERTICAL', 0);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;

    this.#xrHelper.input.onControllerAddedObservable.remove(this.#controllerAddedObserver);
    this.#controllerAddedObserver = null;

    this.#xrHelper.input.onControllerRemovedObservable.remove(this.#controllerRemovedObserver);
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

    this.#clearThumbstickMovement();
    this.#inputManager._setAxis('XR_TURN_X', 0);
    this.#allHeldKeys.clear();
  }

  #clearThumbstickMovement() {
    this.#clearThumbstickShims();
    for (const { axes } of Object.values(XR_AXES)) {
      for (const { name } of axes) this.#inputManager._setAxis(name, 0);
    }
    this.#inputManager._setAxis('XR_MOVE_VERTICAL', 0);
  }

  #motionController(handedness) {
    for (const [, state] of this.#controllerState) {
      if (state.handedness === handedness && state.motionController) return state.motionController;
    }
    return null;
  }

  // Turning stays live in every input mode: the view owns it, not the project.
  #pollTurnStick() {
    const thumbstick = this.#motionController('right')?.getComponent('xr-standard-thumbstick');
    const raw = thumbstick?.axes?.x ?? 0;
    this.#inputManager._setAxis('XR_TURN_X', Math.abs(raw) > DEAD_ZONE ? raw : 0);
  }

  #clearThumbstickShims() {
    for (const key of this.#thumbstickHeld) {
      this.#inputManager._setKey(key, false);
      this.#allHeldKeys.delete(key);
    }
    this.#thumbstickHeld.clear();
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

    state.mcObserver = controller.onMotionControllerInitObservable.addOnce((motionController) => {
      state.motionController = motionController;
      state.mcObserver = null;

      for (const [componentId, keys] of Object.entries(buttonMap)) {
        const component = motionController.getComponent(componentId);
        if (!component) continue;

        let lastPressedState = false;
        const btnObserver = component.onButtonStateChangedObservable.add(() => {
          if (
            this.#flyMode &&
            handedness === 'left' &&
            (componentId === 'x-button' || componentId === 'y-button')
          ) {
            lastPressedState = component.pressed;
            return;
          }
          const isPressed = component.pressed;
          if (isPressed === lastPressedState) return;
          lastPressedState = isPressed;
          for (const key of keys) {
            this.#inputManager._setKey(key, isPressed);
            if (isPressed) {
              state.heldKeys.add(key);
              this.#allHeldKeys.add(key);
            } else {
              state.heldKeys.delete(key);
              this.#allHeldKeys.delete(key);
            }
          }
        });
        state.btnObservers.push({
          observable: component.onButtonStateChangedObservable,
          observer: btnObserver,
        });
      }
    });
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
    for (const key of state.heldKeys) {
      this.#allHeldKeys.delete(key);
    }
    this.#releaseControllerKeys(state);

    if (state.handedness === 'left') {
      for (const key of this.#thumbstickHeld) {
        this.#inputManager._setKey(key, false);
        this.#allHeldKeys.delete(key);
      }
      this.#thumbstickHeld.clear();
      for (const { axes } of Object.values(XR_AXES)) {
        for (const { name } of axes) {
          this.#inputManager._setAxis(name, 0);
        }
      }
    } else if (state.handedness === 'right') {
      this.#inputManager._setAxis('XR_TURN_X', 0);
    }

    this.#controllerState.delete(controller.inputSource);
  }

  #pollThumbsticks() {
    if (!this.#movementEnabled) {
      this.#clearThumbstickMovement();
      return;
    }
    const mc = this.#motionController('left');
    if (!mc) {
      this.#clearThumbstickMovement();
      return;
    }

    if (this.#flyMode) {
      const up = mc.getComponent('y-button')?.pressed ? 1 : 0;
      const down = mc.getComponent('x-button')?.pressed ? 1 : 0;
      this.#inputManager._setAxis('XR_MOVE_VERTICAL', up - down);
    } else {
      this.#inputManager._setAxis('XR_MOVE_VERTICAL', 0);
    }

    const thumbstick = mc.getComponent('xr-standard-thumbstick');
    if (!thumbstick) return;

    const rawValues = [thumbstick.axes?.x ?? 0, thumbstick.axes?.y ?? 0];
    const wantedShims = new Set();

    for (const { axes } of Object.values(XR_AXES)) {
      for (const { axisIndex, name, shimActions } of axes) {
        const raw = rawValues[axisIndex] ?? 0;
        this.#inputManager._setAxis(name, Math.abs(raw) > DEAD_ZONE ? raw : 0);
        if (shimActions && this.#shimEnabled) {
          const action =
            raw < -SHIM_THRESHOLD ? shimActions.neg : raw > SHIM_THRESHOLD ? shimActions.pos : null;
          if (action) {
            for (const key of this.#inputManager._getActionKeys(action)) wantedShims.add(key);
          }
        }
      }
    }

    for (const key of wantedShims) {
      if (!this.#thumbstickHeld.has(key)) {
        this.#inputManager._setKey(key, true);
        this.#allHeldKeys.add(key);
      }
    }
    for (const key of this.#thumbstickHeld) {
      if (!wantedShims.has(key)) {
        this.#inputManager._setKey(key, false);
        this.#allHeldKeys.delete(key);
      }
    }
    this.#thumbstickHeld = new Set(wantedShims);
  }
}
