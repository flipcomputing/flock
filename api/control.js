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
    return new Promise((resolve, reject) => {
      // Reject (not resolve) on abort so cooperative loops stop on Stop.
      if (signal?.aborted) {
        reject(flock.makeAbortError());
        return;
      }
      const timeoutId = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
        reject(flock.makeAbortError());
      };

      signal?.addEventListener("abort", onAbort);
    });
  },
  makeAbortError() {
    const err = new Error("Run stopped");
    err.name = "AbortError";
    return err;
  },
  async safeLoop(
    iteration,
    loopBody,
    chunkSize = 100,
    timing = { lastFrameTime: performance.now() },
    state = {},
  ) {
    if (state.stopExecution) return; // Check if we should stop further iterations
    if (flock.abortController?.signal?.aborted) return;

    // Execute the loop body
    await loopBody(iteration);

    // Yield control after every `chunkSize` iterations
    if (iteration % chunkSize === 0) {
      const currentTime = performance.now();

      if (currentTime - timing.lastFrameTime > 16) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        timing.lastFrameTime = performance.now(); // Update timing for this loop
      }
    }
  },
  waitUntil(conditionFunc) {
    if (typeof conditionFunc !== "function") {
      console.warn("waitUntil: conditionFunc must be a function");
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
        "abort",
        () => {
          flock.scene?.onBeforeRenderObservable?.remove(observer);
          reject(flock.makeAbortError());
        },
        { once: true },
      );
    });
  },
};
