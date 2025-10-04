let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockCamera = {
	/* 
		Category: Scene>Camera
	*/
	attachCamera(meshName, options = {}) {
		const { radius = 7, front = true } = options;
		
		return flock.whenModelReady(meshName, async function (mesh) {
			if (!mesh) {
				console.log("Model not loaded:", meshName);
				return;
			}

			if (!mesh.physics) {
				console.log("Can't attach camera to: ", meshName);
				return;
			}

			console.log("Attaching camera to model");
			flock.ensureVerticalConstraint(mesh);

			let camera;

			if (front) {
				// Original attachCamera behavior - start in front then move behind
				// Calculate direction character is facing
				const forward = new flock.BABYLON.Vector3(
					Math.sin(mesh.rotation.y),
					0,
					Math.cos(mesh.rotation.y)
				);

				// STEP 1: Place camera IN FRONT of character (facing them)
				camera = new flock.BABYLON.ArcRotateCamera(
					"camera",
					Math.PI / 2,
					Math.PI,
					radius,
					mesh.position.add(forward.scale(3)), // in front
					flock.scene
				);

				camera.lockedTarget = mesh;
				camera.attachControl(flock.canvas, false);
				flock.scene.activeCamera = camera;

				// Set camera controls and limits
				camera.lowerBetaLimit = Math.PI / 3;
				camera.upperBetaLimit = Math.PI / 2;
				camera.lowerRadiusLimit = radius * 0.6;
				camera.upperRadiusLimit = radius * 1.6;
				camera.angularSensibilityX = 2000;
				camera.angularSensibilityY = 2000;
				camera.panningSensibility = 0;
				camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

				camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
				camera.inputs.attached.pointers.multiTouchPanning = false;
				camera.inputs.attached.pointers.pinchZoom = false;
				camera.inputs.attached.pointers.pinchInwards = false;
				camera.inputs.attached.pointers.useNaturalPinchZoom = false;

				// Move camera behind the character
				const behind = forward.scale(-radius);
				camera.setPosition(mesh.position.add(behind));

				camera.metadata = camera.metadata || {};
				camera.metadata.following = mesh;
			} else {
				// Original attachCamera2 behavior - position directly behind
				let savedCamera = flock.scene.activeCamera;
				flock.savedCamera = savedCamera;

				camera = new flock.BABYLON.ArcRotateCamera(
					"camera",
					Math.PI / 2,
					Math.PI,
					radius,
					mesh.position,
					flock.scene,
				);
				
				camera.checkCollisions = true;
				camera.lowerBetaLimit = Math.PI / 3;
				camera.upperBetaLimit = Math.PI / 2;
				camera.lowerRadiusLimit = radius * 0.6;
				camera.upperRadiusLimit = radius * 1.6;
				camera.angularSensibilityX = 2000;
				camera.angularSensibilityY = 2000;
				camera.panningSensibility = 0;
				camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

				camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
				camera.inputs.attached.pointers.multiTouchPanning = false;
				camera.inputs.attached.pointers.pinchZoom = false;
				camera.inputs.attached.pointers.pinchInwards = false;
				camera.inputs.attached.pointers.useNaturalPinchZoom = false;
				
				camera.lockedTarget = mesh;
				camera.metadata = camera.metadata || {};
				camera.metadata.following = mesh;
				camera.attachControl(flock.canvas, false);
				flock.scene.activeCamera = camera;
			}
		});
	},
	ensureVerticalConstraint(mesh) {
		if (mesh.metadata.constraint) return;
		if (!mesh.physics) return;

		const newBox = flock.BABYLON.MeshBuilder.CreateBox("Constraint", {
			height: 1,
			width: 1,
			depth: 1,
		});
		newBox.position = new flock.BABYLON.Vector3(0, -4, 0);
		newBox.metadata = newBox.metadata || {};
		newBox.metadata.blockKey = newBox.name;
		newBox.name = newBox.name + "_" + newBox.uniqueId;
		const boxBody = new flock.BABYLON.PhysicsBody(
			newBox,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const boxShape = new flock.BABYLON.PhysicsShapeBox(
			flock.BABYLON.Vector3.Zero(),
			new flock.BABYLON.Quaternion(0, 0, 0, 1),
			flock.BABYLON.Vector3.One(),
			flock.scene,
		);

		boxBody.shape = boxShape;
		boxBody.setMassProperties({ mass: 1, restitution: 0.5 });
		newBox.isVisible = false;

		newBox.physics = boxBody;

		const material = new flock.BABYLON.StandardMaterial(
			"staticMaterial",
			flock.scene,
		);

		newBox.material = material;

		function createVerticalConstraint(mesh, referenceBody, scene) {
			let constraint = new flock.BABYLON.Physics6DoFConstraint(
				{
					axisA: new flock.BABYLON.Vector3(1, 0, 0), // trying to turn the car
					axisB: new flock.BABYLON.Vector3(1, 0, 0),
					perpAxisA: new flock.BABYLON.Vector3(0, 1, 0),
					perpAxisB: new flock.BABYLON.Vector3(0, 1, 0),
				},
				[
					{
						axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_X,
						minLimit: 0,
						maxLimit: 0,
					},
					{
						axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
						minLimit: 0,
						maxLimit: 0,
					},
				],
				scene,
			);

			// Ensure both bodies are defined before adding constraint
			if (mesh?.physics && referenceBody) {
				mesh.physics.addConstraint(referenceBody, constraint);

				mesh.metadata.constraint = true;
			} else {
				console.error("Mesh body or reference body is not defined");
			}
		}
		// Create the constraint for the platform
		createVerticalConstraint(mesh, boxBody, flock.scene);

		flock.scene.onAfterPhysicsObservable.add(() => {
			// Check if mesh and physics body still exist and are valid
			if (!mesh || mesh.isDisposed() || !mesh.physics || !mesh.physics._pluginData) {
				return; // Early return if invalid
			}

			try {
				const currentVelocity = mesh.physics.getLinearVelocity();
				const newVelocity = new flock.BABYLON.Vector3(
					0,
					currentVelocity.y,
					0,
				);
				mesh.physics.setLinearVelocity(newVelocity);
				mesh.physics.setAngularVelocity(flock.BABYLON.Vector3.Zero());
			} catch (error) {
				// Handle case where physics body became invalid during execution
				console.warn("Physics body became invalid:", error);
			}
		});
	},
	getCamera() {
		return "__active_camera__";
	},
	cameraControl(key, action) {
		// Define a local function to handle the camera actions
		function handleCameraAction() {
			if (flock.scene.activeCamera.keysRotateLeft) {
				// FreeCamera specific controls
				switch (action) {
					case "moveUp":
						flock.scene.activeCamera.keysUp.push(key);
						break;
					case "moveDown":
						flock.scene.activeCamera.keysDown.push(key);
						break;
					case "moveLeft":
						flock.scene.activeCamera.keysLeft.push(key);
						break;
					case "moveRight":
						flock.scene.activeCamera.keysRight.push(key);
						break;
					case "rotateUp":
						flock.scene.activeCamera.keysRotateUp.push(key);
						break;
					case "rotateDown":
						flock.scene.activeCamera.keysRotateDown.push(key);
						break;
					case "rotateLeft":
						flock.scene.activeCamera.keysRotateLeft.push(key);
						break;
					case "rotateRight":
						flock.scene.activeCamera.keysRotateRight.push(key);
						break;
				}
			} else {
				// ArcRotateCamera specific controls
				switch (action) {
					case "rotateLeft":
					case "moveLeft":
						flock.scene.activeCamera.keysLeft.push(key);
						break;
					case "rotateRight":
					case "moveRight":
						flock.scene.activeCamera.keysRight.push(key);
						break;
					case "moveUp":
					case "rotateUp":
						flock.scene.activeCamera.keysUp.push(key);
						break;
					case "moveDown":
					case "rotateDown":
						flock.scene.activeCamera.keysDown.push(key);
						break;
				}
			}
		}

		if (flock.scene.activeCamera) {
			handleCameraAction();
		} else {
			console.error("No active camera found in the scene.");
		}
	},

}
