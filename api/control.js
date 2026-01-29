let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockControl = {
  /* 
		  Category: Control
  */

  wait(duration) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (flock.abortController?.signal) {
          flock.abortController.signal.removeEventListener("abort", onAbort);
        }
        resolve();
      }, duration * 1000);

      const onAbort = () => {
        clearTimeout(timeoutId); // Clear the timeout if aborted
        if (flock.abortController?.signal) {
          flock.abortController.signal.removeEventListener("abort", onAbort);
        }
        // Instead of throwing an error, resolve gracefully here
        reject(new Error("Wait aborted"));
      };

      if (flock.abortController?.signal) {
        flock.abortController.signal.addEventListener("abort", onAbort);
      }
    }).catch((error) => {
      // Check if the error is the expected "Wait aborted" error and handle it
      if (error.message === "Wait aborted") {
        return;
      }
      // If it's another error, rethrow it
      throw error;
    });
  },
  async safeLoop(
    iteration,
    loopBody,
    chunkSize = 100,
    timing = { lastFrameTime: performance.now() },
    state = {},
  ) {
    if (state.stopExecution) return; // Check if we should stop further iterations

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
    return new Promise((resolve, reject) => {
      const checkCondition = () => {
        try {
          if (conditionFunc()) {
            flock.scene.onBeforeRenderObservable.removeCallback(checkCondition);
            resolve();
          }
        } catch (error) {
          flock.scene.onBeforeRenderObservable.removeCallback(checkCondition);
          reject(error);
        }
      };
      flock.scene.onBeforeRenderObservable.add(checkCondition);
    });
  },
};
