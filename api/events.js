let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockEvents = {
  /* 
		  Category: Events
  */

  onEvent(eventName, handler, once = false) {
    eventName = flock.sanitizeEventName(eventName);
    if (!flock.isAllowedEventName(eventName)) {
      console.warn(
        `Event name ${eventName} is reserved and cannot be broadcasted.`,
      );
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    if (!flock.events[eventName]) {
      flock.events[eventName] = new flock.BABYLON.Observable();
    }
    let observer;
    if (once) {
      const wrappedHandler = (data) => {
        handler(data);
        flock.events[eventName].remove(observer);
      };
      observer = flock.events[eventName].add(wrappedHandler);
    } else {
      observer = flock.events[eventName].add(handler);
    }

    signal?.addEventListener(
      "abort",
      () => {
        flock.events[eventName]?.remove(observer);
      },
      { once: true },
    );
  },
  broadcastEvent(eventName, data) {
    eventName = flock.sanitizeEventName(eventName);
    if (!flock.isAllowedEventName(eventName)) {
      console.warn(
        `Event name ${eventName} is reserved and cannot be broadcasted.`,
      );
      return;
    }
    if (flock.events && flock.events[eventName]) {
      flock.events[eventName].notifyObservers(data);
    }
  },
  whenActionEvent(action, callback, isReleased = false) {
    const actionMap = {
      FORWARD: ["w", "z"],
      BACKWARD: ["s"],
      LEFT: ["a", "q"],
      RIGHT: ["d"],
      BUTTON1: ["e", "1"],
      BUTTON2: ["r", "2"],
      BUTTON3: ["f", "3"],
      BUTTON4: [" ", "4"],
    };

    const actionKeys = actionMap[action];

    if (!actionKeys?.length) {
      return;
    }

    [...new Set(actionKeys.map((key) => key.toLowerCase()))].forEach((key) => {
      this.whenKeyEvent(key, callback, isReleased);
    });

    const getGamepadActiveState = () => {
      if (!navigator.getGamepads) {
        return false;
      }

      const gamepads = navigator.getGamepads() || [];

      return Array.from(gamepads).some((gamepad) => {
        if (!gamepad) {
          return false;
        }

        const { axes = [], buttons = [] } = gamepad;

        switch (action) {
          case "FORWARD":
            return axes[1] < -0.5 || buttons[12]?.pressed;
          case "BACKWARD":
            return axes[1] > 0.5 || buttons[13]?.pressed;
          case "LEFT":
            return axes[0] < -0.5 || buttons[14]?.pressed;
          case "RIGHT":
            return axes[0] > 0.5 || buttons[15]?.pressed;
          case "BUTTON1":
            return buttons[1]?.pressed;
          case "BUTTON2":
            return (
              buttons[3]?.pressed || buttons[6]?.pressed || buttons[7]?.pressed
            );
          case "BUTTON3":
            return buttons[2]?.pressed;
          case "BUTTON4":
            return buttons[0]?.pressed;
          default:
            return false;
        }
      });
    };

    let lastGamepadState = getGamepadActiveState();
    let rafId;
    const abortSignal = flock.abortController?.signal;

    const monitorGamepad = () => {
      if (abortSignal?.aborted) {
        return;
      }

      const isActive = getGamepadActiveState();

      const shouldTrigger = isReleased
        ? !isActive && lastGamepadState
        : isActive && !lastGamepadState;

      if (shouldTrigger) {
        callback();
      }

      lastGamepadState = isActive;
      if (!abortSignal?.aborted) {
        rafId = requestAnimationFrame(monitorGamepad);
      }
    };

    if (abortSignal?.aborted) {
      return;
    }
    rafId = requestAnimationFrame(monitorGamepad);

    abortSignal?.addEventListener(
      "abort",
      () => {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
        }
      },
      { once: true },
    );
  },
  whenKeyEvent(key, callback, isReleased = false) {
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    // Handle keyboard input
    const eventType = isReleased
      ? flock.BABYLON.KeyboardEventTypes.KEYUP
      : flock.BABYLON.KeyboardEventTypes.KEYDOWN;

    const kbHandler = (kbInfo) => {
      if (kbInfo.type === eventType && kbInfo.event.key.toLowerCase() === key) {
        callback();
      }
    };
    const kbObserver = flock.scene.onKeyboardObservable.add(kbHandler);

    // Register the callback for the grid input observable
    const gridObservable = isReleased
      ? flock.gridKeyReleaseObservable
      : flock.gridKeyPressObservable;

    const gridHandler = (inputKey) => {
      if (inputKey === key) {
        callback();
      }
    };
    const gridObserver = gridObservable.add(gridHandler);

    // XR controller support
    let xrObserver = null;
    const buttonStateObservers = [];
    if (flock.xrHelper?.input) {
      const xrHandler = (controller) => {
        const handedness = controller.inputSource.handedness;

        const buttonMap =
          handedness === "left"
            ? { "y-button": "q", "x-button": "e" }
            : handedness === "right"
              ? { "b-button": "f", "a-button": " " }
              : {};

        controller.onMotionControllerInitObservable.addOnce(
          (motionController) => {
            Object.entries(buttonMap).forEach(([buttonId, mappedKey]) => {
              if (mappedKey !== key) return;
              const component = motionController.getComponent(buttonId);
              if (!component) return;

              let lastPressedState = false;
              const btnObserver = component.onButtonStateChangedObservable.add(
                () => {
                  const isPressed = component.pressed;
                  if (motionController.getComponent(buttonId) !== component)
                    return;
                  if (isPressed === lastPressedState) return;
                  const shouldFire = isReleased
                    ? !isPressed && lastPressedState
                    : isPressed && !lastPressedState;
                  if (shouldFire) {
                    callback(mappedKey, isReleased ? "released" : "pressed");
                  }
                  lastPressedState = isPressed;
                },
              );
              buttonStateObservers.push({
                observable: component.onButtonStateChangedObservable,
                observer: btnObserver,
              });
            });
          },
        );
      };
      xrObserver =
        flock.xrHelper.input.onControllerAddedObservable.add(xrHandler);
    }

    // Clean up all observers when this run is aborted
    signal?.addEventListener(
      "abort",
      () => {
        flock.scene?.onKeyboardObservable?.remove(kbObserver);
        gridObservable?.remove(gridObserver);
        if (xrObserver) {
          flock.xrHelper?.input?.onControllerAddedObservable?.remove(
            xrObserver,
          );
        }
        for (const { observable, observer } of buttonStateObservers) {
          observable?.remove(observer);
        }
      },
      { once: true },
    );
  },
  start(action) {
    flock.scene.onBeforeRenderObservable.addOnce(action);
  },
  async forever(action) {
    let isDisposed = false;
    let isActionRunning = false;

    // Function to run the action
    const runAction = async () => {
      if (isDisposed) {
        console.log("Scene is disposed. Exiting action.");
        return; // Exit if the scene is disposed
      }

      if (isActionRunning) {
        return; // Exit if the action is already running
      }

      isActionRunning = true;

      try {
        if (isDisposed) {
          return;
        }
        await action();
      } catch (error) {
        console.log("Error while running action:", error);
      } finally {
        isActionRunning = false;
        if (!isDisposed) {
          flock.scene.onBeforeRenderObservable.addOnce(runAction);
        }
      }
    };

    flock.scene.onBeforeRenderObservable.addOnce(runAction);
    // Handle scene disposal
    const disposeHandler = () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      flock.scene.onBeforeRenderObservable.removeCallback(runAction);
    };
    flock.scene.onDisposeObservable.addOnce(disposeHandler);
  },
  isAllowedEventName(eventName) {
    if (!eventName || typeof eventName !== "string") {
      return false;
    }

    if (eventName.length > 30) {
      return false;
    }

    const lower = eventName.toLowerCase();
    const reservedPrefixes = [
      "_",
      "on",
      "system",
      "internal",
      "babylon",
      "flock",
    ];
    if (reservedPrefixes.some((prefix) => lower.startsWith(prefix))) {
      return false;
    }

    const disallowedChars = /[!@#$%^&*()+=[\]{};:'"\\|,<>?/\n\r\t]/;
    if (disallowedChars.test(eventName)) {
      return false;
    }

    return true;
  },
  sanitizeEventName(eventName) {
    if (typeof eventName !== "string") {
      return "";
    }
    // Remove disallowed characters (symbols, control chars), allow emoji, spaces, letters, numbers
    // This allows everything except common punctuation and control characters
    const clean = eventName.replace(
      /[!@#$%^&*()+=[\]{};:'"\\|,<>?/\n\r\t]/g,
      "",
    );
    return clean.substring(0, 50);
  },
};
