import { expect } from "chai";

function getAnimationDurationInSeconds(animationGroup) {
	const targetedAnimation = animationGroup?.targetedAnimations?.[0];
	const fps = targetedAnimation?.animation?.framePerSecond;
	if (!fps || typeof animationGroup.to !== "number") {
		return null;
	}
	return (animationGroup.to - animationGroup.from) / fps;
}

export function runCharacterAnimationTests(flock) {
	describe("Character Animation API", function () {
		this.timeout(20000);

		const characterModel = "Liz3.glb";
		const animationMeshIds = [];

		before(async function () {
			const meshId = flock.createCharacter({
				modelName: characterModel,
				modelId: "liz3-test-character",
				position: { x: 0, y: 0, z: 0 },
			});
			animationMeshIds.push(meshId);

			await flock.whenModelReady(meshId, async () => {
				await flock.switchAnimation(meshId, {
					animationName: "Idle",
					loop: true,
					restart: true,
				});
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

		it("switches between looped and single-play animations", async function () {
			const meshId = animationMeshIds[0];
			await flock.switchAnimation(meshId, {
				animationName: "Walk",
				loop: true,
				restart: true,
			});

			const mesh = flock.scene.getMeshByName(meshId);
			expect(mesh.metadata.currentAnimationName).to.equal("Walk");
			expect(mesh._currentAnimGroup?.name).to.equal("Walk");
			expect(mesh._currentAnimGroup?.loopAnimation).to.equal(true);

			await flock.switchAnimation(meshId, {
				animationName: "Idle",
				loop: false,
				restart: true,
			});

			expect(mesh.metadata.currentAnimationName).to.equal("Idle");
			expect(mesh._currentAnimGroup?.name).to.equal("Idle");
			expect(mesh._currentAnimGroup?.loopAnimation).to.equal(false);
		});

		it("plays a non-looping animation and resolves near its duration", async function () {
			const meshId = animationMeshIds[0];
			const animationGroup = flock.scene.getAnimationGroupByName("Jump");
			expect(animationGroup, "Jump animation should be available on Liz3")
				.to.exist;

			const expectedDuration =
				getAnimationDurationInSeconds(animationGroup);
			expect(
				expectedDuration,
				"Jump animation should expose timing",
			).to.be.a("number");

			const start = Date.now();
			await flock.playAnimation(meshId, {
				animationName: "Jump",
				loop: false,
				restart: true,
			});
			const elapsedSeconds = (Date.now() - start) / 1000;

			expect(elapsedSeconds).to.be.closeTo(
				expectedDuration,
				expectedDuration * 0.35 + 0.05,
			);
			const mesh = flock.scene.getMeshByName(meshId);
			expect(mesh.metadata.currentAnimationName).to.equal("Jump");
			expect(mesh._currentAnimGroup?.isPlaying).to.equal(false);
		});

		it("supports switching then playing a timed animation", async function () {
			const meshId = animationMeshIds[0];
			await flock.switchAnimation(meshId, {
				animationName: "Walk",
				loop: true,
				restart: true,
			});

			const mesh = flock.scene.getMeshByName(meshId);
			const walkGroup = mesh._currentAnimGroup;
			expect(mesh.metadata.currentAnimationName).to.equal("Walk");
			expect(walkGroup?.isPlaying).to.equal(true);

			const animationGroup = flock.scene.getAnimationGroupByName("Jump");
			expect(animationGroup).to.exist;
			const expectedDuration =
				getAnimationDurationInSeconds(animationGroup);

			const start = Date.now();
			await flock.playAnimation(meshId, {
				animationName: "Jump",
				loop: false,
				restart: true,
			});
			const elapsedSeconds = (Date.now() - start) / 1000;

			expect(elapsedSeconds).to.be.closeTo(
				expectedDuration,
				expectedDuration * 0.35 + 0.05,
			);
			expect(walkGroup?.isPlaying).to.equal(false);
			expect(mesh.metadata.currentAnimationName).to.equal("Jump");
			expect(mesh._currentAnimGroup?.name).to.equal("Jump");
		});
	});
}
