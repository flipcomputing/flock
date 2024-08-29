// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from "@babylonjs/havok";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import { FlowGraphLog10Block } from "babylonjs";

// Helper functions to make flock.BABYLON js easier to use in Flock
console.log("Flock helpers loading");

export const flock = {
	console: console,
	engine: null,
	engineReady: false,
	alert: alert,
	BABYLON: BABYLON,
	scene: null,
	highlighter: null,
	hk: null,
	havokInstance: null,
	GUI: null,
	canvas: null,
	controlsTexture: null,
	canvas: {
		pressedKeys: null,
	},
	start(){

		console.log("Creating scene");

		flock.scene = flock.createScene();

		console.log("Scene created");
	},
	runCode(code){
		const sandboxedFunction = new Function(
			"flock",
			`
			"use strict";

			const {
			initialize,
			createEngine,
			createScene,
				playAnimation,
				switchAnimation,
				highlight,
				newCharacter,
				newObject,
				newModel,
				newBox,
				newSphere,
				newCylinder,
				newCapsule,
				newPlane,
				newWall,
				parentChild,
				removeParent,
				createGround,
				createMap,
				createCustomMap,
				setSky,
				buttonControls,
				cameraControl,
				applyForce,
				moveByVector,
				glideTo,
				rotate,
				lookAt,
				moveTo,
				rotateTo,
				positionAt,
				distanceTo,
				wait,
				show,
				hide,
				clearEffects,
				tint,
				setAlpha,
				setFog,
				keyPressed,
				isTouchingSurface,
				seededRandom,
				randomColour,
				scaleMesh,
				changeColour,
				changeMaterial,
				moveForward,
				attachCamera,
				canvasControls,
				setPhysics,
				checkMeshesTouching,
				say,
				onTrigger,
				onEvent,
				broadcastEvent,
				Mesh,
				forever,
				whenKeyPressed,
				whenKeyReleased,
				printText,
				onIntersect,
				getProperty,
			} = flock;


			// The code should be executed within the function context
			return function() {
				${code}
			};
		`,
		)(flock);

		// Execute the sandboxed function
		sandboxedFunction();
	},
	async initialize() {
		flock.BABYLON = BABYLON;
		flock.GUI = BABYLON_GUI;
		flock.canvas = document.getElementById("renderCanvas");
		flock.scene = null;
		flock.document = document;
		flock.havokInstance = null;
		flock.engineReady = false;
		let gizmoManager = null;
		const gridKeyPressObservable = new flock.BABYLON.Observable();
		const gridKeyReleaseObservable = new flock.BABYLON.Observable();
		flock.gridKeyPressObservable = gridKeyPressObservable;
		flock.gridKeyReleaseObservable = gridKeyReleaseObservable;
		flock.canvas.pressedButtons = new Set();
		flock.canvas.pressedKeys = new Set();
		const displayScale = (window.devicePixelRatio || 1) * 0.75; // Get the device pixel ratio, default to 1 if not available
		flock.displayScale = displayScale;
		flock.BABYLON.Database.IDBStorageEnabled = true;
		flock.BABYLON.Engine.CollisionsEpsilon = 0.00005;
		flock.havokInstance = await HavokPhysics();

		flock.engineReady = true;
		flock.scene = flock.createScene();
		flock.scene.eventListeners = [];
		flock.canvas.addEventListener("keydown", function (event) {
			flock.canvas.currentKeyPressed = event.key;
			flock.canvas.pressedKeys.add(event.key);
		});

		flock.canvas.addEventListener("keyup", function (event) {
			flock.canvas.pressedKeys.delete(event.key);
		});
	},
	createEngine() {
		if (flock.engine) {
			flock.engine.dispose();
			flock.engine = null;
		}
		flock.engine = new flock.BABYLON.Engine(flock.canvas, true, { stencil: true });
		flock.engine.enableOfflineSupport = false;
		flock.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
	},
	createScene() {
		if (flock.scene) {
			flock.removeEventListeners();
			flock.gridKeyPressObservable.clear();
			flock.gridKeyReleaseObservable.clear();
			flock.scene.dispose();
			flock.scene = null;
			flock.controlsTexture.dispose();
			flock.controlsTexture = null;
			flock.hk.dispose();
			flock.hk = null;
		}

		if (!flock.engine) {
			flock.createEngine();
		} else {
			flock.engine.stopRenderLoop();
		}

		flock.scene = new flock.BABYLON.Scene(flock.engine);

		flock.engine.runRenderLoop(function () {
			flock.scene.render();
		});

		flock.scene.eventListeners = [];

		flock.hk = new flock.BABYLON.HavokPlugin(true, flock.havokInstance);
		flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), flock.hk);
		flock.highlighter = new flock.BABYLON.HighlightLayer("highlighter", flock.scene);	

		/*
		flock.BABYLON.Effect.ShadersStore["customVertexShader"] = `
			precision highp float;

			attribute vec3 position;
			attribute vec3 normal;
			attribute vec2 uv;

			uniform mat4 worldViewProjection;
			uniform mat4 world; // Add the world matrix

			varying vec3 vWorldPosition; // Pass the world position
			varying vec2 vUV;

			void main() {
				vec4 worldPosition = world * vec4(position, 1.0);
				vWorldPosition = worldPosition.xyz; // Store the world position
				vUV = uv;

				gl_Position = worldViewProjection * vec4(position, 1.0);
			}
		`;
		BABYLON.Effect.ShadersStore["customFragmentShader"] = `
			precision highp float;

			varying vec3 vWorldPosition; // Receive the world position
			varying vec2 vUV;

			void main() {
				vec3 color;

				// Determine color based on the y-coordinate of the world position
				if (vWorldPosition.y > 10.0) {
					color = vec3(1.0, 1.0, 1.0); // Snow
				} else if (vWorldPosition.y > 8.0) {
					color = vec3(0.5, 0.5, 0.5); // Grey rocks
				} else if (vWorldPosition.y > 0.0) {
					color = vec3(0.13, 0.55, 0.13); // Grass
				} else if (vWorldPosition.y > -1.0) {
					color = vec3(0.55, 0.27, 0.07); // Brown rocks
				} else {
					color = vec3(0.96, 0.87, 0.20); // Beach
				}

				gl_FragColor = vec4(color, 1.0);
			}
		`;
	*/
		/*
		  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("heightmap", './textures/simple_height_map.png', {
			width: 100,
			height: 100,
			minHeight: -5,
			maxHeight: 5,
			subdivisions: 25,
			onReady: (groundMesh) => {
			   const groundAggregate = new BABYLON.PhysicsAggregate(groundMesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, flock.scene);
			}
		  }, flock.scene);*/

		const camera = new BABYLON.FreeCamera(
			"camera",
			new BABYLON.Vector3(0, 3, -10),
			flock.scene,
		);
		camera.minZ = 1;
		camera.setTarget(BABYLON.Vector3.Zero());
		camera.rotation.x = BABYLON.Tools.ToRadians(0);
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		const hemisphericLight = new BABYLON.HemisphericLight(
			"hemisphericLight",
			new BABYLON.Vector3(0, 1, 0), // Direction: Upwards, simulating light from the sky
			flock.scene
		);
		hemisphericLight.intensity = 1.0; // Adjust the intensity to control how bright the scene is
		hemisphericLight.diffuse = new BABYLON.Color3(1, 1, 1); // White diffuse light
		hemisphericLight.groundColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Optional ground color for additional effects
		flock.scene.collisionsEnabled = true;

		flock.controlsTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
		flock.createArrowControls("white");
		flock.createButtonControls("white");

		const advancedTexture =
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

		// Create a stack panel to hold the text lines
		const stackPanel = new flock.GUI.StackPanel();
		stackPanel.isVertical = true;
		stackPanel.width = "100%";
		stackPanel.height = "100%";
		stackPanel.left = "0px";
		stackPanel.top = "0px";
		advancedTexture.addControl(stackPanel);

		// Function to print text with scrolling
		const textLines = []; // Array to keep track of text lines
		flock.printText = function (text, duration, color) {
			if (text === "" || !flock.scene) {
				// Ensure scene is valid
				return; // Return early if scene is invalid or text is empty
			}

			try {
				flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

				// Create a rectangle background
				const bg = new flock.GUI.Rectangle("textBackground");
				bg.background = "rgba(255, 255, 255, 0.5)";
				bg.adaptWidthToChildren = true; // Adjust width based on child elements
				bg.adaptHeightToChildren = true; // Adjust height based on child elements
				bg.cornerRadius = 2;
				bg.thickness = 0; // Remove border
				bg.horizontalAlignment =
					flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
				bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
				bg.left = "5px"; // Position with some margin from left
				bg.top = "5px"; // Position with some margin from top

				// Create a text block
				const textBlock = new flock.GUI.TextBlock("textBlock", text);
				textBlock.color = color;
				textBlock.fontSize = "20";
				textBlock.fontFamily = "Asap";
				textBlock.height = "25px";
				textBlock.paddingLeft = "10px";
				textBlock.paddingRight = "10px";
				textBlock.paddingTop = "2px";
				textBlock.paddingBottom = "2px";
				textBlock.textVerticalAlignment =
					flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align text to top
				textBlock.textHorizontalAlignment =
					flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align text to left
				textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
				textBlock.resizeToFit = true;
				textBlock.forceResizeWidth = true;

				// Add the text block to the rectangle
				bg.addControl(textBlock);

				// Add the container to the stack panel
				stackPanel.addControl(bg);
				textLines.push(bg);

				// Remove the text after the specified duration
				setTimeout(() => {
					if (flock.scene) {
						// Ensure scene is still valid before removing
						stackPanel.removeControl(bg);
						textLines.splice(textLines.indexOf(bg), 1);
					}
				}, duration * 1000);
			} catch (error) {
				//console.warn("Unable to print text:", error);
			}
		};

		return flock.scene;
	},
	removeEventListeners() {
		flock.scene.eventListeners.forEach(({ event, handler }) => {
			document.removeEventListener(event, handler);
		});
		flock.scene.eventListeners.length = 0; // Clear the array
	},
	async *modelReadyGenerator(
		meshId,
		maxAttempts = 10,
		initialInterval = 100, // Start with a shorter interval
		maxInterval = 1000, // Cap the interval at a maximum value
	) {
		let attempt = 1;
		let interval = initialInterval;

		while (attempt <= maxAttempts) {
			if (flock.scene) {
				const mesh = flock.scene.getMeshByName(meshId);
				if (mesh) {
					yield mesh;
					return;
				}
			}

			await new Promise((resolve) => setTimeout(resolve, interval));

			// Gradually increase the interval for the next attempt
			interval = Math.min(interval * 2, maxInterval);
			attempt++;
		}

		// Log a warning if meshId is not defined
		console.warn(
			`Mesh with ID '${meshId}' not found after ${maxAttempts} attempts.`,
		);
	},
	whenModelReady(meshId, callback) {
		if (flock.scene) {
			const mesh = flock.scene.getMeshByName(meshId);
			if (mesh) {
				// Mesh is available immediately, invoke the callback synchronously
				callback(mesh);
				return; // Return immediately, no Promise needed
			}
		}

		// If the mesh is not immediately available, fall back to the generator and return a Promise
		return (async () => {
			const generator = flock.modelReadyGenerator(meshId);

			for await (const mesh of generator) {
				await callback(mesh);
			}
		})();
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
	switchAnimation(modelName, animationName) {
		return flock.whenModelReady(modelName, (mesh) => {
			flock.switchToAnimation(
				flock.scene,
				mesh,
				animationName,
				true,
				false,
			);
		});
	},
	highlight(modelName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
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
	parentChild(parentModelName, childModelName, offsetX = 0, offsetY = 0, offsetZ = 0) {
		return flock.whenModelReady(parentModelName, (parentMesh) => {
			flock.whenModelReady(childModelName, (childMesh) => {
				// Set the parent-child relationship
				childMesh.parent = parentMesh;

				// Apply the offset to the child's position relative to the parent
				childMesh.position.set(offsetX, offsetY, offsetZ);
			});
		});
	},
	removeParent(childModelName) {
		return flock.whenModelReady(childModelName, (childMesh) => {
			// Calculate the world position before removing the parent
			const worldPosition = childMesh.getAbsolutePosition();

			// Remove the parent-child relationship
			childMesh.parent = null;

			// Set the child mesh's position to its world position
			childMesh.position = worldPosition;
		});
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
			{ mass: 0, friction: 0.5 },
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
	createMap(image, color) {
		console.log("Creating map from image", image);
		const ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
			"heightmap",
			"./textures/" + image,
			{
				width: 100,
				height: 100,
				minHeight: 0,
				maxHeight: 10,
				subdivisions: 64,
				onReady: (groundMesh) => {
					const heightMapGroundShape =
						new flock.BABYLON.PhysicsShapeMesh(
							ground, // mesh from which to calculate the collisions
							flock.scene, // scene of the shape
						);
					const heightMapGroundBody = new flock.BABYLON.PhysicsBody(
						ground,
						flock.BABYLON.PhysicsMotionType.STATIC,
						false,
						flock.scene,
					);
					heightMapGroundShape.material = {
						friction: 0.3,
						restitution: 0.3,
					};
					heightMapGroundBody.shape = heightMapGroundShape;
					heightMapGroundBody.setMassProperties({ mass: 0 });
				},
			},
			flock.scene,
		);

		/*
		const groundMaterial = new flock.BABYLON.StandardMaterial(
			"groundMaterial",
			flock.scene,
		);

		groundMaterial.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		ground.material = groundMaterial;*/

		const texture = new flock.BABYLON.Texture(
			`./textures/rough.png`,
			flock.scene,
		);

		const material = new flock.BABYLON.StandardMaterial(
			"ground",
			flock.scene,
		);

		texture.uScale = 10;
		texture.vScale = 10;

		material.diffuseTexture = texture;
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(color);

		material.name = "ground";
		ground.material = material;

		/*
		let minHeight, maxHeight; // Define minHeight and maxHeight outside

		function loadImage(url, callback) {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = function () {
				callback(img);
			};
			img.src = url;
		}

		function extractHeightsFromImageData(imageData) {
			const heights = [];
			for (let i = 0; i < imageData.data.length; i += 4) {
				const r = imageData.data[i];
				const g = imageData.data[i + 1];
				const b = imageData.data[i + 2];
				const greyscale = (r + g + b) / 3;
				heights.push(greyscale / 255); // Normalize to [0, 1]
			}
			return heights;
		}

		function calculateHeightRange(heights) {
			let min = Infinity;
			let max = -Infinity;
			for (const height of heights) {
				if (height < min) min = height;
				if (height > max) max = height;
			}
			return { min, max };
		}

		// Assuming 'image' is already defined somewhere in your code with the image name
		loadImage("./textures/" + image, function (img) {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0, img.width, img.height);
			const imageData = ctx.getImageData(0, 0, img.width, img.height);
			const heights = extractHeightsFromImageData(imageData);
			const heightRange = calculateHeightRange(heights);
			minHeight = heightRange.min;
			maxHeight = heightRange.max;
			console.log("Min Height:", minHeight);
			console.log("Max Height:", maxHeight);

			const desiredMinHeight = -2;
			const desiredMaxHeight = 12;

			// Normalize the calculated heights and map them to the desired range
			const scale =
				(desiredMaxHeight - desiredMinHeight) / (maxHeight - minHeight);
			const offset = desiredMinHeight - minHeight * scale;

			const ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
				"heightmap",
				"./textures/" + image,
				{
					width: 100,
					height: 100,
					minHeight: minHeight * scale + offset,
					maxHeight: maxHeight * scale + offset,
					subdivisions: 64,
					onReady: (groundMesh) => {
						const heightMapGroundShape =
							new flock.BABYLON.PhysicsShapeMesh(
								ground, // mesh from which to calculate the collisions
								flock.scene, // scene of the shape
							);
						const heightMapGroundBody =
							new flock.BABYLON.PhysicsBody(
								ground,
								flock.BABYLON.PhysicsMotionType.STATIC,
								false,
								flock.scene,
							);
						heightMapGroundShape.material = {
							friction: 0.3,
							restitution: 0.3,
						};
						heightMapGroundBody.shape = heightMapGroundShape;
						heightMapGroundBody.setMassProperties({ mass: 0 });
					},
				},
				flock.scene,
			);

			// Load shaders directly within the JavaScript file
			const shaderMaterial = new flock.BABYLON.ShaderMaterial(
				"customShader",
				flock.scene,
				"custom",
				{
					attributes: ["position", "normal", "uv"],
					uniforms: ["worldViewProjection", "world"], // Include the world matrix
				},
			);

			ground.material = shaderMaterial;
		});*/
	},
	createCustomMap(colors) {
		console.log("Creating map", colors);
	},
	setSky(color) {
		flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
	},
	wait(duration) {
		return new Promise((resolve) => setTimeout(resolve, duration));
	},
	clearEffects(modelName) {
		return flock.whenModelReady(modelName, (mesh) => {
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
	setAlpha(modelName, alphaValue) {
		return flock.whenModelReady(modelName, (mesh) => {
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
	newCylinder(
		color,
		height,
		diameterTop,
		diameterBottom,
		posX,
		posY,
		posZ,
		cylinderId,
		sides = 24, // Default number of sides
	) {
		const newCylinder = flock.BABYLON.MeshBuilder.CreateCylinder(
			cylinderId,
			{
				height: height,
				diameterTop: diameterTop,
				diameterBottom: diameterBottom,
				tessellation: sides,
			},
			flock.scene,
		);
		newCylinder.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		newCylinder.blockKey = newCylinder.name;
		newCylinder.name = newCylinder.name + newCylinder.uniqueId;

		const cylinderBody = new flock.BABYLON.PhysicsBody(
			newCylinder,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const startPoint = new BABYLON.Vector3(0, -height / 2, 0);
		const endPoint = new BABYLON.Vector3(0, height / 2, 0);

		// Create the physics shape for the cylinder
		const cylinderShape = new BABYLON.PhysicsShapeCylinder(
			startPoint, // starting point of the cylinder segment
			endPoint, // ending point of the cylinder segment
			diameterBottom / 2, // radius of the cylinder (assuming diameterBottom is the larger diameter)
			flock.scene, // scene of the shape
		);

		cylinderBody.shape = cylinderShape;
		cylinderBody.setMassProperties({ mass: 1, restitution: 0.1 });
		newCylinder.physics = cylinderBody;

		const material = new flock.BABYLON.StandardMaterial(
			"cylinderMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		newCylinder.material = material;

		return newCylinder.name;
	},
	newCapsule(
		color,
		radius, // This is the diameter of the spheres at both ends of the capsule
		height, // This is the height between the spheres
		posX,
		posY,
		posZ,
		capsuleId,
	) {
		const newCapsule = flock.BABYLON.MeshBuilder.CreateCapsule(
			capsuleId,
			{
				radius: radius,
				height: height,
				tessellation: 24,
				updatable: false,
			},
			flock.scene,
		);
		newCapsule.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		newCapsule.blockKey = newCapsule.name;
		newCapsule.name = newCapsule.name + newCapsule.uniqueId;

		const capsuleBody = new flock.BABYLON.PhysicsBody(
			newCapsule,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const capsuleShape = new flock.BABYLON.PhysicsShapeCapsule(
			new flock.BABYLON.Vector3(0, 0, 0),
			radius, // Radius of the spherical ends
			height / 2, // Half the height of the cylindrical part
			flock.scene,
		);

		capsuleBody.shape = capsuleShape;
		capsuleBody.setMassProperties({ mass: 1, restitution: 0.5 });
		newCapsule.physics = capsuleBody;

		const material = new flock.BABYLON.StandardMaterial(
			"capsuleMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		newCapsule.material = material;

		return newCapsule.name;
	},
	newPlane(color, width, height, posX, posY, posZ, planeId) {
		const newPlane = flock.BABYLON.MeshBuilder.CreatePlane(
			planeId,
			{ width, height, sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE },
			flock.scene,
		);

		newPlane.metadata = newPlane.metadata || {}; //
		newPlane.metadata.shape = "plane"; // Add or update the type property
		newPlane.blockKey = newPlane.name;
		newPlane.name = newPlane.name + newPlane.uniqueId;
		newPlane.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		// Physics for the plane
		const planeBody = new flock.BABYLON.PhysicsBody(
			newPlane,
			flock.BABYLON.PhysicsMotionType.STATIC, // Planes are typically static as they represent surfaces
			false,
			flock.scene,
		);

		const planeShape = new flock.BABYLON.PhysicsShapeBox(
			new flock.BABYLON.Vector3(0, 0, 0),
			new flock.BABYLON.Quaternion(0, 0, 0, 1),
			new flock.BABYLON.Vector3(width, height, 0.001), // Width and height divided by 2, minimal depth
			flock.scene,
		);

		planeBody.shape = planeShape;
		planeBody.setMassProperties({
			mass: 0, // No mass as it is static
			restitution: 0.5,
			inertia: flock.BABYLON.Vector3.ZeroReadOnly, // No inertia as it does not move
		});

		newPlane.physics = planeBody;
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
	newWall(color, startX, startZ, endX, endZ, yPosition, wallType, wallId) {
		const wallHeight = 3; // Consistent wall height
		const wallThickness = 0.2; // Fixed thickness for all walls
		const floorThickness = 0.05; // Fixed thickness for all walls

		let width, depth, posX, posZ;

		if (wallType === "FLOOR") {
			// Floor Calculations
			width = Math.abs(endX - startX) + wallThickness; // Full span along X-axis
			depth = Math.abs(endZ - startZ) + wallThickness; // Full span along Z-axis
			posX = (parseFloat(startX) + parseFloat(endX)) / 2;
			posZ = (parseFloat(startZ) + parseFloat(endZ)) / 2;
		} else if (startX !== endX) {
			// Horizontal wall (along X-axis)
			width = Math.abs(endX - startX) + wallThickness;
			depth = wallThickness;
			posX = (parseFloat(startX) + parseFloat(endX)) / 2;
			posZ = startZ; // Z remains constant
		} else {
			// Vertical wall (along Z-axis)
			width = wallThickness;
			depth = Math.abs(endZ - startZ) + wallThickness; // Extend depth slightly
			posX = startX; // X remains constant
			posZ = (parseFloat(startZ) + parseFloat(endZ)) / 2;
		}

		// Create material once
		const material = new flock.BABYLON.StandardMaterial(
			"wallMaterial",
			flock.scene,
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);

		if (wallType === "SOLID_WALL") {
			// Create a solid wall
			const solidWall = flock.BABYLON.MeshBuilder.CreateBox(
				wallId,
				{ width, height: wallHeight, depth },
				flock.scene,
			);
			solidWall.position = new flock.BABYLON.Vector3(
				posX,
				yPosition + wallHeight / 2,
				posZ,
			);
			solidWall.material = material;
			assignPhysicsProperties(solidWall);
		} else if (wallType === "WALL_WITH_DOOR") {
			const doorHeight = 2.5;
			const doorWidth = 1.5;
			const halfDoorWidth = doorWidth / 2;

			if (width > depth) {
				// Horizontal wall with door
				// Wall section above the door
				const topWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_top",
					{ width, height: wallHeight - doorHeight, depth },
					flock.scene,
				);
				topWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight - (wallHeight - doorHeight) / 2,
					posZ,
				);
				topWall.material = material;
				assignPhysicsProperties(topWall);

				// Left part of the wall (before the door)
				const leftWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_left",
					{
						width: (width - doorWidth) / 2,
						height: doorHeight,
						depth,
					},
					flock.scene,
				);
				leftWall.position = new flock.BABYLON.Vector3(
					posX - halfDoorWidth - (width - doorWidth) / 4,
					yPosition + doorHeight / 2,
					posZ,
				);
				leftWall.material = material;
				assignPhysicsProperties(leftWall);

				// Right part of the wall (after the door)
				const rightWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_right",
					{
						width: (width - doorWidth) / 2,
						height: doorHeight,
						depth,
					},
					flock.scene,
				);
				rightWall.position = new flock.BABYLON.Vector3(
					posX + halfDoorWidth + (width - doorWidth) / 4,
					yPosition + doorHeight / 2,
					posZ,
				);
				rightWall.material = material;
				assignPhysicsProperties(rightWall);
			} else {
				// Vertical wall with door

				// Wall section above the door
				const topWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_top",
					{ width, height: wallHeight - doorHeight, depth },
					flock.scene,
				);
				topWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight - (wallHeight - doorHeight) / 2,
					posZ,
				);
				topWall.material = material;
				assignPhysicsProperties(topWall);

				// Front part of the wall (before the door)
				const frontWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_front",
					{
						width,
						height: doorHeight,
						depth: (depth - doorWidth) / 2,
					},
					flock.scene,
				);
				frontWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + doorHeight / 2,
					posZ - halfDoorWidth - (depth - doorWidth) / 4,
				);
				frontWall.material = material;
				assignPhysicsProperties(frontWall);

				// Back part of the wall (after the door)
				const backWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_back",
					{
						width,
						height: doorHeight,
						depth: (depth - doorWidth) / 2,
					},
					flock.scene,
				);
				backWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + doorHeight / 2,
					posZ + halfDoorWidth + (depth - doorWidth) / 4,
				);
				backWall.material = material;
				assignPhysicsProperties(backWall);
			}
		} else if (wallType === "WALL_WITH_WINDOW") {
			const windowHeight = 1.5;
			const windowWidth = 3;
			const halfWindowWidth = windowWidth / 2;

			if (width > depth) {
				// Horizontal wall with window

				// Wall section above the window
				const topWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_top",
					{ width, height: (wallHeight - windowHeight) / 2, depth },
					flock.scene,
				);
				topWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight - (wallHeight - windowHeight) / 4,
					posZ,
				);
				topWall.material = material;
				assignPhysicsProperties(topWall);

				// Wall section below the window
				const bottomWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_bottom",
					{ width, height: (wallHeight - windowHeight) / 2, depth },
					flock.scene,
				);
				bottomWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + (wallHeight - windowHeight) / 4,
					posZ,
				);
				bottomWall.material = material;
				assignPhysicsProperties(bottomWall);

				// Left part of the wall (before the window)
				const leftWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_left",
					{
						width: (width - windowWidth) / 2,
						height: windowHeight,
						depth,
					},
					flock.scene,
				);
				leftWall.position = new flock.BABYLON.Vector3(
					posX - halfWindowWidth - (width - windowWidth) / 4,
					yPosition + wallHeight / 2,
					posZ,
				);
				leftWall.material = material;
				assignPhysicsProperties(leftWall);

				// Right part of the wall (after the window)
				const rightWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_right",
					{
						width: (width - windowWidth) / 2,
						height: windowHeight,
						depth,
					},
					flock.scene,
				);
				rightWall.position = new flock.BABYLON.Vector3(
					posX + halfWindowWidth + (width - windowWidth) / 4,
					yPosition + wallHeight / 2,
					posZ,
				);
				rightWall.material = material;
				assignPhysicsProperties(rightWall);
			} else {
				// Vertical wall with window

				// Wall section above the window
				const topWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_top",
					{ width, height: (wallHeight - windowHeight) / 2, depth },
					flock.scene,
				);
				topWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight - (wallHeight - windowHeight) / 4,
					posZ,
				);
				topWall.material = material;
				assignPhysicsProperties(topWall);

				// Wall section below the window
				const bottomWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_bottom",
					{ width, height: (wallHeight - windowHeight) / 2, depth },
					flock.scene,
				);
				bottomWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + (wallHeight - windowHeight) / 4,
					posZ,
				);
				bottomWall.material = material;
				assignPhysicsProperties(bottomWall);

				// Front part of the wall (before the window)
				const frontWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_front",
					{
						width,
						height: windowHeight,
						depth: (depth - windowWidth) / 2,
					},
					flock.scene,
				);
				frontWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight / 2,
					posZ - halfWindowWidth - (depth - windowWidth) / 4,
				);
				frontWall.material = material;
				assignPhysicsProperties(frontWall);

				// Back part of the wall (after the window)
				const backWall = flock.BABYLON.MeshBuilder.CreateBox(
					wallId + "_back",
					{
						width,
						height: windowHeight,
						depth: (depth - windowWidth) / 2,
					},
					flock.scene,
				);
				backWall.position = new flock.BABYLON.Vector3(
					posX,
					yPosition + wallHeight / 2,
					posZ + halfWindowWidth + (depth - windowWidth) / 4,
				);
				backWall.material = material;
				assignPhysicsProperties(backWall);
			}
		} else if (wallType === "FLOOR") {
			// Create a floor or roof
			const floor = flock.BABYLON.MeshBuilder.CreateBox(
				wallId + "_floor",
				{ width, height: floorThickness, depth },
				flock.scene,
			);
			floor.position = new flock.BABYLON.Vector3(
				posX,
				yPosition + floorThickness / 2,
				posZ,
			);
			floor.material = material;
			assignPhysicsProperties(floor);
		}

		// Nested function to assign physics properties to each wall segment
		function assignPhysicsProperties(mesh) {
			// Get the bounding box's half-sizes
			const boundingBox =
				mesh.getBoundingInfo().boundingBox.extendSizeWorld;

			// Calculate the full size by doubling the extend sizes
			const fullSize = new BABYLON.Vector3(
				boundingBox.x * 2,
				boundingBox.y * 2,
				boundingBox.z * 2,
			);

			// Create a static physics body for the wall
			const body = new flock.BABYLON.PhysicsBody(
				mesh,
				flock.BABYLON.PhysicsMotionType.STATIC,
				false,
				flock.scene,
			);

			// Create a physics shape (collider) with the full dimensions
			const shape = new flock.BABYLON.PhysicsShapeBox(
				new flock.BABYLON.Vector3(0, 0, 0),
				new flock.BABYLON.Quaternion(0, 0, 0, 1),
				fullSize, // Use full size here
				flock.scene,
			);

			// Set mass properties (static objects typically have infinite mass, but this setup uses mass 1 for example purposes)
			body.setMassProperties({
				inertia: flock.BABYLON.Vector3.ZeroReadOnly,
			});
			body.shape = shape;
			body.setMassProperties({ mass: 1, restitution: 0.5 });

			// Assign the physics body to the mesh
			mesh.physics = body;
		}
	},
	moveByVector(modelName, x, y, z) {
		return flock.whenModelReady(modelName, (mesh) => {
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
	rotate(meshName, x, y, z) {
		return flock.whenModelReady(meshName, (mesh) => {
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
	lookAt(meshName1, meshName2, useY = false) {
		return flock.whenModelReady(meshName1, (mesh1) => {
			return flock.whenModelReady(meshName2, (mesh2) => {
				if (
					mesh1.physics.getMotionType() !==
					flock.BABYLON.PhysicsMotionType.DYNAMIC
				) {
					mesh1.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
				}

				let targetPosition = mesh2.absolutePosition.clone();
				if (!useY) {
					targetPosition.y = mesh1.absolutePosition.y;
				}

				mesh1.lookAt(targetPosition);

				mesh1.physics.disablePreStep = false;
				mesh1.physics.setTargetTransform(
					mesh1.absolutePosition,
					mesh1.rotationQuaternion,
				);

				mesh1.computeWorldMatrix(true);
			});
		});
	},
	moveTo(meshName1, meshName2, useY = false) {
		return flock.whenModelReady(meshName1, (mesh1) => {
			return flock.whenModelReady(meshName2, (mesh2) => {
				if (
					mesh1.physics.getMotionType() !==
					flock.BABYLON.PhysicsMotionType.DYNAMIC
				) {
					mesh1.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
				}

				const targetPosition = mesh2.absolutePosition.clone();
				if (!useY) {
					targetPosition.y = mesh1.absolutePosition.y;
				}
				mesh1.position.copyFrom(targetPosition);

				mesh1.physics.disablePreStep = false;
				mesh1.physics.setTargetTransform(
					mesh1.position,
					mesh1.rotationQuaternion,
				);

				mesh1.computeWorldMatrix(true);
			});
		});
	},
	rotateTo(meshName, x, y, z) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (
				mesh.physics.getMotionType() !==
				flock.BABYLON.PhysicsMotionType.DYNAMIC
			) {
				mesh.physics.setMotionType(
					flock.BABYLON.PhysicsMotionType.ANIMATED,
				);
			}

			// Convert the X, Y, and Z inputs from degrees to radians
			const radX = flock.BABYLON.Tools.ToRadians(x);
			const radY = flock.BABYLON.Tools.ToRadians(y);
			const radZ = flock.BABYLON.Tools.ToRadians(z);

			// Create a target rotation quaternion
			const targetRotation =
				flock.BABYLON.Quaternion.RotationYawPitchRoll(radZ, radY, radX);

			// Apply the rotation to the mesh
			mesh.rotationQuaternion = targetRotation;

			mesh.physics.disablePreStep = false;
			mesh.physics.setTargetTransform(
				mesh.position,
				mesh.rotationQuaternion,
			);

			mesh.computeWorldMatrix(true);
		});
	},
	positionAt(meshName, x, y, z, useY = true) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (
				mesh.physics.getMotionType() !==
				flock.BABYLON.PhysicsMotionType.DYNAMIC
			) {
				mesh.physics.setMotionType(
					flock.BABYLON.PhysicsMotionType.ANIMATED,
				);
			}

			let targetY = useY ? y : mesh.position.y;
			mesh.position.set(x, targetY, z);

			mesh.physics.disablePreStep = false;
			mesh.physics.setTargetTransform(
				mesh.position,
				mesh.rotationQuaternion,
			);

			mesh.computeWorldMatrix(true);
		});
	},
	distanceTo(meshName1, meshName2) {
		const mesh1 = flock.scene.getMeshByName(meshName1);
		const mesh2 = flock.scene.getMeshByName(meshName2);
		if (mesh1 && mesh2) {
			const distance = flock.BABYLON.Vector3.Distance(
				mesh1.position,
				mesh2.position,
			);
			return distance;
		} else {
			return null;
		}
	},
	getProperty(modelName, propertyName) {
		const mesh = flock.scene.getMeshByName(modelName);

		if (!mesh) return null;

		let propertyValue = null;

		mesh.computeWorldMatrix(true);

		const position = mesh.getAbsolutePosition();

		let rotation = mesh.absoluteRotationQuaternion.toEulerAngles();
		let allMeshes, materialNode, materialNodes;
		switch (propertyName) {
			case "POSITION_X":
				propertyValue = position.x.toFixed(2);
				break;
			case "POSITION_Y":
				propertyValue = position.y.toFixed(2);
				break;
			case "POSITION_Z":
				propertyValue = position.z.toFixed(2);
				break;
			case "ROTATION_X":
				propertyValue = flock.BABYLON.Tools.ToDegrees(
					rotation.x,
				).toFixed(2);
				break;
			case "ROTATION_Y":
				propertyValue = flock.BABYLON.Tools.ToDegrees(
					rotation.y,
				).toFixed(2);
				break;
			case "ROTATION_Z":
				propertyValue = flock.BABYLON.Tools.ToDegrees(
					rotation.z,
				).toFixed(2);
				break;
			case "SCALE_X":
				propertyValue = mesh.scaling.x.toFixed(2);
				break;
			case "SCALE_Y":
				propertyValue = mesh.scaling.y.toFixed(2);
				break;
			case "SCALE_Z":
				propertyValue = mesh.scaling.z.toFixed(2);
				break;
			case "VISIBLE":
				propertyValue = mesh.isVisible;
				break;
			case "ALPHA":
				allMeshes = [mesh].concat(mesh.getDescendants());
				materialNode = allMeshes.find((node) => node.material);

				if (materialNode) {
					propertyValue = materialNode.material.alpha;
				}
				break;
			case "COLOUR":
				allMeshes = [mesh].concat(mesh.getDescendants());
				materialNodes = allMeshes.filter((node) => node.material);

				// Map to get the diffuseColor or albedoColor of each material as a hex string
				const colors = materialNodes
					.map((node) => {
						if (node.material.diffuseColor) {
							return node.material.diffuseColor.toHexString();
						} else if (node.material.albedoColor) {
							return node.material.albedoColor.toHexString();
						}
						return null;
					})
					.filter((color) => color !== null);
				if (colors.length === 1) {
					propertyValue = colors[0];
				} else if (colors.length > 1) {
					propertyValue = colors.join(", ");
				}

				break;
			default:
				console.log("Property not recognized.");
		}
		return propertyValue;
	},
	createSmallButton(text, key, color) {
		const button = flock.GUI.Button.CreateSimpleButton("but", text);
		button.width = `${70 * flock.displayScale}px`; // Scale size
		button.height = `${70 * flock.displayScale}px`;
		button.color = color;
		button.background = "transparent";
		button.fontSize = `${40 * flock.displayScale}px`; // Scale font size

		button.fontFamily = "Asap";
		button.onPointerDownObservable.add(() => {
			flock.canvas.pressedButtons.add(key);
			flock.gridKeyPressObservable.notifyObservers(key);
		});

		button.onPointerUpObservable.add(() => {
			flock.canvas.pressedButtons.delete(key);
			flock.gridKeyReleaseObservable.notifyObservers(key);
		});
		return button;
	},
	createArrowControls(color) {
		// Create a grid
		const grid = new flock.GUI.Grid();
		grid.width = `${240 * flock.displayScale}px`;
		grid.height = `${160 * flock.displayScale}px`;
		grid.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		grid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		grid.addRowDefinition(1);
		grid.addRowDefinition(1);
		grid.addColumnDefinition(1);
		grid.addColumnDefinition(1);
		grid.addColumnDefinition(1);
		flock.controlsTexture.addControl(grid);

		const upButton = flock.createSmallButton("△", "w", color);
		const downButton = flock.createSmallButton("▽", "s", color);
		const leftButton = flock.createSmallButton("◁", "a", color);
		const rightButton = flock.createSmallButton("▷", "d", color);

		// Add buttons to the grid
		grid.addControl(upButton, 0, 1); // Add to row 0, column 1
		grid.addControl(leftButton, 1, 0); // Add to row 1, column 0
		grid.addControl(downButton, 1, 1); // Add to row 1, column 1
		grid.addControl(rightButton, 1, 2); // Add to row 1, column 2
	},
	createButtonControls(color) {
		// Create another grid for the buttons on the right
		const rightGrid = new flock.GUI.Grid();
		rightGrid.width = `${160 * flock.displayScale}px`; // Scale width
		rightGrid.height = `${160 * flock.displayScale}px`; // Scale height
		rightGrid.horizontalAlignment =
			flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		rightGrid.verticalAlignment =
			flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		rightGrid.addRowDefinition(1);
		rightGrid.addRowDefinition(1);
		rightGrid.addColumnDefinition(1);
		rightGrid.addColumnDefinition(1);
		flock.controlsTexture.addControl(rightGrid);

		// Create buttons for the right grid
		const button1 = flock.createSmallButton("■", "q", color);
		const button2 = flock.createSmallButton("✿", "e", color);
		const button3 = flock.createSmallButton("✱", "f", color);
		const button4 = flock.createSmallButton("∞", " ", color);

		// Add buttons to the right grid in a 2x2 layout
		rightGrid.addControl(button1, 0, 0); // Row 0, Column 0
		rightGrid.addControl(button2, 0, 1); // Row 0, Column 1
		rightGrid.addControl(button3, 1, 0); // Row 1, Column 0
		rightGrid.addControl(button4, 1, 1); // Row 1, Column 1
	},
	buttonControls(control, enabled, color) {
		if (flock.controlsTexture) {
			flock.controlsTexture.dispose();
		}

		if (enabled) {
			flock.controlsTexture =
				flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

			if (control == "ARROWS" || control == "BOTH")
				flock.createArrowControls(color);
			if (control == "ACTIONS" || control == "BOTH")
				flock.createButtonControls(color);
		}
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
							frames,
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
	addBeforePhysicsObservable(scene, ...meshes) {
		const beforePhysicsObserver = scene.onBeforePhysicsObservable.add(
			() => {
				meshes.forEach((mesh) => {
					mesh.computeWorldMatrix(true);
				});
			},
		);

		// Log if the observable is successfully added
		if (beforePhysicsObserver) {
			console.log(
				"Before physics observable added successfully for meshes:",
				meshes,
			);
		} else {
			console.log("Failed to add before physics observable");
		}
	},
	show(modelName) {
		return flock.whenModelReady(modelName, function (mesh) {
			if (mesh) {
				mesh.setEnabled(true);
				flock.hk._hknp.HP_World_AddBody(
					flock.hk.world,
					mesh.physics._pluginData.hpBodyId,
					mesh.physics.startAsleep,
				);
			} else {
				console.log("Model not loaded:", modelName);
			}
		});
	},
	hide(modelName) {
		return flock.whenModelReady(modelName, async function (mesh) {
			if (mesh) {
				mesh.setEnabled(false);
				flock.hk._hknp.HP_World_RemoveBody(
					flock.hk.world,
					mesh.physics._pluginData.hpBodyId,
				);
			} else {
				console.log("Mesh not loaded:", modelName);
			}
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
	applyForce(modelName, forceX = 0, forceY = 0, forceZ = 0) {
		const mesh = flock.scene.getMeshByName(modelName);
		if (mesh) {
			mesh.physics.applyImpulse(
				new flock.BABYLON.Vector3(forceX, forceY, forceZ),
				mesh.getAbsolutePosition(),
			);
		} else {
			console.log("Model not loaded (applyForce):", modelName);
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

		//if(hit.hit) {console.log(hit.pickedMesh.name, hit.distance);}
		return hit.hit && hit.pickedMesh !== null && hit.distance <= 0.06;
	},
	keyPressed(key) {
		if (key === "ANY") {
			return (
				flock.canvas.pressedKeys.size > 0 ||
				flock.canvas.pressedButtons.size > 0
			);
		} else if (key === "NONE") {
			return (
				flock.canvas.pressedKeys.size === 0 &&
				flock.canvas.pressedButtons.size === 0
			);
		} else {
			return (
				flock.canvas.pressedKeys.has(key) ||
				flock.canvas.pressedButtons.has(key)
			);
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
	changeColour(modelName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
			let materialFound = false;

			function applyColorToMaterial(part, color) {
				if (part.material) {
					// Check if part.material.diffuseColor exists and set it
					if (part.material.diffuseColor !== undefined) {
						part.material.diffuseColor =
							flock.BABYLON.Color3.FromHexString(color);
					} else {
						// Handle materials without diffuseColor
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
				}

				part.getChildMeshes().forEach((child) => {
					applyColorToMaterial(child, color);
				});
			}

			// Start applying colour to the main mesh and its children
			applyColorToMaterial(mesh, color);

			// If no material was found on the main mesh or any child, create a new one
			if (!materialFound) {
				const material = new flock.BABYLON.StandardMaterial(
					"meshMaterial",
					flock.scene,
				);
				material.diffuseColor =
					flock.BABYLON.Color3.FromHexString(color);
				mesh.material = material;
			}
		});
	},
	changeMaterial(modelName, materialName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
			const allMeshes = [mesh].concat(mesh.getDescendants());
			const materialNode = allMeshes.find((node) => node.material);

			const texture = new flock.BABYLON.Texture(
				`./textures/${materialName}`,
				flock.scene,
			);

			const material = new flock.BABYLON.StandardMaterial(
				materialName,
				flock.scene,
			);

			const texturePhysicalSize = 2;
			const boundingInfo = materialNode.getBoundingInfo();
			const size = boundingInfo.boundingBox.extendSize.scale(2);

			const meshWidth = boundingInfo.boundingBox.extendSize.x; // full width in meters
			const meshHeight = boundingInfo.boundingBox.extendSize.y; // full height in meters
			const meshwidth = Math.max(size.x, size.z);
			texture.uScale = meshWidth / texturePhysicalSize;
			texture.vScale = meshHeight / texturePhysicalSize;

			material.diffuseTexture = texture;
			material.diffuseColor = flock.BABYLON.Color3.FromHexString(color);

			material.name = materialName;
			materialNode.material = material;
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
	attachCamera(modelName, radius) {
		return flock.whenModelReady(modelName, function (mesh) {
			if (mesh) {
				flock.updateDynamicMeshPositions(flock.scene, [mesh]);
				const newBox = flock.BABYLON.MeshBuilder.CreateBox(
					"staticMesh",
					{ height: 1, width: 1, depth: 1 },
				);
				newBox.position = new flock.BABYLON.Vector3(0, -4, 0);

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
					new flock.BABYLON.Vector3(1, 1, 1),
					flock.scene,
				);

				/*boxBody.setMassProperties({
					inertia: flock.BABYLON.Vector3.ZeroReadOnly,
				});*/
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
								axis: flock.BABYLON.PhysicsConstraintAxis
									.ANGULAR_X,
								minLimit: 0,
								maxLimit: 0,
							},
							{
								axis: flock.BABYLON.PhysicsConstraintAxis
									.ANGULAR_Z,
								minLimit: 0,
								maxLimit: 0,
							},
						],
						scene,
					);

					// Ensure both bodies are defined before adding constraint
					if (mesh && referenceBody) {
						mesh.physics.addConstraint(referenceBody, constraint);
					} else {
						console.error(
							"Mesh body or reference body is not defined",
						);
					}
				}
				// Create the constraint for the platform
				createVerticalConstraint(mesh, boxBody, flock.scene);
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

					/*const currentRotationQuaternion =
						mesh.physics.transformNode.rotationQuaternion;
					const currentEulerRotation =
						currentRotationQuaternion.toEulerAngles();
					const newRotationQuaternion =
						flock.BABYLON.Quaternion.RotationYawPitchRoll(
							currentEulerRotation.y,
							0,
							0,
						);
					mesh.physics.transformNode.rotationQuaternion.copyFrom(
						newRotationQuaternion,
					);*/
				});

				const camera = new flock.BABYLON.ArcRotateCamera(
					"camera",
					Math.PI / 2,
					Math.PI / 4,
					radius,
					mesh.position,
					flock.scene,
				);
				camera.checkCollisions = true;
				camera.lowerBetaLimit = Math.PI / 2.5;
				camera.upperBetaLimit = Math.PI / 2;
				camera.lowerRadiusLimit = radius * 0.6;
				camera.upperRadiusLimit = radius * 1.6;
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
	updateDynamicMeshPositions(scene, dynamicMeshes) {
		scene.onBeforeRenderObservable.add(() => {
			dynamicMeshes.forEach((mesh) => {
				// Cast a ray upwards from inside the mesh to check for intersections
				mesh.computeWorldMatrix(true);
				const boundingInfo = mesh.getBoundingInfo();
				const minY = boundingInfo.boundingBox.minimumWorld.y;

				const rayOrigin = new flock.BABYLON.Vector3(
					boundingInfo.boundingBox.centerWorld.x,
					minY,
					boundingInfo.boundingBox.centerWorld.z,
				);

				const ray = new flock.BABYLON.Ray(
					rayOrigin,
					new flock.BABYLON.Vector3(0, 1, 0),
					2,
				);

				const rayHelper = new flock.BABYLON.RayHelper(ray);

				mesh.isPickable = false;
				const hit = flock.scene.pickWithRay(ray);
				mesh.isPickable = true;

				if (hit.pickedMesh) {
					// Move the mesh up to avoid intersection
					mesh.position.y += hit.distance;
					mesh.computeWorldMatrix(true);
				}
			});
		});
	},
	setPhysics(modelName, physicsType) {
		return flock.whenModelReady(modelName, (mesh) => {
			switch (physicsType) {
				case "STATIC":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.STATIC,
					);
					/*flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);*/
					mesh.physics.disablePreStep = true;
					break;
				case "DYNAMIC":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.DYNAMIC,
					);
					// Stops falling through platforms
					/*flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);*/
					mesh.physics.disablePreStep = false;
					//mesh.physics.disableSync = false;
					//mesh.physics.setPrestepType(flock.BABYLON.PhysicsPrestepType.TELEPORT);
					break;
				case "ANIMATED":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
					/*flock.hk._hknp.HP_World_AddBody(
						flock.hk.world,
						mesh.physics._pluginData.hpBodyId,
						mesh.physics.startAsleep,
					);*/
					mesh.physics.disablePreStep = false;
					break;
				case "NONE":
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.STATIC,
					);
					mesh.isPickable = false;
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
	canvasControls(setting) {
		if (setting) {
			flock.scene.activeCamera.attachControl(flock.canvas, true);
		} else {
			flock.scene.activeCamera.detachControl();
		}
	},
	checkMeshesTouching(mesh1VarName, mesh2VarName) {
		const mesh1 = flock.scene.getMeshByName(mesh1VarName);
		const mesh2 = flock.scene.getMeshByName(mesh2VarName);
		if (mesh1 && mesh2 && mesh2.isEnabled()) {
			return mesh1.intersectsMesh(mesh2, false);
		}
		return false;
	},
	say(
		meshName,
		text,
		duration,
		textColor,
		backgroundColor,
		alpha,
		size,
		mode,
	) {
		if (flock.scene) {
			const mesh = flock.scene.getMeshByName(meshName);

			if (mesh) {
				// Mesh is available immediately
				if (duration === 0) {
					// Handle synchronously and return immediately if duration is 0
					handleMesh(mesh);
					return;
				} else {
					// Handle with a promise if duration is non-zero
					return handleMesh(mesh);
				}
			} else {
				// Mesh is not available, return a Promise and handle asynchronously
				return flock.whenModelReady(meshName, function (mesh) {
					return new Promise((resolve, reject) => {
						if (mesh) {
							handleMesh(mesh).then(resolve).catch(reject);
						} else {
							console.error("Mesh is not defined.");
							reject("Mesh is not defined.");
						}
					});
				});
			}
		} else {
			console.error("Scene is not available.");
			return Promise.reject("Scene is not available.");
		}

		function handleMesh(mesh) {
			return new Promise((resolve) => {
				const targetMesh = mesh;
				let plane;
				let background = "transparent";
				if (
					targetMesh.metadata &&
					targetMesh.metadata.shape == "plane"
				) {
					plane = targetMesh;
					background = plane.material.diffuseColor.toHexString();
					plane.material.needDepthPrePass = true;
				} else
					plane = mesh
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
					const boundingInfo = targetMesh.getBoundingInfo();
					plane.position.y =
						boundingInfo.boundingBox.maximum.y + 0.85;
					plane.billboardMode = flock.BABYLON.Mesh.BILLBOARDMODE_ALL;
				}
				
				if (!plane.advancedTexture) {
					const planeBoundingInfo = plane.getBoundingInfo();
					const planeWidth =
						planeBoundingInfo.boundingBox.extendSize.x * 2;
					const planeHeight =
						planeBoundingInfo.boundingBox.extendSize.y * 2;
					const aspectRatio = planeWidth / planeHeight;

					// Choose a base resolution (e.g., 1024 for the larger dimension)
					const baseResolution = 1024;
					const textureWidth =
						baseResolution * (aspectRatio > 1 ? 1 : aspectRatio);
					const textureHeight =
						baseResolution *
						(aspectRatio > 1 ? 1 / aspectRatio : 1);

					advancedTexture =
						flock.GUI.AdvancedDynamicTexture.CreateForMesh(
							plane,
							textureWidth,
							textureHeight,
						);
					advancedTexture.isTransparent = true;
					plane.advancedTexture = advancedTexture;

					if (
						targetMesh.metadata &&
						targetMesh.metadata.shape == "plane"
					) {
						// Create a full-screen rectangle
						let fullScreenRect = new flock.GUI.Rectangle();
						fullScreenRect.width = "100%";
						fullScreenRect.height = "100%";

						fullScreenRect.background = background;
						fullScreenRect.color = "transparent";
						advancedTexture.addControl(fullScreenRect);
					}
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
					bg.checkCollisions = false;
					bg.isPickable = false;
					stackPanel.addControl(bg);

					const scale = 6;
					//console.log(window.devicePixelRatio);//(window.devicePixelRatio || 1) * 6;
					const textBlock = new flock.GUI.TextBlock();
					textBlock.text = text;
					textBlock.color = textColor;
					textBlock.fontSize = size * scale;
					textBlock.fontFamily = "Asap";
					textBlock.alpha = 1;
					textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
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
						resolve(); // Resolve immediately if duration is 0
					}
				} else {
					resolve();
				}
			});
		}
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
							new flock.BABYLON.PredicateCondition(
								flock.BABYLON.ActionManager,
								() => {
									return otherMesh.isEnabled();
								},
							),
						);
						mesh.actionManager.registerAction(action); // Register the ExecuteCodeAction

						resolve();
					},
				);
			});
		});
	},
	onEvent(eventName, handler) {
		flock.document.addEventListener(eventName, handler);
		if (!flock.scene.eventListeners) {
			flock.scene.eventListeners = [];
		}
		flock.scene.eventListeners.push({ event: eventName, handler });
	},
	broadcastEvent(eventName) {
		flock.document.dispatchEvent(new CustomEvent(eventName));
	},
	whenKeyPressed(key, callback) {
		// Register the callback for the keyboard observable
		flock.scene.onKeyboardObservable.add((kbInfo) => {
			if (
				kbInfo.type === flock.BABYLON.KeyboardEventTypes.KEYDOWN &&
				kbInfo.event.key === key
			) {
				callback();
			}
		});

		// Register the callback for the grid input observable
		flock.gridKeyPressObservable.add(function (pressedKey) {
			if (pressedKey === key) {
				callback();
			}
		});
	},
	whenKeyReleased(key, callback) {
		// Register the callback for the keyboard observable
		flock.scene.onKeyboardObservable.add((kbInfo) => {
			if (
				kbInfo.type === flock.BABYLON.KeyboardEventTypes.KEYUP &&
				kbInfo.event.key === key
			) {
				callback();
			}
		});

		// Register the callback for the grid input observable
		flock.gridKeyReleaseObservable.add((inputKey) => {
			if (inputKey === key) {
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
	playSound(scene, soundName) {
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



export function initializeFlock() {
	const scriptElement = document.getElementById("flock");
	if (scriptElement) {
		flock.initialize().then(() => {
			const userCode = scriptElement.textContent;
			flock.runCode(userCode);
		}).catch(error => {
			console.error('Error initializing flock:', error);
		});
	}
}