// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from "@babylonjs/havok";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import * as BABYLON_EXPORT from "@babylonjs/serializers";
import { FlowGraphLog10Block, SetMaterialIDBlock } from "babylonjs";
import "@fontsource/asap";
import "@fontsource/asap/500.css";
import "@fontsource/asap/600.css";

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
	EXPORT: null,
	canvas: null,
	controlsTexture: null,
	canvas: {
		pressedKeys: null,
	},
	abortController: null,
	document: document,
	disposed: null,
	modelCache: {},
	loadingCache: {},
	flockNotReady: true,
	async runCode(code) {
		const sandboxedCode = `
			"use strict";

			const {
			initialize,
			createEngine,
			createScene,
				playAnimation,
				playSound,
				playNotes,
				setBPM,
				createInstrument,
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
				getCamera,
				cameraControl,
				applyForce,
				moveByVector,
				glideTo,
				animateKeyFrames,
				setPivotPoint,
				rotate,
				lookAt,
				moveTo,
				rotateTo,
				rotateCamera,
				rotateAnim,
				animateProperty,
				positionAt,
				distanceTo,
				wait,
				safeLoop,
				waitUntil,
				show,
				hide,
				clearEffects,
				tint,
				setAlpha,
				dispose,
				setFog,
				keyPressed,
				isTouchingSurface,
				seededRandom,
				randomColour,
				scaleMesh,
				changeColour,
				changeColourMesh,
				changeMaterial,
				setMaterial,
				createMaterial,
				textMaterial,
				createDecal,
				placeDecal,
				moveForward,
				moveSideways,
				strafe,
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
				UIText,
				onIntersect,
				getProperty,
				exportMesh,
			} = flock;
			
			${code}			
		`;

		let iframe = document.getElementById("flock-iframe");

		// If the iframe already exists and has content, dispose of its resources
		if (iframe && iframe.contentWindow && iframe.contentWindow.flock) {
			const oldFlock = iframe.contentWindow.flock;

			// Ensure the old scene is properly disposed using the disposeOldScene function
			try {
				await oldFlock.disposeOldScene(); // Use the dispose function directly
			} catch (error) {
				console.error("Error during scene disposal:", error);
			}

			// Remove the iframe from the DOM after resources are disposed
			iframe.remove();
			iframe = null; // Clear reference to the iframe to ensure it gets garbage collected
		}

		// Create a new iframe
		iframe = document.createElement("iframe");
		iframe.id = "flock-iframe";
		iframe.style.display = "none";
		iframe.src = "about:blank";
		document.body.appendChild(iframe);

		// Assign flock and initialize the new scene inside the new iframe
		iframe.contentWindow.flock = flock;

		try {
			// Initialize the new scene using the function from the new iframe's content window
			await iframe.contentWindow.flock.initializeNewScene();
		} catch (error) {
			console.error("Error during new scene creation:", error);
		}

		// Evaluate the sandboxed code inside the iframe to finalize setup or run additional logic
		try {
			iframe.contentWindow.flock = flock;
			iframe.contentWindow.eval(sandboxedCode);
		} catch (error) {
			console.error("Error executing sandboxed code:", error);
		}
	},
	async initialize() {
		flock.BABYLON = BABYLON;
		flock.GUI = BABYLON_GUI;
		flock.EXPORT = BABYLON_EXPORT;
		flock.document = document;
		flock.canvas = flock.document.getElementById("renderCanvas");
		flock.scene = null;
		flock.havokInstance = null;
		flock.engineReady = false;
		flock.meshLoaders = new Map();
		flock.audioContext = flock.getAudioContext();
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
		await flock.document.fonts.ready; // Wait for all fonts to be loaded
		flock.abortController = new AbortController();

		//flock.scene = await flock.createScene();

		flock.canvas.addEventListener(
			"touchmove",
			function (event) {
				if (event.touches.length > 1) {
					event.preventDefault(); // Prevent multi-touch drag but allow multiple touches
				}
			},
			{ passive: false },
		);

		flock.canvas.addEventListener("keydown", function (event) {
			flock.canvas.currentKeyPressed = event.key;
			flock.canvas.pressedKeys.add(event.key);
		});

		flock.canvas.addEventListener("keyup", function (event) {
			flock.canvas.pressedKeys.delete(event.key);
		});

		flock.engineReady = true;
	},
	createEngine() {
		if (flock.engine) {
			flock.engine.dispose();
			flock.engine = null;
		}
		flock.engine = new flock.BABYLON.Engine(flock.canvas, true, {
			stencil: true,
		});
		flock.engine.enableOfflineSupport = false;
		flock.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
	},
	async disposeOldScene() {
		flock.flockNotReady = true;
		if (flock.scene) {
			flock.scene.activeCamera.inputs.clear();
			flock.modelCache = null;
			flock.loadingCache = null;
			// Abort any ongoing operations if applicable
			if (flock.abortController) {
				flock.abortController.abort(); // Abort any pending operations

				// Wait briefly to ensure all asynchronous tasks complete
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			// Remove event listeners before disposing of the scene
			flock.removeEventListeners();

			// Dispose of textures and controls related to the scene
			if (flock.controlsTexture) {
				flock.controlsTexture.dispose();
				flock.controlsTexture = null;
			}

			// Clear observables before disposing the scene
			if (flock.gridKeyPressObservable) {
				flock.gridKeyPressObservable.clear();
			}

			if (flock.gridKeyReleaseObservable) {
				flock.gridKeyReleaseObservable.clear();
			}

			if (flock.highlighter) {
				flock.highlighter.dispose();
				flock.highlighter = null;
			}

			// Dispose of the scene directly
			flock.scene.activeCamera.inputs.clear();

			flock.scene.dispose();
			flock.scene = null;

			// Dispose of physics-related resources if they exist
			if (flock.hk) {
				flock.hk.dispose();
				flock.hk = null;
			}

			// If the audio context is present, close it
			if (flock.audioContext) {
				flock.audioContext.close();
				flock.audioContext = null;
			}
		}
	},
	async initializeNewScene() {
		// Ensure the engine exists and is running
		if (!flock.engine) {
			flock.createEngine();
		} else {
			flock.engine.stopRenderLoop();
		}

		flock.modelCache = {};

		// Create the new scene
		flock.scene = new flock.BABYLON.Scene(flock.engine);

		flock.disposed = false;

		flock.engine.runRenderLoop(() => {
			flock.scene.render();
		});

		// Reinitialize physics and other elements for the new scene
		flock.hk = new flock.BABYLON.HavokPlugin(true, flock.havokInstance);
		flock.scene.enablePhysics(
			new flock.BABYLON.Vector3(0, -9.81, 0),
			flock.hk,
		);

		flock.highlighter = new flock.BABYLON.HighlightLayer(
			"highlighter",
			flock.scene,
		);

		// Set up a new camera
		const camera = new flock.BABYLON.FreeCamera(
			"camera",
			new flock.BABYLON.Vector3(0, 3, -10),
			flock.scene,
		);
		camera.minZ = 1;
		camera.setTarget(flock.BABYLON.Vector3.Zero());
		camera.rotation.x = flock.BABYLON.Tools.ToRadians(0);
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		camera.speed = 0.25;

		// Set up lighting
		const hemisphericLight = new flock.BABYLON.HemisphericLight(
			"hemisphericLight",
			new flock.BABYLON.Vector3(0, 1, 0),
			flock.scene,
		);

		flock.scene.onPointerObservable.add(function (pointerInfo) {
			if (
				pointerInfo.type === flock.BABYLON.PointerEventTypes.POINTERUP
			) {
				if (
					pointerInfo.event.touches &&
					pointerInfo.event.touches.length > 1
				) {
					const camera = flock.scene.activeCamera;
					camera.detachControl();

					// Short delay to ensure controls are fully detached
					setTimeout(() => {
						// Reattach the camera control and reset the target
						camera.attachControl(canvas, true);
						camera.setTarget(camera.target);
					}, 100); // Adjust delay as necessary
				}
			}
		});
		hemisphericLight.intensity = 1.0;
		hemisphericLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
		hemisphericLight.groundColor = new flock.BABYLON.Color3(0.5, 0.5, 0.5);

		// Enable collisions in the scene
		flock.scene.collisionsEnabled = true;

		flock.controlsTexture =
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
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
				const timeoutId = setTimeout(() => {
					if (flock.scene) {
						// Ensure scene is still valid before removing
						stackPanel.removeControl(bg);
						textLines.splice(textLines.indexOf(bg), 1);
					}
				}, duration * 1000);

				// Listen for the abort signal to clear the timeout
				flock.abortController.signal.addEventListener("abort", () => {
					clearTimeout(timeoutId); // Clear the timeout if aborted
				});
			} catch (error) {
				//console.warn("Unable to print text:", error);
			}
		};

		flock.globalStartTime = flock.getAudioContext().currentTime;
		flock.scene.onBeforeRenderObservable.add(() => {
			const camera = flock.scene.activeCamera;
			const context = flock.getAudioContext();
			flock.updateListenerPositionAndOrientation(context, camera);
		});

		flock.flockNotReady = false;
	},

	async resetScene() {
		// Dispose of the old scene
		await flock.disposeOldScene();

		// Initialize the new scene
		await flock.initializeNewScene();
	},
	UIText(text, x, y, fontSize, color, duration, existingTextBlock = null) {
		if (!flock.scene.UITexture) {
			flock.scene.UITexture =
				flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
		}

		// Retrieve the canvas dimensions for the Babylon.js scene
		const canvas = flock.scene.getEngine().getRenderingCanvas();
		const maxWidth = canvas.width;
		const maxHeight = canvas.height;

		// Adjust for negative x and y values (offsets from max canvas width/height)
		const adjustedX = x < 0 ? maxWidth + x : x;
		const adjustedY = y < 0 ? maxHeight + y : y;

		let textBlock;

		// Check if the TextBlock already exists (for updating text)
		if (existingTextBlock) {
			textBlock = existingTextBlock;
			textBlock.text = text;
		} else {
			// Create a new TextBlock if it doesn't exist
			textBlock = new flock.GUI.TextBlock();
			textBlock.text = text;
			flock.scene.UITexture.addControl(textBlock);
		}

		// Update the text block properties
		textBlock.color = color;
		textBlock.fontSize = fontSize;
		textBlock.textHorizontalAlignment =
			flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		textBlock.textVerticalAlignment =
			flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
		textBlock.left = adjustedX;
		textBlock.top = adjustedY;

		// Only remove the text if duration is greater than 0
		if (duration > 0 && !existingTextBlock) {
			const timeoutId = setTimeout(() => {
				advancedTexture.removeControl(textBlock);
			}, duration * 1000);

			// Listen for the abort signal to clear the timeout
			flock.abortController.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId); // Clear the timeout if aborted
			});
		}

		return textBlock;
	},
	removeEventListeners() {
		flock.scene.eventListeners?.forEach(({ event, handler }) => {
			flock.document.removeEventListener(event, handler);
		});

		if (flock.scene && flock.scene.eventListeners)
			flock.scene.eventListeners.length = 0; // Clear the array
	},
	async *modelReadyGenerator(
		meshId,
		maxAttempts = 10,
		initialInterval = 100,
		maxInterval = 1000,
	) {
		let attempt = 1;
		let interval = initialInterval;
		const { signal } = flock.abortController;

		while (attempt <= maxAttempts) {
			if (flock.disposed || !flock.scene || flock.scene.isDisposed) {
				console.warn(
					"Scene has been disposed or generator invalidated.",
				);
				return;
			}

			if (flock.scene) {
				if (meshId === "__active_camera__") {
					yield flock.scene.activeCamera;
					return;
				} else {
					const mesh = flock.scene.getMeshByName(meshId);
					if (mesh) {
						yield mesh;
						return;
					}
				}
			}

			if (flock.scene) {
				const mesh = flock.scene.getMeshByName(meshId);
				if (mesh) {
					yield mesh;
					return;
				}
			}

			try {
				await new Promise((resolve, reject) => {
					const timeoutId = setTimeout(resolve, interval);

					// Reject the promise if the abort signal is triggered
					const onAbort = () => {
						clearTimeout(timeoutId);
						reject(new Error("Wait aborted"));
					};

					signal.addEventListener("abort", onAbort, { once: true });

					// Ensure the event listener is cleaned up after resolving
					signal.addEventListener(
						"abort",
						() => signal.removeEventListener("abort", onAbort),
						{ once: true },
					);
				});
			} catch (error) {
				console.log("Timeout aborted:", error);
				// Properly exit if the wait was aborted to prevent further processing
				return;
			}

			interval = Math.min(interval * 2, maxInterval);
			attempt++;
			//console.log(`Attempt ${attempt}: Retrying in ${interval}ms...`);
		}

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

		if(flock.flockNotReady)
			return null;
		
		let targetAnimationGroup = flock.scene?.animationGroups?.find(
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
	newModel(modelName, modelId, scale, x, y, z, callback) {
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

				bb.metadata = bb.metadata || {};
				bb.metadata.yOffset = (bb.position.y - y) / scale;
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
				//boxBody.setAngularDamping(10000000);
				//boxBody.setLinearDamping(0);
				bb.physics = boxBody;

				// Call the callback after everything is set up
				if (typeof callback === "function") {
					callback(); // Execute the "do" code
				}
			},
			null,
			function (error) {
				console.log("Error loading", error);
			},
		);

		return modelId;
	},
	newModelCache(modelName, modelId, scale, x, y, z, callback) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		// Check if the model has already been cached
		if (flock.modelCache[modelName]) {
			// Use the cached model and clone it
			const originalMesh = flock.modelCache[modelName];
			const clonedMesh = originalMesh.clone(modelId);

			// Reset visibility and interaction properties for the cloned mesh and its children
			clonedMesh.isVisible = true;
			clonedMesh.isPickable = true;

			clonedMesh.getChildMeshes().forEach(function (child) {
				child.isVisible = true;
				child.isPickable = true;
			});

			// Apply scaling and position to the cloned mesh
			clonedMesh.scaling = new flock.BABYLON.Vector3(scale, scale, scale);
			clonedMesh.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));
			clonedMesh.computeWorldMatrix(true);
			clonedMesh.refreshBoundingInfo();

			// Set up bounding box and physics
			const bb =
				flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
					clonedMesh,
				);
			bb.name = modelId;
			bb.blockKey = blockId;
			bb.isPickable = true;
			bb.metadata = bb.metadata || {};
			bb.metadata.yOffset = (bb.position.y - y) / scale;
			flock.stopAnimationsTargetingMesh(flock.scene, clonedMesh);

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
			bb.physics = boxBody;

			// Call the callback after everything is set up
			if (typeof callback === "function") {
				callback(); // Execute the "do" code
			}

			return modelId; // Return the cloned model's ID
		}

		// If model is still loading, return the promise
		if (flock.loadingCache[modelName]) {
			return flock.loadingCache[modelName].then(() => {
				return flock.newModel(
					modelName,
					modelId,
					scale,
					x,
					y,
					z,
					callback,
				); // Retry after load completes
			});
		}

		// Load the model if not cached
		flock.loadingCache[modelName] = new Promise((resolve, reject) => {
			flock.BABYLON.SceneLoader.ImportMesh(
				"",
				"./models/",
				modelName,
				flock.scene,
				function (meshes) {
					const rootMesh = meshes[0];

					// Cache the original loaded model
					flock.modelCache[modelName] = rootMesh;
					delete flock.loadingCache[modelName]; // Remove from loading cache

					// Assign a meaningful name to the original root mesh only once
					rootMesh.name = "Original " + modelName;

					// Make the root mesh and all its children invisible and non-interactive
					rootMesh.isVisible = false;
					rootMesh.isPickable = false;
					rootMesh.checkCollisions = false;

					rootMesh.getChildMeshes().forEach(function (child) {
						child.name = "Original " + child.name; // Give a meaningful name to the child
						child.isVisible = false;
						child.isPickable = false;
						child.checkCollisions = false; // Disable collisions for all children
					});

					// Clone the original mesh for the first instance
					const clonedMesh = rootMesh.clone(modelId);

					// Reset visibility and interaction properties for the cloned mesh and its children
					clonedMesh.isVisible = true;
					clonedMesh.isPickable = true;

					clonedMesh.getChildMeshes().forEach(function (child) {
						child.isVisible = true;
						child.isPickable = true;
					});

					// Apply scaling and position to the cloned mesh
					clonedMesh.scaling = new flock.BABYLON.Vector3(
						scale,
						scale,
						scale,
					);
					clonedMesh.position.addInPlace(
						new flock.BABYLON.Vector3(x, y, z),
					);
					clonedMesh.computeWorldMatrix(true);
					clonedMesh.refreshBoundingInfo();

					// Set up bounding box and physics
					const bb =
						flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
							clonedMesh,
						);
					bb.name = modelId;
					bb.blockKey = blockId;
					bb.isPickable = true;
					bb.metadata = bb.metadata || {};
					bb.metadata.yOffset = (bb.position.y - y) / scale;

					flock.stopAnimationsTargetingMesh(flock.scene, clonedMesh);

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
					bb.physics = boxBody;

					// Call the callback after everything is set up
					if (typeof callback === "function") {
						callback(); // Execute the "do" code
					}

					resolve(modelId); // Resolve the promise once loaded
				},
				null,
				function (error) {
					console.log("Error loading", error);
					delete flock.loadingCache[modelName]; // Remove from loading cache on error
					reject(error); // Reject the promise on error
				},
			);
		});

		return modelId; // Return the new model's ID (or await the promise)
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
		callback,
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
				bb.isPickable = false;
				bb.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));

				mesh.computeWorldMatrix(true);
				mesh.refreshBoundingInfo();

				bb.metadata = bb.metadata || {};
				bb.metadata.yOffset = (bb.position.y - y) / scale;
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

				const descendants = mesh.getChildMeshes(false);
				descendants.forEach((childMesh) => {
					if (childMesh.getTotalVertices() > 0) {
						// Ensure it has geometry
						childMesh.isPickable = true;
						childMesh.flipFaces(true);
					}
				});

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

				// Call the callback after everything is set up
				if (typeof callback === "function") {
					callback(); // Execute the "do" code
				}
			},
			null,
			function (error) {
				console.log("Error loading", error);
			},
		);

		return modelId;
	},
	newObject(modelName, modelId, scale, x, y, z, color, callback) {
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

				bb.metadata = bb.metadata || {};
				bb.metadata.yOffset = (bb.position.y - y) / scale;
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

				if (typeof callback === "function") {
					callback(); // Execute the "do" code
				}
			},
			null,
			function (error) {
				console.log("Error loading", error);
			},
		);

		return modelId;
	},
	parentChild(
		parentModelName,
		childModelName,
		offsetX = 0,
		offsetY = 0,
		offsetZ = 0,
	) {
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
	createGround(color, modelId) {
		const ground = flock.BABYLON.MeshBuilder.CreateGround(
			modelId,
			{ width: 100, height: 100, subdivisions: 2 },
			flock.scene,
		);
		const blockId = modelId;
		const groundAggregate = new flock.BABYLON.PhysicsAggregate(
			ground,
			flock.BABYLON.PhysicsShapeType.BOX,
			{ mass: 0, friction: 0.5 },
			flock.scene,
		);

		ground.name = modelId;
		ground.blockKey = blockId;
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
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				flock.abortController.signal.removeEventListener("abort", onAbort);
				resolve();
			}, duration);

			const onAbort = () => {
				clearTimeout(timeoutId); // Clear the timeout if aborted
				flock.abortController.signal.removeEventListener("abort", onAbort);
				// Instead of throwing an error, resolve gracefully here
				reject(new Error("Wait aborted"));
			};

			flock.abortController.signal.addEventListener("abort", onAbort);
		}).catch((error) => {
			// Check if the error is the expected "Wait aborted" error and handle it
			if (error.message === "Wait aborted") {
				//console.log("Abort signal received, stopping the wait.");
				// Prevent further processing, but don't propagate the error
				return;
			}
			// If it's another error, rethrow it
			throw error;
		});
	},
	safeLoop() {
		requestAnimationFrame(() => {});
	},
	waitUntil(conditionFunc) {
		return new Promise((resolve, reject) => {
			const checkCondition = () => {
				try {
					if (conditionFunc()) {
						flock.scene.onBeforeRenderObservable.removeCallback(
							checkCondition,
						);
						resolve();
					}
				} catch (error) {
					flock.scene.onBeforeRenderObservable.removeCallback(
						checkCondition,
					);
					reject(error);
				}
			};
			flock.scene.onBeforeRenderObservable.add(checkCondition);
		});
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
	tint(modelName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
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
	dispose(modelName) {
		return flock.whenModelReady(modelName, (mesh) => {
			// Create a list of the mesh and its child meshes
			const meshesToDispose = mesh.getChildMeshes().concat(mesh);

			// Loop through each mesh in the list and dispose of it
			meshesToDispose.forEach(function (currentMesh) {
				// Break parent-child relationship
				currentMesh.parent = null;

				// Remove from scene
				flock.scene.removeMesh(currentMesh);
				currentMesh.setEnabled(false);

				// Remove body from the physics world if it exists
				if (currentMesh.physics && currentMesh.physics._pluginData) {
					flock.hk._hknp.HP_World_RemoveBody(
						flock.hk.world,
						currentMesh.physics._pluginData.hpBodyId,
					);
					currentMesh.physics.dispose();
				}

				// Dispose of the mesh
				currentMesh.dispose();
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
		const attemptInterval = 10;

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
			await new Promise((resolve, reject) => {
				const timeoutId = setTimeout(resolve, attemptInterval);

				// Listen for the abort signal to cancel the timeout
				flock.abortController.signal.addEventListener("abort", () => {
					clearTimeout(timeoutId); // Clear the timeout if aborted
					reject(new Error("Timeout aborted")); // Reject the promise if aborted
				});
			});
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
		newBox.metadata = {};
		newBox.metadata.shapeType = "Box";
		newBox.position = new flock.BABYLON.Vector3(posX, posY, posZ);

		newBox.blockKey = newBox.name;
		newBox.name = newBox.name + "_" + newBox.uniqueId;
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

		newSphere.metadata = {};
		newSphere.metadata.shapeType = "Sphere";
		newSphere.blockKey = newSphere.name;
		newSphere.name = newSphere.name + "_" + newSphere.uniqueId;

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
	) {
		const newCylinder = flock.BABYLON.MeshBuilder.CreateCylinder(
			cylinderId,
			{
				height: height,
				diameterTop: diameterTop,
				diameterBottom: diameterBottom,
				tessellation: 24,
				updatable: true,
			},
			flock.scene,
		);
		newCylinder.position = new flock.BABYLON.Vector3(posX, posY, posZ);
		newCylinder.metadata = {};
		newCylinder.metadata.shapeType = "Cylinder";
		newCylinder.blockKey = newCylinder.name;
		newCylinder.name = newCylinder.name + "_" + newCylinder.uniqueId;

		const cylinderBody = new flock.BABYLON.PhysicsBody(
			newCylinder,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
		const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);

		// Create the physics shape for the cylinder
		const cylinderShape = new flock.BABYLON.PhysicsShapeCylinder(
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

		newCapsule.metadata = {};
		newCapsule.metadata.shapeType = "Capsule";
		newCapsule.blockKey = newCapsule.name;
		newCapsule.name = newCapsule.name + "_" + newCapsule.uniqueId;

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
		newPlane.name = newPlane.name + "_" + newPlane.uniqueId;
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
			const fullSize = new flock.BABYLON.Vector3(
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
	scaleMesh(
		modelName,
		x,
		y,
		z,
		xOrigin = "CENTRE",
		yOrigin = "CENTRE",
		zOrigin = "CENTRE",
	) {
		return flock.whenModelReady(modelName, (mesh) => {
			mesh.metadata = mesh.metadata || {};
			mesh.metadata.origin = { xOrigin, yOrigin, zOrigin };

			// Get the original bounding box dimensions and positions
			const boundingInfo = mesh.getBoundingInfo();
			const originalDimensions = {
				x:
					boundingInfo.boundingBox.maximum.x -
					boundingInfo.boundingBox.minimum.x,
				y:
					boundingInfo.boundingBox.maximum.y -
					boundingInfo.boundingBox.minimum.y,
				z:
					boundingInfo.boundingBox.maximum.z -
					boundingInfo.boundingBox.minimum.z,
			};

			// Store original world coordinates for base and top/bottom points
			const originalMinY = boundingInfo.boundingBox.minimumWorld.y;
			const originalMaxY = boundingInfo.boundingBox.maximumWorld.y;
			const originalMinX = boundingInfo.boundingBox.minimumWorld.x;
			const originalMaxX = boundingInfo.boundingBox.maximumWorld.x;
			const originalMinZ = boundingInfo.boundingBox.minimumWorld.z;
			const originalMaxZ = boundingInfo.boundingBox.maximumWorld.z;

			// Apply scaling
			mesh.scaling = new flock.BABYLON.Vector3(x, y, z);
			mesh.physics.scaling = new flock.BABYLON.Vector3(x, y, z);
			mesh.computeWorldMatrix(true);

			// Get the new bounding box information after scaling
			const newBoundingInfo = mesh.getBoundingInfo();
			const newMinY = newBoundingInfo.boundingBox.minimumWorld.y;
			const newMaxY = newBoundingInfo.boundingBox.maximumWorld.y;
			const newMinX = newBoundingInfo.boundingBox.minimumWorld.x;
			const newMaxX = newBoundingInfo.boundingBox.maximumWorld.x;
			const newMinZ = newBoundingInfo.boundingBox.minimumWorld.z;
			const newMaxZ = newBoundingInfo.boundingBox.maximumWorld.z;

			// Adjust position based on Y-origin
			if (yOrigin === "BASE") {
				const diffY = newMinY - originalMinY;
				mesh.position.y -= diffY; // Shift the object down by the difference
			} else if (yOrigin === "TOP") {
				const diffY = newMaxY - originalMaxY;
				mesh.position.y -= diffY; // Shift the object up by the difference
			}

			// Adjust position based on X-origin
			if (xOrigin === "LEFT") {
				const diffX = newMinX - originalMinX;
				mesh.position.x -= diffX; // Shift the object to the left
			} else if (xOrigin === "RIGHT") {
				const diffX = newMaxX - originalMaxX;
				mesh.position.x -= diffX; // Shift the object to the right
			}

			// Adjust position based on Z-origin
			if (zOrigin === "FRONT") {
				const diffZ = newMinZ - originalMinZ;
				mesh.position.z -= diffZ; // Shift the object forward
			} else if (zOrigin === "BACK") {
				const diffZ = newMaxZ - originalMaxZ;
				mesh.position.z -= diffZ; // Shift the object backward
			}

			// Refresh bounding info and recompute world matrix
			mesh.refreshBoundingInfo();
			mesh.computeWorldMatrix(true);
		});
	},
	rotate(meshName, x, y, z) {
		// Handle mesh rotation
		return flock.whenModelReady(meshName, (mesh) => {
			if (meshName === "camera") {
				// Handle camera rotation
				const camera = flock.scene.activeCamera;
				if (!camera) return;

				const incrementalRotation =
					flock.BABYLON.Quaternion.RotationYawPitchRoll(
						flock.BABYLON.Tools.ToRadians(y),
						flock.BABYLON.Tools.ToRadians(x),
						flock.BABYLON.Tools.ToRadians(z),
					);

				// Check if the camera is ArcRotateCamera or FreeCamera, and rotate accordingly
				if (camera.alpha !== undefined) {
					// ArcRotateCamera: Adjust the 'alpha' (horizontal) and 'beta' (vertical)
					camera.alpha += flock.BABYLON.Tools.ToRadians(y);
					camera.beta += flock.BABYLON.Tools.ToRadians(x);
				} else if (camera.rotation !== undefined) {
					// FreeCamera: Adjust the camera's rotationQuaternion or Euler rotation
					camera.rotationQuaternion
						.multiplyInPlace(incrementalRotation)
						.normalize();
				}
				return;
			}

			if (mesh.physics) {
				if (
					mesh.physics.getMotionType() !==
					flock.BABYLON.PhysicsMotionType.DYNAMIC
				) {
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
				}
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
	rotateCamera(yawAngle) {
		const camera = flock.scene.activeCamera;
		if (!camera || yawAngle === 0) return;

		if (camera.alpha !== undefined) {
			// ArcRotateCamera: Adjust the 'alpha' to rotate left or right
			camera.alpha += flock.BABYLON.Tools.ToRadians(yawAngle);
		}
		// Otherwise, assume it's a FreeCamera or similar
		else if (camera.rotation !== undefined) {
			// FreeCamera: Adjust the 'rotation.y' for yaw rotation (left/right)
			camera.rotation.y += flock.BABYLON.Tools.ToRadians(yawAngle);
		}
	},
	lookAt(meshName1, meshName2, useY = false) {
		return flock.whenModelReady(meshName1, (mesh1) => {
			return flock.whenModelReady(meshName2, (mesh2) => {
				if (mesh1.physics) {
					if (
						mesh1.physics.getMotionType() !==
						flock.BABYLON.PhysicsMotionType.DYNAMIC
					) {
						mesh1.physics.setMotionType(
							flock.BABYLON.PhysicsMotionType.ANIMATED,
						);
					}
				}

				let targetPosition = mesh2.absolutePosition.clone();
				if (!useY) {
					targetPosition.y = mesh1.absolutePosition.y;
				}

				if (meshName1 === "__active_camera__") {
					//mesh1.setTarget(mesh2);
				} else {
					mesh1.lookAt(targetPosition);
				}

				if (mesh1.physics) {
					mesh1.physics.disablePreStep = false;
					mesh1.physics.setTargetTransform(
						mesh1.absolutePosition,
						mesh1.rotationQuaternion,
					);
				}

				mesh1.computeWorldMatrix(true);
			});
		});
	},
	moveTo(meshName1, meshName2, useY = false) {
		return flock.whenModelReady(meshName1, (mesh1) => {
			return flock.whenModelReady(meshName2, (mesh2) => {
				if (mesh1.physics) {
					if (
						mesh1.physics.getMotionType() !==
						flock.BABYLON.PhysicsMotionType.DYNAMIC
					) {
						mesh1.physics.setMotionType(
							flock.BABYLON.PhysicsMotionType.ANIMATED,
						);
					}
				}
				const targetPosition = mesh2.absolutePosition.clone();
				if (!useY) {
					targetPosition.y = mesh1.absolutePosition.y;
				}
				mesh1.position.copyFrom(targetPosition);

				if (mesh1.physics) {
					mesh1.physics.disablePreStep = false;
					mesh1.physics.setTargetTransform(
						mesh1.position,
						mesh1.rotationQuaternion,
					);
				}

				mesh1.computeWorldMatrix(true);
			});
		});
	},
	rotateTo(meshName, x, y, z) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (mesh.physics) {
				if (
					mesh.physics.getMotionType() !==
					flock.BABYLON.PhysicsMotionType.DYNAMIC
				) {
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
				}
			}

			const radX = flock.BABYLON.Tools.ToRadians(x);
			const radY = flock.BABYLON.Tools.ToRadians(y);
			const radZ = flock.BABYLON.Tools.ToRadians(z);

			if (mesh instanceof flock.BABYLON.Camera) {
				// Apply rotation in Euler angles (ArcRotateCamera, FreeCamera, etc.)
				mesh.rotation.x = radX;
				mesh.rotation.y = radY;
				mesh.rotation.z = radZ;
			} else {
				// Convert the X, Y, and Z inputs from degrees to radians

				// Create a target rotation quaternion
				const targetRotation =
					flock.BABYLON.Quaternion.RotationYawPitchRoll(
						radY, // Yaw (rotation around Y-axis)
						radX, // Pitch (rotation around X-axis)
						radZ, // Roll (rotation around Z-axis)
					);

				// Apply the rotation to the mesh
				mesh.rotationQuaternion = targetRotation;
			}

			if (mesh.physics) {
				mesh.physics.disablePreStep = false;
				mesh.physics.setTargetTransform(
					mesh.position,
					mesh.rotationQuaternion,
				);
			}

			mesh.computeWorldMatrix(true);
		});
	},
	async rotateAnim(
		meshName,
		rotX,
		rotY,
		rotZ,
		duration,
		reverse = false,
		loop = false,
		easing = "Linear",
	) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(meshName, async function (mesh) {
				if (mesh) {
					const startRotation = mesh.rotation.clone(); // Store the original rotation

					// Convert degrees to radians
					const targetRotation = new flock.BABYLON.Vector3(
						rotX * (Math.PI / 180), // X-axis in radians
						rotY * (Math.PI / 180), // Y-axis in radians
						rotZ * (Math.PI / 180), // Z-axis in radians
					);

					const fps = 30;
					const frames = fps * (duration / 1000);

					// Determine the loop mode based on reverse and loop
					let loopMode;
					if (reverse) {
						loopMode =
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO; // Reverse and loop
					} else if (loop) {
						loopMode =
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE; // Loop and reset to start
					} else {
						loopMode =
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT; // No loop
					}

					// Create the rotation animation
					const rotateAnimation = new flock.BABYLON.Animation(
						"rotateTo",
						"rotation",
						fps,
						flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
						loopMode,
					);

					// Define keyframes for rotation
					const rotateKeys = [
						{ frame: 0, value: startRotation },
						{ frame: frames, value: targetRotation },
					];

					rotateAnimation.setKeys(rotateKeys);

					// Apply easing if needed
					if (easing !== "Linear") {
						let easingFunction;
						switch (easing) {
							case "SineEase":
								easingFunction = new flock.BABYLON.SineEase();
								break;
							case "CubicEase":
								easingFunction = new flock.BABYLON.CubicEase();
								break;
							case "QuadraticEase":
								easingFunction =
									new flock.BABYLON.QuadraticEase();
								break;
							case "ExponentialEase":
								easingFunction =
									new flock.BABYLON.ExponentialEase();
								break;
							case "BounceEase":
								easingFunction = new flock.BABYLON.BounceEase();
								break;
							case "ElasticEase":
								easingFunction =
									new flock.BABYLON.ElasticEase();
								break;
							case "BackEase":
								easingFunction = new flock.BABYLON.BackEase();
								break;
							default:
								easingFunction = new flock.BABYLON.SineEase();
						}
						easingFunction.setEasingMode(
							flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
						);
						rotateAnimation.setEasingFunction(easingFunction);
					}

					// Append the rotation animation to the mesh
					mesh.animations.push(rotateAnimation); // Append, don’t overwrite existing animations

					// Start the rotation animation
					const animatable = flock.scene.beginAnimation(
						mesh,
						0,
						frames,
						loop,
					);
					animatable.onAnimationEndObservable.add(() => {
						resolve(); // Resolve after rotation completes
					});
				} else {
					resolve(); // Resolve immediately if the mesh is not available
				}
			});
		});
	},
	async animateProperty(
		meshName,
		property,
		targetValue,
		duration,
		reverse = false,
		loop = false,
		mode = "START",
	) {
		const fps = 30;
		const frames = fps * (duration / 1000);

		// Await mesh to be ready
		await flock.whenModelReady(meshName, async function (mesh) {
			if (!mesh) {
				console.error(`Mesh with name ${meshName} not found.`);
				return;
			}

			// If the property is a color, convert the hex string to Color3
			if (
				property === "diffuseColor" ||
				property === "emissiveColor" ||
				property === "ambientColor" ||
				property === "specularColor"
			) {
				targetValue = flock.BABYLON.Color3.FromHexString(targetValue);
			}

			// Helper function to animate a material property
			function animateProperty(material, property, targetValue) {
				const startValue = material[property];

				// Determine the animation type
				const animationType =
					property === "alpha"
						? flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT
						: flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3;

				// Create the animation
				const animation = new flock.BABYLON.Animation(
					`animate_${property}`,
					property,
					fps,
					animationType,
					reverse
						? flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO
						: flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
				);

				// Define keyframes
				const keys = [
					{ frame: 0, value: startValue },
					{ frame: frames, value: targetValue },
				];
				animation.setKeys(keys);

				material.animations = material.animations || [];
				material.animations.push(animation);

				// Start the animation
				const animatable = flock.scene.beginAnimation(
					material,
					0,
					frames,
					loop,
				);
				material.markAsDirty(flock.BABYLON.Material.MiscDirtyFlag); // Force material update

				return animatable;
			}

			// Function to animate material and its children recursively
			function animateMeshAndChildren(mesh) {
				if (mesh.material) {
					return animateProperty(
						mesh.material,
						property,
						targetValue,
					);
				}
				if (mesh.getChildren) {
					mesh.getChildren().forEach((child) =>
						animateMeshAndChildren(child),
					);
				}
			}

			// Start the animation based on the mode (await or start)
			if (mode === "AWAIT") {
				return new Promise((resolve) => {
					const animatable = animateMeshAndChildren(mesh);
					if (animatable) {
						animatable.onAnimationEndObservable.add(() => {
							resolve();
						});
					} else {
						resolve(); // Resolve immediately if no animation
					}
				});
			} else {
				animateMeshAndChildren(mesh);
			}
		});
	},
	positionAt(meshName, x, y, z, useY = true) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (mesh.physics) {
				if (
					mesh.physics.getMotionType() !==
					flock.BABYLON.PhysicsMotionType.DYNAMIC
				) {
					mesh.physics.setMotionType(
						flock.BABYLON.PhysicsMotionType.ANIMATED,
					);
				}
			}

			let targetY = useY ? y : mesh.position.y;
			mesh.position.set(x, targetY, z);

			if (mesh.physics) {
				mesh.physics.disablePreStep = false;
				mesh.physics.setTargetTransform(
					mesh.position,
					mesh.rotationQuaternion,
				);
			}

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
			case "MIN_X":
				if (mesh.metadata?.origin?.xOrigin === "LEFT") {
					// Adjust based on LEFT origin
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.x;
				} else if (mesh.metadata?.origin?.xOrigin === "RIGHT") {
					// Adjust based on RIGHT origin
					const diffX =
						(mesh.getBoundingInfo().boundingBox.maximum.x -
							mesh.getBoundingInfo().boundingBox.minimum.x) *
						(1 - mesh.scaling.x);
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.x -
						diffX;
				} else {
					// Default CENTER origin
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimum.x *
						mesh.scaling.x;
				}
				break;

			case "MAX_X":
				if (mesh.metadata?.origin?.xOrigin === "RIGHT") {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.x;
				} else if (mesh.metadata?.origin?.xOrigin === "LEFT") {
					const diffX =
						(mesh.getBoundingInfo().boundingBox.maximum.x -
							mesh.getBoundingInfo().boundingBox.minimum.x) *
						mesh.scaling.x;
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.x +
						diffX;
				} else {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximum.x *
						mesh.scaling.x;
				}
				break;

			case "MIN_Y":
				if (mesh.metadata?.origin?.yOrigin === "BASE") {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.y;
				} else if (mesh.metadata?.origin?.yOrigin === "TOP") {
					const diffY =
						(mesh.getBoundingInfo().boundingBox.maximum.y -
							mesh.getBoundingInfo().boundingBox.minimum.y) *
						(1 - mesh.scaling.y);
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.y -
						diffY;
				} else {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimum.y *
						mesh.scaling.y;
				}
				break;

			case "MAX_Y":
				if (mesh.metadata?.origin?.yOrigin === "TOP") {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.y;
				} else if (mesh.metadata?.origin?.yOrigin === "BASE") {
					const diffY =
						(mesh.getBoundingInfo().boundingBox.maximum.y -
							mesh.getBoundingInfo().boundingBox.minimum.y) *
						mesh.scaling.y;
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.y +
						diffY;
				} else {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximum.y *
						mesh.scaling.y;
				}
				break;

			case "MIN_Z":
				if (mesh.metadata?.origin?.zOrigin === "FRONT") {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.z;
				} else if (mesh.metadata?.origin?.zOrigin === "BACK") {
					const diffZ =
						(mesh.getBoundingInfo().boundingBox.maximum.z -
							mesh.getBoundingInfo().boundingBox.minimum.z) *
						(1 - mesh.scaling.z);
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.z -
						diffZ;
				} else {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimum.z *
						mesh.scaling.z;
				}
				break;

			case "MAX_Z":
				if (mesh.metadata?.origin?.zOrigin === "BACK") {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.z;
				} else if (mesh.metadata?.origin?.zOrigin === "FRONT") {
					const diffZ =
						(mesh.getBoundingInfo().boundingBox.maximum.z -
							mesh.getBoundingInfo().boundingBox.minimum.z) *
						mesh.scaling.z;
					propertyValue =
						mesh.getBoundingInfo().boundingBox.minimumWorld.z +
						diffZ;
				} else {
					propertyValue =
						mesh.getBoundingInfo().boundingBox.maximum.z *
						mesh.scaling.z;
				}
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
	async glideTo(
		meshName,
		x,
		y,
		z,
		duration,
		reverse = false,
		loop = false,
		easing = "Linear",
	) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(meshName, async function (mesh) {
				if (mesh) {
					const startPosition = mesh.position.clone(); // Store the original position
					const endPosition = new flock.BABYLON.Vector3(x, y, z);
					const fps = 30;
					const frames = fps * (duration / 1000);

					// Stop any ongoing glide animation
					if (mesh.glide) {
						mesh.glide.stop();
					}

					// Enable physics if applicable
					if (mesh.physics) {
						mesh.physics.disablePreStep = false;
					}

					// Determine the loop mode based on reverse and loop
					const loopMode = reverse
						? flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO
						: flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT;

					// Create the animation for forward movement
					const glideAnimation = new flock.BABYLON.Animation(
						"glideTo",
						"position",
						fps,
						flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
						loopMode, // YOYO for reverse and loop, CONSTANT otherwise
					);

					// Define keyframes for forward motion
					const glideKeys = [
						{ frame: 0, value: startPosition },
						{ frame: frames, value: endPosition },
					];

					glideAnimation.setKeys(glideKeys);

					// Apply easing only if it's not "Linear"
					if (easing !== "Linear") {
						let easingFunction;
						switch (easing) {
							case "SineEase":
								easingFunction = new flock.BABYLON.SineEase();
								break;
							case "CubicEase":
								easingFunction = new flock.BABYLON.CubicEase();
								break;
							case "QuadraticEase":
								easingFunction =
									new flock.BABYLON.QuadraticEase();
								break;
							case "ExponentialEase":
								easingFunction =
									new flock.BABYLON.ExponentialEase();
								break;
							case "BounceEase":
								easingFunction = new flock.BABYLON.BounceEase();
								break;
							case "ElasticEase":
								easingFunction =
									new flock.BABYLON.ElasticEase();
								break;
							case "BackEase":
								easingFunction = new flock.BABYLON.BackEase();
								break;
							default:
								easingFunction = new flock.BABYLON.SineEase(); // Default to SineEase if no match
						}
						easingFunction.setEasingMode(
							flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
						); // Smooth easing
						glideAnimation.setEasingFunction(easingFunction); // Apply the easing function
					}

					// Attach the animation to the mesh
					mesh.animations.push(glideAnimation);

					// Start the animation
					const animatable = flock.scene.beginAnimation(
						mesh,
						0,
						frames,
						loop,
					);

					animatable.onAnimationEndObservable.add(() => {
						if (!loop) {
							// Ensure the mesh reaches its final destination
							mesh.position = endPosition.clone();
						}

						if (mesh.physics) {
							mesh.physics.disablePreStep = true;
						}

						resolve(); // Resolve after forward motion or loop
					});

					if (reverse && !loop) {
						// When reverse is true but loop is false, manually handle reverse
						animatable.onAnimationEndObservable.add(() => {
							// Create the reverse animation manually (end -> start)
							const reverseAnimation =
								new flock.BABYLON.Animation(
									"reverseGlide",
									"position",
									fps,
									flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
									flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
								);

							const reverseKeys = [
								{ frame: 0, value: endPosition },
								{ frame: frames, value: startPosition },
							];

							reverseAnimation.setKeys(reverseKeys);

							// Attach and start the reverse animation
							mesh.animations.push(reverseAnimation);
							const reverseAnimatable =
								flock.scene.beginAnimation(
									mesh,
									0,
									frames,
									false,
								);

							reverseAnimatable.onAnimationEndObservable.add(
								() => {
									if (mesh.physics) {
										mesh.physics.disablePreStep = true;
									}
									resolve(); // Resolve after reverse completes
								},
							);

							reverseAnimatable.onAnimationEndObservable.add(
								() => {
									mesh.position = startPosition.clone(); // Ensure the mesh returns to the starting position

									if (mesh.physics) {
										mesh.physics.disablePreStep = true;
									}

									resolve(); // Resolve after reverse completes
								},
							);
						});
					} else {
						// If not reversing or infinite looping, resolve after forward motion completes
						animatable.onAnimationEndObservable.add(() => {
							if (mesh.physics) {
								mesh.physics.disablePreStep = true;
							}
							resolve(); // Resolve after forward motion or loop
						});
					}
				} else {
					resolve(); // Resolve immediately if the mesh is not available
				}
			});
		});
	},
	animateKeyFrames(
		meshName,
		keyframes,
		property,
		easing = "Linear",
		loop = false,
		reverse = false,
	) {
		return new Promise(async (resolve) => {
			await flock.whenModelReady(meshName, async function (mesh) {
				if (mesh) {
					let propertyToAnimate;

					// Select the property to animate
					if (property === "color") {
						propertyToAnimate =
							mesh.material.diffuseColor !== undefined
								? "material.diffuseColor"
								: "material.albedoColor";
					} else if (property === "alpha") {
						propertyToAnimate = "material.alpha";
						mesh.material.transparencyMode =
							flock.BABYLON.Material.MATERIAL_ALPHABLEND;
					} else {
						propertyToAnimate = property;
					}

					const fps = 30; // Frames per second for the animation timeline

					const animationType =
						property === "color"
							? flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3
							: ["position", "rotation", "scaling"].includes(
										property,
								  )
								? flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3
								: flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT;

					const keyframeAnimation = new flock.BABYLON.Animation(
						"keyframeAnimation",
						propertyToAnimate,
						fps,
						animationType,
						reverse && loop
							? flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO
							: loop
								? flock.BABYLON.Animation
										.ANIMATIONLOOPMODE_CYCLE
								: flock.BABYLON.Animation
										.ANIMATIONLOOPMODE_CONSTANT,
					);

					// Set up animation keys based on each keyframe's duration
					let currentFrame = 0;
					const animationKeys = keyframes.map((keyframe, index) => {
						let value;
						if (property === "color") {
							value = flock.BABYLON.Color3.FromHexString(
								keyframe.value,
							);
						} else if (
							["position", "rotation", "scaling"].includes(
								property,
							)
						) {
							if (
								keyframe.value instanceof flock.BABYLON.Vector3
							) {
								value = keyframe.value;
							} else if (typeof keyframe.value === "string") {
								const vectorValues =
									keyframe.value.match(/-?\d+(\.\d+)?/g);
								value = new flock.BABYLON.Vector3(
									parseFloat(vectorValues[0]),
									parseFloat(vectorValues[1]),
									parseFloat(vectorValues[2]),
								);
							}
						} else {
							value = parseFloat(keyframe.value);
						}

						// Set the frame based on the cumulative duration up to this point
						if (index > 0) {
							currentFrame += Math.round(
								fps * (keyframes[index].duration || 1),
							);
						}

						return { frame: currentFrame, value };
					});

					// Handle looping: Add a transition back to the first keyframe if looping is enabled
					if (loop && keyframes.length > 1) {
						const firstKeyframe = keyframes[0];
						const loopFrame =
							currentFrame +
							Math.round(fps * firstKeyframe.duration);
						animationKeys.push({
							frame: loopFrame,
							value: animationKeys[0].value,
						});
					}

					// Ensure that keyframes are properly set up and interpolated
					if (animationKeys.length > 1) {
						keyframeAnimation.setKeys(animationKeys);
					} else {
						console.warn("Insufficient keyframes for animation.");
						resolve();
						return;
					}

					if (easing !== "Linear") {
						let easingFunction;
						switch (easing) {
							case "SineEase":
								easingFunction = new flock.BABYLON.SineEase();
								break;
							case "CubicEase":
								easingFunction = new flock.BABYLON.CubicEase();
								break;
							case "QuadraticEase":
								easingFunction =
									new flock.BABYLON.QuadraticEase();
								break;
							case "ExponentialEase":
								easingFunction =
									new flock.BABYLON.ExponentialEase();
								break;
							case "BounceEase":
								easingFunction = new flock.BABYLON.BounceEase();
								break;
							case "ElasticEase":
								easingFunction =
									new flock.BABYLON.ElasticEase();
								break;
							case "BackEase":
								easingFunction = new flock.BABYLON.BackEase();
								break;
							default:
								easingFunction = new flock.BABYLON.SineEase();
						}
						easingFunction.setEasingMode(
							flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
						);
						keyframeAnimation.setEasingFunction(easingFunction);
					}

					mesh.animations.push(keyframeAnimation);

					if (property === "alpha") {
						mesh.material.markAsDirty(
							flock.BABYLON.Material.MiscDirtyFlag,
						);
					}

					const animatable = flock.scene.beginAnimation(
						mesh,
						0,
						currentFrame,
						loop,
					);

					if (reverse && !loop) {
						animatable.onAnimationEndObservable.addOnce(() => {
							flock.scene
								.beginAnimation(mesh, currentFrame, 0, false)
								.onAnimationEndObservable.add(() => {
									resolve();
								});
						});
					} else {
						animatable.onAnimationEndObservable.add(() =>
							resolve(),
						);
					}
				} else {
					resolve();
				}
			});
		});
	},
	setPivotPoint(meshName, xPivot, yPivot, zPivot) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (mesh) {
				// Get the bounding box of the mesh
				const boundingBox =
					mesh.getBoundingInfo().boundingBox.extendSize;

				// Helper function to resolve 'min', 'centre', or 'max' into numeric values
				function resolvePivotValue(axisValue, axis) {
					switch (axisValue) {
						case Number.MIN_SAFE_INTEGER:
							return -boundingBox[axis]; // Min: Negative extent along the axis
						case Number.MAX_SAFE_INTEGER:
							return boundingBox[axis]; // Max: Positive extent along the axis
						case 0:
						default:
							return 0; // Centre: Return 0 for the axis
					}
				}

				// Resolve each pivot point for X, Y, and Z axes
				const resolvedX = resolvePivotValue(xPivot, "x");
				const resolvedY = resolvePivotValue(yPivot, "y");
				const resolvedZ = resolvePivotValue(zPivot, "z");

				// Set the pivot point for the main mesh
				const pivotPoint = new flock.BABYLON.Vector3(
					resolvedX,
					resolvedY,
					resolvedZ,
				);
				mesh.setPivotPoint(pivotPoint);

				// Optionally apply the pivot to child meshes
				mesh.getChildMeshes().forEach((child) => {
					child.setPivotPoint(pivotPoint);
				});
			}
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

		let parentPickable = false;
		if (mesh.isPickable) {
			parentPickable = true;
			mesh.isPickable = false;
		}

		const descendants = mesh.getChildMeshes(false);
		descendants.forEach((childMesh) => {
			if (childMesh.getTotalVertices() > 0) {
				childMesh.isPickable = false;
			}
		});
		const hit = flock.scene.pickWithRay(ray);
		descendants.forEach((childMesh) => {
			if (childMesh.getTotalVertices() > 0) {
				childMesh.isPickable = true;
			}
		});

		if (parentPickable) mesh.ispickable = true;

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
			const colorDiv = flock.document.createElement("div");
			colorDiv.style.color = colourString;
			flock.document.body.appendChild(colorDiv);
			const computedColor = getComputedStyle(colorDiv).color;
			flock.document.body.removeChild(colorDiv);
			return flock.rgbToHex(computedColor);
		} catch (e) {
			return "#000000";
		}
	},
	changeColour(modelName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
			flock.changeColourMesh(mesh, color);
		});
	},
	changeColourMesh(mesh, color) {
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
				materialFound = true;
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
			material.diffuseColor = flock.BABYLON.Color3.FromHexString(color);
			mesh.material = material;
		}
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
	setMaterial(modelName, material) {
		return flock.whenModelReady(modelName, (mesh) => {
			mesh.material = material;
		});
	},
	createMaterial(
		albedoColor,
		emissiveColor,
		textureSet,
		metallic,
		roughness,
		alpha,
	) {
		let material;

		console.log(textureSet);

		// Check if PBR is needed
		if (metallic > 0 || roughness < 1) {
			material = new flock.BABYLON.PBRMetallicRoughnessMaterial(
				"material",
				flock.scene,
			);

			// Set albedoColor correctly for PBRMaterial
			material.baseColor =
				flock.BABYLON.Color3.FromHexString(albedoColor);

			material.metallic = metallic;
			material.roughness = roughness;

			// Apply texture to the albedoTexture for PBR materials
			if (textureSet !== "none.png") {
				const baseTexturePath = `./textures/${textureSet}`;
				material.baseTexture = new flock.BABYLON.Texture(
					baseTexturePath,
					flock.scene,
				);

				const normalTexturePath = `./textures/normal/${textureSet}`;
				material.normalTexture = new flock.BABYLON.Texture(
					normalTexturePath,
					flock.scene,
				);
			}

			if (flock.scene.environmentTexture) {
				material.environmentTexture = flock.scene.environmentTexture;
			} else {
				console.warn("No environmentTexture found for the scene.");
			}
		} else {
			material = new flock.BABYLON.StandardMaterial(
				"material",
				flock.scene,
			);

			material.diffuseColor =
				flock.BABYLON.Color3.FromHexString(albedoColor);

			if (textureSet !== "none.png") {
				const baseTexturePath = `./textures/${textureSet}`;
				material.diffuseTexture = new flock.BABYLON.Texture(
					baseTexturePath,
					flock.scene,
				);

				const normalTexturePath = `./textures/normal/${textureSet}`;
				material.bumpTexture = new flock.BABYLON.Texture(
					normalTexturePath,
					flock.scene,
				);
			}
		}

		material.emissiveColor =
			flock.BABYLON.Color3.FromHexString(emissiveColor);

		material.alpha = alpha;
		return material;
	},
	textMaterial(text, color, backgroundColor, width, height, textSize) {
		const dynamicTexture = new flock.BABYLON.DynamicTexture(
			"text texture",
			{ width: width, height: height },
			flock.scene,
		);
		dynamicTexture.drawText(
			text,
			null,
			null,
			`bold ${textSize}px Asap`,
			color,
			backgroundColor,
			true,
		);

		const material = new flock.BABYLON.StandardMaterial(
			"textMaterial",
			flock.scene,
		);

		material.diffuseTexture = dynamicTexture;

		return material;
	},
	createDecal(
		modelName,
		posX = 0,
		posY = 0,
		posZ = 0.5, // Front face of the wall at z = 0.5
		normalX = 0,
		normalY = 0,
		normalZ = -1, // Normal facing the negative z-axis (toward the camera)
		sizeX = 3,
		sizeY = 3,
		sizeZ = 1,
		material, // Material passed as a parameter
	) {
		return flock.whenModelReady(modelName, (mesh) => {
			// Log the passed material to ensure it is available
			console.log("Material:", material);

			if (!material || !material.diffuseTexture) {
				console.error(
					"Material does not have a diffuse texture. Cannot apply decal.",
				);
				return;
			}

			// Ensure the material properties are correct
			material.diffuseTexture.hasAlpha = true;
			material.zOffset = -2;

			// Define the position and normal for the decal
			const position = new flock.BABYLON.Vector3(posX, posY, posZ);
			const normal = new flock.BABYLON.Vector3(normalX, normalY, normalZ);

			// Define the decal size
			const decalSize = new flock.BABYLON.Vector3(sizeX, sizeY, sizeZ);

			const decal = flock.BABYLON.MeshBuilder.CreateDecal("decal", mesh, {
				position: position,
				normal: normal,
				size: decalSize,
			});

			// Apply the passed material to the decal
			decal.material = material;
			decal.setParent(mesh);
			console.log("Decal applied with provided material.");
		});
	},
	placeDecal(material, angle = 0) {
		const pickResult = flock.scene.pick(
			flock.scene.pointerX,
			flock.scene.pointerY,
		);
		if (pickResult.hit) {
			const normal = flock.scene.activeCamera
				.getForwardRay()
				.direction.negateInPlace()
				.normalize();
			const position = pickResult.pickedPoint;
			const mesh = pickResult.pickedMesh;
			const decalSize = new flock.BABYLON.Vector3(1, 1, 1);
			material.diffuseTexture.hasAlpha = true;
			material.zOffset = -2;

			const decal = flock.BABYLON.MeshBuilder.CreateDecal("decal", mesh, {
				position: position,
				normal: normal,
				size: decalSize,
				angle: angle,
			});

			// Apply the passed material to the decal
			decal.material = material;
			material.disableDepthWrite;
			decal.setParent(mesh);
		}
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
	moveSideways(modelName, speed) {
		//return;
		const model = flock.scene.getMeshByName(modelName);
		if (!model || speed === 0) return;

		const sidewaysSpeed = speed;

		// Get the camera's right direction vector (perpendicular to the forward direction)
		const cameraRight = flock.scene.activeCamera
			.getDirection(
				flock.BABYLON.Vector3.Left(), //Yes, we're the wrong side of the player! Need to fix
			)
			.normalize();

		const moveDirection = cameraRight.scale(sidewaysSpeed);
		const currentVelocity = model.physics.getLinearVelocity();

		// Set linear velocity in the sideways direction
		model.physics.setLinearVelocity(
			new flock.BABYLON.Vector3(
				moveDirection.x,
				currentVelocity.y, // Keep Y velocity (no vertical movement)
				moveDirection.z,
			),
		);

		// Rotate the model to face the direction of movement
		const facingDirection =
			sidewaysSpeed >= 0
				? new flock.BABYLON.Vector3(
						-cameraRight.x,
						0,
						-cameraRight.z,
					).normalize() // Right
				: new flock.BABYLON.Vector3(
						cameraRight.x,
						0,
						cameraRight.z,
					).normalize(); // Left

		const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
			facingDirection,
			flock.BABYLON.Vector3.Up(),
		);

		const currentRotation = model.rotationQuaternion;
		const deltaRotation = targetRotation.multiply(
			currentRotation.conjugate(),
		);
		const deltaEuler = deltaRotation.toEulerAngles();

		// Apply angular velocity to smoothly rotate the player
		model.physics.setAngularVelocity(
			new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
		);

		// Normalize the model's rotation to avoid drift
		model.rotationQuaternion.x = 0;
		model.rotationQuaternion.z = 0;
		model.rotationQuaternion.normalize();
	},
	strafe(modelName, speed) {
		const model = flock.scene.getMeshByName(modelName);
		if (!model || speed === 0) return;

		const sidewaysSpeed = -speed;

		// Get the camera's right direction vector (perpendicular to the forward direction)
		const cameraRight = flock.scene.activeCamera
			.getForwardRay()
			.direction.cross(flock.BABYLON.Vector3.Up())
			.normalize();

		const moveDirection = cameraRight.scale(sidewaysSpeed);
		const currentVelocity = model.physics.getLinearVelocity();

		// Set linear velocity in the sideways direction (left or right)
		model.physics.setLinearVelocity(
			new flock.BABYLON.Vector3(
				moveDirection.x,
				currentVelocity.y,
				moveDirection.z,
			),
		);

		/*
		// Determine which direction the model should face based on sideways movement
		const facingDirection =
			speed >= 0
				? new flock.BABYLON.Vector3(-cameraRight.x, 0, -cameraRight.z).normalize()  // Move right
				: new flock.BABYLON.Vector3(cameraRight.x, 0, cameraRight.z).normalize();   // Move left

		const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
			facingDirection,
			flock.BABYLON.Vector3.Up(),
		);

		const currentRotation = model.rotationQuaternion;
		const deltaRotation = targetRotation.multiply(
			currentRotation.conjugate(),
		);
		const deltaEuler = deltaRotation.toEulerAngles();

		// Apply angular velocity to smoothly rotate the model
		model.physics.setAngularVelocity(
			new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
		);

		// Normalize the model's rotation to avoid gimbal lock or rotation drift
		model.rotationQuaternion.x = 0;
		model.rotationQuaternion.z = 0;
		model.rotationQuaternion.normalize();
		*/
	},
	attachCamera(modelName, radius) {
		return flock.whenModelReady(modelName, function (mesh) {
			if (mesh) {
				flock.updateDynamicMeshPositions(flock.scene, [mesh]);
				let camera = flock.scene.activeCamera;

				if (camera.getClassName() !== "ArcRotateCamera") {
					const newBox = flock.BABYLON.MeshBuilder.CreateBox(
						"staticMesh",
						{ height: 1, width: 1, depth: 1 },
					);
					newBox.position = new flock.BABYLON.Vector3(0, -4, 0);

					newBox.blockKey = newBox.name;
					newBox.name = newBox.name + "_" + newBox.uniqueId;
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

					function createVerticalConstraint(
						mesh,
						referenceBody,
						scene,
					) {
						let constraint =
							new flock.BABYLON.Physics6DoFConstraint(
								{
									axisA: new flock.BABYLON.Vector3(1, 0, 0), // trying to turn the car
									axisB: new flock.BABYLON.Vector3(1, 0, 0),
									perpAxisA: new flock.BABYLON.Vector3(
										0,
										1,
										0,
									),
									perpAxisB: new flock.BABYLON.Vector3(
										0,
										1,
										0,
									),
								},
								[
									{
										axis: flock.BABYLON
											.PhysicsConstraintAxis.ANGULAR_X,
										minLimit: 0,
										maxLimit: 0,
									},
									{
										axis: flock.BABYLON
											.PhysicsConstraintAxis.ANGULAR_Z,
										minLimit: 0,
										maxLimit: 0,
									},
								],
								scene,
							);

						// Ensure both bodies are defined before adding constraint
						if (mesh && referenceBody) {
							mesh.physics.addConstraint(
								referenceBody,
								constraint,
							);
						} else {
							console.error(
								"Mesh body or reference body is not defined",
							);
						}
					}
					// Create the constraint for the platform
					createVerticalConstraint(mesh, boxBody, flock.scene);
					flock.scene.onAfterPhysicsObservable.add(() => {
						const currentVelocity =
							mesh.physics.getLinearVelocity();
						const newVelocity = new flock.BABYLON.Vector3(
							0,
							currentVelocity.y,
							0,
						);
						mesh.physics.setLinearVelocity(newVelocity);
						mesh.physics.setAngularVelocity(
							flock.BABYLON.Vector3.Zero(),
						);
					});

					camera = new flock.BABYLON.ArcRotateCamera(
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
					camera.panningSensibility = 0;

					camera.inputs.removeByType(
						"ArcRotateCameraMouseWheelInput",
					);

					camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
					camera.inputs.attached.pointers.multiTouchPanning = false;
					camera.inputs.attached.pointers.pinchZoom = false;
					camera.inputs.attached.pointers.pinchInwards = false;
					camera.inputs.attached.pointers.useNaturalPinchZoom = true;

					camera.inputs.removeByType(
						camera.inputs.attached.mousewheel,
					);

					camera.inputs.attached.pointers.onMultiTouch = function () {
						// Do nothing to disable multi-touch behavior in Babylon.js
					};
				}
				camera.setTarget(mesh.position);
				camera.metadata = camera.metadata || {};
				camera.metadata.following = mesh;
				camera.attachControl(flock.canvas, false);
				flock.scene.activeCamera = camera;
			} else {
				console.log("Model not loaded:", modelName);
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

				//const rayHelper = new flock.BABYLON.RayHelper(ray);

				let parentPickable = false;
				if (mesh.isPickable) {
					parentPickable = true;
					mesh.isPickable = false;
				}

				const descendants = mesh.getChildMeshes(false); // 'false' gets all descendants
				descendants.forEach((childMesh) => {
					if (childMesh.getTotalVertices() > 0) {
						// Ensure it has geometry
						childMesh.isPickable = false;
					}
				});
				const hit = flock.scene.pickWithRay(ray);
				descendants.forEach((childMesh) => {
					if (childMesh.getTotalVertices() > 0) {
						// Ensure it has geometry
						childMesh.isPickable = true;
					}
				});

				if (parentPickable) mesh.ispickable = true;

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
			flock.scene.activeCamera.attachControl(flock.canvas, false);
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
					plane.scalingDeterminant = 1;
					plane.computeWorldMatrix();
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
						const timeoutId = setTimeout(function () {
							stackPanel.removeControl(bg);
							bg.dispose();
							textBlock.dispose();
							resolve();
						}, duration * 1000);

						// Listen for abort signal to cancel the timeout
						flock.abortController.signal.addEventListener(
							"abort",
							() => {
								clearTimeout(timeoutId); // Clear the timeout if aborted
								bg.dispose(); // Optionally dispose of resources to avoid memory leaks
								textBlock.dispose();
								resolve(new Error("Action aborted"));
							},
						);
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
	onTrigger(modelName, trigger, doCode) {
		return flock.whenModelReady(modelName, async function (mesh) {
			if (mesh) {
				if (!mesh.actionManager) {
					mesh.actionManager = new flock.BABYLON.ActionManager(
						flock.scene,
					);
					mesh.actionManager.isRecursive = true;
				}

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
			} else {
				console.log("Model not loaded:", modelName);
			}
		});
	},
	onIntersect(modelName, otherModelName, trigger, doCode) {
		return flock.whenModelReady(modelName, async function (mesh) {
			if (!mesh) {
				console.error("Model not loaded:", modelName);
				return;
			}

			// Load the second model
			return flock.whenModelReady(
				otherModelName,
				async function (otherMesh) {
					if (!otherMesh) {
						console.error("Model not loaded:", otherModelName);
						return;
					}

					// Initialize actionManager if not present
					if (!mesh.actionManager) {
						mesh.actionManager = new flock.BABYLON.ActionManager(
							flock.scene,
						);
						mesh.actionManager.isRecursive = true;
					}

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
				},
			);
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
	getAudioContext() {
		if (!flock.audioContext) {
			flock.audioContext = new (window.AudioContext ||
				window.webkitAudioContext)();
		}
		return flock.audioContext;
	},
	playNotes(meshName, notes, durations, instrument = null) {
		return new Promise((resolve) => {
			flock.whenModelReady(meshName, async function (mesh) {
				notes = notes.map((note) => (note === "_" ? null : note));
				durations = durations.map(Number);

				const getBPM = (obj) => obj?.metadata?.bpm || null;
				const getBPMFromMeshOrScene = (mesh, scene) =>
					getBPM(mesh) || getBPM(mesh?.parent) || getBPM(scene) || 60;
				const bpm = getBPMFromMeshOrScene(mesh, flock.scene);

				const context = flock.audioContext; // Ensure a global audio context

				if (mesh && mesh.position) {
					// Create the panner node only once if it doesn't exist
					if (!mesh.metadata.panner) {
						const panner = context.createPanner();
						mesh.metadata.panner = panner;

						// Configure the panner for spatial effects
						panner.panningModel = "HRTF";
						panner.distanceModel = "inverse";
						panner.refDistance = 0.5;
						panner.maxDistance = 50;
						panner.rolloffFactor = 2;
						panner.connect(context.destination);
					}

					const panner = mesh.metadata.panner; // Reuse the same panner node

					// Continuously update the panner position while notes are playing
					const observer = flock.scene.onBeforeRenderObservable.add(
						() => {
							const { x, y, z } = mesh.position;
							panner.positionX.value = -x;
							panner.positionY.value = y;
							panner.positionZ.value = z;
						},
					);

					// Iterate over the notes and schedule playback
					let offsetTime = 0;
					for (let i = 0; i < notes.length; i++) {
						const note = notes[i];
						const duration = Number(durations[i]);

						if (note !== null) {
							flock.playMidiNote(
								context,
								mesh,
								note,
								duration,
								bpm,
								context.currentTime + offsetTime, // Schedule the note
								instrument,
							);
						}

						offsetTime += flock.durationInSeconds(duration, bpm);
					}

					// Resolve the promise after the last note has played
					setTimeout(
						() => {
							flock.scene.onBeforeRenderObservable.remove(
								observer,
							);
							resolve();
						},
						(offsetTime + 1) * 1000,
					); // Add a small buffer after the last note finishes
				} else {
					console.error(
						"Mesh does not have a position property:",
						mesh,
					);
					resolve();
				}
			});
		});
	},
	updateListenerPositionAndOrientation(context, camera) {
		const { x: cx, y: cy, z: cz } = camera.position;
		const forwardVector = camera.getForwardRay().direction;

		// Update listener's position
		context.listener.positionX.setValueAtTime(cx, context.currentTime);
		context.listener.positionY.setValueAtTime(cy, context.currentTime);
		context.listener.positionZ.setValueAtTime(cz, context.currentTime);

		// Update listener's forward direction
		context.listener.forwardX.setValueAtTime(
			-forwardVector.x,
			context.currentTime,
		);
		context.listener.forwardY.setValueAtTime(
			forwardVector.y,
			context.currentTime,
		);
		context.listener.forwardZ.setValueAtTime(
			forwardVector.z,
			context.currentTime,
		);

		// Set the listener's up vector (typically pointing upwards in the Y direction)
		context.listener.upX.setValueAtTime(0, context.currentTime);
		context.listener.upY.setValueAtTime(1, context.currentTime);
		context.listener.upZ.setValueAtTime(0, context.currentTime);
	},
	playMidiNote(
		context,
		mesh,
		note,
		duration,
		bpm,
		playTime,
		instrument = null,
	) {
		// Create a new oscillator for each note
		const osc = context.createOscillator();
		const panner = mesh.metadata.panner;
		// If an instrument is provided, reuse its gainNode but create a new oscillator each time
		const gainNode = instrument
			? instrument.gainNode
			: context.createGain();

		// Set oscillator type based on the instrument or default to 'sine'
		osc.type = instrument ? instrument.oscillator.type : "sine";
		osc.frequency.value = flock.midiToFrequency(note); // Convert MIDI note to frequency

		// Connect the oscillator to the gain node and panner
		osc.connect(gainNode);
		gainNode.connect(panner);
		panner.connect(context.destination);

		const gap = Math.min(0.05, (60 / bpm) * 0.05); // Slightly larger gap

		gainNode.gain.setValueAtTime(
			1,
			Math.max(playTime, context.currentTime + 0.01),
		);

		const fadeOutDuration = Math.min(0.2, duration * 0.2); // Longer fade-out for clarity

		gainNode.gain.linearRampToValueAtTime(
			0,
			playTime + duration - gap - fadeOutDuration,
		); // Gradual fade-out

		osc.start(playTime); // Start the note at playTime
		osc.stop(playTime + duration - gap); // Stop slightly earlier to add a gap

		// Clean up: disconnect the oscillator after it's done
		osc.onended = () => {
			osc.disconnect();
		};

		// Fallback clean-up in case osc.onended is not triggered
		setTimeout(
			() => {
				if (osc) {
					osc.disconnect();
				}
			},
			(playTime + duration) * 1000,
		);
	},
	midiToFrequency(note) {
		return 440 * Math.pow(2, (note - 69) / 12); // Convert MIDI note to frequency
	},
	durationInSeconds(duration, bpm) {
		return (60 / bpm) * duration; // Convert beats to seconds
	},
	setPanning(panner, mesh) {
		const position = mesh.position;
		panner.setPosition(position.x, position.y, position.z); // Pan based on mesh position
	},
	createInstrument(type, frequency, attack, decay, sustain, release) {
		const audioCtx = flock.audioContext;
		const oscillator = audioCtx.createOscillator();
		const gainNode = audioCtx.createGain();

		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

		// Create ADSR envelope
		gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
		gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + attack);
		gainNode.gain.linearRampToValueAtTime(
			sustain,
			audioCtx.currentTime + attack + decay,
		);
		gainNode.gain.linearRampToValueAtTime(
			0,
			audioCtx.currentTime + attack + decay + release,
		);

		oscillator.connect(gainNode).connect(audioCtx.destination);

		return { oscillator, gainNode, audioCtx };
	},
	download(filename, data, mimeType) {
		const blob = new Blob([data], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = flock.document.createElement("a");
		a.href = url;
		a.download = filename;
		flock.document.body.appendChild(a);
		a.click();
		flock.document.body.removeChild(a);
		URL.revokeObjectURL(url);
	},
	setBPM(bpm, meshName = null) {
		if (meshName) {
			return flock.whenModelReady(meshName, async function (mesh) {
				if (mesh) {
					if (!mesh.metadata) mesh.metadata = {};
					mesh.metadata.bpm = bpm;
				}
			});
		} else {
			if (!flock.scene.metadata) flock.scene.metadata = {};
			flock.scene.metadata.bpm = bpm;
		}
	},
	exportMesh(meshName, format) {
		return flock.whenModelReady(meshName, async function (mesh) {
			const rootChild = mesh
				.getChildMeshes()
				.find((child) => child.name === "__root__");
			if (rootChild) {
				mesh = rootChild;
			}

			const childMeshes = mesh.getChildMeshes(false);

			// Combine the parent mesh with its children
			const meshList = [mesh, ...childMeshes];
			if (format === "STL") {
				const stlData = flock.EXPORT.STLExport.CreateSTL(
					meshList,
					true,
					mesh.name,
					false,
					false,
				);
			} else if (format === "OBJ") {
				const objData = flock.EXPORT.OBJExport.OBJ(mesh);
				download(mesh.name + ".obj", objData, "text/plain");
			} else if (format === "GLB") {
				flock.EXPORT.GLTF2Export.GLBAsync(
					meshList,
					mesh.name + ".glb",
				).then((glbData) => {
					const blob = new Blob([glbData.glb], {
						type: "model/gltf-binary",
					});
					download(mesh.name + ".glb", blob, "model/gltf-binary");
				});
			}
		});
	},
};

export function initializeFlock() {
	const scriptElement = flock.document.getElementById("flock");
	if (scriptElement) {
		flock
			.initialize()
			.then(() => {
				const userCode = scriptElement.textContent;
				flock.runCode(userCode);
			})
			.catch((error) => {
				console.error("Error initializing flock:", error);
			});
	}
}
