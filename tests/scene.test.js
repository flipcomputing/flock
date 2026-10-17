import { expect } from 'chai';
import { isReported } from '../ui/notifications.js';
import { translate } from '../main/translation.js';

export function runSceneTests(flock) {
  describe('Scene API Tests', function () {
    // ─── setSky ────────────────────────────────────────────────────────────────

    describe('setSky', function () {
      afterEach(function () {
        if (flock.sky) {
          flock.disposeMesh(flock.sky);
          flock.sky = null;
        }
      });

      it('should create a sky sphere for a single color string', function () {
        flock.setSky('#6495ed');
        expect(flock.sky).to.exist;
        expect(flock.sky.name).to.equal('sky');
      });

      it('should create a sky sphere for a 2-color gradient array', function () {
        flock.setSky(['#6495ed', '#ffffff']);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.exist;
      });

      it('should create a sky sphere for a 3-color gradient array', function () {
        flock.setSky(['#000033', '#6495ed', '#ffffff']);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.exist;
      });

      it('should create a sky sphere when passed a Material instance', function () {
        const mat = new flock.BABYLON.StandardMaterial('testSkyMat', flock.scene);
        mat.backFaceCulling = false;
        flock.setSky(mat);
        expect(flock.sky).to.exist;
        expect(flock.sky.material).to.equal(mat);
        mat.dispose();
      });

      it('should set clearColor and not create a sky sphere with clear:true', function () {
        flock.setSky('#ff0000', { clear: true });
        expect(flock.sky).to.not.exist;
      });

      it('should take the clear colour from the middle of a gradient sky', function () {
        flock.setSky(['#ff0000', '#00ff00', '#0000ff']);
        expect(flock.scene.clearColor.r).to.be.closeTo(0, 1e-6);
        expect(flock.scene.clearColor.g).to.be.closeTo(1, 1e-6);
        expect(flock.scene.clearColor.b).to.be.closeTo(0, 1e-6);
      });

      it('should take the clear colour between the two stops of a two-colour sky', function () {
        flock.setSky(['#000000', '#ffffff']);
        expect(flock.scene.clearColor.r).to.be.closeTo(0.5, 1e-6);
        expect(flock.scene.clearColor.g).to.be.closeTo(0.5, 1e-6);
        expect(flock.scene.clearColor.b).to.be.closeTo(0.5, 1e-6);
      });

      it('should not alias a material colour into the scene clear colour', function () {
        const mat = new flock.BABYLON.StandardMaterial('aliasSkyMat', flock.scene);
        mat.diffuseColor = new flock.BABYLON.Color3(1, 0, 0);
        flock.setSky(mat);
        expect(flock.scene.clearColor).to.not.equal(mat.diffuseColor);
        mat.dispose();
      });

      it('should only have one sky mesh after calling setSky twice', function () {
        flock.setSky('#6495ed');
        const first = flock.sky;
        flock.setSky('#ff6347');
        const second = flock.sky;

        expect(second).to.exist;
        expect(second).to.not.equal(first);

        const skyMeshes = flock.scene.meshes.filter((m) => m.name === 'sky');
        expect(skyMeshes.length).to.equal(1);
      });
    });

    // ─── createLinearGradientTexture ───────────────────────────────────────────

    describe('createLinearGradientTexture', function () {
      const createdTextures = [];

      afterEach(function () {
        createdTextures.forEach((t) => t.dispose());
        createdTextures.length = 0;
      });

      it('should return a DynamicTexture for a two-color array', function () {
        const tex = flock.createLinearGradientTexture(['#336633', '#88cc88']);
        createdTextures.push(tex);
        expect(tex).to.exist;
        expect(tex.getClassName()).to.equal('DynamicTexture');
      });

      it('should return a DynamicTexture for a single-color array', function () {
        const tex = flock.createLinearGradientTexture(['#336633']);
        createdTextures.push(tex);
        expect(tex).to.exist;
        expect(tex.getClassName()).to.equal('DynamicTexture');
      });

      it('should produce a taller-than-wide texture by default (vertical)', function () {
        const tex = flock.createLinearGradientTexture(['#336633', '#88cc88'], {
          size: 256,
        });
        createdTextures.push(tex);
        const { width, height } = tex.getSize();
        expect(height).to.be.greaterThan(width);
      });

      it('should produce a wider-than-tall texture with horizontal:true', function () {
        const tex = flock.createLinearGradientTexture(['#336633', '#88cc88'], {
          size: 256,
          horizontal: true,
        });
        createdTextures.push(tex);
        const { width, height } = tex.getSize();
        expect(width).to.be.greaterThan(height);
      });

      it('should respect the size option', function () {
        const tex = flock.createLinearGradientTexture(['#336633', '#88cc88'], {
          size: 128,
        });
        createdTextures.push(tex);
        const { height } = tex.getSize();
        expect(height).to.equal(128);
      });
    });

    // ─── createMap ─────────────────────────────────────────────────────────────

    describe('createMap', function () {
      // flock.ground is assigned immediately for heightmaps, but metadata is
      // only populated inside the async onReady callback. Poll until it lands.
      async function waitForGroundMetadata(timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (flock.ground?.metadata) return flock.ground;
          await new Promise((r) => setTimeout(r, 50));
        }
        return flock.ground;
      }

      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it('should create a ground mesh for a plain color list', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const ground = flock.ground;
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
      });

      it('should create a ground mesh for a material object with color list', function () {
        flock.createMap('NONE', {
          color: ['#336633', '#88cc88'],
          materialName: 'none.png',
        });
        const ground = flock.ground;
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
      });

      it('should return nothing', function () {
        expect(flock.createMap('NONE', ['#336633', '#88cc88'])).to.equal(undefined);
        expect(flock.ground).to.exist;
      });

      it('should set correct metadata on the ground mesh', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const ground = flock.ground;
        expect(ground.metadata).to.exist;
        expect(ground.metadata.blockKey).to.equal('ground');
        expect(ground.metadata.heightMapImage).to.equal('NONE');
      });

      it('should attach a physics body to the ground mesh', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const ground = flock.ground;
        expect(ground.physics).to.exist;
      });

      it('should reuse the same mesh when called again with the same image', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const first = flock.ground;
        flock.createMap('NONE', ['#cc8833', '#88cc88']);
        const second = flock.ground;
        expect(second).to.equal(first);
        const groundMeshes = flock.scene.meshes.filter((m) => m.name === 'ground');
        expect(groundMeshes.length).to.equal(1);
      });

      it('should not accumulate ground meshes across repeated calls', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        flock.createMap('NONE', ['#cc8833', '#336633']);
        flock.createMap('NONE', ['#ffffff', '#000000']);
        const groundMeshes = flock.scene.meshes.filter((m) => m.name === 'ground');
        expect(groundMeshes.length).to.equal(1);
      });

      it('should apply a texture material to a flat ground', function () {
        const mat = flock.createMaterial({ materialName: 'test.png' });
        flock.createMap('NONE', mat);
        const ground = flock.ground;
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
        expect(ground.material).to.exist;
      });

      it('should create a ground mesh from a heightmap image @slow', async function () {
        this.timeout(10000);
        flock.createMap('Islands.png', ['#336633', '#88cc88']);
        const ground = await waitForGroundMetadata();
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
        expect(ground.metadata.heightMapImage).to.equal('Islands.png');
      });

      it('should replace a flat ground with a heightmap ground @slow', async function () {
        this.timeout(10000);
        flock.createMap('NONE', ['#336633', '#88cc88']);
        flock.createMap('Islands.png', ['#336633', '#88cc88']);
        const ground = await waitForGroundMetadata();
        expect(ground.metadata.heightMapImage).to.equal('Islands.png');
        const groundMeshes = flock.scene.meshes.filter((m) => m.name === 'ground');
        expect(groundMeshes.length).to.equal(1);
      });
    });

    // ─── getGroundLevelAt ──────────────────────────────────────────────────────

    describe('getGroundLevelAt', function () {
      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it('should return 0 when no ground exists', function () {
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.equal(0);
      });

      it('should return a number after a flat ground is created', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.be.a('number');
      });

      it('should return 0 at the centre of a flat ground', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const level = flock.getGroundLevelAt(0, 0);
        expect(level).to.equal(0);
      });

      it('should accept custom rayStartY and rayLength options without error', function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const level = flock.getGroundLevelAt(0, 0, {
          rayStartY: 500,
          rayLength: 1000,
        });
        expect(level).to.be.a('number');
      });
    });

    // ─── waitForGroundReady ────────────────────────────────────────────────────

    describe('waitForGroundReady', function () {
      afterEach(function () {
        if (flock.ground) {
          flock.disposeMesh(flock.ground);
          flock.ground = null;
        }
      });

      it('should resolve immediately with the ground when flock.ground already exists', async function () {
        flock.createMap('NONE', ['#336633', '#88cc88']);
        const ground = await flock.waitForGroundReady();
        expect(ground).to.equal(flock.ground);
      });
    });

    // ─── initialize ───────────────────────────────────────────────────────────

    describe('initialize', function () {
      this.timeout(10000);

      let savedScene;

      before(function () {
        savedScene = flock.scene;
        flock.engine?.stopRenderLoop();
      });

      after(function () {
        flock.scene = savedScene;
        flock.engine?.runRenderLoop(flock._renderLoop);
      });

      it('sets up BABYLON, canvas, observables, and abortController', async function () {
        await flock.initialize();
        expect(flock.BABYLON).to.exist;
        expect(flock.canvas.id).to.equal('renderCanvas');
        expect(flock.abortController).to.be.instanceOf(AbortController);
        expect(flock.inputManager).to.exist;
        expect(flock._onScreenSource).to.exist;
      });
    });

    // ─── createEngine ─────────────────────────────────────────────────────────

    describe('createEngine when WebGL cannot start', function () {
      let savedEngine;
      let savedBabylon;
      let savedWebGL;

      beforeEach(function () {
        savedEngine = flock.engine;
        savedBabylon = flock.BABYLON;
        savedWebGL = window.WebGLRenderingContext;
        flock.engine = null;
        flock.BABYLON = {
          ...savedBabylon,
          Engine: class {
            constructor() {
              throw new Error('WebGL not supported');
            }
          },
        };
      });

      afterEach(function () {
        window.WebGLRenderingContext = savedWebGL;
        flock.BABYLON = savedBabylon;
        flock.engine = savedEngine;
        document.querySelectorAll('.flock-banner').forEach((banner) => banner.remove());
      });

      const banners = () => [...document.querySelectorAll('.flock-banner')];

      it('offers a reload when WebGL exists but gives no context', function () {
        expect(() => flock.createEngine()).to.throw('WebGL not supported');
        expect(banners()).to.have.length(1);
        expect(banners()[0].textContent).to.contain(translate('error_webgl_unavailable'));
        expect(document.querySelector('.flock-banner__action')).to.exist;
      });

      it('says WebGL is unsupported, with no reload, when the browser has no WebGL', function () {
        delete window.WebGLRenderingContext;
        expect(() => flock.createEngine()).to.throw('WebGL not supported');
        expect(banners()).to.have.length(1);
        expect(banners()[0].textContent).to.contain(translate('error_webgl_unsupported'));
        expect(document.querySelector('.flock-banner__action')).to.not.exist;
      });

      it('clears the unavailable banner when a later attempt succeeds', function () {
        expect(() => flock.createEngine()).to.throw('WebGL not supported');
        flock.BABYLON = savedBabylon;
        flock.createEngine();
        try {
          expect(banners()).to.have.length(0);
        } finally {
          flock.engine.dispose();
        }
      });

      it('marks the error reported so startup does not add a second banner', function () {
        let thrown;
        try {
          flock.createEngine();
        } catch (error) {
          thrown = error;
        }
        expect(isReported(thrown)).to.equal(true);
      });
    });

    describe('createEngine', function () {
      let savedEngine;
      let savedScene;

      before(function () {
        savedEngine = flock.engine;
        savedScene = flock.scene;
        flock.engine = new flock.BABYLON.NullEngine();
        flock.createEngine();
      });

      after(function () {
        flock.engine?.dispose();
        flock.engine = savedEngine;
        flock.scene = savedScene;
      });

      it('creates a Babylon Engine (not NullEngine)', function () {
        expect(flock.engine).to.be.instanceOf(flock.BABYLON.Engine);
        expect(flock.engine).to.not.be.instanceOf(flock.BABYLON.NullEngine);
      });

      it('sets enableOfflineSupport to false', function () {
        expect(flock.engine.enableOfflineSupport).to.be.false;
      });

      describe('render loop visibility handling', function () {
        const setHidden = (value) => {
          Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => value,
          });
          document.dispatchEvent(new Event('visibilitychange'));
        };

        let savedLoop;
        let savedStopped;
        let stopCalls;
        let runArgs;
        let origStop;
        let origRun;

        beforeEach(function () {
          savedLoop = flock._renderLoop;
          savedStopped = flock._renderLoopStopped;
          flock._renderLoop = () => {};
          flock._renderLoopStopped = false;
          stopCalls = 0;
          runArgs = [];
          origStop = flock.engine.stopRenderLoop.bind(flock.engine);
          origRun = flock.engine.runRenderLoop.bind(flock.engine);
          flock.engine.stopRenderLoop = (...a) => {
            stopCalls++;
            return origStop(...a);
          };
          flock.engine.runRenderLoop = (...a) => {
            runArgs.push(a[0]);
            return origRun(...a);
          };
        });

        afterEach(function () {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          delete document.hidden;
          flock.engine.stopRenderLoop = origStop;
          flock.engine.runRenderLoop = origRun;
          flock._renderLoop = savedLoop;
          flock._renderLoopStopped = savedStopped;
        });

        it('stops the render loop when the tab is hidden', function () {
          setHidden(true);
          expect(stopCalls).to.be.greaterThan(0);
        });

        it('resumes the render loop when the tab is shown again', function () {
          setHidden(true);
          setHidden(false);
          expect(runArgs).to.include(flock._renderLoop);
        });

        it('does not resume a render loop that Stop halted', function () {
          flock._renderLoopStopped = true;
          setHidden(true);
          setHidden(false);
          expect(runArgs).to.not.include(flock._renderLoop);
        });

        it('keeps rendering while paused so the gizmos still work', function () {
          try {
            flock.setPaused(true);
            expect(stopCalls).to.equal(0);
          } finally {
            flock.setPaused(false);
          }
        });

        it('resumes rendering when the tab is shown while paused', function () {
          try {
            flock.setPaused(true);
            setHidden(true);
            setHidden(false);
            expect(runArgs).to.include(flock._renderLoop);
          } finally {
            flock.setPaused(false);
          }
        });
      });

      describe('pause', function () {
        it('switches physics and animations off while paused', function () {
          if (!flock.scene) this.skip();
          try {
            flock.setPaused(true);
            expect(flock.scene.physicsEnabled).to.equal(false);
            expect(flock.scene.animationsEnabled).to.equal(false);
            flock.setPaused(false);
            expect(flock.scene.physicsEnabled).to.equal(true);
            expect(flock.scene.animationsEnabled).to.equal(true);
          } finally {
            flock.setPaused(false);
          }
        });

        it('resets animation timing on resume so the paused gap is not replayed', function () {
          if (!flock.scene) this.skip();
          const origReset = flock.scene.resetLastAnimationTimeFrame;
          let resets = 0;
          flock.scene.resetLastAnimationTimeFrame = () => resets++;
          try {
            flock.setPaused(true);
            flock.setPaused(false);
            expect(resets).to.equal(1);
          } finally {
            flock.scene.resetLastAnimationTimeFrame = origReset;
            flock.setPaused(false);
          }
        });

        it('defers whenRunning callbacks until resume', function () {
          let ran = 0;
          try {
            flock.setPaused(true);
            flock.whenRunning(() => ran++);
            expect(ran).to.equal(0);
            flock.setPaused(false);
            expect(ran).to.equal(1);
            flock.whenRunning(() => ran++);
            expect(ran).to.equal(2);
          } finally {
            flock.setPaused(false);
          }
        });
      });
    });

    // ─── cloneMesh ─────────────────────────────────────────────────────────────

    describe('cloneMesh', function () {
      const createdIds = [];

      afterEach(function () {
        createdIds.forEach((id) => flock.dispose(id));
        createdIds.length = 0;
      });

      async function pollUntil(predicate, timeout = 3000) {
        const start = Date.now();
        while (!predicate() && Date.now() - start < timeout) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return predicate();
      }

      it('should return null for a missing sourceMeshName', function () {
        const result = flock.cloneMesh({ cloneId: 'clone1' });
        expect(result).to.be.null;
      });

      it('should return null for a missing cloneId', function () {
        const boxId = flock.createBox('cloneSrc__1', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const result = flock.cloneMesh({ sourceMeshName: boxId });
        expect(result).to.be.null;
      });

      it('should return a string ID for valid inputs', function () {
        const boxId = flock.createBox('cloneSrc__2', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'myClone',
        });
        createdIds.push(cloneId);
        expect(cloneId).to.be.a('string');
        expect(cloneId).to.include('myClone');
      });

      it("should return an ID starting with cloneId + '_'", function () {
        const boxId = flock.createBox('cloneSrc__3', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'myClone',
        });
        createdIds.push(cloneId);
        expect(cloneId).to.match(/^myClone_/);
      });

      it('should avoid collisions for repeated clone ids', function () {
        const boxId = flock.createBox('cloneReserveSrc', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);

        const firstCloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'reserveClone',
        });
        const secondCloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'reserveClone',
        });
        createdIds.push(firstCloneId, secondCloneId);

        expect(firstCloneId).to.not.equal(secondCloneId);
      });

      it('should key the clone to its own block, not the source block', async function () {
        const groupId = flock.createGroup('cloneKeySrc__g2');
        const sphereId = flock.createSphere('cloneKeyMember__s2', { position: [0, 0, 0] });
        createdIds.push(groupId, sphereId);
        flock.setParent(groupId, sphereId);

        const cloneId = flock.cloneMesh({
          sourceMeshName: groupId,
          cloneId: 'keyedClone',
          blockKey: 'cloneBlock1',
        });
        createdIds.push(cloneId);

        const clone = await flock.whenModelReady(cloneId);
        const source = flock.scene.getMeshByName(groupId);
        const sourceMember = source.getChildMeshes(true)[0];
        const cloneMember = clone.getChildMeshes(true)[0];

        expect(clone.metadata.blockKey).to.equal('cloneBlock1');
        expect(source.metadata.blockKey).to.equal('g2');
        expect(cloneMember.metadata.blockKey).to.be.undefined;
        expect(sourceMember.metadata.blockKey).to.equal('s2');
        expect(cloneMember.metadata).to.not.equal(sourceMember.metadata);
        expect(sourceMember.metadata.sharedMaterial).to.be.true;
      });

      it('should invoke the callback after cloning', async function () {
        this.timeout(3000);
        const boxId = flock.createBox('cloneSrc__4', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        let called = false;
        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'myClone',
          callback: () => {
            called = true;
          },
        });
        createdIds.push(cloneId);
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(called).to.be.true;
      });

      it('should include a loading model parented to a group cloned straight away', async function () {
        this.timeout(10000);
        const groupId = flock.createGroup('cloneGroupSrc__g1');
        createdIds.push(groupId);
        const treeId = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'cloneGroupTree__t1',
          position: { x: -1.6, y: 0, z: 1.1 },
          callback: async () => {
            await flock.resize(treeId, { width: 3.1, height: 5.1, depth: 3 });
          },
        });
        createdIds.push(treeId);
        flock.setParent(groupId, treeId);
        const sphereId = flock.createSphere('cloneGroupSphere__s1', {
          position: [-1.5, 3.5, -0.2],
        });
        createdIds.push(sphereId);
        flock.setParent(groupId, sphereId);

        const cloneId = flock.cloneMesh({ sourceMeshName: groupId, cloneId: 'groupClone' });
        createdIds.push(cloneId);
        await flock.positionAt(cloneId, { x: 3, y: 0, z: 0, useY: true });

        const clone = await flock.whenModelReady(cloneId);
        const group = flock.scene.getMeshByName(groupId);
        expect(clone.position.x).to.not.be.closeTo(group.position.x, 0.5);
        expect(clone.getChildMeshes(true).length).to.equal(2);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const clonedParts = clone
          .getChildMeshes(false)
          .filter((m) => m.getTotalVertices() > 0);
        expect(clonedParts.length).to.be.greaterThan(0);
        clonedParts.forEach((m) => {
          expect(m.isEnabled()).to.be.true;
          expect(m.isVisible).to.be.true;
        });
      });

      it('should pass each clone its own id when cloned in a loop', async function () {
        this.timeout(5000);
        const boxId = flock.createBox('loopCloneSrc__l1', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);

        const received = { callback: [], then: [] };
        const cloneIds = [];
        for (let i = 0; i < 3; i++) {
          cloneIds.push(
            flock.cloneMesh({
              sourceMeshName: boxId,
              cloneId: 'loopClone',
              callback: (id) => received.callback.push(id),
              then: (id) => received.then.push(id),
            })
          );
        }
        createdIds.push(...cloneIds);

        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(received.callback).to.deep.equal(cloneIds);
        expect(received.then).to.deep.equal(cloneIds);
      });

      it('should pass an object its own id when created in a loop', async function () {
        this.timeout(10000);
        const objectIds = [];
        const received = [];
        const done = [];
        for (let i = 0; i < 3; i++) {
          let resolveThen;
          done.push(new Promise((resolve) => (resolveThen = resolve)));
          objectIds.push(
            flock.createObject({
              modelName: 'tree.glb',
              modelId: 'loopObject__o1',
              position: { x: i * 2, y: 0, z: 0 },
              callback: (id) => received.push(id),
              then: resolveThen,
            })
          );
        }
        createdIds.push(...objectIds);

        const thenIds = await Promise.all(done);
        expect([...received].sort()).to.deep.equal([...objectIds].sort());
        expect([...thenIds].sort()).to.deep.equal([...objectIds].sort());
      });

      it('should put a clone in the family of a source with an underscore name', async function () {
        this.timeout(5000);
        const sourceId = flock.createBox('clone_fam_src__cf1', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const neighbourId = flock.createBox('clone__cf2', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [3, 0, 0],
        });
        createdIds.push(sourceId, neighbourId);

        const cloneId = flock.cloneMesh({ sourceMeshName: sourceId, cloneId: 'clone_fam_src_x1' });
        const cloneOfCloneId = flock.cloneMesh({
          sourceMeshName: cloneId,
          cloneId: 'clone_fam_src_x1_y1',
        });
        createdIds.push(cloneId, cloneOfCloneId);

        expect(flock._familyOf(cloneId)).to.equal('clone_fam_src');
        expect(flock._familyOf(cloneOfCloneId)).to.equal('clone_fam_src');
        expect(flock._familyOf(neighbourId)).to.equal('clone');

        const picked = [];
        flock.onTrigger(sourceId, {
          trigger: 'OnPickTrigger',
          callback: (name) => picked.push(name),
          applyToGroup: true,
        });

        await flock.whenModelReady(cloneOfCloneId);
        await new Promise((resolve) => setTimeout(resolve, 100));
        for (const name of [sourceId, neighbourId, cloneId, cloneOfCloneId]) {
          flock.scene
            .getMeshByName(name)
            ?.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
        }
        expect(picked).to.have.members([sourceId, cloneId, cloneOfCloneId]);
      });

      it('should give cloned group members the family of their clone', async function () {
        this.timeout(5000);
        const groupId = flock.createGroup('snow_man__cg1');
        const partId = flock.createBox('snow_ball__cg2', {
          color: '#ffffff',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(groupId, partId);
        await flock.setParent(groupId, partId);

        const cloneId = flock.cloneMesh({ sourceMeshName: groupId, cloneId: 'snow_man_cg3' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);
        const [clonedPart] = clone.getChildMeshes(true);

        expect(clonedPart.name.startsWith(`${cloneId}.`)).to.be.true;
        expect(flock._familyOf(clonedPart.name)).to.equal('snow_man');
        expect(flock._familyOf(partId)).to.equal('snow_ball');
      });

      const panelTexts = (texture) =>
        (texture?.getControlByName('stackPanel')?.children ?? []).map(
          (bubble) => bubble.children[0]?.text
        );
      const bubbleTexts = (mesh) => {
        const plane = mesh.metadata?.sayPlane;
        if (!plane || plane.isDisposed() || plane.metadata?.sayTarget !== mesh) return [];
        return panelTexts(plane.advancedTexture);
      };
      const isTextPlane = (node) => node.metadata?.isTextPlane || node.name.endsWith('textPlane');

      it('should not copy the source speech bubble to a clone', async function () {
        this.timeout(5000);
        const sourceId = flock.createBox('sayCloneSrc__sc1', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(sourceId);
        const source = flock.scene.getMeshByName(sourceId);
        flock.say(sourceId, { text: 'Hello', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));
        const sourcePlane = source.metadata.sayPlane;

        const cloneId = flock.cloneMesh({ sourceMeshName: sourceId, cloneId: 'sayClone' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);

        expect(clone.getDescendants(false).filter(isTextPlane)).to.be.empty;
        expect(bubbleTexts(clone)).to.deep.equal([]);
        expect(sourcePlane.parent).to.equal(source);
        expect(bubbleTexts(source)).to.deep.equal(['Hello']);
      });

      it('should keep speech on a clone separate from the source', async function () {
        this.timeout(5000);
        const sourceId = flock.createBox('sayCloneSep__sc2', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(sourceId);
        const source = flock.scene.getMeshByName(sourceId);
        flock.say(sourceId, { text: 'Original', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cloneId = flock.cloneMesh({ sourceMeshName: sourceId, cloneId: 'saySep' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);

        flock.say(cloneId, { text: 'Clone', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(clone.metadata.sayPlane).to.not.equal(source.metadata.sayPlane);
        expect(bubbleTexts(source)).to.deep.equal(['Original']);
        expect(bubbleTexts(clone)).to.deep.equal(['Clone']);
      });

      it('should not copy speech on a group member to the cloned member', async function () {
        this.timeout(5000);
        const groupId = flock.createGroup('sayGroupSrc__sg1');
        const partId = flock.createBox('sayGroupPart__sg2', {
          color: '#ffffff',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(groupId, partId);
        await flock.setParent(groupId, partId);
        flock.say(partId, { text: 'Member', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cloneId = flock.cloneMesh({ sourceMeshName: groupId, cloneId: 'sayGroupClone' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);

        expect(clone.getDescendants(false).filter(isTextPlane)).to.be.empty;
        expect(bubbleTexts(flock.scene.getMeshByName(partId))).to.deep.equal(['Member']);
      });

      const planeBackground = (plane) => plane.advancedTexture?.rootContainer.children[0]?.background;

      it('should give a speaking plane clone its own blank texture', async function () {
        this.timeout(5000);
        const sourceId = flock.createPlane('sayPlaneSrc__sp1', {
          color: '#3366cc',
          width: 2,
          height: 1,
          position: [0, 1, 0],
        });
        createdIds.push(sourceId);
        const source = flock.scene.getMeshByName(sourceId);
        flock.say(sourceId, { text: 'On plane', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cloneId = flock.cloneMesh({ sourceMeshName: sourceId, cloneId: 'sayPlaneClone' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);

        expect(clone.advancedTexture).to.exist;
        expect(clone.advancedTexture).to.not.equal(source.advancedTexture);
        expect(clone.material).to.not.equal(source.material);
        expect(planeBackground(clone)).to.equal(planeBackground(source));
        expect(panelTexts(clone.advancedTexture)).to.deep.equal([]);
        expect(panelTexts(source.advancedTexture)).to.deep.equal(['On plane']);
      });

      it('should keep later speech on a cloned plane separate from the source', async function () {
        this.timeout(5000);
        const sourceId = flock.createPlane('sayPlaneSep__sp2', {
          color: '#cc6633',
          width: 2,
          height: 1,
          position: [0, 1, 0],
        });
        createdIds.push(sourceId);
        const source = flock.scene.getMeshByName(sourceId);
        await flock.say(sourceId, { text: 'Gone', duration: 0.1 });

        const cloneId = flock.cloneMesh({ sourceMeshName: sourceId, cloneId: 'sayPlaneSep' });
        createdIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);

        expect(planeBackground(clone)).to.equal(planeBackground(source));

        flock.say(cloneId, { text: 'Clone', duration: 3 });
        flock.say(sourceId, { text: 'Source', duration: 3 });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(panelTexts(clone.advancedTexture)).to.deep.equal(['Clone']);
        expect(panelTexts(source.advancedTexture)).to.deep.equal(['Source']);
      });

      it('should apply a group click trigger to a clone made after the trigger', async function () {
        this.timeout(10000);
        const groupId = flock.createGroup('clickGroupSrc__g2');
        createdIds.push(groupId);
        const treeId = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'clickGroupTree__t2',
          position: { x: 0, y: 0, z: 0 },
        });
        createdIds.push(treeId);
        flock.setParent(groupId, treeId);

        flock.onTrigger('clickGroupSrc__g3', {
          trigger: 'OnPickTrigger',
          callback: () => {},
          applyToGroup: true,
        });

        const cloneId = flock.cloneMesh({
          sourceMeshName: groupId,
          cloneId: 'clickGroupSrc_c1',
        });
        createdIds.push(cloneId);

        const clone = await flock.whenModelReady(cloneId);
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(clone.actionManager?.actions.length ?? 0).to.be.greaterThan(0);
      });

      it("should run the source shape's do on the clone before the clone's own do", async function () {
        this.timeout(5000);
        const calls = [];
        const boxId = flock.createBox('doReplayBox__d1', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        await flock.runDo(boxId, async (me) => calls.push(['source', me]));

        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'doReplayClone',
          callback: (me) => calls.push(['clone', me]),
        });
        createdIds.push(cloneId);

        await pollUntil(() => calls.length >= 3);
        expect(calls).to.deep.equal([
          ['source', boxId],
          ['source', cloneId],
          ['clone', cloneId],
        ]);
      });

      it("should run a model's do and then on its clone", async function () {
        this.timeout(10000);
        const received = [];
        let resolveThen;
        const revealed = new Promise((resolve) => (resolveThen = resolve));
        const treeId = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'doReplayTree__d2',
          position: { x: 0, y: 0, z: 0 },
          callback: (me) => received.push(['do', me]),
          then: (me) => {
            received.push(['then', me]);
            resolveThen();
          },
        });
        createdIds.push(treeId);
        await revealed;

        const cloneId = flock.cloneMesh({ sourceMeshName: treeId, cloneId: 'doReplayTreeClone' });
        createdIds.push(cloneId);

        await pollUntil(() => received.length >= 4);
        expect(received).to.deep.equal([
          ['do', treeId],
          ['then', treeId],
          ['do', cloneId],
          ['then', cloneId],
        ]);
      });

      it("should run a shape's then on its clone after the clone's own do", async function () {
        this.timeout(5000);
        const calls = [];
        const boxId = flock.createBox('thenReplayBox__d4', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        await flock.runDo(boxId, (me) => calls.push(['source do', me]));
        await flock.runThen(boxId, (me) => calls.push(['source then', me]));
        calls.length = 0;

        const cloneId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'thenReplayClone',
          callback: (me) => calls.push(['clone do', me]),
          then: (me) => calls.push(['clone then', me]),
        });
        createdIds.push(cloneId);

        await pollUntil(() => calls.length >= 4);
        expect(calls).to.deep.equal([
          ['source do', cloneId],
          ['clone do', cloneId],
          ['source then', cloneId],
          ['clone then', cloneId],
        ]);
      });

      it('should run the whole do chain on a clone of a clone', async function () {
        this.timeout(5000);
        const calls = [];
        const boxId = flock.createBox('doChainBox__d3', {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(boxId);
        await flock.runDo(boxId, (me) => calls.push(['source', me]));

        const firstId = flock.cloneMesh({
          sourceMeshName: boxId,
          cloneId: 'doChainFirst',
          callback: (me) => calls.push(['first', me]),
        });
        createdIds.push(firstId);
        await pollUntil(() => calls.length >= 3);

        calls.length = 0;
        const secondId = flock.cloneMesh({
          sourceMeshName: firstId,
          cloneId: 'doChainSecond',
          callback: (me) => calls.push(['second', me]),
        });
        createdIds.push(secondId);

        await pollUntil(() => calls.length >= 3);
        expect(calls).to.deep.equal([
          ['source', secondId],
          ['first', secondId],
          ['second', secondId],
        ]);
      });
    });

    // ─── getClonesOf ───────────────────────────────────────────────────────────

    describe('getClonesOf', function () {
      const createdIds = [];

      afterEach(async function () {
        for (const id of [...createdIds].reverse()) await flock.dispose(id);
        createdIds.length = 0;
      });

      const box = (id, x = 0) => {
        const name = flock.createBox(id, {
          color: '#996633',
          width: 1,
          height: 1,
          depth: 1,
          position: [x, 0, 0],
        });
        createdIds.push(name);
        return name;
      };
      const clone = async (sourceMeshName, cloneId) => {
        const name = flock.cloneMesh({ sourceMeshName, cloneId });
        createdIds.push(name);
        await flock.whenModelReady(name);
        return name;
      };

      it('lists clones and clones of clones in creation order', async function () {
        const source = box('clonesOfSrc__g1');
        box('clonesOfOther__g2', 3);
        await flock.whenModelReady(source);
        const first = await clone(source, 'clonesOfFirst');
        const second = await clone(source, 'clonesOfSecond');
        const nested = await clone(first, 'clonesOfNested');

        expect(flock.getClonesOf(source)).to.deep.equal([first, second, nested]);
        expect(flock.getClonesOf(first)).to.deep.equal([nested]);
        expect(flock.getClonesOf(nested)).to.deep.equal([]);
      });

      it('leaves out mirrored copies and their clones', async function () {
        const source = box('clonesOfMirrorSrc__g3');
        await flock.whenModelReady(source);
        const mirrored = flock.mirror(source, { mirrorId: 'clonesOfMirror__g4', axis: 'x' });
        createdIds.push(mirrored);
        await flock.whenModelReady(mirrored);
        const mirrorClone = await clone(mirrored, 'clonesOfMirrorClone');

        expect(flock.getClonesOf(source)).to.deep.equal([]);
        expect(flock.getClonesOf(mirrored)).to.deep.equal([mirrorClone]);
      });

      it('lists only the top object of a cloned parent', async function () {
        const parent = box('clonesOfParent__g5');
        const child = box('clonesOfChild__g6', 2);
        await flock.parentChild(parent, child, 2, 0, 0);
        const copy = await clone(parent, 'clonesOfParentCopy');

        expect(flock.getClonesOf(parent)).to.deep.equal([copy]);
        expect(flock.getClonesOf(child)).to.deep.equal([]);
      });

      it('leaves out the look of a linked clone with its own colour', async function () {
        const source = box('clonesOfLinkSrc__g8');
        await flock.whenModelReady(source);
        const linked = flock.cloneMesh({
          sourceMeshName: source,
          cloneId: 'clonesOfLinked',
          mode: 'linked',
        });
        createdIds.push(linked);
        await flock.whenModelReady(linked);
        await flock.changeColor(linked, { color: '#00ff00' });
        expect(flock._lookTarget(flock.scene.getMeshByName(linked)).name).to.not.equal(linked);

        expect(flock.getClonesOf(source)).to.deep.equal([linked]);
      });

      it('drops disposed clones', async function () {
        const source = box('clonesOfDisposeSrc__g7');
        await flock.whenModelReady(source);
        const kept = await clone(source, 'clonesOfKept');
        const gone = await clone(source, 'clonesOfGone');
        await flock.dispose(gone);

        expect(flock.getClonesOf(source)).to.deep.equal([kept]);
      });

      it('returns an empty list for a missing object or a non-string', function () {
        expect(flock.getClonesOf('clonesOfMissing')).to.deep.equal([]);
        expect(flock.getClonesOf(null)).to.deep.equal([]);
        expect(flock.getClonesOf({})).to.deep.equal([]);
      });
    });

    // ─── copy and linked clones ────────────────────────────────────────────────

    describe('cloneMesh copy and linked modes', function () {
      const createdIds = [];

      afterEach(function () {
        createdIds.forEach((id) => flock.dispose(id));
        createdIds.length = 0;
      });

      const mesh = (id) => flock.scene.getMeshByName(id);
      const look = (id) => flock._lookTarget(mesh(id));
      const colourOf = (id) => String(flock.getMaterialParamsFromMesh(look(id)).color).toLowerCase();
      const alphaOf = (id) => flock.getMaterialParamsFromMesh(look(id)).alpha;
      const frame = () => flock.scene.render();
      const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

      function box(name, color = '#996633') {
        const id = flock.createBox(name, {
          color,
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(id);
        return id;
      }

      async function cloneOf(sourceId, cloneId, options = {}) {
        const id = flock.cloneMesh({ sourceMeshName: sourceId, cloneId, ...options });
        createdIds.push(id);
        await flock.whenModelReady(id);
        await settle();
        frame();
        return id;
      }

      it('should copy, not follow, the source', async function () {
        const sourceId = box('copySrc__cm1', '#ff0000');
        const copyId = await cloneOf(sourceId, 'copyA');

        await flock.changeColor(sourceId, { color: '#0000ff' });
        await flock.moveByVector(sourceId, { y: 2 });
        frame();

        expect(colourOf(copyId)).to.equal('#ff0000');
        expect(mesh(copyId).position.y).to.not.be.closeTo(mesh(sourceId).position.y, 0.01);
      });

      it('should make a source that already had its own material copy it before editing it', async function () {
        const sourceId = box('copyShared__cm2', '#ff0000');
        await flock.changeColor(sourceId, { color: '#00ff00' });
        const copyId = await cloneOf(sourceId, 'copyB');

        expect(mesh(sourceId).metadata.sharedMaterial).to.be.true;
        flock.ensureUniqueMaterial(mesh(sourceId));
        expect(mesh(sourceId).material).to.not.equal(mesh(copyId).material);
      });

      it('should pass the source colour, alpha and effects to a linked clone', async function () {
        const sourceId = box('linkSrc__lk1', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkA', { mode: 'linked' });

        await flock.changeColor(sourceId, { color: '#0000ff' });
        await flock.setAlpha(sourceId, { value: 0.5 });
        await flock.tint(sourceId, { color: '#00ff00' });

        expect(colourOf(copyId)).to.equal('#0000ff');
        expect(alphaOf(copyId)).to.equal(0.5);
        expect(mesh(copyId).getClassName()).to.equal('InstancedMesh');
        expect(mesh(sourceId).renderOverlay).to.be.true;
      });

      it('should stop following a property the linked clone changes itself', async function () {
        const sourceId = box('linkOwn__lk2', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkB', { mode: 'linked' });

        await flock.changeColor(copyId, { color: '#ffff00' });
        await flock.changeColor(sourceId, { color: '#0000ff' });
        await flock.setAlpha(sourceId, { value: 0.5 });

        expect(colourOf(copyId)).to.equal('#ffff00');
        expect(alphaOf(copyId)).to.equal(0.5);
      });

      it('should follow the source position on each axis the linked clone has not moved', async function () {
        const sourceId = box('linkPos__lk3');
        const copyId = await cloneOf(sourceId, 'linkC', { mode: 'linked' });

        await flock.moveByVector(copyId, { x: 3 });
        frame();
        await flock.moveByVector(sourceId, { x: 1, y: 2 });
        frame();

        const source = mesh(sourceId);
        const copy = mesh(copyId);
        expect(copy.position.x).to.be.closeTo(3, 0.01);
        expect(copy.position.y).to.be.closeTo(source.position.y, 0.01);
        expect(copy.position.z).to.be.closeTo(source.position.z, 0.01);
      });

      it('should follow the source size and visibility', async function () {
        const sourceId = box('linkSize__lk4');
        const copyId = await cloneOf(sourceId, 'linkD', { mode: 'linked' });

        await flock.resize(sourceId, { width: 2 });
        await flock.hide(sourceId);
        frame();

        expect(mesh(copyId).scaling.x).to.be.closeTo(mesh(sourceId).scaling.x, 0.001);
        expect(mesh(copyId).isEnabled()).to.be.false;
      });

      it('should follow the source rotation until the linked clone rotates itself', async function () {
        const sourceId = box('linkRot__lk4b');
        const copyId = await cloneOf(sourceId, 'linkRotA', { mode: 'linked' });
        const turned = (id, y) =>
          Math.abs(
            flock.BABYLON.Quaternion.Dot(
              mesh(id).absoluteRotationQuaternion,
              flock.eulerDegreesToQuat(0, y, 0)
            )
          );

        mesh(sourceId).rotationQuaternion = flock.eulerDegreesToQuat(0, 30, 0);
        frame();
        expect(turned(copyId, 30)).to.be.closeTo(1, 1e-4);

        mesh(copyId).rotationQuaternion = flock.eulerDegreesToQuat(0, 90, 0);
        frame();
        mesh(sourceId).rotationQuaternion = flock.eulerDegreesToQuat(0, 60, 0);
        frame();
        expect(turned(copyId, 90)).to.be.closeTo(1, 1e-4);
      });

      it('should not treat the replayed source DO as the linked clone changing itself', async function () {
        const sourceId = box('linkDo__lk5');
        await flock.runDo(sourceId, (id) => flock.changeColor(id, { color: '#ff0000' }));
        const copyId = await cloneOf(sourceId, 'linkE', { mode: 'linked' });

        await flock.changeColor(sourceId, { color: '#0000ff' });

        expect(colourOf(copyId)).to.equal('#0000ff');
      });

      it('should pass changes down a chain of linked clones', async function () {
        const sourceId = box('linkChain__lk6', '#ff0000');
        const firstId = await cloneOf(sourceId, 'linkF', { mode: 'linked' });
        const secondId = await cloneOf(firstId, 'linkG', { mode: 'linked' });

        await flock.changeColor(sourceId, { color: '#0000ff' });

        expect(colourOf(secondId)).to.equal('#0000ff');
      });

      it('should delete linked clones, but not copies, with the source', async function () {
        const sourceId = box('linkDel__lk7');
        const linkedId = await cloneOf(sourceId, 'linkH', { mode: 'linked' });
        const copyId = await cloneOf(sourceId, 'copyH');

        flock.disposeMesh(mesh(sourceId));

        expect(mesh(linkedId)).to.be.null;
        expect(mesh(copyId)).to.exist;
      });

      it('should free the shared physics shape only when its last body goes', async function () {
        const sourceId = box('shapeShare__ss1');
        const shape = mesh(sourceId).physics?.shape;
        expect(shape).to.exist;
        const copyId = await cloneOf(sourceId, 'shapeCopy');
        expect(mesh(copyId).physics.shape).to.equal(shape);

        flock.disposeMesh(mesh(copyId));
        expect(shape._isDisposed).to.not.be.true;
        flock.disposeMesh(mesh(sourceId));
        expect(shape._isDisposed).to.be.true;
      });

      it('should forget a suffixed clone name and instance entry once the clone is gone', async function () {
        const sourceId = box('nameFree__nf1');
        const firstId = await cloneOf(sourceId, 'nameFreeCopy');
        const secondId = await cloneOf(sourceId, 'nameFreeCopy');
        expect(secondId).to.not.equal('nameFreeCopy');
        expect(flock._modelInstances[sourceId].size).to.equal(2);

        flock.disposeMesh(mesh(secondId));
        expect(flock._nameRegistry.has(secondId)).to.be.false;
        expect(flock._nameRegistry.has(firstId)).to.be.true;
        expect(flock._modelInstances[sourceId].size).to.equal(1);

        flock.disposeMesh(mesh(firstId));
        expect(flock._modelInstances[sourceId]).to.be.undefined;
      });

      it('should make a linked clone an instance until it changes its own look', async function () {
        const sourceId = box('linkInst__li1', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkInstA', { mode: 'linked' });
        const copy = mesh(copyId);

        expect(copy.getClassName()).to.equal('InstancedMesh');
        expect(copy.sourceMesh).to.equal(mesh(sourceId));
        expect(copy.physics).to.exist;
        expect(copy.physics).to.not.equal(mesh(sourceId).physics);

        await flock.changeColor(copyId, { color: '#00ff00' });

        expect(mesh(copyId)).to.equal(copy);
        expect(copy.isVisible).to.be.false;
        expect(look(copyId)).to.not.equal(copy);
        expect(colourOf(copyId)).to.equal('#00ff00');
        expect(colourOf(sourceId)).to.equal('#ff0000');
        expect(copy.physics).to.exist;
      });

      it('should keep following the source after its own look change, except for that change', async function () {
        const sourceId = box('linkAfter__li2', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkAfterA', { mode: 'linked' });

        await flock.changeColor(copyId, { color: '#00ff00' });
        await flock.setAlpha(sourceId, { value: 0.5 });
        await flock.changeColor(sourceId, { color: '#0000ff' });

        expect(alphaOf(copyId)).to.equal(0.5);
        expect(colourOf(copyId)).to.equal('#00ff00');
      });

      it('should fire the root click handler from a promoted linked clone', async function () {
        const sourceId = box('linkClick__li3');
        const copyId = await cloneOf(sourceId, 'linkClickA', { mode: 'linked' });
        await flock.moveByVector(copyId, { x: 4 });
        await flock.changeColor(copyId, { color: '#00ff00' });
        const picked = [];
        flock.onTrigger(copyId, {
          trigger: 'OnPickTrigger',
          callback: (name) => picked.push(name),
        });
        await settle();
        frame();

        const position = mesh(copyId).getAbsolutePosition();
        const ray = new flock.BABYLON.Ray(
          new flock.BABYLON.Vector3(position.x, position.y + 5, position.z),
          new flock.BABYLON.Vector3(0, -1, 0),
          20
        );
        const hit = flock.scene.pickWithRay(ray);
        expect(hit.pickedMesh).to.equal(look(copyId));
        flock.scene.simulatePointerDown(hit);
        flock.scene.simulatePointerUp(hit);

        expect(picked).to.deep.equal([copyId]);
      });

      it('should give a follower of a promoted linked clone that clone\'s look', async function () {
        const sourceId = box('linkChainLook__li4', '#ff0000');
        const firstId = await cloneOf(sourceId, 'linkChainA', { mode: 'linked' });
        const secondId = await cloneOf(firstId, 'linkChainB', { mode: 'linked' });

        await flock.changeColor(firstId, { color: '#00ff00' });
        expect(colourOf(secondId)).to.equal('#00ff00');

        await flock.setAlpha(firstId, { value: 0.5 });
        expect(alphaOf(secondId)).to.equal(0.5);
        expect(colourOf(sourceId)).to.equal('#ff0000');
      });

      it('should share the source material when the source colour is animated', async function () {
        const sourceId = box('linkAnimSrc__li5', '#ff0000');
        const otherId = box('linkAnimOther__li6', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkAnimA', { mode: 'linked' });

        await flock.animateProperty(sourceId, {
          property: 'color',
          targetValue: '#00ff00',
          duration: 0.1,
        });

        expect(mesh(copyId).material).to.equal(mesh(sourceId).material);
        expect(mesh(otherId).material).to.not.equal(mesh(sourceId).material);
        expect(colourOf(otherId)).to.equal('#ff0000');
      });

      it('should animate only its own material when a linked clone colour is animated', async function () {
        const sourceId = box('linkAnimOwn__li7', '#ff0000');
        const copyId = await cloneOf(sourceId, 'linkAnimOwnA', { mode: 'linked' });

        await flock.animateProperty(copyId, {
          property: 'color',
          targetValue: '#00ff00',
          duration: 0.1,
        });

        expect(look(copyId).material).to.not.equal(mesh(sourceId).material);
        expect(colourOf(sourceId)).to.equal('#ff0000');
      });

      it('should instance every part of a group, keeping the shell hidden', async function () {
        const groupId = flock.createGroup('linkGroup__lg1');
        const partId = flock.createSphere('linkPart__lp1', { position: [0, 1, 0] });
        createdIds.push(groupId, partId);
        flock.setParent(groupId, partId);
        await flock.whenModelReady(partId);

        const copyId = await cloneOf(groupId, 'linkGroupCopy', { mode: 'linked' });
        const part = mesh(copyId).getChildMeshes(true)[0];

        expect(part.getClassName()).to.equal('InstancedMesh');
        expect(part.name).to.equal(`${copyId}.${mesh(partId).name}`);
        expect(mesh(copyId).isVisible).to.equal(mesh(groupId).isVisible);

        await flock.changeColor(copyId, { color: '#00ff00' });
        const realised = mesh(copyId).getChildMeshes(true)[0];
        expect(realised.getClassName()).to.equal('Mesh');
        expect(realised.name).to.equal(part.name);
        expect(colourOf(partId)).to.not.equal('#00ff00');
      });

      it('should recolour the parts of a linked model clone, not its hidden wrapper', async function () {
        this.timeout(10000);
        const sourceId = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'linkModel__lm1',
          color: ['#ffcc33', '#cc8844'],
          position: { x: 0, y: 0, z: 0 },
        });
        createdIds.push(sourceId);
        await flock.whenModelReady(sourceId);
        const copyId = await cloneOf(sourceId, 'linkModelA', { mode: 'linked' });

        await flock.changeColor(copyId, { color: '#008080' });

        const parts = (id) =>
          mesh(id)
            .getChildMeshes(false)
            .filter((part) => part.material && !part.metadata?.lookVisual);
        expect(look(copyId)).to.equal(mesh(copyId));
        const partColour = (part) => String(flock.getMaterialParamsFromMesh(part).color).toLowerCase();
        expect(parts(copyId).map(partColour)).to.deep.equal(['#008080', '#008080']);
        expect(parts(sourceId).map(partColour)).to.deep.equal(['#ffcc33', '#cc8844']);
      });

      it('should make a full copy, not an instance, when copying a linked clone', async function () {
        const sourceId = box('linkCopy__li8', '#ff0000');
        const linkedId = await cloneOf(sourceId, 'linkCopyA', { mode: 'linked' });
        await flock.changeColor(linkedId, { color: '#00ff00' });
        const copyId = await cloneOf(linkedId, 'linkCopyB');

        expect(mesh(copyId).getClassName()).to.equal('Mesh');
        expect(look(copyId)).to.equal(mesh(copyId));
        expect(colourOf(copyId)).to.equal('#00ff00');
      });

      it('should move followers to a linked clone made standalone', async function () {
        const sourceId = box('linkStandalone__ls1', '#ff0000');
        const firstId = await cloneOf(sourceId, 'linkStandaloneA', { mode: 'linked' });
        const secondId = await cloneOf(firstId, 'linkStandaloneB', { mode: 'linked' });

        const standalone = flock._standalone(mesh(firstId));
        expect(mesh(firstId)).to.equal(standalone);
        await flock.changeColor(firstId, { color: '#00ff00' });
        expect(colourOf(secondId)).to.equal('#00ff00');

        flock.disposeMesh(standalone);
        expect(mesh(secondId)).to.be.null;
      });

      it('should keep a follower built from a promoted clone when that clone is made standalone', async function () {
        const sourceId = box('linkStandaloneLook__ls2', '#ff0000');
        const firstId = await cloneOf(sourceId, 'linkStandaloneC', { mode: 'linked' });
        await flock.changeColor(firstId, { color: '#00ff00' });
        const secondId = await cloneOf(firstId, 'linkStandaloneD', { mode: 'linked' });

        flock._standalone(mesh(firstId));

        expect(look(secondId).isDisposed()).to.be.false;
        expect(colourOf(secondId)).to.equal('#00ff00');
      });

      it('should merge a linked clone as a full mesh', async function () {
        this.timeout(10000);
        const sourceId = box('linkMerge__li9');
        const otherId = box('linkMergeOther__li10');
        const copyId = await cloneOf(sourceId, 'linkMergeA', { mode: 'linked' });
        await flock.moveByVector(copyId, { x: 0.5 });

        const mergedId = await flock.mergeMeshes('linkMerged', [copyId, otherId]);
        createdIds.push(mergedId);

        expect(mesh(mergedId)).to.exist;
        expect(mesh(mergedId).getTotalVertices()).to.be.greaterThan(0);
      });

      it('should realise a linked clone before resizing it with a texture', async function () {
        const id = flock.createBox('linkTexture__lt1', {
          color: { color: '#ffffff', materialName: 'test.png' },
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(id);
        await flock.whenModelReady(id);
        const copyId = await cloneOf(id, 'linkTextureA', { mode: 'linked' });
        const uvKind = flock.BABYLON.VertexBuffer.UVKind;
        const sourceUVs = Array.from(mesh(id).getVerticesData(uvKind));

        await flock.resize(copyId, { width: 3 });

        expect(look(copyId).getClassName()).to.equal('Mesh');
        expect(Array.from(mesh(id).getVerticesData(uvKind))).to.deep.equal(sourceUVs);
        expect(Array.from(look(copyId).getVerticesData(uvKind))).to.not.deep.equal(sourceUVs);
      });

      it('should delete a promoted linked clone with the source', async function () {
        const sourceId = box('linkDelPromoted__li11');
        const shape = mesh(sourceId).physics.shape;
        const copyId = await cloneOf(sourceId, 'linkDelPromotedA', { mode: 'linked' });
        await flock.changeColor(copyId, { color: '#00ff00' });
        const lookChild = look(copyId);

        flock.disposeMesh(mesh(sourceId));

        expect(mesh(copyId)).to.be.null;
        expect(lookChild.isDisposed()).to.be.true;
        expect(shape._isDisposed).to.be.true;
      });

      describe('character animations', function () {
        this.timeout(30000);

        async function pumped(promise) {
          const interval = setInterval(() => flock.scene.render(), 0);
          try {
            return await promise;
          } finally {
            clearInterval(interval);
          }
        }

        async function character(modelId) {
          const id = flock.createCharacter({
            modelName: 'Liz3.glb',
            modelId,
            position: { x: 0, y: 0, z: 0 },
          });
          createdIds.push(id);
          await pumped(flock.whenModelReady(id));
          return id;
        }

        const skinned = (id) =>
          [mesh(id), ...mesh(id).getChildMeshes(false)].find((part) => part.skeleton);
        const playing = (id) => flock._getCurrentAnimationInfo(mesh(id))?.name;
        const drives = (id, name) =>
          flock.scene.animationGroups.some(
            (group) =>
              group.name.endsWith(`.${name}`) &&
              group.isPlaying &&
              flock._animationGroupTargetsDescendant(group, mesh(id))
          );

        it('should draw a linked character with its original\'s skeleton', async function () {
          const sourceId = await character('animLink__al1');
          await pumped(flock.switchAnimation(sourceId, { animationName: 'Walk' }));
          const copyId = await cloneOf(sourceId, 'animLinked', { mode: 'linked' });

          expect(skinned(copyId).getClassName()).to.equal('InstancedMesh');
          expect(skinned(copyId).skeleton).to.equal(skinned(sourceId).skeleton);

          await pumped(flock.switchAnimation(sourceId, { animationName: 'Jump' }));
          expect(skinned(copyId).skeleton).to.equal(skinned(sourceId).skeleton);
        });

        it('should keep the shared skeleton when a linked character changes its look', async function () {
          const sourceId = await character('animLook__al2');
          const copyId = await cloneOf(sourceId, 'animLookCopy', { mode: 'linked' });

          await flock.changeColor(copyId, { color: '#00ff00' });

          expect(skinned(copyId).getClassName()).to.equal('Mesh');
          expect(skinned(copyId).skeleton).to.equal(skinned(sourceId).skeleton);
        });

        it('should give a linked character its own skeleton when it switches animation', async function () {
          const sourceId = await character('animOwn__al3');
          const copyId = await cloneOf(sourceId, 'animOwnCopy', { mode: 'linked' });

          await pumped(flock.switchAnimation(copyId, { animationName: 'Jump' }));
          await pumped(flock.switchAnimation(sourceId, { animationName: 'Walk' }));

          expect(skinned(copyId).skeleton).to.not.equal(skinned(sourceId).skeleton);
          expect(playing(copyId)).to.equal('Jump');
          expect(drives(copyId, 'Jump')).to.be.true;
          expect(playing(sourceId)).to.equal('Walk');
        });

        it('should keep a linked character\'s own skeleton when it is made standalone', async function () {
          const sourceId = await character('animStandalone__al5');
          const copyId = await cloneOf(sourceId, 'animStandaloneCopy', { mode: 'linked' });
          await pumped(flock.switchAnimation(copyId, { animationName: 'Jump' }));
          const skeleton = skinned(copyId).skeleton;

          flock._standalone(mesh(copyId));

          expect(skinned(copyId).skeleton).to.equal(skeleton);
          expect(flock.scene.skeletons).to.include(skeleton);
        });

        it('should switch a follower with a linked character that has its own animation', async function () {
          const sourceId = await character('animChain__al4');
          const firstId = await cloneOf(sourceId, 'animChainA', { mode: 'linked' });
          const secondId = await cloneOf(firstId, 'animChainB', { mode: 'linked' });

          await pumped(flock.switchAnimation(firstId, { animationName: 'Jump' }));

          expect(skinned(secondId).skeleton).to.not.equal(skinned(sourceId).skeleton);
          expect(skinned(secondId).skeleton).to.not.equal(skinned(firstId).skeleton);
          expect(playing(secondId)).to.equal('Jump');
          expect(drives(secondId, 'Jump')).to.be.true;
        });

        it('should let a copy play its own animation on its own skeleton', async function () {
          const sourceId = await character('animCopy__ac1');
          await pumped(flock.switchAnimation(sourceId, { animationName: 'Walk' }));
          const copyId = await cloneOf(sourceId, 'animCopyA');

          await pumped(flock.switchAnimation(copyId, { animationName: 'Jump' }));
          await pumped(flock.switchAnimation(sourceId, { animationName: 'Idle' }));

          expect(playing(copyId)).to.equal('Jump');
          expect(drives(copyId, 'Jump')).to.be.true;
          expect(playing(sourceId)).to.equal('Idle');
        });
      });

      it('should give a cloned character its own skeleton', async function () {
        this.timeout(15000);
        const characterId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'cloneLiz__ch1',
          position: { x: 0, y: 0, z: 0 },
        });
        createdIds.push(characterId);
        await flock.whenModelReady(characterId);
        const copyId = await cloneOf(characterId, 'lizCopy');

        const skinned = (id) =>
          [mesh(id), ...mesh(id).getChildMeshes(false)].find((part) => part.skeleton);
        const sourcePart = skinned(characterId);
        const copyPart = skinned(copyId);
        expect(copyPart.skeleton).to.not.equal(sourcePart.skeleton);

        const sourceNodes = new Set(mesh(characterId).getDescendants(false));
        copyPart.skeleton.bones.forEach((bone) => {
          const node = bone.getTransformNode();
          if (node) expect(sourceNodes.has(node)).to.be.false;
        });
      });
    });
  });
}
