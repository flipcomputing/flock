// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

// Helper functions to make Babylon js easier to use in Flock
console.log("Flock helpers loading");

export const flock = {
	console: console,
	alert: alert,
	BABYLON: BABYLON,
	scene: null,
	highlighter: null,
	hk: null,
	GUI: null,
	canvas: null,
	canvas: {
		pressedKeys: null,
		currentKeyPressed: null,
	},
	async *modelReadyGenerator(
		meshId,
		maxAttempts = 10,
		attemptInterval = 1000,
	) {
		let attempt = 1;

		while (attempt <= maxAttempts) {
			if (flock.scene) {
				const mesh = flock.scene.getMeshByName(meshId);
				if (mesh) {
					yield mesh;
					return;
				}
			}
			await new Promise((resolve) =>
				setTimeout(resolve, attemptInterval),
			);
			attempt++;
		}

		// Log a warning if meshId is not defined
		console.warn(
			`Mesh with ID '${meshId}' not found after ${maxAttempts} attempts.`,
		);
	},
	async whenModelReady(meshId, callback) {
		// Check if flock.modelReadyGenerator exists
		if (!flock.modelReadyGenerator) {
			throw new Error(
				"modelReadyGenerator is not defined on the flock object.",
			);
		}

		// Create the generator using the flock's modelReadyGenerator
		const generator = flock.modelReadyGenerator(meshId);

		try {
			for await (const mesh of generator) {
				await callback(mesh);
			}
		} catch (error) {
			console.error("Error in modelReadyGenerator:", error);
		}
	},
	stopAnimationsTargetingMesh(scene, mesh) {
		scene.animationGroups.forEach(function (animationGroup) {
			let targets = animationGroup.targetedAnimations.map(
				function (targetedAnimation) {
					return targetedAnimation.target;
				},
			);

			if (
				targets.includes(mesh) ||
				flock.animationGroupTargetsDescendant(animationGroup, mesh)
			) {
				animationGroup.stop();
			}
		});
	},
	animationGroupTargetsDescendant(animationGroup, parentMesh) {
		let descendants = parentMesh.getDescendants();
		for (let targetedAnimation of animationGroup.targetedAnimations) {
			let target = targetedAnimation.target;
			if (descendants.includes(target)) {
				return true;
			}
		}
		return false;
	},
	switchToAnimation(
		scene,
		mesh,
		animationName,
		loop = true,
		restart = false,
	) {
		const newAnimationName = animationName;

		if (!mesh) {
			console.error(`Mesh ${mesh.name} not found.`);
			return null;
		}

		let targetAnimationGroup = scene.animationGroups.find(
			(group) =>
				group.name === newAnimationName &&
				flock.animationGroupTargetsDescendant(group, mesh),
		);

		if (!targetAnimationGroup) {
			console.error(`Animation "${newAnimationName}" not found.`);
			return null;
		}

		if (!mesh.animationGroups) {
			mesh.animationGroups = [];
			flock.stopAnimationsTargetingMesh(scene, mesh);
		}

		if (
			mesh.animationGroups[0] &&
			mesh.animationGroups[0].name !== newAnimationName
		) {
			flock.stopAnimationsTargetingMesh(scene, mesh);
			mesh.animationGroups[0].stop();
			mesh.animationGroups = [];
		}

		if (
			!mesh.animationGroups[0] ||
			(mesh.animationGroups[0].name == newAnimationName && restart)
		) {
			flock.stopAnimationsTargetingMesh(scene, mesh);
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
	},
	async switchAnimation(modelName, animationName) {
		await flock.whenModelReady(modelName, (mesh) => {
			flock.switchToAnimation(
				flock.scene,
				mesh,
				animationName,
				true,
				false,
			);
		});
	},
	async highlight(modelName, color) {
		await flock.whenModelReady(modelName, (mesh) => {
			if (mesh.material) {
				flock.highlighter.addMesh(
					mesh,
					flock.BABYLON.Color3.FromHexString(
						flock.getColorFromString(color),
					),
				);
			}

			mesh.getChildMeshes().forEach(function (childMesh) {
				if (childMesh.material) {
					flock.highlighter.addMesh(
						childMesh,
						flock.BABYLON.Color3.FromHexString(
							flock.getColorFromString(color),
						),
					);
				}
			});
		});
	},
	newModel(modelName, modelId, scale, x, y, z) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		flock.BABYLON.SceneLoader.ImportMesh(
			"",
			"./models/",
			modelName,
			flock.scene,
			function (meshes) {
				const mesh = meshes[0];
				mesh.scaling = new flock.BABYLON.Vector3(scale, scale, scale);

				const bb =
					flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
						mesh,
					);

				bb.name = modelId;
				bb.blockKey = blockId;
				bb.isPickable = true;
				bb.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));

				mesh.computeWorldMatrix(true);
				mesh.refreshBoundingInfo();

				flock.stopAnimationsTargetingMesh(flock.scene, mesh);

				const boxBody = new flock.BABYLON.PhysicsBody(
					bb,
					flock.BABYLON.PhysicsMotionType.STATIC,
					false,
					flock.scene,
				);

				const boxShape = flock.createCapsuleFromBoundingBox(
					bb,
					flock.scene,
				);

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
	},
	newCharacter(
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
		modelId += "_" + flock.scene.getUniqueId();

		flock.BABYLON.SceneLoader.ImportMesh(
			"",
			"./models/",
			modelName,
			flock.scene,
			function (meshes) {
				const mesh = meshes[0];
				mesh.scaling = new flock.BABYLON.Vector3(scale, scale, scale);

				const bb =
					flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
						mesh,
					);

				bb.name = modelId;
				bb.blockKey = blockId;
				bb.isPickable = true;
				bb.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));

				mesh.computeWorldMatrix(true);
				mesh.refreshBoundingInfo();

				flock.stopAnimationsTargetingMesh(flock.scene, mesh);

				function applyColorToMaterial(part, materialName, color) {
					if (part.material && part.material.name === materialName) {
						part.material.albedoColor =
							flock.BABYLON.Color3.FromHexString(
								flock.getColorFromString(color),
							);
					}
					part.getChildMeshes().forEach((child) => {
						applyColorToMaterial(child, materialName, color);
					});
				}

				applyColorToMaterial(mesh, "Hair", hairColor);
				applyColorToMaterial(mesh, "Skin", skinColor);
				applyColorToMaterial(mesh, "Eyes", eyesColor);
				applyColorToMaterial(mesh, "Sleeves", sleevesColor);
				applyColorToMaterial(mesh, "Shorts", shortsColor);
				applyColorToMaterial(mesh, "TShirt", tshirtColor);

				const boxBody = new flock.BABYLON.PhysicsBody(
					bb,
					flock.BABYLON.PhysicsMotionType.STATIC,
					false,
					flock.scene,
				);

				const boxShape = flock.createCapsuleFromBoundingBox(
					bb,
					flock.scene,
				);

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
	},
	newObject(modelName, modelId, scale, x, y, z, color) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		flock.BABYLON.SceneLoader.ImportMesh(
			"",
			"./models/",
			modelName,
			flock.scene,
			function (meshes) {
				const mesh = meshes[0];
				mesh.scaling = new flock.BABYLON.Vector3(scale, scale, scale);

				const bb =
					flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
						mesh,
					);

				bb.name = modelId;
				bb.blockKey = blockId;
				bb.isPickable = true;
				bb.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));

				mesh.computeWorldMatrix(true);
				mesh.refreshBoundingInfo();

				flock.stopAnimationsTargetingMesh(flock.scene, mesh);

				function applyColorToMaterial(part, color) {
					if (part.material) {
						part.material.albedoColor =
							flock.BABYLON.Color3.FromHexString(
								flock.getColorFromString(color),
							).toLinearSpace();
						part.material.emissiveColor =
							flock.BABYLON.Color3.FromHexString(
								flock.getColorFromString(color),
							).toLinearSpace();
						part.material.emissiveIntensity = 0.1;
					}
					part.getChildMeshes().forEach((child) => {
						applyColorToMaterial(child, color);
					});
				}

				applyColorToMaterial(mesh, color);

				const boxBody = new flock.BABYLON.PhysicsBody(
					bb,
					flock.BABYLON.PhysicsMotionType.STATIC,
					false,
					flock.scene,
				);

				const boxShape = flock.createCapsuleFromBoundingBox(
					bb,
					flock.scene,
				);

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
	},
	createGround(color) {
		const ground = flock.BABYLON.MeshBuilder.CreateGround(
			"ground",
			{ width: 100, height: 100, subdivisions: 2 },
			flock.scene,
		);
		const groundAggregate = new flock.BABYLON.PhysicsAggregate(
			ground,
			flock.BABYLON.PhysicsShapeType.BOX,
			{ mass: 0 },
			flock.scene,
		);

		ground.receiveShadows = true;
		const groundMaterial = new flock.BABYLON.StandardMaterial(
			"groundMaterial",
			flock.scene,
		);

		groundMaterial.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		ground.material = groundMaterial;
	},
	setSky(color) {
		flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
	},
	wait(duration) {
		return new Promise((resolve) => setTimeout(resolve, duration));
	},
	async clearEffects(modelName) {
		await flock.whenModelReady(modelName, (mesh) => {
			flock.highlighter.removeMesh(mesh);
			mesh.renderOverlay = false;

			mesh.getChildMeshes().forEach(function (childMesh) {
				if (childMesh.material) {
					flock.highlighter.removeMesh(childMesh);
				}
				childMesh.renderOverlay = false;
			});
		});
	},
	createCapsuleFromBoundingBox(mesh, scene) {
		mesh.computeWorldMatrix(true);
		const boundingInfo = mesh.getBoundingInfo();

		const height =
			boundingInfo.boundingBox.maximumWorld.y -
			boundingInfo.boundingBox.minimumWorld.y;
		const width =
			boundingInfo.boundingBox.maximumWorld.x -
			boundingInfo.boundingBox.minimumWorld.x;
		const depth =
			boundingInfo.boundingBox.maximumWorld.z -
			boundingInfo.boundingBox.minimumWorld.z;

		const radius = Math.min(width, depth) / 2;

		const cylinderHeight = Math.max(0, height - 2 * radius);

		const center = new flock.BABYLON.Vector3(0, 0, 0);

		const segmentStart = new flock.BABYLON.Vector3(
			center.x,
			center.y - cylinderHeight / 2,
			center.z,
		);
		const segmentEnd = new flock.BABYLON.Vector3(
			center.x,
			center.y + cylinderHeight / 2,
			center.z,
		);

		const shape = new flock.BABYLON.PhysicsShapeCapsule(
			segmentStart,
			segmentEnd,
			radius,
			scene,
		);

		return shape;
	},
	async tint(modelName, color) {
		await flock.whenModelReady(modelName, (mesh) => {
			if (mesh.material) {
				mesh.renderOverlay = true;
				mesh.overlayAlpha = 0.5;
				mesh.overlayColor = flock.BABYLON.Color3.FromHexString(
					flock.getColorFromString(color),
				);
			}

			mesh.getChildMeshes().forEach(function (childMesh) {
				if (childMesh.material) {
					childMesh.renderOverlay = true;
					childMesh.overlayAlpha = 0.5;
					childMesh.overlayColor = flock.BABYLON.Color3.FromHexString(
						flock.getColorFromString(
							flock.getColorFromString(color),
						),
					);
				}
			});
		});
	},
	async setAlpha(modelName, alphaValue) {
		await flock.whenModelReady(modelName, (mesh) => {
			let allMeshes = [mesh].concat(mesh.getChildMeshes(false));

			allMeshes.forEach((nextMesh) => {
				if (nextMesh.material) {
					nextMesh.material.alpha = alphaValue;
				}
			});
		});
	},
	async playAnimation(
		modelName,
		animationName,
		loop = false,
		restart = true,
	) {
		const maxAttempts = 10;
		const attemptInterval = 1000;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const mesh = flock.scene.getMeshByName(modelName);
			if (mesh) {
				const animGroup = flock.switchToAnimation(
					flock.scene,
					mesh,
					animationName,
					loop,
					restart,
				);

				return new Promise((resolve) => {
					animGroup.onAnimationEndObservable.addOnce(() => {
						resolve();
					});
				});
			}
			await new Promise((resolve) =>
				setTimeout(resolve, attemptInterval),
			);
		}
		console.error(
			`Failed to find mesh "${modelName}" after ${maxAttempts} attempts.`,
		);
	},
	setFog(fogColorHex, fogMode, fogDensity = 0.1) {
		const fogColorRgb = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(fogColorHex),
		);

		switch (fogMode) {
			case "NONE":
				flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_NONE;
				break;
			case "EXP":
				flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_EXP;
				break;
			case "EXP2":
				flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_EXP2;
				break;
			case "LINEAR":
				flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_LINEAR;
				break;
		}

		flock.scene.fogColor = fogColorRgb;
		flock.scene.fogDensity = fogDensity;
		flock.scene.fogStart = 50;
		flock.scene.fogEnd = 100;
	},
	newBox(color, width, height, depth, posX, posY, posZ, boxId) {
		const newBox = flock.BABYLON.MeshBuilder.CreateBox(
			boxId,
			{ width, height, depth },
			flock.scene,
		);
		newBox.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		newBox.blockKey = newBox.name;
		newBox.name = newBox.name + newBox.uniqueId;
		const boxBody = new flock.BABYLON.PhysicsBody(
			newBox,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const boxShape = new flock.BABYLON.PhysicsShapeBox(
			new flock.BABYLON.Vector3(0, 0, 0),
			new flock.BABYLON.Quaternion(0, 0, 0, 1),
			new flock.BABYLON.Vector3(width, height, depth),
			flock.scene,
		);

		boxBody.setMassProperties({
			inertia: flock.BABYLON.Vector3.ZeroReadOnly,
		});
		boxBody.shape = boxShape;
		boxBody.setMassProperties({ mass: 1, restitution: 0.5 });

		newBox.physics = boxBody;

		const material = new flock.BABYLON.StandardMaterial(
			"boxMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		newBox.material = material;

		return newBox.name;
	},
	newSphere(
		color,
		diameterX,
		diameterY,
		diameterZ,
		posX,
		posY,
		posZ,
		sphereId,
	) {
		const newSphere = flock.BABYLON.MeshBuilder.CreateSphere(
			sphereId,
			{
				diameterX,
				diameterY,
				diameterZ,
			},
			flock.scene,
		);
		newSphere.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		newSphere.blockKey = newSphere.name;
		newSphere.name = newSphere.name + newSphere.uniqueId;

		const sphereBody = new flock.BABYLON.PhysicsBody(
			newSphere,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const sphereShape = new flock.BABYLON.PhysicsShapeSphere(
			new flock.BABYLON.Vector3(0, 0, 0),
			Math.max(diameterX, diameterY, diameterZ) / 2,
			flock.scene,
		);

		sphereBody.shape = sphereShape;
		sphereBody.setMassProperties({ mass: 1, restitution: 0.5 });
		newSphere.physics = sphereBody;

		const material = new flock.BABYLON.StandardMaterial(
			"sphereMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		newSphere.material = material;

		return newSphere.name;
	},
	newPlane(color, width, height, posX, posY, posZ, planeId) {
		const newPlane = flock.BABYLON.MeshBuilder.CreatePlane(
			planeId,
			{ width, height, sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE },
			flock.scene,
		);

		newPlane.blockKey = newPlane.name;
		newPlane.name = newPlane.name + newPlane.uniqueId;
		newPlane.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		const material = new flock.BABYLON.StandardMaterial(
			"planeMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		newPlane.material = material;

		return newPlane.name;
	},
	async moveByVector(modelName, x, y, z) {
		await flock.whenModelReady(modelName, (mesh) => {
			mesh.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));
			mesh.physics.disablePreStep = false;
			mesh.physics.setTargetTransform(
				mesh.position,
				mesh.rotationQuaternion,
			);

			mesh.computeWorldMatrix(true);
		});
	},
	async scaleMesh(modelName, x, y, z) {
		await flock.whenModelReady(modelName, (mesh) => {
			mesh.scaling = new flock.BABYLON.Vector3(x, y, z);

			mesh.computeWorldMatrix(true);
		});
	},
	async rotate(meshName, x, y, z) {
		await flock.whenModelReady(meshName, (mesh) => {
			if (
				mesh.physics.getMotionType() !==
				flock.BABYLON.PhysicsMotionType.DYNAMIC
			) {
				mesh.physics.setMotionType(
					flock.BABYLON.PhysicsMotionType.ANIMATED,
				);
			}

			const incrementalRotation =
				flock.BABYLON.Quaternion.RotationYawPitchRoll(
					flock.BABYLON.Tools.ToRadians(y),
					flock.BABYLON.Tools.ToRadians(x),
					flock.BABYLON.Tools.ToRadians(z),
				);
			mesh.rotationQuaternion
				.multiplyInPlace(incrementalRotation)
				.normalize();
			mesh.physics.disablePreStep = false;
			mesh.physics.setTargetTransform(
				mesh.absolutePosition,
				mesh.rotationQuaternion,
			);

			mesh.computeWorldMatrix(true);
		});
	},
	async glideTo(meshName, x, y, z, duration) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(meshName, async function (mesh) {
				if (mesh) {
					const startPosition = mesh.position.clone();
					const endPosition = new flock.BABYLON.Vector3(x, y, z);
					const fps = 30;
					const frames = 30 * (duration / 1000);

					if (mesh.glide) {
						mesh.glide.stop();
					}

					mesh.physics.disablePreStep = false;

					mesh.glide =
						flock.BABYLON.Animation.CreateAndStartAnimation(
							"anim",
							mesh,
							"position",
							fps,
							100,
							startPosition,
							endPosition,
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
						);

					mesh.glide.onAnimationEndObservable.add(() => {
						mesh.physics.disablePreStep = true;
						mesh.glide = null;
						resolve();
					});
				} else {
					resolve();
				}
			});
		});
	},
	async show(modelName) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(modelName, async function (mesh) {
				if (mesh) {
					mesh.setEnabled(true);
					flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);
					resolve();
				} else {
					console.log("Model not loaded:", modelName);
					resolve();
				}
			});
		});
	},
	async hide(modelName) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(modelName, async function (mesh) {
				if (mesh) {
					mesh.setEnabled(false);
					flock.hk._hknp.HP_World_RemoveBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
					);
					resolve();
				} else {
					console.log("Mesh not loaded:", modelName);
					resolve();
				}
			});
		});
	},
	up(modelName, upForce = 10) {
		const mesh = flock.scene.getMeshByName(modelName);
		if (mesh) {
			mesh.physics.applyImpulse(
				new flock.BABYLON.Vector3(0, upForce, 0),
				mesh.getAbsolutePosition(),
			);
		} else {
			console.log("Model not loaded (up):", modelName);
		}
	},
	isTouchingSurface(modelName) {
		const mesh = flock.scene.getMeshByName(modelName);
		if (mesh) {
			return flock.checkIfOnSurface(mesh);
		} else {
			console.log("Model not loaded (isTouchingSurface):", modelName);
			return false;
		}
	},
	checkIfOnSurface(mesh) {
		mesh.computeWorldMatrix(true);
		const boundingInfo = mesh.getBoundingInfo();

		const minY = boundingInfo.boundingBox.minimumWorld.y;
		const rayOrigin = new flock.BABYLON.Vector3(
			boundingInfo.boundingBox.centerWorld.x,
			minY + 0.01,
			boundingInfo.boundingBox.centerWorld.z,
		);

		const ray = new flock.BABYLON.Ray(
			rayOrigin,
			new flock.BABYLON.Vector3(0, -1, 0),
			2,
		);

		mesh.isPickable = false;
		const hit = flock.scene.pickWithRay(ray);
		mesh.isPickable = true;

		return hit.hit && hit.pickedMesh !== null && hit.distance <= 0.02;
	},
	keyPressed(key) {
		if (key === "ANY") {
			return flock.canvas.pressedKeys.size > 0;
		} else if (key === "NONE") {
			return flock.canvas.pressedKeys.size === 0;
		} else {
			return flock.canvas.pressedKeys.has(key);
		}
	},
	seededRandom(from, to, seed) {
		const x = Math.sin(seed) * 10000;
		const random = x - Math.floor(x);
		const result = Math.floor(random * (to - from + 1)) + from;
		return result;
	},
	randomColour() {
		const letters = "0123456789ABCDEF";
		let colour = "#";
		for (let i = 0; i < 6; i++) {
			colour += letters[Math.floor(Math.random() * 16)];
		}
		return colour;
	},
	rgbToHex(rgb) {
		const result = rgb.match(/\d+/g).map(function (x) {
			const hex = parseInt(x).toString(16);
			return hex.length === 1 ? "0" + hex : hex;
		});
		return "#" + result.join("");
	},
	getColorFromString(colourString) {
		if (/^#([0-9A-F]{3}){1,2}$/i.test(colourString)) {
			return colourString;
		}

		try {
			const colorDiv = document.createElement("div");
			colorDiv.style.color = colourString;
			document.body.appendChild(colorDiv);
			const computedColor = getComputedStyle(colorDiv).color;
			document.body.removeChild(colorDiv);
			return flock.rgbToHex(computedColor);
		} catch (e) {
			return "#000000";
		}
	},
	async changeColour(modelName, color) {
		await flock.whenModelReady(modelName, (mesh) => {
			let materialFound = false;

			function applyColorToMaterial(part, color) {

				if (part.material) {

					// Check if part.material.diffuseColor exists and set it
					if (part.material.diffuseColor !== undefined) {				
						part.material.diffuseColor = flock.BABYLON.Color3.FromHexString(color);
					} 
					else {
						// Handle materials without diffuseColor
						part.material.albedoColor = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color)).toLinearSpace();
						part.material.emissiveColor = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color)).toLinearSpace();
						part.material.emissiveIntensity = 0.1;
					}
				} 

				part.getChildMeshes().forEach((child) => {
					applyColorToMaterial(child, color);
				});
			}

			// Start applying colour to the main mesh and its children
			applyColorToMaterial(mesh, color);

			// If no material was found on the main mesh or any child, create a new one
			if (!materialFound) {
				const material = new flock.BABYLON.StandardMaterial("meshMaterial", flock.scene);
				material.diffuseColor = flock.BABYLON.Color3.FromHexString(color);
				mesh.material = material;
			}
		});
	},
	moveForward(modelName, speed) {
		const model = flock.scene.getMeshByName(modelName);
		if (!model || speed === 0) return;

		const forwardSpeed = speed;
		const cameraForward = flock.scene.activeCamera
			.getForwardRay()
			.direction.normalize();
		const moveDirection = cameraForward.scale(forwardSpeed);
		const currentVelocity = model.physics.getLinearVelocity();

		model.physics.setLinearVelocity(
			new flock.BABYLON.Vector3(
				moveDirection.x,
				currentVelocity.y,
				moveDirection.z,
			),
		);

		const facingDirection =
			speed >= 0
				? new flock.BABYLON.Vector3(
						-cameraForward.x,
						0,
						-cameraForward.z,
					).normalize()
				: new flock.BABYLON.Vector3(
						cameraForward.x,
						0,
						cameraForward.z,
					).normalize();
		const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
			facingDirection,
			flock.BABYLON.Vector3.Up(),
		);
		const currentRotation = model.rotationQuaternion;
		const deltaRotation = targetRotation.multiply(
			currentRotation.conjugate(),
		);
		const deltaEuler = deltaRotation.toEulerAngles();
		model.physics.setAngularVelocity(
			new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
		);
		model.rotationQuaternion.x = 0;
		model.rotationQuaternion.z = 0;
		model.rotationQuaternion.normalize();
	},
	async attachCamera(modelName) {
		flock.whenModelReady(modelName, function (mesh) {
			if (mesh) {
				flock.scene.onAfterPhysicsObservable.add(() => {
					const currentVelocity = mesh.physics.getLinearVelocity();
					const newVelocity = new flock.BABYLON.Vector3(
						0,
						currentVelocity.y,
						0,
					);
					mesh.physics.setLinearVelocity(newVelocity);
					mesh.physics.setAngularVelocity(
						flock.BABYLON.Vector3.Zero(),
					);

					const currentRotationQuaternion = mesh.rotationQuaternion;
					const currentEulerRotation =
						currentRotationQuaternion.toEulerAngles();
					const newRotationQuaternion =
						flock.BABYLON.Quaternion.RotationYawPitchRoll(
							currentEulerRotation.y,
							0,
							0,
						);
					mesh.rotationQuaternion.copyFrom(newRotationQuaternion);
				});

				const camera = new flock.BABYLON.ArcRotateCamera(
					"camera",
					Math.PI / 2,
					Math.PI / 4,
					10,
					mesh.position,
					flock.scene,
				);
				camera.checkCollisions = true;
				camera.lowerBetaLimit = Math.PI / 2.5;
				camera.upperBetaLimit = Math.PI / 2;
				camera.lowerRadiusLimit = 2;
				camera.upperRadiusLimit = 7;
				camera.angularSensibilityX = 2000;
				camera.angularSensibilityY = 2000;
				camera.setTarget(mesh.position);
				camera.attachControl(flock.canvas, true);
				flock.scene.activeCamera = camera;
			} else {
				console.log("Model not loaded:", modelName);
			}
		});
	},
	async setPhysics(modelName, physicsType) {
		await flock.whenModelReady(modelName, (mesh) => {
			switch (physicsType) {
				case "STATIC":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.STATIC,
					);
					flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);
					mesh.physics.disablePreStep = true;
					break;
				case "DYNAMIC":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.DYNAMIC,
					);
					flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);
					mesh.physics.disablePreStep = false;
					break;
				case "ANIMATED":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
					flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);
					mesh.physics.disablePreStep = false;
					break;
				case "NONE":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.STATIC,
					);
					flock.hk._hknp.HP_World_RemoveBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
					);
					mesh.physics.disablePreStep = true;
					break;
				default:
					console.error(
						"Invalid physics type provided:",
						physicsType,
					);
					break;
			}
		});
	},
	checkMeshesTouching(mesh1VarName, mesh2VarName) {
		const mesh1 = flock.scene.getMeshByName(mesh1VarName);
		const mesh2 = flock.scene.getMeshByName(mesh2VarName);
		if (mesh1 && mesh2 && mesh2.isEnabled()) {
			return mesh1.intersectsMesh(mesh2, false);
		}
		return false;
	},
	async say(
		meshName,
		text,
		duration,
		textColor,
		backgroundColor,
		alpha,
		size,
		mode,
	) {
		await flock.whenModelReady(meshName, async function (mesh) {
			return new Promise((resolve, reject) => {
				if (mesh) {
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

					let plane = mesh
						.getDescendants()
						.find((child) => child.name === "textPlane");
					let advancedTexture;
					if (!plane) {
						plane = flock.BABYLON.MeshBuilder.CreatePlane(
							"textPlane",
							{ width: 1.5, height: 1.5 },
							flock.scene,
						);
						plane.name = "textPlane";
						plane.parent = targetMesh;
						plane.alpha = 1;
						plane.checkCollisions = false;
						plane.isPickable = false;
						advancedTexture =
							flock.GUI.AdvancedDynamicTexture.CreateForMesh(
								plane,
							);
						plane.advancedTexture = advancedTexture;

						const boundingInfo = targetMesh.getBoundingInfo();
						plane.position.y =
							boundingInfo.boundingBox.maximum.y + 0.85;
						plane.billboardMode =
							flock.BABYLON.Mesh.BILLBOARDMODE_ALL;

						const stackPanel = new flock.GUI.StackPanel();
						stackPanel.name = "stackPanel";
						stackPanel.horizontalAlignment =
							flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
						stackPanel.verticalAlignment =
							flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
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

					if (mode === "REPLACE") {
						stackPanel.clearControls();
					}

					if (text) {
						const bg = new flock.GUI.Rectangle("textBackground");
						bg.background = flock.hexToRgba(backgroundColor, alpha);
						bg.adaptWidthToChildren = true;
						bg.adaptHeightToChildren = true;
						bg.cornerRadius = 30;
						bg.thickness = 0;
						bg.resizeToFit = true;
						bg.forceResizeWidth = true;
						stackPanel.addControl(bg);

						const textBlock = new flock.GUI.TextBlock();
						textBlock.text = text;
						textBlock.color = textColor;
						textBlock.fontSize = size * 10;
						textBlock.alpha = 1;
						textBlock.textWrapping =
							flock.GUI.TextWrapping.WordWrap;
						textBlock.resizeToFit = true;
						textBlock.forceResizeWidth = true;
						textBlock.paddingLeft = 50;
						textBlock.paddingRight = 50;
						textBlock.paddingTop = 20;
						textBlock.paddingBottom = 20;
						textBlock.textVerticalAlignment =
							flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
						textBlock.textHorizontalAlignment =
							flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
						bg.addControl(textBlock);

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
	},
	hexToRgba(hex, alpha) {
		hex = hex.replace(/^#/, "");
		let r = parseInt(hex.substring(0, 2), 16);
		let g = parseInt(hex.substring(2, 4), 16);
		let b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	},
	async onTrigger(modelName, trigger, doCode) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(modelName, async function (mesh) {
				if (mesh) {
					if (!mesh.actionManager) {
						mesh.actionManager = new flock.BABYLON.ActionManager(
							flock.scene,
						);
					}
					mesh.isPickable = true;

					if (trigger === "OnRightOrLongPressTrigger") {
						mesh.actionManager.registerAction(
							new flock.BABYLON.ExecuteCodeAction(
								flock.BABYLON.ActionManager.OnRightPickTrigger,
								async function () {
									await doCode();
								},
							),
						);
						mesh.actionManager.registerAction(
							new flock.BABYLON.ExecuteCodeAction(
								flock.BABYLON.ActionManager.OnLongPressTrigger,
								async function () {
									await doCode();
								},
							),
						);
					} else {
						mesh.actionManager.registerAction(
							new flock.BABYLON.ExecuteCodeAction(
								flock.BABYLON.ActionManager[trigger],
								async function () {
									await doCode();
								},
							),
						);
					}
					resolve();
				} else {
					console.log("Model not loaded:", modelName);
					resolve();
				}
			});
		});
	},
	async onIntersect(modelName, otherModelName, trigger, doCode) {
		return new Promise(async (resolve) => {
			// Load the first model
			await flock.whenModelReady(modelName, async function (mesh) {
				if (!mesh) {
					console.error("Model not loaded:", modelName);
					resolve();
					return;
				}

				// Load the second model
				await flock.whenModelReady(
					otherModelName,
					async function (otherMesh) {
						if (!otherMesh) {
							console.error("Model not loaded:", otherModelName);
							resolve();
							return;
						}

						// Initialize actionManager if not present
						if (!mesh.actionManager) {
							mesh.actionManager =
								new flock.BABYLON.ActionManager(flock.scene);
						}
						mesh.isPickable = true;

						// Register the ExecuteCodeAction for intersection
						const action = new flock.BABYLON.ExecuteCodeAction(
							{
								trigger: flock.BABYLON.ActionManager[trigger],
								parameter: {
									mesh: otherMesh,
									usePreciseIntersection: true,
								},
							},
							async function () {
								await doCode(); // Execute the provided callback function
							},
						);
						mesh.actionManager.registerAction(action); // Register the ExecuteCodeAction

						resolve();
					},
				);
			});
		});
	},
	onEvent(eventName, handler) {
		document.addEventListener(eventName, handler);
		if (!flock.scene.eventListeners) {
			flock.scene.eventListeners = [];
		}
		flock.scene.eventListeners.push({ event: eventName, handler });
	},
	broadcastEvent(eventName) {
		document.dispatchEvent(new CustomEvent(eventName));
	},
	whenKeyPressed(key, callback) {
		flock.scene.onKeyboardObservable.add((kbInfo) => {
			if (
				kbInfo.type === flock.BABYLON.KeyboardEventTypes.KEYDOWN &&
				kbInfo.event.key === key
			) {
				callback();
			}
		});
	},
	async forever(action) {
		let isDisposed = false;
		let isActionRunning = false;

		// Function to run the action
		const runAction = async () => {
			if (isDisposed) {
				//console.log("Scene is disposed. Exiting action.");
				return; // Exit if the scene is disposed
			}

			if (isActionRunning) {
				return; // Exit if the action is already running
			}

			isActionRunning = true;

			try {
				if (isDisposed) {
					return;
				}
				await action();
			} catch (error) {
				console.log("Error while running action:", error);
			} finally {
				isActionRunning = false;
				if (!isDisposed) {
					flock.scene.onBeforeRenderObservable.addOnce(runAction);
				}
			}
		};

		flock.scene.onBeforeRenderObservable.addOnce(runAction);

		// Handle scene disposal
		const disposeHandler = () => {
			if (isDisposed) {
				console.log("Dispose handler already triggered.");
				return;
			}

			isDisposed = true;
			flock.scene.onBeforeRenderObservable.clear(); // Clear the observable
		};

		flock.scene.onDisposeObservable.add(disposeHandler);
	},
	playSoundAsync(scene, soundName) {
		return new Promise((resolve, reject) => {
			// Load and play the sound
			const sound = new flock.BABYLON.Sound(
				soundName,
				`sounds/${soundName}`,
				scene,
				null,
				{
					autoplay: true,
				},
			);

			// Register an observer to the onEndedObservable
			sound.onEndedObservable.add(() => {
				//console.log(`${soundName} finished playing`);
				resolve();
			});
		});
	},
};
