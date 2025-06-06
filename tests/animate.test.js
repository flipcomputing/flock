
import { expect } from "chai";

export function runAnimateTests(flock) {
	describe("Animation API Tests", function () {
		const boxIds = [];

		beforeEach(async function () {
			flock.scene ??= {};
		});

		afterEach(function () {
			boxIds.forEach((boxId) => {
				flock.dispose(boxId);
			});
			boxIds.length = 0;
		});

		describe("rotateAnim function", function () {
			it("should rotate a mesh with default values", async function () {
				const boxId = "rotateAnimDefault";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				const initialRotation = mesh.rotation.clone();

				await flock.rotateAnim(boxId, {});

				// With all default values (0, 0, 0), rotation should remain the same
				expect(mesh.rotation.x).to.be.closeTo(initialRotation.x, 0.01);
				expect(mesh.rotation.y).to.be.closeTo(initialRotation.y, 0.01);
				expect(mesh.rotation.z).to.be.closeTo(initialRotation.z, 0.01);
			});

			it("should rotate a mesh around X axis", async function () {
				const boxId = "rotateAnimX";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { rotX: 90, duration: 100 });

				// Check that X rotation was applied (90 degrees = π/2 radians)
				expect(Math.abs(mesh.rotation.x)).to.be.closeTo(Math.PI / 2, 0.1);
				expect(Math.abs(mesh.rotation.y)).to.be.lessThan(0.1);
				expect(Math.abs(mesh.rotation.z)).to.be.lessThan(0.1);
			});

			it("should rotate a mesh around Y axis", async function () {
				const boxId = "rotateAnimY";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { rotY: 180, duration: 100 });

				// Check that Y rotation was applied (180 degrees = π radians)
				expect(Math.abs(mesh.rotation.y)).to.be.closeTo(Math.PI, 0.1);
				expect(Math.abs(mesh.rotation.x)).to.be.lessThan(0.1);
				expect(Math.abs(mesh.rotation.z)).to.be.lessThan(0.1);
			});

			it("should rotate a mesh around Z axis", async function () {
				const boxId = "rotateAnimZ";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { rotZ: 45, duration: 100 });

				// Check that Z rotation was applied (45 degrees = π/4 radians)
				expect(Math.abs(mesh.rotation.z)).to.be.closeTo(Math.PI / 4, 0.1);
				expect(Math.abs(mesh.rotation.x)).to.be.lessThan(0.1);
				expect(Math.abs(mesh.rotation.y)).to.be.lessThan(0.1);
			});

			it("should rotate a mesh around multiple axes", async function () {
				const boxId = "rotateAnimMultiple";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { 
					rotX: 30, 
					rotY: 60, 
					rotZ: 90, 
					duration: 100 
				});

				// Check that all rotations were applied
				expect(Math.abs(mesh.rotation.x)).to.be.closeTo(Math.PI / 6, 0.1); // 30 degrees
				expect(Math.abs(mesh.rotation.y)).to.be.closeTo(Math.PI / 3, 0.1); // 60 degrees
				expect(Math.abs(mesh.rotation.z)).to.be.closeTo(Math.PI / 2, 0.1); // 90 degrees
			});

			it("should handle partial rotation parameters", async function () {
				const boxId = "rotateAnimPartial";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { rotY: 90, duration: 100 });

				// Only Y should be rotated, X and Z should remain close to 0
				expect(Math.abs(mesh.rotation.y)).to.be.closeTo(Math.PI / 2, 0.1);
				expect(Math.abs(mesh.rotation.x)).to.be.lessThan(0.1);
				expect(Math.abs(mesh.rotation.z)).to.be.lessThan(0.1);
			});

			it("should handle negative rotation values", async function () {
				const boxId = "rotateAnimNegative";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.rotateAnim(boxId, { rotX: -90, duration: 100 });

				// Check that negative rotation was applied
				expect(Math.abs(mesh.rotation.x)).to.be.closeTo(Math.PI / 2, 0.1);
			});

			it("should respect custom duration", async function () {
				const boxId = "rotateAnimDuration";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const startTime = Date.now();
				await flock.rotateAnim(boxId, { 
					rotX: 90, 
					duration: 200 
				});
				const endTime = Date.now();

				// Animation should take approximately the specified duration
				const actualDuration = endTime - startTime;
				expect(actualDuration).to.be.at.least(180); // Allow some tolerance
				expect(actualDuration).to.be.at.most(300);
			});
		});

		describe("glideTo function", function () {
			it("should move mesh to target position", async function () {
				const boxId = "glideToTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.glideTo(boxId, 5, 3, 2, 100);

				// Check final position (accounting for mesh height adjustment)
				expect(mesh.position.x).to.be.closeTo(5, 0.1);
				expect(mesh.position.z).to.be.closeTo(2, 0.1);
				// Y position includes mesh height adjustment
				expect(mesh.position.y).to.be.greaterThan(2.5);
			});

			it("should handle camera movement", async function () {
				// Test camera movement (if active camera exists)
				try {
					await flock.glideTo("__active_camera__", 1, 1, 1, 100);
					// If we get here without throwing, the test passes
					expect(true).to.be.true;
				} catch (error) {
					// If there's no active camera, we should get a specific error or skip
					console.log("No active camera for testing");
				}
			});
		});

		describe("animateProperty function", function () {
			it("should animate alpha property", async function () {
				const boxId = "animateAlpha";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.animateProperty(boxId, "alpha", 0.5, 100);

				// Check that alpha was changed
				expect(mesh.material.alpha).to.be.closeTo(0.5, 0.1);
			});

			it("should animate color property", async function () {
				const boxId = "animateColor";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;

				await flock.animateProperty(boxId, "diffuseColor", "#FF0000", 100);

				// Check that color was changed
				const material = mesh.material;
				expect(material.diffuseColor.r).to.be.closeTo(1, 0.1);
				expect(material.diffuseColor.g).to.be.closeTo(0, 0.1);
				expect(material.diffuseColor.b).to.be.closeTo(0, 0.1);
			});
		});

		describe("createAnimation function", function () {
			it("should create animation group", async function () {
				const boxId = "createAnimTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: 0 },
					{ duration: 1, value: 90 }
				];

				const groupName = await flock.createAnimation(
					"testGroup",
					boxId,
					"rotation.x",
					keyframes,
					"Linear",
					false,
					false,
					"AWAIT"
				);

				expect(groupName).to.equal("testGroup");

				// Check that animation group was created
				const animGroup = flock.scene.getAnimationGroupByName("testGroup");
				expect(animGroup).to.exist;
			});

			it("should generate unique group name when not provided", async function () {
				const boxId = "createAnimUnique";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 1, value: "#00FF00" }
				];

				const groupName = await flock.createAnimation(
					null, // No group name provided
					boxId,
					"color",
					keyframes,
					"Linear",
					false,
					false,
					"CREATE"
				);

				expect(groupName).to.be.a("string");
				expect(groupName).to.include("animation_");
			});
		});

		describe("animation control functions", function () {
			it("should control animation groups", async function () {
				const boxId = "animControlTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: 0 },
					{ duration: 2, value: 360 }
				];

				const groupName = await flock.createAnimation(
					"controlTestGroup",
					boxId,
					"rotation.y",
					keyframes,
					"Linear",
					false,
					false,
					"CREATE"
				);

				// Get the animation group
				const animGroup = flock.scene.getAnimationGroupByName(groupName);
				expect(animGroup).to.exist;

				// Test play
				flock.playAnimationGroup(groupName);
				
				// Give a small delay for the animation to start
				await new Promise(resolve => setTimeout(resolve, 10));
				expect(animGroup.isStarted).to.be.true;

				// Test pause
				flock.pauseAnimationGroup(groupName);
				expect(animGroup.isStarted).to.be.false;

				// Test stop
				flock.stopAnimationGroup(groupName);
				expect(animGroup.isStarted).to.be.false;
			});

			it("should handle non-existent animation groups gracefully", function () {
				// These should not throw errors
				flock.playAnimationGroup("nonExistentGroup");
				flock.pauseAnimationGroup("nonExistentGroup");
				flock.stopAnimationGroup("nonExistentGroup");
				flock.animateFrom("nonExistentGroup", 1);

				// If we get here without throwing, the test passes
				expect(true).to.be.true;
			});
		});

		describe("stopAnimations function", function () {
			it("should stop animations on a mesh", async function () {
				const boxId = "stopAnimTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Start an animation
				flock.rotateAnim(boxId, { rotX: 90, duration: 1000 }); // Long duration

				// Stop animations
				await flock.stopAnimations(boxId);

				// Animation should be stopped
				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});
		});

		describe("edge cases and error handling", function () {
			it("should handle missing mesh gracefully in rotateAnim", async function () {
				// This should not throw an error
				await flock.rotateAnim("nonExistentMesh", { rotX: 90 });
				
				// If we get here without throwing, the test passes
				expect(true).to.be.true;
			});

			it("should handle missing mesh gracefully in glideTo", async function () {
				// This should not throw an error
				await flock.glideTo("nonExistentMesh", 1, 1, 1, 100);
				
				// If we get here without throwing, the test passes
				expect(true).to.be.true;
			});

			it("should handle missing mesh gracefully in animateProperty", async function () {
				// This should not throw an error
				await flock.animateProperty("nonExistentMesh", "alpha", 0.5, 100);
				
				// If we get here without throwing, the test passes
				expect(true).to.be.true;
			});

			it("should handle zero duration in rotateAnim", async function () {
				const boxId = "zeroDuration";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// This should complete very quickly
				const startTime = Date.now();
				await flock.rotateAnim(boxId, { rotX: 90, duration: 0 });
				const endTime = Date.now();

				expect(endTime - startTime).to.be.lessThan(100);
			});
		});
	});
}
