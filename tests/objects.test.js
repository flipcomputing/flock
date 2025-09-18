import { expect } from "chai";

export function runCreateObjectTests(flock) {
	describe("createObject tests @slow", function () {
		this.timeout(5000);

		it("should create one object then create another", async function () {
			// Create the first tree object.
			const tree1 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__1",
				color: ["#cd853f", "#66cdaa"],
				position: { x: 0, y: 0, z: -10.8 }
			});
			expect(tree1).to.be.a("string");

			// Create a second tree object.
			const tree2 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__2",
				color: ["#66cdaa", "#cd853f"],
				scale: 1,
				position: { x: -3, y: 0, z: 10.8 }
			});
			expect(tree2).to.be.a("string");
		});

		it("should hide and then show an object", async function () {
			const tree = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__3",
				color: ["#66cdaa", "#cd853f"],
				scale: 1,
				position: { x: -4, y: 0, z: 10.8 }
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
						position: { x: i * 2, y: 0, z: 10.8 }
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
				position: { x: 0, y: 0, z: -10.8 }
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
				color: ["#cd853f", "#66cdaa"]
			});
			expect(result5).to.be.a("string");

			// Test with invalid color - should log error but return ID
			const result6 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__test6",
				position: { x: 0, y: 0, z: -10.8 },
				color: "invalid"
			});
			expect(result6).to.be.a("string");

			// Test with missing required fields - should log error but return ID
			const result7 = flock.createObject({
				modelName: "tree.glb"
			});
			expect(result7).to.be.a("string");
		});

		it("should correctly handle modelId and blockId splitting", function () {
			// Create a mesh with a valid modelId__blockId format
			const modelId = "tree.glb__block123";
			const result = flock.createObject({
				modelName: "tree.glb",
				modelId: modelId,
				color: ["#cd853f", "#66cdaa"],
				position: { x: 0, y: 0, z: 0 }
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
				position: { x: 0, y: 0, z: 0 }
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
				position: { x: 0, y: 0, z: 0 }
			});
			const mesh3 = flock.scene.getMeshByName(result3);
			expect(mesh3).to.exist;
			expect(mesh3.metadata.blockKey).to.equal("block123");  // Only takes first part after __

			// Test with empty string after double underscore
			const modelId4 = "tree.glb__";
			const result4 = flock.createObject({
				modelName: "tree.glb",
				modelId: modelId4,
				color: ["#cd853f", "#66cdaa"],
				position: { x: 0, y: 0, z: 0 }
			});
			const mesh4 = flock.scene.getMeshByName(result4);
			expect(mesh4).to.exist;
			expect(mesh4.metadata.blockKey).to.equal("");  // Empty string after __
		});

		it("should handle object scaling operations", async function () {
			const tree = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__scale",
				position: { x: 0, y: 0, z: 0 },
				scale: 1
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
				rotation: { x: 0, y: 0, z: 0 }
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
				position: { x: 0, y: 0, z: 0 }
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
				position: { x: 0, y: 0, z: 0 }
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
				color: ["#ff0000", "#00ff00"]
			});
			expect(tree).to.be.a("string");

			// Test color updates if available
			if (flock.setColor) {
				await flock.setColor(tree, ["#0000ff", "#ff00ff"]);
				await flock.wait(0.5);
				await flock.setColor(tree, ["#ffffff", "#000000"]);
			}
		});
	});
}