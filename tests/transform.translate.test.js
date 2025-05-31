import { expect } from "chai";

export function runTranslationTests(flock) {
  describe("Translation API Tests", function () {
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
	});

	afterEach(function () {
	  if (boxId) {
		flock.dispose(boxId);
	  }
	});

	it("should position a box at specified coordinates with default yReference (BASE)", function (done) {
	  flock.positionAt(boxId, { x: 5, y: 3, z: -2 });

	  setTimeout(() => {
		const box = flock.scene.getMeshByName(boxId);
		const minY = box.getBoundingInfo().boundingBox.minimum.y * box.scaling.y;
		expect(box.position.x).to.be.closeTo(5, 0.01);
		expect(box.position.y).to.be.closeTo(3 - minY, 0.01);
		expect(box.position.z).to.be.closeTo(-2, 0.01);
		done();
	  }, 100);
	});

	it("should position a box at specified coordinates with yReference: CENTER", function (done) {
	  flock.positionAt(boxId, { x: 1, y: 2, z: 3, yReference: "CENTER" });

	  setTimeout(() => {
		const box = flock.scene.getMeshByName(boxId);
		const boundingInfo = box.getBoundingInfo();
		const minY = boundingInfo.boundingBox.minimum.y * box.scaling.y;
		const maxY = boundingInfo.boundingBox.maximum.y * box.scaling.y;
		const centerY = (minY + maxY) / 2;
		expect(box.position.x).to.be.closeTo(1, 0.01);
		expect(box.position.y).to.be.closeTo(2 - centerY, 0.01);
		expect(box.position.z).to.be.closeTo(3, 0.01);
		done();
	  }, 100);
	});

	it("should position a box at specified coordinates with yReference: TOP", function (done) {
	  flock.positionAt(boxId, { x: -1, y: -2, z: 4, yReference: "TOP" });

	  setTimeout(() => {
		const box = flock.scene.getMeshByName(boxId);
		const maxY = box.getBoundingInfo().boundingBox.maximum.y * box.scaling.y;
		expect(box.position.x).to.be.closeTo(-1, 0.01);
		expect(box.position.y).to.be.closeTo(-2 - maxY, 0.01);
		expect(box.position.z).to.be.closeTo(4, 0.01);
		done();
	  }, 100);
	});

	it("should ignore Y when useY is false", function (done) {
	  flock.positionAt(boxId, { x: 0, y: 10, z: 0 });
	  setTimeout(() => {
		const initialY = flock.scene.getMeshByName(boxId).position.y;
		flock.positionAt(boxId, { x: 5, y: 99, z: 5, useY: false });
		setTimeout(() => {
		  const box = flock.scene.getMeshByName(boxId);
		  expect(box.position.x).to.be.closeTo(5, 0.01);
		  expect(box.position.y).to.be.closeTo(initialY, 0.01);
		  expect(box.position.z).to.be.closeTo(5, 0.01);
		  done();
		}, 100);
	  }, 100);
	});

	it("should handle invalid yReference gracefully (defaults to BASE)", function (done) {
	  flock.positionAt(boxId, { x: 7, y: 3, z: 1, yReference: "INVALID" });

	  setTimeout(() => {
		const box = flock.scene.getMeshByName(boxId);
		const minY = box.getBoundingInfo().boundingBox.minimum.y * box.scaling.y;
		expect(box.position.x).to.be.closeTo(7, 0.01);
		expect(box.position.y).to.be.closeTo(3 - minY, 0.01);
		expect(box.position.z).to.be.closeTo(1, 0.01);
		done();
	  }, 100);
	});
  });

	describe("moveTo API Tests", function () {
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

		  expect(box1.getAbsolutePosition().x).to.be.closeTo(box2.getAbsolutePosition().x, 0.01);
		  expect(box1.getAbsolutePosition().y).to.be.closeTo(box2.getAbsolutePosition().y, 0.01);
		  expect(box1.getAbsolutePosition().z).to.be.closeTo(box2.getAbsolutePosition().z, 0.01);
		});

	  it("should move a box to the target box centre position without changing Y when useY is false", function (done) {
		flock.positionAt(box1Id, { x: 0, y: 10, z: 0 });

		setTimeout(() => {
		  const box1InitialY = flock.scene.getMeshByName(box1Id).position.y;

		  flock.moveTo(box1Id, { target: box2Id, useY: false });

		  setTimeout(() => {
			const box1 = flock.scene.getMeshByName(box1Id);
			const box2 = flock.scene.getMeshByName(box2Id);

			expect(box1.position.x).to.be.closeTo(box2.position.x, 0.01);
			expect(box1.position.z).to.be.closeTo(box2.position.z, 0.01);
			expect(box1.position.y).to.be.closeTo(box1InitialY, 0.01);  // Y unchanged

			done();
		  }, 300);
		}, 100);
	  });
	});

	describe("moveByVector API Tests", function () {
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
}
