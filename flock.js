// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

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

export function switchAnimation(modelName, animationName) {
	const mesh = window.scene.getMeshByName(modelName);
	if (mesh) {
		switchToAnimation(window.scene, mesh, animationName, true, false);
	}
}

export async function highlight(modelName, color) {
	await retryUntilFound(modelName, (mesh) => {
		if (mesh.material) {
			window.highlighter.addMesh(
				mesh,
				BABYLON.Color3.FromHexString(getColorFromString(color)),
			);
		}

		mesh.getChildMeshes().forEach(function (childMesh) {
			if (childMesh.material) {
				window.highlighter.addMesh(
					childMesh,
					BABYLON.Color3.FromHexString(getColorFromString(color)),
				);
			}
		});
	});
}

export function newModel(modelName, modelId, scale, x, y, z) {
	const blockId = modelId;
	modelId += "_" + scene.getUniqueId();

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

			bb.name = modelId;
			bb.blockKey = blockId;
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

export function newCharacter(
	modelName,
	modelId,
	scale,
	x,
	y,
	z,
	hairColor,
	skinColor,
	eyesColor,
	sleevesColor,
	shortsColor,
	tshirtColor,
) {
	const blockId = modelId;
	modelId += "_" + scene.getUniqueId();

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

			bb.name = modelId;
			bb.blockKey = blockId;
			bb.isPickable = true;
			bb.position.addInPlace(new BABYLON.Vector3(x, y, z));

			mesh.computeWorldMatrix(true);
			mesh.refreshBoundingInfo();

			stopAnimationsTargetingMesh(scene, mesh);

			// Helper function to recursively find materials in nested meshes
			function applyColorToMaterial(part, materialName, color) {
				if (part.material && part.material.name === materialName) {
					part.material.albedoColor = BABYLON.Color3.FromHexString(
						getColorFromString(color),
					); //.toLinearSpace();
				}
				part.getChildMeshes().forEach((child) => {
					applyColorToMaterial(child, materialName, color);
				});
			}

			// Apply colors to the respective materials
			applyColorToMaterial(mesh, "Hair", hairColor);
			applyColorToMaterial(mesh, "Skin", skinColor);
			applyColorToMaterial(mesh, "Eyes", eyesColor);
			applyColorToMaterial(mesh, "Sleeves", sleevesColor);
			applyColorToMaterial(mesh, "Shorts", shortsColor);
			applyColorToMaterial(mesh, "TShirt", tshirtColor);

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

export function createGround(color) {
	const ground = BABYLON.MeshBuilder.CreateGround(
		"ground",
		{ width: 100, height: 100, subdivisions: 2 },
		window.scene,
	);
	const groundAggregate = new BABYLON.PhysicsAggregate(
		ground,
		BABYLON.PhysicsShapeType.BOX,
		{ mass: 0 },
		window.scene,
	);

	ground.receiveShadows = true;
	const groundMaterial = new BABYLON.StandardMaterial(
		"groundMaterial",
		window.scene,
	);

	groundMaterial.diffuseColor = BABYLON.Color3.FromHexString(
		getColorFromString(color),
	);
	ground.material = groundMaterial;
}

export function setSky(color) {
	window.scene.clearColor = BABYLON.Color3.FromHexString(
		getColorFromString(color),
	);
}

export function wait(duration) {
	return new Promise((resolve) => setTimeout(resolve, duration));
}

export async function clearEffects(modelName) {
	await retryUntilFound(modelName, (mesh) => {
		window.highlighter.removeMesh(mesh);
		mesh.renderOverlay = false;

		mesh.getChildMeshes().forEach(function (childMesh) {
			if (childMesh.material) {
				window.highlighter.removeMesh(childMesh);
			}
			childMesh.renderOverlay = false;
		});
	});
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

	// Calculate the radius as the min of the width and depth
	const radius = Math.min(width, depth) / 2;

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

export async function tint(modelName, color) {
	await retryUntilFound(modelName, (mesh) => {
		if (mesh.material) {
			mesh.renderOverlay = true;
			mesh.overlayAlpha = 0.5;
			mesh.overlayColor = BABYLON.Color3.FromHexString(
				getColorFromString(color),
			);
		}

		mesh.getChildMeshes().forEach(function (childMesh) {
			if (childMesh.material) {
				childMesh.renderOverlay = true;
				childMesh.overlayAlpha = 0.5;
				childMesh.overlayColor = BABYLON.Color3.FromHexString(
					getColorFromString(getColorFromString(color)),
				);
			}
		});
	});
}

// helperFunctions.js
export async function setAlpha(modelName, alphaValue) {
	await retryUntilFound(modelName, (mesh) => {
		let allMeshes = [mesh].concat(mesh.getChildMeshes(false));

		allMeshes.forEach((nextMesh) => {
			if (nextMesh.material) {
				nextMesh.material.alpha = alphaValue;
			}
		});
	});
}

export async function playAnimation(
	modelName,
	animationName,
	loop = false,
	restart = true,
) {
	const maxAttempts = 10;
	const attemptInterval = 1000; // Time in milliseconds between attempts

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			const animGroup = switchToAnimation(
				window.scene,
				mesh,
				animationName,
				loop,
				restart,
			);

			return new Promise((resolve) => {
				animGroup.onAnimationEndObservable.addOnce(() => {
					//console.log("Animation ended");
					resolve();
				});
			});
		}
		await new Promise((resolve) => setTimeout(resolve, attemptInterval));
	}
	console.error(
		`Failed to find mesh "${modelName}" after ${maxAttempts} attempts.`,
	);
}

// helperFunctions.js
export function setFog(fogColorHex, fogMode, fogDensity = 0.1) {
	const fogColorRgb = BABYLON.Color3.FromHexString(
		getColorFromString(fogColorHex),
	);

	switch (fogMode) {
		case "NONE":
			window.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
			break;
		case "EXP":
			window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
			break;
		case "EXP2":
			window.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
			break;
		case "LINEAR":
			window.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
			break;
	}

	window.scene.fogColor = fogColorRgb;
	window.scene.fogDensity = fogDensity;
	window.scene.fogStart = 50;
	window.scene.fogEnd = 100;
}

export function newBox(color, width, height, depth, posX, posY, posZ, boxId) {
	const newBox = BABYLON.MeshBuilder.CreateBox(
		boxId,
		{ width, height, depth },
		window.scene,
	);
	newBox.position = new BABYLON.Vector3(posX, posY, posZ);

	newBox.blockKey = newBox.name;
	newBox.name = newBox.name + newBox.uniqueId;
	const boxBody = new BABYLON.PhysicsBody(
		newBox,
		BABYLON.PhysicsMotionType.STATIC,
		false,
		window.scene,
	);

	const boxShape = new BABYLON.PhysicsShapeBox(
		new BABYLON.Vector3(0, 0, 0),
		new BABYLON.Quaternion(0, 0, 0, 1),
		new BABYLON.Vector3(width, height, depth),
		window.scene,
	);

	boxBody.setMassProperties({ inertia: BABYLON.Vector3.ZeroReadOnly });
	boxBody.shape = boxShape;
	boxBody.setMassProperties({ mass: 1, restitution: 0.5 });

	newBox.physics = boxBody;

	const material = new BABYLON.StandardMaterial("boxMaterial", window.scene);
	material.diffuseColor = BABYLON.Color3.FromHexString(
		getColorFromString(color),
	);
	newBox.material = material;

	return newBox.name;
}

export function newSphere(
	color,
	diameterX,
	diameterY,
	diameterZ,
	posX,
	posY,
	posZ,
	sphereId,
) {
	const newSphere = BABYLON.MeshBuilder.CreateSphere(
		sphereId,
		{
			diameterX,
			diameterY,
			diameterZ,
		},
		window.scene,
	);
	newSphere.position = new BABYLON.Vector3(posX, posY, posZ);

	newSphere.blockKey = newSphere.name;
	newSphere.name = newSphere.name + newSphere.uniqueId;

	const sphereBody = new BABYLON.PhysicsBody(
		newSphere,
		BABYLON.PhysicsMotionType.STATIC,
		false,
		window.scene,
	);

	const sphereShape = new BABYLON.PhysicsShapeSphere(
		new BABYLON.Vector3(0, 0, 0),
		Math.max(diameterX, diameterY, diameterZ) / 2, // Approximation for irregular diameters
		window.scene,
	);

	sphereBody.shape = sphereShape;
	sphereBody.setMassProperties({ mass: 1, restitution: 0.5 });
	//sphereBody.setAngularDamping(100);
	//sphereBody.setLinearDamping(10);
	newSphere.physics = sphereBody;

	const material = new BABYLON.StandardMaterial(
		"sphereMaterial",
		window.scene,
	);
	material.diffuseColor = BABYLON.Color3.FromHexString(
		getColorFromString(color),
	);
	newSphere.material = material;

	return newSphere.name;
}

export function newPlane(color, width, height, posX, posY, posZ, planeId) {
	const newPlane = BABYLON.MeshBuilder.CreatePlane(
		planeId,
		{ width, height, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
		window.scene,
	);

	newPlane.blockKey = newPlane.name;
	newPlane.name = newPlane.name + newPlane.uniqueId;
	newPlane.position = new BABYLON.Vector3(posX, posY, posZ);

	const material = new BABYLON.StandardMaterial(
		"planeMaterial",
		window.scene,
	);
	material.diffuseColor = BABYLON.Color3.FromHexString(
		getColorFromString(color),
	);
	newPlane.material = material;

	return newPlane.name;
}

export async function moveByVector(modelName, x, y, z) {
	await retryUntilFound(modelName, (mesh) => {
		mesh.position.addInPlace(new BABYLON.Vector3(x, y, z));
		mesh.physics.disablePreStep = false;
		mesh.physics.setTargetTransform(mesh.position, mesh.rotationQuaternion);

		// Ensure state consistency
		mesh.computeWorldMatrix(true);
	});
}

export async function scaleMesh(modelName, x, y, z) {
	await retryUntilFound(modelName, (mesh) => {
		mesh.scaling = new BABYLON.Vector3(x, y, z);

		// Ensure state consistency
		mesh.computeWorldMatrix(true);
	});
}

export async function rotate(meshName, x, y, z) {
	await retryUntilFound(meshName, (mesh) => {
		if (
			mesh.physics.getMotionType() !== BABYLON.PhysicsMotionType.DYNAMIC
		) {
			mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
		}

		const incrementalRotation = BABYLON.Quaternion.RotationYawPitchRoll(
			BABYLON.Tools.ToRadians(y),
			BABYLON.Tools.ToRadians(x),
			BABYLON.Tools.ToRadians(z),
		);
		mesh.rotationQuaternion
			.multiplyInPlace(incrementalRotation)
			.normalize();
		mesh.physics.disablePreStep = false;
		mesh.physics.setTargetTransform(
			mesh.absolutePosition,
			mesh.rotationQuaternion,
		);

		// Ensure state consistency
		mesh.computeWorldMatrix(true);
	});
}

async function retryUntilFound(modelName, callback) {
	const maxAttempts = 10;
	const attemptInterval = 1000; // Time in milliseconds between attempts

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const mesh = window.scene.getMeshByName(modelName);
		if (mesh) {
			await callback(mesh);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, attemptInterval));
	}
	console.error(
		`Model with ID '${modelName}' not found after ${maxAttempts} attempts.`,
	);
}

