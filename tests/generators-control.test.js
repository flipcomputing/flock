import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerControlGenerators } from '../generators/generators-control.js';

export function runControlGeneratorTests() {
  describe('generators/generators-control @controlgenerators', function () {
    before(function () {
      registerControlGenerators(javascriptGenerator);
    });

    function stubGenerator(body, values = {}) {
      return {
        INDENT: '  ',
        nameDB_: { getDistinctName: (name) => name.replace(/[^\w]/g, '_') },
        getVariableName: (v) => v,
        valueToCode: (_block, name) => values[name] ?? '1',
        statementToCode: () => body,
      };
    }

    // Execute the generated loop with stubbed performance.now / rAF so the tests
    // assert real behaviour (yields fire from inside the loop, the clock is read
    // only inside the gate) rather than source-text order.
    async function run(code, { now, scope = {} }) {
      let yieldCount = 0;
      let nowCount = 0;
      const performance = {
        now: () => {
          nowCount += 1;
          return now(nowCount);
        },
      };
      const __flockLoopYield = (cb) => {
        yieldCount += 1;
        cb();
        return 0;
      };
      const names = ['performance', '__flockLoopYield', ...Object.keys(scope)];
      const values = [performance, __flockLoopYield, ...Object.values(scope)];
      const fn = new Function(names.join(','), `return (async () => {\n${code}\n})();`);
      await fn(...values);
      return { yieldCount, nowCount };
    }

    const ITERS = 160;
    const lst = Array.from({ length: ITERS }, (_, i) => i);

    const forCode = (body) =>
      javascriptGenerator.forBlock['controls_for'](
        { getFieldValue: () => 'i' },
        stubGenerator(body, { FROM: '1', TO: String(ITERS), BY: '1' })
      );

    const forEachCode = (body) =>
      javascriptGenerator.forBlock['controls_forEach'](
        { getFieldValue: () => 'item' },
        stubGenerator(body, { LIST: 'lst' })
      );

    const repeatCode = (body) =>
      javascriptGenerator.forBlock['controls_repeat_ext'](
        { getField: () => true, getFieldValue: () => String(ITERS) },
        stubGenerator(body)
      );

    // A body that always continues must still reach the yield (it sits at the top
    // of the body), and it must fire repeatedly from inside the loop — a pre-loop
    // yield would fire once, an end-of-body one never.
    it('controls_for yields from inside the loop even when the body continues', async function () {
      const { yieldCount } = await run(forCode('  continue;\n'), { now: (n) => n * 100 });
      expect(yieldCount).to.be.greaterThan(1);
    });

    it('controls_forEach yields from inside the loop even when the body continues', async function () {
      const { yieldCount } = await run(forEachCode('  continue;\n'), {
        now: (n) => n * 100,
        scope: { lst },
      });
      expect(yieldCount).to.be.greaterThan(1);
    });

    it('controls_repeat_ext pauses every iteration even when the body continues', async function () {
      let waits = 0;
      await run(repeatCode('  continue;\n'), {
        now: () => 1000,
        scope: {
          wait: () => {
            waits += 1;
            return Promise.resolve();
          },
        },
      });
      expect(waits).to.equal(ITERS);
    });

    // With the clock pinned under budget, the number of performance.now() reads
    // must stay far below the (fully executed) iteration count — proving it's
    // gated, not read on every iteration (ungated would be ~ITERS reads).
    it('controls_for reads the clock only inside the gate', async function () {
      let ran = 0;
      const { nowCount } = await run(forCode('  mark();\n'), {
        now: () => 1000,
        scope: { mark: () => (ran += 1) },
      });
      expect(ran).to.equal(ITERS);
      expect(nowCount).to.be.below(ITERS / 4);
    });

    it('controls_forEach reads the clock only inside the gate', async function () {
      let ran = 0;
      const { nowCount } = await run(forEachCode('  mark();\n'), {
        now: () => 1000,
        scope: { lst, mark: () => (ran += 1) },
      });
      expect(ran).to.equal(ITERS);
      expect(nowCount).to.be.below(ITERS / 4);
    });

    it('controls_repeat_ext pauses ~5ms per iteration', async function () {
      const durations = [];
      await run(repeatCode('  ;\n'), {
        now: () => 1000,
        scope: {
          wait: (d) => {
            durations.push(d);
            return Promise.resolve();
          },
        },
      });
      expect(durations).to.have.lengthOf(ITERS);
      expect(durations.every((d) => d === 0.005)).to.equal(true);
    });
  });
}
