import { expect } from 'chai';

export function runFlipTests(flock) {
  describe('Flip function tests @flip', function () {
    const testBoxIds = [];

    // Set up the scene before each test
    beforeEach(async function () {
      flock.scene ??= {};
    });

    // Clean up after each test. flock.dispose defers through
    // whenModelReady, so await each call, children before parents, to avoid
    // running dispose against an already-disposed mesh.
    afterEach(async function () {
      for (const boxId of [...testBoxIds].reverse()) {
        if (typeof boxId !== 'string') {
          throw new Error(`Invalid ID: Expected a string, but got ${typeof boxId}`);
        }
        console.log(`Cleaning up box with ID: ${boxId}`);
        await flock.dispose(boxId);
      }
      testBoxIds.length = 0;
    });

    it('should negate x scaling while leaving y and z alone', async function () {
      const boxId = flock.createBox('test-flip-x', {
        color: '#FF0000',
        width: 2,
        height: 2,
        depth: 2,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.flip(boxId, 'x');

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.x).to.equal(-1);
      expect(mesh.scaling.y).to.equal(1);
      expect(mesh.scaling.z).to.equal(1);
    });

    it('should toggle back on a second flip', async function () {
      const boxId = flock.createBox('test-flip-toggle', {
        color: '#00FF00',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.flip(boxId, 'x');
      await flock.flip(boxId, 'x');

      const mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.x).to.equal(1);
    });

    it('should flip y and z axes', async function () {
      const boxId = flock.createBox('test-flip-yz', {
        color: '#0000FF',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      await flock.flip(boxId, 'y');
      let mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.y).to.equal(-1);

      await flock.flip(boxId, 'z');
      mesh = flock.scene.getMeshByID(boxId);
      expect(mesh.scaling.z).to.equal(-1);
    });

    it('should flip a wedge in local space', async function () {
      const wedgeId = flock.createWedge('test-flip-wedge', {
        color: '#9932CC',
        width: 2,
        height: 1,
        depth: 1,
        peak: 0,
        axis: 'X',
        position: [0, 0, 0],
      });
      testBoxIds.push(wedgeId);

      await flock.flip(wedgeId, 'x');

      const mesh = flock.scene.getMeshByID(wedgeId);
      expect(mesh.scaling.x).to.equal(-1);
    });

    it('should mirror children when flipping a group', async function () {
      const boxA = flock.createBox('test-flip-child-a', {
        color: '#FFFF00',
        width: 1,
        height: 1,
        depth: 1,
        position: [1, 0, 0],
      });
      const boxB = flock.createBox('test-flip-child-b', {
        color: '#00FFFF',
        width: 1,
        height: 1,
        depth: 1,
        position: [3, 0, 0],
      });
      const groupId = flock.createGroup('test-flip-group');
      // Pushed last so cleanup disposes the children before the group.
      testBoxIds.push(boxA);
      testBoxIds.push(boxB);
      testBoxIds.push(groupId);
      await flock.setParent(groupId, [boxA, boxB]);

      await flock.flip(groupId, 'x');

      const group = flock.scene.getMeshByID(groupId);
      expect(group.scaling.x).to.equal(-1);
      // Group origin sits between the children, so they swap sides.
      expect(flock.scene.getMeshByID(boxA).getAbsolutePosition().x).to.be.closeTo(3, 0.001);
      expect(flock.scene.getMeshByID(boxB).getAbsolutePosition().x).to.be.closeTo(1, 0.001);
    });

    it('should no-op on meshes with a skeleton', async function () {
      const boxId = flock.createBox('test-flip-skeleton', {
        color: '#FF00FF',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      testBoxIds.push(boxId);

      const mesh = flock.scene.getMeshByID(boxId);
      mesh.skeleton = { bones: [] };
      try {
        await flock.flip(boxId, 'x');
        expect(mesh.scaling.x).to.equal(1);
      } finally {
        mesh.skeleton = null;
      }
    });
  });
}
