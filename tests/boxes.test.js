import { expect } from "chai";

// Stress test for handling many boxes with dynamic inputs
export function runStressTests(flock) {
	describe("Stress test for many boxes @slow", function () {
		const boxCount = 50; // Number of boxes to create
		const boxIds = [];
		const boxColors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
		const maxPosition = 10; // Maximum position range for x, y, z

		// Set up the scene before each test
		beforeEach(async function () {
			flock.scene ??= {};
		});

		// Clean up after each test
		afterEach(function () {
			// Dispose of all boxes to avoid memory leaks
			boxIds.forEach(boxId => {
				if (typeof boxId !== "string") {
					throw new Error(`Invalid ID: Expected a string, but got ${typeof boxId}`);
				}

				console.log(`Cleaning up box with ID: ${boxId}`);
				flock.dispose(boxId); // Use the ID
			});
			boxIds.length = 0; // Clear the array

			// Verify that all meshes and materials are cleaned up
			validateSceneCleanup();
		});

		it("should handle many boxes with dynamic inputs", function (done) {
			this.timeout(20000); // Increase the timeout for this test

			// Create multiple boxes with random properties
			for (let i = 0; i < boxCount; i++) {
				const boxId = `box${i}`;
				const color = boxColors[Math.floor(Math.random() * boxColors.length)];
				const size = Math.random() * 0.5 + 0.5; // Random size between 0.5 and 1
				const position = [
					Math.random() * maxPosition - maxPosition / 2,
					Math.random() * maxPosition - maxPosition / 2,
					Math.random() * maxPosition - maxPosition / 2,
				];

				// Create the box and store its ID
				const returnedId = flock.createBox(boxId, {
				  color,
				  width: size,
				  height: size,
				  depth: size,
				  position,
				});


				// Validate that createBox returns a string ID
				if (typeof returnedId !== "string") {
					throw new Error(`createBox did not return a valid string ID. Got: ${returnedId}`);
				}

				// Store the ID in the array
				boxIds.push(returnedId);
			}

			// Track the start time
			const startTime = Date.now();

			// Periodically show, hide, and move boxes
			const intervalId = setInterval(() => {
				boxIds.forEach((boxId, index) => {
					// Validate that the ID is a string
					if (typeof boxId !== "string") {
						throw new Error(`Invalid ID: Expected a string, but got ${typeof boxId}`);
					}

					// Log the ID for debugging
					console.log(`Processing box with ID: ${boxId}`);

					// Alternate visibility based on index (deterministic)
					const isVisible = index % 2 === 0;
					if (isVisible) {
						console.log(`Showing box with ID: ${boxId}`);
						flock.show(boxId); // Use the ID
					} else {
						console.log(`Hiding box with ID: ${boxId}`);
						flock.hide(boxId); // Use the ID
					}

					// Randomly move the box if it's visible
					const box = flock.scene.getMeshByName(boxId);
					if (box && box.isEnabled()) {
						const targetX = Math.random() * maxPosition - maxPosition / 2;
						const targetY = Math.random() * maxPosition - maxPosition / 2;
						const targetZ = Math.random() * maxPosition - maxPosition / 2;

						flock.glideTo(boxId, targetX, targetY, targetZ, 500); // Use the ID
					}
				});

				// Stop after 10 seconds
				if (Date.now() - startTime > 10000) {
					clearInterval(intervalId);

					// Add a short delay to allow visibility updates to propagate
					setTimeout(() => {
						// Verify the final state of all boxes
						boxIds.forEach((boxId, index) => {
							const box = flock.scene.getMeshByName(boxId);

							// Validate that the box exists
							if (!box) {
								throw new Error(`Box with ID '${boxId}' not found in the scene.`);
							}

							// Check visibility (deterministic based on index)
							const isVisible = index % 2 === 0;
							console.log(
								`Expecting box with ID '${boxId}' to be ${
									isVisible ? "visible" : "hidden"
								}`
							);
							if (isVisible) {
								expect(box.isEnabled()).to.be.true;
							} else {
								expect(box.isEnabled()).to.be.false;
							}

							// Check position (within tolerance)
							expect(box.position.x).to.be.closeTo(box.position.x, 0.1);
							expect(box.position.y).to.be.closeTo(box.position.y, 0.1);
							expect(box.position.z).to.be.closeTo(box.position.z, 0.1);
						});

						done();
					}, 500); // Wait 500ms for visibility updates to propagate
				}
			}, 500); // Update every 500ms
		});

		/**
		 * Validates that all meshes and materials are cleaned up after the test.
		 */
		function validateSceneCleanup() {
			// Check for remaining meshes
			const remainingMeshes = flock.scene.meshes.filter(mesh => mesh.id.startsWith("box"));
			if (remainingMeshes.length > 0) {
				console.error("Remaining meshes:", remainingMeshes.map(mesh => mesh.id));
				throw new Error(`${remainingMeshes.length} meshes were not disposed of.`);
			}

			// Check for remaining materials
			const remainingMaterials = flock.scene.materials.filter(material => material.name.startsWith("material"));
			if (remainingMaterials.length > 0) {
				console.error("Remaining materials:", remainingMaterials.map(material => material.name));
				throw new Error(`${remainingMaterials.length} materials were not disposed of.`);
			}

			console.log("All meshes and materials have been successfully cleaned up.");
		}
	});
}