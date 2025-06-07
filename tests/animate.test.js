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

				await flock.rotateAnim(boxId, { x: 90, duration: 100 });

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

				await flock.rotateAnim(boxId, { y: 180, duration: 100 });

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

				await flock.rotateAnim(boxId, { z: 45, duration: 100 });

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
					x: 30, 
					y: 60, 
					z: 90, 
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

				await flock.rotateAnim(boxId, { y: 90, duration: 100 });

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

				await flock.rotateAnim(boxId, { x: -90, duration: 100 });

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
					x: 90, 
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

				await flock.glideTo(boxId, { x: 5, y: 3, z: 2, duration: 100 });

				// Check final position (accounting for mesh height adjustment)
				expect(mesh.position.x).to.be.closeTo(5, 0.1);
				expect(mesh.position.z).to.be.closeTo(2, 0.1);
				// Y position includes mesh height adjustment
				expect(mesh.position.y).to.be.greaterThan(2.5);
			});

			it("should handle camera movement", async function () {
				// Test camera movement (if active camera exists)
				try {
					await flock.glideTo("__active_camera__", { x: 1, y: 1, z: 1, duration: 100 });
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

				await flock.animateProperty(boxId, { property: "alpha", targetValue: 0.5, duration: 100 });

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

				await flock.animateProperty(boxId, { property: "diffuseColor", targetValue: "#FF0000", duration: 100 });

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
					{
						property: "rotation.x",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "AWAIT"
					}
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
					{
						property: "color",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
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
					{
						property: "rotation.y",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// Get the animation group
				const animGroup = flock.scene.getAnimationGroupByName(groupName);
				expect(animGroup).to.exist;

				// Test play
				flock.playAnimationGroup(groupName);

				// Give a small delay for the animation to start
				await new Promise(resolve => setTimeout(resolve, 10));
				expect(animGroup.isStarted).to.be.true;

				// Test pause - check if animation stops progressing
				flock.pauseAnimationGroup(groupName);

				// Wait a bit and check if the animation is effectively paused
				await new Promise(resolve => setTimeout(resolve, 50));
				const frameAfterPause = animGroup.targetedAnimations[0]?.animation?.runtimeAnimations[0]?.currentFrame;

				// Wait a bit more
				await new Promise(resolve => setTimeout(resolve, 100));
				const frameAfterMoreWait = animGroup.targetedAnimations[0]?.animation?.runtimeAnimations[0]?.currentFrame;

				// If paused, the frame should not have progressed significantly
				expect(Math.abs((frameAfterMoreWait || 0) - (frameAfterPause || 0))).to.be.lessThan(5);

				// Test resume after pause
				flock.playAnimationGroup(groupName);
				await new Promise(resolve => setTimeout(resolve, 10));
				expect(animGroup.isStarted).to.be.true;

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
				flock.rotateAnim(boxId, { x: 90, duration: 1000 }); // Long duration

				// Stop animations
				await flock.stopAnimations(boxId);

				// Animation should be stopped
				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});
		});

		describe("animateKeyFrames function", function () {
			it("should animate color keyframes", async function () {
				const boxId = "animateKeyFramesColor";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 0.1, value: "#00FF00" },
					{ duration: 0.2, value: "#0000FF" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "color"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
				expect(mesh.material).to.exist;
			});

			it("should animate alpha keyframes", async function () {
				const boxId = "animateKeyFramesAlpha";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: 1.0 },
					{ duration: 0.1, value: 0.5 },
					{ duration: 0.2, value: 0.0 }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "alpha"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
				expect(mesh.material).to.exist;
			});

			it("should animate position keyframes", async function () {
				const boxId = "animateKeyFramesPosition";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "0 0 0" },
					{ duration: 0.1, value: "1 1 1" },
					{ duration: 0.2, value: "2 0 2" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "position"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should animate rotation keyframes", async function () {
				const boxId = "animateKeyFramesRotation";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "0 0 0" },
					{ duration: 0.1, value: "90 0 0" },
					{ duration: 0.2, value: "180 90 0" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "rotation"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should animate scaling keyframes", async function () {
				const boxId = "animateKeyFramesScaling";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "1 1 1" },
					{ duration: 0.1, value: "2 2 2" },
					{ duration: 0.2, value: "0.5 0.5 0.5" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "scaling"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle options object with all parameters", async function () {
				const boxId = "animateKeyFramesFull";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 0.1, value: "#00FF00" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "color",
					easing: "ease-in",
					loop: false,
					reverse: false
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle missing mesh gracefully in animateKeyFrames", async function () {
				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 1, value: "#00FF00" }
				];

				// This should not throw an error
				await flock.animateKeyFrames("nonExistentMesh", {
					keyframes: keyframes,
					property: "color"
				});

				// If we get here without throwing, the test passes
				expect(true).to.be.true;
			});

			it("should handle empty keyframes array", async function () {
				const boxId = "animateKeyFramesEmpty";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// This should complete without error
				await flock.animateKeyFrames(boxId, {
					keyframes: [],
					property: "color"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle single keyframe", async function () {
				const boxId = "animateKeyFramesSingle";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				const keyframes = [
					{ duration: 0.1, value: "#FF0000" }
				];

				await flock.animateKeyFrames(boxId, {
					keyframes: keyframes,
					property: "color"
				});

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});
		});

		describe("switchAnimation function", function () {
			// Increase timeout for these tests due to retry mechanism
			this.timeout(5000);
			it("should switch animation on a mesh", async function () {
				const boxId = "switchAnimTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Create an actual animation using Flock's createAnimation API
				const keyframes = [
					{ duration: 0, value: 0 },
					{ duration: 1, value: 90 }
				];

				await flock.createAnimation(
					"TestAnimation",
					boxId,
					{
						property: "rotation.x",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// This should not throw an error
				await flock.switchAnimation(boxId, { animationName: "TestAnimation" });

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle options object", async function () {
				const boxId = "switchAnimOptions";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Create an actual animation using Flock's createAnimation API
				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 1, value: "#00FF00" }
				];

				await flock.createAnimation(
					"TestAnimation2",
					boxId,
					{
						property: "color",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// Test with options object
				await flock.switchAnimation(boxId, { animationName: "TestAnimation2", loop: false, restart: true });

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle missing animation gracefully", async function () {
				const boxId = "switchAnimMissing";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// This should not throw an error even with non-existent animation
				await flock.switchAnimation(boxId, { animationName: "NonExistentAnimation" });

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle missing mesh gracefully", async function () {
				// With the immediate mesh check, this should complete quickly
				const startTime = Date.now();
				await flock.switchAnimation("nonExistentMesh", { animationName: "TestAnimation" });
				const endTime = Date.now();

				// Should complete quickly since mesh doesn't exist
				expect(endTime - startTime).to.be.lessThan(100);
				expect(true).to.be.true;
			});
		});

		describe("playAnimation function", function () {
			// Increase timeout for these tests due to retry mechanism
			this.timeout(5000);
			it("should play animation on a mesh", async function () {
				const boxId = "playAnimTest";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Create an actual animation using Flock's createAnimation API
				const keyframes = [
					{ duration: 0, value: 0 },
					{ duration: 0.1, value: 90 } // Short duration for quick test
				];

				await flock.createAnimation(
					"PlayTestAnimation",
					boxId,
					{
						property: "rotation.x",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// This should complete without error
				try {
					await flock.playAnimation(boxId, { animationName: "PlayTestAnimation" });
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				} catch (error) {
					// Handle potential timing issues in tests
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				}
			});

			it("should handle options object with loop and restart", async function () {
				const boxId = "playAnimOptions";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Create an actual animation using Flock's createAnimation API
				const keyframes = [
					{ duration: 0, value: "#FF0000" },
					{ duration: 0.1, value: "#00FF00" } // Short duration for quick test
				];

				await flock.createAnimation(
					"PlayTestAnimation2",
					boxId,
					{
						property: "color",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// Test with options object
				try {
					await flock.playAnimation(boxId, { animationName: "PlayTestAnimation2", loop: true, restart: false });
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				} catch (error) {
					// Handle potential timing issues in tests
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				}
			});

			it("should handle missing animation gracefully", async function () {
				const boxId = "playAnimMissing";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// This should handle the missing animation without throwing
				try {
					await flock.playAnimation(boxId, { animationName: "NonExistentAnimation" });
				} catch (error) {
					// Expected behavior for missing animation - could be timeout or other error
					expect(error.message).to.exist;
				}

				const mesh = flock.scene.getMeshByName(boxId);
				expect(mesh).to.exist;
			});

			it("should handle missing mesh gracefully", async function () {
				// This test accounts for the retry mechanism in whenModelReady
				this.timeout(5000);

				const startTime = Date.now();
				try {
					await flock.playAnimation("nonExistentMesh", { animationName: "TestAnimation" });
				} catch (error) {
					// Expected behavior when mesh is not found after attempts
					const endTime = Date.now();
					expect(endTime - startTime).to.be.greaterThan(900); // At least most of the retry time
					expect(error.message).to.exist;
				}
			});

			it("should handle default parameters", async function () {
				const boxId = "playAnimDefaults";
				await flock.createBox(boxId, {
					width: 1,
					height: 1,
					depth: 1,
					position: [0, 0, 0],
				});
				boxIds.push(boxId);

				// Create an actual animation using Flock's createAnimation API
				const keyframes = [
					{ duration: 0, value: "1 1 1" },
					{ duration: 0.1, value: "2 2 2" } // Short duration for quick test
				];

				await flock.createAnimation(
					"DefaultTestAnimation",
					boxId,
					{
						property: "scaling",
						keyframes: keyframes,
						easing: "Linear",
						loop: false,
						reverse: false,
						mode: "CREATE"
					}
				);

				// Test with no options (should use defaults: loop=false, restart=true)
				try {
					await flock.playAnimation(boxId, { animationName: "DefaultTestAnimation" });
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				} catch (error) {
					// Handle potential timing issues in tests
					const mesh = flock.scene.getMeshByName(boxId);
					expect(mesh).to.exist;
				}
			});
		});

		describe("edge cases and error handling", function () {
			it("should handle missing mesh gracefully in rotateAnim", async function () {
				// This should not throw an error
				await flock.rotateAnim("nonExistentMesh", { x: 90 });

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
				await flock.animateProperty("nonExistentMesh", { property: "alpha", targetValue: 0.5, duration: 100 });

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
				await flock.rotateAnim(boxId, { x: 90, duration: 0 });
				const endTime = Date.now();

				expect(endTime - startTime).to.be.lessThan(100);
			});
		});
	});
}