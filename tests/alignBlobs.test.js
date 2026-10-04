import { expect } from 'chai';
import {
  getAlignMarkers,
  getAlignedBlockPosition,
  getSurfaceBlockPosition,
  getAlignParts,
} from '../ui/alignBlobs.js';
import { SELECTED_HIDDEN_VISIBILITY } from '../ui/meshhelpers.js';

export function runAlignBlobsTests(flock) {
  describe('ui/alignBlobs @alignblobs', function () {
    const created = [];

    afterEach(async function () {
      for (const id of [...created].reverse()) {
        if (flock.scene.getMeshByName(id)) await flock.dispose(id);
      }
      created.length = 0;
    });

    function box(id, position, size = [2, 1, 1]) {
      const [width, height, depth] = size;
      const boxId = flock.createBox(id, { color: '#FF0000', width, height, depth, position });
      created.push(boxId);
      return flock.scene.getMeshByName(boxId);
    }

    function bounds(mesh) {
      mesh.computeWorldMatrix(true);
      return mesh.getHierarchyBoundingVectors(true);
    }

    const near = (v, x, y, z) =>
      Math.abs(v.x - x) < 1e-6 && Math.abs(v.y - y) < 1e-6 && Math.abs(v.z - z) < 1e-6;

    function faceWithNormal(mesh, x, y, z) {
      return getAlignMarkers(mesh).find(
        ({ normal, isCentre }) => isCentre && near(normal, x, y, z)
      );
    }

    function markerAtPoint(mesh, normal, point) {
      return getAlignMarkers(mesh).find(
        (m) => near(m.normal, ...normal) && near(m.point, ...point)
      );
    }

    async function placeAgainst(mover, face) {
      await flock.positionAt(mover.name, getAlignedBlockPosition(mover, face));
      return bounds(mover);
    }

    it('returns a centre, four edge and four corner markers per face', function () {
      const target = box('align-faces', [1, 0, 2]);
      const markers = getAlignMarkers(target);
      expect(markers).to.have.length(54);
      expect(markers.filter((m) => m.isCentre)).to.have.length(6);
      const right = faceWithNormal(target, 1, 0, 0);
      expect(right.point.x).to.be.closeTo(2, 1e-3);
      expect(right.point.y).to.be.closeTo(0.5, 1e-3);
      expect(right.point.z).to.be.closeTo(2, 1e-3);
    });

    it('places the mover flush against a side face, centred on it', async function () {
      const target = box('align-target-side', [0, 0, 0]);
      const mover = box('align-mover-side', [5, 3, 5], [1, 2, 1]);

      const moved = await placeAgainst(mover, faceWithNormal(target, 1, 0, 0));
      const fixed = bounds(target);

      expect(moved.min.x).to.be.closeTo(fixed.max.x, 1e-3);
      expect((moved.min.y + moved.max.y) / 2).to.be.closeTo((fixed.min.y + fixed.max.y) / 2, 1e-3);
      expect((moved.min.z + moved.max.z) / 2).to.be.closeTo((fixed.min.z + fixed.max.z) / 2, 1e-3);
    });

    it('places the mover on top of a top face', async function () {
      const target = box('align-target-top', [0, 0, 0]);
      const mover = box('align-mover-top', [5, 3, 5], [1, 1, 1]);

      const moved = await placeAgainst(mover, faceWithNormal(target, 0, 1, 0));

      expect(moved.min.y).to.be.closeTo(bounds(target).max.y, 1e-3);
      expect((moved.min.x + moved.max.x) / 2).to.be.closeTo(0, 1e-3);
    });

    it('lines up with an edge of the face', async function () {
      const target = box('align-target-edge', [0, 0, 0]);
      const mover = box('align-mover-edge', [5, 3, 5], [1, 1, 0.5]);

      const moved = await placeAgainst(mover, markerAtPoint(target, [0, 1, 0], [1, 1, 0]));
      const fixed = bounds(target);

      expect(moved.min.y).to.be.closeTo(fixed.max.y, 1e-3);
      expect(moved.max.x).to.be.closeTo(fixed.max.x, 1e-3);
      expect((moved.min.z + moved.max.z) / 2).to.be.closeTo(0, 1e-3);
    });

    it('lines up with a corner of the face', async function () {
      const target = box('align-target-corner', [0, 0, 0]);
      const mover = box('align-mover-corner', [5, 3, 5], [0.5, 0.5, 0.5]);

      const moved = await placeAgainst(mover, markerAtPoint(target, [1, 0, 0], [1, 1, -0.5]));
      const fixed = bounds(target);

      expect(moved.min.x).to.be.closeTo(fixed.max.x, 1e-3);
      expect(moved.max.y).to.be.closeTo(fixed.max.y, 1e-3);
      expect(moved.min.z).to.be.closeTo(fixed.min.z, 1e-3);
    });

    it('uses the rotated faces of a rotated target', async function () {
      const target = box('align-target-rot', [0, 0, 0]);
      await flock.rotateTo(target.name, { x: 0, y: 90, z: 0 });
      const mover = box('align-mover-rot', [5, 3, 5], [1, 1, 1]);

      const face = getAlignMarkers(target).find(
        ({ normal, isCentre }) => isCentre && normal.z > 0.99
      );
      expect(face.point.z).to.be.closeTo(1, 1e-3);

      const moved = await placeAgainst(mover, face);
      expect(moved.min.z).to.be.closeTo(1, 1e-3);
      expect((moved.min.x + moved.max.x) / 2).to.be.closeTo(0, 1e-3);
    });

    async function placeOnSurface(mover, point, normal) {
      const { Vector3 } = flock.BABYLON;
      const position = getSurfaceBlockPosition(
        mover,
        new Vector3(...point),
        new Vector3(...normal)
      );
      await flock.positionAt(mover.name, position);
      return bounds(mover);
    }

    it('places the mover against a wall at the picked point', async function () {
      const mover = box('align-mover-wall', [5, 3, 5], [1, 1, 1]);

      const moved = await placeOnSurface(mover, [2, 1.5, 0.25], [-1, 0, 0]);

      expect(moved.max.x).to.be.closeTo(2, 1e-3);
      expect((moved.min.y + moved.max.y) / 2).to.be.closeTo(1.5, 1e-3);
      expect((moved.min.z + moved.max.z) / 2).to.be.closeTo(0.25, 1e-3);
    });

    it('places the mover on a floor at the picked point', async function () {
      const mover = box('align-mover-floor', [5, 3, 5], [1, 2, 1]);

      const moved = await placeOnSurface(mover, [1, 0.5, 2], [0, 1, 0]);

      expect(moved.min.y).to.be.closeTo(0.5, 1e-3);
      expect((moved.min.x + moved.max.x) / 2).to.be.closeTo(1, 1e-3);
      expect((moved.min.z + moved.max.z) / 2).to.be.closeTo(2, 1e-3);
    });

    it('rests a tilted mover on its lowest geometry, centred on its facing end', async function () {
      const mover = box('align-mover-tilted', [5, 3, 5], [2, 1, 1]);
      await flock.rotateTo(mover.name, { x: 0, y: 0, z: 30 });

      await placeOnSurface(mover, [1, 0.5, 2], [0, 1, 0]);
      const centre = baseCentre(mover);

      expect(worldRange(mover, 'y').min).to.be.closeTo(0.5, 1e-3);
      expect(centre.x).to.be.closeTo(1, 1e-3);
      expect(centre.z).to.be.closeTo(2, 1e-3);
    });

    function worldRange(mesh, axis) {
      const { Vector3, VertexBuffer } = flock.BABYLON;
      const world = mesh.computeWorldMatrix(true);
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
      const values = [];
      for (let i = 0; i < positions.length; i += 3) {
        values.push(Vector3.TransformCoordinates(Vector3.FromArray(positions, i), world)[axis]);
      }
      return { min: Math.min(...values), max: Math.max(...values) };
    }

    it('lines up the geometry of a tilted mover, not its box corner, with an edge', async function () {
      const target = box('align-target-tilt-edge', [0, 0, 0], [2, 2, 2]);
      const moverId = flock.createCylinder('align-mover-tilt-edge', {
        diameterTop: 0.2,
        diameterBottom: 1,
        height: 3,
        position: [5, 3, 5],
      });
      created.push(moverId);
      const mover = flock.scene.getMeshByName(moverId);
      await flock.rotateTo(mover.name, { x: 0, y: 0, z: -70 });

      await placeAgainst(mover, markerAtPoint(target, [1, 0, 0], [1, 0, 0]));
      const fixed = bounds(target);

      expect(worldRange(mover, 'x').min).to.be.closeTo(fixed.max.x, 1e-3);
      expect(worldRange(mover, 'y').min).to.be.closeTo(fixed.min.y, 1e-3);
    });

    it('ignores the hidden root box of a selected model', async function () {
      this.timeout(20000);
      const target = box('align-target-model', [0, 0, 0], [2, 2, 2]);
      const id = flock.createObject({
        modelName: 'tree.glb',
        modelId: 'align-mover-model',
        position: { x: 5, y: 3, z: 5 },
      });
      created.push(id);
      const tree = await flock.whenModelReady(id);
      await flock._whenHierarchySettled(tree);
      await flock.rotateTo(tree.name, { x: 0, y: 0, z: -70 });
      tree.visibility = SELECTED_HIDDEN_VISIBILITY;

      await placeAgainst(tree, faceWithNormal(target, 1, 0, 0));
      const geometry = tree.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0);

      expect(geometry).to.not.be.empty;
      expect(Math.min(...geometry.map((m) => worldRange(m, 'x').min))).to.be.closeTo(
        bounds(target).max.x,
        1e-3
      );
    });

    function cone(id, rotation) {
      const coneId = flock.createCylinder(id, {
        diameterTop: 0,
        diameterBottom: 0.5,
        height: 1.4,
        position: [5, 3, 5],
      });
      created.push(coneId);
      const mesh = flock.scene.getMeshByName(coneId);
      return flock.rotateTo(coneId, rotation).then(() => mesh);
    }

    function baseCentre(mesh) {
      const { Vector3 } = flock.BABYLON;
      const box = mesh.getBoundingInfo().boundingBox;
      const local = new Vector3(box.center.x, box.minimum.y, box.center.z);
      return Vector3.TransformCoordinates(local, mesh.computeWorldMatrix(true));
    }

    it('centres the facing end of a nearly square mover on a centre dot', async function () {
      const sphereId = flock.createSphere('align-head', {
        color: '#ffffff',
        diameterX: 2.7,
        diameterY: 2.7,
        diameterZ: 2.7,
        position: [1.8, 5, 4.4],
      });
      created.push(sphereId);
      const face = faceWithNormal(flock.scene.getMeshByName(sphereId), 0, 0, -1);
      const nose = await cone('align-nose', { x: -88.3, y: 0, z: 0 });

      await placeAgainst(nose, face);
      const centre = baseCentre(nose);

      expect(centre.x).to.be.closeTo(face.point.x, 1e-3);
      expect(centre.y).to.be.closeTo(face.point.y, 1e-3);
      expect(worldRange(nose, 'z').max).to.be.closeTo(face.point.z, 1e-3);
    });

    it('centres the facing end on a picked point of a sloping surface', async function () {
      const { Vector3 } = flock.BABYLON;
      const nose = await cone('align-nose-slope', { x: -90, y: 0, z: 0 });
      const normal = new Vector3(0, 0.5, -Math.sqrt(3) / 2);

      await placeOnSurface(nose, [1, 2, 3], [normal.x, normal.y, normal.z]);
      const offset = baseCentre(nose).subtract(new Vector3(1, 2, 3));

      expect(Vector3.Cross(offset, normal).length()).to.be.closeTo(0, 1e-3);
      expect(Vector3.Dot(offset, normal)).to.be.greaterThan(0);
    });

    it('hangs the mover from a ceiling at the picked point', async function () {
      const mover = box('align-mover-ceiling', [5, 3, 5], [1, 1, 1]);

      const moved = await placeOnSurface(mover, [0, 3, 0], [0, -1, 0]);

      expect(moved.max.y).to.be.closeTo(3, 1e-3);
    });

    describe('marked parts of a model', function () {
      let room = null;

      afterEach(function () {
        room?.dispose();
        room = null;
      });

      function buildRoom() {
        const { MeshBuilder, Mesh, BoundingInfo, Vector3 } = flock.BABYLON;
        const scene = flock.scene;
        room = new Mesh('align-room', scene);
        const parts = [
          { name: 'align_floor', width: 3.6, height: 0.2, depth: 3.6, at: [0, 0.1, 0] },
          { name: 'align_wall_left', width: 0.2, height: 3, depth: 4, at: [-1.9, 1.5, 0] },
          { name: 'trim', width: 0.2, height: 3, depth: 4, at: [1.9, 1.5, 0] },
        ];
        parts.forEach(({ name, at, ...size }) => {
          const part = MeshBuilder.CreateBox(name, size, scene);
          part.position = new Vector3(...at);
          part.parent = room;
        });
        room.setBoundingInfo(new BoundingInfo(new Vector3(-2, 0, -2), new Vector3(2, 3, 2)));
        return room;
      }

      const partNamed = (name) => getAlignParts(room).find((part) => part.name === name);

      it('only finds parts named align_', function () {
        const names = getAlignParts(buildRoom()).map((part) => part.name);
        expect(names).to.have.members(['align_floor', 'align_wall_left']);
      });

      it('places the mover in a corner of a marked floor', async function () {
        buildRoom();
        const mover = box('align-mover-room', [5, 3, 5], [1, 1, 1]);
        const corner = markerAtPoint(partNamed('align_floor'), [0, 1, 0], [1.8, 0.2, -1.8]);

        const moved = await placeAgainst(mover, corner);

        expect(moved.min.y).to.be.closeTo(0.2, 1e-3);
        expect(moved.max.x).to.be.closeTo(1.8, 1e-3);
        expect(moved.min.z).to.be.closeTo(-1.8, 1e-3);
      });

      it('places the mover against the inside of a marked wall', async function () {
        buildRoom();
        const mover = box('align-mover-wall-part', [5, 3, 5], [1, 1, 1]);

        const moved = await placeAgainst(
          mover,
          faceWithNormal(partNamed('align_wall_left'), 1, 0, 0)
        );

        expect(moved.min.x).to.be.closeTo(-1.8, 1e-3);
      });
    });
  });
}
