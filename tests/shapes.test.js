import { expect } from 'chai';

export function runShapesTests(flock) {
  describe('Shapes API @shapes', function () {
    const createdIds = [];

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

    describe('createCapsule', function () {
      it('should return a string id and create the mesh in the scene', function () {
        const id = flock.createCapsule('testCapsule1', {
          color: '#ff6600',
          diameter: 1,
          height: 2,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a('string');
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it('should set blockKey metadata on the created capsule', function () {
        const id = flock.createCapsule('testCapsule2', {
          color: '#0066ff',
          diameter: 0.5,
          height: 1.5,
          position: [2, 1, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.blockKey).to.be.a('string');
      });

      it('should avoid collisions for repeated capsule ids', function () {
        const firstId = flock.createCapsule('reserveCapsule', {
          color: '#0066ff',
          diameter: 0.5,
          height: 1.5,
          position: [2, 1, 0],
        });
        const secondId = flock.createCapsule('reserveCapsule', {
          color: '#0066ff',
          diameter: 0.5,
          height: 1.5,
          position: [3, 1, 0],
        });
        createdIds.push(firstId, secondId);

        expect(firstId).to.not.equal(secondId);
      });
    });

    describe('createWedge', function () {
      // Local space: createWedge bakes the size in and leaves scaling at 1.
      const extents = (mesh) => {
        const positions = mesh.getVerticesData('position');
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < positions.length; i += 3) {
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], positions[i + axis]);
            max[axis] = Math.max(max[axis], positions[i + axis]);
          }
        }
        return { min, max, size: max.map((v, i) => v - min[i]) };
      };

      it('should return a string id and create the mesh in the scene', function () {
        const id = flock.createWedge('testWedge1', {
          color: '#ff6600',
          width: 2,
          height: 1,
          depth: 3,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a('string');
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it('should set blockKey and shapeType metadata', function () {
        const id = flock.createWedge('testWedge2', { width: 1, height: 1, depth: 1 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.blockKey).to.be.a('string');
        expect(mesh.metadata.shapeType).to.equal('Wedge');
      });

      it('should bake the requested size into the geometry', function () {
        const id = flock.createWedge('testWedge3', {
          width: 2,
          height: 1,
          depth: 3,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.closeTo(2, 0.001);
        expect(size[1]).to.be.closeTo(1, 0.001);
        expect(size[2]).to.be.closeTo(3, 0.001);
        expect(mesh.scaling.x).to.equal(1);
      });

      it('should place the ridge according to peak along the X axis', function () {
        const cases = [
          { peak: 0, expected: -1 },
          { peak: 0.5, expected: 0 },
          { peak: 1, expected: 1 },
        ];

        cases.forEach(({ peak, expected }, index) => {
          const id = flock.createWedge(`testWedgePeak${index}`, {
            width: 2,
            height: 1,
            depth: 1,
            peak,
            position: [0, 0, 0],
          });
          createdIds.push(id);

          const mesh = flock.scene.getMeshByName(id);
          const positions = mesh.getVerticesData('position');
          const { max } = extents(mesh);

          // Every vertex at the top of the wedge sits on the ridge line.
          const ridgeX = [];
          for (let i = 0; i < positions.length; i += 3) {
            if (Math.abs(positions[i + 1] - max[1]) < 0.001) ridgeX.push(positions[i]);
          }

          expect(ridgeX.length, `peak ${peak} ridge vertices`).to.be.greaterThan(0);
          ridgeX.forEach((x) => expect(x, `peak ${peak}`).to.be.closeTo(expected, 0.001));
        });
      });

      it('should run the ridge along Z when axis is Z', function () {
        const id = flock.createWedge('testWedgeAxisZ', {
          width: 2,
          height: 1,
          depth: 4,
          peak: 0,
          axis: 'Z',
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const positions = mesh.getVerticesData('position');
        const { max } = extents(mesh);

        for (let i = 0; i < positions.length; i += 3) {
          if (Math.abs(positions[i + 1] - max[1]) < 0.001) {
            expect(positions[i + 2]).to.be.closeTo(-2, 0.001);
          }
        }
      });

      it('should clamp peak to the 0-1 range', function () {
        const id = flock.createWedge('testWedgeClamp', {
          width: 2,
          height: 1,
          depth: 1,
          peak: 5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const positions = mesh.getVerticesData('position');
        const { max } = extents(mesh);

        for (let i = 0; i < positions.length; i += 3) {
          if (Math.abs(positions[i + 1] - max[1]) < 0.001) {
            expect(positions[i]).to.be.closeTo(1, 0.001);
          }
        }
      });

      it('should produce finite normals at every peak value', function () {
        [0, 0.25, 0.5, 0.75, 1].forEach((peak, index) => {
          const id = flock.createWedge(`testWedgeNormals${index}`, {
            width: 2,
            height: 1,
            depth: 1,
            peak,
            position: [0, 0, 0],
          });
          createdIds.push(id);

          const normals = flock.scene.getMeshByName(id).getVerticesData('normal');
          expect(normals, `peak ${peak}`).to.exist;
          normals.forEach((n) => expect(Number.isFinite(n), `peak ${peak}`).to.be.true);
        });
      });

      it('should give the wedge a physics body', function () {
        const id = flock.createWedge('testWedgePhysics', {
          width: 2,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics).to.exist;
        expect(mesh.physics.shape).to.exist;
      });

      it('should keep the convex hull when physics is disabled then re-enabled', async function () {
        const id = flock.createWedge('testWedgeRePhysics', {
          width: 2,
          height: 1,
          depth: 1,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeConvexHull);

        await flock.setPhysics(id, 'NONE');
        await flock.setPhysics(id, 'STATIC');

        expect(mesh.physics).to.exist;
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeConvexHull);
      });

      it('should avoid collisions for repeated wedge ids', function () {
        const firstId = flock.createWedge('reserveWedge', { width: 1, height: 1, depth: 1 });
        const secondId = flock.createWedge('reserveWedge', { width: 1, height: 1, depth: 1 });
        createdIds.push(firstId, secondId);

        expect(firstId).to.not.equal(secondId);
      });
    });

    describe('createDonut', function () {
      // Local space: createDonut bakes the size in and leaves scaling at 1.
      const extents = (mesh) => {
        const positions = mesh.getVerticesData('position');
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < positions.length; i += 3) {
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], positions[i + axis]);
            max[axis] = Math.max(max[axis], positions[i + axis]);
          }
        }
        return { min, max, size: max.map((v, i) => v - min[i]) };
      };

      it('should return a string id and create the mesh in the scene', function () {
        const id = flock.createDonut('testDonut1', {
          color: '#ff6600',
          diameter: 2,
          thickness: 0.5,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a('string');
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it('should set blockKey and shapeType metadata', function () {
        const id = flock.createDonut('testDonut2', { diameter: 1, thickness: 0.25 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.blockKey).to.be.a('string');
        expect(mesh.metadata.shapeType).to.equal('Donut');
      });

      const donutHoleRadius = (mesh) => {
        const positions = mesh.getVerticesData('position');
        let closest = Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          closest = Math.min(closest, Math.hypot(positions[i], positions[i + 2]));
        }
        return closest;
      };

      it('should bake the requested size into the geometry', function () {
        const id = flock.createDonut('testDonut3', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.closeTo(2, 0.01);
        expect(size[2]).to.be.closeTo(2, 0.01);
        expect(size[1]).to.be.closeTo(0.5, 0.01);
        expect(mesh.scaling.x).to.equal(1);
      });

      it('should leave a hole of diameter minus twice the thickness', function () {
        const id = flock.createDonut('testDonutHole', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        expect(donutHoleRadius(flock.scene.getMeshByName(id))).to.be.closeTo(0.5, 0.01);
      });

      it('should size the hole from innerDiameter when thickness is not given', function () {
        const id = flock.createDonut('testDonutInner', { diameter: 2, innerDiameter: 1.2 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(donutHoleRadius(mesh)).to.be.closeTo(0.6, 0.01);
        expect(mesh.metadata.donutDimensions.thickness).to.be.closeTo(0.4, 0.001);
      });

      it('should default to 1.5 across with a 0.5 hole', function () {
        const id = flock.createDonut('testDonutDefault');
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.closeTo(1.5, 0.01);
        expect(size[1]).to.be.closeTo(0.5, 0.01);
        expect(mesh.metadata.donutDimensions.innerDiameter).to.equal(0.5);
      });

      it('should cap thickness where the hole closes', function () {
        const id = flock.createDonut('testDonutFat', {
          diameter: 2,
          thickness: 5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.closeTo(2, 0.01);
        expect(donutHoleRadius(mesh)).to.be.closeTo(0, 0.01);
        expect(mesh.metadata.donutDimensions.thickness).to.equal(1);
      });

      it('should treat a null innerDiameter as not given', function () {
        const id = flock.createDonut('testDonutNullInner', {
          diameter: 2,
          innerDiameter: null,
          thickness: null,
        });
        createdIds.push(id);

        expect(flock.scene.getMeshByName(id).metadata.donutDimensions.thickness).to.equal(0.5);
      });

      it('should give zero or negative sizes a positive minimum', function () {
        const id = flock.createDonut('testDonutZero', { diameter: 0, thickness: -1 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.greaterThan(0);
        expect(size[1]).to.be.greaterThan(0);
        expect(mesh.physics).to.exist;
      });

      it('should use tessellation for the number of sides', function () {
        const coarse = flock.createDonut('testDonutCoarse', { diameter: 2, tessellation: 3 });
        const smooth = flock.createDonut('testDonutSmooth', { diameter: 2, tessellation: 24 });
        createdIds.push(coarse, smooth);

        const count = (id) => flock.scene.getMeshByName(id).getVerticesData('position').length / 3;
        expect(count(coarse)).to.be.lessThan(count(smooth));
      });

      it('should clamp tessellation to at least 3 sides', function () {
        const id = flock.createDonut('testDonutClamp', { diameter: 2, tessellation: 1 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
        const normals = mesh.getVerticesData('normal');
        expect(normals).to.exist;
        normals.forEach((n) => expect(Number.isFinite(n)).to.be.true);
      });

      it('should give the donut a mesh physics shape', function () {
        const id = flock.createDonut('testDonutPhysics', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics).to.exist;
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeMesh);
      });

      it('should give a dynamic donut a hollow container shape, not a solid hull', async function () {
        const id = flock.createDonut('testDonutDynamic', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 3, 0],
        });
        createdIds.push(id);
        await flock.setPhysics(id, 'DYNAMIC');

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeContainer);
        expect(mesh.physics.shape).to.not.be.instanceOf(
          flock.BABYLON.PhysicsShapeConvexHull
        );

        await flock.setPhysics(id, 'STATIC');
        expect(flock.scene.getMeshByName(id).physics.shape).to.be.instanceOf(
          flock.BABYLON.PhysicsShapeMesh
        );
      });

      it('should avoid collisions for repeated donut ids', function () {
        const firstId = flock.createDonut('reserveDonut', { diameter: 1 });
        const secondId = flock.createDonut('reserveDonut', { diameter: 1 });
        createdIds.push(firstId, secondId);

        expect(firstId).to.not.equal(secondId);
      });
    });

    describe('createRing', function () {
      const extents = (mesh) => {
        const positions = mesh.getVerticesData('position');
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < positions.length; i += 3) {
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], positions[i + axis]);
            max[axis] = Math.max(max[axis], positions[i + axis]);
          }
        }
        return { min, max, size: max.map((v, i) => v - min[i]) };
      };

      const holeRadius = (mesh) => {
        const positions = mesh.getVerticesData('position');
        let closest = Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          closest = Math.min(closest, Math.hypot(positions[i], positions[i + 2]));
        }
        return closest;
      };

      it('should return a string id and create the mesh in the scene', function () {
        const id = flock.createRing('testRing1', {
          color: '#66ccff',
          diameter: 2,
          thickness: 0.25,
          height: 0.5,
          position: [0, 1, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a('string');
        expect(flock.scene.getMeshByName(id)).to.exist;
      });

      it('should set blockKey and shapeType metadata', function () {
        const id = flock.createRing('testRing2', { diameter: 1, thickness: 0.1 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata.blockKey).to.be.a('string');
        expect(mesh.metadata.shapeType).to.equal('Ring');
      });

      it('should bake the requested size into the geometry', function () {
        const id = flock.createRing('testRing3', {
          diameter: 2,
          thickness: 0.25,
          height: 0.5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.closeTo(2, 0.01);
        expect(size[2]).to.be.closeTo(2, 0.01);
        expect(size[1]).to.be.closeTo(0.5, 0.01);
        expect(mesh.scaling.x).to.equal(1);
      });

      it('should leave a hole of diameter minus twice the thickness', function () {
        const id = flock.createRing('testRingHole', { diameter: 2, thickness: 0.25 });
        createdIds.push(id);

        expect(holeRadius(flock.scene.getMeshByName(id))).to.be.closeTo(0.75, 0.001);
      });

      it('should size the hole from innerDiameter when thickness is not given', function () {
        const id = flock.createRing('testRingInner', { diameter: 2, innerDiameter: 1.2 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(holeRadius(mesh)).to.be.closeTo(0.6, 0.001);
        expect(mesh.metadata.ringDimensions.thickness).to.be.closeTo(0.4, 0.001);
      });

      it('should prefer thickness when both thickness and innerDiameter are given', function () {
        const id = flock.createRing('testRingBoth', {
          diameter: 2,
          innerDiameter: 1.2,
          thickness: 0.25,
        });
        createdIds.push(id);

        expect(holeRadius(flock.scene.getMeshByName(id))).to.be.closeTo(0.75, 0.001);
      });

      it('should keep the hole open when the wall is too thick', function () {
        const id = flock.createRing('testRingFat', { diameter: 2, thickness: 5 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(holeRadius(mesh)).to.be.closeTo(0.1, 0.001);
        expect(mesh.metadata.ringDimensions.thickness).to.be.closeTo(0.9, 0.001);
      });

      it('should treat a null innerDiameter as not given', function () {
        const id = flock.createRing('testRingNullInner', {
          diameter: 2,
          innerDiameter: null,
          thickness: null,
        });
        createdIds.push(id);

        expect(flock.scene.getMeshByName(id).metadata.ringDimensions.thickness).to.equal(0.25);
      });

      it('should give zero or negative sizes a positive minimum', function () {
        const id = flock.createRing('testRingZero', { diameter: 0, thickness: -1, height: -1 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        expect(size[0]).to.be.greaterThan(0);
        expect(size[1]).to.be.greaterThan(0);
        expect(mesh.physics).to.exist;
      });

      it('should use tessellation for the number of sides and clamp it to 3', function () {
        const coarse = flock.createRing('testRingCoarse', { diameter: 2, tessellation: 1 });
        const smooth = flock.createRing('testRingSmooth', { diameter: 2, tessellation: 24 });
        createdIds.push(coarse, smooth);

        const count = (id) => flock.scene.getMeshByName(id).getVerticesData('position').length / 3;
        expect(count(coarse)).to.equal(4 * 2 * (3 + 1));
        expect(count(smooth)).to.equal(4 * 2 * (24 + 1));
      });

      it('should face every normal away from the solid', function () {
        const id = flock.createRing('testRingNormals', { diameter: 2, thickness: 0.25 });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const positions = mesh.getVerticesData('position');
        const normals = mesh.getVerticesData('normal');
        const computed = [];
        flock.BABYLON.VertexData.ComputeNormals(positions, mesh.getIndices(), computed);
        for (let i = 0; i < normals.length; i += 3) {
          const dot =
            normals[i] * computed[i] +
            normals[i + 1] * computed[i + 1] +
            normals[i + 2] * computed[i + 2];
          expect(dot).to.be.greaterThan(0.9);
        }
      });

      it('should give the ring a mesh physics shape', function () {
        const id = flock.createRing('testRingPhysics', { diameter: 2, position: [0, 1, 0] });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics).to.exist;
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeMesh);
      });

      it('should give a dynamic ring a hollow container shape, not a solid hull', async function () {
        const id = flock.createRing('testRingDynamic', {
          diameter: 2,
          innerDiameter: 0.35,
          height: 0.25,
          position: [0, 3, 0],
        });
        createdIds.push(id);
        await flock.setPhysics(id, 'DYNAMIC');

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.physics.shape).to.be.instanceOf(flock.BABYLON.PhysicsShapeContainer);
        expect(mesh.physics.shape).to.not.be.instanceOf(
          flock.BABYLON.PhysicsShapeConvexHull
        );

        await flock.setPhysics(id, 'STATIC');
        expect(flock.scene.getMeshByName(id).physics.shape).to.be.instanceOf(
          flock.BABYLON.PhysicsShapeMesh
        );
      });

      it('should let a dynamic ring slide down a pole through its hole @slow', async function () {
        this.timeout(30000);
        const poleId = flock.createCylinder('testPoleThread', {
          height: 2,
          diameterTop: 0.3,
          diameterBottom: 0.3,
          position: [-2, 0.5, 2],
        });
        createdIds.push(poleId);
        const ringId = flock.createRing('testRingThread', {
          diameter: 2,
          innerDiameter: 0.35,
          height: 0.25,
          position: [-2, 2.6, 2],
        });
        createdIds.push(ringId);
        await flock.setPhysics(ringId, 'DYNAMIC');

        await new Promise((r) => setTimeout(r, 3000));

        const ring = flock.scene.getMeshByName(ringId);
        // Threaded: slid down the 2.5-high pole top. Balanced on top would
        // still sit at ~2.7; tipped off and fell beside it would be >0.5 away.
        expect(ring.position.y).to.be.below(2.0);
        const dx = ring.position.x - -2;
        const dz = ring.position.z - 2;
        expect(Math.hypot(dx, dz)).to.be.below(0.5);
      });

      it('should avoid collisions for repeated ring ids', function () {
        const firstId = flock.createRing('reserveRing', { diameter: 1 });
        const secondId = flock.createRing('reserveRing', { diameter: 1 });
        createdIds.push(firstId, secondId);

        expect(firstId).to.not.equal(secondId);
      });
    });

    describe('createPlane', function () {
      it('should return a string id and create the mesh in the scene', function () {
        const id = flock.createPlane('testPlane1', {
          color: '#00cc44',
          width: 3,
          height: 2,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        expect(id).to.be.a('string');
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it("should set metadata.shape to 'plane'", function () {
        const id = flock.createPlane('testPlane2', {
          color: '#cc0044',
          width: 1,
          height: 1,
          position: [3, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata).to.exist;
        expect(mesh.metadata.shape).to.equal('plane');
      });

      it('should pivot planes at their centre, not the bottom edge', function () {
        const id = flock.createPlane('testPlanePivot', {
          color: '#cc0044',
          width: 2,
          height: 4,
          position: [0, 5, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.position.y).to.be.closeTo(5, 1e-6);
      });

      it('should round-trip plane positions through block coordinates', function () {
        const id = flock.createPlane('testPlaneRoundTrip', {
          color: '#cc0044',
          width: 2,
          height: 4,
          position: [1, 5, 2],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const back = flock.getBlockPositionFromMesh(mesh);
        expect(back.x).to.be.closeTo(1, 1e-6);
        expect(back.y).to.be.closeTo(5, 1e-6);
        expect(back.z).to.be.closeTo(2, 1e-6);
      });

      it('should move planes by their centre', async function () {
        const id = flock.createPlane('testPlaneMove', {
          color: '#cc0044',
          width: 2,
          height: 4,
          position: [0, 5, 0],
        });
        createdIds.push(id);

        await flock.positionAt(id, { x: 0, y: 7, z: 0 });
        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.position.y).to.be.closeTo(7, 1e-6);
      });

      it('should keep the base rule for non-plane shapes', function () {
        const id = flock.createBox('testBoxBaseRule', {
          width: 2,
          height: 4,
          depth: 2,
          color: '#cc0044',
          position: [0, 5, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        // Bottom edge at 5, centre lifted by half the height.
        expect(mesh.position.y).to.be.closeTo(7, 1e-6);
      });
    });

    describe('shared name reservation', function () {
      it('should avoid collisions across shape creators', function () {
        const boxA = flock.createBox('reserveBox', { position: [0, 0, 0] });
        const boxB = flock.createBox('reserveBox', { position: [1, 0, 0] });
        const sphereA = flock.createSphere('reserveSphere', {
          position: [0, 0, 0],
        });
        const sphereB = flock.createSphere('reserveSphere', {
          position: [1, 0, 0],
        });
        const cylinderA = flock.createCylinder('reserveCylinder', {
          height: 1,
          diameterTop: 1,
          diameterBottom: 1,
          position: [0, 0, 0],
        });
        const cylinderB = flock.createCylinder('reserveCylinder', {
          height: 1,
          diameterTop: 1,
          diameterBottom: 1,
          position: [1, 0, 0],
        });
        const planeA = flock.createPlane('reservePlane', {
          width: 1,
          height: 1,
          position: [0, 0, 0],
        });
        const planeB = flock.createPlane('reservePlane', {
          width: 1,
          height: 1,
          position: [1, 0, 0],
        });
        createdIds.push(boxA, boxB, sphereA, sphereB, cylinderA, cylinderB, planeA, planeB);

        expect(boxA).to.not.equal(boxB);
        expect(sphereA).to.not.equal(sphereB);
        expect(cylinderA).to.not.equal(cylinderB);
        expect(planeA).to.not.equal(planeB);
      });
    });

    describe('create3DText @slow', function () {
      this.timeout(30000);

      it('should return a string id and create a text mesh in the scene', async function () {
        const id = flock.create3DText({
          text: 'Hi',
          font: '/fonts/FreeSansBold.ttf',
          color: '#ffffff',
          size: 1,
          depth: 0.2,
          position: { x: 0, y: 0, z: 0 },
          modelId: 'testText3D',
        });
        createdIds.push(id);

        expect(id).to.be.a('string');

        await new Promise((resolve, reject) => {
          flock.whenModelReady(id, resolve);
          setTimeout(() => reject(new Error('create3DText timed out')), 25000);
        });

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it('should create a text mesh via the non-Manifold path with a .ttf font', async function () {
        const id = flock.create3DText({
          text: 'Hi',
          font: '/fonts/FreeSansBold.ttf',
          color: '#ffffff',
          size: 1,
          depth: 0.2,
          position: { x: 0, y: 0, z: 0 },
          modelId: 'fallbackText3D',
          useManifold: false,
        });
        createdIds.push(id);

        expect(id).to.be.a('string');

        await new Promise((resolve, reject) => {
          flock.whenModelReady(id, resolve);
          setTimeout(() => reject(new Error('create3DText timed out')), 25000);
        });

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh).to.exist;
      });

      it('should avoid collisions for concurrent text mesh allocations', async function () {
        const firstId = flock.create3DText({
          text: 'Name',
          font: '/fonts/FreeSansBold.ttf',
          color: '#ffffff',
          size: 1,
          depth: 0.2,
          position: { x: 0, y: 0, z: 0 },
          modelId: 'reserveText',
        });
        const secondId = flock.create3DText({
          text: 'Name2',
          font: '/fonts/FreeSansBold.ttf',
          color: '#ffffff',
          size: 1,
          depth: 0.2,
          position: { x: 1, y: 0, z: 0 },
          modelId: 'reserveText',
        });
        createdIds.push(firstId, secondId);

        expect(firstId).to.not.equal(secondId);
      });

      const createTextAndWait = async (options) => {
        const id = flock.create3DText({
          text: 'Hi',
          font: '/fonts/FreeSansBold.ttf',
          color: '#ffffff',
          size: 1,
          depth: 0.2,
          position: { x: 0, y: 0, z: 0 },
          ...options,
        });
        createdIds.push(id);
        await new Promise((resolve, reject) => {
          flock.whenModelReady(id, resolve);
          setTimeout(() => reject(new Error('create3DText timed out')), 25000);
        });
        const mesh = flock.scene.getMeshByName(id);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        return { id, mesh };
      };

      const extentsOf = (mesh) => {
        const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
        return { min, max, x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
      };

      it('should stand upright by default with depth along Z', async function () {
        const { mesh } = await createTextAndWait({ modelId: 'uprightText' });
        const ext = extentsOf(mesh);

        expect(ext.y).to.be.within(0.5, 1.1);
        expect(ext.z).to.be.closeTo(0.2, 0.01);
      });

      it('should lie flat with its base at the given y when horizontal', async function () {
        const { mesh } = await createTextAndWait({
          modelId: 'horizontalText',
          position: { x: 2, y: 3, z: 4 },
          horizontal: true,
        });
        const ext = extentsOf(mesh);

        expect(ext.y).to.be.closeTo(0.2, 0.01);
        expect(ext.z).to.be.within(0.5, 1.1);
        expect(ext.min.y).to.be.closeTo(3, 0.001);
        expect(mesh.rotation.x).to.equal(0);
      });

      it('should widen the text by the spacing between each pair of letters', async function () {
        const { mesh: plain } = await createTextAndWait({ modelId: 'plainSpacing', text: 'HHH' });
        const { mesh: spaced } = await createTextAndWait({
          modelId: 'wideSpacing',
          text: 'HHH',
          spacing: 0.5,
        });
        const plainExt = extentsOf(plain);
        const spacedExt = extentsOf(spaced);

        expect(spacedExt.x - plainExt.x).to.be.closeTo(1, 0.01);
        expect(spacedExt.y).to.be.closeTo(plainExt.y, 0.001);
      });

      const letterColourOf = (mesh, letter) => {
        const index = mesh.metadata.textLetterIndex.indexOf(letter);
        const colours = mesh.getVerticesData(flock.BABYLON.VertexBuffer.ColorKind);
        return new flock.BABYLON.Color3(
          colours[index * 4],
          colours[index * 4 + 1],
          colours[index * 4 + 2]
        ).toHexString();
      };

      it('should tag every vertex with its letter, skipping spaces', async function () {
        const { mesh } = await createTextAndWait({ modelId: 'letterTags', text: 'H i' });
        const letters = mesh.metadata.textLetterIndex;

        expect(letters).to.have.length(mesh.getTotalVertices());
        expect([...new Set(letters)].sort()).to.deep.equal([0, 1]);
      });

      it('should cycle a colour list through the letters', async function () {
        const { mesh } = await createTextAndWait({
          modelId: 'letterColours',
          text: 'H ii',
          color: ['#ff0000', '#0000ff'],
        });

        expect(letterColourOf(mesh, 0)).to.equal('#FF0000');
        expect(letterColourOf(mesh, 1)).to.equal('#0000FF');
        expect(letterColourOf(mesh, 2)).to.equal('#FF0000');
      });

      it('should swap between letter colours and a single colour', async function () {
        const { mesh } = await createTextAndWait({
          modelId: 'letterColourSwap',
          color: ['#ff0000', '#0000ff'],
        });

        flock.changeColorMesh(mesh, '#00ff00');
        expect(mesh.getVerticesData(flock.BABYLON.VertexBuffer.ColorKind)).to.not.exist;
        expect(mesh.metadata.textLetterColors).to.be.undefined;

        flock.changeColorMesh(mesh, ['#00ff00', '#ffff00']);
        expect(letterColourOf(mesh, 0)).to.equal('#00FF00');
        expect(letterColourOf(mesh, 1)).to.equal('#FFFF00');
      });

      const letterZRange = (mesh, letter) => {
        const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
        let min = Infinity;
        let max = -Infinity;
        mesh.metadata.textLetterIndex.forEach((l, i) => {
          if (l !== letter) return;
          min = Math.min(min, positions[i * 3 + 2]);
          max = Math.max(max, positions[i * 3 + 2]);
        });
        return { min, max, depth: max - min };
      };

      it('should cycle a depth list through the letters with a shared back', async function () {
        const { mesh } = await createTextAndWait({
          modelId: 'letterDepths',
          text: 'H HH',
          depth: [0.2, 0.6],
        });
        const [first, second, third] = [0, 1, 2].map((l) => letterZRange(mesh, l));

        expect(first.depth).to.be.closeTo(0.2, 0.001);
        expect(second.depth).to.be.closeTo(0.6, 0.001);
        expect(third.depth).to.be.closeTo(0.2, 0.001);
        expect(first.max).to.be.closeTo(second.max, 0.001);
      });

      it('should build a depth list of equal values like a single depth', async function () {
        const { mesh } = await createTextAndWait({ modelId: 'evenDepths', depth: [0.3, 0.3] });

        expect(extentsOf(mesh).z).to.be.closeTo(0.3, 0.001);
      });

      it('should run the callback before then, both with the mesh id', async function () {
        const calls = [];
        let finish;
        const done = new Promise((resolve) => (finish = resolve));
        const { id } = await createTextAndWait({
          modelId: 'textLifecycle',
          callback: async (name) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            calls.push(['do', name]);
          },
          then: (name) => {
            calls.push(['then', name]);
            finish();
          },
        });
        await done;

        expect(calls).to.deep.equal([
          ['do', id],
          ['then', id],
        ]);
      });

      it('should rebuild geometry in place, keeping the mesh and its position', async function () {
        const { id, mesh } = await createTextAndWait({
          modelId: 'rebuildText',
          position: { x: 1, y: 0, z: 0 },
        });

        await flock._rebuild3DTextGeometry(mesh, {
          text: 'Hello',
          font: '/fonts/FreeSansBold.ttf',
          size: 1,
          depth: 0.2,
          horizontal: true,
        });
        mesh.computeWorldMatrix(true);
        const ext = extentsOf(mesh);

        expect(flock.scene.getMeshByName(id)).to.equal(mesh);
        expect(mesh.position.x).to.equal(1);
        expect(ext.y).to.be.closeTo(0.2, 0.01);
        expect(ext.z).to.be.within(0.5, 1.1);
      });
    });
  });
}