export async function glideTo(meshName, x, y, z, duration) {
	return new Promise(async (resolve) => {
		await window.whenModelReady(meshName, async function (mesh) {
			if (mesh) {
				const startPosition = mesh.position.clone();
				const endPosition = new BABYLON.Vector3(x, y, z);
				const fps = 30;
				const frames = 30 * (duration / 1000);

				if (mesh.glide) {
					// Only allow one glide at a time
					mesh.glide.stop();
				}

				mesh.physics.disablePreStep = false;

				mesh.glide = BABYLON.Animation.CreateAndStartAnimation(
					"anim",
					mesh,
					"position",
					fps,
					100,
					startPosition,
					endPosition,
					BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
				);

				mesh.glide.onAnimationEndObservable.add(() => {
					mesh.physics.disablePreStep = true;
					mesh.glide = null;
					resolve();
				});
			} else {
				resolve(); // Resolve if the mesh is not found to prevent hanging
			}
		});
	});
}

export async function show(modelName) {
	return new Promise(async (resolve) => {
		await window.whenModelReady(modelName, async function (mesh) {
			if (mesh) {
				mesh.setEnabled(true);
				window.hk._hknp.HP_World_AddBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
					mesh.physics.startAsleep,
				);
				resolve();
			} else {
				console.log("Model not loaded:", modelName);
				resolve(); // Resolve even if the mesh is not found to prevent hanging
			}
		});
	});
}

