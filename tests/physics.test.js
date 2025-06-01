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
			await flock.createBox(boxId, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			boxIds.push(boxId);

			let triggered = false;

			flock.onTrigger(boxId, {
				trigger: "OnPickTrigger",
				callback: () => {
					triggered = true;
				},
			});

			// Simulate trigger
			const mesh = flock.scene.getMeshByName(boxId);
			expect(mesh).to.exist;
			mesh.actionManager.processTrigger(
				flock.BABYLON.ActionManager.OnPickTrigger,
			);

			expect(triggered).to.be.true;
		});

		it("should only call callback once when mode is 'once'", async function () {
			const boxId = "boxTriggerOnce";
			await flock.createBox(boxId, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			boxIds.push(boxId);

			let count = 0;

			flock.onTrigger(boxId, {
				trigger: "OnPickTrigger",
				callback: () => {
					count++;
				},
				mode: "once",
			});

			const mesh = flock.scene.getMeshByName(boxId);
			expect(mesh).to.exist;

			mesh.actionManager.processTrigger(
				flock.BABYLON.ActionManager.OnPickTrigger,
			);
			mesh.actionManager.processTrigger(
				flock.BABYLON.ActionManager.OnPickTrigger,
			);

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

			await flock.createBox(box1, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			await flock.createBox(box2, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			boxIds.push(box1, box2);

			let intersected = false;

			flock.onIntersect(box1, box2, {
				trigger: "OnIntersectionEnterTrigger",
				callback: () => {
					intersected = true;
				},
			});

			const mesh = flock.scene.getMeshByName(box1);
			const otherMesh = flock.scene.getMeshByName(box2);
			expect(mesh).to.exist;
			expect(otherMesh).to.exist;

			mesh.actionManager.processTrigger(
				flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
				{ mesh: otherMesh },
			);

			expect(intersected).to.be.true;
		});
	});

	describe("applyForce method", function () {
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

		it("should apply force to a mesh with default values (no movement)", async function () {
			const id = "boxApplyForceDefault";
			await flock.createBox(id, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			boxIds.push(id);

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh).to.exist;

			const initialVelocity = mesh.physics.getLinearVelocity().clone();

			await flock.applyForce(id, {});

			await new Promise((r) => setTimeout(r, 200));

			const finalVelocity = mesh.physics.getLinearVelocity();

			expect(finalVelocity.x).to.be.closeTo(initialVelocity.x, 0.01);
			expect(finalVelocity.y).to.be.closeTo(initialVelocity.y, 0.01);
			expect(finalVelocity.z).to.be.closeTo(initialVelocity.z, 0.01);
		});

		it("should apply specific forces to a mesh", async function () {
			const id = "boxApplyForce";
			await flock.createBox(id, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			await flock.setPhysics(id, "DYNAMIC");

			boxIds.push(id);

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh).to.exist;

			await flock.applyForce(id, { forceX: 10, forceY: 5, forceZ: -3 });

			// Allow time for physics engine to update
			await new Promise((r) => setTimeout(r, 200));

			console.log("Physics", mesh.physics, mesh.velocity)
			const velocity = mesh.physics.getLinearVelocity();
			expect(velocity.x).to.be.greaterThan(0);
			expect(velocity.y).to.be.greaterThan(0);
			expect(velocity.z).to.be.lessThan(0);
		});

		it("should handle missing physics gracefully", async function () {
			const id = "boxNoPhysics";
			await flock.createBox(id, {
				width: 1,
				height: 1,
				depth: 1,
				position: [0, 0, 0],
			});
			boxIds.push(id);

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh).to.exist;

			// Remove physics to simulate missing physics
			mesh.physics.dispose();
			mesh.physics = null;

			let errorLogged = false;
			const originalConsoleError = console.error;
			console.error = (...args) => {
				errorLogged = true;
				originalConsoleError(...args);
			};

			await flock.applyForce(id, { forceX: 1, forceY: 1, forceZ: 1 });

			console.error = originalConsoleError;

			expect(errorLogged).to.be.true;
		});
	});
}
