import { expect } from 'chai';

export function runMirrorTests(flock) {
  describe('Mirror function tests @mirror', function () {
    const created = [];

    afterEach(async function () {
      for (const id of [...created].reverse()) {
        if (flock.scene.getMeshByName(id)) await flock.dispose(id);
      }
      created.length = 0;
    });

    function box(id, position, extra = {}) {
      const boxId = flock.createBox(id, {
        color: '#FF0000',
        width: 2,
        height: 1,
        depth: 1,
        position,
        ...extra,
      });
      created.push(boxId);
      return boxId;
    }

    async function mirror(sourceId, options) {
      const mirrorId = flock.mirror(sourceId, options);
      created.push(mirrorId);
      await flock.modelReadyPromises.get(mirrorId);
      return mirrorId;
    }

    function bounds(id) {
      const mesh = flock.scene.getMeshByName(id);
      mesh.computeWorldMatrix(true);
      mesh.getChildMeshes().forEach((m) => m.computeWorldMatrix(true));
      return mesh.getHierarchyBoundingVectors(true);
    }

    function expectReflected(sourceId, mirrorId, key, planeValue) {
      const source = bounds(sourceId);
      const mirrored = bounds(mirrorId);
      expect(mirrored.min[key]).to.be.closeTo(2 * planeValue - source.max[key], 0.001);
      expect(mirrored.max[key]).to.be.closeTo(2 * planeValue - source.min[key], 0.001);
      for (const other of ['x', 'y', 'z'].filter((k) => k !== key)) {
        expect(mirrored.min[other]).to.be.closeTo(source.min[other], 0.001);
        expect(mirrored.max[other]).to.be.closeTo(source.max[other], 0.001);
      }
    }

    for (const key of ['x', 'y', 'z']) {
      it(`should reflect across the origin on ${key}`, async function () {
        const position = { x: [3, 0, 0], y: [0, 2, 0], z: [0, 0, 3] }[key];
        const sourceId = box(`test-mirror-${key}`, position);

        const mirrorId = await mirror(sourceId, { mirrorId: `test-mirror-${key}-m`, axis: key });

        expectReflected(sourceId, mirrorId, key, 0);
        expect(flock.scene.getMeshByName(mirrorId).scaling[key]).to.equal(-1);
        expect(flock.scene.getMeshByName(sourceId).scaling[key]).to.equal(1);
      });
    }

    it('should reflect a rotated object', async function () {
      const sourceId = box('test-mirror-rotated', [3, 0, 1]);
      await flock.rotateTo(sourceId, { x: 0, y: 30, z: 20 });

      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-rotated-m', axis: 'x' });

      expectReflected(sourceId, mirrorId, 'x', 0);
    });

    it('should reflect through the centre of the about object', async function () {
      const aboutId = box('test-mirror-about', [5, 0, 0]);
      const sourceId = box('test-mirror-about-src', [2, 0, 0]);

      const mirrorId = await mirror(sourceId, {
        mirrorId: 'test-mirror-about-m',
        axis: 'x',
        aboutMeshName: aboutId,
      });

      expectReflected(sourceId, mirrorId, 'x', 5);
    });

    it('should leave the source geometry unflipped', async function () {
      const sourceId = box('test-mirror-geometry', [3, 0, 0]);
      const source = flock.scene.getMeshByName(sourceId);
      const indicesBefore = Array.from(source.getIndices());

      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-geometry-m' });

      expect(flock.scene.getMeshByName(mirrorId).geometry).to.not.equal(source.geometry);
      expect(Array.from(source.getIndices())).to.deep.equal(indicesBefore);
    });

    it('should take its own colour without changing the source', async function () {
      const sourceId = box('test-mirror-colour', [3, 0, 0]);
      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-colour-m' });
      const sourceColour = flock.scene.getMeshByName(sourceId).material.diffuseColor.toHexString();

      await flock.changeColor(mirrorId, { color: '#00FF00' });

      expect(flock.scene.getMeshByName(mirrorId).material.diffuseColor.toHexString()).to.equal(
        '#00FF00'
      );
      expect(flock.scene.getMeshByName(sourceId).material.diffuseColor.toHexString()).to.equal(
        sourceColour
      );
    });

    it('should be its own name family', async function () {
      const sourceId = box('test-mirror-family', [3, 0, 0]);
      const mirrorId = await mirror(sourceId, {
        mirrorId: 'test-mirror-family-m',
        mirrorName: 'test-mirror-family-m',
      });

      expect(flock._familyOf(mirrorId)).to.equal('test-mirror-family-m');
    });

    it('should leave out the about object when it is inside the source group', async function () {
      const bodyId = box('test-mirror-body', [0, 0, 0]);
      const wheelId = box('test-mirror-wheel', [2, 0, 0], { width: 1 });
      const groupId = flock.createGroup('test-mirror-group');
      created.push(groupId);
      await flock.setParent(groupId, [bodyId, wheelId]);

      const mirrorId = await mirror(groupId, {
        mirrorId: 'test-mirror-group-m',
        axis: 'x',
        aboutMeshName: bodyId,
      });

      const mirrored = flock.scene.getMeshByName(mirrorId);
      expect(mirrored.getChildMeshes(true)).to.have.length(1);
      const wheel = bounds(wheelId);
      const mirroredBounds = bounds(mirrorId);
      expect(mirroredBounds.min.x).to.be.closeTo(-wheel.max.x, 0.001);
      expect(mirroredBounds.max.x).to.be.closeTo(-wheel.min.x, 0.001);
    });

    it('should mirror a group member about a sibling', async function () {
      const bodyId = box('test-mirror-sib-body', [0, 0, 0]);
      const wheelId = box('test-mirror-sib-wheel', [3, 0, 0], { width: 1 });
      const groupId = flock.createGroup('test-mirror-sib-group');
      created.push(groupId);
      await flock.setParent(groupId, [bodyId, wheelId]);

      const mirrorId = await mirror(wheelId, {
        mirrorId: 'test-mirror-sib-m',
        axis: 'x',
        aboutMeshName: bodyId,
      });

      expect(flock.scene.getMeshByName(mirrorId)).to.not.equal(null);
      expectReflected(wheelId, mirrorId, 'x', 0);
    });

    it("should mirror across the about object's own axis", async function () {
      const aboutId = box('test-mirror-turned-about', [0, 0, 0]);
      await flock.rotateTo(aboutId, { x: 0, y: 90, z: 0 });
      const sourceId = box('test-mirror-turned-src', [0, 0, 3]);

      const mirrorId = await mirror(sourceId, {
        mirrorId: 'test-mirror-turned-m',
        axis: 'x',
        aboutMeshName: aboutId,
      });

      expectReflected(sourceId, mirrorId, 'z', 0);
    });

    it('should follow the about object when its group is rotated', async function () {
      const bodyId = box('test-mirror-rot-body', [0, 0, 0]);
      const wheelId = box('test-mirror-rot-wheel', [3, 0, 0], { width: 1 });
      const groupId = flock.createGroup('test-mirror-rot-group');
      created.push(groupId);
      await flock.setParent(groupId, [bodyId, wheelId]);
      const group = flock.scene.getMeshByName(groupId);
      group.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(Math.PI / 2, 0, 0);
      group.computeWorldMatrix(true);

      const mirrorId = await mirror(wheelId, {
        mirrorId: 'test-mirror-rot-m',
        axis: 'x',
        aboutMeshName: bodyId,
      });

      const plane = hierarchyCentreZ(bodyId);
      expectReflected(wheelId, mirrorId, 'z', plane);
    });

    function hierarchyCentreZ(id) {
      const { min, max } = bounds(id);
      return (min.z + max.z) / 2;
    }

    it('should stay mirrored when a group member has its physics updated', async function () {
      const sourceId = box('test-mirror-phys-src', [3, 0, 0]);
      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-phys-m', axis: 'x' });
      const groupId = flock.createGroup('test-mirror-phys-group');
      created.push(groupId);
      await flock.setParent(groupId, [sourceId, mirrorId]);
      const mirrored = flock.scene.getMeshByName(mirrorId);
      const before = mirrored.computeWorldMatrix(true).asArray().slice();

      flock.updatePhysics(mirrored);

      const after = mirrored.computeWorldMatrix(true).asArray();
      after.forEach((value, i) => expect(value).to.be.closeTo(before[i], 0.001));
    });

    for (const grouped of [false, true]) {
      it(`should show say text above a mirror${grouped ? ' in a group' : ''}, level with its source`, async function () {
        const sourceId = box(`test-mirror-say-src-${grouped}`, [3, 0, 0]);
        const mirrorId = await mirror(sourceId, {
          mirrorId: `test-mirror-say-m-${grouped}`,
          axis: 'x',
        });
        if (grouped) {
          const groupId = flock.createGroup('test-mirror-say-group');
          created.push(groupId);
          await flock.setParent(groupId, [sourceId, mirrorId]);
        }

        flock.say(sourceId, { text: 'hi', duration: 0 });
        flock.say(mirrorId, { text: 'hi', duration: 0 });
        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => flock.scene.onAfterRenderObservable.addOnce(resolve));
        }

        const planeY = (id) => {
          const target = flock.scene.getMeshByName(id);
          const plane = flock.scene.meshes.find(
            (m) => m.name === 'textPlane' && m.metadata?.sayTarget === target
          );
          return plane.getAbsolutePosition().y;
        };
        const mirrorTop = flock.scene.getMeshByName(mirrorId).getBoundingInfo().boundingBox
          .maximumWorld.y;
        expect(planeY(mirrorId)).to.be.greaterThan(mirrorTop);
        expect(planeY(mirrorId)).to.be.closeTo(planeY(sourceId), 0.001);
      });
    }

    it('should put the physics body where the mirror is', async function () {
      const sourceId = box('test-mirror-body-src', [3, 0, 0]);
      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-body-m', axis: 'x' });
      const mirrored = flock.scene.getMeshByName(mirrorId);
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => flock.scene.onAfterRenderObservable.addOnce(resolve));
      }

      const [position] = flock.hk._hknp.HP_Body_GetQTransform(
        mirrored.physics._pluginData.hpBodyId
      )[1];
      const offset = mirrored.physics._pluginData.worldRegion?.floatingOrigin;
      expect(position[0] + (offset?.x ?? 0)).to.be.closeTo(-3, 0.01);
      expect(mirrored.getAbsolutePosition().x).to.be.closeTo(-3, 0.01);
    });

    it('should carry nested mirrors when the outer group glides', async function () {
      const outer = flock.createGroup('test-mirror-glide-outer');
      const body = box('test-mirror-glide-body', [6.3, 0.3, -0.8], { width: 1, depth: 3 });
      flock.setParent(outer, body);
      const inner = flock.createGroup('test-mirror-glide-inner');
      const wheel = flock.createCylinder('test-mirror-glide-wheel', {
        color: '#FFAA00',
        height: 0.6,
        diameterTop: 1,
        diameterBottom: 1,
        position: [5.5, 0.2, -1.6],
      });
      flock.setParent(inner, wheel);
      await flock.rotateTo(wheel, { x: 0, y: 0, z: 90 });
      flock.setParent(inner, wheel);
      const wheelMirror = flock.mirror(wheel, {
        mirrorId: 'test-mirror-glide-m4',
        axis: 'x',
        aboutMeshName: body,
      });
      flock.setParent(inner, wheelMirror);
      flock.setParent(outer, inner);
      const axleMirror = flock.mirror(inner, {
        mirrorId: 'test-mirror-glide-m5',
        axis: 'z',
        aboutMeshName: body,
      });
      flock.setParent(outer, axleMirror);
      created.push(wheel, inner, wheelMirror, axleMirror, outer);

      // Not awaited first, as generated code does: the mirrors are built
      // while the glide is already driving the source bodies.
      await flock.glideTo(outer, { x: 8.6, y: 0, z: 19.8, duration: 0.3 });
      await flock._whenHierarchySettled(flock.scene.getMeshByName(outer));
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => flock.scene.onAfterRenderObservable.addOnce(resolve));
      }

      const centre = (id) => {
        const { min, max } = bounds(id);
        return min.add(max).scale(0.5);
      };
      const bodyCentre = centre(body);
      const wheelCentre = centre(wheel);
      expect(bodyCentre.z).to.be.closeTo(19.8, 0.6);
      expect(centre(wheelMirror).x).to.be.closeTo(2 * bodyCentre.x - wheelCentre.x, 0.01);
      expect(centre(wheelMirror).z).to.be.closeTo(wheelCentre.z, 0.01);
      expect(centre(axleMirror).z).to.be.closeTo(2 * bodyCentre.z - centre(inner).z, 0.01);

      const bodies = flock.scene.getPhysicsEngine().getBodies();
      for (const id of [wheelMirror, axleMirror]) {
        const mesh = flock.scene.getMeshByName(id);
        for (const node of [mesh, ...mesh.getChildMeshes()]) {
          const onNode = bodies.filter((b) => b.transformNode === node);
          expect(onNode.length, node.name).to.be.at.most(1);
          if (!onNode.length) continue;
          expect(node.physics, node.name).to.equal(onNode[0]);
          const [bodyPosition] = flock.hk._hknp.HP_Body_GetQTransform(
            node.physics._pluginData.hpBodyId
          )[1];
          const offset = node.physics._pluginData.worldRegion?.floatingOrigin;
          const meshPosition = node.getAbsolutePosition();
          expect(bodyPosition[0] + (offset?.x ?? 0), `${node.name} body x`).to.be.closeTo(
            meshPosition.x,
            0.01
          );
          expect(bodyPosition[2] + (offset?.z ?? 0), `${node.name} body z`).to.be.closeTo(
            meshPosition.z,
            0.01
          );
        }
      }
    });

    it('should not make a plain clone of a mirror into a mirror', async function () {
      const sourceId = box('test-mirror-cloned-src', [3, 0, 0]);
      const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-cloned-m' });
      const groupId = flock.createGroup('test-mirror-cloned-group');
      created.push(groupId);
      await flock.setParent(groupId, [sourceId, mirrorId]);

      for (const from of [mirrorId, groupId]) {
        const cloneId = flock.cloneMesh({ sourceMeshName: from, cloneId: `${from}-copy` });
        created.push(cloneId);
        const clone = await flock.modelReadyPromises.get(cloneId);
        for (const node of [clone, ...clone.getChildMeshes()]) {
          expect(node.metadata?.mirror, node.name).to.equal(undefined);
        }
      }
      expect(flock.scene.getMeshByName(mirrorId).metadata.mirror).to.not.equal(undefined);
    });

    it('should not mirror meshes with a skeleton', async function () {
      const sourceId = box('test-mirror-skeleton', [3, 0, 0]);
      const source = flock.scene.getMeshByName(sourceId);
      source.skeleton = { bones: [] };
      try {
        const mirrorId = await mirror(sourceId, { mirrorId: 'test-mirror-skeleton-m' });
        expect(flock.scene.getMeshByName(mirrorId)).to.equal(null);
      } finally {
        source.skeleton = null;
      }
    });
  });
}
