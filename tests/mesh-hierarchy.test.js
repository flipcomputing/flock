import { expect } from "chai";

function configureDraco(BABYLON) {
  const base = import.meta?.env?.BASE_URL ?? "/";
  const root = base.endsWith("/") ? base : `${base}/`;

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
  describe("Mesh Hierarchy API @meshhierarchy", function () {
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

    describe("parentChild", function () {
      it("should set the child mesh parent to the parent mesh", async function () {
        const parentId = "hierarchyParent1";
        const childId = "hierarchyChild1";

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

      it("should ignore parenting to a non-mesh target", async function () {
        const childId = "hierarchyChildNonMesh";
        await flock.createBox(childId, {
          width: 0.5,
          height: 0.5,
          depth: 0.5,
          position: [2, 0, 0],
        });
        meshIds.push(childId);

        const group = new flock.BABYLON.AnimationGroup(
          "parentNonMeshGroup",
          flock.scene,
        );

        const reported = [];
        const previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
        try {
          await flock.parentChild("parentNonMeshGroup", childId);

          const childMesh = flock.scene.getMeshByName(childId);
          expect(childMesh.parent).to.not.equal(group);
          expect(reported).to.have.lengthOf(1);
          expect(reported[0].key).to.equal("target_not_a_mesh");
        } finally {
          flock.onBlockError = previousOnBlockError;
          group.dispose();
        }
      });

      it("should apply position offsets to the child", async function () {
        const parentId = "hierarchyParent2";
        const childId = "hierarchyChild2";

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

    describe("removeParent", function () {
      it("should remove the parent from the child mesh", async function () {
        const parentId = "hierarchyParent3";
        const childId = "hierarchyChild3";

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

      it("should preserve world position after removing parent", async function () {
        const parentId = "hierarchyParent4";
        const childId = "hierarchyChild4";

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

    describe("makeFollow and stopFollow", function () {
      it("should set a _followObserver on the follower mesh", async function () {
        const followerId = "follower1";
        const targetId = "followTarget1";

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

        await flock.makeFollow(followerId, targetId, "CENTER");

        const followerMesh = flock.scene.getMeshByName(followerId);
        expect(followerMesh._followObserver).to.exist;
      });

      it("should clear the _followObserver when stopFollow is called", async function () {
        const followerId = "follower2";
        const targetId = "followTarget2";

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

        await flock.makeFollow(followerId, targetId, "CENTER");
        await flock.stopFollow(followerId);

        const followerMesh = flock.scene.getMeshByName(followerId);
        expect(followerMesh._followObserver).to.not.exist;
      });
    });

    describe("hold, attach, and drop @slow", function () {
      this.timeout(30000);

      let lizId, treeId;

      before(async function () {
        if (flock.engine) flock.engine.dispose();

        flock.engine = new flock.BABYLON.NullEngine();
        flock.scene = new flock.BABYLON.Scene(flock.engine);
        flock.BABYLON.SceneLoader.ShowLoadingScreen = false;

        new flock.BABYLON.FreeCamera(
          "testCamera",
          flock.BABYLON.Vector3.Zero(),
          flock.scene,
        );

        const baseMock = {
          name: "MockPhysics",
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

        flock.scene.enablePhysics(
          new flock.BABYLON.Vector3(0, -9.81, 0),
          physicsMock,
        );
        configureDraco(flock.BABYLON);

        lizId = flock.createCharacter({
          modelName: "Liz3.glb",
          modelId: "holdTestLiz",
          position: { x: 0, y: 0, z: 0 },
        });

        treeId = flock.createObject({
          modelName: "tree.glb",
          modelId: "holdTestTree",
          position: { x: 0, y: 0, z: 0 },
        });

        await pumpAnimation(
          flock,
          Promise.all([
            waitForModel(flock, lizId),
            waitForModel(flock, treeId),
          ]),
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
      it("hold should resolve without error even when character has no matching Hold bone", async function () {
        await pumpAnimation(flock, flock.hold(treeId, lizId));

        const treeMesh = flock.scene.getMeshByName(treeId);
        // Liz3 (mixamo) has no "Hold" bone — tree stays detached
        expect(treeMesh.parent).to.be.null;
      });

      it("attach should parent the tree to the skeleton mesh on Liz", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Hold" }),
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        // attachToBone parents to the bone and refers transforms via the mesh
        expect(treeMesh.parent, "tree should be parented to a bone").to.exist;
        expect(treeMesh._transformToBoneReferal, "tree should refer to Liz's skeleton mesh").to.exist;
      });

      it("attached mesh should follow Liz when she moves", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Hold" }),
        );

        const lizMesh = flock.scene.getMeshByName(lizId);
        lizMesh.position.x = 10;
        flock.scene.render();

        const treeWorldPos = flock.scene
          .getMeshByName(treeId)
          .getAbsolutePosition();
        expect(treeWorldPos.x).to.be.closeTo(10, 2);
      });

      it("attach to Head should use the crown bone, not the skull joint", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head" }),
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        const skeleton = treeMesh._transformToBoneReferal.skeleton;
        expect(skeleton.bones.indexOf(treeMesh.parent)).to.equal(
          skeleton.getBoneIndexByName("mixamorig:HeadTop_End"),
        );
      });

      it("attach to Head should apply the given offsets exactly", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        expect(treeMesh.position.x).to.equal(0);
        expect(treeMesh.position.y).to.equal(0.25);
        expect(treeMesh.position.z).to.equal(0);
      });

      it("attach should record the raw offset for model-switch re-attachment", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );

        const lizMesh = flock.scene.getMeshByName(lizId);
        const entry = lizMesh.metadata._boneAttachments.find(
          (e) => e.meshName === treeId,
        );
        expect(entry.boneName).to.equal("Head");
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
          }),
        );
        expect(flock.scene.getMeshByName(treeId).position.y).to.equal(0.25);
      });

      it("replaying attach should restore the bone offset after the tree is moved", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );

        const treeMesh = flock.scene.getMeshByName(treeId);
        treeMesh.position.set(1, 2, 3);

        const md = treeMesh.metadata;
        await pumpAnimation(
          flock,
          flock.attach(treeId, md._attachedTargetName, {
            boneName: md._attachedBoneName,
            x: md._attachedOffset.x,
            y: md._attachedOffset.y,
            z: md._attachedOffset.z,
          }),
        );

        expect(treeMesh.position.x).to.equal(0);
        expect(treeMesh.position.y).to.equal(0.25);
        expect(treeMesh.position.z).to.equal(0);
      });

      it("replaying attach should keep the original pre-attach rotation for drop", async function () {
        const treeMesh = flock.scene.getMeshByName(treeId);
        delete treeMesh.metadata?._attachedTargetName;
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );
        const firstPreAttach =
          treeMesh.metadata._preAttachWorldRotation.clone();

        // Rotate Liz, or a re-capture would be indistinguishable
        const lizMesh = flock.scene.getMeshByName(lizId);
        lizMesh.rotationQuaternion = flock.BABYLON.Quaternion.FromEulerAngles(
          0,
          1,
          0,
        );
        flock.scene.render();

        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );

        const after = treeMesh.metadata._preAttachWorldRotation;
        expect(after.x).to.be.closeTo(firstPreAttach.x, 1e-6);
        expect(after.y).to.be.closeTo(firstPreAttach.y, 1e-6);
        expect(after.z).to.be.closeTo(firstPreAttach.z, 1e-6);
        expect(after.w).to.be.closeTo(firstPreAttach.w, 1e-6);

        lizMesh.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
        flock.scene.render();
      });

      it("live model swap on an attached object should land where a re-run does", async function () {
        this.timeout(60000);
        const { updateMeshFromBlock } = await import("../ui/blockmesh.js");

        const attachOpts = { boneName: "Head", x: 0, y: 0.25, z: 0 };
        // The wrapper's geometry is stale after a swap
        const renderedBoundsOf = (id) => {
          const min = new flock.BABYLON.Vector3(1e9, 1e9, 1e9);
          const max = new flock.BABYLON.Vector3(-1e9, -1e9, -1e9);
          const visit = (node) => {
            if (node.getClassName?.() === "Mesh" && node.getTotalVertices?.()) {
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

        const rerunId = await loadAndAttach("Heart.glb", "swapRerunHeart");
        const rerunCentre = renderedBoundsOf(rerunId).centre;

        // Undefined ids keep updateMeshFromBlock off getMainWorkspace()
        const liveId = await loadAndAttach("starboppers.glb", "swapLiveHeart");
        const block = {
          type: "load_object",
          getFieldValue: (name) => (name === "MODELS" ? "Heart.glb" : null),
          getInput: () => null,
          getInputTargetBlock: () => null,
          inputList: [],
          getParent: () => null,
        };
        const changeEvent = {
          type: "change",
          element: "field",
          name: "MODELS",
        };

        updateMeshFromBlock(
          flock.scene.getMeshByName(liveId),
          block,
          changeEvent,
        );
        await pumpAnimation(
          flock,
          new Promise((resolve) => setTimeout(resolve, 2000)),
        );

        const liveCentre = renderedBoundsOf(liveId).centre;
        expect(liveCentre.y).to.be.closeTo(rerunCentre.y, 0.01);
        expect(liveCentre.x).to.be.closeTo(rerunCentre.x, 0.01);
        expect(liveCentre.z).to.be.closeTo(rerunCentre.z, 0.01);
      });

      it("drop should clear the attachment record so a later attach starts fresh", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Head", x: 0, y: 0.25, z: 0 }),
        );
        await pumpAnimation(flock, flock.drop(treeId));

        const treeMesh = flock.scene.getMeshByName(treeId);
        expect(treeMesh.metadata._attachedTargetName).to.be.undefined;
        expect(treeMesh.metadata._preAttachWorldRotation).to.be.undefined;
      });

      it("drop should detach the tree so it no longer follows Liz", async function () {
        await pumpAnimation(
          flock,
          flock.attach(treeId, lizId, { boneName: "Hold" }),
        );
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
    });
  });
}
