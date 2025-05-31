import { expect } from "chai";

export function runRotationTests(flock) {
	describe("rotate API Tests", function () {
	  let boxId;
	  beforeEach(function () {
		boxId = `box_${Date.now()}`;
		flock.createBox(boxId, {
		  color: "#FF00FF",
		  width: 2,
		  height: 2,
		  depth: 2,
		  position: [0, 0, 0],
		});
	  });
	  afterEach(function () {
		if (boxId) flock.dispose(boxId);
	  });

	  it("should rotate a box around X axis", async function () {
		const box = flock.scene.getMeshByName(boxId);
		const initialRotation = box.rotationQuaternion ? box.rotationQuaternion.clone() : null;

		await flock.rotate(boxId, { x: 90, y: 0, z: 0 });

		expect(box.rotationQuaternion).to.not.be.null;
		if (initialRotation) {
		  expect(box.rotationQuaternion.equals(initialRotation)).to.be.false;
		}

		// Check that rotation was applied by converting back to Euler angles
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.x)).to.be.closeTo(Math.PI / 2, 0.1); // 90 degrees in radians
	  });

	  it("should rotate a box around Y axis", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: 0, y: 90, z: 0 });

		expect(box.rotationQuaternion).to.not.be.null;
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.y)).to.be.closeTo(Math.PI / 2, 0.1); // 90 degrees in radians
	  });

	  it("should rotate a box around Z axis", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: 0, y: 0, z: 90 });

		expect(box.rotationQuaternion).to.not.be.null;
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.z)).to.be.closeTo(Math.PI / 2, 0.1); // 90 degrees in radians
	  });

	  it("should rotate a box around multiple axes", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: 45, y: 45, z: 45 });

		expect(box.rotationQuaternion).to.not.be.null;
		// For combined rotations, just verify that rotation was applied
		const euler = box.rotationQuaternion.toEulerAngles();
		const totalRotation = Math.abs(euler.x) + Math.abs(euler.y) + Math.abs(euler.z);
		expect(totalRotation).to.be.greaterThan(0.1);
	  });

	  it("should apply rotations cumulatively", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: 45, y: 0, z: 0 });
		const firstRotation = box.rotationQuaternion.clone();

		await flock.rotate(boxId, { x: 45, y: 0, z: 0 });

		expect(box.rotationQuaternion.equals(firstRotation)).to.be.false;

		// Should be approximately 90 degrees total rotation around X
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.x)).to.be.closeTo(Math.PI / 2, 0.1);
	  });

	  it("should handle negative rotation values", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: -90, y: 0, z: 0 });

		expect(box.rotationQuaternion).to.not.be.null;
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.x)).to.be.closeTo(Math.PI / 2, 0.1); // Magnitude should be same
	  });

	  it("should handle partial rotation parameters", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { y: 90 }); // Only Y specified, X and Z default to 0

		expect(box.rotationQuaternion).to.not.be.null;
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.y)).to.be.closeTo(Math.PI / 2, 0.1);
		expect(Math.abs(euler.x)).to.be.lessThan(0.1); // Should be close to 0
		expect(Math.abs(euler.z)).to.be.lessThan(0.1); // Should be close to 0
	  });

	  it("should handle zero rotation (all defaults)", async function () {
		const box = flock.scene.getMeshByName(boxId);
		const initialRotation = box.rotationQuaternion ? box.rotationQuaternion.clone() : null;

		await flock.rotate(boxId); // All default to 0

		// Rotation quaternion might be created but should represent no rotation
		if (initialRotation) {
		  expect(box.rotationQuaternion.equals(initialRotation)).to.be.true;
		} else {
		  // If no initial rotation, the quaternion should represent identity/no rotation
		  expect(box.rotationQuaternion).to.not.be.null;
		  const euler = box.rotationQuaternion.toEulerAngles();
		  expect(Math.abs(euler.x)).to.be.lessThan(0.01);
		  expect(Math.abs(euler.y)).to.be.lessThan(0.01);
		  expect(Math.abs(euler.z)).to.be.lessThan(0.01);
		}
	  });

	  it("should handle large rotation values", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotate(boxId, { x: 360, y: 0, z: 0 }); // Full rotation

		expect(box.rotationQuaternion).to.not.be.null;
		// A 360-degree rotation should bring us back close to original orientation
		const euler = box.rotationQuaternion.toEulerAngles();
		expect(Math.abs(euler.x) % (2 * Math.PI)).to.be.lessThan(0.1);
	  });

	  it("should throw error when mesh does not exist", async function () {
		try {
		  await flock.rotate("nonexistent", { x: 90, y: 0, z: 0 });
		  expect.fail("Should have thrown an error");
		} catch (error) {
		  expect(error.message).to.include("Mesh 'nonexistent' not found");
		}
	  });
	});

	describe("rotate Camera API Tests", function () {
	  it("should handle camera rotation without throwing errors", async function () {
		// This test assumes there's an active camera
		try {
		  await flock.rotate("__active_camera__", { x: 10, y: 15, z: 0 });
		  // If we get here without throwing, the test passes
		  expect(true).to.be.true;
		} catch (error) {
		  // If there's no active camera, we should get a specific error
		  expect(error.message).to.include("No active camera found");
		}
	  });

	  it("should throw error when no active camera exists", async function () {
		const originalCamera = flock.scene.activeCamera;
		flock.scene.activeCamera = null;
		try {
		  await flock.rotate("__active_camera__", { x: 10 });
		  expect.fail("Should have thrown an error");
		} catch (error) {
		  expect(error.message).to.include("No active camera found");
		} finally {
		  flock.scene.activeCamera = originalCamera;
		}
	  });
	});
}