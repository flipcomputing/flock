import { expect } from 'chai';

const PROGRAM = `
  createMap('NONE', ['#336633', '#88cc88']);
  setSky('#6495ed');
  const box = createBox('memBox', {
    width: 1, height: 1, depth: 1, color: '#996633', position: [0, 3, 0],
  });
  await setPhysics(box, 'DYNAMIC');
  const ball = createSphere('memBall', {
    color: '#ffffff', diameterX: 1, diameterY: 1, diameterZ: 1, position: [2, 3, 0],
  });
  await setPhysics(ball, 'DYNAMIC');
  await changeMaterial(box, 'brick.png', '#ffffff');
  createParticleEffect('memFx', {
    emitterMesh: ball,
    emitRate: 10,
    colors: { start: '#ffffff', end: '#ffffff' },
    alphas: { start: 1, end: 0 },
    sizes: { start: 1, end: 1 },
    lifetime: { min: 0.1, max: 0.2 },
    shape: 'flare.png',
  });
  const tree = createObject({
    modelName: 'tree.glb', modelId: 'memTree', position: { x: 4, y: 0, z: 0 },
  });
  const character = createCharacter({
    modelName: 'Liz3.glb', modelId: 'memChar', position: { x: -4, y: 0, z: 0 },
  });
  printText({ text: tree });
  printText({ text: character });
`;

