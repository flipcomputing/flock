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
  const base = (import.meta?.env?.BASE_URL ?? "/"); // Vite base, usually "/"
  const root = base.endsWith("/") ? base : `${base}/`;

  BABYLON.DracoCompression.Configuration = BABYLON.DracoCompression.Configuration || {};
  BABYLON.DracoCompression.Configuration.decoder = {
    wasmUrl: `${root}draco/draco_wasm_wrapper_gltf.js`,
    wasmBinaryUrl: `${root}draco/draco_decoder_gltf.wasm`,
    fallbackUrl: `${root}draco/draco_decoder_gltf.js`,
  };
}

function whenModelReadyOrFail(flock, meshId, { timeoutMs = 4000, label = "" } = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const name = label || meshId;

    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for model '${name}' to be ready after ${timeoutMs}ms. ` +
          `Is the .glb available in this test environment?`
        )
      );
    }, timeoutMs);

    // If your API can signal failures, hook it here too (see #2 below).

    flock.whenModelReady(meshId, (mesh) => {
      clearTimeout(timer);

      // Defensive: some implementations call back with null/undefined on failure.
      if (!mesh) {
        reject(
          new Error(
            `Model '${name}' reported ready callback but mesh was missing/null ` +
            `after ${Date.now() - startedAt}ms.`
          )
        );
        return;
      }

      resolve(mesh);
    });
  });
}


export function runCharacterAnimationTests(flock) {
	describe("Character Animation API", function () {
		this.timeout(20000);

		const characterModel = "Liz3.glb";
		const animationMeshIds = [];

		before(async function () {
			configureDraco(flock.BABYLON);

			const meshId = flock.createCharacter({
				modelName: characterModel,
				modelId: "liz3-test-character",
				position: { x: 0, y: 0, z: 0 },
			});
			animationMeshIds.push(meshId);

			const mesh = await whenModelReadyOrFail(flock, meshId, {
    timeoutMs: 4000,
    label: characterModel,
  });
		});

		after(function () {
			animationMeshIds.forEach((id) => flock.dispose(id));
			animationMeshIds.length = 0;
		});

		beforeEach(async function () {
			const currentMeshId = animationMeshIds[0];
			await flock.switchAnimation(currentMeshId, {
				animationName: "Idle",
				loop: true,
				restart: true,
			});
		});

		
		it("uses the Liz3 model from the main app for animation tests", function () {
			const mesh = flock.scene.getMeshByName(animationMeshIds[0]);
			expect(mesh).to.exist;
			expect(mesh.metadata?.modelName).to.equal(characterModel);
		});

		it("switchAnimation sets the current animation and starts playing it", async function () {
  const meshId = animationMeshIds[0];

 
  const mesh = flock.scene.getMeshByName(meshId);
  expect(mesh, "Character mesh should exist").to.exist;

   await flock.switchAnimation(meshId, {
    animationName: "Walk",
    loop: true,
    restart: true,
  });

    await new Promise((resolve) => setTimeout(resolve, 500));

  const info = flock._getCurrentAnimationInfo(mesh);
  expect(info).to.exist;
  expect(info.name).to.equal("Walk");
  expect(info.isPlaying).to.equal(true);
  expect(info.isLooping).to.equal(true);

});

		it("switches between looped and single-play animations", async function () {
  const meshId = animationMeshIds[0];

  await flock.switchAnimation(meshId, {
    animationName: "Walk",
    loop: true,
    restart: true,
  });

  const root = flock.scene.getMeshByName(meshId);
  expect(root).to.exist;

  let info = flock._getCurrentAnimationInfo(root);
  expect(info?.name).to.equal("Walk");
  expect(info?.isLooping).to.equal(true);

  await flock.switchAnimation(meshId, {
    animationName: "Idle",
    loop: false,
    restart: true,
  });

  info = flock._getCurrentAnimationInfo(root);
  expect(info?.name).to.equal("Idle");
  expect(info?.isLooping).to.equal(false);
});

it("plays a non-looping animation and resolves near its retargeted duration", async function () {
  const meshId = animationMeshIds[0];

  const root = flock.scene.getMeshByName(meshId);
  const skelMesh = (function findMeshWithSkeleton(m) {
    if (m?.skeleton) return m;
    if (m?.getChildMeshes) return m.getChildMeshes().find((c) => c.skeleton) || null;
    return null;
  })(root);
  expect(skelMesh).to.exist;

  const start = Date.now();
  await flock.playAnimation(meshId, { animationName: "Jump", loop: false, restart: true });
  const elapsedSeconds = (Date.now() - start) / 1000;

  const expectedDuration = getAnimationDurationInSeconds(skelMesh._currentAnimGroup);
  expect(expectedDuration, "Retargeted Jump group should expose timing").to.be.a("number");

  expect(elapsedSeconds).to.be.closeTo(expectedDuration, expectedDuration * 0.35 + 0.05);

  expect(skelMesh._currentAnimGroup?.isPlaying).to.equal(false);
  expect(flock._getCurrentAnimationInfo(root)?.name).to.equal("Jump");
});

it("supports switching then playing a timed animation", async function () {
  const meshId = animationMeshIds[0];

  await flock.switchAnimation(meshId, {
    animationName: "Walk",
    loop: true,
    restart: true,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const root = flock.scene.getMeshByName(meshId);
  expect(root).to.exist;

  const skelMesh = (function findMeshWithSkeleton(m) {
    if (m?.skeleton) return m;
    if (m?.getChildMeshes) return m.getChildMeshes().find((c) => c.skeleton) || null;
    return null;
  })(root);
  expect(skelMesh).to.exist;

  const walkGroup = skelMesh._currentAnimGroup;
  expect(walkGroup).to.exist;

  let info = flock._getCurrentAnimationInfo(root);
  expect(info?.name).to.equal("Walk");
  expect(walkGroup.isPlaying).to.equal(true);

  const start = Date.now();
  await flock.playAnimation(meshId, {
    animationName: "Jump",
    loop: false,
    restart: true,
  });
  const elapsedSeconds = (Date.now() - start) / 1000;

  expect(elapsedSeconds, "playAnimation should not resolve immediately").to.be.greaterThan(0.1);

  expect(walkGroup.isPlaying, "Walk should stop when Jump plays").to.equal(false);

  info = flock._getCurrentAnimationInfo(root);
  expect(info?.name).to.equal("Jump");

  expect(skelMesh._currentAnimGroup).to.exist;
  expect(skelMesh._currentAnimGroup.name).to.match(/\.Jump$/);
  expect(skelMesh._currentAnimGroup.isPlaying).to.equal(false);
});


	});
}
