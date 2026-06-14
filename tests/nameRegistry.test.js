import { expect } from 'chai';

function configureDraco(BABYLON) {
  const base = import.meta?.env?.BASE_URL ?? '/';
  const root = base.endsWith('/') ? base : `${base}/`;

  BABYLON.DracoCompression.DefaultNumWorkers = 0;
  BABYLON.DracoCompression.Configuration = {
    decoder: {
      wasmUrl: `${root}draco/draco_wasm_wrapper_gltf.js`,
      wasmBinaryUrl: `${root}draco/draco_decoder_gltf.wasm`,
      fallbackUrl: `${root}draco/draco_decoder_gltf.js`,
    },
  };
}

async function pumpAnimation(flock, promise) {
  const interval = setInterval(() => {
    flock.scene.render();
  }, 0);
  try {
    await promise;
    flock.scene.render();
    flock.scene.render();
  } finally {
    clearInterval(interval);
  }
}

function waitForModel(flock, meshId) {
  return new Promise((resolve) => flock.whenModelReady(meshId, resolve));
}

export function runNameRegistryTests(flock) {
  describe('Name registry @nameregistry', function () {
    const createdIds = [];

    const makeBox = (name) => {
      const id = flock.createBox(name, {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0.5, 0],
      });
      createdIds.push(id);
      return id;
    };

    afterEach(function () {
      createdIds.forEach((id) => {
        try {
          flock.dispose(id);
        } catch (e) {
          console.warn(`Failed to dispose ${id}:`, e);
        }
      });
      createdIds.length = 0;
    });

    it('registers created meshes and runs callbacks synchronously on the hit path', function () {
      const id = makeBox('registrySteady');
      expect(flock._liveNameCache.has(id)).to.be.true;

      let ran = false;
      flock.whenModelReady(id, () => {
        ran = true;
      });
      // Steady state contract: the callback ran within the call, no await.
      expect(ran).to.be.true;
    });

    it('performs no mesh scans on the steady-state hit path', async function () {
      const id = makeBox('registryNoScan');
      await flock.whenModelReady(id, () => {});

      const original = flock.scene.getMeshByName;
      let scans = 0;
      flock.scene.getMeshByName = function (...args) {
        scans++;
        return original.apply(this, args);
      };
      try {
        for (let i = 0; i < 100; i++) {
          await flock.whenModelReady(id, () => {});
        }
      } finally {
        flock.scene.getMeshByName = original;
      }
      expect(scans).to.equal(0);
    });

    it('resolves .then() with the mesh on hit and miss paths and repopulates after a miss', async function () {
      const id = makeBox('registryThen');

      const hit = await flock.whenModelReady(id).then((m) => m);
      expect(hit).to.exist;
      expect(hit.name).to.equal(id);

      // Force a miss: the full lookup must still resolve and re-cache.
      flock._liveNameCache.delete(id);
      const missed = await flock.whenModelReady(id).then((m) => m);
      expect(missed).to.exist;
      expect(missed.name).to.equal(id);
      expect(flock._liveNameCache.get(id)).to.equal(missed);
    });

    it('waits for async callbacks before resolving on the hit path', async function () {
      const id = makeBox('registryAsyncCb');
      expect(flock._liveNameCache.has(id)).to.be.true;

      let finished = false;
      await flock.whenModelReady(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        finished = true;
      });
      expect(finished).to.be.true;
    });

    it('rejects when the callback throws on the hit path', async function () {
      const id = makeBox('registryThrow');
      expect(flock._liveNameCache.has(id)).to.be.true;

      let rejected = false;
      await flock
        .whenModelReady(id, () => {
          throw new Error('boom');
        })
        .catch(() => {
          rejected = true;
        });
      expect(rejected).to.be.true;
    });

    it('evicts entries when the mesh is disposed', function () {
      const id = flock.createBox('registryDispose', {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0.5, 0],
      });
      expect(flock._liveNameCache.has(id)).to.be.true;

      flock.disposeMesh(flock.scene.getMeshByName(id));
      expect(flock._liveNameCache.has(id)).to.be.false;
    });

    it('treats a stale entry for a disposed mesh as a miss and re-resolves the new mesh', async function () {
      const id = flock.createBox('registryStale', {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0.5, 0],
      });
      const oldMesh = flock.scene.getMeshByName(id);
      oldMesh.dispose();

      // Simulate a missed eviction (a write point we failed to cover):
      // the lazy isDisposed check must evict and fall through.
      flock._liveNameCache.set(id, oldMesh);

      const replacement = flock.BABYLON.MeshBuilder.CreateBox(id, { size: 1 }, flock.scene);
      try {
        const resolved = await flock.whenModelReady(id);
        expect(resolved).to.equal(replacement);
        expect(flock._liveNameCache.get(id)).to.equal(replacement);
      } finally {
        flock._liveNameCache.delete(id);
        replacement.dispose();
      }
    });

    it('resolves waiters registered before the mesh exists (forward reference)', async function () {
      let resolvedMesh = null;
      const pending = flock.whenModelReady('registryFutureBox', (m) => {
        resolvedMesh = m;
      });

      const id = makeBox('registryFutureBox');
      await pending;
      expect(resolvedMesh).to.exist;
      expect(resolvedMesh.name).to.equal(id);
    });

    it('caches pre-sanitization aliases after fallback resolution', async function () {
      const id = makeBox('registryaliasbox');
      const alias = 'registry aliasbox'; // normalizes to "registryaliasbox"

      const resolved = await flock.whenModelReady(alias);
      expect(resolved).to.exist;
      expect(resolved.name).to.equal(id);
      expect(flock._liveNameCache.get(alias)).to.equal(resolved);

      let ran = false;
      flock.whenModelReady(alias, () => {
        ran = true;
      });
      expect(ran).to.be.true;
    });

    it('does not run callbacks on the hit path when the run is aborted', function () {
      const id = makeBox('registryAbort');
      expect(flock._liveNameCache.has(id)).to.be.true;

      const previousController = flock.abortController;
      const controller = new AbortController();
      controller.abort();
      flock.abortController = controller;
      try {
        let ran = false;
        flock.whenModelReady(id, () => {
          ran = true;
        });
        expect(ran).to.be.false;
      } finally {
        flock.abortController = previousController;
      }
    });

    describe('character aliases @slow', function () {
      this.timeout(20000);

      it('registers the pre-sanitization character name as an alias', async function () {
        configureDraco(flock.BABYLON);

        const originalBase = 'registry alias liz';
        const meshId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: `${originalBase}__regAliasBlock`,
          position: { x: 0, y: 0, z: 0 },
        });
        createdIds.push(meshId);
        expect(meshId).to.equal('registryaliasliz');

        const mesh = await pumpAnimation(flock, waitForModel(flock, meshId)).then(() =>
          flock.scene.getMeshByName(meshId)
        );
        expect(mesh).to.exist;

        // Eager alias registration in createCharacter: the raw, unsanitized
        // name resolves via the registry even after the modelReadyPromises
        // TTL cleanup would have removed its alias entry.
        expect(flock._liveNameCache.get(originalBase)).to.equal(mesh);

        let resolvedViaAlias = null;
        flock.whenModelReady(originalBase, (m) => {
          resolvedViaAlias = m;
        });
        expect(resolvedViaAlias).to.equal(mesh);
      });

      it('keeps same-model duplicate characters independent (no stale bare-name alias)', async function () {
        configureDraco(flock.BABYLON);

        // Two "add character" blocks using the SAME model. The bare model base
        // ("Liz3") needs no sanitization, so neither instance may register a
        // bare-name alias — otherwise "Liz3" would point at the wrong instance.
        const meshAId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'Liz3__dupBlockA',
          position: { x: 0, y: 0, z: 0 },
        });
        const meshBId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'Liz3__dupBlockB',
          position: { x: 0, y: 0, z: 0 },
        });
        createdIds.push(meshAId, meshBId);

        // First instance keeps the bare name; second gets a collision suffix.
        expect(meshAId).to.equal('Liz3');
        expect(meshBId).to.not.equal(meshAId);
        expect(meshBId.startsWith('Liz3_')).to.be.true;

        await pumpAnimation(
          flock,
          Promise.all([waitForModel(flock, meshAId), waitForModel(flock, meshBId)])
        );

        const meshA = flock.scene.getMeshByName(meshAId);
        const meshB = flock.scene.getMeshByName(meshBId);
        expect(meshA).to.exist;
        expect(meshB).to.exist;
        expect(meshA).to.not.equal(meshB);
        expect(meshA.name).to.not.equal(meshB.name);
        expect(meshA.metadata.blockKey).to.equal('dupBlockA');
        expect(meshB.metadata.blockKey).to.equal('dupBlockB');
        expect(meshA.metadata.blockKey).to.not.equal(meshB.metadata.blockKey);

        // The bare base name must NOT have been aliased onto either instance.
        expect(flock._liveNameCache.has('Liz3')).to.be.true; // the real "Liz3" mesh
        expect(flock._liveNameCache.get('Liz3')).to.equal(meshA);

        // Moving character A (as the position gizmo does) must move ONLY meshA.
        const meshBxBefore = meshB.position.x;
        await flock.positionAt(meshAId, { x: 5, y: 0, z: 0 });
        flock.scene.render();
        expect(meshA.position.x).to.be.closeTo(5, 1e-3);
        expect(meshB.position.x).to.equal(meshBxBefore);

        // Each name resolves to its own mesh, after the move too.
        let resolvedA = null;
        let resolvedB = null;
        flock.whenModelReady(meshAId, (m) => {
          resolvedA = m;
        });
        flock.whenModelReady(meshBId, (m) => {
          resolvedB = m;
        });
        expect(resolvedA).to.equal(meshA);
        expect(resolvedB).to.equal(meshB);
      });
    });
  });
}
