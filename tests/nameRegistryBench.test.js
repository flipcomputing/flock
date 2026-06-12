import { expect } from 'chai';

// Log-only micro-benchmark for whenModelReady steady-state lookups.
// Not part of any regular suite; run with: npm run test:api nameregistrybench
export function runNameRegistryBenchTests(flock) {
  describe('Name registry benchmark @nameregistrybench @slow', function () {
    this.timeout(60000);

    it('times steady-state whenModelReady calls with a busy scene', async function () {
      const ids = [];
      const meshCount = 300;
      for (let i = 0; i < meshCount; i++) {
        ids.push(
          flock.createBox(`benchBox${i}`, {
            color: '#3366cc',
            width: 0.5,
            height: 0.5,
            depth: 0.5,
            position: [(i % 20) - 10, 0.25, Math.floor(i / 20) - 10],
          })
        );
      }
      // Last-created mesh: worst case for a linear scene.meshes scan.
      const target = ids[ids.length - 1];
      const resolved = await flock.whenModelReady(target);
      expect(resolved).to.exist;

      const iterations = 20000;
      let counter = 0;
      const callback = () => {
        counter++;
      };

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await flock.whenModelReady(target, callback);
      }
      const elapsed = performance.now() - start;

      expect(counter).to.equal(iterations);
      console.log(
        `[bench] whenModelReady steady state: ${iterations} calls, ` +
          `${meshCount} meshes in scene: ${elapsed.toFixed(1)}ms total, ` +
          `${((elapsed * 1000) / iterations).toFixed(2)}µs/call`
      );

      ids.forEach((id) => flock.dispose(id));
    });
  });
}
