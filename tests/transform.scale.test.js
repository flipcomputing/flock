import { expect } from "chai";

export function runScaleTests(flock) {
	describe("Scale function tests", function () {
		const testBoxIds = [];
		const testColors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];
		const scaleFactors = [0.5, 1.0, 1.5, 2.0, 3.0];
		const origins = [
			"CENTRE",
			"LEFT",
			"RIGHT",
			"TOP",
			"BOTTOM",
			"FRONT",
			"BACK",
		];

		// Set up the scene before each test
		beforeEach(async function () {
			flock.scene ??= {};
		});

		// Clean up after each test
		afterEach(function () {
			testBoxIds.forEach((boxId) => {
				if (typeof boxId !== "string") {
					throw new Error(
						`Invalid ID: Expected a string, but got ${typeof boxId}`,
					);
				}
				console.log(`Cleaning up box with ID: ${boxId}`);
				flock.dispose(boxId);
			});
			testBoxIds.length = 0;
		});

		it("should scale uniformly when all scale factors are equal", async function () {
			const boxId = flock.createBox("test-box-uniform", {
				color: testColors[0],
				width: 2,
				height: 2,
				depth: 2,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			await flock.scale(boxId, { x: 2, y: 2, z: 2 });

			const mesh = flock.scene.getMeshByID(boxId);
			expect(mesh.scaling.x).to.equal(2);
			expect(mesh.scaling.y).to.equal(2);
			expect(mesh.scaling.z).to.equal(2);
		});

		it("should scale non-uniformly with different factors", async function () {
			const boxId = flock.createBox("test-box-nonuniform", {
				color: testColors[1],
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			await flock.scale(boxId, { x: 3, y: 1.5, z: 0.5 });

			const mesh = flock.scene.getMeshByID(boxId);
			expect(mesh.scaling.x).to.equal(3);
			expect(mesh.scaling.y).to.equal(1.5);
			expect(mesh.scaling.z).to.equal(0.5);
		});

		it("should maintain position with different origin points", async function () {
			const boxId = flock.createBox("test-box-origins", {
				color: testColors[2],
				width: 2,
				height: 2,
				depth: 2,
				position: [5, 5, 5],
			});
			testBoxIds.push(boxId);

			const originalBounds = flock.scene
				.getMeshByID(boxId)
				.getBoundingInfo();
			const originalBottom = originalBounds.boundingBox.minimumWorld.y;

			await flock.scale(boxId, { x: 2, y: 2, z: 2, yOrigin: "BASE" });

			const newBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			const newBottom = newBounds.boundingBox.minimumWorld.y;

			expect(Math.abs(newBottom - originalBottom)).to.be.lessThan(0.001);
		});

		it("should handle zero scaling gracefully", async function () {
			const boxId = flock.createBox("test-box-zero", {
				color: testColors[3],
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			await flock.scale(boxId, { x: 1, y: 0, z: 1 });

			const mesh = flock.scene.getMeshByID(boxId);
			expect(mesh.scaling.y).to.equal(0);
		});

		it("should use default values when parameters are omitted", async function () {
			const boxId = flock.createBox("test-box-defaults", {
				color: testColors[0],
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			await flock.scale(boxId, { x: 2 }); // Only specify x

			const mesh = flock.scene.getMeshByID(boxId);
			expect(mesh.scaling.x).to.equal(2);
			expect(mesh.scaling.y).to.equal(1); // Default
			expect(mesh.scaling.z).to.equal(1); // Default
		});
	});
}

// Tests for resize function
export function runResizeTests(flock) {
	describe("Resize function tests", function () {
		const testBoxIds = [];
		const testColors = ["#FF6600", "#66FF00", "#0066FF", "#FF0066"];
		const targetSizes = [1, 2, 5, 10, 0.5];
		const origins = [
			"CENTRE",
			"LEFT",
			"RIGHT",
			"TOP",
			"BASE",
			"FRONT",
			"BACK",
		];

		// Set up the scene before each test
		beforeEach(async function () {
			flock.scene ??= {};
		});

		// Clean up after each test
		afterEach(function () {
			testBoxIds.forEach((boxId) => {
				if (typeof boxId !== "string") {
					throw new Error(
						`Invalid ID: Expected a string, but got ${typeof boxId}`,
					);
				}
				console.log(`Cleaning up box with ID: ${boxId}`);
				flock.dispose(boxId);
			});
			testBoxIds.length = 0;
		});

		it("should resize to exact dimensions", async function () {
			const boxId = flock.createBox("test-box-exact", {
				color: testColors[0],
				width: 2,
				height: 3,
				depth: 4,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			await flock.resize(boxId, { width: 10, height: 5, depth: 8 });

			const bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			const actualWidth =
				bounds.boundingBox.maximumWorld.x -
				bounds.boundingBox.minimumWorld.x;
			const actualHeight =
				bounds.boundingBox.maximumWorld.y -
				bounds.boundingBox.minimumWorld.y;
			const actualDepth =
				bounds.boundingBox.maximumWorld.z -
				bounds.boundingBox.minimumWorld.z;

			expect(Math.abs(actualWidth - 10)).to.be.lessThan(0.001);
			expect(Math.abs(actualHeight - 5)).to.be.lessThan(0.001);
			expect(Math.abs(actualDepth - 8)).to.be.lessThan(0.001);
		});

		it("should maintain anchor points with different origins", async function () {
			const boxId = flock.createBox("test-box-anchor", {
				color: testColors[1],
				width: 2,
				height: 2,
				depth: 2,
				position: [5, 3, 7],
			});
			testBoxIds.push(boxId);

			const originalBounds = flock.scene
				.getMeshByID(boxId)
				.getBoundingInfo();
			const originalBase = originalBounds.boundingBox.minimumWorld.y;

			await flock.resize(boxId, {
				width: 4,
				height: 6,
				depth: 3,
				yOrigin: "BASE",
			});

			const newBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			const newBase = newBounds.boundingBox.minimumWorld.y;

			expect(Math.abs(newBase - originalBase)).to.be.lessThan(0.001);
		});

		it("should handle partial resizing (null dimensions)", async function () {
			const boxId = flock.createBox("test-box-partial", {
				color: testColors[2],
				width: 3,
				height: 4,
				depth: 5,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			const originalBounds = flock.scene
				.getMeshByID(boxId)
				.getBoundingInfo();
			const originalHeight =
				originalBounds.boundingBox.maximumWorld.y -
				originalBounds.boundingBox.minimumWorld.y;

			await flock.resize(boxId, { width: 6 }); // Only resize width

			const newBounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			const newWidth =
				newBounds.boundingBox.maximumWorld.x -
				newBounds.boundingBox.minimumWorld.x;
			const newHeight =
				newBounds.boundingBox.maximumWorld.y -
				newBounds.boundingBox.minimumWorld.y;

			expect(Math.abs(newWidth - 6)).to.be.lessThan(0.001);
			expect(Math.abs(newHeight - originalHeight)).to.be.lessThan(0.001); // Should remain unchanged
		});

		it("should preserve original dimensions for future resizing", async function () {
			const boxId = flock.createBox("test-box-preserve", {
				color: testColors[3],
				width: 2,
				height: 3,
				depth: 4,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			// First resize
			await flock.resize(boxId, { width: 10, height: 15, depth: 20 });

			// Second resize back to original proportions
			await flock.resize(boxId, { width: 2, height: 3, depth: 4 });

			const bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			const actualWidth =
				bounds.boundingBox.maximumWorld.x -
				bounds.boundingBox.minimumWorld.x;
			const actualHeight =
				bounds.boundingBox.maximumWorld.y -
				bounds.boundingBox.minimumWorld.y;
			const actualDepth =
				bounds.boundingBox.maximumWorld.z -
				bounds.boundingBox.minimumWorld.z;

			expect(Math.abs(actualWidth - 2)).to.be.lessThan(0.001);
			expect(Math.abs(actualHeight - 3)).to.be.lessThan(0.001);
			expect(Math.abs(actualDepth - 4)).to.be.lessThan(0.001);
		});

		it("should handle very small and very large dimensions", async function () {
			const boxId = flock.createBox("test-box-extreme", {
				color: testColors[0],
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			testBoxIds.push(boxId);

			// Test very small
			await flock.resize(boxId, {
				width: 0.001,
				height: 0.001,
				depth: 0.001,
			});
			let bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			let actualWidth =
				bounds.boundingBox.maximumWorld.x -
				bounds.boundingBox.minimumWorld.x;
			expect(Math.abs(actualWidth - 0.001)).to.be.lessThan(0.0001);

			// Test very large
			await flock.resize(boxId, {
				width: 1000,
				height: 1000,
				depth: 1000,
			});
			bounds = flock.scene.getMeshByID(boxId).getBoundingInfo();
			actualWidth =
				bounds.boundingBox.maximumWorld.x -
				bounds.boundingBox.minimumWorld.x;
			expect(Math.abs(actualWidth - 1000)).to.be.lessThan(0.1);
		});
	});
}
