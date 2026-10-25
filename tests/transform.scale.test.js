import { expect } from 'chai';

export function runScaleTests(flock) {
  describe('Scale function tests @scale', function () {
    const testBoxIds = [];
    const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];

    // Set up the scene before each test
    beforeEach(async function () {
      flock.scene ??= {};
    });

    // Clean up after each test
    afterEach(function () {
      testBoxIds.forEach((boxId) => {
        if (typeof boxId !== 'string') {
          throw new Error(`Invalid ID: Expected a string, but got ${typeof boxId}`);
        }
        console.log(`Cleaning up box with ID: ${boxId}`);
        flock.dispose(boxId);
      });
      testBoxIds.length = 0;
    });

    it('should scale uniformly when all scale factors are equal', async function () {
      const boxId = flock.createBox('test-box-uniform', {
        color: testColors[0],
        width: 2,
        height: 2,
        depth: 2,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.scale(boxId, { x: 2, y: 2, z: 2 });

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.x).to.equal(2);
      expect(mesh.scaling.y).to.equal(2);
      expect(mesh.scaling.z).to.equal(2);
    });

    it('should scale non-uniformly with different factors', async function () {
      const boxId = flock.createBox('test-box-nonuniform', {
        color: testColors[1],
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.scale(boxId, { x: 3, y: 1.5, z: 0.5 });

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.x).to.equal(3);
      expect(mesh.scaling.y).to.equal(1.5);
      expect(mesh.scaling.z).to.equal(0.5);
    });

    it('should maintain position with different origin points', async function () {
      const boxId = flock.createBox('test-box-origins', {
        color: testColors[2],
        width: 2,
        height: 2,
        depth: 2,
        position: [5, 5, 5],
      });
      testBoxIds.push(boxId);

      const originalBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const originalBottom = originalBounds.boundingBox.minimumWorld.y;

      await flock.scale(boxId, { x: 2, y: 2, z: 2, yOrigin: 'BASE' });

      const newBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const newBottom = newBounds.boundingBox.minimumWorld.y;

      expect(Math.abs(newBottom - originalBottom)).to.be.lessThan(0.001);
    });

    it('should clamp zero scaling to the minimum floor', async function () {
      const boxId = flock.createBox('test-box-zero', {
        color: testColors[3],
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.scale(boxId, { x: 1, y: 0, z: 1 });

      // Scaling is floored at 0.01 to avoid degenerate geometry/colliders.
      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.y).to.equal(0.01);
    });

    it('should use default values when parameters are omitted', async function () {
      const boxId = flock.createBox('test-box-defaults', {
        color: testColors[0],
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.scale(boxId, { x: 2 }); // Only specify x

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.x).to.equal(2);
      expect(mesh.scaling.y).to.equal(1); // Default
      expect(mesh.scaling.z).to.equal(1); // Default
    });
  });

  describe('Resize function tests @scale', function () {
    const testBoxIds = [];
    const testColors = ['#FF6600', '#66FF00', '#0066FF', '#FF0066'];

    // Set up the scene before each test
    beforeEach(async function () {
      flock.scene ??= {};
    });

    // Clean up after each test
    afterEach(function () {
      testBoxIds.forEach((boxId) => {
        if (typeof boxId !== 'string') {
          throw new Error(`Invalid ID: Expected a string, but got ${typeof boxId}`);
        }
        console.log(`Cleaning up box with ID: ${boxId}`);
        flock.dispose(boxId);
      });
      testBoxIds.length = 0;
    });

    it('should resize to exact dimensions', async function () {
      const boxId = flock.createBox('test-box-exact', {
        color: testColors[0],
        width: 2,
        height: 3,
        depth: 4,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.resize(boxId, { width: 10, height: 5, depth: 8 });

      const bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const actualWidth = bounds.boundingBox.maximumWorld.x - bounds.boundingBox.minimumWorld.x;
      const actualHeight = bounds.boundingBox.maximumWorld.y - bounds.boundingBox.minimumWorld.y;
      const actualDepth = bounds.boundingBox.maximumWorld.z - bounds.boundingBox.minimumWorld.z;

      expect(Math.abs(actualWidth - 10)).to.be.lessThan(0.001);
      expect(Math.abs(actualHeight - 5)).to.be.lessThan(0.001);
      expect(Math.abs(actualDepth - 8)).to.be.lessThan(0.001);
    });

    it('should maintain anchor points with different origins', async function () {
      const boxId = flock.createBox('test-box-anchor', {
        color: testColors[1],
        width: 4,
        height: 2,
        depth: 2,
        position: [5, 0, 7],
      });
      testBoxIds.push(boxId);

      const originalBase = flock.getProperty(boxId, 'MIN_Y');

      await flock.resize(boxId, {
        width: 4,
        height: 6,
        depth: 3,
        yOrigin: 'BASE',
      });
      const newBase = flock.getProperty(boxId, 'MIN_Y');

      expect(Math.abs(newBase - originalBase)).to.be.lessThan(0.001);
    });

    it('should handle partial resizing (null dimensions)', async function () {
      const boxId = flock.createBox('test-box-partial', {
        color: testColors[2],
        width: 3,
        height: 4,
        depth: 5,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      const originalBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const originalHeight =
        originalBounds.boundingBox.maximumWorld.y - originalBounds.boundingBox.minimumWorld.y;

      await flock.resize(boxId, { width: 6 }); // Only resize width

      const newBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const newWidth = newBounds.boundingBox.maximumWorld.x - newBounds.boundingBox.minimumWorld.x;
      const newHeight = newBounds.boundingBox.maximumWorld.y - newBounds.boundingBox.minimumWorld.y;

      expect(Math.abs(newWidth - 6)).to.be.lessThan(0.001);
      expect(Math.abs(newHeight - originalHeight)).to.be.lessThan(0.001); // Should remain unchanged
    });

    it('should preserve original dimensions for future resizing', async function () {
      const boxId = flock.createBox('test-box-preserve', {
        color: testColors[3],
        width: 2,
        height: 3,
        depth: 4,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      // First resize
      await flock.resize(boxId, { width: 10, height: 15, depth: 20 });

      // Second resize back to original proportions
      await flock.resize(boxId, { width: 2, height: 3, depth: 4 });

      const bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      const actualWidth = bounds.boundingBox.maximumWorld.x - bounds.boundingBox.minimumWorld.x;
      const actualHeight = bounds.boundingBox.maximumWorld.y - bounds.boundingBox.minimumWorld.y;
      const actualDepth = bounds.boundingBox.maximumWorld.z - bounds.boundingBox.minimumWorld.z;

      expect(Math.abs(actualWidth - 2)).to.be.lessThan(0.001);
      expect(Math.abs(actualHeight - 3)).to.be.lessThan(0.001);
      expect(Math.abs(actualDepth - 4)).to.be.lessThan(0.001);
    });

    it('should handle very small and very large dimensions', async function () {
      const boxId = flock.createBox('test-box-extreme', {
        color: testColors[0],
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      // Test very small
      await flock.resize(boxId, {
        width: 0.001,
        height: 0.001,
        depth: 0.001,
      });
      let bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      let actualWidth = bounds.boundingBox.maximumWorld.x - bounds.boundingBox.minimumWorld.x;
      // Dimensions below the 0.01 scaling floor are clamped up to it.
      expect(Math.abs(actualWidth - 0.01)).to.be.lessThan(0.0001);

      // Test very large
      await flock.resize(boxId, {
        width: 1000,
        height: 1000,
        depth: 1000,
      });
      bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
      actualWidth = bounds.boundingBox.maximumWorld.x - bounds.boundingBox.minimumWorld.x;
      expect(Math.abs(actualWidth - 1000)).to.be.lessThan(0.1);
    });
  });

  describe('setAnchor function tests @scale', function () {
    const testBoxIds = [];
    const anchorPositions = ['MIN', 'CENTER', 'MAX'];

    afterEach(function () {
      testBoxIds.forEach((boxId) => flock.dispose(boxId));
      testBoxIds.length = 0;
    });

    function createTestBox(name, position = [0, 0, 0]) {
      const boxId = flock.createBox(name, { width: 2, height: 2, depth: 2, position });
      testBoxIds.push(boxId);
      return boxId;
    }

    function worldBox(id) {
      const mesh = flock.scene.getMeshByID(id);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
      return mesh.getBoundingInfo().boundingBox;
    }

    it('should default to CENTER on X/Z and MIN (BASE) on Y', async function () {
      const boxId = createTestBox('test-box-default-anchor');

      await flock.setAnchor(boxId);

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.metadata.anchorSettings).to.deep.equal({ x: 'CENTER', y: 'MIN', z: 'CENTER' });
    });

    it('should store numeric and mixed anchor values', async function () {
      const boxId = createTestBox('test-box-mixed-anchor');

      await flock.setAnchor(boxId, { x: 'MIN', y: 1.0, z: 0.5 });

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.metadata.anchorSettings).to.deep.equal({ x: 'MIN', y: 1.0, z: 0.5 });
    });

    it('should set partial anchor parameters', async function () {
      const boxId = createTestBox('test-box-partial-anchor');

      await flock.setAnchor(boxId, { x: 'MIN' });

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.metadata.anchorSettings).to.deep.equal({ x: 'MIN', y: 'MIN', z: 'CENTER' });
    });

    it('should preserve existing metadata when setting the anchor', async function () {
      const boxId = createTestBox('test-box-preserve-metadata');
      const mesh = flock.scene.getMeshByID(boxId);
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.customProperty = 'test-value';

      await flock.setAnchor(boxId, { x: 'MAX' });

      expect(mesh.metadata.customProperty).to.equal('test-value');
      expect(mesh.metadata.anchorSettings.x).to.equal('MAX');
    });

    const corner = { MIN: 0, CENTER: 1, MAX: 2 };
    anchorPositions.forEach((xPos) => {
      anchorPositions.forEach((yPos) => {
        it(`should leave the mesh in place with a ${xPos}, ${yPos} anchor`, async function () {
          const boxId = createTestBox(`test-box-${xPos}-${yPos}`, [1, 0, 1]);

          await flock.setAnchor(boxId, { x: xPos, y: yPos, z: 'CENTER' });

          const { minimumWorld } = worldBox(boxId);
          expect(minimumWorld.x).to.be.closeTo(0, 0.01);
          expect(minimumWorld.y).to.be.closeTo(0, 0.01);
          expect(minimumWorld.z).to.be.closeTo(0, 0.01);
          const anchor = flock._getAnchor(flock.scene.getMeshByID(boxId));
          expect(anchor.x).to.be.closeTo(corner[xPos], 0.01);
          expect(anchor.y).to.be.closeTo(corner[yPos], 0.01);
          expect(anchor.z).to.be.closeTo(1, 0.01);
        });
      });
    });

    it('should keep the block position when the anchor changes', async function () {
      const boxId = createTestBox('test-box-anchor-block-position', [1, 0, 1]);

      await flock.setAnchor(boxId, { x: 'MIN', y: 'MAX', z: 'MIN' });

      const read = flock.getBlockPositionFromMesh(flock.scene.getMeshByID(boxId));
      expect(read.x).to.be.closeTo(1, 0.01);
      expect(read.y).to.be.closeTo(0, 0.01);
      expect(read.z).to.be.closeTo(1, 0.01);
    });

    it('should position by the new anchor afterwards', async function () {
      const boxId = createTestBox('test-box-anchor-then-position');

      await flock.setAnchor(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      await flock.positionAt(boxId, { x: 0, y: 0, z: 0 });

      const { minimumWorld, maximumWorld } = worldBox(boxId);
      expect(minimumWorld.x).to.be.closeTo(0, 0.01);
      expect(minimumWorld.y).to.be.closeTo(0, 0.01);
      expect(minimumWorld.z).to.be.closeTo(0, 0.01);
      expect(maximumWorld.x).to.be.closeTo(2, 0.01);
    });

    it('should leave the rotation pivot at the centre', async function () {
      const boxId = createTestBox('test-box-anchor-rotation');

      await flock.setAnchor(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      const before = worldBox(boxId).centerWorld.clone();
      await flock.rotateTo(boxId, { x: 0, y: 90, z: 0 });

      const after = worldBox(boxId).centerWorld;
      expect(after.x).to.be.closeTo(before.x, 0.01);
      expect(after.y).to.be.closeTo(before.y, 0.01);
      expect(after.z).to.be.closeTo(before.z, 0.01);
    });

    // Play: create by the base rule, then set_anchor and rotate_to in the DO.
    it('should read back the block position of an anchored, rotated object', async function () {
      const boxId = createTestBox('test-box-anchor-readback', [2, 0, 1]);

      await flock.setAnchor(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      await flock.rotateTo(boxId, { x: 0, y: 90, z: 0 });

      const position = flock.getBlockPositionFromMesh(flock.scene.getMeshByID(boxId));
      expect(position.x).to.be.closeTo(2, 0.01);
      expect(position.y).to.be.closeTo(0, 0.01);
      expect(position.z).to.be.closeTo(1, 0.01);
    });

    for (const order of [
      ['rotate', 'anchor'],
      ['rotate', 'pivot', 'anchor'],
      ['pivot', 'rotate', 'anchor'],
    ]) {
      it(`should read and place the pre-DO position after ${order.join(', ')}`, async function () {
        const runDo = async (id) => {
          for (const step of order) {
            if (step === 'rotate') await flock.rotateTo(id, { x: 0, y: 45, z: 30 });
            if (step === 'pivot') await flock.setPivot(id, { x: 'MIN', y: 'MAX', z: 'MIN' });
            if (step === 'anchor') await flock.setAnchor(id, { x: 'MAX', y: 'MIN', z: 'MIN' });
          }
        };
        const boxId = createTestBox(`test-box-predo-${order.join('-')}`, [2, 0, 1]);
        await runDo(boxId);
        const mesh = flock.scene.getMeshByID(boxId);

        const read = flock.getBlockPositionFromMesh(mesh);
        expect(read.x).to.be.closeTo(2, 0.01);
        expect(read.y).to.be.closeTo(0, 0.01);
        expect(read.z).to.be.closeTo(1, 0.01);

        await flock.setBlockPositionOnMesh(mesh, { x: -3, y: 1, z: 4, useY: true });
        const replayId = createTestBox(`test-box-predo-replay-${order.join('-')}`, [-3, 1, 4]);
        await runDo(replayId);
        const replay = flock.scene.getMeshByID(replayId);
        replay.computeWorldMatrix(true);
        mesh.computeWorldMatrix(true);
        const gap = replay.getAbsolutePosition().subtract(mesh.getAbsolutePosition());
        expect(gap.length()).to.be.lessThan(0.01);
      });
    }

    it('should place an anchored, rotated object as Play would', async function () {
      const boxId = createTestBox('test-box-anchor-place');
      await flock.setAnchor(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      await flock.rotateTo(boxId, { x: 0, y: 90, z: 0 });
      const mesh = flock.scene.getMeshByID(boxId);
      const rotation = mesh.rotationQuaternion.clone();

      await flock.setBlockPositionOnMesh(mesh, { x: 3, y: 1, z: -2, useY: true });

      const position = flock.getBlockPositionFromMesh(mesh);
      expect(position.x).to.be.closeTo(3, 0.01);
      expect(position.y).to.be.closeTo(1, 0.01);
      expect(position.z).to.be.closeTo(-2, 0.01);
      expect(mesh.rotationQuaternion.equalsWithEpsilon(rotation, 1e-4)).to.be.true;

      const replayId = createTestBox('test-box-anchor-replay', [3, 1, -2]);
      await flock.setAnchor(replayId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      await flock.rotateTo(replayId, { x: 0, y: 90, z: 0 });
      const replay = flock.scene.getMeshByID(replayId);
      replay.computeWorldMatrix(true);
      mesh.computeWorldMatrix(true);
      expect(replay.getAbsolutePosition().subtract(mesh.getAbsolutePosition()).length()).to.be.lessThan(
        0.01
      );
    });
  });

  describe('setPivot function tests @scale', function () {
    const testBoxIds = [];

    afterEach(function () {
      testBoxIds.forEach((boxId) => flock.dispose(boxId));
      testBoxIds.length = 0;
    });

    function createTestBox(name, { width = 2, height = 2, depth = 2, position = [0, 0, 0] } = {}) {
      const boxId = flock.createBox(name, { width, height, depth, position });
      testBoxIds.push(boxId);
      return boxId;
    }

    it('should keep the mesh in place when the pivot changes', async function () {
      const boxId = createTestBox('test-box-pivot-stays');

      await flock.setPivot(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });

      const mesh = flock.scene.getMeshByID(boxId);
      mesh.computeWorldMatrix(true);
      const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
      expect(minimumWorld.x).to.be.closeTo(-1, 0.01);
      expect(minimumWorld.y).to.be.closeTo(0, 0.01);
      expect(minimumWorld.z).to.be.closeTo(-1, 0.01);
      expect(maximumWorld.x).to.be.closeTo(1, 0.01);
      expect(maximumWorld.z).to.be.closeTo(1, 0.01);
      const absolute = mesh.getAbsolutePosition();
      expect(absolute.x).to.be.closeTo(-1, 0.01);
      expect(absolute.y).to.be.closeTo(0, 0.01);
      expect(absolute.z).to.be.closeTo(-1, 0.01);
    });

    it('should not change the anchor', async function () {
      const boxId = createTestBox('test-box-pivot-anchor');

      await flock.setPivot(boxId, { x: 'MIN', y: 'MAX', z: 'MIN' });
      await flock.positionAt(boxId, { x: 3, y: 1, z: -2 });

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.metadata.anchorSettings).to.be.undefined;
      const anchor = flock._getAnchor(mesh);
      expect(anchor.x).to.be.closeTo(3, 0.01);
      expect(anchor.y).to.be.closeTo(1, 0.01);
      expect(anchor.z).to.be.closeTo(-2, 0.01);
      const { minimumWorld } = mesh.getBoundingInfo().boundingBox;
      expect(minimumWorld.y).to.be.closeTo(1, 0.01);
    });

    it('should rotate about the pivot', async function () {
      const boxId = createTestBox('test-box-hinge', { width: 0.2, position: [5, 0, 0] });

      await flock.setPivot(boxId, { x: 'CENTER', y: 'MIN', z: 'MIN' });
      await flock.rotateTo(boxId, { x: 0, y: -90, z: 0 });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const mesh = flock.scene.getMeshByID(boxId);
      mesh.computeWorldMatrix(true);
      const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
      expect(minimumWorld.x).to.be.closeTo(3, 0.01);
      expect(maximumWorld.x).to.be.closeTo(5, 0.01);
      expect((minimumWorld.z + maximumWorld.z) / 2).to.be.closeTo(-1, 0.01);

      const [bodyPosition, bodyRotation] = flock.hk._hknp.HP_Body_GetQTransform(
        mesh.physics._pluginData.hpBodyId
      )[1];
      const origin = mesh.physics._pluginData.worldRegion?.floatingOrigin ?? { x: 0, y: 0, z: 0 };
      const absolute = mesh.getAbsolutePosition();
      expect(bodyPosition[0] + origin.x).to.be.closeTo(absolute.x, 0.01);
      expect(bodyPosition[1] + origin.y).to.be.closeTo(absolute.y, 0.01);
      expect(bodyPosition[2] + origin.z).to.be.closeTo(absolute.z, 0.01);
      const meshRotation = mesh.absoluteRotationQuaternion;
      expect(Math.abs(bodyRotation[1])).to.be.closeTo(Math.abs(meshRotation.y), 0.01);
    });

    it('should keep the block position of an object placed by its base', async function () {
      const boxId = createTestBox('test-box-pivot-block-position', { position: [2, 1, -3] });
      const mesh = flock.scene.getMeshByID(boxId);
      const before = flock.getBlockPositionFromMesh(mesh);

      await flock.setPivot(boxId, { x: 'MIN', y: 'MIN', z: 'MAX' });

      const after = flock.getBlockPositionFromMesh(mesh);
      expect(after.x).to.be.closeTo(before.x, 0.01);
      expect(after.y).to.be.closeTo(before.y, 0.01);
      expect(after.z).to.be.closeTo(before.z, 0.01);

      flock.setBlockPositionOnMesh(mesh, { x: 4, y: 0, z: 1, useY: true });
      mesh.computeWorldMatrix(true);
      const { centerWorld, minimumWorld } = mesh.getBoundingInfo().boundingBox;
      expect(centerWorld.x).to.be.closeTo(4, 0.01);
      expect(minimumWorld.y).to.be.closeTo(0, 0.01);
      expect(centerWorld.z).to.be.closeTo(1, 0.01);
    });

    for (const shapeType of ['BOX', 'SPHERE', 'CYLINDER']) {
      it(`should fit a ${shapeType.toLowerCase()} collider to a scaled, pivoted mesh`, async function () {
        const boxId = createTestBox(`test-box-pivot-${shapeType.toLowerCase()}`);

        await flock.setPhysicsShape(boxId, shapeType);
        await flock.setPivot(boxId, { x: 'MIN', y: 'MIN', z: 'MIN' });
        await flock.scale(boxId, { x: 2, y: 2, z: 2 });

        const mesh = flock.scene.getMeshByID(boxId);
        mesh.computeWorldMatrix(true);
        const meshCenter = mesh.getBoundingInfo().boundingBox.centerWorld;
        const shapeBox = flock.hk.getBoundingBox(mesh.physics.shape);
        const [bodyPosition] = flock.hk._hknp.HP_Body_GetQTransform(
          mesh.physics._pluginData.hpBodyId
        )[1];
        const origin = mesh.physics._pluginData.worldRegion?.floatingOrigin ?? {
          x: 0,
          y: 0,
          z: 0,
        };
        const shapeCenter = shapeBox.minimum.add(shapeBox.maximum).scale(0.5);
        expect(bodyPosition[0] + origin.x + shapeCenter.x).to.be.closeTo(meshCenter.x, 0.02);
        expect(bodyPosition[1] + origin.y + shapeCenter.y).to.be.closeTo(meshCenter.y, 0.02);
        expect(bodyPosition[2] + origin.z + shapeCenter.z).to.be.closeTo(meshCenter.z, 0.02);
      });
    }

    it('should fit a capsule collider to a scaled, pivoted mesh', async function () {
      const boxId = createTestBox('test-box-pivot-capsule', { width: 1, depth: 1 });

      await flock.setPivot(boxId, { x: 'CENTER', y: 'MIN', z: 'CENTER' });
      await flock.scale(boxId, { x: 2, y: 2, z: 2 });
      await flock.setPhysicsShape(boxId, 'CAPSULE');

      const mesh = flock.scene.getMeshByID(boxId);
      mesh.computeWorldMatrix(true);
      const meshBox = mesh.getBoundingInfo().boundingBox;
      const shapeBox = flock.hk.getBoundingBox(mesh.physics.shape);
      const [bodyPosition] = flock.hk._hknp.HP_Body_GetQTransform(
        mesh.physics._pluginData.hpBodyId
      )[1];
      const originY = mesh.physics._pluginData.worldRegion?.floatingOrigin?.y ?? 0;
      const bodyY = bodyPosition[1] + originY;
      expect(bodyY + shapeBox.minimum.y).to.be.closeTo(meshBox.minimumWorld.y, 0.02);
      expect(bodyY + shapeBox.maximum.y).to.be.closeTo(meshBox.maximumWorld.y, 0.02);
    });

    it('should keep a child in place when parented to a pivoted mesh', async function () {
      const parentId = createTestBox('test-box-pivoted-parent', { width: 1, height: 1, depth: 1 });
      const childId = createTestBox('test-box-pivoted-child', {
        width: 1,
        height: 1,
        depth: 1,
        position: [3, 0, 1],
      });

      await flock.setPivot(parentId, { x: 'MIN', y: 'MIN', z: 'MIN' });
      await flock.setParent(parentId, childId);

      const child = flock.scene.getMeshByID(childId);
      child.computeWorldMatrix(true);
      const center = child.getBoundingInfo().boundingBox.centerWorld;
      expect(center.x).to.be.closeTo(3, 0.01);
      expect(center.y).to.be.closeTo(0.5, 0.01);
      expect(center.z).to.be.closeTo(1, 0.01);
    });
  });
}
