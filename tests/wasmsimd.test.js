import { expect } from 'chai';

export function runWasmSimdTests(flock) {
  describe('WebAssembly SIMD capability @wasmsimd', function () {
    const realValidate = WebAssembly.validate;

    beforeEach(function () {
      delete flock._wasmSimdSupported;
    });

    afterEach(function () {
      WebAssembly.validate = realValidate;
      delete flock._wasmSimdSupported;
      document.querySelectorAll('.flock-banner').forEach((banner) => banner.remove());
    });

    it('detects SIMD support on an engine that has it', function () {
      expect(flock.isWasmSimdSupported()).to.equal(true);
    });

    it('reports no support when validate rejects the probe module', function () {
      WebAssembly.validate = () => false;
      expect(flock.isWasmSimdSupported()).to.equal(false);
    });

    it('reports no support when validate throws', function () {
      WebAssembly.validate = () => {
        throw new Error('cannot parse');
      };
      expect(flock.isWasmSimdSupported()).to.equal(false);
    });

    it('caches the result so the probe runs once', function () {
      let calls = 0;
      WebAssembly.validate = () => {
        calls += 1;
        return true;
      };
      flock.isWasmSimdSupported();
      flock.isWasmSimdSupported();
      expect(calls).to.equal(1);
    });

    describe('physics gating', function () {
      it('skips the Havok fetch and reports physics-unsupported', async function () {
        flock._wasmSimdSupported = false;
        let loaded = false;
        const loadHavok = async () => {
          loaded = true;
          return {};
        };

        let thrown = null;
        try {
          await flock.ensurePhysicsInstance(loadHavok);
        } catch (error) {
          thrown = error;
        }

        expect(loaded).to.equal(false);
        expect(thrown).to.exist;
        // markReported stops the generic project-run banner stacking on top.
        expect(thrown.flockReported).to.equal(true);
        expect(document.querySelector('.flock-banner')).to.exist;
      });

      it('loads Havok normally when SIMD is available', async function () {
        flock._wasmSimdSupported = true;
        const previousInstance = flock.havokInstance;
        flock.havokInstance = null;
        const instance = { havok: true };

        try {
          const result = await flock.ensurePhysicsInstance(async () => instance);
          expect(result).to.equal(instance);
          expect(document.querySelector('.flock-banner')).to.not.exist;
        } finally {
          flock.havokInstance = previousInstance;
        }
      });
    });

    describe('abort classification', function () {
      it('does not call a wasm compile failure an out-of-memory crash', function () {
        const error = new WebAssembly.RuntimeError(
          "Aborted(CompileError: WebAssembly.Module doesn't parse at byte 345: can't get 0th Type's return value)"
        );
        expect(flock.isPhysicsMemoryAbort(error)).to.equal(false);
      });

      it('still recognises a genuine out-of-memory abort', function () {
        const error = new WebAssembly.RuntimeError('Aborted(out of memory)');
        expect(flock.isPhysicsMemoryAbort(error)).to.equal(true);
      });

      it('never reports out-of-memory on a device without SIMD', function () {
        flock._wasmSimdSupported = false;
        const error = new WebAssembly.RuntimeError('Aborted(out of memory)');
        expect(flock.isPhysicsMemoryAbort(error)).to.equal(false);
      });
    });
  });
}
