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

      it('should bake the requested size into the geometry', function () {
        const id = flock.createDonut('testDonut3', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const { size } = extents(mesh);
        // The tube adds its own diameter across, and is the full height.
        expect(size[0]).to.be.closeTo(2.5, 0.01);
        expect(size[2]).to.be.closeTo(2.5, 0.01);
        expect(size[1]).to.be.closeTo(0.5, 0.01);
        expect(mesh.scaling.x).to.equal(1);
      });

      it('should leave a hole in the middle', function () {
        const id = flock.createDonut('testDonutHole', {
          diameter: 2,
          thickness: 0.5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const positions = flock.scene.getMeshByName(id).getVerticesData('position');
        let closest = Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          closest = Math.min(closest, Math.hypot(positions[i], positions[i + 2]));
        }

        expect(closest).to.be.closeTo(0.75, 0.01);
      });

      it('should keep the hole open when thickness exceeds diameter', function () {
        const id = flock.createDonut('testDonutFat', {
          diameter: 2,
          thickness: 5,
          position: [0, 0, 0],
        });
        createdIds.push(id);

        const mesh = flock.scene.getMeshByName(id);
        const positions = mesh.getVerticesData('position');
        let closest = Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          closest = Math.min(closest, Math.hypot(positions[i], positions[i + 2]));
        }

        // Thickness is capped at 90% of the diameter, leaving a 0.1 radius hole.
        expect(closest).to.be.closeTo(0.1, 0.01);
        expect(mesh.metadata.donutThickness).to.equal(1.8);
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

      it('should avoid collisions for repeated donut ids', function () {
        const firstId = flock.createDonut('reserveDonut', { diameter: 1 });
        const secondId = flock.createDonut('reserveDonut', { diameter: 1 });
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
    });
  });
}
