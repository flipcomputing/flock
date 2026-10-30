import { getMicrobitManager } from '../microbit/manager.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

// Events live in their own Map, so any name works. Only strings and numbers count: converting
// anything else could call user code (a custom toString). Null means no usable name.
function eventKey(eventName) {
  if (typeof eventName === 'number') return String(eventName);
  return typeof eventName === 'string' ? eventName.trim() : null;
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
    const key = eventKey(eventName);
    if (key === null) return;
    const signal = flock.abortController?.signal;
    if (signal?.aborted) return;
    handler = flock._bindToSection(handler);

    let observable = flock.events.get(key);
    if (!observable) {
      observable = new flock.BABYLON.Observable();
      flock.events.set(key, observable);
    }
    let observer;
    if (once) {
      const wrappedHandler = (data) => {
        handler(data);
        observable.remove(observer);
      };
      observer = observable.add(wrappedHandler);
    } else {
      observer = observable.add((data) => handler(data));
    }

    const cleanup = () => observable.remove(observer);
    signal?.addEventListener('abort', cleanup, { once: true });
    flock.sectionSignal?.()?.addEventListener('abort', cleanup, { once: true });
  },
  broadcastEvent(eventName, data) {
    const key = eventKey(eventName);
    if (key !== null) flock.events?.get(key)?.notifyObservers(data);
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
    callback = flock._bindToSection(callback);

    const handler = (a) => {
      if (a === action && !flock.isPaused()) callback();
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
    callback = flock._bindToSection(callback);

    const handler = (k) => {
      if (k === key && !flock.isPaused()) callback();
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
    callback = flock._bindToSection(callback);

    // All micro:bit events are momentary edges — no repeat semantics.
    // Registering against a variable with no bound board is valid and silent.
    const unsubscribe = getMicrobitManager().subscribe(variableName, (char) => {
      if (char === eventChar && !flock.isPaused()) callback();
    });
    signal?.addEventListener('abort', unsubscribe, { once: true });
    flock.sectionSignal?.()?.addEventListener('abort', unsubscribe, { once: true });
  },
  start(action) {
    flock.scene.onBeforeRenderObservable.addOnce(() => flock.whenRunning(action));
  },
  async forever(action) {
    action = flock._bindToSection(action);
    let isDisposed = false;
    let pace = null;

    const runLoop = async () => {
      while (!isDisposed) {
        await new Promise((resolve) => pace(resolve));
        if (isDisposed) return;
        try {
          await action();
        } catch (error) {
          flock.reportBlockError({
            key: 'forever_block_failed',
            api: 'forever',
            error,
          });
        }
      }
    };

    const begin = () =>
      flock.whenRunning(() => {
        if (isDisposed) return;
        pace = flock.makeLoopPacer();
        runLoop();
      });
    flock.scene.onBeforeRenderObservable.addOnce(begin);
    // Handle scene disposal
    const disposeHandler = () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      flock.scene.onBeforeRenderObservable.removeCallback(begin);
      pace?.stop();
    };
    flock.scene.onDisposeObservable.addOnce(disposeHandler);
    // Also stop when the owning section unloads, not just on scene disposal.
    flock.sectionSignal?.()?.addEventListener('abort', disposeHandler, { once: true });
  },
};
