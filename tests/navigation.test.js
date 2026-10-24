import { expect } from 'chai';

export function runNavigationTests(flock) {
  describe('moveToObject navigation @navigation', function () {
    const ids = [];

    afterEach(function () {
      ids.forEach((id) => flock.dispose(id));
      ids.length = 0;
    });

    async function makeBox(id, position, physics) {
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position });
      await flock.setPhysics(id, physics);
      ids.push(id);
      return flock.scene.getMeshByName(id);
    }

    async function makeScene(prefix, targetPosition, targetPhysics = 'STATIC') {
      await flock.createBox(`${prefix}Gnd`, {
        width: 100,
        height: 1,
        depth: 100,
        position: [0, -0.5, 0],
      });
      await flock.setPhysics(`${prefix}Gnd`, 'STATIC');
      ids.push(`${prefix}Gnd`);
      const mover = await makeBox(`${prefix}Mover`, [0, 0.5, 0], 'DYNAMIC');
      const target = await makeBox(`${prefix}Target`, targetPosition, targetPhysics);
      await new Promise((r) => setTimeout(r, 200));
      return { mover, target };
    }

    async function makeWall(id, size, position) {
      await flock.createBox(id, { width: size[0], height: 3, depth: size[1], position });
      await flock.setPhysics(id, 'STATIC');
      ids.push(id);
    }

    async function makeLevel(prefix, slabs, moverPosition, targetPosition) {
      for (const [i, [width, height, depth, position]] of slabs.entries()) {
        await flock.createBox(`${prefix}Slab${i}`, { width, height, depth, position });
        await flock.setPhysics(`${prefix}Slab${i}`, 'STATIC');
        ids.push(`${prefix}Slab${i}`);
      }
      const mover = await makeBox(`${prefix}Mover`, moverPosition, 'DYNAMIC');
      await makeBox(`${prefix}Target`, targetPosition, 'NONE');
      await new Promise((r) => setTimeout(r, 300));
      let lowest = mover.position.y;
      const tracking = flock.scene.onAfterPhysicsObservable.add(() => {
        lowest = Math.min(lowest, mover.position.y);
      });
      return {
        mover,
        lowest: () => {
          flock.scene.onAfterPhysicsObservable.remove(tracking);
          return lowest;
        },
      };
    }

    const basement = [60, 1, 60, [0, -20, 0]];

    it('walks round a hut to find its doorway', async function () {
      this.timeout(30000);
      await flock.createBox('mtoTGnd', { width: 60, height: 1, depth: 60, position: [0, -1, 0] });
      await flock.setPhysics('mtoTGnd', 'STATIC');
      ids.push('mtoTGnd');
      const id = flock.createObject({
        modelName: 'hut.glb',
        modelId: 'mtoTHut',
        position: { x: 0, y: 0, z: -10 },
      });
      ids.push(id);
      const hut = await flock.whenModelReady(id);
      await flock._whenHierarchySettled(hut);
      await flock.setPhysics(id, 'STATIC');
      await flock.setPhysicsShape(id, 'MESH');
      const characterId = flock.createCharacter({
        modelName: 'Block6.glb',
        modelId: 'mtoTCharacter',
        position: { x: 0, y: 0, z: 0 },
      });
      ids.push(characterId);
      const character = await flock.whenModelReady(characterId);
      await new Promise((r) => setTimeout(r, 500));
      await flock.moveToObject(characterId, id, { speed: 3 });

      const { min, max } = hut.getHierarchyBoundingVectors(true);
      expect(character.position.x).to.be.closeTo((min.x + max.x) / 2, 0.3);
      expect(character.position.z).to.be.closeTo((min.z + max.z) / 2, 0.3);
    });

    it('goes back down a wedge to reach a target below its steep side', async function () {
      this.timeout(30000);
      await flock.createBox('mtoUGnd', { width: 60, height: 1, depth: 60, position: [0, -0.5, 0] });
      await flock.setPhysics('mtoUGnd', 'STATIC');
      ids.push('mtoUGnd');
      await flock.createWedge('mtoUWedge', {
        width: 8,
        height: 3,
        depth: 4,
        position: [0, 0.5, 0],
      });
      await flock.setPhysics('mtoUWedge', 'STATIC');
      ids.push('mtoUWedge');
      const wedge = flock.scene.getMeshByName('mtoUWedge');
      const matrix = wedge.computeWorldMatrix(true);
      const data = wedge.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
      const points = [];
      for (let i = 0; i < data.length; i += 3) {
        points.push(
          flock.BABYLON.Vector3.TransformCoordinates(
            new flock.BABYLON.Vector3(data[i], data[i + 1], data[i + 2]),
            matrix
          )
        );
      }
      const top = Math.max(...points.map((p) => p.y));
      const bottom = Math.min(...points.map((p) => p.y));
      const peaks = points.filter((p) => p.y > top - 0.01);
      const highX = peaks.reduce((sum, p) => sum + p.x, 0) / peaks.length;
      const lowX = points.reduce(
        (far, p) => (Math.abs(p.x - highX) > Math.abs(far - highX) ? p.x : far),
        highX
      );
      const uphill = Math.sign(highX - lowX);
      const length = Math.abs(highX - lowX);
      const startX = highX - uphill * 1.5;
      const surface = bottom + (top - bottom) * (1 - 1.5 / length);

      const mover = await makeBox('mtoUMover', [startX, surface + 0.3, 0], 'DYNAMIC');
      await makeBox('mtoUTarget', [highX + uphill * 3, 0.5, 0], 'NONE');
      await new Promise((r) => setTimeout(r, 500));
      expect(mover.position.y).to.be.above(bottom + 1.5);
      const middleX = (highX + lowX) / 2;
      let fastestFall = 0;
      let reachedGroundAt = null;
      const tracking = flock.scene.onAfterPhysicsObservable.add(() => {
        fastestFall = Math.min(fastestFall, mover.physics.getLinearVelocity().y);
        if (reachedGroundAt === null && mover.position.y < bottom + 0.75) {
          reachedGroundAt = (mover.position.x - middleX) * uphill;
        }
      });
      await flock.moveToObject('mtoUMover', 'mtoUTarget', { speed: 4 });
      flock.scene.onAfterPhysicsObservable.remove(tracking);

      expect(mover.position.x).to.be.closeTo(highX + uphill * 3, 0.15);
      expect(mover.position.z).to.be.closeTo(0, 0.15);
      expect(fastestFall).to.be.above(-3);
      expect(reachedGroundAt).to.be.below(0);
    });

    it('walks round a hole instead of falling in', async function () {
      this.timeout(15000);
      const { mover, lowest } = await makeLevel(
        'mtoP',
        [
          basement,
          [13, 1, 20, [-3.5, -0.5, 0]],
          [10, 1, 20, [12, -0.5, 0]],
          [4, 1, 8, [5, -0.5, 6]],
          [4, 1, 8, [5, -0.5, -6]],
        ],
        [0, 0.5, 0],
        [10, 0.5, 0]
      );
      await flock.moveToObject('mtoPMover', 'mtoPTarget', { speed: 4 });

      expect(lowest()).to.be.above(0);
      expect(mover.position.x).to.be.closeTo(10, 0.15);
      expect(mover.position.z).to.be.closeTo(0, 0.15);
    });

    it('stays on a high platform when the target is below', async function () {
      this.timeout(15000);
      const { mover, lowest } = await makeLevel(
        'mtoQ',
        [basement, [40, 1, 40, [0, -0.5, 0]], [6, 2, 6, [0, 0.5, 0]]],
        [0, 2.5, 0],
        [8, 0.5, 0]
      );
      await flock.moveToObject('mtoQMover', 'mtoQTarget', { speed: 4 });

      expect(lowest()).to.be.above(2);
      const v = mover.physics.getLinearVelocity();
      expect(Math.hypot(v.x, v.z)).to.be.below(0.5);
    });

    it('steps down a small drop', async function () {
      this.timeout(10000);
      const { mover } = await makeLevel(
        'mtoR',
        [
          [40, 1, 40, [0, -0.5, 0]],
          [4, 0.6, 4, [0, 0.5, 0]],
        ],
        [0, 1.1, 0],
        [6, 0.5, 0]
      );
      await flock.moveToObject('mtoRMover', 'mtoRTarget', { speed: 4 });

      expect(mover.position.x).to.be.closeTo(6, 0.15);
      expect(mover.position.y).to.be.below(1);
    });

    it('walks down a steep ramp', async function () {
      this.timeout(15000);
      const { mover, lowest } = await makeLevel(
        'mtoS',
        [basement, [40, 1, 40, [10, -0.5, 0]], [8, 3, 8, [-6, 0.5, 0]]],
        [-6, 3.5, 0],
        [8, 0.5, 0]
      );
      const angle = 60;
      const run = 3 / Math.tan((angle * Math.PI) / 180);
      const length = Math.hypot(3, run) + 0.3;
      const normal = { x: Math.sin((angle * Math.PI) / 180), y: Math.cos((angle * Math.PI) / 180) };
      const slant = { x: Math.cos((angle * Math.PI) / 180), y: -Math.sin((angle * Math.PI) / 180) };
      const centre = [
        -2 + run / 2 + 0.15 * slant.x - 0.1 * normal.x,
        2 + 0.15 * slant.y - 0.1 * normal.y,
      ];
      await flock.createBox('mtoSRamp', {
        width: length,
        height: 0.2,
        depth: 4,
        position: [centre[0], centre[1] - 0.1, 0],
      });
      await flock.setPhysics('mtoSRamp', 'STATIC');
      ids.push('mtoSRamp');
      const ramp = flock.scene.getMeshByName('mtoSRamp');
      await flock.rotateTo('mtoSRamp', { z: angle });
      const downhill = () =>
        flock.BABYLON.Vector3.TransformNormal(flock.BABYLON.Axis.X, ramp.computeWorldMatrix(true))
          .y;
      if (downhill() > 0) await flock.rotateTo('mtoSRamp', { z: -angle });
      expect(downhill()).to.be.below(0);
      expect(ramp.position.x).to.be.closeTo(centre[0], 0.01);
      expect(ramp.position.y).to.be.closeTo(centre[1], 0.01);
      await new Promise((r) => setTimeout(r, 200));

      await flock.moveToObject('mtoSMover', 'mtoSTarget', { speed: 4 });

      expect(lowest()).to.be.above(0);
      expect(mover.position.x).to.be.closeTo(8, 0.15);
    });

    it('goes round a wall in the way', async function () {
      this.timeout(10000);
      const { mover } = await makeScene('mtoF', [10, 0.5, 0]);
      await makeWall('mtoFWall', [1, 6], [4, 0, 0]);
      await flock.moveToObject('mtoFMover', 'mtoFTarget', { speed: 4 });

      expect(Math.hypot(mover.position.x - 10, mover.position.z)).to.be.within(0.9, 2);
    });

    it('gives up when the target is walled in', async function () {
      this.timeout(15000);
      const { mover } = await makeScene('mtoN', [8, 0.5, 0], 'NONE');
      await makeWall('mtoNWest', [0.5, 4], [6, 0, 0]);
      await makeWall('mtoNEast', [0.5, 4], [10, 0, 0]);
      await makeWall('mtoNNorth', [4.5, 0.5], [8, 0, -2]);
      await makeWall('mtoNSouth', [4.5, 0.5], [8, 0, 2]);
      await flock.moveToObject('mtoNMover', 'mtoNTarget', { speed: 4 });

      expect(Math.hypot(mover.position.x - 8, mover.position.z)).to.be.above(2);
      const v = mover.physics.getLinearVelocity();
      expect(Math.hypot(v.x, v.z)).to.be.below(0.5);
    });

    it('pushes a dynamic object out of the way', async function () {
      this.timeout(10000);
      const { mover } = await makeScene('mtoO', [8, 0.5, 0], 'NONE');
      const crate = await makeBox('mtoOCrate', [4, 0.5, 0], 'DYNAMIC');
      await flock.moveToObject('mtoOMover', 'mtoOTarget', { speed: 4 });

      expect(crate.position.x).to.be.above(5);
      expect(mover.position.z).to.be.closeTo(0, 0.3);
    });
  });
}
