import { expect } from 'chai';

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
        const ground = flock.createMap('NONE', ['#336633', '#88cc88']);
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
      });

      it('should create a ground mesh for a material object with color list', function () {
        const ground = flock.createMap('NONE', {
          color: ['#336633', '#88cc88'],
          materialName: 'none.png',
        });
        expect(ground).to.exist;
        expect(ground.name).to.equal('ground');
      });

      it('should set flock.ground to the returned mesh', function () {
        const ground = flock.createMap('NONE', ['#336633', '#88cc88']);
        expect(flock.ground).to.equal(ground);
      });

      it('should set correct metadata on the ground mesh', function () {
        const ground = flock.createMap('NONE', ['#336633', '#88cc88']);
        expect(ground.metadata).to.exist;
        expect(ground.metadata.blockKey).to.equal('ground');
        expect(ground.metadata.heightMapImage).to.equal('NONE');
      });

      it('should attach a physics body to the ground mesh', function () {
        const ground = flock.createMap('NONE', ['#336633', '#88cc88']);
        expect(ground.physics).to.exist;
      });

      it('should reuse the same mesh when called again with the same image', function () {
        const first = flock.createMap('NONE', ['#336633', '#88cc88']);
        const second = flock.createMap('NONE', ['#cc8833', '#88cc88']);
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
        const ground = flock.createMap('NONE', mat);
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
      });
    });

    // ─── cloneMesh ─────────────────────────────────────────────────────────────

    describe('cloneMesh', function () {
      const createdIds = [];

      afterEach(function () {
        createdIds.forEach((id) => flock.dispose(id));
        createdIds.length = 0;
      });

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
    });
  });
}
