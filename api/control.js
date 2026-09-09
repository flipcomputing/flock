let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockControl = {
  /* 
		  Category: Control
  */

  wait(duration) {
    const ms =
      Number.isFinite(Number(duration)) && Number(duration) >= 0
        ? Math.min(Number(duration) * 1000, 2147483647)
        : 0;
    const signal = flock.abortController?.signal;
    const doc = typeof document !== 'undefined' ? document : null;
    return new Promise((resolve, reject) => {
      // Reject (not resolve) on abort so cooperative loops stop on Stop.
      if (signal?.aborted) {
        reject(flock.makeAbortError());
        return;
      }

      let remaining = ms;
      let startedAt = 0;
      let running = false;
      let timeoutId = null;

      const cleanup = () => {
        running = false;
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        doc?.removeEventListener('visibilitychange', onVisibility);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(flock.makeAbortError());
      };
      const arm = () => {
        startedAt = performance.now();
        running = true;
        timeoutId = setTimeout(finish, remaining);
      };
      // Pause the countdown while the tab is hidden and resume with the
      // time that was left, so background time is not spent waiting.
      const onVisibility = () => {
        if (doc.hidden) {
          if (!running) return;
          running = false;
          clearTimeout(timeoutId);
          remaining = Math.max(0, remaining - (performance.now() - startedAt));
        } else if (!running) {
          arm();
        }
      };

      signal?.addEventListener('abort', onAbort);
      doc?.addEventListener('visibilitychange', onVisibility);
      if (!doc?.hidden) arm();
    });
  },
  makeAbortError() {
    const err = new Error('Run stopped');
    err.name = 'AbortError';
    return err;
  },
  waitUntil(conditionFunc) {
    if (typeof conditionFunc !== 'function') {
      console.warn('waitUntil: conditionFunc must be a function');
      return Promise.resolve();
    }
    const signal = flock.abortController?.signal;
    return new Promise((resolve, reject) => {
      // Reject on abort (like wait) so a condition-wait loop stops on Stop.
      if (signal?.aborted) {
        reject(flock.makeAbortError());
        return;
      }

      const checkCondition = () => {
        if (signal?.aborted) {
          flock.scene?.onBeforeRenderObservable?.remove(observer);
          reject(flock.makeAbortError());
          return;
        }
        try {
          if (conditionFunc()) {
            flock.scene.onBeforeRenderObservable.remove(observer);
            resolve();
          }
        } catch (error) {
          flock.scene.onBeforeRenderObservable.remove(observer);
          reject(error);
        }
      };
      const observer = flock.scene.onBeforeRenderObservable.add(checkCondition);

      signal?.addEventListener(
        'abort',
        () => {
          flock.scene?.onBeforeRenderObservable?.remove(observer);
          reject(flock.makeAbortError());
        },
        { once: true }
      );
    });
  },
};
