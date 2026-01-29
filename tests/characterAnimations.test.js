import { expect } from "chai";

function getAnimationDurationInSeconds(animationGroup) {
  const targetedAnimation = animationGroup?.targetedAnimations?.[0];
  const fps = targetedAnimation?.animation?.framePerSecond;
  if (!fps || typeof animationGroup.to !== "number") {
    return null;
  }
  return (animationGroup.to - animationGroup.from) / fps;
}

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

/**
 * Pimps the engine and waits for a condition or promise.
 * If a string 'match' is provided, it waits until an AnimationGroup 
 * containing that name exists in the scene.
 */
async function pumpAnimation(flock, promise, match = null) {
  const interval = setInterval(() => {
    flock.scene.render();
  }, 0);

  try {
    await promise;

    // If we are looking for a specific animation to appear in the scene
    if (match) {
      let found = false;
      const timeout = Date.now() + 5000; // 5s safety

      while (!found && Date.now() < timeout) {
        flock.scene.render();
        found = flock.scene.animationGroups.some(ag => 
          ag.name.toLowerCase().includes(match.toLowerCase())
        );
        if (!found) await new Promise(r => setTimeout(r, 10));
      }
    }

    // Final settle
    flock.scene.render();
    flock.scene.render();
  } finally {
    clearInterval(interval);
  }
}

export function runCharacterAnimationTests(flock) {
  describe("Character Animation API", function () {
    this.timeout(30000);

    const characterModel = "Liz3.glb";
    const animationMeshIds = [];

    before(async function () {
      if (flock.engine) flock.engine.dispose();

      flock.engine = new flock.BABYLON.NullEngine();
      flock.scene = new flock.BABYLON.Scene(flock.engine);
      flock.BABYLON.SceneLoader.ShowLoadingScreen = false;

      new flock.BABYLON.FreeCamera("testCamera", flock.BABYLON.Vector3.Zero(), flock.scene);

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
        get: (target, prop) => (prop in target ? target[prop] : () => {})
      });

      flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), physicsMock);
      configureDraco(flock.BABYLON);

      const meshId = flock.createCharacter({
        modelName: characterModel,
        modelId: "liz3-test-character",
        position: { x: 0, y: 0, z: 0 },
      });
      animationMeshIds.push(meshId);

      await pumpAnimation(flock, flock.show(meshId));
    });

    after(function () {
      animationMeshIds.forEach((id) => flock.dispose(id));
      animationMeshIds.length = 0;
    });

    beforeEach(async function () {
      const currentMeshId = animationMeshIds[0];
      await pumpAnimation(flock, flock.switchAnimation(currentMeshId, {
        animationName: "Idle",
        loop: true,
        restart: true,
      }), "Idle");
    });

    it("uses the Liz3 model from the main app for animation tests", async function () {
      const mesh = flock.scene.getMeshByName(animationMeshIds[0]);
      expect(mesh).to.exist;
      expect(mesh.metadata?.modelName).to.equal(characterModel);
    });

    it("switchAnimation sets the current animation and starts playing it", async function () {
      const meshId = animationMeshIds[0];
      const mesh = flock.scene.getMeshByName(meshId);

      const walkPromise = flock.switchAnimation(meshId, {
        animationName: "Walk",
        loop: true,
        restart: true,
      });

      // Pass "Walk" to pump to ensure we wait for the group to exist
      await pumpAnimation(flock, walkPromise, "Walk");

      const walkGroup = flock.scene.animationGroups.find(ag => ag.name.toLowerCase().includes("walk"));
      expect(walkGroup, "Walk animation group should be in the scene").to.exist;

      const info = flock._getCurrentAnimationInfo(mesh);
      expect(info, "Animation info should be active on the mesh").to.not.be.null;
      expect(info.name).to.equal("Walk");
    });

    it("plays a non-looping animation and resolves near its duration", async function () {
      const meshId = animationMeshIds[0];
      const root = flock.scene.getMeshByName(meshId);

      const start = Date.now();
      await pumpAnimation(flock, flock.playAnimation(meshId, { 
        animationName: "Jump", 
        loop: false, 
        restart: true 
      }), "Jump");

      const jumpGroup = flock.scene.animationGroups.find(ag => ag.name.toLowerCase().includes("jump"));
      expect(jumpGroup, "Jump group should be present").to.exist;

      const expectedDuration = getAnimationDurationInSeconds(jumpGroup);
      const realTimeElapsed = (Date.now() - start) / 1000;

      console.log(`[DEBUG] Animation ${jumpGroup.name} finished in ${realTimeElapsed.toFixed(2)}s`);

      const info = flock._getCurrentAnimationInfo(root);
      expect(info?.name).to.equal("Jump");
      expect(jumpGroup.isPlaying).to.equal(false);
    });

    it("supports switching then playing a timed animation", async function () {
      const meshId = animationMeshIds[0];
      const root = flock.scene.getMeshByName(meshId);

      await pumpAnimation(flock, flock.switchAnimation(meshId, { animationName: "Walk", loop: true, restart: true }), "Walk");
      await pumpAnimation(flock, flock.playAnimation(meshId, { animationName: "Jump", loop: false, restart: true }), "Jump");

      const jumpGroup = flock.scene.animationGroups.find(ag => ag.name.toLowerCase().includes("jump"));
      const info = flock._getCurrentAnimationInfo(root);

      expect(info?.name).to.equal("Jump");
      expect(jumpGroup.isPlaying).to.equal(false);
    });
  });
}