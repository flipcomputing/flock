import { expect } from "chai";

export function runControlTests(flock) {
  describe("Control API @control", function () {
    describe("waitUntil", function () {
      it("should resolve once the condition becomes true", async function () {
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

      it("should resolve immediately when condition is already true", async function () {
        const interval = setInterval(() => flock.scene.render(), 0);
        await flock.waitUntil(() => true);
        clearInterval(interval);
      });

      it("should warn and resolve when called without a function", async function () {
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(" "));
        await flock.waitUntil("not a function");
        console.warn = original;
        expect(warnings.length).to.be.greaterThan(0);
      });
    });

    describe("safeLoop", function () {
      it("should call the loop body for each iteration", async function () {
        const calls = [];
        await flock.safeLoop(0, (i) => calls.push(i));
        await flock.safeLoop(1, (i) => calls.push(i));
        await flock.safeLoop(2, (i) => calls.push(i));
        expect(calls).to.deep.equal([0, 1, 2]);
      });

      it("should stop when state.stopExecution is set", async function () {
        const calls = [];
        const state = { stopExecution: true };
        await flock.safeLoop(0, (i) => calls.push(i), 100, undefined, state);
        expect(calls).to.be.empty;
      });
    });
  });
}
