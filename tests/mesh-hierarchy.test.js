import { expect } from 'chai';
import * as Blockly from 'blockly';
import { meshMap } from '../generators/generators.js';
import { bakeGroupScale, cacheGroupScaleBaseline, healGroupOrigin, updateChildBlockRotations, updateScaleBlock, setGizmoManager, gizmoManager } from '../ui/gizmos.js';
import { suppressBlockLiveUpdates, unsuppressBlockLiveUpdates, updateMeshFromBlock, syncGroupParentOnMove, setGroupSelectionFollower, getColorRoot, handleMaterialOrColorChange, updateBlockColorAndHighlight } from '../ui/blockmesh.js';

function configureDraco(BABYLON) {
  const base = import.meta?.env?.BASE_URL ?? '/';
  const root = base.endsWith('/') ? base : `${base}/`;

  BABYLON.DracoCompression.DefaultNumWorkers = 0;
  BABYLON.DracoCompression.Configuration = {
    decoder: {
      wasmUrl: `${root}draco/draco_wasm_wrapper_gltf.js`,
      wasmBinaryUrl: `${root}draco/draco_decoder_gltf.wasm`,
      fallbackUrl: `${root}draco/draco_decoder_gltf.js`,
    },
  };
}

async function pumpAnimation(flock, promise) {
  const interval = setInterval(() => {
    flock.scene.render();
  }, 0);
  try {
    await promise;
    flock.scene.render();
    flock.scene.render();
  } finally {
    clearInterval(interval);
  }
}

function waitForModel(flock, meshId) {
  return new Promise((resolve) => flock.whenModelReady(meshId, resolve));
}

