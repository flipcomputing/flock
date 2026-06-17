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
        // attachToBone sets parent to the skeleton mesh and _transformToBoneReferal
        expect(treeMesh.parent, "tree should be parented to Liz's skeleton mesh").to.exist;
        expect(treeMesh._transformToBoneReferal, "tree should record bone attachment").to.exist;
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