export async function hide(modelName) {
	return new Promise(async (resolve) => {
		await window.whenModelReady(modelName, async function (mesh) {
			if (mesh) {
				mesh.setEnabled(false);
				window.hk._hknp.HP_World_RemoveBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
				);
				resolve();
			} else {
				console.log("Mesh not loaded:", modelName);
				resolve(); // Resolve even if the mesh is not found to prevent hanging
			}
		});
	});
}

export function up(modelName, upForce = 10) {
	const mesh = window.scene.getMeshByName(modelName);
	if (mesh) {
		mesh.physics.applyImpulse(
			new BABYLON.Vector3(0, upForce, 0),
			mesh.getAbsolutePosition(),
		);
	} else {
		console.log("Model not loaded (up):", modelName);
	}
}

export function isTouchingSurface(modelName) {
	const mesh = window.scene.getMeshByName(modelName);
	if (mesh) {
		return checkIfOnSurface(mesh);
	} else {
		console.log("Model not loaded (isTouchingSurface):", modelName);
		return false;
	}
}

function checkIfOnSurface(mesh) {
	// Compute the world matrix to ensure updated positions
	mesh.computeWorldMatrix(true);
	const boundingInfo = mesh.getBoundingInfo();

	// Setting the ray origin slightly above the mesh's lowest point
	const minY = boundingInfo.boundingBox.minimumWorld.y;
	const rayOrigin = new BABYLON.Vector3(
		boundingInfo.boundingBox.centerWorld.x,
		minY + 0.01, // Slightly above to avoid hitting the mesh itself
		boundingInfo.boundingBox.centerWorld.z,
	);

	// Cast the ray downwards with sufficient length to cover expected distances
	const ray = new BABYLON.Ray(rayOrigin, new BABYLON.Vector3(0, -1, 0), 2);
	//const rayHelper = new BABYLON.RayHelper(ray);
	//rayHelper.show(window.scene);

	// Perform the raycast
	mesh.isPickable = false;
	const hit = window.scene.pickWithRay(ray);
	mesh.isPickable = true;

	//console.log(`Ray hit: ${hit.hit}, Distance: ${hit.distance}, Picked Mesh: ${hit.pickedMesh ? hit.pickedMesh.name : "None"}`,);

	// Check if the mesh is directly on top of the surface
	return hit.hit && hit.pickedMesh !== null && hit.distance <= 0.02; // Adjust the threshold as needed
}

