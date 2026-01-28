import { expect } from "chai";

function toFixedNumber(value) {
  return parseFloat(value.toFixed(2));
}

export function runGetPropertyTests(flock) {
  describe("Sensing getProperty API @property", function () {
	this.timeout(10000);

	const createdIds = [];
	let originalEngine;
	let originalScene;
	let originalMainLight;
	let originalActiveCamera;

	before(async function () {
	  originalEngine = flock.engine;
	  originalScene = flock.scene;
	  originalMainLight = flock.mainLight;
	  originalActiveCamera = flock.scene?.activeCamera;

	  flock.engine = new flock.BABYLON.NullEngine();
	  flock.scene = new flock.BABYLON.Scene(flock.engine);
	  flock.BABYLON.SceneLoader.ShowLoadingScreen = false;

	  flock.mainLight = new flock.BABYLON.HemisphericLight(
		"mainLight",
		new flock.BABYLON.Vector3(0, 1, 0),
		flock.scene,
	  );

	  flock.scene.activeCamera = new flock.BABYLON.FreeCamera(
		"activeCamera",
		new flock.BABYLON.Vector3(0, 0, 0),
		flock.scene,
	  );

	  const physicsMock = new Proxy(
		{
		  name: "MockPhysics",
		  getPluginVersion: () => 2,
		  isInitialized: () => true,
		  _checkIsReady: () => true,
		  onMeshRemovedObservable: new flock.BABYLON.Observable(),
		  onBeforePhysicsObservable: new flock.BABYLON.Observable(),
		  onAfterPhysicsObservable: new flock.BABYLON.Observable(),
		  getTimeStep: () => 1 / 60,
		  getMotionType: () => 1,
		  dispose: () => {},
		},
		{ get: (target, prop) => (prop in target ? target[prop] : () => {}) },
	  );
	  flock.scene.enablePhysics(
		new flock.BABYLON.Vector3(0, -9.81, 0),
		physicsMock,
	  );
	});

	afterEach(function () {
	  createdIds.splice(0).forEach((id) => flock.dispose(id));
	});

	after(function () {
	  if (flock.engine) {
		flock.engine.dispose();
	  }

	  flock.engine = originalEngine;
	  flock.scene = originalScene;
	  flock.mainLight = originalMainLight;
	  if (flock.scene) {
		flock.scene.activeCamera = originalActiveCamera;
	  }
	});

	it("returns null for missing meshes", function () {
	  const result = flock.getProperty("missing-mesh", "POSITION_X");
	  expect(result).to.be.null;
	});

	it("reads position values from a mesh", function () {
	  const meshId = flock.createBox("getProperty-position", {
		width: 2,
		height: 4,
		depth: 6,
		position: [1, 2, 3],
	  });
	  createdIds.push(meshId);

	  const mesh = flock.scene.getMeshByName(meshId);
	  const position = mesh.getAbsolutePosition();

	  expect(flock.getProperty(meshId, "POSITION_X")).to.equal(
		toFixedNumber(position.x),
	  );
	  expect(flock.getProperty(meshId, "POSITION_Y")).to.equal(
		toFixedNumber(position.y),
	  );
	  expect(flock.getProperty(meshId, "POSITION_Z")).to.equal(
		toFixedNumber(position.z),
	  );
	});

	it("returns rotation in degrees from quaternions", function () {
	  const meshId = flock.createBox("getProperty-rotation", {
		width: 1,
		height: 1,
		depth: 1,
		position: [0, 0, 0],
	  });
	  createdIds.push(meshId);

	  const mesh = flock.scene.getMeshByName(meshId);
	  const desiredRotation = {
		x: 45,
		y: 120,
		z: -30,
	  };

	  mesh.rotationQuaternion = flock.BABYLON.Quaternion.FromEulerAngles(
		flock.BABYLON.Tools.ToRadians(desiredRotation.x),
		flock.BABYLON.Tools.ToRadians(desiredRotation.y),
		flock.BABYLON.Tools.ToRadians(desiredRotation.z),
	  );

	  const rotation = mesh.rotationQuaternion.toEulerAngles();

	  expect(flock.getProperty(meshId, "ROTATION_X")).to.equal(
		toFixedNumber(flock.BABYLON.Tools.ToDegrees(rotation.x)),
	  );
	  expect(flock.getProperty(meshId, "ROTATION_Y")).to.equal(
		toFixedNumber(flock.BABYLON.Tools.ToDegrees(rotation.y)),
	  );
	  expect(flock.getProperty(meshId, "ROTATION_Z")).to.equal(
		toFixedNumber(flock.BABYLON.Tools.ToDegrees(rotation.z)),
	  );
	});

	it("reports scale and bounding box size", function () {
	  const meshId = flock.createBox("getProperty-scale", {
		width: 2,
		height: 4,
		depth: 6,
		position: [0, 0, 0],
	  });
	  createdIds.push(meshId);

	  const mesh = flock.scene.getMeshByName(meshId);
	  mesh.scaling.set(2, 0.5, 1.5);
	  mesh.computeWorldMatrix(true);

	  const boundingInfo = mesh.getBoundingInfo();
	  const boundingBox = boundingInfo.boundingBox;
	  const sizeX = boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
	  const sizeY = boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
	  const sizeZ = boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

	  expect(flock.getProperty(meshId, "SCALE_X")).to.equal(
		toFixedNumber(mesh.scaling.x),
	  );
	  expect(flock.getProperty(meshId, "SCALE_Y")).to.equal(
		toFixedNumber(mesh.scaling.y),
	  );
	  expect(flock.getProperty(meshId, "SCALE_Z")).to.equal(
		toFixedNumber(mesh.scaling.z),
	  );
	  expect(flock.getProperty(meshId, "SIZE_X")).to.equal(
		toFixedNumber(sizeX),
	  );
	  expect(flock.getProperty(meshId, "SIZE_Y")).to.equal(
		toFixedNumber(sizeY),
	  );
	  expect(flock.getProperty(meshId, "SIZE_Z")).to.equal(
		toFixedNumber(sizeZ),
	  );
	});

	it("uses world coordinates for min and max bounds", function () {
	  const meshId = flock.createBox("getProperty-bounds", {
		width: 2,
		height: 2,
		depth: 2,
		position: [5, 1, -3],
	  });
	  createdIds.push(meshId);

	  const mesh = flock.scene.getMeshByName(meshId);
	  mesh.scaling.set(1.2, 1, 0.8);
	  mesh.computeWorldMatrix(true);

	  const { boundingBox } = mesh.getBoundingInfo();

	  expect(flock.getProperty(meshId, "MIN_X")).to.be.closeTo(
		toFixedNumber(boundingBox.minimumWorld.x),
		0.01,
	  );
	  expect(flock.getProperty(meshId, "MAX_X")).to.be.closeTo(
		toFixedNumber(boundingBox.maximumWorld.x),
		0.01,
	  );
	  expect(flock.getProperty(meshId, "MIN_Z")).to.be.closeTo(
		toFixedNumber(boundingBox.minimumWorld.z),
		0.01,
	  );
	  expect(flock.getProperty(meshId, "MAX_Z")).to.be.closeTo(
		toFixedNumber(boundingBox.maximumWorld.z),
		0.01,
	  );
	});

	it("reads material alpha and colour", async function () {
	  const meshId = flock.createBox("getProperty-material", {
		width: 1,
		height: 1,
		depth: 1,
		position: [0, 0, 0],
		color: "#123456",
	  });
	  createdIds.push(meshId);

	  await flock.setAlpha(meshId, { value: 0.25 });

	  expect(flock.getProperty(meshId, "ALPHA")).to.equal(0.25);
	  expect(flock.getProperty(meshId, "COLOUR")).to.equal("#123456");
	});

	// Helper to wait for the next frame and ensure properties are updated
	async function tick() {
	  await new Promise(resolve => setTimeout(resolve, 0));
	  flock.scene.render();
	}

	it("reads the VISIBLE property after hide and show", async function () {
	  const meshId = flock.createBox("getProperty-visible", {
		width: 1,
		height: 1,
		depth: 1,
		position: [0, 0, 0],
		color: "#123456",
	  });
	  createdIds.push(meshId);

	  // Should be visible by default
	  await tick();
	  expect(flock.getProperty(meshId, "VISIBLE")).to.be.true;

	  // Test hide()
	  await flock.hide(meshId);
	  await tick();
	  expect(flock.getProperty(meshId, "VISIBLE")).to.be.false;

	  // Test show()
	  await flock.show(meshId);
	  await tick();
	  expect(flock.getProperty(meshId, "VISIBLE")).to.be.true;
	});
  });
}