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

export function runCreateObjectTests(flock) {
  describe("createObject tests @slow", function () {
    this.timeout(5000);

    it("should create one object then create another", async function () {
      // Create the first tree object.
      const tree1 = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__1",
        color: ["#cd853f", "#66cdaa"],
        position: { x: 0, y: 0, z: -10.8 },
      });
      expect(tree1).to.be.a("string");

      // Create a second tree object.
      const tree2 = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__2",
        color: ["#66cdaa", "#cd853f"],
        scale: 1,
        position: { x: -3, y: 0, z: 10.8 },
      });
      expect(tree2).to.be.a("string");
    });

    it("should hide and then show an object", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__3",
        color: ["#66cdaa", "#cd853f"],
        scale: 1,
        position: { x: -4, y: 0, z: 10.8 },
      });
      expect(tree).to.be.a("string");

      try {
        await flock.hide(tree);
        await flock.wait(0.5);
        await flock.show(tree);
      } catch (error) {
        throw new Error(`Show/hide operation failed: ${error.message}`);
      }
    });

    it("should handle multiple objects with show and hide", async function () {
      const trees = [];
      try {
        // Create several tree objects
        for (let i = 0; i < 3; i++) {
          const tree = flock.createObject({
            modelName: "tree.glb",
            modelId: `tree.glb__multi_${i}`,
            color: ["#66cdaa", "#cd853f"],
            position: { x: i * 2, y: 0, z: 10.8 },
          });
          expect(tree).to.be.a("string");
          trees.push(tree);
        }

        // Hide all objects
        for (const tree of trees) {
          await flock.hide(tree);
        }

        await flock.wait(0.5);

        // Show all objects
        for (const tree of trees) {
          await flock.show(tree);
        }
      } catch (error) {
        throw new Error(`Multiple object operation failed: ${error.message}`);
      }
    });

    it("should handle invalid object creation parameters", function () {
      // Test with valid parameters - should work normally
      const result1 = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__1",
        color: ["#cd853f", "#66cdaa"],
        position: { x: 0, y: 0, z: -10.8 },
      });
      expect(result1).to.be.a("string");

      // Test with undefined - should use default empty object
      const result2 = flock.createObject(undefined);
      expect(result2).to.be.a("string");

      // Test with null - should use default empty object
      const result3 = flock.createObject();
      expect(result3).to.be.a("string");

      // Test with empty object - should log error but return ID
      const result4 = flock.createObject({});
      expect(result4).to.be.a("string");

      // Test with invalid position - should log error but return ID
      const result5 = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__invalid",
        position: "invalid",
        color: ["#cd853f", "#66cdaa"],
      });
      expect(result5).to.be.a("string");

      // Test with invalid color - should log error but return ID
      const result6 = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__test6",
        position: { x: 0, y: 0, z: -10.8 },
        color: "invalid",
      });
      expect(result6).to.be.a("string");

      // Test with missing required fields - should log error but return ID
      const result7 = flock.createObject({
        modelName: "tree.glb",
      });
      expect(result7).to.be.a("string");
    });

    ("should correctly handle modelId and blockId splitting",
      function () {
        // Create a mesh with a valid modelId__blockId format
        const modelId = "tree.glb__block123";
        const result = flock.createObject({
          modelName: "tree.glb",
          modelId: modelId,
          color: ["#cd85it3f", "#66cdaa"],
          position: { x: 0, y: 0, z: 0 },
        });

        // Get the created mesh
        const mesh = flock.scene.getMeshByName(result);
        expect(mesh).to.exist;
        expect(mesh.metadata.blockKey).to.equal("block123");

        // Test with no double underscore
        const modelId2 = "tree.glb";
        const result2 = flock.createObject({
          modelName: "tree.glb",
          modelId: modelId2,
          color: ["#cd853f", "#66cdaa"],
          position: { x: 0, y: 0, z: 0 },
        });
        const mesh2 = flock.scene.getMeshByName(result2);
        expect(mesh2).to.exist;
        expect(mesh2.metadata.blockKey).to.equal(modelId2);

        // Test with multiple double underscores - should only split on first __
        const modelId3 = "tree.glb__block123__extra";
        const result3 = flock.createObject({
          modelName: "tree.glb",
          modelId: modelId3,
          color: ["#cd853f", "#66cdaa"],
          position: { x: 0, y: 0, z: 0 },
        });
        const mesh3 = flock.scene.getMeshByName(result3);
        expect(mesh3).to.exist;
        expect(mesh3.metadata.blockKey).to.equal("block123"); // Only takes first part after __

        // Test with empty string after double underscore
        const modelId4 = "tree.glb__";
        const result4 = flock.createObject({
          modelName: "tree.glb",
          modelId: modelId4,
          color: ["#cd853f", "#66cdaa"],
          position: { x: 0, y: 0, z: 0 },
        });
        const mesh4 = flock.scene.getMeshByName(result4);
        expect(mesh4).to.exist;
        expect(mesh4.metadata.blockKey).to.equal("tree.glb"); // Empty string after __
      });

    it("should handle object scaling operations", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__scale",
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
      });
      expect(tree).to.be.a("string");

      // Test scaling operations if available
      if (flock.scale) {
        await flock.scale(tree, 2);
        await flock.wait(0.5);
        await flock.scale(tree, 0.5);
      }
    });

    it("should handle object rotation", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__rotate",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      });
      expect(tree).to.be.a("string");

      // Test rotation operations if available
      if (flock.rotate) {
        await flock.rotate(tree, { x: 0, y: 90, z: 0 });
        await flock.wait(0.5);
        await flock.rotate(tree, { x: 45, y: 90, z: 45 });
      }
    });

    it("should handle object position updates", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__move",
        position: { x: 0, y: 0, z: 0 },
      });
      expect(tree).to.be.a("string");

      // Test position updates if available
      if (flock.setPosition) {
        await flock.setPosition(tree, { x: 5, y: 0, z: 5 });
        await flock.wait(0.5);
        await flock.setPosition(tree, { x: -5, y: 2, z: -5 });
      }
    });

    it("should handle rapid show/hide toggles", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__toggle",
        position: { x: 0, y: 0, z: 0 },
      });
      expect(tree).to.be.a("string");

      for (let i = 0; i < 3; i++) {
        await flock.hide(tree);
        await flock.wait(0.2);
        await flock.show(tree);
        await flock.wait(0.2);
      }
    });

    it("should handle color updates", async function () {
      const tree = flock.createObject({
        modelName: "tree.glb",
        modelId: "tree.glb__color",
        position: { x: 0, y: 0, z: 0 },
        color: ["#ff0000", "#00ff00"],
      });
      expect(tree).to.be.a("string");

      // Test color updates if available
      if (flock.setColor) {
        await flock.setColor(tree, ["#0000ff", "#ff00ff"]);
        await flock.wait(0.5);
        await flock.setColor(tree, ["#ffffff", "#000000"]);
      }
    });

    it("should avoid collisions for repeated object ids", function () {
      const firstId = flock.createObject({
        modelName: "tree.glb",
        modelId: "reserve-tree",
        color: ["#66cdaa", "#cd853f"],
        position: { x: 0, y: 0, z: 0 },
      });
      const secondId = flock.createObject({
        modelName: "tree.glb",
        modelId: "reserve-tree",
        color: ["#66cdaa", "#cd853f"],
        position: { x: 2, y: 0, z: 0 },
      });

      expect(firstId).to.not.equal(secondId);
    });
  });
}

