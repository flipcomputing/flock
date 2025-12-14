import { expect } from "chai";

export function runTranslationTests(flock) {
	describe("Translation API Tests @translation @slow", function () {
		let boxId;

		beforeEach(async function () {
			boxId = `box_${Date.now()}`;
			flock.createBox(boxId, {
				color: "#FF00FF",
				width: 1,
				height: 2,
				depth: 1,
				position: [0, 0, 0],
			});

			// Ensure we always exercise the pivotSettings branch:
			// default pivot: x=CENTER, y=MIN (BASE), z=CENTER
			await flock.setAnchor(boxId);
		});

		afterEach(function () {
			if (boxId) {
				flock.dispose(boxId);
			}
		});

		it("should position a box so its pivot (BASE) is at the specified coordinates by default", async function () {
			await flock.positionAt(boxId, { x: 5, y: 3, z: -2 });

			const box = flock.scene.getMeshByName(boxId);
			const pivotWorld = box.getAbsolutePivotPoint();

			expect(pivotWorld.x).to.be.closeTo(5, 0.01);
			expect(pivotWorld.y).to.be.closeTo(3, 0.01);
			expect(pivotWorld.z).to.be.closeTo(-2, 0.01);
		});

		it("should position a box so its pivot is at the specified coordinates when yReference: CENTER is passed (current pivot-based semantics)", async function () {
			await flock.positionAt(boxId, {
				x: 1,
				y: 2,
				z: 3,
				yReference: "CENTER", // currently ignored; treated like default
			});

			const box = flock.scene.getMeshByName(boxId);
			const pivotWorld = box.getAbsolutePivotPoint();

			expect(pivotWorld.x).to.be.closeTo(1, 0.01);
			expect(pivotWorld.y).to.be.closeTo(2, 0.01);
			expect(pivotWorld.z).to.be.closeTo(3, 0.01);
		});

		it("should position a box so its pivot is at the specified coordinates when yReference: TOP is passed (current pivot-based semantics)", async function () {
			await flock.positionAt(boxId, {
				x: -1,
				y: -2,
				z: 4,
				yReference: "TOP", // currently ignored; treated like default
			});

			const box = flock.scene.getMeshByName(boxId);
			const pivotWorld = box.getAbsolutePivotPoint();

			expect(pivotWorld.x).to.be.closeTo(-1, 0.01);
			expect(pivotWorld.y).to.be.closeTo(-2, 0.01);
			expect(pivotWorld.z).to.be.closeTo(4, 0.01);
		});

		it("should ignore Y when useY is false (pivot stays at original Y)", async function () {
			// First, move pivot somewhere with a known Y
			await flock.positionAt(boxId, { x: 0, y: 10, z: 0 });
			const initialPivot = flock.scene
				.getMeshByName(boxId)
				.getAbsolutePivotPoint()
				.clone();

			// Now move with useY: false
			await flock.positionAt(boxId, { x: 5, y: 99, z: 5, useY: false });

			const box = flock.scene.getMeshByName(boxId);
			const pivotWorld = box.getAbsolutePivotPoint();

			expect(pivotWorld.x).to.be.closeTo(5, 0.01);
			expect(pivotWorld.y).to.be.closeTo(initialPivot.y, 0.01); // Y unchanged
			expect(pivotWorld.z).to.be.closeTo(5, 0.01);
		});

		it("should handle invalid yReference gracefully (same as default BASE pivot positioning)", async function () {
			await flock.positionAt(boxId, {
				x: 7,
				y: 3,
				z: 1,
				yReference: "INVALID",
			});

			const box = flock.scene.getMeshByName(boxId);
			const pivotWorld = box.getAbsolutePivotPoint();

			expect(pivotWorld.x).to.be.closeTo(7, 0.01);
			expect(pivotWorld.y).to.be.closeTo(3, 0.01);
			expect(pivotWorld.z).to.be.closeTo(1, 0.01);
		});

		it("should position a camera at specified coordinates", async function () {
			await flock.positionAt("__active_camera__", { x: 10, y: 5, z: -3 });

			const camera = flock.scene.activeCamera;
			expect(camera.position.x).to.be.closeTo(10, 0.01);
			expect(camera.position.y).to.be.closeTo(5, 0.01);
			expect(camera.position.z).to.be.closeTo(-3, 0.01);
		});
	});

	describe("moveTo API Tests @translation", function () {
		let box1Id, box2Id;

		beforeEach(function () {
			box1Id = `box1_${Date.now()}`;
			box2Id = `box2_${Date.now()}`;

			flock.createBox(box1Id, {
				color: "#FF00FF",
				width: 1,
				height: 2,
				depth: 1,
				position: [0, 0, 0],
			});

			flock.createBox(box2Id, {
				color: "#00FF00",
				width: 1,
				height: 4,
				depth: 1,
				position: [5, 5, 5],
			});
		});

		afterEach(function () {
			if (box1Id) flock.dispose(box1Id);
			if (box2Id) flock.dispose(box2Id);
		});

		it("should move a box to the target box centre position when useY is true (default)", async function () {
			await flock.moveTo(box1Id, { target: box2Id, useY: true });

			const box1 = flock.scene.getMeshByName(box1Id);
			const box2 = flock.scene.getMeshByName(box2Id);

			expect(box1.getAbsolutePosition().x).to.be.closeTo(
				box2.getAbsolutePosition().x,
				0.01,
			);
			expect(box1.getAbsolutePosition().y).to.be.closeTo(
				box2.getAbsolutePosition().y,
				0.01,
			);
			expect(box1.getAbsolutePosition().z).to.be.closeTo(
				box2.getAbsolutePosition().z,
				0.01,
			);
		});

		it("should move a box to the target box centre position without changing Y when useY is false @slow", function (done) {
			flock.positionAt(box1Id, { x: 0, y: 10, z: 0 });

			setTimeout(() => {
				const box1InitialY =
					flock.scene.getMeshByName(box1Id).position.y;

				flock.moveTo(box1Id, { target: box2Id, useY: false });

				setTimeout(() => {
					const box1 = flock.scene.getMeshByName(box1Id);
					const box2 = flock.scene.getMeshByName(box2Id);

					expect(box1.position.x).to.be.closeTo(
						box2.position.x,
						0.01,
					);
					expect(box1.position.z).to.be.closeTo(
						box2.position.z,
						0.01,
					);
					expect(box1.position.y).to.be.closeTo(box1InitialY, 0.01); // Y unchanged

					done();
				}, 300);
			}, 100);
		});
	});

	describe("moveByVector API Tests @translation", function () {
		let boxId;
		beforeEach(function () {
			boxId = `box_${Date.now()}`;
			flock.createBox(boxId, {
				color: "#00FF00",
				width: 1,
				height: 2,
				depth: 1,
				position: [5, 10, 15],
			});
		});
		afterEach(function () {
			if (boxId) flock.dispose(boxId);
		});

		it("should move a box by the specified vector", async function () {
			const box = flock.scene.getMeshByName(boxId);
			const initialPosition = box.position.clone();

			await flock.moveByVector(boxId, { x: 2, y: 3, z: 4 });

			expect(box.position.x).to.be.closeTo(initialPosition.x + 2, 0.01);
			expect(box.position.y).to.be.closeTo(initialPosition.y + 3, 0.01);
			expect(box.position.z).to.be.closeTo(initialPosition.z + 4, 0.01);
		});

		it("should move a box by negative vector values", async function () {
			const box = flock.scene.getMeshByName(boxId);
			const initialPosition = box.position.clone();

			await flock.moveByVector(boxId, { x: -1, y: -2, z: -3 });

			expect(box.position.x).to.be.closeTo(initialPosition.x - 1, 0.01);
			expect(box.position.y).to.be.closeTo(initialPosition.y - 2, 0.01);
			expect(box.position.z).to.be.closeTo(initialPosition.z - 3, 0.01);
		});

		it("should move a box with partial vector (only x and z)", async function () {
			const box = flock.scene.getMeshByName(boxId);
			const initialPosition = box.position.clone();

			await flock.moveByVector(boxId, { x: 5, z: 7 }); // y defaults to 0

			expect(box.position.x).to.be.closeTo(initialPosition.x + 5, 0.01);
			expect(box.position.y).to.be.closeTo(initialPosition.y, 0.01); // Unchanged
			expect(box.position.z).to.be.closeTo(initialPosition.z + 7, 0.01);
		});

		it("should handle zero movement (all defaults)", async function () {
			const box = flock.scene.getMeshByName(boxId);
			const initialPosition = box.position.clone();

			await flock.moveByVector(boxId); // All default to 0

			expect(box.position.x).to.be.closeTo(initialPosition.x, 0.01);
			expect(box.position.y).to.be.closeTo(initialPosition.y, 0.01);
			expect(box.position.z).to.be.closeTo(initialPosition.z, 0.01);
		});

		it("should move a box multiple times cumulatively", async function () {
			const box = flock.scene.getMeshByName(boxId);
			const initialPosition = box.position.clone();

			await flock.moveByVector(boxId, { x: 1, y: 1, z: 1 });
			await flock.moveByVector(boxId, { x: 2, y: 2, z: 2 });

			expect(box.position.x).to.be.closeTo(initialPosition.x + 3, 0.01);
			expect(box.position.y).to.be.closeTo(initialPosition.y + 3, 0.01);
			expect(box.position.z).to.be.closeTo(initialPosition.z + 3, 0.01);
		});
	});

	describe("distanceTo API Tests @translation", function () {
		let box1Id, box2Id, box3Id;
		beforeEach(function () {
			box1Id = `box1_${Date.now()}`;
			box2Id = `box2_${Date.now()}`;
			box3Id = `box3_${Date.now()}`;

			flock.createBox(box1Id, {
				color: "#FF00FF",
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			flock.createBox(box2Id, {
				color: "#00FF00",
				width: 1,
				height: 1,
				depth: 1,
				position: [3, 4, 0], // Distance should be 5 (3-4-5 triangle)
			});
			flock.createBox(box3Id, {
				color: "#0000FF",
				width: 1,
				height: 1,
				depth: 1,
				position: [10, 0, 0], // Distance from box1 should be 10
			});
		});
		afterEach(function () {
			if (box1Id) flock.dispose(box1Id);
			if (box2Id) flock.dispose(box2Id);
			if (box3Id) flock.dispose(box3Id);
		});

		it("should calculate correct distance between two boxes", function () {
			const distance = flock.distanceTo(box1Id, box2Id);
			expect(distance).to.be.closeTo(5, 0.01); // 3-4-5 triangle
		});

		it("should calculate distance along single axis", function () {
			const distance = flock.distanceTo(box1Id, box3Id);
			expect(distance).to.be.closeTo(10, 0.01); // Pure X-axis distance
		});

		it("should return same distance regardless of parameter order", function () {
			const distance1 = flock.distanceTo(box1Id, box2Id);
			const distance2 = flock.distanceTo(box2Id, box1Id);
			expect(distance1).to.be.closeTo(distance2, 0.01);
		});

		it("should return zero distance for same mesh", function () {
			const distance = flock.distanceTo(box1Id, box1Id);
			expect(distance).to.be.closeTo(0, 0.01);
		});

		it("should calculate distance after mesh movement", async function () {
			// Move box2 to a new position
			await flock.positionAt(box2Id, { x: 6, y: 8, z: 0 });
			const distance = flock.distanceTo(box1Id, box2Id);
			expect(distance).to.be.closeTo(10, 0.01); // 6-8-10 triangle
		});

		it("should calculate 3D distance correctly", async function () {
			// Position box2 at (3, 4, 12) for a 3-4-12-13 right triangle
			await flock.positionAt(box2Id, { x: 3, y: 4, z: 12 });
			const distance = flock.distanceTo(box1Id, box2Id);
			expect(distance).to.be.closeTo(13, 0.01); // sqrt(3² + 4² + 12²) = 13
		});

		it("should throw error when first mesh does not exist", function () {
			expect(() => {
				flock.distanceTo("nonexistent1", box2Id);
			}).to.throw("First mesh 'nonexistent1' not found");
		});

		it("should throw error when second mesh does not exist", function () {
			expect(() => {
				flock.distanceTo(box1Id, "nonexistent2");
			}).to.throw("Second mesh 'nonexistent2' not found");
		});

		it("should throw error when both meshes do not exist", function () {
			expect(() => {
				flock.distanceTo("nonexistent1", "nonexistent2");
			}).to.throw("First mesh 'nonexistent1' not found");
		});

		it("should work with meshes at negative coordinates", async function () {
			await flock.positionAt(box1Id, { x: -5, y: -5, z: 0 });
			await flock.positionAt(box2Id, { x: 5, y: 5, z: 0 });
			const distance = flock.distanceTo(box1Id, box2Id);
			expect(distance).to.be.closeTo(14.14, 0.01); // sqrt(10² + 10²) ≈ 14.14
		});

		it("should handle very small distances", async function () {
			await flock.positionAt(box2Id, { x: 0.001, y: 0.001, z: 0 });
			const distance = flock.distanceTo(box1Id, box2Id);
			expect(distance).to.be.closeTo(0.00141, 0.0001); // sqrt(0.001² + 0.001²)
		});
	});
}
