import { expect } from 'chai';

export function runControlTests(flock) {
  describe('Control API @control', function () {
    describe('wait', function () {
      const setHidden = (value) => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const clearHidden = () => {
        delete document.hidden;
      };

      it('resolves after roughly the requested delay when visible', async function () {
        const started = performance.now();
        await flock.wait(0.1);
        expect(performance.now() - started).to.be.greaterThan(80);
      });

      it('resumes with the remaining duration after being hidden', async function () {
        try {
          const pending = flock.wait(0.4);

          // Serve ~300ms visible, hide for ~300ms, then restore.
          await new Promise((r) => setTimeout(r, 300));
          setHidden(true);
          await new Promise((r) => setTimeout(r, 300));
          const restoredAt = performance.now();
          setHidden(false);

          await pending;
          const afterRestore = performance.now() - restoredAt;

          // Only ~100ms was left, so the post-restore delay must be short:
          // >40ms rules out counting the hidden gap, <250ms rules out
          // restarting the full 400ms duration.
          expect(afterRestore).to.be.greaterThan(40);
          expect(afterRestore).to.be.lessThan(250);
        } finally {
          clearHidden();
        }
      });

      it('resumes with the remaining duration after a pause', async function () {
        try {
          const pending = flock.wait(0.4);

          await new Promise((r) => setTimeout(r, 300));
          flock.setPaused(true);
          await new Promise((r) => setTimeout(r, 300));
          const resumedAt = performance.now();
          flock.setPaused(false);

          await pending;
          const afterResume = performance.now() - resumedAt;
          expect(afterResume).to.be.greaterThan(40);
          expect(afterResume).to.be.lessThan(250);
        } finally {
          flock.setPaused(false);
        }
      });

      it('stays held when the tab is shown again while paused', async function () {
        try {
          let done = false;
          const pending = flock.wait(0.05).then(() => {
            done = true;
          });
          flock.setPaused(true);
          setHidden(true);
          setHidden(false);
          await new Promise((r) => setTimeout(r, 150));
          expect(done).to.equal(false);

          flock.setPaused(false);
          await pending;
          expect(done).to.equal(true);
        } finally {
          clearHidden();
          flock.setPaused(false);
        }
      });

      it('waits forever for a huge duration but still stops on abort', async function () {
        const previous = flock.abortController;
        flock.abortController = new AbortController();
        try {
          let settled = false;
          const pending = flock.wait(1e9).then(
            () => (settled = 'resolved'),
            (err) => (settled = err?.name)
          );
          await new Promise((r) => setTimeout(r, 50));
          expect(settled).to.equal(false);
          flock.abortController.abort();
          await pending;
          expect(settled).to.equal('AbortError');
        } finally {
          flock.abortController = previous;
        }
      });

      it('still rejects on abort while paused', async function () {
        const previous = flock.abortController;
        flock.abortController = new AbortController();
        try {
          const pending = flock.wait(1);
          await new Promise((r) => setTimeout(r, 20));
          setHidden(true);
          flock.abortController.abort();
          let rejected = false;
          try {
            await pending;
          } catch (err) {
            rejected = err?.name === 'AbortError';
          }
          expect(rejected).to.be.true;
        } finally {
          clearHidden();
          flock.abortController = previous;
        }
      });
    });

    describe('waitUntil', function () {
      it('should resolve once the condition becomes true', async function () {
        let flag = false;

        // Flip the flag after a short delay, pumping the scene so the
        // onBeforeRenderObservable fires and waitUntil can check the condition.
        const interval = setInterval(() => flock.scene.render(), 0);
        setTimeout(() => {
          flag = true;
        }, 50);

        await flock.waitUntil(() => flag);
        clearInterval(interval);

        expect(flag).to.be.true;
      });

      it('should resolve immediately when condition is already true', async function () {
        const interval = setInterval(() => flock.scene.render(), 0);
        await flock.waitUntil(() => true);
        clearInterval(interval);
      });

      it('should warn and resolve when called without a function', async function () {
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));
        await flock.waitUntil('not a function');
        console.warn = original;
        expect(warnings.length).to.be.greaterThan(0);
      });
    });

    describe('makeLoopYield', function () {
      const identityGuard = (cb) => cb;

      const setHidden = (value) => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const clearHidden = () => {
        delete document.hidden;
      };

      it('holds the yield while the tab is hidden and resumes when visible', async function () {
        const prev = window.scheduler;
        window.scheduler = { yield: () => Promise.resolve() };
        try {
          setHidden(true);
          const yieldFn = flock.makeLoopYield(identityGuard);
          let resumed = false;
          const pending = new Promise((resolve) =>
            yieldFn(() => {
              resumed = true;
              resolve();
            })
          );
          await new Promise((r) => setTimeout(r, 20));
          expect(resumed).to.equal(false);

          setHidden(false);
          await pending;
          expect(resumed).to.equal(true);
        } finally {
          window.scheduler = prev;
          clearHidden();
        }
      });

      it('holds the yield while paused and resumes on resume', async function () {
        const prev = window.scheduler;
        window.scheduler = { yield: () => Promise.resolve() };
        try {
          flock.setPaused(true);
          const yieldFn = flock.makeLoopYield(identityGuard);
          let resumed = false;
          const pending = new Promise((resolve) =>
            yieldFn(() => {
              resumed = true;
              resolve();
            })
          );
          await new Promise((r) => setTimeout(r, 20));
          expect(resumed).to.equal(false);

          flock.setPaused(false);
          await pending;
          expect(resumed).to.equal(true);
        } finally {
          window.scheduler = prev;
          flock.setPaused(false);
        }
      });

      it('detaches its visibility listener on abort without resuming', async function () {
        const prev = window.scheduler;
        window.scheduler = { yield: () => Promise.resolve() };
        const controller = new AbortController();
        try {
          setHidden(true);
          const yieldFn = flock.makeLoopYield(identityGuard, controller.signal);
          let resumed = false;
          yieldFn(() => {
            resumed = true;
          });
          controller.abort();
          setHidden(false);
          await new Promise((r) => setTimeout(r, 20));
          expect(resumed).to.equal(false);
        } finally {
          window.scheduler = prev;
          clearHidden();
        }
      });

      it('uses scheduler.yield when available', async function () {
        const prev = window.scheduler;
        let used = false;
        window.scheduler = {
          yield: () => {
            used = true;
            return Promise.resolve();
          },
        };
        try {
          const yieldFn = flock.makeLoopYield(identityGuard);
          await new Promise((resolve) => yieldFn(resolve));
          expect(used).to.equal(true);
        } finally {
          window.scheduler = prev;
        }
      });

      it('falls back to requestAnimationFrame when scheduler.yield is unavailable', async function () {
        const prevScheduler = window.scheduler;
        const prevRaf = window.requestAnimationFrame;
        let usedRaf = false;
        delete window.scheduler;
        window.requestAnimationFrame = (cb) => {
          usedRaf = true;
          cb();
          return 0;
        };
        try {
          const yieldFn = flock.makeLoopYield(identityGuard);
          await new Promise((resolve) => yieldFn(resolve));
          expect(usedRaf).to.equal(true);
        } finally {
          window.scheduler = prevScheduler;
          window.requestAnimationFrame = prevRaf;
        }
      });

      it('never resumes when the guard blocks it (stopped run)', async function () {
        const prev = window.scheduler;
        window.scheduler = { yield: () => Promise.resolve() };
        try {
          // Guard returns a no-op, standing in for an aborted run.
          const yieldFn = flock.makeLoopYield(() => () => {});
          let resumed = false;
          yieldFn(() => {
            resumed = true;
          });
          await new Promise((r) => setTimeout(r, 10));
          expect(resumed).to.equal(false);
        } finally {
          window.scheduler = prev;
        }
      });
    });

    describe('freezeAwareTimeout', function () {
      const setHidden = (value) => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => value,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const clearHidden = () => {
        delete document.hidden;
      };

      it('fires after roughly the requested delay when visible', async function () {
        const started = performance.now();
        await new Promise((resolve) => flock.freezeAwareTimeout(resolve, 100));
        expect(performance.now() - started).to.be.greaterThan(80);
      });

      it('never fires for delays beyond the timer limit', async function () {
        for (const ms of [2 ** 31, 1e12, Infinity]) {
          let fired = false;
          const timer = flock.freezeAwareTimeout(() => {
            fired = true;
          }, ms);
          await new Promise((r) => setTimeout(r, 50));
          timer.cancel();
          expect(fired).to.equal(false);
        }
      });

      it('pauses while hidden and fires with the remaining delay', async function () {
        try {
          let fired = false;
          const startedAt = performance.now();
          flock.freezeAwareTimeout(() => {
            fired = true;
          }, 400);

          await new Promise((r) => setTimeout(r, 300));
          setHidden(true);
          await new Promise((r) => setTimeout(r, 300));
          expect(fired).to.equal(false);
          const restoredAt = performance.now();
          setHidden(false);

          await new Promise((r) => setTimeout(r, 250));
          expect(fired).to.equal(true);
          const afterRestore = performance.now() - restoredAt;
          expect(afterRestore).to.be.greaterThan(40);
          expect(performance.now() - startedAt).to.be.greaterThan(600);
        } finally {
          clearHidden();
        }
      });

      it('holds while paused and fires with the remaining delay', async function () {
        try {
          let fired = false;
          flock.freezeAwareTimeout(() => {
            fired = true;
          }, 100);
          flock.setPaused(true);
          await new Promise((r) => setTimeout(r, 200));
          expect(fired).to.equal(false);

          flock.setPaused(false);
          await new Promise((r) => setTimeout(r, 200));
          expect(fired).to.equal(true);
        } finally {
          flock.setPaused(false);
        }
      });

      it('does not fire after cancel()', async function () {
        try {
          let fired = false;
          const handle = flock.freezeAwareTimeout(() => {
            fired = true;
          }, 50);
          handle.cancel();
          setHidden(true);
          setHidden(false);
          await new Promise((r) => setTimeout(r, 120));
          expect(fired).to.equal(false);
        } finally {
          clearHidden();
        }
      });
    });
  });
}
