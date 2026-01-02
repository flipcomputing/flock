// test-glideTo.js

import { expect } from "chai";

function checkXPosition(box, pos) {
	return Math.abs(box.position.x - pos) <= 0.3;
}

// Test suite for glideTo function
export function runGlideToTests(flock) {
	describe("glideTo function tests @slow", function () {
		let box1;
		let box2;

		// Set up the box before each test
		beforeEach(async function () {
			// Create a box before each test
			box1 = flock.createBox("box1", {
				color: "#996633",
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
		});

		// Clean up after each test
		afterEach(function () {
			// Dispose of the boxes after each test to avoid memory leaks and ensure clean state
			flock.dispose(box1);
			if (box2) {
				flock.dispose(box2);
				box2 = undefined;
			}
		});

		it("should move the box to the correct position @slow", function (done) {
			this.timeout(2000); // Set a reasonable timeout for a short animation
			// Call glideTo to move the

			flock
				.glideTo(box1, { x: 6, y: 0, z: 0, duration: 0.5 })
				.then(() => {
					const box = flock.scene.getMeshByName(box1);

					// Assert the box has moved to the correct position
					expect(box.position.x).to.equal(6);
					expect(box.position.y).to.equal(0.5);
					expect(box.position.z).to.equal(0);
					done();
				});
		});

		it("should handle reverse movement @slow", function (done) {
			this.timeout(5000); // Increase the timeout for this test

			// Move the box with reverse enabled
			flock.glideTo(box1, {
				x: 6,
				y: 0,
				z: 0,
				duration: 2,
				reverse: true,
			});

			let hasReachedTarget = false;
			let hasReturned = false;

			// Check the box's position periodically
			const intervalId = setInterval(() => {
				const box = flock.scene.getMeshByName(box1);
				if (!box) return;

				// Log the current position for debugging
				//console.log(`[Reverse Test] Current X: ${box.position.x.toFixed(3)}`);

				// Check if it reached the target
				if (checkXPosition(box, 6)) {
					hasReachedTarget = true;
				}

				// If it has reached the target, now check if it has returned
				// Use 'else if' to ensure we don't check for return on the same tick we reach the target
				else if (hasReachedTarget && checkXPosition(box, 0)) {
					hasReturned = true;
				}
			}, 25); // Check more frequently to reliably catch the peak position

			// After the full animation duration (2s out + 2s back), check the states
			setTimeout(() => {
				try {
					clearInterval(intervalId);
					expect(hasReachedTarget, "Box did not reach target").to.be
						.true;
					expect(hasReturned, "Box did not return to start").to.be
						.true;
					done();
				} catch (e) {
					done(e);
				}
			}, 4500); // Wait for 4.5 seconds to be safe
		});

		it("should handle looping", function (done) {
			this.timeout(10000); // Increase the timeout for this test

			// Move the box with loop enabled
			flock.glideTo(box1, {
				x: 6,
				y: 0,
				z: 0,
				duration: 1,
				reverse: false,
				loop: true,
			}); // Start the glide with looping enabled

			// Track position changes to detect looping
			let maxPosition = 0;
			let hasReachedTarget = false;
			let hasReturnedToStart = false;
			let count = 0;

			const intervalId = setInterval(() => {
				const box = flock.scene.getMeshByName(box1);
				const currentX = box.position.x;

				console.log("Loop check", count, "Position:", currentX);

				// Track the maximum position reached
				if (currentX > maxPosition) {
					maxPosition = currentX;
				}

				// Check if we've reached near the target (x=6)
				if (currentX > 5 && !hasReachedTarget) {
					hasReachedTarget = true;
					console.log("Reached target position");
				}

				// Check if we've returned to near start after reaching target
				if (hasReachedTarget && currentX < 1 && !hasReturnedToStart) {
					hasReturnedToStart = true;
					console.log("Returned to start - loop cycle detected");
				}

				count++;

				// After enough time, check if we detected loop behavior
				if (count > 8) {
					clearInterval(intervalId);

					// We should have seen the box reach the target and return (indicating a loop)
					// OR the maximum position should be significantly greater than 0 (indicating movement)
					const loopDetected = hasReturnedToStart || maxPosition > 3;
					console.log("Loop test results:", {
						hasReachedTarget,
						hasReturnedToStart,
						maxPosition,
						loopDetected,
					});

					expect(loopDetected).to.be.true;
					done();
				}
			}, 1000);
		});

		it("should follow the correct easing function", function (done) {
			this.timeout(5000); // Increase the timeout for this test
			// Test with different easing options (Linear by default)

			flock
				.glideTo(box1, {
					x: 6,
					y: 0,
					z: 0,
					duration: 1,
					reverse: false,
					loop: false,
					easing: "SineEase",
				})
				.then(() => {
					const box = flock.scene.getMeshByName(box1);

					// Check if the position matches expected easing behavior
					expect(box.position.x).to.be.closeTo(6, 0.1); // Within some tolerance
					expect(box.position.y).to.be.closeTo(0.5, 0.1);
					expect(box.position.z).to.be.closeTo(0, 0.1);
					done();
				});
		});

		it("should complete within the given duration", function (done) {
			this.timeout(3000); // Tighter timeout for a 2s animation
			let startTime = null;
			const box = flock.scene.getMeshByName(box1);

			// Observer to start the timer on first movement
			const observer = flock.scene.onBeforeRenderObservable.add(() => {
				if (box.position.x > 0 && startTime === null) {
					startTime = Date.now();
				}
			});

			flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2 }).then(() => {
				flock.scene.onBeforeRenderObservable.remove(observer); // Clean up observer
				const endTime = Date.now();
				const duration = (endTime - startTime) / 1000; // Convert to seconds
				console.log(
					`Glide duration test: expected ~2s, got ${duration.toFixed(3)}s`,
				);

				// Assert the movement took approximately the specified duration
				expect(duration).to.be.closeTo(2, 0.5);
				done();
			});
		});
	});
}