export function keyPressed(key) {
	if (key === "ANY") {
		return canvas.pressedKeys.size > 0;
	} else if (key === "NONE") {
		return canvas.pressedKeys.size === 0;
	} else {
		return canvas.pressedKeys.has(key);
	}
}

export function seededRandom(from, to, seed) {
	const x = Math.sin(seed) * 10000;
	const random = x - Math.floor(x); // Generates a number between 0 and 1
	const result = Math.floor(random * (to - from + 1)) + from; // Scales it to the desired range
	return result;
}

export const randomColour = () => {
	const letters = "0123456789ABCDEF";
	let colour = "#";
	for (let i = 0; i < 6; i++) {
		colour += letters[Math.floor(Math.random() * 16)];
	}
	return colour;
};

function rgbToHex(rgb) {
	const result = rgb.match(/\d+/g).map(function (x) {
		const hex = parseInt(x).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	});
	return "#" + result.join("");
}

function getColorFromString(colourString) {
	// Check if the string is a valid hex code or number
	if (/^#([0-9A-F]{3}){1,2}$/i.test(colourString)) {
		return colourString;
	}

	try {
		const colorDiv = document.createElement("div");
		colorDiv.style.color = colourString;
		document.body.appendChild(colorDiv);
		const computedColor = getComputedStyle(colorDiv).color;
		document.body.removeChild(colorDiv);
		return rgbToHex(computedColor);
	} catch (e) {
		return "#000000"; // default to black if invalid colour
	}
}

export async function changeColour(modelName, color) {
	await retryUntilFound(modelName, (mesh) => {
		if (mesh.material) {
			mesh.material.diffuseColor = BABYLON.Color3.FromHexString(color);
		} else {
			const material = new BABYLON.StandardMaterial(
				"meshMaterial",
				window.scene,
			);
			material.diffuseColor = BABYLON.Color3.FromHexString(color);
			mesh.material = material;
		}
	});
}

