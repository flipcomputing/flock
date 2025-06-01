import { expect } from "chai";

export function runPhysicsTests(flock) {

describe("onTrigger", function () {
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

  it("should call callback on trigger", async function () {
	const boxId = "boxTriggerTest";
	await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
	boxIds.push(boxId);

	let triggered = false;

	flock.onTrigger(boxId, {
	  trigger: "OnPickTrigger",
	  callback: () => { triggered = true; }
	});

	// Simulate trigger
	const mesh = flock.scene.getMeshByName(boxId);
	expect(mesh).to.exist;
	mesh.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);

	expect(triggered).to.be.true;
  });

  it("should only call callback once when mode is 'once'", async function () {
	const boxId = "boxTriggerOnce";
	await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
	boxIds.push(boxId);

	let count = 0;

	flock.onTrigger(boxId, {
	  trigger: "OnPickTrigger",
	  callback: () => { count++; },
	  mode: "once"
	});

	const mesh = flock.scene.getMeshByName(boxId);
	expect(mesh).to.exist;

	mesh.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
	mesh.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);

	expect(count).to.equal(1);
  });
});

	describe("onIntersect", function () {
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

	  it("should call callback on intersection", async function () {
		const box1 = "boxIntersect1";
		const box2 = "boxIntersect2";

		await flock.createBox(box1, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
		await flock.createBox(box2, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
		boxIds.push(box1, box2);

		let intersected = false;

		flock.onIntersect(box1, box2, {
		  trigger: "OnIntersectionEnterTrigger",
		  callback: () => { intersected = true; }
		});

		const mesh = flock.scene.getMeshByName(box1);
		const otherMesh = flock.scene.getMeshByName(box2);
		expect(mesh).to.exist;
		expect(otherMesh).to.exist;

		mesh.actionManager.processTrigger(
		  flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
		  { mesh: otherMesh }
		);

		expect(intersected).to.be.true;
	  });

	});


}