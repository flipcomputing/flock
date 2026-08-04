import { expect } from 'chai';

export function runControlTests(flock) {
  describe('Control API @control', function () {
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

    describe('safeLoop', function () {
      it('should call the loop body for each iteration', async function () {
        const calls = [];
        await flock.safeLoop(0, (i) => calls.push(i));
        await flock.safeLoop(1, (i) => calls.push(i));
        await flock.safeLoop(2, (i) => calls.push(i));
        expect(calls).to.deep.equal([0, 1, 2]);
      });

      it('should stop when state.stopExecution is set', async function () {
        const calls = [];
        const state = { stopExecution: true };
        await flock.safeLoop(0, (i) => calls.push(i), 100, undefined, state);
        expect(calls).to.be.empty;
      });
    });

    describe('makeLoopYield', function () {
      const identityGuard = (cb) => cb;

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
  });
}