// Helper function to move the model forward
export function moveForward(modelName, speed) {
	const model = window.scene.getMeshByName(modelName);
	if (!model || speed === 0) return;

	const forwardSpeed = speed;
	const cameraForward = window.scene.activeCamera
		.getForwardRay()
		.direction.normalize();
	const moveDirection = cameraForward.scale(forwardSpeed);
	const currentVelocity = model.physics.getLinearVelocity();

	// Set linear velocity
	model.physics.setLinearVelocity(
		new BABYLON.Vector3(
			moveDirection.x,
			currentVelocity.y,
			moveDirection.z,
		),
	);

	// Set rotation
	const facingDirection =
		speed >= 0
			? new BABYLON.Vector3(
					-cameraForward.x,
					0,
					-cameraForward.z,
				).normalize()
			: new BABYLON.Vector3(
					cameraForward.x,
					0,
					cameraForward.z,
				).normalize();
	const targetRotation = BABYLON.Quaternion.FromLookDirectionLH(
		facingDirection,
		BABYLON.Vector3.Up(),
	);
	const currentRotation = model.rotationQuaternion;
	const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
	const deltaEuler = deltaRotation.toEulerAngles();
	model.physics.setAngularVelocity(
		new BABYLON.Vector3(0, deltaEuler.y * 5, 0),
	); // Adjust scalar as needed
	model.rotationQuaternion.x = 0;
	model.rotationQuaternion.z = 0;
	model.rotationQuaternion.normalize(); // Re-normalize the quaternion
}

export function attachCamera(modelName) {
	window.whenModelReady(modelName, function (mesh) {
		if (mesh) {
			// After physics calculations, adjust velocities and rotations
			window.scene.onAfterPhysicsObservable.add(() => {
				const currentVelocity = mesh.physics.getLinearVelocity();
				const newVelocity = new BABYLON.Vector3(
					0,
					currentVelocity.y,
					0,
				); // Maintain vertical velocity, reset horizontal
				mesh.physics.setLinearVelocity(newVelocity);
				mesh.physics.setAngularVelocity(BABYLON.Vector3.Zero());

				const currentRotationQuaternion = mesh.rotationQuaternion;
				const currentEulerRotation =
					currentRotationQuaternion.toEulerAngles();
				const newRotationQuaternion =
					BABYLON.Quaternion.RotationYawPitchRoll(
						currentEulerRotation.y,
						0,
						0,
					);
				mesh.rotationQuaternion.copyFrom(newRotationQuaternion);
			});

			// Set up camera
			const camera = new BABYLON.ArcRotateCamera(
				"camera",
				Math.PI / 2,
				Math.PI / 4,
				10,
				mesh.position,
				window.scene,
			);
			camera.checkCollisions = true;
			camera.lowerBetaLimit = Math.PI / 2.5; // Lower angle limit
			camera.upperBetaLimit = Math.PI / 2; // Upper angle limit
			camera.lowerRadiusLimit = 2;
			camera.upperRadiusLimit = 7;
			camera.setTarget(mesh.position);
			camera.attachControl(canvas, true);
			window.scene.activeCamera = camera;
		} else {
			console.log("Model not loaded:", modelName);
		}
	});
}

export async function setPhysics(modelName, physicsType) {
	await retryUntilFound(modelName, (mesh) => {
		switch (physicsType) {
			case "STATIC":
				mesh.physics.setMotionType(BABYLON.PhysicsMotionType.STATIC);
				window.hk._hknp.HP_World_AddBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
					mesh.physics.startAsleep,
				);
				break;
			case "DYNAMIC":
				mesh.physics.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
				window.hk._hknp.HP_World_AddBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
					mesh.physics.startAsleep,
				);
				break;
			case "ANIMATED":
				mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
				window.hk._hknp.HP_World_AddBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
					mesh.physics.startAsleep,
				);
				break;
			case "NONE":
				mesh.physics.setMotionType(BABYLON.PhysicsMotionType.STATIC);
				window.hk._hknp.HP_World_RemoveBody(
					hk.world,
					mesh.physics._pluginData.hpBodyId,
				);
				break;
			default:
				console.error("Invalid physics type provided:", physicsType);
				break;
		}
	});
}

