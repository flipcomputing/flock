import { expect } from "chai";

export function runGlideToObjectTests(flock) {
	describe("glideToObject function tests @slow", function () {
		let box1;
		let box2;

		beforeEach(function () {
			box1 = flock.createBox("box1", {
				color: "#996633",
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
		});

		afterEach(function () {
			flock.dispose(box1);
			if (box2) {
				flock.dispose(box2);
				box2 = undefined;
			}
		});

		it("should glide to another object with default offsets", async function () {
			this.timeout(5000);

			const sourceId = box1; // assuming box1 is a name set in beforeEach
			const targetId = "box2";

			flock.createBox(targetId, {
				width: 2,
				height: 2,
				depth: 2,
				position: [3, 2, 1],
			});

			await flock.glideToObject(sourceId, targetId, { duration: 0.2 });

			const targetMesh = flock.scene.getMeshByName(targetId);
			const movedMesh = flock.scene.getMeshByName(sourceId);

			const expected = flock._getAnchor(targetMesh);
			const actual = flock._getAnchor(movedMesh);

			const EPS = 0.1;
			expect(actual.x).to.be.closeTo(expected.x, EPS);
			expect(actual.y).to.be.closeTo(expected.y, EPS);
			expect(actual.z).to.be.closeTo(expected.z, EPS);
		});

		it("should apply x/y/z offsets when gliding to another object", async function () {
			this.timeout(5000);

			const sourceId = box1; // assuming box1 is the name set in beforeEach
			const targetId = "box2";

			flock.createBox(targetId, {
				width: 1,
				height: 1,
				depth: 1,
				position: [1, 1, 1],
			});

			const offsets = { offsetX: 0.5, offsetY: -1, offsetZ: 2 };

			await flock.glideToObject(sourceId, targetId, {
				...offsets,
				duration: 0.2,
			});

			const targetMesh = flock.scene.getMeshByName(targetId);
			const targetAnchor = flock._getAnchor(targetMesh);

			const expected = {
				x: targetAnchor.x + offsets.offsetX,
				y: targetAnchor.y + offsets.offsetY,
				z: targetAnchor.z + offsets.offsetZ,
			};

			const movedMesh = flock.scene.getMeshByName(sourceId);
			const actual = flock._getAnchor(movedMesh);

			const EPS = 0.1;
			expect(actual.x).to.be.closeTo(expected.x, EPS);
			expect(actual.y).to.be.closeTo(expected.y, EPS);
			expect(actual.z).to.be.closeTo(expected.z, EPS);
		});

		it("should align pivots between different shapes using defaults", async function () {
			this.timeout(5000);

			const sourceId = box1; // created in beforeEach
			const targetId = "targetSphere";

			flock.createSphere(targetId, {
				diameterX: 1.5,
				diameterY: 2,
				diameterZ: 1,
				position: [2, 1, -1],
			});

			await flock.glideToObject(sourceId, targetId, { duration: 0.3 });

			const movedMesh = flock.scene.getMeshByName(sourceId);
			const targetMesh = flock.scene.getMeshByName(targetId);

			const movedAnchor = flock._getAnchor(movedMesh);
			const targetAnchor = flock._getAnchor(targetMesh);

			const EPS = 0.1;
			expect(movedAnchor.x).to.be.closeTo(targetAnchor.x, EPS);
			expect(movedAnchor.y).to.be.closeTo(targetAnchor.y, EPS);
			expect(movedAnchor.z).to.be.closeTo(targetAnchor.z, EPS);
		});

		it("should respect custom pivot settings when gliding to another shape", async function () {
			this.timeout(7000);

			const sourceId = box1; // created in beforeEach
			const targetId = "targetCylinder";

			// Custom pivot for source box
			flock.setPivotPoint(sourceId, {
				xPivot: "MAX",
				yPivot: "MAX",
				zPivot: "CENTER",
			});

			// Create target cylinder
			flock.createCylinder(targetId, {
				diameterTop: 1,
				diameterBottom: 1.2,
				height: 3,
				position: [-2, 1.5, 0.5],
			});

			// Custom pivot for target cylinder
			flock.setPivotPoint(targetId, {
				xPivot: "MIN",
				yPivot: "CENTER",
				zPivot: "MAX",
			});

			const startTime = Date.now();
			await flock.glideToObject(sourceId, targetId, { duration: 0.4 });
			const elapsedSeconds = (Date.now() - startTime) / 1000;

			const movedMesh = flock.scene.getMeshByName(sourceId);
			const targetMesh = flock.scene.getMeshByName(targetId);

			const movedAnchor = flock._getAnchor(movedMesh);
			const targetAnchor = flock._getAnchor(targetMesh);

			const EPS = 0.1;
			expect(movedAnchor.x).to.be.closeTo(targetAnchor.x, EPS);
			expect(movedAnchor.y).to.be.closeTo(targetAnchor.y, EPS);
			expect(movedAnchor.z).to.be.closeTo(targetAnchor.z, EPS);

			const TIME_EPS = 0.2;
			expect(elapsedSeconds).to.be.closeTo(0.4, TIME_EPS);
		});
	});
}