export function runCreateModelTests(flock) {
  describe("createModel tests @slow", function () {
    this.timeout(10000);

    const modelName = "Flock.glb";
    const modelId = "flock-model-test";
    let meshId;

    before(async function () {
      if (flock.engine) flock.engine.dispose();

      flock.modelCache = {};
      flock.modelsBeingLoaded = {};

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

      meshId = flock.createModel({
        modelName,
        modelId,
        position: { x: 1, y: 0, z: 2 },
      });

      await pumpAnimation(flock, flock.show(meshId));
    });

    after(function () {
      flock.dispose(meshId);
    });

    it("createModel returns a string ID", function () {
      expect(meshId).to.be.a("string");
    });

    it("mesh exists in the scene after loading", function () {
      const mesh = flock.scene.getMeshByName(meshId);
      expect(mesh).to.exist;
    });

    it("mesh metadata has the correct modelName", function () {
      const mesh = flock.scene.getMeshByName(meshId);
      expect(mesh.metadata?.modelName).to.equal(modelName);
    });

    it("mesh is placed at the given position", function () {
      const mesh = flock.scene.getMeshByName(meshId);
      expect(mesh.position.x).to.be.closeTo(1, 0.01);
      expect(mesh.position.z).to.be.closeTo(2, 0.01);
    });

    it("show and hide work on the loaded model", async function () {
      await pumpAnimation(flock, flock.hide(meshId));
      const mesh = flock.scene.getMeshByName(meshId);
      expect(mesh.isEnabled()).to.be.false;

      await pumpAnimation(flock, flock.show(meshId));
      expect(mesh.isEnabled()).to.be.true;
    });
  });
}
