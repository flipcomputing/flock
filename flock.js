// Helper functions to make Babylon js easier to use in Flock
console.log("Flock helpers loading");

export function stopAnimationsTargetingMesh(scene, mesh) {
	// Loop through all animation groups in the scene
	scene.animationGroups.forEach(function (animationGroup) {
		// Check if the current animation group targets the specified mesh
		let targets = animationGroup.targetedAnimations.map(
			function (targetedAnimation) {
				return targetedAnimation.target;
			},
		);

		if (
			targets.includes(mesh) ||
			animationGroupTargetsDescendant(animationGroup, mesh)
		) {
			// Stop the animation group if it targets the specified mesh
			animationGroup.stop();
			//console.log("Stopping", animationGroup.name);
		}
	});
}

export function animationGroupTargetsDescendant(animationGroup, parentMesh) {
	// Get all descendants of the parent mesh, including children, grandchildren, etc.
	let descendants = parentMesh.getDescendants();

	// Check each targeted animation to see if its target is among the descendants
	for (let targetedAnimation of animationGroup.targetedAnimations) {
		let target = targetedAnimation.target;
		if (descendants.includes(target)) {
			return true; // Found a descendant that is targeted by the animation group
		}
	}
	return false; // No descendants are targeted by the animation group
}

// Define the function to switch animation
export function switchToAnimation(
	scene,
	mesh,
	animationName,
	loop = true,
	restart = false,
) {
	const newAnimationName = animationName;

	//console.log(`Switching ${mesh.name} to animation ${newAnimationName}`);

	//const mesh = scene.getMeshByName(meshName);
	if (!mesh) {
		console.error(`Mesh ${mesh.name} not found.`);
		return null;
	}

	let targetAnimationGroup = scene.animationGroups.find(
		(group) =>
			group.name === newAnimationName &&
			animationGroupTargetsDescendant(group, mesh),
	);

	if (!targetAnimationGroup) {
		console.error(`Animation "${newAnimationName}" not found.`);
		return null;
	}

	if (!mesh.animationGroups) {
		mesh.animationGroups = [];
		stopAnimationsTargetingMesh(scene, mesh);
		//console.log(`Stopping all animations on mesh`);
	}

	if (
		mesh.animationGroups[0] &&
		mesh.animationGroups[0].name !== newAnimationName
	) {
		stopAnimationsTargetingMesh(scene, mesh);

		//console.log(`Stopping animation ${mesh.animationGroups[0].name}`);
		mesh.animationGroups[0].stop();
		mesh.animationGroups = [];
	}

	if (
		!mesh.animationGroups[0] ||
		(mesh.animationGroups[0].name == newAnimationName && restart)
	) {
		stopAnimationsTargetingMesh(scene, mesh);
		//console.log(`Starting animation ${newAnimationName}`);
		mesh.animationGroups[0] = targetAnimationGroup;
		mesh.animationGroups[0].reset();
		mesh.animationGroups[0].stop();
		mesh.animationGroups[0].start(
			loop,
			1.0,
			targetAnimationGroup.from,
			targetAnimationGroup.to,
			false,
		);
	}

	return targetAnimationGroup;
}

// Define the generator function to yield while waiting for the model
export async function* findModelAndSwitchAnimationGenerator(
	modelName,
	animationName,
	maxAttempts = 100,
	attemptInterval = 500,
) {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const model = scene.getMeshByName(modelName);
		if (model) {
			switchToAnimation(scene, model, animationName);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, attemptInterval));
		yield; // Yield control to allow other threads to run
	}
	throw new Error(
		`Model ${modelName} not found after ${maxAttempts} attempts.`,
	);
}

// helperFunctions.js
export async function highlight(modelName, color) {
	const maxAttempts = 100;
	const attemptInterval = 500;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			if (mesh.material) {
				window.highlighter.addMesh(
					mesh,
					BABYLON.Color3.FromHexString(color),
				);
			}

			mesh.getChildMeshes().forEach(function (childMesh) {
				if (childMesh.material) {
					window.highlighter.addMesh(
						childMesh,
						BABYLON.Color3.FromHexString(color),
					);
				}
			});
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, attemptInterval));
	}
	console.error(
		`Model with ID '${modelName}' not found after ${maxAttempts} attempts.`,
	);
}

export function newModel(modelName, modelId, scale, x, y, z) {
	console.log("Loading", modelId);

	BABYLON.SceneLoader.ImportMesh(
		"",
		"./models/",
		modelName,
		scene,
		function (meshes) {
			//console.log("Loaded", modelId);
			const mesh = meshes[0];

			//meshes[0].rotate(BABYLON.Vector3.Up(), Math.PI);
			mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

			const bb =
				BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
					mesh,
				);
			// Offsetting so that the model appears above the ground but at y=0 to make glide easier
			bb.name = modelId;
			bb.isPickable = true;
			bb.position.addInPlace(new BABYLON.Vector3(x, y, z));

			mesh.computeWorldMatrix(true);
			mesh.refreshBoundingInfo();

			stopAnimationsTargetingMesh(scene, mesh);

			const boxBody = new BABYLON.PhysicsBody(
				bb,
				BABYLON.PhysicsMotionType.STATIC,
				false,
				scene,
			);

			const boxShape = createCapsuleFromBoundingBox(bb, scene);
			
			boxBody.shape = boxShape;
			boxBody.setMassProperties({ mass: 1, restitution: 0.5 });
			boxBody.disablePreStep = false;
			boxBody.setAngularDamping(10000000);
			boxBody.setLinearDamping(0);
			bb.physics = boxBody;
		},
		null,
		function (error) {
			console.log("Error loading", error);
		},
	);

	return modelId;
}

