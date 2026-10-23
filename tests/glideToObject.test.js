import { expect } from 'chai';

export function runGlideToObjectTests(flock) {
  describe('glideToObject function tests @slow', function () {
    let box1;
    let box2;

    beforeEach(function () {
      box1 = flock.createBox('box1', {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
    });

    afterEach(function () {
      flock.dispose(box1);
      if (box2) {
        flock.dispose(box2);
        box2 = undefined;
      }
    });

    it('should glide to another object with default offsets', async function () {
      this.timeout(5000);

      const sourceId = box1; // assuming box1 is a name set in beforeEach
      const targetId = 'box2';

      flock.createBox(targetId, {
        width: 2,
        height: 2,
        depth: 2,
        position: [3, 2, 1],
      });

      await flock.glideToObject(sourceId, targetId, { duration: 0.2 });

      const targetMesh = flock.scene.getMeshByName(targetId);
      const movedMesh = flock.scene.getMeshByName(sourceId);

      const expected = flock._getAnchor(targetMesh);
      const actual = flock._getAnchor(movedMesh);

      const EPS = 0.1;
      expect(actual.x).to.be.closeTo(expected.x, EPS);
      expect(actual.y).to.be.closeTo(expected.y, EPS);
      expect(actual.z).to.be.closeTo(expected.z, EPS);
    });

    it('should apply x/y/z offsets when gliding to another object', async function () {
      this.timeout(5000);

      const sourceId = box1; // assuming box1 is the name set in beforeEach
      const targetId = 'box2';

      flock.createBox(targetId, {
        width: 1,
        height: 1,
        depth: 1,
        position: [1, 1, 1],
      });

      const offsets = { offsetX: 0.5, offsetY: -1, offsetZ: 2 };

      await flock.glideToObject(sourceId, targetId, {
        ...offsets,
        duration: 0.2,
      });

      const targetMesh = flock.scene.getMeshByName(targetId);
      const targetAnchor = flock._getAnchor(targetMesh);

      const expected = {
        x: targetAnchor.x + offsets.offsetX,
        y: targetAnchor.y + offsets.offsetY,
        z: targetAnchor.z + offsets.offsetZ,
      };

      const movedMesh = flock.scene.getMeshByName(sourceId);
      const actual = flock._getAnchor(movedMesh);

      const EPS = 0.1;
      expect(actual.x).to.be.closeTo(expected.x, EPS);
      expect(actual.y).to.be.closeTo(expected.y, EPS);
      expect(actual.z).to.be.closeTo(expected.z, EPS);
    });

    it('should align pivots between different shapes using defaults', async function () {
      this.timeout(5000);

      const sourceId = box1; // created in beforeEach
      const targetId = 'targetSphere';

      flock.createSphere(targetId, {
        diameterX: 1.5,
        diameterY: 2,
        diameterZ: 1,
        position: [2, 1, -1],
      });

      await flock.glideToObject(sourceId, targetId, { duration: 0.3 });

      const movedMesh = flock.scene.getMeshByName(sourceId);
      const targetMesh = flock.scene.getMeshByName(targetId);

      const movedAnchor = flock._getAnchor(movedMesh);
      const targetAnchor = flock._getAnchor(targetMesh);

      const EPS = 0.1;
      expect(movedAnchor.x).to.be.closeTo(targetAnchor.x, EPS);
      expect(movedAnchor.y).to.be.closeTo(targetAnchor.y, EPS);
      expect(movedAnchor.z).to.be.closeTo(targetAnchor.z, EPS);
    });

    it('should respect custom pivot settings when gliding to another shape', async function () {
      this.timeout(7000);

      // Helper to wait for the next frame and ensure properties are updated
      async function tick() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        flock.scene.render();
      }

      const sourceId = box1; // created in beforeEach
      const targetId = 'targetCylinder';

      // Custom anchor for source box
      flock.setAnchor(sourceId, {
        x: 'MAX',
        y: 'MAX',
        z: 'CENTER',
      });

      // Create target cylinder
      flock.createCylinder(targetId, {
        diameterTop: 1,
        diameterBottom: 1.2,
        height: 3,
        position: [-2, 1.5, 0.5],
      });

      // Custom anchor for target cylinder
      flock.setAnchor(targetId, {
        x: 'MIN',
        y: 'CENTER',
        z: 'MAX',
      });

      // Wait for physics impostors to update with new pivot info
      await tick();

      await flock.glideToObject(sourceId, targetId, { duration: 0.4 });

      const movedMesh = flock.scene.getMeshByName(sourceId);
      const targetMesh = flock.scene.getMeshByName(targetId);

      const movedAnchor = flock._getAnchor(movedMesh);
      const targetAnchor = flock._getAnchor(targetMesh);

      const EPS = 0.1;
      expect(movedAnchor.x).to.be.closeTo(targetAnchor.x, EPS);
      expect(movedAnchor.y).to.be.closeTo(targetAnchor.y, EPS);
      expect(movedAnchor.z).to.be.closeTo(targetAnchor.z, EPS);
    });

    it('should treat offsets as local-space by default', async function () {
      this.timeout(7000);

      const BABYLON = flock.BABYLON;
      const sourceId = box1;
      const targetId = 'rotatedTargetLocal';

      // Create a target and rotate it so local != world axes
      box2 = flock.createBox(targetId, {
        width: 1,
        height: 1,
        depth: 1,
        position: [2, 0, 0],
      });

      const targetMesh = flock.scene.getMeshByName(targetId);
      targetMesh.rotation.y = Math.PI / 2; // 90 degrees around Y

      const offsets = { offsetX: 1, offsetY: 0, offsetZ: 0 };

      // Default behaviour: offset is interpreted in the target's LOCAL space
      await flock.glideToObject(sourceId, targetId, {
        ...offsets,
        duration: 0.3,
      });

      targetMesh.computeWorldMatrix(true);

      const targetAnchor = flock._getAnchor(targetMesh);
      const localOffset = new BABYLON.Vector3(offsets.offsetX, offsets.offsetY, offsets.offsetZ);
      const worldOffset = BABYLON.Vector3.TransformNormal(localOffset, targetMesh.getWorldMatrix());

      const expected = {
        x: targetAnchor.x + worldOffset.x,
        y: targetAnchor.y + worldOffset.y,
        z: targetAnchor.z + worldOffset.z,
      };

      const movedMesh = flock.scene.getMeshByName(sourceId);
      const actual = flock._getAnchor(movedMesh);

      const EPS = 0.1;
      expect(actual.x).to.be.closeTo(expected.x, EPS);
      expect(actual.y).to.be.closeTo(expected.y, EPS);
      expect(actual.z).to.be.closeTo(expected.z, EPS);
    });

    it("should support world-space offsets when offsetSpace is 'world'", async function () {
      this.timeout(7000);

      const sourceId = box1;
      const targetId = 'rotatedTargetWorld';

      // Helper to wait for the next frame and ensure properties are updated
      async function tick() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        flock.scene.render();
      }

      box2 = flock.createBox(targetId, {
        width: 1,
        height: 1,
        depth: 1,
        position: [2, 0, 0],
      });
      await tick();
      const targetMesh = flock.scene.getMeshByName(targetId);
      flock.rotate(targetId, { y: 90 }); // Rotate 90 degrees around Y

      const offsets = { offsetX: 1, offsetY: 0.5, offsetZ: -0.25 };

      await flock.glideToObject(sourceId, targetId, {
        ...offsets,
        offsetSpace: 'world',
        duration: 0.3,
      });
      await tick();

      const targetAnchor = flock._getAnchor(targetMesh);
      const expected = {
        x: targetAnchor.x + offsets.offsetX,
        y: targetAnchor.y + offsets.offsetY,
        z: targetAnchor.z + offsets.offsetZ,
      };

      const movedMesh = flock.scene.getMeshByName(sourceId);
      const actual = flock._getAnchor(movedMesh);

      const EPS = 0.1;
      expect(actual.x).to.be.closeTo(expected.x, EPS);
      expect(actual.y).to.be.closeTo(expected.y, EPS);
      expect(actual.z).to.be.closeTo(expected.z, EPS);
    });

    it('should glide on top of another object, then apply the offset', async function () {
      this.timeout(5000);

      const targetId = 'sideTarget';
      box2 = flock.createBox(targetId, {
        width: 2,
        height: 3,
        depth: 2,
        position: [4, 0, -2],
      });
      // The offset is in the target's units before scaling.
      flock.scene.getMeshByName(targetId).scaling.set(2, 2, 2);

      await flock.glideToObject(box1, targetId, { side: 'on_top', offsetX: 0.5, duration: 0.2 });

      const mover = flock.scene.getMeshByName(box1).getBoundingInfo().boundingBox;
      const target = flock.scene.getMeshByName(targetId).getBoundingInfo().boundingBox;
      const EPS = 0.1;
      expect(mover.minimumWorld.y).to.be.closeTo(target.maximumWorld.y, EPS);
      expect(mover.centerWorld.x).to.be.closeTo(target.centerWorld.x + 0.5, EPS);
      expect(mover.centerWorld.z).to.be.closeTo(target.centerWorld.z, EPS);
    });

    it('should leave a gap out from the chosen side of a rotated object', async function () {
      this.timeout(5000);

      const targetId = 'gapSideTarget';
      box2 = flock.createBox(targetId, { width: 2, height: 2, depth: 2, position: [4, 0, 0] });
      await flock.rotate(targetId, { y: 90 });

      await flock.glideToObject(box1, targetId, { side: 'front', gap: 1.5, duration: 0.2 });

      const mover = flock.scene.getMeshByName(box1).getBoundingInfo().boundingBox;
      const target = flock.scene.getMeshByName(targetId).getBoundingInfo().boundingBox;
      const EPS = 0.1;
      expect(mover.maximumWorld.x).to.be.closeTo(target.minimumWorld.x - 1.5, EPS);
      expect(mover.minimumWorld.y).to.be.closeTo(target.minimumWorld.y, EPS);
      expect(mover.centerWorld.z).to.be.closeTo(target.centerWorld.z, EPS);
    });

    it('should rest against the front of a tipped-over object', async function () {
      this.timeout(5000);

      const { Vector3 } = flock.BABYLON;
      const targetId = 'tippedTarget';
      box2 = flock.createBox(targetId, { width: 2, height: 2, depth: 2, position: [4, 0, 0] });
      await flock.rotate(targetId, { x: 90 });

      await flock.glideToObject(box1, targetId, { side: 'front', duration: 0.2 });

      const targetMesh = flock.scene.getMeshByName(targetId);
      const front = Vector3.TransformNormal(
        new Vector3(0, 0, -1),
        targetMesh.computeWorldMatrix(true)
      ).normalize();
      const mover = flock.scene.getMeshByName(box1).getBoundingInfo().boundingBox;
      const target = targetMesh.getBoundingInfo().boundingBox;
      const apart = Vector3.Dot(mover.centerWorld.subtract(target.centerWorld), front);
      expect(apart).to.be.closeTo(1.5, 0.1);
    });

    it('should glide near an object until the boxes touch, staying level', async function () {
      this.timeout(5000);

      const targetId = 'nearTarget';
      box2 = flock.createBox(targetId, { width: 2, height: 4, depth: 2, position: [6, 0, 0] });

      await flock.glideToObject(box1, targetId, { side: 'near', duration: 0.2 });

      const mover = flock.scene.getMeshByName(box1).getBoundingInfo().boundingBox;
      const target = flock.scene.getMeshByName(targetId).getBoundingInfo().boundingBox;
      const EPS = 0.1;
      expect(mover.maximumWorld.x).to.be.closeTo(target.minimumWorld.x, EPS);
      expect(mover.minimumWorld.y).to.be.closeTo(target.minimumWorld.y, EPS);
      expect(mover.centerWorld.z).to.be.closeTo(0, EPS);
    });

    it('should approach along its own line and leave a gap when gliding near', async function () {
      this.timeout(5000);

      const targetId = 'nearGapTarget';
      box2 = flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [0, 0, -5] });

      await flock.glideToObject(box1, targetId, { side: 'near', gap: 2, duration: 0.2 });

      const mover = flock.scene.getMeshByName(box1).getBoundingInfo().boundingBox;
      const target = flock.scene.getMeshByName(targetId).getBoundingInfo().boundingBox;
      const EPS = 0.1;
      expect(mover.minimumWorld.z).to.be.closeTo(target.maximumWorld.z + 2, EPS);
      expect(mover.centerWorld.x).to.be.closeTo(0, EPS);
    });

    it('should stop a gap short of the object along the line of travel', async function () {
      this.timeout(5000);

      const targetId = 'gapToTarget';
      box2 = flock.createBox(targetId, { width: 1, height: 1, depth: 1, position: [3, 0, 4] });
      const start = flock._getAnchor(flock.scene.getMeshByName(box1));
      const goal = flock._getAnchor(flock.scene.getMeshByName(targetId));

      await flock.glideToObject(box1, targetId, { gap: 2, duration: 0.2 });

      const actual = flock._getAnchor(flock.scene.getMeshByName(box1));
      const EPS = 0.1;
      expect(actual.x).to.be.closeTo(goal.x - (2 * (goal.x - start.x)) / 5, EPS);
      expect(actual.y).to.be.closeTo(goal.y, EPS);
      expect(actual.z).to.be.closeTo(goal.z - (2 * (goal.z - start.z)) / 5, EPS);
    });
  });
}