export function runMemoryTests(flock) {
  describe('Memory between runs @memory @slow', function () {
    this.timeout(120000);
    let printed;
    let originalPrintText;

    const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const whenReady = (id) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${id} did not load`)), 30000);
        flock.whenModelReady(id, (mesh) => {
          clearTimeout(timer);
          resolve(mesh);
        });
      });

    async function runProgram({ waitForModels = true } = {}) {
      printed = [];
      await flock.runCode(PROGRAM, { focusCanvas: false });
      if (waitForModels) await Promise.all(printed.map(whenReady));
      await settle(200);
    }

    function havok() {
      const [, stats] = flock.havokInstance.HP_GetStatistics();
      const [bodies, shapes, constraints, debugGeometries, worlds, queryCollectors] = stats;
      return { bodies, shapes, constraints, debugGeometries, worlds, queryCollectors };
    }

    const havokHeapBytes = () => flock.havokInstance.HEAPU8.buffer.byteLength;

    const observers = (observable) => observable?.observers?.length ?? 0;

    function engine() {
      const e = flock.engine;
      return {
        scenes: e.scenes.length,
        textures: e.getLoadedTexturesCache().length,
        onResize: observers(e.onResizeObservable),
        onBeginFrame: observers(e.onBeginFrameObservable),
        onEndFrame: observers(e.onEndFrameObservable),
        onContextLost: observers(e.onContextLostObservable),
        onContextRestored: observers(e.onContextRestoredObservable),
      };
    }

    function scene() {
      const s = flock.scene;
      return {
        meshes: s.meshes.length,
        materials: s.materials.length,
        multiMaterials: s.multiMaterials.length,
        textures: s.textures.length,
        geometries: s.geometries.length,
        transformNodes: s.transformNodes.length,
        lights: s.lights.length,
        cameras: s.cameras.length,
        skeletons: s.skeletons.length,
        animationGroups: s.animationGroups.length,
        particleSystems: s.particleSystems.length,
        postProcesses: s.postProcesses.length,
        effectLayers: s.effectLayers.length,
        onBeforeRender: observers(s.onBeforeRenderObservable),
        onAfterRender: observers(s.onAfterRenderObservable),
        onBeforePhysics: observers(s.onBeforePhysicsObservable),
        onAfterPhysics: observers(s.onAfterPhysicsObservable),
        onPointer: observers(s.onPointerObservable),
        onKeyboard: observers(s.onKeyboardObservable),
      };
    }

    function changed(before, after, prefix = '') {
      const out = {};
      for (const key of Object.keys(before)) {
        if (typeof before[key] === 'object') {
          Object.assign(out, changed(before[key], after[key], `${prefix}${key}.`));
        } else if (before[key] !== after[key]) {
          out[prefix + key] = `${before[key]} -> ${after[key]}`;
        }
      }
      return out;
    }

    async function engineAfterFreshScene() {
      await flock.disposeOldScene();
      await flock.initializeNewScene();
      await settle(500);
      return engine();
    }

    let baselineHavok;
    let baselineEngine;

    before(async function () {
      originalPrintText = flock.printText;
      flock.printText = ({ text }) => printed.push(text);
      await flock.disposeOldScene();
      baselineHavok = havok();
      baselineEngine = await engineAfterFreshScene();
    });

    after(async function () {
      flock.printText = originalPrintText;
      await flock.disposeOldScene();
      await flock.initializeNewScene();
    });

    it('the program really creates physics bodies, models and textures', async function () {
      await runProgram();
      expect(havok().bodies).to.be.above(baselineHavok.bodies);
      expect(engine().textures).to.be.above(baselineEngine.textures);
      expect(flock.scene.skeletons.length).to.be.above(0);
      expect(flock.scene.particleSystems.length).to.be.above(0);
    });

    it('disposing the scene releases every Havok body, shape, constraint and world', async function () {
      await runProgram();
      await flock.disposeOldScene();
      expect(changed(baselineHavok, havok())).to.deep.equal({});
    });

    it('disposing the scene releases its GPU textures and engine observers', async function () {
      await runProgram();
      await flock.disposeOldScene();
      expect(flock.engine.scenes).to.deep.equal([]);
      expect(changed(baselineEngine, await engineAfterFreshScene())).to.deep.equal({});
    });

    it('disposing the scene disposes the old scene and its meshes', async function () {
      await runProgram();
      const oldScene = flock.scene;
      const oldMeshes = [...oldScene.meshes];
      await flock.disposeOldScene();
      expect(oldScene.isDisposed).to.be.true;
      expect(oldMeshes.filter((mesh) => !mesh.isDisposed()).map((mesh) => mesh.name)).to.deep.equal(
        []
      );
    });

    it('disposing the scene empties the caches that hold Babylon and Havok objects', async function () {
      await runProgram();
      await flock.disposeOldScene();
      const leftOver = Object.entries({
        modelCache: Object.keys(flock.modelCache),
        modelsBeingLoaded: Object.keys(flock.modelsBeingLoaded),
        geometryCache: Object.keys(flock.geometryCache),
        materialCache: Object.keys(flock.materialCache),
        physicsShapeCache: Object.keys(flock.physicsShapeCache),
        animationFileCache: Object.keys(flock._animationFileCache),
        modelInstances: Object.keys(flock._modelInstances ?? {}),
        nameRegistry: [...flock._nameRegistry.keys()],
        liveNameCache: [...flock._liveNameCache.keys()],
        pendingTriggers: [...flock.pendingTriggers.keys()],
        pendingIntersections: [...flock.pendingIntersections.keys()],
        globalSounds: flock.globalSounds,
      }).filter(([, entries]) => entries.length);
      expect(Object.fromEntries(leftOver)).to.deep.equal({});
      expect(flock.ground).to.equal(null);
      expect(flock.hk).to.equal(null);
    });

    it('disposing while models are still loading leaves nothing behind', async function () {
      await runProgram({ waitForModels: false });
      await flock.disposeOldScene();
      await settle(3000);
      expect(changed(baselineHavok, havok())).to.deep.equal({});
      expect(changed(baselineEngine, await engineAfterFreshScene())).to.deep.equal({});
    });

    it('repeated runs reach a steady state', async function () {
      await runProgram();
      const first = { scene: scene(), engine: engine(), havok: havok() };

      for (let i = 0; i < 3; i++) await runProgram();

      expect(changed(first, { scene: scene(), engine: engine(), havok: havok() })).to.deep.equal(
        {}
      );
    });

    it('repeated runs do not grow the Havok WASM heap', async function () {
      for (let i = 0; i < 2; i++) await runProgram();
      const warmed = havokHeapBytes();

      for (let i = 0; i < 5; i++) await runProgram();

      expect(havokHeapBytes()).to.equal(warmed);
    });
  });
}
