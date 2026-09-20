import { getMicrobitManager } from '../microbit/manager.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockEvents = {
  /* 
		  Category: Events
  */

  onEvent(eventName, handler, once = false) {
    if (typeof handler !== 'function') {
      flock.reportBlockError({ key: 'invalid_callback', api: 'onEvent' });
      return;
    }
    eventName = flock.sanitizeEventName(eventName);
    if (!flock.isAllowedEventName(eventName)) {
      flock.reportBlockError({
        key: 'event_name_reserved',
        api: 'onEvent',
        values: { event: eventName },
      });
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

    const cleanup = () => flock.events[eventName]?.remove(observer);
    signal?.addEventListener('abort', cleanup, { once: true });
    flock.sectionSignal?.()?.addEventListener('abort', cleanup, { once: true });
  },
  broadcastEvent(eventName, data) {
    eventName = flock.sanitizeEventName(eventName);
    if (!flock.isAllowedEventName(eventName)) {
      flock.reportBlockError({
        key: 'event_name_reserved',
        api: 'broadcastEvent',
        values: { event: eventName },
      });
      return;
    }
    if (flock.events && flock.events[eventName]) {
      flock.events[eventName].notifyObservers(data);
    }
  },
  restartProject() {
    const signal = flock.abortController?.signal;
    setTimeout(() => {
      if (signal?.aborted) return;
      window.executeCode?.();
    }, 0);
  },
  whenActionEvent(action, callback, isReleased = false) {
    if (typeof callback !== 'function') {
      flock.reportBlockError({ key: 'invalid_callback', api: 'whenActionEvent' });
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    const handler = (a) => {
      if (a === action) callback();
    };

    const onStop = (cleanup) => {
      signal?.addEventListener('abort', cleanup, { once: true });
      flock.sectionSignal?.()?.addEventListener('abort', cleanup, { once: true });
    };

    if (isReleased) {
      const upObs = flock.inputManager.onActionUpObservable;
      const observer = upObs.add(handler);
      onStop(() => upObs.remove(observer));
    } else {
      // "pressed" fires on the down edge and again on each OS auto-repeat tick
      // while held, giving continuous behaviour for held keys.
      const downObs = flock.inputManager.onActionDownObservable;
      const repeatObs = flock.inputManager.onActionRepeatObservable;
      const downObserver = downObs.add(handler);
      const repeatObserver = repeatObs.add(handler);
      onStop(() => {
        downObs.remove(downObserver);
        repeatObs.remove(repeatObserver);
      });
    }
  },
  whenKeyEvent(key, callback, isReleased = false) {
    if (typeof callback !== 'function') {
      flock.reportBlockError({ key: 'invalid_callback', api: 'whenKeyEvent' });
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    const handler = (k) => {
      if (k === key) callback();
    };

    const onStop = (cleanup) => {
      signal?.addEventListener('abort', cleanup, { once: true });
      flock.sectionSignal?.()?.addEventListener('abort', cleanup, { once: true });
    };

    if (isReleased) {
      const upObs = flock.inputManager.onKeyUpObservable;
      const observer = upObs.add(handler);
      onStop(() => upObs.remove(observer));
    } else {
      // "pressed" fires on the down edge and again on each OS auto-repeat tick
      // while held, giving continuous behaviour for held keys.
      const downObs = flock.inputManager.onKeyDownObservable;
      const repeatObs = flock.inputManager.onKeyRepeatObservable;
      const downObserver = downObs.add(handler);
      const repeatObserver = repeatObs.add(handler);
      onStop(() => {
        downObs.remove(downObserver);
        repeatObs.remove(repeatObserver);
      });
    }
  },
  onMicrobitEvent(variableName, eventChar, callback) {
    if (typeof callback !== 'function') {
      flock.reportBlockError({ key: 'invalid_callback', api: 'onMicrobitEvent' });
      return;
    }
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;

    // All micro:bit events are momentary edges — no repeat semantics.
    // Registering against a variable with no bound board is valid and silent.
    const unsubscribe = getMicrobitManager().subscribe(variableName, (char) => {
      if (char === eventChar) callback();
    });
    signal?.addEventListener('abort', unsubscribe, { once: true });
    flock.sectionSignal?.()?.addEventListener('abort', unsubscribe, { once: true });
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
        console.log('Scene is disposed. Exiting action.');
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
        flock.reportBlockError({
          key: 'forever_block_failed',
          api: 'forever',
          error,
        });
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
    // Also stop when the owning section unloads, not just on scene disposal.
    flock.sectionSignal?.()?.addEventListener('abort', disposeHandler, { once: true });
  },
  isAllowedEventName(eventName) {
    if (!eventName || typeof eventName !== 'string') {
      return false;
    }

    if (eventName.length > 30) {
      return false;
    }

    const lower = eventName.toLowerCase();
    const reservedPrefixes = ['_', 'on', 'system', 'internal', 'babylon', 'flock'];
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
    if (typeof eventName !== 'string') {
      return '';
    }
    // Remove disallowed characters (symbols, control chars), allow emoji, spaces, letters, numbers
    // This allows everything except common punctuation and control characters
    const clean = eventName.replace(/[!@#$%^&*()+=[\]{};:'"\\|,<>?/\n\r\t]/g, '');
    return clean.substring(0, 50);
  },
};
