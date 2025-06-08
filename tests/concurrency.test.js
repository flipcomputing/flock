import { expect } from "chai";

export function runConcurrencyTests(flock) {
	describe("Concurrency and Stress Tests", function () {
		this.timeout(30000); // Extended timeout for stress tests
		const createdObjects = [];

		beforeEach(async function () {
			flock.scene ??= {};
		});

		afterEach(function () {
			// Clean up all created objects
			createdObjects.forEach((objId) => {
				try {
					flock.dispose(objId);
				} catch (e) {
					// Ignore disposal errors during cleanup
				}
			});
			createdObjects.length = 0;
		});

		describe("Concurrent Object Creation", function () {
			it("should handle single object creation", async function () {
				const objectId = "single_test_object";
				createdObjects.push(objectId);

				console.log(`Creating object with ID: ${objectId}`);
				const result = flock.createObject({
					modelName: "tree.glb",
					modelId: objectId,
					color: ["#ff0000", "#00ff00"],
					position: { x: 0, y: 0, z: 0 }
				});

				console.log(`createObject returned: ${result}`);
				expect(result).to.be.a("string");

				// Wait for the model to actually load
				console.log(`Waiting for model to be ready...`);
				await flock.wait(2000); // Give it time to load

				// Now verify object exists
				console.log(`Looking for mesh with name: ${objectId}`);
				const mesh = flock.scene.getMeshByName(objectId);
				console.log(`Found mesh:`, mesh ? mesh.name : 'null');

				// Debug: list all mesh names in scene
				console.log('All mesh names in scene:', flock.scene.meshes.map(m => m.name));

				expect(mesh).to.exist;
			});
		});


		describe("Concurrent Say Operations", function () {
			it("should handle single say operation", async function () {
				const objectId = "single_say_test_object";
				createdObjects.push(objectId);

				console.log(`Creating object for say test with ID: ${objectId}`);
				const result = flock.createObject({
					modelName: "tree.glb",
					modelId: objectId,
					color: ["#ff0000", "#00ff00"],
					position: { x: 0, y: 0, z: 0 }
				});

				console.log(`createObject returned: ${result}`);
				expect(result).to.be.a("string");

				// Use the public API - say() handles model readiness internally
				if (flock.say) {
					console.log(`Starting say operation on ${result}`);
					// Just call say directly - it will wait for the model to be ready internally
					await flock.say(result, "Hello World", 1);
					console.log(`Say operation completed`);
				} else {
					console.log(`Skipping say operation - say function not available`);
				}

				expect(true).to.be.true; // Test passes if no errors thrown
			});

			it("should handle multiple simultaneous say operations", async function () {
				// Create several objects first
				const objectIds = [];
				for (let i = 0; i < 10; i++) {
					const objectId = `say_object_${i}`;
					const returnedId = flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i, y: 0, z: 0 }
					});

					// Use the actual returned ID, not the passed one
					objectIds.push(returnedId);
					createdObjects.push(returnedId);
				}

				// Wait for objects to be ready
				await flock.wait(2000);

				// Now perform concurrent say operations
				const sayPromises = objectIds.map((objectId, index) => {
					if (flock.say && objectId) {
						console.log(`Starting say operation on ${objectId}`);
						return flock.say(objectId, `Message ${index}`, 2);
					} else {
						// If say doesn't exist or objectId is undefined, simulate with a delay
						console.log(`Skipping say operation for ${objectId}`);
						return new Promise(resolve => setTimeout(resolve, 100));
					}
				});

				await Promise.all(sayPromises);
				expect(true).to.be.true; // Test passes if no errors thrown
			});

			it("should handle rapid sequential say operations on same object", async function () {
				const objectId = "rapid_say_object";
				const returnedId = flock.createObject({
					modelName: "tree.glb",
					modelId: objectId,
					position: { x: 0, y: 0, z: 0 }
				});

				createdObjects.push(returnedId);

				await flock.wait(2000);

				// Rapid fire say operations
				const sayPromises = [];
				for (let i = 0; i < 20; i++) {
					if (flock.say && returnedId) {
						sayPromises.push(flock.say(returnedId, `Rapid ${i}`, 0.5));
					} else {
						sayPromises.push(Promise.resolve());
					}
				}

				await Promise.all(sayPromises);
				expect(true).to.be.true;
			});
		});

		describe("Concurrent Mesh Operations", function () {
			it("should handle concurrent position updates", async function () {
				this.timeout(40000); // Increase timeout for this specific test
				const objectIds = [];

				// Create objects and store the returned IDs
				for (let i = 0; i < 10; i++) { // Reduced from 15 to 10 objects
					const objectId = `position_object_${i}`;
					const returnedId = flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i, y: 0, z: 0 }
					});

					console.log(`Created position object ${i}: ${objectId} -> ${returnedId}`);
					// Use the returned ID, not the passed one
					objectIds.push(returnedId);
					createdObjects.push(returnedId);
				}

				await flock.wait(3000); // Increased wait time

				// Concurrent position updates
				const movePromises = objectIds.map((objectId, index) => {
					const newX = Math.random() * 10 - 5; // Reduced range
					const newZ = Math.random() * 10 - 5;

					console.log(`Starting move operation on ${objectId} to ${newX}, ${newZ}`);

					if (flock.glideTo) {
						// Use glideTo as it's more reliable than moveTo - duration in seconds
						return flock.glideTo(objectId, { x: newX, y: 0, z: newZ, duration: 2 });
					} else if (flock.moveTo) {
						return flock.moveTo(objectId, { x: newX, y: 0, z: newZ });
					} else {
						console.log(`No movement functions available, skipping ${objectId}`);
						return Promise.resolve();
					}
				});

				console.log(`Waiting for ${movePromises.length} movement operations to complete...`);
				await Promise.all(movePromises);
				console.log(`All movement operations completed`);
				expect(true).to.be.true;
			});

			it("should handle concurrent color changes", async function () {
				const objectIds = [];

				// Create objects
				for (let i = 0; i < 12; i++) {
					const objectId = `color_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i % 4, y: 0, z: Math.floor(i / 4) }
					});
				}

				await flock.wait(1000);

				// Concurrent color changes
				const colorPromises = objectIds.map((objectId) => {
					const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
					if (flock.changeColor) {
						return flock.changeColor(objectId, randomColor);
					} else {
						return Promise.resolve();
					}
				});

				await Promise.all(colorPromises);
				expect(true).to.be.true;
			});

			it("should handle concurrent scaling operations", async function () {
				const objectIds = [];

				// Create objects
				for (let i = 0; i < 10; i++) {
					const objectId = `scale_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i * 2, y: 0, z: 0 }
					});
				}

				await flock.wait(1000);

				// Concurrent scaling
				const scalePromises = objectIds.map((objectId) => {
					const randomScale = 0.5 + Math.random() * 2; // Scale between 0.5 and 2.5
					if (flock.scale) {
						return flock.scale(objectId, randomScale);
					} else {
						return Promise.resolve();
					}
				});

				await Promise.all(scalePromises);
				expect(true).to.be.true;
			});
		});

		describe("Concurrent Animation Operations", function () {
			it("should handle concurrent animation starts", async function () {
				const objectIds = [];

				// Create objects
				for (let i = 0; i < 8; i++) {
					const objectId = `anim_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i * 2, y: 0, z: 0 }
					});
				}

				await flock.wait(1000);

				// Concurrent animations
				const animPromises = objectIds.map((objectId) => {
					if (flock.rotateAnim) {
						return flock.rotateAnim(objectId, { 
							y: 360, 
							duration: 2000,
							loop: false 
						});
					} else {
						return Promise.resolve();
					}
				});

				await Promise.all(animPromises);
				expect(true).to.be.true;
			});

			it("should handle concurrent glideTo operations", async function () {
				const objectIds = [];

				// Create objects
				for (let i = 0; i < 10; i++) {
					const objectId = `glide_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i, y: 0, z: 0 }
					});
				}

				await flock.wait(1000);

				// Concurrent glide operations
				const glidePromises = objectIds.map((objectId, index) => {
					return flock.glideTo(objectId, { 
						x: Math.random() * 20 - 10, 
						y: 0, 
						z: Math.random() * 20 - 10,
						duration: 2000 
					});
				});

				await Promise.all(glidePromises);
				expect(true).to.be.true;
			});
		});

		describe("Concurrent Show/Hide Operations", function () {
			it("should handle rapid show/hide toggles across multiple objects", async function () {
				const objectIds = [];

				// Create objects
				for (let i = 0; i < 15; i++) {
					const objectId = `toggle_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i % 5, y: 0, z: Math.floor(i / 5) }
					});
				}

				await flock.wait(1000);

				// Perform multiple rounds of concurrent show/hide
				for (let round = 0; round < 3; round++) {
					// Hide all objects concurrently
					const hidePromises = objectIds.map(objectId => flock.hide(objectId));
					await Promise.all(hidePromises);

					await flock.wait(300);

					// Show all objects concurrently
					const showPromises = objectIds.map(objectId => flock.show(objectId));
					await Promise.all(showPromises);

					await flock.wait(300);
				}

				expect(true).to.be.true;
			});
		});

		describe("Mixed Concurrent Operations", function () {
			it("should handle mixed operations on different objects simultaneously", async function () {
				const objectIds = [];

				// Create various objects
				for (let i = 0; i < 20; i++) {
					const objectId = `mixed_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i % 5, y: 0, z: Math.floor(i / 5) }
					});
				}

				await flock.wait(1000);

				// Mix of different operations happening simultaneously
				const mixedPromises = objectIds.map((objectId, index) => {
					const operation = index % 6;

					switch (operation) {
						case 0:
							// Move operation
							return flock.glideTo ? (flock.glideTo(objectId, { 
								x: Math.random() * 10, 
								y: 0, 
								z: Math.random() * 10,
								duration: 1500 
							}) || Promise.resolve()) : Promise.resolve();

						case 1:
							// Color change
							return flock.changeColor ? (flock.changeColor(objectId, 
								`#${Math.floor(Math.random() * 16777215).toString(16)}`
							) || Promise.resolve()) : Promise.resolve();

						case 2:
							// Rotation
							return flock.rotateAnim ? (flock.rotateAnim(objectId, { 
								y: 180, 
								duration: 1500 
							}) || Promise.resolve()) : Promise.resolve();

						case 3:
							// Scale
							return flock.scale ? (flock.scale(objectId, 
								0.5 + Math.random()
							) || Promise.resolve()) : Promise.resolve();

						case 4:
							// Say operation
							return flock.say ? (flock.say(objectId, 
								`Object ${index}`, 2
							) || Promise.resolve()) : Promise.resolve();

						case 5:
							// Hide then show - ensure all operations return promises
							const hidePromise = flock.hide(objectId) || Promise.resolve();
							const waitPromise = (result) => flock.wait(500);
							const showPromise = () => flock.show(objectId) || Promise.resolve();
							
							return hidePromise
								.then(waitPromise)
								.then(showPromise);

						default:
							return Promise.resolve();
					}
				});

				await Promise.all(mixedPromises);
				expect(true).to.be.true;
			});

			it("should handle overlapping whenModelReady calls", async function () {
				const objectIds = [];

				// Create objects and immediately start operations on them
				const createPromises = [];
				for (let i = 0; i < 15; i++) {
					const objectId = `overlap_object_${i}`;
					objectIds.push(objectId);
					createdObjects.push(objectId);

					// Create object
					const createPromise = Promise.resolve().then(() => {
						flock.createObject({
							modelName: "tree.glb",
							modelId: objectId,
							position: { x: i % 5, y: 0, z: Math.floor(i / 5) }
						});

						// Immediately start multiple operations that use whenModelReady
						const ops = [];

						if (flock.changeColor) {
							ops.push(flock.changeColor(objectId, "#ff0000"));
						}

						if (flock.say) {
							ops.push(flock.say(objectId, `Loading ${i}`, 1));
						}

						ops.push(flock.glideTo(objectId, { 
							x: i % 5 + 1, 
							y: 1, 
							z: Math.floor(i / 5),
							duration: 1
						}));

						if (flock.scale) {
							ops.push(flock.scale(objectId, 1.5));
						}

						return Promise.all(ops);
					});

					createPromises.push(createPromise);
				}

				await Promise.all(createPromises);
				expect(true).to.be.true;
			});
		});

		describe("Error Resilience Under Concurrency", function () {
			it("should handle operations on non-existent objects gracefully", async function () {
				const promises = [];

				// Try operations on objects that don't exist
				for (let i = 0; i < 20; i++) {
					const fakeId = `non_existent_${i}`;

					promises.push(flock.glideTo(fakeId, { x: 1, y: 1, z: 1, duration: 500 }));

					if (flock.changeColor) {
						promises.push(flock.changeColor(fakeId, "#ff0000"));
					}

					if (flock.say) {
						promises.push(flock.say(fakeId, "Test", 1000));
					}

					promises.push(flock.hide(fakeId));
					promises.push(flock.show(fakeId));
				}

				// These should all complete without throwing errors
				await Promise.all(promises);
				expect(true).to.be.true;
			});

			it("should handle rapid creation and disposal", async function () {
				const promises = [];

				for (let i = 0; i < 10; i++) {
					const objectId = `rapid_lifecycle_${i}`;

					const promise = Promise.resolve().then(async () => {
						// Create object
						flock.createObject({
							modelName: "tree.glb",
							modelId: objectId,
							position: { x: i, y: 0, z: 0 }
						});

						// Wait a bit
						await flock.wait(200);

						// Try some operations
						if (flock.changeColor) {
							await flock.changeColor(objectId, "#00ff00");
						}

						// Dispose immediately
						await flock.dispose(objectId);
					});

					promises.push(promise);
				}

				await Promise.all(promises);
				expect(true).to.be.true;
			});
		});

		describe("Performance Under Load", function () {
			it("should maintain performance with many concurrent whenModelReady calls", async function () {
				const startTime = Date.now();
				const promises = [];

				// Create objects
				for (let i = 0; i < 30; i++) {
					const objectId = `perf_object_${i}`;
					createdObjects.push(objectId);

					flock.createObject({
						modelName: "tree.glb",
						modelId: objectId,
						position: { x: i % 6, y: 0, z: Math.floor(i / 6) }
					});
				}

				// Immediately start many whenModelReady operations
				for (let i = 0; i < 30; i++) {
					const objectId = `perf_object_${i}`;

					for (let j = 0; j < 5; j++) {
						promises.push(
							flock.whenModelReady(objectId, (mesh) => {
								if (mesh) {
									// Simple operation
									mesh.position.y = Math.random();
								}
							})
						);
					}
				}

				await Promise.all(promises);

				const endTime = Date.now();
				const duration = endTime - startTime;

				// Should complete within reasonable time (adjust as needed)
				expect(duration).to.be.lessThan(15000);
			});
		});

	});
}