export function runMeshHierarchyTests(flock) {
  describe('Mesh Hierarchy API @meshhierarchy', function () {
    const meshIds = [];

    afterEach(function () {
      meshIds.forEach((id) => {
        try {
          flock.dispose(id);
        } catch (e) {
          console.warn(`Failed to dispose ${id}:`, e);
        }
      });
      meshIds.length = 0;
    });

    describe('parentChild', function () {
      it('should set the child mesh parent to the parent mesh', async function () {
        const parentId = 'hierarchyParent1';
        const childId = 'hierarchyChild1';

        await flock.createBox(parentId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [2, 0, 0],
        });
        meshIds.push(parentId, childId);

        await flock.parentChild(parentId, childId);

        const parentMesh = flock.scene.getMeshByName(parentId);
        const childMesh = flock.scene.getMeshByName(childId);
        expect(childMesh.parent).to.equal(parentMesh);
      });

      it('should ignore parenting to a non-mesh target', async function () {
        const childId = 'hierarchyChildNonMesh';
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [2, 0, 0],
        });
        meshIds.push(childId);

        const group = new flock.BABYLON.AnimationGroup('parentNonMeshGroup', flock.scene);

        const reported = [];
        const previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
        try {
          await flock.parentChild('parentNonMeshGroup', childId);

          const childMesh = flock.scene.getMeshByName(childId);
          expect(childMesh.parent).to.not.equal(group);
          expect(reported).to.have.lengthOf(1);
          expect(reported[0].key).to.equal('target_not_a_mesh');
        } finally {
          flock.onBlockError = previousOnBlockError;
          group.dispose();
        }
      });

      it('should apply position offsets to the child', async function () {
        const parentId = 'hierarchyParent2';
        const childId = 'hierarchyChild2';

        await flock.createBox(parentId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [0, 0, 0],
        });
        meshIds.push(parentId, childId);

        await flock.parentChild(parentId, childId, 1, 0, 0);

        const childMesh = flock.scene.getMeshByName(childId);
        expect(childMesh.parent).to.exist;
        // The x offset of 1 is applied directly in local space.
        // y/z are also adjusted by parent and child pivot alignments.
        expect(childMesh.position.x).to.be.closeTo(1, 0.01);
        expect(childMesh.position.z).to.be.closeTo(0, 0.01);
      });
    });

    describe('createGroup', function () {
      const mockBoxBlock = (values) => {
        const holders = {};
        const inputs = {};
        for (const [name, v] of Object.entries(values)) {
          const holder = { _v: v };
          holders[name] = holder;
          inputs[name] = {
            connection: {
              targetBlock: () => ({
                getField: (f) => (f === 'NUM' ? {} : null),
                getFieldValue: () => String(holder._v),
                setFieldValue: (nv) => {
                  holder._v = Number(nv);
                },
              }),
            },
          };
        }
        return {
          block: {
            id: `bakeBlock_${Math.random().toString(36).slice(2)}`,
            type: 'create_box',
            disposed: false,
            getInput: (name) => inputs[name] || null,
            getFieldValue: () => null,
          },
          holders,
        };
      };

      it('should create an invisible mesh with a small placeholder box at the given position', async function () {
        const groupId = 'hierarchyGroup1';

        const returnedId = await flock.createGroup(groupId, { position: [1, 2, 3] });
        meshIds.push(groupId);

        expect(returnedId).to.equal(groupId);
        const groupMesh = flock.scene.getMeshByName(groupId);
        expect(groupMesh).to.exist;
        expect(groupMesh.getTotalVertices()).to.be.greaterThan(0);
        expect(groupMesh.visibility).to.equal(0);
        expect(groupMesh.position.x).to.be.closeTo(1, 0.01);
        expect(groupMesh.position.y).to.be.closeTo(2, 0.01);
        expect(groupMesh.position.z).to.be.closeTo(3, 0.01);
      });

      it('should keep a child at its own world position when parented, and re-centre itself onto it', async function () {
        const groupId = 'hierarchyGroup2';
        const childId = 'hierarchyGroupChild2';

        await flock.createGroup(groupId, { position: [5, 0, 0] });
        await flock.createBox(childId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [7, 0, 0],
        });
        meshIds.push(groupId, childId);

        const groupMesh = flock.scene.getMeshByName(groupId);
        const childMesh = flock.scene.getMeshByName(childId);
        const worldPosBefore = childMesh.getAbsolutePosition().clone();

        await flock.setParent(groupId, childId);

        expect(childMesh.parent).to.equal(groupMesh);
        const worldPosAfter = childMesh.getAbsolutePosition();
        expect(worldPosAfter.x).to.be.closeTo(worldPosBefore.x, 0.01);
        expect(worldPosAfter.y).to.be.closeTo(worldPosBefore.y, 0.01);
        expect(worldPosAfter.z).to.be.closeTo(worldPosBefore.z, 0.01);

        // Gaining a child also re-centres the group onto it.
        expect(groupMesh.position.x).to.be.closeTo(7, 0.01);
        expect(groupMesh.position.y).to.be.closeTo(0.5, 0.01);
        expect(groupMesh.position.z).to.be.closeTo(0, 0.01);
      });

      it('should place two children with different world positions at their own correct positions, regardless of add order', async function () {
        const groupId = 'hierarchyGroup7';
        const childIdA = 'hierarchyGroupChild7a';
        const childIdB = 'hierarchyGroupChild7b';

        await flock.createGroup(groupId, { position: [7.3, 1, -9.7] });
        await flock.createBox(childIdA, { width: 1, height: 1, depth: 1, position: [0, 1, 0] });
        await flock.setParent(groupId, childIdA);
        await flock.createBox(childIdB, { width: 1, height: 1, depth: 1, position: [3, 1, 0] });
        await flock.setParent(groupId, childIdB);
        meshIds.push(groupId, childIdA, childIdB);

        const childMeshA = flock.scene.getMeshByName(childIdA);
        const childMeshB = flock.scene.getMeshByName(childIdB);

        expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(0, 0.01);
        expect(childMeshA.getAbsolutePosition().y).to.be.closeTo(1.5, 0.01);
        expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(3, 0.01);
        expect(childMeshB.getAbsolutePosition().y).to.be.closeTo(1.5, 0.01);
      });

      it('should keep its own origin (where the gizmo attaches) at the geometric centre of its bounding box', async function () {
        const groupId = 'hierarchyGroup8';
        const childIdA = 'hierarchyGroupChild8a';
        const childIdB = 'hierarchyGroupChild8b';

        await flock.createGroup(groupId, { position: [0.4, 2.5, 0] });
        await flock.createBox(childIdA, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0.5] });
        await flock.setParent(groupId, childIdA);
        await flock.createBox(childIdB, { width: 1, height: 1, depth: 1, position: [0, 1.5, 0] });
        await flock.setParent(groupId, childIdB);
        meshIds.push(groupId, childIdA, childIdB);

        const groupMesh = flock.scene.getMeshByName(groupId);
        groupMesh.computeWorldMatrix(true);
        const bb = groupMesh.getBoundingInfo().boundingBox;

        expect(groupMesh.position.x).to.be.closeTo((bb.minimumWorld.x + bb.maximumWorld.x) / 2, 0.01);
        expect(groupMesh.position.y).to.be.closeTo((bb.minimumWorld.y + bb.maximumWorld.y) / 2, 0.01);
        expect(groupMesh.position.z).to.be.closeTo((bb.minimumWorld.z + bb.maximumWorld.z) / 2, 0.01);
      });

      it('should resize its own placeholder geometry to fit a child on setParent, at runtime with no live-edit involved', async function () {
        const groupId = 'hierarchyGroup5';
        const childId = 'hierarchyGroupChild5';

        await flock.createGroup(groupId, { position: [0, 0, 0] });
        await flock.createBox(childId, {
          width: 2,
          height: 3,
          depth: 4,
          position: [0, 0, 0],
        });
        meshIds.push(groupId, childId);

        const groupMesh = flock.scene.getMeshByName(groupId);
        const childMesh = flock.scene.getMeshByName(childId);

        const bbBefore = groupMesh.getBoundingInfo().boundingBox;
        const sizeBefore = bbBefore.maximum.subtract(bbBefore.minimum);
        expect(Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z)).to.be.lessThan(1);

        const worldPosBefore = childMesh.getAbsolutePosition().clone();
        await flock.setParent(groupId, childId);

        const bbAfter = groupMesh.getBoundingInfo().boundingBox;
        const sizeAfter = bbAfter.maximum.subtract(bbAfter.minimum);
        expect(sizeAfter.x).to.be.closeTo(2, 0.05);
        expect(sizeAfter.y).to.be.closeTo(3, 0.05);
        expect(sizeAfter.z).to.be.closeTo(4, 0.05);

        const worldPosAfter = childMesh.getAbsolutePosition();
        expect(worldPosAfter.x).to.be.closeTo(worldPosBefore.x, 0.05);
        expect(worldPosAfter.y).to.be.closeTo(worldPosBefore.y, 0.05);
        expect(worldPosAfter.z).to.be.closeTo(worldPosBefore.z, 0.05);
      });

      it('should apply rotateTo in world space regardless of the group\'s own rotation', async function () {
        const groupId = 'hierarchyGroup9';
        const childId = 'hierarchyGroupChild9';

        await flock.createGroup(groupId, { position: [0, 0, 0] });
        await flock.rotateTo(groupId, { x: 0, y: 90, z: 0 });

        await flock.createBox(childId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        await flock.setParent(groupId, childId);
        meshIds.push(groupId, childId);

        const childMesh = flock.scene.getMeshByName(childId);
        await flock.rotateTo(childId, { x: 0, y: 45, z: 0 });

        childMesh.computeWorldMatrix(true);
        const worldRotation = new flock.BABYLON.Quaternion();
        const worldScale = new flock.BABYLON.Vector3();
        const worldPos = new flock.BABYLON.Vector3();
        childMesh.getWorldMatrix().decompose(worldScale, worldRotation, worldPos);
        const worldEuler = flock.quatToEulerDegrees(worldRotation);

        expect(worldEuler.y).to.be.closeTo(45, 0.5);
      });

      it('should reproduce a group rotation from baked member world orientations with the group at identity', async function () {
        const groupId = 'hierarchyGroup10';
        const childId = 'hierarchyGroupChild10';

        await flock.createGroup(groupId, { position: [0, 0, 0] });
        await flock.createBox(childId, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
        await flock.setParent(groupId, childId);
        meshIds.push(groupId, childId);

        await flock.rotateTo(groupId, { x: 0, y: 90, z: 0 });

        const childMesh = flock.scene.getMeshByName(childId);
        childMesh.computeWorldMatrix(true);
        const bakedRotation = new flock.BABYLON.Quaternion();
        const bakedScale = new flock.BABYLON.Vector3();
        const bakedPos = new flock.BABYLON.Vector3();
        childMesh.getWorldMatrix().decompose(bakedScale, bakedRotation, bakedPos);
        const bakedEuler = flock.quatToEulerDegrees(bakedRotation);
        const bakedWorldPos = childMesh.getAbsolutePosition().clone();

        await flock.rotateTo(groupId, { x: 0, y: 0, z: 0 });
        await flock.rotateTo(childId, { x: bakedEuler.x, y: bakedEuler.y, z: bakedEuler.z });

        childMesh.computeWorldMatrix(true);
        const finalRotation = new flock.BABYLON.Quaternion();
        const finalScale = new flock.BABYLON.Vector3();
        const finalPos = new flock.BABYLON.Vector3();
        childMesh.getWorldMatrix().decompose(finalScale, finalRotation, finalPos);
        const finalEuler = flock.quatToEulerDegrees(finalRotation);

        expect(finalEuler.y).to.be.closeTo(bakedEuler.y, 0.5);
        expect(childMesh.getAbsolutePosition().x).to.be.closeTo(bakedWorldPos.x, 0.05);
        expect(childMesh.getAbsolutePosition().z).to.be.closeTo(bakedWorldPos.z, 0.05);
      });

      it('should rebuild a rotated non-cubic member at its baked world base, matching the live scene', async function () {
        // Live: a tall member parented to a group, group pitched 90 degrees
        // about X. The bake (updateChildBlockRotations) stores the member's
        // world base Y in its block. Play rebuilds from those baked values in
        // generated order: create (base-anchored) -> setParent -> rotateTo.
        // The rebuild must land on the same world base the gizmo showed.
        const groupId = 'hierarchyGroupRotBase';
        const childId = 'hierarchyGroupRotBaseChild';

        await flock.createGroup(groupId, { position: [0, 0, 0] });
        await flock.createBox(childId, {
          width: 1,
          height: 2,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.setParent(groupId, childId);
        meshIds.push(groupId, childId);

        await flock.rotateTo(groupId, { x: 90, y: 0, z: 0 });

        const childMesh = flock.scene.getMeshByName(childId);
        const baked = flock.getBlockPositionFromMesh(childMesh);
        const worldQuat = new flock.BABYLON.Quaternion();
        const worldScale = new flock.BABYLON.Vector3();
        const worldPos = new flock.BABYLON.Vector3();
        childMesh.computeWorldMatrix(true);
        childMesh.getWorldMatrix().decompose(worldScale, worldQuat, worldPos);
        const bakedEuler = flock.quatToEulerDegrees(worldQuat);

        // Play: fresh build from the baked block values.
        const groupId2 = 'hierarchyGroupRotBase2';
        const childId2 = 'hierarchyGroupRotBaseChild2';
        await flock.createGroup(groupId2, { position: [0, 0, 0] });
        await flock.createBox(childId2, {
          width: 1,
          height: 2,
          depth: 1,
          position: [baked.x, baked.y, baked.z],
        });
        await flock.setParent(groupId2, childId2);
        meshIds.push(groupId2, childId2);
        await flock.rotateTo(childId2, {
          x: bakedEuler.x,
          y: bakedEuler.y,
          z: bakedEuler.z,
        });

        const rebuiltMesh = flock.scene.getMeshByName(childId2);
        const rebuilt = flock.getBlockPositionFromMesh(rebuiltMesh);
        expect(rebuilt.y).to.be.closeTo(baked.y, 0.05);
        expect(rebuilt.x).to.be.closeTo(baked.x, 0.05);
        expect(rebuilt.z).to.be.closeTo(baked.z, 0.05);
      });

      it('should notify the selection follower when a drop groups a mesh', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupFollower', { position: [0, 0, 0] });
        const childName = await flock.createBox('hierarchyGroupFollowerChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = 'followerGroup';
        childMesh.metadata = childMesh.metadata || {};
        childMesh.metadata.blockKey = 'followerChild';
        meshIds.push(groupName, childName);

        const memberMock = {
          id: 'followerChild',
          type: 'create_box',
          disposed: false,
          getSurroundParent: () => groupMock,
          getNextBlock: () => null,
        };
        const groupMock = {
          id: 'followerGroup',
          type: 'create_group',
          disposed: false,
          getFieldValue: (f) => (f === 'ACTIVE' ? 'TRUE' : null),
          getInput: (name) =>
            name === 'DO' ? { connection: { targetBlock: () => memberMock } } : null,
        };

        const calls = [];
        setGroupSelectionFollower((m, g) => calls.push([m, g]));
        try {
          const result = syncGroupParentOnMove(childMesh, memberMock);
          expect(childMesh.parent).to.equal(groupMesh);
          expect(result).to.equal(groupMesh);
          expect(calls).to.have.lengthOf(1);
          expect(calls[0][0]).to.equal(childMesh);
          expect(calls[0][1]).to.equal(groupMesh);

          // Already grouped: no-op, no second notification.
          syncGroupParentOnMove(childMesh, memberMock);
          expect(calls).to.have.lengthOf(1);

          // Dragged back out: unparents, and the follower stays silent.
          memberMock.getSurroundParent = () => null;
          expect(syncGroupParentOnMove(childMesh, memberMock)).to.equal(null);
          expect(childMesh.parent).to.equal(null);
          expect(calls).to.have.lengthOf(1);
        } finally {
          // No other test in this harness depends on the app's own
          // registration (set at setGizmoManager time).
          setGroupSelectionFollower(null);
        }
      });

      it('should resolve colour to the member, not the group', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupColorRoot', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupColorRootA', {
          width: 1, height: 1, depth: 1, position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupColorRootB', {
          width: 1, height: 1, depth: 1, position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        expect(getColorRoot(childMeshA)).to.equal(childMeshA);
        expect(getColorRoot(childMeshB)).to.equal(childMeshB);
        expect(getColorRoot(groupMesh)).to.equal(groupMesh);

        // A nested part rides with its member top, not the group.
        const partName = await flock.createBox('hierarchyGroupColorRootPart', {
          width: 0.5, height: 0.5, depth: 0.5, position: [0, 2, 0],
        });
        const partMesh = flock.scene.getMeshByName(partName);
        partMesh.setParent(childMeshA);
        try {
          expect(getColorRoot(partMesh)).to.equal(childMeshA);
        } finally {
          partMesh.setParent(null);
          flock.dispose(partName);
        }

        // Outside groups, hierarchies still resolve together.
        childMeshB.setParent(null);
        childMeshB.setParent(childMeshA);
        try {
          expect(getColorRoot(childMeshB)).to.equal(childMeshA);
          expect(getColorRoot(childMeshA)).to.equal(childMeshA);
        } finally {
          childMeshB.setParent(null);
          childMeshB.setParent(groupMesh);
        }
      });

      it('should paint only the edited member of a group', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupColorPaint', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupColorPaintA', {
          width: 1, height: 1, depth: 1, position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupColorPaintB', {
          width: 1, height: 1, depth: 1, position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        const diffuse = (m) => m.material?.diffuseColor?.toHexString?.() ?? null;
        const beforeB = diffuse(childMeshB);

        handleMaterialOrColorChange(childMeshA, {}, 'COLOR', '#ff0000', null);

        expect(diffuse(childMeshA)?.toLowerCase()).to.equal('#ff0000');
        expect(diffuse(childMeshB)).to.equal(beforeB);
      });

      it("should write the picked member's own colour target, not the group's", async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupColorPick', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupColorPickA', {
          width: 1, height: 1, depth: 1, position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupColorPickB', {
          width: 1, height: 1, depth: 1, position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        const colorTarget = () => {
          const state = { _c: null };
          return {
            state,
            block: {
              getField: (f) => (f === 'COLOR' ? {} : null),
              setFieldValue: (v) => {
                state._c = v;
              },
            },
          };
        };
        const memberMock = (id, target) => ({
          id,
          type: 'create_box',
          disposed: false,
          inputList: [{ name: 'COLOR', connection: { targetBlock: () => target.block } }],
        });
        const targetA = colorTarget();
        const targetB = colorTarget();
        const mockA = memberMock('colorPickA', targetA);
        const mockB = memberMock('colorPickB', targetB);
        // The group resolves first pre-fix and writes the DO chain's first
        // member; keep it registered so the test is faithful to the app.
        const groupMock = {
          id: 'colorPickGroup',
          type: 'create_group',
          disposed: false,
          inputList: [{ name: 'DO', connection: { targetBlock: () => mockA } }],
        };
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = groupMock.id;
        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = mockA.id;
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = mockB.id;
        meshMap[groupMock.id] = groupMock;
        meshMap[mockA.id] = mockA;
        meshMap[mockB.id] = mockB;
        try {
          updateBlockColorAndHighlight(childMeshB, '#00ff00');
          expect(targetB.state._c).to.equal('#00ff00');
          expect(targetA.state._c).to.equal(null);
        } finally {
          delete meshMap[groupMock.id];
          delete meshMap[mockA.id];
          delete meshMap[mockB.id];
        }
      });

      it('should fold a group scale into member blocks and reset the group to identity', async function () {        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupBake', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupBakeChildA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupBakeChildB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [4, 0, 0],
        });
        // Parent synchronously: the async setParent API is covered by the
        // tests above; bakeGroupScale itself is fully synchronous.
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        // Disposing the group disposes its children too - pushing the
        // children as well would hang awaiting an already-disposed mesh.
        meshIds.push(groupName);

        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = 'bakeKeyA';
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = 'bakeKeyB';

        const mockA = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 0, Y: 0, Z: 0 });
        const mockB = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 4, Y: 0, Z: 0 });
        meshMap['bakeKeyA'] = mockA.block;
        meshMap['bakeKeyB'] = mockB.block;
        try {
          cacheGroupScaleBaseline(groupMesh);
          groupMesh.scaling.set(2, 2, 2);
          groupMesh.computeWorldMatrix(true);

          expect(bakeGroupScale(groupMesh)).to.be.true;

          expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
          expect(groupMesh.scaling.y).to.be.closeTo(1, 1e-6);
          expect(groupMesh.scaling.z).to.be.closeTo(1, 1e-6);

          expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(-2, 0.05);
          expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(6, 0.05);
          expect(childMeshA.getAbsolutePosition().y).to.be.closeTo(0.5, 0.05);
          expect(childMeshB.getAbsolutePosition().y).to.be.closeTo(0.5, 0.05);

          expect(mockA.holders.WIDTH._v).to.be.closeTo(2, 0.05);
          expect(mockB.holders.WIDTH._v).to.be.closeTo(2, 0.05);
          expect(mockA.holders.X._v).to.be.closeTo(-2, 0.05);
          expect(mockB.holders.X._v).to.be.closeTo(6, 0.05);
          expect(mockA.holders.Y._v).to.be.closeTo(-0.5, 0.05);

          const keysBefore = Object.keys(meshMap);
          cacheGroupScaleBaseline(groupMesh);
          expect(bakeGroupScale(groupMesh)).to.be.false;
          expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
          expect(Object.keys(meshMap)).to.deep.equal(keysBefore);
        } finally {
          delete meshMap['bakeKeyA'];
          delete meshMap['bakeKeyB'];
        }
      });

      it('should write scale-baked member values at 1dp and snap live onto them', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupBake1dp', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupBake1dpA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [1, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupBake1dpB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [3, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = 'bake1dpA';
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = 'bake1dpB';

        const mockA = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 1, Y: 0, Z: 0 });
        const mockB = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 3, Y: 0, Z: 0 });
        meshMap['bake1dpA'] = mockA.block;
        meshMap['bake1dpB'] = mockB.block;
        try {
          cacheGroupScaleBaseline(groupMesh);
          // Irrational factor: exact live values cannot be 1dp, so the blocks
          // must round and the scene must snap onto the rounded values.
          groupMesh.scaling.set(Math.SQRT2, Math.SQRT2, Math.SQRT2);
          groupMesh.computeWorldMatrix(true);

          expect(bakeGroupScale(groupMesh)).to.be.true;

          const is1dp = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6;
          for (const holders of [mockA.holders, mockB.holders]) {
            for (const v of Object.values(holders).map((h) => h._v)) {
              expect(v, 'baked block value at 1dp').to.satisfy(is1dp);
            }
          }

          // Far tighter than the ±0.05 rounding band: live was snapped.
          for (const [mesh, holders] of [
            [childMeshA, mockA.holders],
            [childMeshB, mockB.holders],
          ]) {
            const live = flock.getBlockPositionFromMesh(mesh);
            expect(live.x).to.be.closeTo(holders.X._v, 1e-4);
            expect(live.y).to.be.closeTo(holders.Y._v, 1e-4);
            expect(live.z).to.be.closeTo(holders.Z._v, 1e-4);
          }
        } finally {
          delete meshMap['bake1dpA'];
          delete meshMap['bake1dpB'];
        }
      });

      it('should write rotation-baked member values at 1dp and snap live onto them', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupRot1dp', { position: [0, 0, 0] });
        const childName = await flock.createBox('hierarchyGroupRot1dpChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [2, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        childMesh.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = 'rot1dpGroup';

        const mockRotBlock = () => {
          const holders = {};
          const inputs = {};
          for (const name of ['X', 'Y', 'Z']) {
            const holder = { _v: 0 };
            holders[name] = holder;
            inputs[name] = {
              connection: {
                targetBlock: () => ({
                  getField: (f) => (f === 'NUM' ? {} : null),
                  getFieldValue: () => String(holder._v),
                  setFieldValue: (nv) => {
                    holder._v = Number(nv);
                  },
                }),
              },
            };
          }
          return {
            holders,
            block: {
              id: 'rot_rot1dpChild',
              type: 'rotate_to',
              disposed: false,
              getFieldValue: (f) => (f === 'MODEL' ? 'rot1dpVar' : null),
              getInput: (name) => inputs[name] || null,
              getNextBlock: () => null,
            },
          };
        };
        const rot = mockRotBlock();
        const memberHolders = {};
        const memberInputs = {};
        for (const [name, v] of Object.entries({ X: 2, Y: 0, Z: 0 })) {
          const holder = { _v: v };
          memberHolders[name] = holder;
          memberInputs[name] = {
            connection: {
              targetBlock: () => ({
                getField: (f) => (f === 'NUM' ? {} : null),
                getFieldValue: () => String(holder._v),
                setFieldValue: (nv) => {
                  holder._v = Number(nv);
                },
              }),
            },
          };
        }
        memberInputs.DO = { connection: { targetBlock: () => rot.block } };
        const memberBlock = {
          id: 'rot1dpChild',
          type: 'create_box',
          disposed: false,
          getFieldValue: (f) => (f === 'ID_VAR' ? 'rot1dpVar' : null),
          getInput: (name) => memberInputs[name] || null,
        };
        childMesh.metadata = childMesh.metadata || {};
        childMesh.metadata.blockKey = memberBlock.id;
        meshMap[memberBlock.id] = memberBlock;
        try {
          // 45 degrees orbits the member to irrational coordinates.
          groupMesh.rotationQuaternion = flock.eulerDegreesToQuat(0, 45, 0);
          groupMesh.computeWorldMatrix(true);

          updateChildBlockRotations(groupMesh);

          const is1dp = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6;
          for (const v of Object.values(memberHolders).map((h) => h._v)) {
            expect(v, 'baked position at 1dp').to.satisfy(is1dp);
          }
          for (const v of Object.values(rot.holders).map((h) => h._v)) {
            expect(v, 'baked rotation at 1dp').to.satisfy(is1dp);
          }
          expect(rot.holders.Y._v).to.be.closeTo(45, 0.1);

          const live = flock.getBlockPositionFromMesh(childMesh);
          expect(live.x).to.be.closeTo(memberHolders.X._v, 1e-4);
          expect(live.y).to.be.closeTo(memberHolders.Y._v, 1e-4);
          expect(live.z).to.be.closeTo(memberHolders.Z._v, 1e-4);
        } finally {
          delete meshMap[memberBlock.id];
        }
      });

      it('should fold a non-uniform group scale into members without a baseline', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupBakeNU', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupBakeNUChildA', {
          width: 1,
          height: 2,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupBakeNUChildB', {
          width: 1,
          height: 2,
          depth: 1,
          position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = 'bakeNUKeyA';
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = 'bakeNUKeyB';
        const mockA = mockBoxBlock({ WIDTH: 1, HEIGHT: 2, DEPTH: 1, X: 0, Y: 0, Z: 0 });
        const mockB = mockBoxBlock({ WIDTH: 1, HEIGHT: 2, DEPTH: 1, X: 4, Y: 0, Z: 0 });
        meshMap['bakeNUKeyA'] = mockA.block;
        meshMap['bakeNUKeyB'] = mockB.block;
        try {
          // No baseline cached: the input-derived path must still bake.
          groupMesh.scaling.set(2, 1, 1);
          groupMesh.computeWorldMatrix(true);

          expect(bakeGroupScale(groupMesh)).to.be.true;

          expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
          expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(-2, 0.05);
          expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(6, 0.05);
          expect(mockA.holders.WIDTH._v).to.be.closeTo(2, 0.05);
          expect(mockB.holders.WIDTH._v).to.be.closeTo(2, 0.05);
          expect(mockA.holders.HEIGHT._v).to.be.closeTo(2, 0.05);
          expect(mockA.holders.X._v).to.be.closeTo(-2, 0.05);
          expect(mockB.holders.X._v).to.be.closeTo(6, 0.05);
        } finally {
          delete meshMap['bakeNUKeyA'];
          delete meshMap['bakeNUKeyB'];
        }
      });

      it('should chain repeated uniform group scale bakes into member blocks', async function () {
        this.timeout(30000);

        const groupName = await flock.createGroup('hierarchyGroupBakeRepeat', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupBakeRepeatA', {
          width: 4,
          height: 4,
          depth: 4,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupBakeRepeatB', {
          width: 2,
          height: 2,
          depth: 2,
          position: [6, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = 'bakeRepeatKeyA';
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = 'bakeRepeatKeyB';
        const mockA = mockBoxBlock({ WIDTH: 4, HEIGHT: 4, DEPTH: 4, X: 0, Y: 0, Z: 0 });
        const mockB = mockBoxBlock({ WIDTH: 2, HEIGHT: 2, DEPTH: 2, X: 6, Y: 0, Z: 0 });
        meshMap['bakeRepeatKeyA'] = mockA.block;
        meshMap['bakeRepeatKeyB'] = mockB.block;
        try {
          let expectedAX = 0;
          let expectedBX = 6;
          let expectedWA = 4;
          let expectedWB = 2;
          for (let i = 0; i < 5; i++) {
            cacheGroupScaleBaseline(groupMesh);
            groupMesh.scaling.set(1.5, 1.5, 1.5);
            groupMesh.computeWorldMatrix(true);
            expect(bakeGroupScale(groupMesh), `bake ${i}`).to.be.true;
            expectedAX = 2.5 + 1.5 * (expectedAX - 2.5);
            expectedBX = 2.5 + 1.5 * (expectedBX - 2.5);
            expectedWA *= 1.5;
            expectedWB *= 1.5;
            expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(expectedAX, 0.1);
            expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(expectedBX, 0.1);
            expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
            expect(mockA.holders.WIDTH._v).to.be.closeTo(expectedWA, 0.2);
            expect(mockB.holders.WIDTH._v).to.be.closeTo(expectedWB, 0.2);
          }
        } finally {
          delete meshMap['bakeRepeatKeyA'];
          delete meshMap['bakeRepeatKeyB'];
        }
      });

      it('should decline to bake a non-uniform scale over rotated members', async function () {        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupBakeLegacy', { position: [0, 0, 0] });
        const childName = await flock.createBox('hierarchyGroupBakeLegacyChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [2, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        childMesh.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        childMesh.metadata = childMesh.metadata || {};
        childMesh.metadata.blockKey = 'bakeLegacyKey';
        const mock = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 2, Y: 0, Z: 0 });
        meshMap['bakeLegacyKey'] = mock.block;
        try {
          childMesh.rotationQuaternion = flock.eulerDegreesToQuat(0, 45, 0);
          childMesh.computeWorldMatrix(true);
          groupMesh.scaling.set(2, 1, 1);
          groupMesh.computeWorldMatrix(true);

          expect(bakeGroupScale(groupMesh)).to.be.false;
          expect(groupMesh.scaling.x).to.be.closeTo(2, 1e-6);
          expect(mock.holders.WIDTH._v).to.be.closeTo(1, 1e-6);
        } finally {
          delete meshMap['bakeLegacyKey'];
        }
      });

      it('should bake past nested meshes that own no blocks', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupBakeNested', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupBakeNestedA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupBakeNestedB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 2, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        // A nested mesh with no block of its own, like a model part: it must
        // neither block the bake nor receive size writes, just ride along.
        delete childMeshB.metadata.blockKey;
        childMeshB.setParent(childMeshA);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = 'bakeNestedKey';
        const mock = mockBoxBlock({ WIDTH: 1, HEIGHT: 1, DEPTH: 1, X: 0, Y: 0, Z: 0 });
        meshMap['bakeNestedKey'] = mock.block;
        try {
          cacheGroupScaleBaseline(groupMesh);
          groupMesh.scaling.set(2, 2, 2);
          groupMesh.computeWorldMatrix(true);

          expect(bakeGroupScale(groupMesh)).to.be.true;

          expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
          expect(mock.holders.WIDTH._v).to.be.closeTo(2, 0.05);
          expect(childMeshB.getAbsolutePosition().y).to.be.closeTo(3.5, 0.05);
        } finally {
          delete meshMap['bakeNestedKey'];
        }
      });

      it('should bake member world positions when the group rotates', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupRotBake', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupRotBakeA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupRotBakeB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        const mockRotBlock = (modelVar) => {
          const holders = {};
          const inputs = {};
          for (const name of ['X', 'Y', 'Z']) {
            const holder = { _v: 0 };
            holders[name] = holder;
            inputs[name] = {
              connection: {
                targetBlock: () => ({
                  getField: (f) => (f === 'NUM' ? {} : null),
                  getFieldValue: () => String(holder._v),
                  setFieldValue: (nv) => {
                    holder._v = Number(nv);
                  },
                }),
              },
            };
          }
          return {
            holders,
            block: {
              id: `rot_${modelVar}`,
              type: 'rotate_to',
              disposed: false,
              getFieldValue: (f) => (f === 'MODEL' ? modelVar : null),
              getInput: (name) => inputs[name] || null,
              getNextBlock: () => null,
            },
          };
        };
        const mockMember = (modelVar, values) => {
          const holders = {};
          const inputs = {};
          for (const [name, v] of Object.entries(values)) {
            const holder = { _v: v };
            holders[name] = holder;
            inputs[name] = {
              connection: {
                targetBlock: () => ({
                  getField: (f) => (f === 'NUM' ? {} : null),
                  getFieldValue: () => String(holder._v),
                  setFieldValue: (nv) => {
                    holder._v = Number(nv);
                  },
                }),
              },
            };
          }
          const rot = mockRotBlock(modelVar);
          inputs.DO = { connection: { targetBlock: () => rot.block } };
          return {
            holders,
            rotHolders: rot.holders,
            block: {
              id: `member_${modelVar}`,
              type: 'create_box',
              disposed: false,
              getFieldValue: (f) => (f === 'ID_VAR' ? modelVar : null),
              getInput: (name) => inputs[name] || null,
            },
          };
        };
        const mockA = mockMember('rotVarA', { X: 0, Y: 0, Z: 0 });
        const mockB = mockMember('rotVarB', { X: 4, Y: 0, Z: 0 });
        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = mockA.block.id;
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = mockB.block.id;
        meshMap[mockA.block.id] = mockA.block;
        meshMap[mockB.block.id] = mockB.block;
        try {
          groupMesh.rotationQuaternion = flock.eulerDegreesToQuat(0, 90, 0);
          groupMesh.computeWorldMatrix(true);

          updateChildBlockRotations(groupMesh);

          const liveA = childMeshA.getAbsolutePosition();
          const liveB = childMeshB.getAbsolutePosition();
          expect(mockA.holders.X._v).to.be.closeTo(liveA.x, 0.05);
          expect(mockA.holders.Z._v).to.be.closeTo(liveA.z, 0.05);
          expect(mockB.holders.X._v).to.be.closeTo(liveB.x, 0.05);
          expect(mockB.holders.Z._v).to.be.closeTo(liveB.z, 0.05);
          expect(mockA.rotHolders.Y._v).to.be.closeTo(90, 0.5);
          expect(liveA.x).to.not.be.closeTo(0, 0.5);
        } finally {
          delete meshMap[mockA.block.id];
          delete meshMap[mockB.block.id];
        }
      });

      it('should re-anchor a drifted group origin to its members', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupHeal', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupHealA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupHealB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        // Drift the origin alone (members detached so they hold still),
        // then reattach: this is the state that would multiply offsets on
        // the next scale if left in place.
        childMeshA.setParent(null);
        childMeshB.setParent(null);
        const beforeA = childMeshA.getAbsolutePosition().clone();
        const beforeB = childMeshB.getAbsolutePosition().clone();
        groupMesh.position.x += 7.5;
        groupMesh.computeWorldMatrix(true);
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);

        healGroupOrigin(groupMesh);

        expect(groupMesh.position.x).to.be.closeTo(2, 0.05);
        expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(beforeA.x, 0.05);
        expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(beforeB.x, 0.05);

        // Already aligned: no-op.
        const ox = groupMesh.position.x;
        healGroupOrigin(groupMesh);
        expect(groupMesh.position.x).to.be.closeTo(ox, 1e-6);
      });

      it('should commit a gizmo scale drag without creating a group resize block', async function () {        this.timeout(15000);
        if (!Blockly.getMainWorkspace()) {
          Blockly.common?.setMainWorkspace?.(new Blockly.Workspace());
        }

        const ws = new Blockly.Workspace();
        const vnum = (parent, input, v) => {
          const holder = { _v: v };
          const n = ws.newBlock('math_number');
          n.setFieldValue(String(v), 'NUM');
          n.setShadow(true);
          parent.getInput(input).connection.connect(n.outputConnection);
          return holder;
        };
        const holders = {};
        const rbox = (idVar, x) => {
          const b = ws.newBlock('create_box');
          const vm = ws.getVariableMap();
          let v = vm.getVariable(idVar);
          if (!v) v = vm.createVariable(idVar);
          b.getField('ID_VAR').setValue(typeof v.getId === 'function' ? v.getId() : v.id);
          holders[idVar] = {};
          for (const [name, val] of [
            ['WIDTH', 1],
            ['HEIGHT', 1],
            ['DEPTH', 1],
            ['X', x],
            ['Y', 0],
            ['Z', 0],
          ]) {
            holders[idVar][name] = vnum(b, name, val);
          }
          return b;
        };

        const groupName = await flock.createGroup('hierarchyGroupCommit', { position: [0, 0, 0] });
        const childNameA = await flock.createBox('hierarchyGroupCommitA', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const childNameB = await flock.createBox('hierarchyGroupCommitB', {
          width: 1,
          height: 1,
          depth: 1,
          position: [4, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMeshA = flock.scene.getMeshByName(childNameA);
        const childMeshB = flock.scene.getMeshByName(childNameB);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMeshA, 'child A created').to.exist;
        expect(childMeshB, 'child B created').to.exist;
        childMeshA.setParent(groupMesh);
        childMeshB.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        const boxBlockA = rbox('commitBoxA', 0);
        const boxBlockB = rbox('commitBoxB', 4);
        childMeshA.metadata = childMeshA.metadata || {};
        childMeshA.metadata.blockKey = boxBlockA.id;
        childMeshB.metadata = childMeshB.metadata || {};
        childMeshB.metadata.blockKey = boxBlockB.id;
        meshMap[boxBlockA.id] = boxBlockA;
        meshMap[boxBlockB.id] = boxBlockB;
        const groupBlock = ws.newBlock('create_group');
        const gvm = ws.getVariableMap();
        let gv = gvm.getVariable('commitGroup');
        if (!gv) gv = gvm.createVariable('commitGroup');
        groupBlock.getField('ID_VAR').setValue(typeof gv.getId === 'function' ? gv.getId() : gv.id);
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = groupBlock.id;
        meshMap[groupBlock.id] = groupBlock;
        const bottomY = flock.getEffectiveWorldBounds(groupMesh).min.y;
        try {
          // Drag-start: capture the baseline.
          cacheGroupScaleBaseline(groupMesh);
          // Drag: scale the group node.
          groupMesh.scaling.set(2, 2, 2);
          groupMesh.computeWorldMatrix(true);
          // Drag-end commit through the real updateScaleBlock path.
          updateScaleBlock(groupMesh, bottomY);

          expect(groupMesh.scaling.x).to.be.closeTo(1, 1e-6);
          expect(childMeshA.getAbsolutePosition().x).to.be.closeTo(-2, 0.05);
          expect(childMeshB.getAbsolutePosition().x).to.be.closeTo(6, 0.05);
          const numVal = (b, name) =>
            Number(b.getInput(name).connection.targetBlock().getFieldValue('NUM'));
          expect(numVal(boxBlockA, 'WIDTH')).to.be.closeTo(2, 0.05);
          expect(numVal(boxBlockB, 'WIDTH')).to.be.closeTo(2, 0.05);
          expect(numVal(boxBlockA, 'X')).to.be.closeTo(-2, 0.05);
          expect(numVal(boxBlockB, 'X')).to.be.closeTo(6, 0.05);
          const resizeBlocks = ws
            .getAllBlocks(false)
            .filter((b) => b.type === 'resize');
          expect(resizeBlocks).to.have.lengthOf(0);
        } finally {
          delete meshMap[boxBlockA.id];
          delete meshMap[boxBlockB.id];
          delete meshMap[groupBlock.id];
          ws.dispose();
        }
      });

      it('should move gizmo attachment to the group when its mesh is grouped', async function () {
        this.timeout(15000);

        // The attach wrapper installed by setGizmoManager reads the main
        // workspace; the commit test above guarantees one exists by now.
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;

        const groupName = await flock.createGroup('hierarchyGroupAttach', { position: [0, 0, 0] });
        const childName = await flock.createBox('hierarchyGroupAttachChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = 'attachGroup';
        childMesh.metadata = childMesh.metadata || {};
        childMesh.metadata.blockKey = 'attachChild';
        meshIds.push(groupName, childName);

        const memberMock = {
          id: 'attachChild',
          type: 'create_box',
          disposed: false,
          getSurroundParent: () => groupMock,
          getNextBlock: () => null,
        };
        const groupMock = {
          id: 'attachGroup',
          type: 'create_group',
          disposed: false,
          getFieldValue: (f) => (f === 'ACTIVE' ? 'TRUE' : null),
          getInput: (name) =>
            name === 'DO' ? { connection: { targetBlock: () => memberMock } } : null,
        };

        // Stand-in for the real GizmoManager: records what it is told to
        // attach. The wrapper installed by setGizmoManager climbs to the
        // root, skips locked-mesh handling (no tool active) and records.
        const fake = {
          attachedMesh: childMesh,
          attachedTo: null,
          attachToMesh(m) {
            this.attachedTo = m;
          },
        };
        const previousGizmoManager = gizmoManager;
        setGizmoManager(fake);
        try {
          syncGroupParentOnMove(childMesh, memberMock);
          expect(childMesh.parent).to.equal(groupMesh);
          expect(fake.attachedTo).to.equal(groupMesh);
        } finally {
          fake.attachedMesh = null;
          fake.attachedTo = null;
          setGizmoManager(previousGizmoManager);
        }
      });

      it('should scale a grouped member locally, matching a fresh build', async function () {
        this.timeout(15000);

        // The change event resolves its shadow through the main workspace.
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;

        const numShadow = (parent, input, v) => {
          const n = ws.newBlock('math_number');
          n.setFieldValue(String(v), 'NUM');
          n.setShadow(true);
          parent.getInput(input).connection.connect(n.outputConnection);
          return n;
        };
        const memberBlock = (width) => {
          const b = ws.newBlock('create_box');
          numShadow(b, 'WIDTH', width);
          numShadow(b, 'HEIGHT', 2);
          numShadow(b, 'DEPTH', 1);
          return b;
        };

        for (const [tag, groupEuler] of [
          ['rotated', { x: 0, y: 30, z: 0 }],
          ['identity', { x: 0, y: 0, z: 0 }],
        ]) {
          const groupName = await flock.createGroup(`hierarchyGroupScaleEdit${tag}`, {
            position: [0, 0, 0],
          });
          const childName = await flock.createBox(`hierarchyGroupScaleEditChild${tag}`, {
            width: 1,
            height: 2,
            depth: 1,
            position: [2, 0, 0],
          });
          const groupMesh = flock.scene.getMeshByName(groupName);
          const childMesh = flock.scene.getMeshByName(childName);
          expect(groupMesh, 'group mesh created').to.exist;
          expect(childMesh, 'child created').to.exist;
          childMesh.setParent(groupMesh);
          flock.recomputeGroupGeometry(groupMesh);
          meshIds.push(groupName, childName);

          await flock.rotateTo(groupName, groupEuler);

          const b = memberBlock(3);
          const widthShadow = b.getInput('WIDTH').connection.targetBlock();
          const groupMock = {
            id: groupMesh.metadata.blockKey,
            type: 'create_group',
            disposed: false,
          };
          meshMap[groupMock.id] = groupMock;
          const blocksToDispose = [b, widthShadow];
          try {
            childMesh.computeWorldMatrix(true);
            const beforeQ = new flock.BABYLON.Quaternion();
            const beforeS = new flock.BABYLON.Vector3();
            const beforeP = new flock.BABYLON.Vector3();
            childMesh.getWorldMatrix().decompose(beforeS, beforeQ, beforeP);
            const beforeBase = flock.getBlockPositionFromMesh(childMesh);

            updateMeshFromBlock([childMesh], b, {
              type: Blockly.Events.BLOCK_CHANGE,
              element: 'field',
              name: 'NUM',
              blockId: widthShadow.id,
            });

            // Geometry applies synchronously; the re-anchor runs async.
            childMesh.computeWorldMatrix(true);
            childMesh.refreshBoundingInfo();
            const local = childMesh.getBoundingInfo().boundingBox;
            expect(
              (local.maximum.x - local.minimum.x) * Math.abs(childMesh.scaling.x),
              `${tag} width applied`
            ).to.be.closeTo(3, 0.05);

            const start = Date.now();
            let live = flock.getBlockPositionFromMesh(childMesh);
            while (
              Math.abs(live.x - beforeBase.x) > 0.05 ||
              Math.abs(live.y - beforeBase.y) > 0.05 ||
              Math.abs(live.z - beforeBase.z) > 0.05
            ) {
              if (Date.now() - start > 5000) break;
              await new Promise((r) => setTimeout(r, 50));
              live = flock.getBlockPositionFromMesh(childMesh);
            }
            expect(live.x, `${tag} anchor x`).to.be.closeTo(beforeBase.x, 0.05);
            expect(live.y, `${tag} anchor y`).to.be.closeTo(beforeBase.y, 0.05);
            expect(live.z, `${tag} anchor z`).to.be.closeTo(beforeBase.z, 0.05);

            // Orientation untouched: scaling is local, like a fresh build.
            childMesh.computeWorldMatrix(true);
            const afterQ = new flock.BABYLON.Quaternion();
            const afterS = new flock.BABYLON.Vector3();
            const afterP = new flock.BABYLON.Vector3();
            childMesh.getWorldMatrix().decompose(afterS, afterQ, afterP);
            expect(
              Math.abs(flock.BABYLON.Quaternion.Dot(beforeQ, afterQ)),
              `${tag} orientation preserved`
            ).to.be.closeTo(1, 0.001);

            // Still grouped, pivot recomputed onto the resized member.
            expect(childMesh.parent).to.equal(groupMesh);
            expect(groupMesh.position.y, `${tag} pivot recentred`).to.be.closeTo(live.y + 1, 0.1);
          } finally {
            delete meshMap[groupMock.id];
            for (const created of blocksToDispose) {
              try {
                created.dispose();
              } catch {
                /* already gone */
              }
            }
          }
        }
      });

      it('should resync the group pivot after a member resize block edit', async function () {
        this.timeout(15000);

        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;

        const groupName = await flock.createGroup('hierarchyGroupResizePivot', {
          position: [0, 0, 0],
        });
        const childName = await flock.createBox('hierarchyGroupResizePivotChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [2, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        childMesh.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName, childName);
        const staleOriginY = groupMesh.position.y;

        const resizeBlock = ws.newBlock('resize');
        const yShadow = ws.newBlock('math_number');
        yShadow.setFieldValue('2', 'NUM');
        yShadow.setShadow(true);
        resizeBlock.getInput('Y').connection.connect(yShadow.outputConnection);
        const mockMember = {
          type: 'create_box',
          disposed: false,
          getInputTargetBlock: () => null,
          getInput: () => null,
        };
        const groupMock = {
          id: groupMesh.metadata.blockKey,
          type: 'create_group',
          disposed: false,
        };
        meshMap[groupMock.id] = groupMock;
        try {
          updateMeshFromBlock([childMesh], mockMember, {
            type: Blockly.Events.BLOCK_CHANGE,
            element: 'field',
            name: 'NUM',
            blockId: yShadow.id,
          });

          // Height doubled about the base, and the pivot followed.
          const bounds = flock.getEffectiveWorldBounds(childMesh);
          expect(bounds.max.y - bounds.min.y).to.be.closeTo(2, 0.05);
          expect(childMesh.parent).to.equal(groupMesh);
          expect(groupMesh.position.y).to.be.closeTo(1, 0.05);
          expect(groupMesh.position.y).to.not.be.closeTo(staleOriginY, 0.2);
        } finally {
          delete meshMap[groupMock.id];
          try {
            resizeBlock.dispose();
          } catch {
            /* already gone */
          }
          try {
            yShadow.dispose();
          } catch {
            /* already gone */
          }
        }
      });

      it('should target the world pose, not the local one, for grouped member physics', async function () {
        this.timeout(15000);

        const groupName = await flock.createGroup('hierarchyGroupPhysTarget', { position: [0, 0, 0] });
        const childName = await flock.createBox('hierarchyGroupPhysTargetChild', {
          width: 1,
          height: 1,
          depth: 1,
          position: [2, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        childMesh.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName, childName);

        await flock.rotateTo(groupName, { x: 0, y: 30, z: 0 });

        // Stand-in for a live body: records what it is told to target. The
        // real Havok body would fling the mesh toward a wrong (local) target
        // on the next step; here the captured target itself is the assert.
        const fake = {
          disablePreStep: true,
          captured: null,
          getMotionType: () => flock.BABYLON.PhysicsMotionType.ANIMATED,
          setTargetTransform(p, q) {
            this.captured = { p: p.clone(), q: q.clone() };
          },
        };
        childMesh.physics = fake;
        try {
          await flock.positionAt(childName, { x: 2, y: 0, z: 0, useY: true });
          childMesh.computeWorldMatrix(true);
          const worldPos = childMesh.getAbsolutePosition();
          expect(fake.captured, 'positionAt targeted').to.exist;
          expect(fake.captured.p.x).to.be.closeTo(worldPos.x, 1e-4);
          expect(fake.captured.p.y).to.be.closeTo(worldPos.y, 1e-4);
          expect(fake.captured.p.z).to.be.closeTo(worldPos.z, 1e-4);
          // Local and world differ here (translated, rotated group) - a
          // local target would be nowhere near the world pose.
          expect(fake.captured.p.x).to.not.be.closeTo(childMesh.position.x, 0.1);

          await flock.rotateTo(childName, { x: 0, y: 45, z: 0 });
          const expected = flock.eulerDegreesToQuat(0, 45, 0);
          expect(fake.captured, 'rotateTo targeted').to.exist;
          expect(
            Math.abs(flock.BABYLON.Quaternion.Dot(fake.captured.q, expected))
          ).to.be.closeTo(1, 1e-4);
          childMesh.computeWorldMatrix(true);
          const worldPos2 = childMesh.getAbsolutePosition();
          expect(fake.captured.p.x).to.be.closeTo(worldPos2.x, 1e-4);
          expect(fake.captured.p.y).to.be.closeTo(worldPos2.y, 1e-4);
          expect(fake.captured.p.z).to.be.closeTo(worldPos2.z, 1e-4);
        } finally {
          delete childMesh.physics;
        }
      });

      it('should fold a group scale into a model-type member exactly once', async function () {
        this.timeout(15000);

        // findOrCreateResizeBlock seeds a *brand-new* resize block from the
        // member's current (already-scaled) size, since that's the right
        // baseline for a standalone model resize. bakeGroupScale reads that
        // member post-unparent, when its own local scaling already carries
        // the group's factor - so a fresh seed must not then be multiplied
        // by that same factor again, or the resize block ends up at
        // factor^2 instead of factor.
        //
        // findOrCreateResizeBlock's from-scratch path calls initSvg/render,
        // which need a rendered Blockly.WorkspaceSvg; this suite's main
        // workspace is headless, so those are stubbed no-ops for the
        // duration of this test (mirroring how BlockSvg behaves when
        // block.rendered is false elsewhere in the app's own code).
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;
        const hadInitSvg = Object.prototype.hasOwnProperty.call(Blockly.Block.prototype, 'initSvg');
        const hadRender = Object.prototype.hasOwnProperty.call(Blockly.Block.prototype, 'render');
        if (!Blockly.Block.prototype.initSvg) Blockly.Block.prototype.initSvg = function () {};
        if (!Blockly.Block.prototype.render) Blockly.Block.prototype.render = function () {};

        const groupName = await flock.createGroup('hierarchyGroupModelFold', { position: [0, 0, 0] });
        // Stand-in for a loaded model: any mesh with real geometry works for
        // exercising the resize-block math, since the block type (not the
        // mesh type) selects the load_model code path in scaleMemberSizeInputs.
        const childName = await flock.createBox('hierarchyGroupModelFoldChild', {
          width: 1.5,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const groupMesh = flock.scene.getMeshByName(groupName);
        const childMesh = flock.scene.getMeshByName(childName);
        expect(groupMesh, 'group mesh created').to.exist;
        expect(childMesh, 'child created').to.exist;
        childMesh.setParent(groupMesh);
        flock.recomputeGroupGeometry(groupMesh);
        meshIds.push(groupName);

        const modelBlock = ws.newBlock('load_model');
        const vm = ws.getVariableMap();
        let v = vm.getVariable('modelFoldVar');
        if (!v) v = vm.createVariable('modelFoldVar');
        modelBlock.getField('ID_VAR').setValue(typeof v.getId === 'function' ? v.getId() : v.id);
        childMesh.metadata = childMesh.metadata || {};
        childMesh.metadata.blockKey = modelBlock.id;
        meshMap[modelBlock.id] = modelBlock;

        const groupBlock = ws.newBlock('create_group');
        const gvm = ws.getVariableMap();
        let gv = gvm.getVariable('modelFoldGroup');
        if (!gv) gv = gvm.createVariable('modelFoldGroup');
        groupBlock.getField('ID_VAR').setValue(typeof gv.getId === 'function' ? gv.getId() : gv.id);
        groupMesh.metadata = groupMesh.metadata || {};
        groupMesh.metadata.blockKey = groupBlock.id;
        meshMap[groupBlock.id] = groupBlock;

        const findResizeBlock = () => {
          let cur = modelBlock.getInput('DO')?.connection?.targetBlock?.();
          while (cur) {
            if (cur.type === 'resize') return cur;
            cur = cur.getNextBlock?.();
          }
          return null;
        };
        const numVal = (b, name) =>
          Number(b.getInput(name).connection.targetBlock().getFieldValue('NUM'));

        try {
          // First bake: no resize block exists yet - findOrCreateResizeBlock
          // must create one, seeded so it lands on a single application.
          cacheGroupScaleBaseline(groupMesh);
          groupMesh.scaling.set(2, 2, 2);
          groupMesh.computeWorldMatrix(true);
          expect(bakeGroupScale(groupMesh)).to.be.true;

          const resizeBlock = findResizeBlock();
          expect(resizeBlock, 'resize block created').to.exist;
          expect(numVal(resizeBlock, 'X')).to.be.closeTo(3, 0.05); // 1.5 * 2, not * 4
          expect(numVal(resizeBlock, 'Y')).to.be.closeTo(2, 0.05);
          expect(numVal(resizeBlock, 'Z')).to.be.closeTo(2, 0.05);

          // Second bake: the resize block now exists, so the multiply path
          // applies and should chain onto the first result.
          cacheGroupScaleBaseline(groupMesh);
          groupMesh.scaling.set(1.5, 1.5, 1.5);
          groupMesh.computeWorldMatrix(true);
          expect(bakeGroupScale(groupMesh)).to.be.true;

          expect(numVal(resizeBlock, 'X')).to.be.closeTo(4.5, 0.1); // 3 * 1.5
          expect(numVal(resizeBlock, 'Y')).to.be.closeTo(3, 0.1);
          expect(numVal(resizeBlock, 'Z')).to.be.closeTo(3, 0.1);
        } finally {
          delete meshMap[modelBlock.id];
          delete meshMap[groupBlock.id];
          // Disposing the top-level blocks cascades to their connected
          // children (DO section, resize block, shadow numbers), so nothing
          // else in `created` needs disposing separately.
          if (!modelBlock.disposed) modelBlock.dispose(true);
          if (!groupBlock.disposed) groupBlock.dispose(true);
          if (!hadInitSvg) delete Blockly.Block.prototype.initSvg;
          if (!hadRender) delete Blockly.Block.prototype.render;
        }
      });

      it('should freeze the live pipeline while suppressed', async function () {
        this.timeout(15000);
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;
        const created = [];
        const track = (b) => {
          created.push(b);
          return b;
        };
        const numShadow = (parent, input, v) => {
          const n = track(ws.newBlock('math_number'));
          n.setFieldValue(String(v), 'NUM');
          n.setShadow(true);
          parent.getInput(input).connection.connect(n.outputConnection);
          return n;
        };
        const boxBlock = track(ws.newBlock('create_box'));
        const vm = ws.getVariableMap();
        let v = vm.getVariable('suppressBoxVar');
        if (!v) v = vm.createVariable('suppressBoxVar');
        boxBlock.getField('ID_VAR').setValue(typeof v.getId === 'function' ? v.getId() : v.id);
        let widthNum = null;
        for (const [name, val] of [
          ['WIDTH', 3],
          ['HEIGHT', 1],
          ['DEPTH', 1],
          ['X', 0],
          ['Y', 0],
          ['Z', 0],
        ]) {
          const n = numShadow(boxBlock, name, val);
          if (name === 'WIDTH') widthNum = n;
        }
        try {
          const meshName = await flock.createBox('suppressMesh', {
            width: 1,
            height: 1,
            depth: 1,
            position: [0, 0, 0],
          });
          meshIds.push(meshName);
          const mesh = flock.scene.getMeshByName(meshName);
          expect(mesh, 'mesh created').to.exist;
          const evt = {
            type: Blockly.Events.BLOCK_CHANGE,
            element: 'field',
            blockId: widthNum.id,
            name: 'NUM',
          };
          const halfExtent = () => mesh.getBoundingInfo().boundingBox.extendSize.x;

          suppressBlockLiveUpdates(boxBlock.id);
          updateMeshFromBlock([mesh], boxBlock, evt);
          expect(halfExtent()).to.be.closeTo(0.5, 0.02);

          unsuppressBlockLiveUpdates(boxBlock.id);
          updateMeshFromBlock([mesh], boxBlock, evt);
          expect(halfExtent()).to.be.closeTo(1.5, 0.05);
        } finally {
          unsuppressBlockLiveUpdates(boxBlock.id);
          for (const b of created.reverse()) {
            try {
              if (!b.disposed) b.dispose();
            } catch {
              /* already gone */
            }
          }
        }
      });

      it('should not suppress an unrelated block while another is suppressed', async function () {
        // A bulk operation (e.g. bakeGroupScale) suppresses only the blocks
        // it is actively writing to. Suppressed field-change events are
        // dropped, not queued for later replay, so a blanket flag would risk
        // silently eating a real, concurrent edit to a *different* block -
        // e.g. the user dropping a new object into the group a moment later.
        this.timeout(15000);
        const ws = Blockly.getMainWorkspace();
        expect(ws, 'main workspace present').to.exist;
        const created = [];
        const track = (b) => {
          created.push(b);
          return b;
        };
        const numShadow = (parent, input, v) => {
          const n = track(ws.newBlock('math_number'));
          n.setFieldValue(String(v), 'NUM');
          n.setShadow(true);
          parent.getInput(input).connection.connect(n.outputConnection);
          return n;
        };
        const makeBoxBlock = (varName, width) => {
          const b = track(ws.newBlock('create_box'));
          const vm = ws.getVariableMap();
          let v = vm.getVariable(varName);
          if (!v) v = vm.createVariable(varName);
          b.getField('ID_VAR').setValue(typeof v.getId === 'function' ? v.getId() : v.id);
          let widthNum = null;
          for (const [name, val] of [
            ['WIDTH', width],
            ['HEIGHT', 1],
            ['DEPTH', 1],
            ['X', 0],
            ['Y', 0],
            ['Z', 0],
          ]) {
            const n = numShadow(b, name, val);
            if (name === 'WIDTH') widthNum = n;
          }
          return { block: b, widthNum };
        };

        const suppressed = makeBoxBlock('unrelatedSuppressedVar', 3);
        const other = makeBoxBlock('unrelatedOtherVar', 3);

        try {
          const suppressedMeshName = await flock.createBox('unrelatedSuppressedMesh', {
            width: 1,
            height: 1,
            depth: 1,
            position: [0, 0, 0],
          });
          const otherMeshName = await flock.createBox('unrelatedOtherMesh', {
            width: 1,
            height: 1,
            depth: 1,
            position: [4, 0, 0],
          });
          meshIds.push(suppressedMeshName, otherMeshName);
          const suppressedMesh = flock.scene.getMeshByName(suppressedMeshName);
          const otherMesh = flock.scene.getMeshByName(otherMeshName);
          const halfExtent = (m) => m.getBoundingInfo().boundingBox.extendSize.x;

          suppressBlockLiveUpdates(suppressed.block.id);
          try {
            updateMeshFromBlock(
              [suppressedMesh],
              suppressed.block,
              { type: Blockly.Events.BLOCK_CHANGE, element: 'field', blockId: suppressed.widthNum.id, name: 'NUM' }
            );
            // suppressed block: no change while its own suppression is active.
            expect(halfExtent(suppressedMesh)).to.be.closeTo(0.5, 0.02);

            // A different block's field change, arriving in the same window,
            // must go through unaffected.
            updateMeshFromBlock(
              [otherMesh],
              other.block,
              { type: Blockly.Events.BLOCK_CHANGE, element: 'field', blockId: other.widthNum.id, name: 'NUM' }
            );
            expect(halfExtent(otherMesh)).to.be.closeTo(1.5, 0.05);
          } finally {
            unsuppressBlockLiveUpdates(suppressed.block.id);
          }
        } finally {
          for (const b of created.reverse()) {
            try {
              if (!b.disposed) b.dispose();
            } catch {
              /* already gone */
            }
          }
        }
      });

      it('should keep its outline aligned with two children at different world positions', async function () {
        const groupId = 'hierarchyGroup6';
        const childId1 = 'hierarchyGroupChild6a';
        const childId2 = 'hierarchyGroupChild6b';

        await flock.createGroup(groupId, { position: [4.6, 0.6, -9.4] });
        await flock.createBox(childId2, {
          width: 1,
          height: 1,
          depth: 1,
          position: [4.6, 1, -9.8],
        });
        await flock.setParent(groupId, childId2);
        await flock.createBox(childId1, {
          width: 1,
          height: 1,
          depth: 1,
          position: [4.6, 0.5, -9.0],
        });
        await flock.setParent(groupId, childId1);
        meshIds.push(groupId, childId1, childId2);

        const groupMesh = flock.scene.getMeshByName(groupId);
        const childMesh1 = flock.scene.getMeshByName(childId1);
        const childMesh2 = flock.scene.getMeshByName(childId2);

        const childBounds = childMesh1.getHierarchyBoundingVectors(true);
        flock.BABYLON.Vector3.CheckExtends(
          childMesh2.getHierarchyBoundingVectors(true).min,
          childBounds.min,
          childBounds.max
        );
        flock.BABYLON.Vector3.CheckExtends(
          childMesh2.getHierarchyBoundingVectors(true).max,
          childBounds.min,
          childBounds.max
        );

        groupMesh.computeWorldMatrix(true);
        const groupBB = groupMesh.getBoundingInfo().boundingBox;

        expect(groupBB.minimumWorld.x).to.be.closeTo(childBounds.min.x, 0.05);
        expect(groupBB.maximumWorld.x).to.be.closeTo(childBounds.max.x, 0.05);
        expect(groupBB.minimumWorld.y).to.be.closeTo(childBounds.min.y, 0.05);
        expect(groupBB.maximumWorld.y).to.be.closeTo(childBounds.max.y, 0.05);
        expect(groupBB.minimumWorld.z).to.be.closeTo(childBounds.min.z, 0.05);
        expect(groupBB.maximumWorld.z).to.be.closeTo(childBounds.max.z, 0.05);
      });

      it('should dispose the group and its children together', async function () {
        const groupId = 'hierarchyGroup3';
        const childId = 'hierarchyGroupChild3';

        await flock.createGroup(groupId, { position: [0, 0, 0] });
        await flock.createBox(childId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.setParent(groupId, childId);

        const childMesh = flock.scene.getMeshByName(childId);

        flock.dispose(groupId);

        expect(childMesh.isDisposed()).to.be.true;
        expect(flock.scene.getMeshByName(groupId)).to.not.exist;
      });

      it('should rebuild its own geometry to a centered box matching a given size', async function () {
        const groupId = 'hierarchyGroup4';

        await flock.createGroup(groupId, { position: [0, 2, 0] });
        meshIds.push(groupId);
        const groupMesh = flock.scene.getMeshByName(groupId);

        flock.rebuildGroupGeometry(groupMesh, 2, 3, 4);

        const bb = groupMesh.getBoundingInfo().boundingBox;
        expect(bb.minimum.y).to.be.closeTo(-1.5, 0.01);
        expect(bb.maximum.y).to.be.closeTo(1.5, 0.01);
        expect(bb.minimum.x).to.be.closeTo(-1, 0.01);
        expect(bb.maximum.x).to.be.closeTo(1, 0.01);
        expect(bb.minimum.z).to.be.closeTo(-2, 0.01);
        expect(bb.maximum.z).to.be.closeTo(2, 0.01);
      });
    });

    describe('removeParent', function () {
      it('should remove the parent from the child mesh', async function () {
        const parentId = 'hierarchyParent3';
        const childId = 'hierarchyChild3';

        await flock.createBox(parentId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [0, 0, 0],
        });
        meshIds.push(parentId, childId);

        await flock.parentChild(parentId, childId);

        const childMesh = flock.scene.getMeshByName(childId);
        expect(childMesh.parent).to.exist;

        await flock.removeParent(childId);

        expect(childMesh.parent).to.be.null;
      });

      it('should preserve world position after removing parent', async function () {
        const parentId = 'hierarchyParent4';
        const childId = 'hierarchyChild4';

        await flock.createBox(parentId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [5, 0, 0],
        });
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [5, 0, 0],
        });
        meshIds.push(parentId, childId);

        await flock.parentChild(parentId, childId);
        const childMesh = flock.scene.getMeshByName(childId);
        const worldPosBefore = childMesh.getAbsolutePosition().clone();

        await flock.removeParent(childId);

        const worldPosAfter = childMesh.getAbsolutePosition();
        expect(worldPosAfter.x).to.be.closeTo(worldPosBefore.x, 0.1);
        expect(worldPosAfter.y).to.be.closeTo(worldPosBefore.y, 0.1);
        expect(worldPosAfter.z).to.be.closeTo(worldPosBefore.z, 0.1);
      });
    });

    describe('makeFollow and stopFollow', function () {
      it('should set a _followObserver on the follower mesh', async function () {
        const followerId = 'follower1';
        const targetId = 'followTarget1';

        await flock.createBox(followerId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.createBox(targetId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [3, 0, 0],
        });
        meshIds.push(followerId, targetId);

        await flock.makeFollow(followerId, targetId, 'CENTER');

        const followerMesh = flock.scene.getMeshByName(followerId);
        expect(followerMesh._followObserver).to.exist;
      });

      it('should clear the _followObserver when stopFollow is called', async function () {
        const followerId = 'follower2';
        const targetId = 'followTarget2';

        await flock.createBox(followerId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        await flock.createBox(targetId, {
          width: 1,
          height: 1,
          depth: 1,
          position: [3, 0, 0],
        });
        meshIds.push(followerId, targetId);

        await flock.makeFollow(followerId, targetId, 'CENTER');
        await flock.stopFollow(followerId);

        const followerMesh = flock.scene.getMeshByName(followerId);
        expect(followerMesh._followObserver).to.not.exist;
      });
    });

    describe('hold, attach, and drop @slow', function () {
      this.timeout(30000);

      let lizId, treeId;

      before(async function () {
        if (flock.engine) flock.engine.dispose();

        flock.engine = new flock.BABYLON.NullEngine();
        flock.scene = new flock.BABYLON.Scene(flock.engine);
        flock.BABYLON.SceneLoader.ShowLoadingScreen = false;

        new flock.BABYLON.FreeCamera('testCamera', flock.BABYLON.Vector3.Zero(), flock.scene);

        const baseMock = {
          name: 'MockPhysics',
          getPluginVersion: () => 2,
          isInitialized: () => true,
          _checkIsReady: () => true,
          onMeshRemovedObservable: new flock.BABYLON.Observable(),
          onBeforePhysicsObservable: new flock.BABYLON.Observable(),
          onAfterPhysicsObservable: new flock.BABYLON.Observable(),
          getTimeStep: () => 1 / 60,
          getMotionType: () => 1,
          dispose: () => {},
        };

        const physicsMock = new Proxy(baseMock, {
          get: (target, prop) => (prop in target ? target[prop] : () => {}),
        });

        flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), physicsMock);
        configureDraco(flock.BABYLON);

        lizId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'holdTestLiz',
          position: { x: 0, y: 0, z: 0 },
        });

        treeId = flock.createObject({
          modelName: 'tree.glb',
          modelId: 'holdTestTree',
          position: { x: 0, y: 0, z: 0 },
        });

        await pumpAnimation(
          flock,
          Promise.all([waitForModel(flock, lizId), waitForModel(flock, treeId)])
        );
      });

      beforeEach(async function () {
        // Reset tree attachment state before each test
        const treeMesh = flock.scene.getMeshByName(treeId);
        if (treeMesh) {
          treeMesh.detachFromBone?.();
          treeMesh.parent = null;
        }
      });

      after(function () {
        flock.dispose(lizId);
        flock.dispose(treeId);
      });

      // hold uses the bone name "Hold" directly (no mapping). Liz3.glb is a
      // mixamo model — its left-hand bone is "mixamorig:LeftHand", not "Hold".
      // hold therefore resolves without attaching; use attach for mixamo models.
      it('hold should resolve without error even when character has no matching Hold bone', async function () {
        await pumpAnimation(flock, flock.hold(treeId, lizId));

        const treeMesh = flock.scene.getMeshByName(treeId);
        // Liz3 (mixamo) has no "Hold" bone — tree stays detached
        expect(treeMesh.parent).to.be.null;
      });

      it('attach should parent the tree to the skeleton mesh on Liz', async function () {
        await pumpAnimation(flock, flock.attach(treeId, lizId, { boneName: 'Hold' }));

        const treeMesh = flock.scene.getMeshByName(treeId);
        // attachToBone parents to the bone and refers transforms via the mesh
        expect(treeMesh.parent, 'tree should be parented to a bone').to.exist;
        expect(treeMesh._transformToBoneReferal, "tree should refer to Liz's skeleton mesh").to
          .exist;
      });

      it('attached mesh should follow Liz when she moves', async function () {
        await pumpAnimation(flock, flock.attach(treeId, lizId, { boneName: 'Hold' }));

        const lizMesh = flock.scene.getMeshByName(lizId);
        lizMesh.position.x = 10;
        flock.scene.render();

        const treeWorldPos = flock.scene.getMeshByName(treeId).getAbsolutePosition();
        expect(treeWorldPos.x).to.be.closeTo(10, 2);
      });

      it('attach to Head should parent to the real head bone, not the crown tip', async function () {
        await pumpAnimation(flock, flock.attach(treeId, lizId, { boneName: 'Head' }));

        const treeMesh = flock.scene.getMeshByName(treeId);
        const skeleton = treeMesh._transformToBoneReferal.skeleton;
        expect(skeleton.bones.indexOf(treeMesh.parent)).to.equal(
          skeleton.getBoneIndexByName('mixamorig:Head')
        );
      });

      const renderedBaseY = (id) => {
        const m = flock.scene.getMeshByName(id);
        return m.getHierarchyBoundingVectors(true, (n) => n !== m).min.y;
      };

      it('attach to Head rests the accessory on its base and adds the Y offset on top', async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0, z: 0 })
        );
        const restedBaseY = renderedBaseY(treeId);

        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        expect(treeMesh.position.x).to.equal(0);
        expect(treeMesh.position.z).to.equal(0);
        expect(renderedBaseY(treeId)).to.be.closeTo(restedBaseY + 0.25, 1e-3);
      });

      it('attach should record the raw offset for model-switch re-attachment', async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );
        const landedY = flock.scene.getMeshByName(treeId).position.y;

        const lizMesh = flock.scene.getMeshByName(lizId);
        const entry = lizMesh.metadata._boneAttachments.find((e) => e.meshName === treeId);
        expect(entry.boneName).to.equal('Head');
        expect(entry.offset).to.deep.equal({ x: 0, y: 0.25, z: 0 });

        // Replaying the tracked offset (what a live model change does) must
        // land in the same place as the original attach.
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, {
            boneName: entry.boneName,
            x: entry.offset.x,
            y: entry.offset.y,
            z: entry.offset.z,
          })
        );
        expect(flock.scene.getMeshByName(treeId).position.y).to.be.closeTo(landedY, 1e-6);
      });

      it('replaying attach should restore the bone offset after the tree is moved', async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        const landedY = treeMesh.position.y;
        treeMesh.position.set(1, 2, 3);

        const md = treeMesh.metadata;
        await pumpAnimation(
          flock,
          flock.attach(treeId, md._attachedTargetName, {
            boneName: md._attachedBoneName,
            x: md._attachedOffset.x,
            y: md._attachedOffset.y,
            z: md._attachedOffset.z,
          })
        );

        expect(treeMesh.position.x).to.equal(0);
        expect(treeMesh.position.y).to.be.closeTo(landedY, 1e-6);
        expect(treeMesh.position.z).to.equal(0);
      });

      it('attach to Head rests a centre-origin object base on the attachment point', async function () {
        const gemId = flock.createObject({
          modelName: 'Gem2.glb',
          modelId: 'headTestGem',
          position: { x: 0, y: 0, z: 0 },
        });
        meshIds.push(gemId);
        await pumpAnimation(flock, waitForModel(flock, gemId));
        await pumpAnimation(
          flock,
          flock.attach(gemId, lizId, { boneName: 'Head', x: 0, y: 0, z: 0 })
        );

        const gemMesh = flock.scene.getMeshByName(gemId);
        const skeleton = gemMesh._transformToBoneReferal.skeleton;
        const crownBone = skeleton.bones[skeleton.getBoneIndexByName('mixamorig:HeadTop_End')];
        const anchorY = crownBone.getAbsolutePosition(gemMesh._transformToBoneReferal).y;

        expect(renderedBaseY(gemId)).to.be.closeTo(anchorY, 0.05);
      });

      it('attach to Head lands on a scaled character, not somewhere down its body', async function () {
        const scaledLizId = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'headTestScaledLiz',
          scale: 2,
          position: { x: 0, y: 0, z: 0 },
        });
        meshIds.push(scaledLizId);
        await pumpAnimation(flock, waitForModel(flock, scaledLizId));

        const gemId = flock.createObject({
          modelName: 'Gem2.glb',
          modelId: 'headTestScaledGem',
          position: { x: 0, y: 0, z: 0 },
        });
        meshIds.push(gemId);
        await pumpAnimation(flock, waitForModel(flock, gemId));
        await pumpAnimation(
          flock,
          flock.attach(gemId, scaledLizId, { boneName: 'Head', x: 0, y: 0, z: 0 })
        );

        const gemMesh = flock.scene.getMeshByName(gemId);
        const skeleton = gemMesh._transformToBoneReferal.skeleton;
        const crownBone = skeleton.bones[skeleton.getBoneIndexByName('mixamorig:HeadTop_End')];
        const anchorY = crownBone.getAbsolutePosition(gemMesh._transformToBoneReferal).y;

        // At scale 1 the neck joint (Head bone) sits well below the crown; if the fix for
        // scaled characters regresses, the gem lands near the neck instead, which would
        // still be closeTo some Y but far from the crown's actual (scaled) height.
        expect(renderedBaseY(gemId)).to.be.closeTo(anchorY, 0.1);
      });

      it('replaying attach should keep the original pre-attach rotation for drop', async function () {
        const treeMesh = flock.scene.getMeshByName(treeId);
        delete treeMesh.metadata?._attachedTargetName;
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );
        const firstPreAttach = treeMesh.metadata._preAttachWorldRotation.clone();

        // Rotate Liz, or a re-capture would be indistinguishable
        const lizMesh = flock.scene.getMeshByName(lizId);
        lizMesh.rotationQuaternion = flock.BABYLON.Quaternion.FromEulerAngles(0, 1, 0);
        flock.scene.render();

        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );

        const after = treeMesh.metadata._preAttachWorldRotation;
        expect(after.x).to.be.closeTo(firstPreAttach.x, 1e-6);
        expect(after.y).to.be.closeTo(firstPreAttach.y, 1e-6);
        expect(after.z).to.be.closeTo(firstPreAttach.z, 1e-6);
        expect(after.w).to.be.closeTo(firstPreAttach.w, 1e-6);

        lizMesh.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
        flock.scene.render();
      });

      it('live model swap on an attached object should land where a re-run does', async function () {
        this.timeout(60000);
        const { updateMeshFromBlock } = await import('../ui/blockmesh.js');

        const attachOpts = { boneName: 'Head', x: 0, y: 0.25, z: 0 };
        // The wrapper's geometry is stale after a swap
        const renderedBoundsOf = (id) => {
          const min = new flock.BABYLON.Vector3(1e9, 1e9, 1e9);
          const max = new flock.BABYLON.Vector3(-1e9, -1e9, -1e9);
          const visit = (node) => {
            if (node.getClassName?.() === 'Mesh' && node.getTotalVertices?.()) {
              node.computeWorldMatrix(true);
              node.refreshBoundingInfo?.();
              const bbox = node.getBoundingInfo().boundingBox;
              min.minimizeInPlace(bbox.minimumWorld);
              max.maximizeInPlace(bbox.maximumWorld);
            }
            (node.getChildren?.() || []).forEach(visit);
          };
          (flock.scene.getMeshByName(id).getChildren() || []).forEach(visit);
          return { min, max, centre: min.add(max).scale(0.5) };
        };
        const loadAndAttach = async (modelName, modelId) => {
          const id = flock.createObject({
            modelName,
            modelId,
            position: { x: 0, y: 0, z: 0 },
          });
          meshIds.push(id);
          await pumpAnimation(flock, waitForModel(flock, id));
          await pumpAnimation(flock, flock.attach(id, lizId, attachOpts));
          flock.scene.render();
          return id;
        };

        const rerunId = await loadAndAttach('Heart.glb', 'swapRerunHeart');
        const rerunCentre = renderedBoundsOf(rerunId).centre;

        // Undefined ids keep updateMeshFromBlock off getMainWorkspace()
        const liveId = await loadAndAttach('starboppers.glb', 'swapLiveHeart');
        const block = {
          type: 'load_object',
          getFieldValue: (name) => (name === 'MODELS' ? 'Heart.glb' : null),
          getInput: () => null,
          getInputTargetBlock: () => null,
          inputList: [],
          getParent: () => null,
        };
        const changeEvent = {
          type: 'change',
          element: 'field',
          name: 'MODELS',
        };

        updateMeshFromBlock(flock.scene.getMeshByName(liveId), block, changeEvent);
        await pumpAnimation(flock, new Promise((resolve) => setTimeout(resolve, 2000)));

        const liveCentre = renderedBoundsOf(liveId).centre;
        expect(liveCentre.y).to.be.closeTo(rerunCentre.y, 0.01);
        expect(liveCentre.x).to.be.closeTo(rerunCentre.x, 0.01);
        expect(liveCentre.z).to.be.closeTo(rerunCentre.z, 0.01);
      });

      it('drop should clear the attachment record so a later attach starts fresh', async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: 'Head', x: 0, y: 0.25, z: 0 })
        );
        await pumpAnimation(flock, flock.drop(treeId));

        const treeMesh = flock.scene.getMeshByName(treeId);
        expect(treeMesh.metadata._attachedTargetName).to.be.undefined;
        expect(treeMesh.metadata._preAttachWorldRotation).to.be.undefined;
      });

      it('drop should detach the tree so it no longer follows Liz', async function () {
        await pumpAnimation(flock, flock.attach(treeId, lizId, { boneName: 'Hold' }));
        await pumpAnimation(flock, flock.drop(treeId));

        const treeMesh = flock.scene.getMeshByName(treeId);
        expect(treeMesh.parent).to.be.null;

        const lizMesh = flock.scene.getMeshByName(lizId);
        const posBeforeMove = treeMesh.getAbsolutePosition().clone();

        lizMesh.position.x = 30;
        flock.scene.render();

        const posAfterMove = treeMesh.getAbsolutePosition();
        expect(posAfterMove.x).to.be.closeTo(posBeforeMove.x, 0.5);
      });

      it('attaching to an embodied player in VR should hide the attachment', async function () {
        const lizMesh = flock.scene.getMeshByName(lizId);
        const xrState = {
          mode: flock._xrViewMode,
          xrMode: flock._xrMode,
          sessionActive: flock._xrSessionActive,
          target: flock._xrFollowTarget,
        };
        try {
          flock._xrMode = 'VR';
          flock._xrSessionActive = true;
          flock._xrViewMode = 'embody';
          flock._xrFollowTarget = lizMesh;

          await pumpAnimation(flock, flock.attach(treeId, lizId, { boneName: 'Head' }));

          const treeMesh = flock.scene.getMeshByName(treeId);
          const treeParts = [treeMesh, ...treeMesh.getChildMeshes(false)];
          expect(treeParts.every((part) => part.isVisible === false)).to.be.true;

          await pumpAnimation(flock, flock.drop(treeId));
          expect(treeParts.every((part) => part.isVisible === true)).to.be.true;
        } finally {
          flock._restoreXREmbodiedVisibility();
          flock._xrViewMode = xrState.mode;
          flock._xrMode = xrState.xrMode;
          flock._xrSessionActive = xrState.sessionActive;
          flock._xrFollowTarget = xrState.target;
        }
      });
    });
  });
}
