import { expect } from "chai";

export function runRotationTests(flock) {
	describe("rotate API Tests @rotation", function () {
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

	 /* it("should throw error when mesh does not exist", async function () {
		  this.timeout(200000); // 10 seconds should be enough
		try {
		  await flock.rotate("nonexistent", { x: 90, y: 0, z: 0 });
		  expect.fail("Should have thrown an error");
		} catch (error) {
		  expect(error.message).to.include("Mesh 'nonexistent' not found");
		}
	  });*/
	});

	describe("rotate Camera API Tests @rotation", function () {
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

	  /*it("should throw error when no active camera exists", async function () {
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
	  });*/
	});

	describe("rotateTo API Tests @rotation", function () {
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

	  // Helper function to compare quaternions with tolerance
	  function quaternionsEqual(q1, q2, tolerance = 0.001) {
		return Math.abs(q1.x - q2.x) < tolerance &&
			   Math.abs(q1.y - q2.y) < tolerance &&
			   Math.abs(q1.z - q2.z) < tolerance &&
			   Math.abs(q1.w - q2.w) < tolerance;
	  }

	  it("should rotate a box to absolute X rotation", async function () {
		const box = flock.scene.getMeshByName(boxId);

		// First rotate to some position
		await flock.rotateTo(boxId, { x: 45, y: 0, z: 0 });

		// Then rotate to a different absolute position
		await flock.rotateTo(boxId, { x: 90, y: 0, z: 0 });

		// Should be at 90 degrees, not 135 (45 + 90)
		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(0), // y
		  flock.BABYLON.Tools.ToRadians(90), // x
		  flock.BABYLON.Tools.ToRadians(0)  // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });

	  it("should rotate a box to absolute Y rotation", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotateTo(boxId, { x: 0, y: 180, z: 0 });

		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(180), // y
		  flock.BABYLON.Tools.ToRadians(0),   // x
		  flock.BABYLON.Tools.ToRadians(0)    // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });

	  it("should rotate a box to absolute Z rotation", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotateTo(boxId, { x: 0, y: 0, z: 45 });

		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(0),  // y
		  flock.BABYLON.Tools.ToRadians(0),  // x
		  flock.BABYLON.Tools.ToRadians(45)  // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });

	  it("should handle multiple absolute rotations correctly", async function () {
		const box = flock.scene.getMeshByName(boxId);

		// Rotate to one position
		await flock.rotateTo(boxId, { x: 30, y: 60, z: 90 });

		// Rotate to a completely different position
		await flock.rotateTo(boxId, { x: 10, y: 20, z: 30 });

		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(20), // y
		  flock.BABYLON.Tools.ToRadians(10), // x
		  flock.BABYLON.Tools.ToRadians(30)  // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });

	  it("should use default values when parameters are omitted", async function () {
		const box = flock.scene.getMeshByName(boxId);

		await flock.rotateTo(boxId, { x: 45 }); // y and z should default to 0

		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(0),  // y
		  flock.BABYLON.Tools.ToRadians(45), // x
		  flock.BABYLON.Tools.ToRadians(0)   // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });

	  it("should work with empty object (all defaults)", async function () {
		const box = flock.scene.getMeshByName(boxId);

		// First rotate to some position
		await flock.rotateTo(boxId, { x: 45, y: 90, z: 180 });

		// Then reset to zero with empty object
		await flock.rotateTo(boxId, {});

		const finalRotation = box.rotationQuaternion;
		const expectedQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
		  flock.BABYLON.Tools.ToRadians(0), // y
		  flock.BABYLON.Tools.ToRadians(0), // x
		  flock.BABYLON.Tools.ToRadians(0)  // z
		).normalize();

		expect(quaternionsEqual(finalRotation, expectedQuat)).to.be.true;
	  });
	});

	describe("lookAt API Tests @rotation", function () {
	  let mesh1Id, mesh2Id;

	  beforeEach(function () {
		mesh1Id = `mesh1_${Date.now()}`;
		mesh2Id = `mesh2_${Date.now()}`;

		// Create first mesh (the one that will look)
		flock.createBox(mesh1Id, {
		  color: "#FF0000",
		  width: 1,
		  height: 1,
		  depth: 1,
		  position: [0, 0, 0],
		});

		// Create second mesh (the target)
		flock.createBox(mesh2Id, {
		  color: "#00FF00",
		  width: 1,
		  height: 1,
		  depth: 1,
		  position: [5, 2, 3],
		});
	  });

	  afterEach(function () {
		if (mesh1Id) flock.dispose(mesh1Id);
		if (mesh2Id) flock.dispose(mesh2Id);
	  });

	  it("should make mesh1 look at mesh2", async function () {
		const mesh1 = flock.scene.getMeshByName(mesh1Id);
		const initialRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion.clone() : mesh1.rotation.clone();

		await flock.lookAt(mesh1Id, { target: mesh2Id });

		const finalRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion : mesh1.rotation;
		expect(finalRotation.equals(initialRotation)).to.be.false;
		expect(mesh1.absolutePosition).to.be.ok;
	  });

	  it("should handle useY parameter correctly", async function () {
		const mesh1 = flock.scene.getMeshByName(mesh1Id);

		await flock.lookAt(mesh1Id, { target: mesh2Id, useY: true });
		const finalRotation1 = mesh1.rotationQuaternion ? mesh1.rotationQuaternion.clone() : mesh1.rotation.clone();

		mesh1.position.set(0, 0, 0);

		await flock.lookAt(mesh1Id, { target: mesh2Id, useY: false });
		const finalRotation2 = mesh1.rotationQuaternion ? mesh1.rotationQuaternion : mesh1.rotation;

		expect(finalRotation1.equals(finalRotation2)).to.be.false;
	  });

	  it("should work with physics-enabled objects", async function () {
		await flock.setPhysics(mesh1Id, "DYNAMIC");
		const mesh1 = flock.scene.getMeshByName(mesh1Id);
		const initialRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion.clone() : mesh1.rotation.clone();

		await flock.lookAt(mesh1Id, { target: mesh2Id });

		const finalRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion : mesh1.rotation;

		expect(finalRotation.equals(initialRotation)).to.be.false;
		expect(mesh1.physics).to.be.ok;
	  });

	  it("should handle default useY parameter", async function () {
		const mesh1 = flock.scene.getMeshByName(mesh1Id);
		await flock.lookAt(mesh1Id, { target: mesh2Id });
		expect(mesh1.absolutePosition).to.be.ok;
	  });

	  it("should handle objects at different heights", async function () {
		const mesh2 = flock.scene.getMeshByName(mesh2Id);
		mesh2.position.y = 10;

		const mesh1 = flock.scene.getMeshByName(mesh1Id);
		const initialRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion.clone() : mesh1.rotation.clone();

		await flock.lookAt(mesh1Id, { target: mesh2Id, useY: true });
		const finalRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion : mesh1.rotation;

		expect(finalRotation.equals(initialRotation)).to.be.false;
	  });

	  it("should work with same Y level when useY is false", async function () {
		const mesh2 = flock.scene.getMeshByName(mesh2Id);
		mesh2.position.y = 10;

		const mesh1 = flock.scene.getMeshByName(mesh1Id);
		const initialRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion.clone() : mesh1.rotation.clone();

		await flock.lookAt(mesh1Id, { target: mesh2Id, useY: false });
		const finalRotation = mesh1.rotationQuaternion ? mesh1.rotationQuaternion : mesh1.rotation;

		expect(finalRotation.equals(initialRotation)).to.be.false;
	  });

		it("should handle meshes at the same position", async function () {
		  const mesh2 = flock.scene.getMeshByName(mesh2Id);
		  mesh2.position.set(0, 0, 0);

		  let error = null;	
		  try {
			await flock.lookAt(mesh1Id, { target: mesh2Id });
		  } catch (e) {
			error = e;
		  }

		  expect(error).to.be.null;
		});

	});

}