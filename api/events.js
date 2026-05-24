
let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockEvents = {
  /* 
		  Category: Events
  */

  onEvent(eventName, handler, once = false) {
    if (typeof handler !== "function") {
      console.warn("onEvent: handler must be a function");
      return;
    }
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
    if (typeof callback !== "function") {
      console.warn("whenActionEvent: callback must be a function");
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    const targetObs = isReleased
      ? flock.inputManager.onActionUpObservable
      : flock.inputManager.onActionDownObservable;

    const handler = (a) => {
      if (a === action) callback();
    };
    targetObs.add(handler);

    signal?.addEventListener(
      "abort",
      () => {
        targetObs.remove(handler);
      },
      { once: true },
    );
  },
  whenKeyEvent(key, callback, isReleased = false) {
    if (typeof callback !== "function") {
      console.warn("whenKeyEvent: callback must be a function");
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    const targetObs = isReleased
      ? flock.inputManager.onKeyUpObservable
      : flock.inputManager.onKeyDownObservable;
    const handler = (k) => { if (k === key) callback(); };
    targetObs.add(handler);

    signal?.addEventListener(
      "abort",
      () => targetObs.remove(handler),
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