// helperFunctions.js
export function createGround(color) {
	const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100, subdivisions: 2 }, window.scene);
	const groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, window.scene);
	ground.receiveShadows = true;
	const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", window.scene);
	groundMaterial.diffuseColor = BABYLON.Color3.FromHexString(color);
	ground.material = groundMaterial;
}

export function setSky(color) {
	window.scene.clearColor = BABYLON.Color3.FromHexString(color);
}

export function wait(duration) {
	return new Promise(resolve => setTimeout(resolve, duration));
}

export async function clearEffects(modelName) {
	const maxAttempts = 100;
	const attemptInterval = 500;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			window.highlighter.removeMesh(mesh);
			mesh.renderOverlay = false;

			mesh.getChildMeshes().forEach(function(childMesh) {
				if (childMesh.material) {
					window.highlighter.removeMesh(childMesh);
				}
				childMesh.renderOverlay = false;
			});
			return;
		}
		await new Promise(resolve => setTimeout(resolve, attemptInterval));
	}
	console.error(`Model with ID '${modelName}' not found after ${maxAttempts} attempts.`);
}

function createCapsuleFromBoundingBox(mesh, scene) {
	// Ensure the bounding info is up to date
	mesh.computeWorldMatrix(true);
	const boundingInfo = mesh.getBoundingInfo();

	// Get bounding box dimensions
	const height =
		boundingInfo.boundingBox.maximumWorld.y -
		boundingInfo.boundingBox.minimumWorld.y;
	const width =
		boundingInfo.boundingBox.maximumWorld.x -
		boundingInfo.boundingBox.minimumWorld.x;
	const depth =
		boundingInfo.boundingBox.maximumWorld.z -
		boundingInfo.boundingBox.minimumWorld.z;

	// Calculate the radius as the average of the width and depth
	const radius = Math.max(width, depth) / 2;

	// Calculate the effective height of the capsule's cylindrical part
	const cylinderHeight = Math.max(0, height - 2 * radius);

	// Calculate the center of the bounding box
	const center = new BABYLON.Vector3(0, 0, 0);

	// Calculate the start and end points of the capsule's main segment
	const segmentStart = new BABYLON.Vector3(
		center.x,
		center.y - cylinderHeight / 2,
		center.z,
	);
	const segmentEnd = new BABYLON.Vector3(
		center.x,
		center.y + cylinderHeight / 2,
		center.z,
	);

	// Create the capsule shape
	const shape = new BABYLON.PhysicsShapeCapsule(
		segmentStart, // starting point of the capsule segment
		segmentEnd, // ending point of the capsule segment
		radius, // radius of the capsule
		scene, // scene of the shape
	);

	return shape;
}

// helperFunctions.js
export async function tint(modelName, color) {
	const maxAttempts = 100;
	const attemptInterval = 500;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			if (mesh.material) {
				mesh.renderOverlay = true;
				mesh.overlayAlpha = 0.5;
				mesh.overlayColor = BABYLON.Color3.FromHexString(color);
			}

			mesh.getChildMeshes().forEach(function(childMesh) {
				if (childMesh.material) {
					childMesh.renderOverlay = true;
					childMesh.overlayAlpha = 0.5;
					childMesh.overlayColor = BABYLON.Color3.FromHexString(color);
				}
			});
			return;
		}
		await new Promise(resolve => setTimeout(resolve, attemptInterval));
	}
	console.error(`Model with ID '${modelName}' not found after ${maxAttempts} attempts.`);
}

// helperFunctions.js
export async function setAlpha(modelName, alphaValue) {
	const maxAttempts = 100;
	const attemptInterval = 500;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			let allMeshes = [mesh].concat(mesh.getChildMeshes(false));

			allMeshes.forEach(nextMesh => {
				if (nextMesh.material) {
					nextMesh.material.alpha = alphaValue;
				}
			});
			return;
		}
		await new Promise(resolve => setTimeout(resolve, attemptInterval));
	}
	console.error(`Model with ID '${modelName}' not found after ${maxAttempts} attempts.`);
}

export async function playAnimation(modelName, animationName, loop = false, restart = true) {
	const maxAttempts = 10;
	const attemptInterval = 1000; // Time in milliseconds between attempts

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			const animGroup = switchToAnimation(window.scene, mesh, animationName, loop, restart);

			return new Promise((resolve) => {
				animGroup.onAnimationEndObservable.addOnce(() => {
					//console.log("Animation ended");
					resolve();
				});
			});
		}
		await new Promise(resolve => setTimeout(resolve, attemptInterval));
	}
	console.error(`Failed to find mesh "${modelName}" after ${maxAttempts} attempts.`);
}
