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
    if (!flock.events[eventName]) {
      flock.events[eventName] = new flock.BABYLON.Observable();
    }
    if (once) {
      const wrappedHandler = (data) => {
        handler(data);
        flock.events[eventName].remove(wrappedHandler);
      };
      flock.events[eventName].add(wrappedHandler);
    } else {
      flock.events[eventName].add(handler);
    }
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

    const monitorGamepad = () => {
      const isActive = getGamepadActiveState();

      const shouldTrigger = isReleased
        ? !isActive && lastGamepadState
        : isActive && !lastGamepadState;

      if (shouldTrigger) {
        callback();
      }

      lastGamepadState = isActive;
      requestAnimationFrame(monitorGamepad);
    };

    requestAnimationFrame(monitorGamepad);
  },
  whenKeyEvent(key, callback, isReleased = false) {
    // Handle keyboard input
    const eventType = isReleased
      ? flock.BABYLON.KeyboardEventTypes.KEYUP
      : flock.BABYLON.KeyboardEventTypes.KEYDOWN;

    flock.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === eventType && kbInfo.event.key.toLowerCase() === key) {
        callback();
      }
    });

    // Register the callback for the grid input observable
    const gridObservable = isReleased
      ? flock.gridKeyReleaseObservable
      : flock.gridKeyPressObservable;

    gridObservable.add((inputKey) => {
      if (inputKey === key) {
        callback();
      }
    });

    flock.xrHelper?.input.onControllerAddedObservable.add((controller) => {
      console.log(
        `DEBUG: Controller added: ${controller.inputSource.handedness}`,
      );

      const handedness = controller.inputSource.handedness;

      // Map button IDs to the corresponding keyboard keys
      const buttonMap =
        handedness === "left"
          ? {
              "y-button": "q",
              "x-button": "e",
            } // Left controller: Y -> Q, X -> E
          : handedness === "right"
            ? {
                "b-button": "f",
                "a-button": " ",
              } // Right controller: B -> F, A -> Space
            : {}; // Unknown handedness: No mapping

      controller.onMotionControllerInitObservable.add((motionController) => {
        Object.entries(buttonMap).forEach(([buttonId, mappedKey]) => {
          // Trigger the callback only for the specific key
          if (mappedKey !== key) {
            return;
          }
          const component = motionController.getComponent(buttonId);

          if (!component) {
            console.warn(
              `DEBUG: Button ID '${buttonId}' not found for ${handedness} controller.`,
            );
            return;
          }

          console.log(
            `DEBUG: Observing button ID '${buttonId}' for key '${mappedKey}' on ${handedness} controller.`,
          );

          // Track the last known pressed state for this specific button
          let lastPressedState = false;

          // Monitor state changes for this specific button
          component.onButtonStateChangedObservable.add(() => {
            const isPressed = component.pressed;

            // Debugging to verify button states
            console.log(
              `DEBUG: Observable fired for '${buttonId}', pressed: ${isPressed}`,
            );

            // Ensure this logic only processes events for the current button
            if (motionController.getComponent(buttonId) !== component) {
              console.log(
                `DEBUG: Skipping event for '${buttonId}' as it doesn't match the triggering component.`,
              );
              return;
            }

            // Ignore repeated callbacks for the same state
            if (isPressed === lastPressedState) {
              console.log(
                `DEBUG: No state change for '${buttonId}', skipping callback.`,
              );
              return;
            }

            // Only handle "released" transitions
            if (!isPressed && lastPressedState) {
              console.log(
                `DEBUG: Key '${mappedKey}' (button ID '${buttonId}') released on ${handedness} controller.`,
              );
              callback(mappedKey, "released");
            }

            // Update last pressed state
            lastPressedState = isPressed;
          });
        });
      });
    });
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
        console.log("Dispose handler already triggered.");
        return;
      }

      isDisposed = true;
      flock.scene.onBeforeRenderObservable.clear(); // Clear the observable
    };
    flock.scene.onDisposeObservable.add(disposeHandler);
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