// Helper function to determine if two meshes are touching
export function checkMeshesTouching(mesh1VarName, mesh2VarName) {
	const mesh1 = scene.getMeshByName(mesh1VarName);
	const mesh2 = scene.getMeshByName(mesh2VarName);
	if (mesh1 && mesh2 && mesh2.isEnabled()) {
		return mesh1.intersectsMesh(mesh2, false); // 'false' for precise mode
	}
	return false;
}

export async function say(
	meshName,
	text,
	duration,
	textColor,
	backgroundColor,
	alpha,
	size,
	mode,
) {
	await window.whenModelReady(meshName, async function (mesh) {
		return new Promise((resolve, reject) => {
			if (mesh) {
				// Find the first child node with a material
				let targetMesh = mesh;
				if (!mesh.material) {
					const stack = [mesh];
					while (stack.length > 0) {
						const current = stack.pop();
						if (current.material) {
							targetMesh = current;
							break;
						}
						stack.push(...current.getChildMeshes());
					}
				}

				// Create or get the stack panel plane
				let plane = mesh
					.getDescendants()
					.find((child) => child.name === "textPlane");
				let advancedTexture;
				if (!plane) {
					plane = BABYLON.MeshBuilder.CreatePlane(
						"textPlane",
						{ width: 1.5, height: 1.5 },
						window.scene,
					);
					plane.name = "textPlane";
					plane.parent = targetMesh;
					plane.alpha = 1;
					plane.checkCollisions = false;
					plane.isPickable = false;
					advancedTexture =
						window.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
					plane.advancedTexture = advancedTexture;

					// Calculate the bounding box height of the mesh
					const boundingInfo = targetMesh.getBoundingInfo();
					plane.position.y =
						boundingInfo.boundingBox.maximum.y + 0.85;
					plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
					
					const stackPanel = new window.GUI.StackPanel();
					stackPanel.name = "stackPanel";
					stackPanel.horizontalAlignment =
						window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
					stackPanel.verticalAlignment =
						window.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
					stackPanel.isVertical = true;
					stackPanel.width = "100%";
					stackPanel.adaptHeightToChildren = true;
					stackPanel.resizeToFit = true;
					stackPanel.forceResizeWidth = true;
					stackPanel.forceResizeHeight = true;
					stackPanel.spacing = 4;
					advancedTexture.addControl(stackPanel);
				} else {
					advancedTexture = plane.advancedTexture;					
				}

				const stackPanel =
					advancedTexture.getControlByName("stackPanel");

				// Handle REPLACE mode
				if (mode === "REPLACE") {
					stackPanel.clearControls();
				}

				// Only add new text if the text value is not empty
				if (text) {
					const bg = new window.GUI.Rectangle("textBackground");
					bg.background = window.hexToRgba(backgroundColor, alpha);
					bg.adaptWidthToChildren = true;
					bg.adaptHeightToChildren = true;
					bg.cornerRadius = 30;
					bg.thickness = 0; // Remove border
					bg.resizeToFit = true;
					bg.forceResizeWidth = true;
					stackPanel.addControl(bg);

					const textBlock = new window.GUI.TextBlock();
					textBlock.text = text;
					textBlock.color = textColor;
					textBlock.fontSize = size * 10;
					textBlock.alpha = 1;
					textBlock.textWrapping = window.GUI.TextWrapping.WordWrap;
					textBlock.resizeToFit = true;
					textBlock.forceResizeWidth = true;
					textBlock.paddingLeft = 50;
					textBlock.paddingRight = 50;
					textBlock.paddingTop = 20;
					textBlock.paddingBottom = 20;
					textBlock.textVerticalAlignment =
						window.GUI.Control.VERTICAL_ALIGNMENT_TOP;
					textBlock.textHorizontalAlignment =
						window.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
					bg.addControl(textBlock);

					// Remove the text after the specified duration if duration is greater than 0
					if (duration > 0) {
						setTimeout(function () {
							stackPanel.removeControl(bg);
							bg.dispose();
							textBlock.dispose();
							resolve();
						}, duration * 1000);
					} else {
						resolve();
					}
				} else {
					resolve();
				}
			} else {
				console.error("Mesh is not defined.");
				reject("Mesh is not defined.");
			}
		});
	});
}
