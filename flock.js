// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from "@babylonjs/havok";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import "@babylonjs/loaders";
import { GradientMaterial } from "@babylonjs/materials";
import * as BABYLON_EXPORT from "@babylonjs/serializers";
import { FlowGraphLog10Block, SetMaterialIDBlock } from "babylonjs";
import "@fontsource/asap";
import "@fontsource/asap/500.css";
import "@fontsource/asap/600.css";
import earcut from "earcut";
import { characterNames } from "./config";
import { flockCSG, setFlockReference as setFlockCSG } from "./api/csg";
import {
	flockAnimate,
	setFlockReference as setFlockAnimate,
} from "./api/animate";
import { flockSound, setFlockReference as setFlockSound } from "./api/sound";
import { flockUI, setFlockReference as setFlockUI } from "./api/ui";
import {
	flockMovement,
	setFlockReference as setFlockMovement,
} from "./api/movement";
import { flockModels, setFlockReference as setFlockModels } from "./api/models";
import { flockShapes, setFlockReference as setFlockShapes } from "./api/shapes";
import {
	flockTransform,
	setFlockReference as setFlockTransform,
} from "./api/transform";
import {
	flockMaterial,
	setFlockReference as setFlockMaterial,
} from "./api/material";
import {
	flockEffects,
	setFlockReference as setFlockEffects,
} from "./api/effects";
import {
	flockPhysics,
	setFlockReference as setFlockPhysics,
} from "./api/physics";
// Helper functions to make flock.BABYLON js easier to use in Flock
console.log("Flock helpers loading");

export const flock = {
	console: console,
	modelPath: "./models/",
	soundPath: "./sounds/",
	imagePath: "./images/",
	texturePath: "./textures/",
	engine: null,
	engineReady: false,
	characterNames: characterNames,
	alert: alert,
	BABYLON: BABYLON,
	GradientMaterial: GradientMaterial,
	scene: null,
	highlighter: null,
	glowLayer: null,
	mainLight: null,
	hk: null,
	havokInstance: null,
	ground: null,
	sky: null,
	GUI: null,
	EXPORT: null,
	controlsTexture: null,
	canvas: {
		pressedKeys: null,
	},
	abortController: null,
	document: document,
	disposed: null,
	events: {},
	modelCache: {},
	globalSounds: [],
	originalModelTransformations: {},
	modelsBeingLoaded: {},
	geometryCache: {},
	materialCache: {},
	flockNotReady: true,
	lastFrameTime: 0,
	savedCamera: null,
	...flockCSG,
	...flockAnimate,
	...flockSound,
	...flockUI,
	...flockMovement,
	...flockModels,
	...flockShapes,
	...flockTransform,
	...flockMaterial,
	...flockEffects,
	...flockPhysics,
	async runCode(code) {
		let iframe = document.getElementById("flock-iframe");

		try {
			// Step 1: Dispose old scene if iframe exists
			if (iframe) {
				await iframe.contentWindow?.flock?.disposeOldScene();
			} else {
				// Step 2: Create a new iframe if not found
				iframe = document.createElement("iframe");
				iframe.id = "flock-iframe";
				iframe.style.display = "none";
				document.body.appendChild(iframe);
			}

			// Step 3: Wait for iframe to load
			await new Promise((resolve, reject) => {
				iframe.onload = () => resolve();
				iframe.onerror = () =>
					reject(new Error("Failed to load iframe"));
				iframe.src = "about:blank";
			});

			// Step 4: Access iframe window and set up flock
			const iframeWindow = iframe.contentWindow;
			if (!iframeWindow) throw new Error("Iframe window is unavailable");

			iframeWindow.flock = flock;

			await iframeWindow.flock.initializeNewScene();

			// Step 6: Create sandboxed function
			const sandboxFunction = new iframeWindow.Function(`
			"use strict";

			const {
				initialize,
				createEngine,
				createScene,
				playAnimation,
				playSound,
				stopAllSounds,
				playNotes,
				setBPM,
				createInstrument,
				switchAnimation,
				highlight,
				glow,
				createCharacter,
				createObject,
				createParticleEffect,
				create3DText,
				createModel,
				createBox,
				createSphere,
				createCylinder,
				createCapsule,
				createPlane,
				cloneMesh,
				parentChild,
				setParent,
				mergeMeshes,
				subtractMeshes,
				intersectMeshes,
				createHull,
				hold, 
				drop,
				makeFollow,
				stopFollow,
				removeParent,
				createGround,
				createMap,
				createCustomMap,
				setSky,
				lightIntensity,
				buttonControls,
				getCamera,
				cameraControl,
				setCameraBackground,
				setXRMode,
				applyForce,
				moveByVector,
				glideTo,
				createAnimation,
				animateFrom,
				playAnimationGroup, 
				pauseAnimationGroup, 
				stopAnimationGroup,
				startParticleSystem,
				stopParticleSystem,
				resetParticleSystem,
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
				stopAnimations,
				tint,
				setAlpha,
				dispose,
				setFog,
				keyPressed,
				isTouchingSurface,
				seededRandom,
				randomColour,
				scaleMesh,
				resizeMesh,
				changeColor,
				changeColorMesh,
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
				setPhysicsShape,
				checkMeshesTouching,
				say,
				onTrigger,
				onEvent,
				broadcastEvent,
				Mesh,
				start,
				forever,
				whenKeyEvent,
				randomInteger,
				printText,
				UIText,
				UIButton,
				onIntersect,
				getProperty,
				exportMesh,
				abortSceneExecution,
				ensureUniqueGeometry,
			} = flock;

			${code}
			`);

			try {
				sandboxFunction();
			} catch (sandboxError) {
				throw new Error(
					`Sandbox execution failed: ${sandboxError.message}`,
				);
			}
		} catch (error) {
			// General Error Handling
			console.error("Error during scene setup or code execution:", error);

			// Clean up resources and stop execution
			try {
				flock.audioContext.close();
				flock.engine.stopRenderLoop();
				flock.removeEventListeners();
			} catch (cleanupError) {
				console.error("Error during cleanup:", cleanupError);
			}
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
		flock.ground = null;
		flock.sky = null;
		flock.engineReady = false;
		flock.meshLoaders = new Map();

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

		try {
			await flock.BABYLON.InitializeCSG2Async();
		} catch (error) {
			console.error("Error initializing CSG2:", error);
		}

		flock.canvas.addEventListener(
			"touchend",
			(event) => {
				//flock.printText(`Canvas: Touch End ${event.touches.length}`, 5);
				//logTouchDetails(event);

				if (event.touches.length === 0) {
					const input =
						flock.scene.activeCamera.inputs?.attached?.pointers;
					// Add null check for input itself
					if (
						input &&
						(input._pointA !== null ||
							input._pointB !== null ||
							input._isMultiTouch === true)
					) {
						//flock.printText("Stuck state detected!");
						flock.scene.activeCamera.detachControl(flock.canvas);
						setTimeout(() => {
							flock.scene.activeCamera.attachControl(
								flock.canvas,
								true,
							);
							//console.log("Camera inputs reset!");
						}, 100); // Small delay
					}
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

		flock.canvas.addEventListener("blur", () => {
			// Clear all pressed keys when window loses focus
			flock.canvas.pressedKeys.clear();
			flock.canvas.pressedButtons.clear();
		});

		flock.engineReady = true;
	},
	createEngine() {
		flock.engine?.dispose();
		flock.engine = null;

		flock.engine = new flock.BABYLON.Engine(flock.canvas, true, {
			stencil: true,
			deterministicLockstep: true,
			//audioEngine: true,
		});

		flock.engine.enableOfflineSupport = false;
		flock.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
	},
	async disposeOldScene() {
		console.log("Disposing old scene");
		flock.flockNotReady = true;
		if (flock.scene) {
			flock.stopAllSounds();
			flock.engine.stopRenderLoop();
			flock.scene.meshes.forEach((mesh) => {
				if (mesh.actionManager) {
					mesh.actionManager.dispose(); // Dispose the action manager to remove all actions
				}
			});
			flock.scene.activeCamera?.inputs?.clear();
			flock.events = null;
			flock.modelCache = null;
			flock.globalSounds = [];
			flock.modelsBeingLoaded = null;
			flock.originalModelTransformations = null;
			flock.geometryCache = null;
			flock.materialCache = null;
			flock.ground = null;
			flock.sky = null;
			// Abort any ongoing operations if applicable
			if (flock.abortController) {
				flock.abortController.abort(); // Abort any pending operations
				flock.scene.stopAllAnimations();

				// Wait briefly to ensure all asynchronous tasks complete
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			// Remove event listeners before disposing of the scene
			flock.removeEventListeners();

			flock.controlsTexture?.dispose();
			flock.controlsTexture = null;

			flock.gridKeyPressObservable?.clear();
			flock.gridKeyReleaseObservable?.clear();

			flock.highlighter?.dispose();
			flock.highlighter = null;
			flock.glowLayer?.dispose();
			flock.glowLayer = null;
			flock.mainLight?.dispose();
			flock.mainLight = null;

			// Dispose of the scene directly
			flock.scene.activeCamera?.inputs?.clear();

			flock.scene.dispose();
			flock.scene = null;

			flock.hk?.dispose();
			flock.hk = null;

			if (flock.audioContext?.state !== "closed") {
				flock.audioContext?.close();
			}

			flock.audioContext = null;
		}
	},
	async initializeNewScene() {
		// Stop existing render loop or create a new engine
		flock.engine ? flock.engine.stopRenderLoop() : flock.createEngine();

		// Reset scene-wide state
		flock.events = {};
		flock.modelCache = {};
		flock.globalSounds = [];
		flock.modelsBeingLoaded = {};
		flock.originalModelTransformations = {};
		flock.geometryCache = {};
		flock.materialCache = {};
		flock.disposed = false;

		// Create the new scene
		flock.scene = new flock.BABYLON.Scene(flock.engine);

		// Abort controller for clean-up
		flock.abortController = new AbortController();

		// Start the render loop
		flock.engine.runRenderLoop(() => {
			flock.scene.render();
		});

		// Enable physics
		flock.hk = new flock.BABYLON.HavokPlugin(true, flock.havokInstance);
		flock.scene.enablePhysics(
			new flock.BABYLON.Vector3(0, -9.81, 0),
			flock.hk,
		);
		setFlockCSG(flock);
		setFlockAnimate(flock);
		setFlockSound(flock);
		setFlockUI(flock);
		setFlockMovement(flock);
		setFlockModels(flock);
		setFlockShapes(flock);
		setFlockTransform(flock);
		setFlockMaterial(flock);
		setFlockEffects(flock);
		setFlockPhysics(flock);
		
		// Add highlight layer
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
		flock.savedCamera = camera;
		camera.minZ = 0;
		camera.setTarget(flock.BABYLON.Vector3.Zero());
		camera.rotation.x = flock.BABYLON.Tools.ToRadians(0);
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		camera.speed = 0.25;
		flock.scene.activeCamera = camera;
		camera.attachControl(flock.canvas, false);
		// Set up lighting
		const hemisphericLight = new flock.BABYLON.HemisphericLight(
			"hemisphericLight",
			new flock.BABYLON.Vector3(1, 1, 0),
			flock.scene,
		);
		hemisphericLight.intensity = 1.0;
		hemisphericLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
		hemisphericLight.groundColor = new flock.BABYLON.Color3(0.5, 0.5, 0.5);

		flock.mainLight = hemisphericLight;

		flock.audioEnginePromise = flock.BABYLON.CreateAudioEngineAsync({
			volume: 1,
			listenerAutoUpdate: true,
			listenerEnabled: true,
			resumeOnInteraction: true,
		});

		flock.audioEnginePromise.then((audioEngine) => {
			flock.audioEngine = audioEngine;
			flock.globalStartTime = flock.getAudioContext().currentTime;
			if (flock.scene.activeCamera) {
				audioEngine.listener.attach(flock.scene.activeCamera);
			}

			// Reattach listener if the active camera ever changes
			flock.scene.onActiveCameraChanged.add(() => {
				audioEngine.listener.attach(flock.scene.activeCamera);
			});
		});

		// Enable collisions
		flock.scene.collisionsEnabled = true;

		const isTouchScreen =
			"ontouchstart" in window ||
			navigator.maxTouchPoints > 0 ||
			window.matchMedia("(pointer: coarse)").matches;

		if (isTouchScreen) {
			flock.controlsTexture =
				flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
			flock.createArrowControls("white");
			flock.createButtonControls("white");
		}

		// Create the UI
		flock.advancedTexture =
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

		// Stack panel for text
		flock.stackPanel = new flock.GUI.StackPanel();
		flock.stackPanel.width = "100%"; // Fixed width for the panel
		flock.stackPanel.horizontalAlignment =
			flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align to the left
		flock.stackPanel.verticalAlignment =
			flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align to the top

		flock.stackPanel.isVertical = true;
		flock.advancedTexture.addControl(flock.stackPanel);

		// Observable for audio updates

		flock.scene.onBeforeRenderObservable.add(() => {
			const context = flock.getAudioContext();
			flock.updateListenerPositionAndOrientation(
				context,
				flock.scene.activeCamera,
			);
		});

		// Mark scene as ready
		flock.flockNotReady = false;

		// Reset XR helper
		flock.xrHelper = null;
	},
	randomInteger(a, b) {
		if (a > b) {
			// Swap a and b to ensure a is smaller.
			var c = a;
			a = b;
			b = c;
		}
		return Math.floor(Math.random() * (b - a + 1) + a);
	},
	printText(text, duration = 30, color = "white") {
		if (!flock.scene || !flock.stackPanel) return;

		console.log(text);
		try {
			// Create a rectangle container for the text
			const bg = new flock.GUI.Rectangle("textBackground");
			bg.background = "rgba(255, 255, 255, 0.5)";
			bg.adaptWidthToChildren = true; // Adjust width to fit the text
			bg.adaptHeightToChildren = true; // Adjust height to fit the text
			bg.cornerRadius = 2; // Match the original corner rounding
			bg.thickness = 0; // No border
			bg.horizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align the container to the left
			bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align to the top
			bg.left = "5px"; // Preserve original spacing
			bg.top = "5px";

			// Create the text block inside the rectangle
			const textBlock = new flock.GUI.TextBlock("textBlock", text);
			textBlock.color = color;
			textBlock.fontSize = "20"; // Match the original font size
			textBlock.fontFamily = "Asap"; // Retain original font
			textBlock.height = "25px"; // Match the original height
			textBlock.paddingLeft = "10px"; // Padding for left alignment
			textBlock.paddingRight = "10px";
			textBlock.paddingTop = "2px";
			textBlock.paddingBottom = "2px";
			textBlock.textHorizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Left align the text
			textBlock.textVerticalAlignment =
				flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER; // Center vertically within the rectangle
			textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap; // Enable word wrap
			textBlock.resizeToFit = true; // Allow resizing
			textBlock.forceResizeWidth = true;

			// Add the text block to the rectangle
			bg.addControl(textBlock);

			// Add the rectangle to the stack panel
			flock.stackPanel.addControl(bg);

			// Remove the text after the specified duration
			const timeoutId = setTimeout(() => {
				if (flock.scene) {
					// Ensure the scene is still valid
					flock.stackPanel.removeControl(bg);
				}
			}, duration * 1000);

			// Handle cleanup in case of scene disposal
			flock.abortController.signal.addEventListener("abort", () => {
				clearTimeout(timeoutId);
			});
		} catch (error) {
			console.warn("Unable to print text:", error);
		}
	},
	async initializeXR(mode) {
		if (flock.xrHelper) return; // Avoid reinitializing

		if (mode === "VR") {
			flock.xrHelper = await flock.scene.createDefaultXRExperienceAsync();
		} else if (mode === "AR") {
			flock.xrHelper = await flock.scene.createDefaultXRExperienceAsync({
				uiOptions: { sessionMode: "immersive-ar" },
			});
		} else if (mode === "MAGIC_WINDOW") {
			let camera = flock.scene.activeCamera;
			if (!camera.inputs.attached.deviceOrientation) {
				camera.inputs.addDeviceOrientation();
			}
		}

		// Create a UI plane for the wrist
		flock.uiPlane = flock.BABYLON.MeshBuilder.CreatePlane(
			"uiPlane",
			{ size: 0.4 },
			flock.scene,
		); // Smaller size for wrist UI
		flock.uiPlane.isVisible = false; // Start hidden

		const planeMaterial = new flock.BABYLON.StandardMaterial(
			"uiPlaneMaterial",
			flock.scene,
		);
		planeMaterial.disableDepthWrite = true;
		flock.uiPlane.material = planeMaterial;

		flock.meshTexture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(
			flock.uiPlane,
		);

		// Ensure the UI plane follows the wrist (using a controller or camera offset)
		flock.xrHelper.input.onControllerAddedObservable.add((controller) => {
			if (controller.inputSource.handedness === "left") {
				// Attach the UI plane to the left-hand controller
				flock.uiPlane.parent = controller.grip || controller.pointer;

				// Position the UI plane to simulate a watch
				flock.uiPlane.position.set(0.1, -0.05, 0); // Slightly to the side, closer to the wrist
				flock.uiPlane.rotation.set(Math.PI / 2, 0, 0); // Rotate to face the user
			}
		});

		// Handle XR state changes
		flock.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
			if (state === flock.BABYLON.WebXRState.ENTERING_XR) {
				flock.advancedTexture.removeControl(flock.stackPanel);
				flock.meshTexture.addControl(flock.stackPanel);
				flock.uiPlane.isVisible = true;

				// Update alignment for wrist UI
				flock.stackPanel.horizontalAlignment =
					flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
				flock.stackPanel.verticalAlignment =
					flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

				flock.advancedTexture.isVisible = false; // Hide fullscreen UI
			} else if (state === flock.BABYLON.WebXRState.EXITING_XR) {
				flock.meshTexture.removeControl(flock.stackPanel);
				flock.advancedTexture.addControl(flock.stackPanel);
				flock.uiPlane.isVisible = false;

				// Restore alignment for non-XR
				flock.stackPanel.width = "100%";
				flock.stackPanel.horizontalAlignment =
					flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
				flock.stackPanel.verticalAlignment =
					flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

				flock.advancedTexture.rootContainer.isVisible = true;
			}
		});
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
		maxAttempts = 100,
		initialInterval = 100,
		maxInterval = 2000,
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
	whenModelReady(targetId, callback) {
		// Check if the target (mesh or GUI button) is immediately available
		if (flock.scene) {
			let target = flock.scene.getMeshByName(targetId);

			if (!target && flock.scene.UITexture) {
				target = flock.scene.UITexture.getControlByName(targetId);
			}

			// Check animation groups if still not found
			if (!target) {
				target = flock.scene.animationGroups.find(
					(group) => group.name === targetId,
				);
			}

			// Check particle systems if still not found
			if (!target) {
				target = flock.scene.particleSystems.find(
					(system) => system.name === targetId,
				);
			}

			if (target) {
				if (flock.abortController.signal.aborted) {
					return; // If already aborted, stop here
				}
				// Target is available immediately, invoke the callback synchronously
				callback(target);
				return; // Return immediately, no Promise needed
			}
		}

		// If the target is not immediately available, fall back to the generator and return a Promise
		return (async () => {
			const generator = flock.modelReadyGenerator(targetId);
			try {
				for await (const target of generator) {
					if (flock.abortController.signal.aborted) {
						console.log(`Aborted waiting for target: ${targetId}`);
						return; // Exit the loop if the operation was aborted
					}
					await callback(target);
				}
			} catch (err) {
				if (flock.abortController.signal.aborted) {
					console.log(`Operation was aborted: ${targetId}`);
				} else {
					console.error(`Error in whenModelReady: ${err}`);
				}
			}
		})();
	},
	/*
	 Category: Scene
	*/
	setSky(color) {
		// If color is a Babylon.js material, apply it directly
		if (flock.sky) {
			flock.disposeMesh(flock.sky);
		}
		if (color && color instanceof flock.BABYLON.Material) {
			const skySphere = flock.BABYLON.MeshBuilder.CreateSphere(
				"sky",
				{ segments: 32, diameter: 1000 },
				flock.scene,
			);

			flock.sky = skySphere;
			color.diffuseTexture.uScale = 10.0;
			color.diffuseTexture.vScale = 10.0;
			skySphere.material = color;
			skySphere.isPickable = false; // Make non-interactive
		} else if (Array.isArray(color) && color.length === 2) {
			// Handle gradient case
			const skySphere = flock.BABYLON.MeshBuilder.CreateSphere(
				"sky",
				{ segments: 32, diameter: 1000 },
				flock.scene,
			);
			flock.sky = skySphere;
			const gradientMaterial = new flock.GradientMaterial(
				"skyGradient",
				flock.scene,
			);

			gradientMaterial.bottomColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color[0]),
			);
			gradientMaterial.topColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color[1]),
			);
			gradientMaterial.offset = 0.8; // Push the gradient midpoint towards the top
			gradientMaterial.smoothness = 0.5; // Sharper gradient transition
			gradientMaterial.scale = 0.01;
			gradientMaterial.backFaceCulling = false; // Render on the inside of the sphere

			skySphere.material = gradientMaterial;
			skySphere.isPickable = false; // Make non-interactive
		} else {
			// Handle single color case
			flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
		}
	},
	createGround(color, modelId) {
		if (flock.ground) {
			flock.disposeMesh(flock.ground);
		}
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
		ground.physics = groundAggregate;

		groundMaterial.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color),
		);
		ground.material = groundMaterial;
		flock.ground = ground;
	},
	createMap(image, material) {
		if (flock.ground) {
			flock.disposeMesh(flock.ground);
		}
		let ground;
		if (image === "NONE") {
			const modelId = "flatGround";
			ground = flock.BABYLON.MeshBuilder.CreateGround(
				modelId,
				{ width: 100, height: 100, subdivisions: 2 },
				flock.scene,
			);
			const groundAggregate = new flock.BABYLON.PhysicsAggregate(
				ground,
				flock.BABYLON.PhysicsShapeType.BOX,
				{ mass: 0, friction: 0.5 },
				flock.scene,
			);
			ground.physics = groundAggregate;
			ground.name = modelId;
			ground.blockKey = modelId;
			ground.receiveShadows = true;
		} else {
			const minHeight = 0;
			const maxHeight = 10;
			ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
				"heightmap",
				flock.texturePath + image,
				{
					width: 100,
					height: 100,
					minHeight: minHeight,
					maxHeight: maxHeight,
					subdivisions: 64,
					onReady: (groundMesh) => {
						const vertexData = groundMesh.getVerticesData(
							flock.BABYLON.VertexBuffer.PositionKind,
						);
						let minDistance = Infinity;
						let closestY = 0;
						for (let i = 0; i < vertexData.length; i += 3) {
							const x = vertexData[i];
							const z = vertexData[i + 2];
							const y = vertexData[i + 1];
							const distance = Math.sqrt(x * x + z * z);
							if (distance < minDistance) {
								minDistance = distance;
								closestY = y;
							}
						}

						groundMesh.position.y -= closestY;
						const heightMapGroundShape =
							new flock.BABYLON.PhysicsShapeMesh(
								ground,
								flock.scene,
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
							restitution: 0,
						};
						heightMapGroundBody.shape = heightMapGroundShape;
						heightMapGroundBody.setMassProperties({ mass: 0 });
					},
				},
				flock.scene,
			);
		}
		ground.name = "ground";
		ground.blockKey = "ground";

		//console.log("Scaling material");
		// Simply assign the passed-through material:
		if (material.diffuseTexture) {
			material.diffuseTexture.wrapU =
				flock.BABYLON.Texture.WRAP_ADDRESSMODE;
			material.diffuseTexture.wrapV =
				flock.BABYLON.Texture.WRAP_ADDRESSMODE;
			material.diffuseTexture.uScale = 25;
			material.diffuseTexture.vScale = 25;
		}
		ground.material = material;
		flock.ground = ground;
		return ground;
	},
	hide(modelName) {
		const uiButton = flock.scene.UITexture?.getControlByName(modelName);

		if (uiButton) {
			// Handle UI button case
			uiButton.isVisible = false; // Hide the button
			return;
		}
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
	disposeMesh(mesh) {
		if (mesh.name === "ground") {
			mesh.material.dispose();
			mesh.dispose();
			flock.ground = null;
			return;
		}
		if (mesh.name === "sky") {
			mesh.material.dispose();
			mesh.dispose();
			flock.sky = null;
			return;
		}

		let meshesToDispose = [mesh];

		const particleSystem = flock.scene.particleSystems.find(
			(system) => system.name === mesh.name,
		);

		if (particleSystem) {
			particleSystem.dispose();
			return;
		}

		if (mesh.getChildMeshes) {
			meshesToDispose = mesh.getChildMeshes().concat(mesh);
		}

		const disposedMaterials = new Set();

		// Process AnimationGroups
		flock.scene.animationGroups.slice().forEach((animationGroup) => {
			const targets = animationGroup.targetedAnimations.map(
				(anim) => anim.target,
			);

			if (
				targets.some((target) => meshesToDispose.includes(target)) ||
				targets.some((target) =>
					mesh.getDescendants().includes(target),
				) ||
				targets.length === 0 // Orphaned group
			) {
				animationGroup.targetedAnimations.forEach((anim) => {
					anim.target = null; // Detach references
				});
				animationGroup.stop();
				animationGroup.dispose();
			}
		});

		// Dispose standalone animations
		meshesToDispose.forEach((currentMesh) => {
			if (currentMesh.animations) {
				currentMesh.animations.forEach((animation) => {
					animation.dispose?.();
				});
				currentMesh.animations.length = 0;
			}
		});

		// Detach and Dispose Materials
		meshesToDispose.forEach((currentMesh) => {
			if (currentMesh.material) {
				const material = currentMesh.material;

				// Detach material from the mesh
				currentMesh.material = null;

				// Dispose material if not already disposed
				if (!disposedMaterials.has(material)) {
					const sharedMaterial = currentMesh.metadata?.sharedMaterial;

					if (sharedMaterial === false) {
						disposedMaterials.add(material);

						// Remove from scene.materials
						flock.scene.materials = flock.scene.materials.filter(
							(mat) => mat !== material,
						);

						material.dispose();
					}
				}
			}
		});

		// Break parent-child relationships
		meshesToDispose.forEach((currentMesh) => {
			console.log("Stopping current sound");
			if (currentMesh?.metadata?.currentSound) {
				currentMesh.metadata.currentSound.stop();
			}
		});
		// Break parent-child relationships
		meshesToDispose.forEach((currentMesh) => {
			currentMesh.parent = null;
		});

		// Dispose meshes in reverse order
		meshesToDispose.reverse().forEach((currentMesh) => {
			if (!currentMesh.isDisposed()) {
				// Remove physics body
				if (currentMesh.physics) {
					currentMesh.physics.dispose();
				}

				// Remove from scene
				flock.scene.removeMesh(currentMesh);
				currentMesh.setEnabled(false);

				// Dispose the mesh
				currentMesh.dispose();
			}
		});
	},
	dispose(modelName) {
		const uiButton = flock.scene.UITexture?.getControlByName(modelName);

		if (uiButton) {
			// Handle UI button case
			uiButton.dispose();
			return;
		}
		return flock.whenModelReady(modelName, (mesh) => {
			flock.disposeMesh(mesh);
		});
	},
	cloneMesh({ sourceMeshName, cloneId, callback = null }) {
		const uniqueCloneId = cloneId + "_" + flock.scene.getUniqueId();

		flock.whenModelReady(sourceMeshName, (sourceMesh) => {
			const clone = sourceMesh.clone(uniqueCloneId);

			if (clone) {
				sourceMesh.computeWorldMatrix(true);

				const worldPosition = new BABYLON.Vector3();
				const worldRotation = new BABYLON.Quaternion();
				sourceMesh
					.getWorldMatrix()
					.decompose(undefined, worldRotation, worldPosition);

				clone.parent = null;
				clone.position.copyFrom(worldPosition);
				clone.rotationQuaternion = worldRotation.clone();
				clone.scaling.copyFrom(sourceMesh.scaling);

				// Clone and synchronise the physics body
				if (sourceMesh.physics) {
					const cloneBody = sourceMesh.physics.clone(clone);
					clone.physics = cloneBody;
				}

				const setMetadata = (mesh) => {
					// Ensure metadata exists
					mesh.metadata = mesh.metadata || {};

					// Add or update specific properties without overwriting existing metadata
					mesh.metadata.sharedMaterial = true;
					mesh.metadata.sharedGeometry = true;
				};

				clone.metadata = { ...(sourceMesh.metadata || {}) };
				setMetadata(clone);
				clone.getDescendants().forEach(setMetadata);

				if (callback) {
					requestAnimationFrame(() => callback());
				}
			}
		});

		return uniqueCloneId;
	},


	/* 
		Category: Scene>Camera
	*/
	attachCamera(modelName, radius) {
		return flock.whenModelReady(modelName, function (mesh) {
			if (mesh) {
				console.log("Attaching camera to model");
				//flock.updateDynamicMeshPositions(flock.scene, [mesh]);
				let camera = flock.scene.activeCamera;

				flock.savedCamera = camera;
				flock.ensureVerticalConstraint(mesh);

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
			} else {
				console.log("Model not loaded:", modelName);
			}
		});
	},
	ensureVerticalConstraint(mesh) {
		if (mesh.metadata.constraint) return;

		const newBox = flock.BABYLON.MeshBuilder.CreateBox("Constraint", {
			height: 1,
			width: 1,
			depth: 1,
		});
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
			if (mesh && referenceBody) {
				mesh.physics.addConstraint(referenceBody, constraint);

				mesh.metadata.constraint = true;
			} else {
				console.error("Mesh body or reference body is not defined");
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
			mesh.physics.setAngularVelocity(flock.BABYLON.Vector3.Zero());
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
		const capsuleHalfHeight = 1;
		// When the capsule’s bottom is within this distance of the ground, we treat it as contact.
		const groundContactThreshold = 0.05;
		// If the gap is larger than this, assume the capsule is airborne and skip correction.
		const maxGroundContactGap = 0.1;
		// Maximum lerp factor per frame for ground correction.
		const lerpFactor = 0.1;
		// Only apply correction on nearly flat surfaces.
		const flatThreshold = 0.98; // dot product of surface normal with up

		dynamicMeshes.forEach((mesh) => {
			mesh.physics.setCollisionCallbackEnabled(true);
			const observable = mesh.physics.getCollisionObservable();
			const observer = observable.add((collisionEvent) => {
				//console.log("Collision event", collisionEvent);

				const penetration = Math.abs(collisionEvent.distance);
				// If the penetration is extremely small (indicating minor clipping)
				if (penetration < 0.001) {
					// Read the current vertical velocity.
					const currentVel = mesh.physics.getLinearVelocity();
					// If there is an upward impulse being applied by the solver,
					// override it by setting the vertical velocity to zero.
					if (currentVel.y > 0) {
						mesh.physics.setLinearVelocity(
							new flock.BABYLON.Vector3(
								currentVel.x,
								0,
								currentVel.z,
							),
						);
						console.log(
							"Collision callback: small penetration detected. Overriding upward velocity.",
						);
					}

					dynamicMeshes.forEach((mesh) => {
						// Use a downward ray to determine the gap to the ground.
						const capsuleHalfHeight = 1; // adjust as needed
						const rayOrigin = mesh.position
							.clone()
							.add(new BABYLON.Vector3(0, -capsuleHalfHeight, 0));
						const downRay = new BABYLON.Ray(
							rayOrigin,
							new BABYLON.Vector3(0, -1, 0),
							3,
						);
						const hit = scene.pickWithRay(downRay, (m) =>
							m.name.toLowerCase().includes("ground"),
						);
						if (hit && hit.pickedMesh) {
							const groundY = hit.pickedPoint.y;
							const capsuleBottomY =
								mesh.position.y - capsuleHalfHeight;
							const gap = capsuleBottomY - groundY;
							// If the gap is very small (i.e. the capsule is on or nearly on the ground)
							// and the vertical velocity is upward, override it.
							const currentVel = mesh.physics.getLinearVelocity();
							if (Math.abs(gap) < 0.1 && currentVel.y > 0) {
								mesh.physics.setLinearVelocity(
									new BABYLON.Vector3(
										currentVel.x,
										0,
										currentVel.z,
									),
								);
								console.log(
									"After-render: resetting upward velocity",
								);
							}
						}
					});
				}
			});
		});
	},

	/* 
		Category: Scene>XR
	*/

	setCameraBackground(cameraType) {
		if (!flock.scene) {
			console.error(
				"Scene not available. Ensure the scene is initialised before setting the camera background.",
			);
			return;
		}

		const videoLayer = new flock.BABYLON.Layer(
			"videoLayer",
			null,
			flock.scene,
			true,
		);

		flock.BABYLON.VideoTexture.CreateFromWebCam(
			flock.scene,
			(videoTexture) => {
				videoTexture._invertY = false; // Correct orientation
				videoTexture.uScale = -1; // Flip horizontally for mirror effect
				videoLayer.texture = videoTexture; // Assign the video feed to the layer
			},
			{
				facingMode: cameraType, // "user" for front, "environment" for back
				minWidth: 640,
				minHeight: 480,
				maxWidth: 1920,
				maxHeight: 1080,
				deviceId: "",
			},
		);
	},
	async setXRMode(mode) {
		await flock.initializeXR(mode);
		flock.printText("XR Mode!", 5, "white");
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
				//download(mesh.name + ".obj", objData, "text/plain");
			} else if (format === "GLB") {
				mesh.flipFaces();
				flock.EXPORT.GLTF2Export.GLBAsync(
					flock.scene,
					mesh.name + ".glb",
					{
						shouldExportNode: (node) =>
							node === mesh ||
							mesh.getChildMeshes().includes(node),
					},
				).then((glb) => {
					mesh.flipFaces();
					glb.downloadFiles();
				});
			}
		});
	},

	/*

	*/

	
	ensureUniqueGeometry(mesh) {
		console.log("Cloning geometry");

		if (mesh.metadata?.sharedGeometry) {
			// Extract vertex data from mesh
			const vertexData = BABYLON.VertexData.ExtractFromMesh(mesh);

			// Remove shared geometry by clearing existing bindings
			mesh.setVerticesData("position", null); // Remove reference to old data

			// Apply cloned vertex data (creates a new internal geometry)
			vertexData.applyToMesh(mesh, true); // `true` = updatable

			// Mark the geometry as no longer shared
			mesh.metadata.sharedGeometry = false;

			console.log("Geometry cloned and applied.");
		}
	},
	setupMesh(mesh, modelName, modelId, blockId, scale, x, y, z, color = null) {
		mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

		const bb =
			flock.BABYLON.BoundingBoxGizmo.MakeNotPickableAndWrapInBoundingBox(
				mesh,
			);

		bb.name = modelId;
		bb.blockKey = blockId;

		//console.log("Model setup", bb.name, bb.blockKey);
		bb.isPickable = false;

		const objectNames = [
			"Star.glb",
			"Heart.glb",
			"Coin.glb",
			"Gem1.glb",
			"Gem2.glb",
			"Gem3.glb",
		];

		if (!objectNames.includes(modelName)) {
			const boundingInfo = bb.getBoundingInfo();
			const halfHeight = boundingInfo.boundingBox.extendSizeWorld.y;

			bb.position.y -= halfHeight;
		}
		bb.bakeCurrentTransformIntoVertices();
		bb.scaling.set(1, 1, 1);

		bb.position = new flock.BABYLON.Vector3(x, y, z);

		mesh.computeWorldMatrix(true);
		mesh.refreshBoundingInfo();
		mesh.isPickable = true;
		mesh.getDescendants().forEach((child) => {
			child.isPickable = true;
		});

		bb.metadata = bb.metadata || {};
		bb.metadata.yOffset = (bb.position.y - y) / scale;
		bb.metadata.modelName = modelName;
		flock.stopAnimationsTargetingMesh(flock.scene, mesh);

		const setMetadata = (mesh) => {
			// Ensure metadata exists
			mesh.metadata = mesh.metadata || {};

			// Add or update specific properties without overwriting existing metadata
			mesh.metadata.sharedMaterial = true;
			mesh.metadata.sharedGeometry = true;
		};

		// Set metadata on the root mesh
		setMetadata(bb);

		// Set metadata on all descendants
		bb.getDescendants().forEach((descendant) => {
			setMetadata(descendant);
		});

		bb.position.y += bb.getBoundingInfo().boundingBox.extendSizeWorld.y;

		const boxBody = new flock.BABYLON.PhysicsBody(
			bb,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		const boxShape = flock.createCapsuleFromBoundingBox(bb, flock.scene);

		boxBody.shape = boxShape;
		boxBody.setMassProperties({ mass: 1, restitution: 0.5 });
		boxBody.disablePreStep = false;
		bb.physics = boxBody;
	},
	
	hold(meshToAttach, targetMesh, xOffset = 0, yOffset = 0, zOffset = 0) {
		return flock.whenModelReady(targetMesh, (targetMeshInstance) => {
			flock.whenModelReady(meshToAttach, (meshToAttachInstance) => {
				// Find the first mesh with a skeleton (including descendants)
				const targetWithSkeleton = targetMeshInstance.skeleton
					? targetMeshInstance
					: targetMeshInstance
							.getChildMeshes()
							.find((mesh) => mesh.skeleton);

				if (targetWithSkeleton) {
					const bone = targetWithSkeleton.skeleton.bones.find(
						(b) => b.name === "Hold",
					);
					if (bone) {
						meshToAttachInstance.attachToBone(
							bone,
							targetWithSkeleton,
						);
						meshToAttachInstance.position =
							new flock.BABYLON.Vector3(
								xOffset,
								yOffset,
								zOffset,
							);
					}
				}
			});
		});
	},
	drop(meshToDetach) {
		return flock.whenModelReady(meshToDetach, (meshToDetachInstance) => {
			const worldPosition = meshToDetachInstance.getAbsolutePosition();
			meshToDetachInstance.detachFromBone();

			// Set the child mesh's position to its world position
			meshToDetachInstance.position = worldPosition;
		});
	},
	setParent(parentModelName, childModelName) {
		return flock.whenModelReady(parentModelName, (parentMesh) => {
			flock.whenModelReady(childModelName, (childMesh) => {
				// Set the parent-child relationship
				childMesh.setParent(parentMesh);
			});
		});
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
	makeFollow(
		followerModelName,
		targetModelName,
		followPosition,
		offsetX = 0,
		offsetY = 0,
		offsetZ = 0,
	) {
		// Ensure both models are loaded before proceeding
		return flock.whenModelReady(followerModelName, (followerMesh) => {
			flock.whenModelReady(targetModelName, (targetMesh) => {
				// Remove any existing follow observer before adding a new one
				followerMesh._followObserver &&
					flock.scene.onBeforeRenderObservable.remove(
						followerMesh._followObserver,
					);

				// Calculate Y position based on the follow position option
				let getYPosition = () => {
					if (followPosition === "TOP") {
						return targetMesh.position.y + targetMesh.scaling.y;
					} else if (followPosition === "CENTER") {
						return targetMesh.position.y + targetMesh.scaling.y / 2;
					} else {
						return targetMesh.position.y;
					}
				};

				// Create a new observer to update the follower's position
				followerMesh._followObserver =
					flock.scene.onBeforeRenderObservable.add(() => {
						followerMesh.position.x =
							targetMesh.position.x + parseFloat(offsetX);
						followerMesh.position.y =
							getYPosition() + parseFloat(offsetY);
						followerMesh.position.z =
							targetMesh.position.z + parseFloat(offsetZ);
					});
			});
		});
	},
	stopFollow(followerModelName) {
		return flock.whenModelReady(followerModelName, (followerMesh) => {
			// Remove the follow observer if it exists
			if (followerMesh._followObserver) {
				flock.scene.onBeforeRenderObservable.remove(
					followerMesh._followObserver,
				);
				followerMesh._followObserver = null;
			}
		});
	},
	createCustomMap(colors) {
		console.log("Creating map", colors);
	},
	wait(duration) {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				flock.abortController.signal.removeEventListener(
					"abort",
					onAbort,
				);
				resolve();
			}, duration);

			const onAbort = () => {
				clearTimeout(timeoutId); // Clear the timeout if aborted
				flock.abortController.signal.removeEventListener(
					"abort",
					onAbort,
				);
				// Instead of throwing an error, resolve gracefully here
				reject(new Error("Wait aborted"));
			};

			flock.abortController.signal.addEventListener("abort", onAbort);
		}).catch((error) => {
			// Check if the error is the expected "Wait aborted" error and handle it
			if (error.message === "Wait aborted") {
				return;
			}
			// If it's another error, rethrow it
			throw error;
		});
	},
	async safeLoop(
		iteration,
		loopBody,
		chunkSize = 100,
		timing = { lastFrameTime: performance.now() },
		state = {},
	) {
		if (state.stopExecution) return; // Check if we should stop further iterations

		// Execute the loop body
		await loopBody(iteration);

		// Yield control after every `chunkSize` iterations
		if (iteration % chunkSize === 0) {
			const currentTime = performance.now();

			if (currentTime - timing.lastFrameTime > 16) {
				await new Promise((resolve) => requestAnimationFrame(resolve));
				timing.lastFrameTime = performance.now(); // Update timing for this loop
			}
		}
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
	initializeMesh(mesh, position, color, shapeType, alpha = 1) {
		// Set position
		mesh.position = new BABYLON.Vector3(
			position[0],
			position[1],
			position[2],
		);

		// Set metadata and unique name
		mesh.metadata = { shapeType };
		mesh.blockKey = mesh.name;
		//mesh.name = `${mesh.name}_${mesh.uniqueId}`;

		flock.applyMaterialToMesh(mesh, shapeType, color, alpha);

		mesh.metadata.sharedMaterial = false;

		// Enable and make the mesh visible
		mesh.isVisible = true;
		mesh.setEnabled(true);
		mesh.material.needDepthPrePass = true;
		mesh.metadata.sharedGeometry = true;
	},
	
	setSizeBasedBoxUVs(mesh, width, height, depth, texturePhysicalSize = 4) {
		const positions = mesh.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		);
		const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
		const uvs =
			mesh.getVerticesData(BABYLON.VertexBuffer.UVKind) ||
			new Array((positions.length / 3) * 2).fill(0);

		for (let i = 0; i < positions.length / 3; i++) {
			const normal = new BABYLON.Vector3(
				normals[i * 3],
				normals[i * 3 + 1],
				normals[i * 3 + 2],
			);

			const position = new BABYLON.Vector3(
				positions[i * 3],
				positions[i * 3 + 1],
				positions[i * 3 + 2],
			);

			let u = 0,
				v = 0;

			// Front/Back faces (aligned with Z-axis)
			if (
				Math.abs(normal.z) > Math.abs(normal.x) &&
				Math.abs(normal.z) > Math.abs(normal.y)
			) {
				u = position.x / texturePhysicalSize; // Horizontal scale
				v = position.y / texturePhysicalSize; // Vertical scale
			}
			// Side faces (aligned with X-axis)
			else if (
				Math.abs(normal.x) > Math.abs(normal.y) &&
				Math.abs(normal.x) > Math.abs(normal.z)
			) {
				u = position.z / texturePhysicalSize; // Horizontal scale
				v = position.y / texturePhysicalSize; // Vertical scale
			}
			// Top/Bottom faces (aligned with Y-axis)
			else if (
				Math.abs(normal.y) > Math.abs(normal.x) &&
				Math.abs(normal.y) > Math.abs(normal.z)
			) {
				u = position.x / texturePhysicalSize; // Horizontal scale
				v = position.z / texturePhysicalSize; // Vertical scale
			}

			uvs[i * 2] = u;
			uvs[i * 2 + 1] = v;
		}

		// Apply updated UV mapping
		mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true);
	},

	setSphereUVs(mesh, diameter, texturePhysicalSize = 1) {
		const positions = mesh.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		);
		const uvs =
			mesh.getVerticesData(BABYLON.VertexBuffer.UVKind) ||
			new Array((positions.length / 3) * 2).fill(0);

		for (let i = 0; i < positions.length / 3; i++) {
			const x = positions[i * 3];
			const y = positions[i * 3 + 1];
			const z = positions[i * 3 + 2];

			// Calculate longitude (theta) and latitude (phi)
			const theta = Math.atan2(z, x); // Longitude angle
			const phi = Math.acos(y / (diameter / 2)); // Latitude angle

			// Scale UVs inversely with diameter
			uvs[i * 2] = (theta / (2 * Math.PI) + 0.5) * texturePhysicalSize; // U-axis
			uvs[i * 2 + 1] = (phi / Math.PI) * texturePhysicalSize; // V-axis
		}

		mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true);
	},

	getOrCreateGeometry(shapeType, dimensions, scene) {
		const geometryKey = `${shapeType}_${Object.values(dimensions).join("_")}`;

		if (!flock.geometryCache) return;

		if (!flock.geometryCache[geometryKey]) {
			let initialMesh;

			// Create the initial mesh based on shape type
			if (shapeType === "Box") {
				initialMesh = BABYLON.MeshBuilder.CreateBox(
					geometryKey,
					dimensions,
					scene,
				);
			} else if (shapeType === "Sphere") {
				initialMesh = BABYLON.MeshBuilder.CreateSphere(
					geometryKey,
					dimensions,
					scene,
				);
			} else if (shapeType === "Cylinder") {
				initialMesh = BABYLON.MeshBuilder.CreateCylinder(
					geometryKey,
					dimensions,
					scene,
				);
			} else if (shapeType === "Capsule") {
				initialMesh = BABYLON.MeshBuilder.CreateCapsule(
					geometryKey,
					dimensions,
					scene,
				);
			} else {
				throw new Error(`Unsupported shape type: ${shapeType}`);
			}

			// Extract and cache the VertexData from the initial mesh, then dispose the mesh
			flock.geometryCache[geometryKey] =
				BABYLON.VertexData.ExtractFromMesh(initialMesh);
			initialMesh.dispose(); // Dispose of the initial mesh to keep only VertexData
		}

		// Return the cached VertexData
		return flock.geometryCache[geometryKey];
	},
	
	setSizeBasedCylinderUVs(
		mesh,
		height,
		diameterTop,
		diameterBottom,
		texturePhysicalSize = 4,
	) {
		const positions = mesh.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		);
		const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
		const uvs =
			mesh.getVerticesData(BABYLON.VertexBuffer.UVKind) ||
			new Array((positions.length / 3) * 2).fill(0);

		const radiusTop = diameterTop / 2;
		const radiusBottom = diameterBottom / 2;

		for (let i = 0; i < positions.length / 3; i++) {
			const normal = new BABYLON.Vector3(
				normals[i * 3],
				normals[i * 3 + 1],
				normals[i * 3 + 2],
			);

			const position = new BABYLON.Vector3(
				positions[i * 3],
				positions[i * 3 + 1],
				positions[i * 3 + 2],
			);

			let u = 0,
				v = 0;

			// Side faces (curved surface) - unchanged
			if (
				Math.abs(normal.y) <
				Math.max(Math.abs(normal.x), Math.abs(normal.z))
			) {
				const angle = Math.atan2(position.z, position.x); // Angle around the Y-axis
				const averageRadius = (radiusTop + radiusBottom) / 2;
				const circumference = 2 * Math.PI * averageRadius;
				u =
					(angle / (2 * Math.PI)) *
					(circumference / texturePhysicalSize); // Scale based on circumference
				v = (position.y + height / 2) / texturePhysicalSize; // Scale along height
			}
			// Top cap
			else if (normal.y > 0) {
				u = position.x / radiusTop / (texturePhysicalSize / 2) + 0.5; // Adjust scaling by factor of 2
				v = position.z / radiusTop / (texturePhysicalSize / 2) + 0.5;
			}
			// Bottom cap
			else {
				u = position.x / radiusBottom / (texturePhysicalSize / 2) + 0.5; // Adjust scaling by factor of 2
				v = position.z / radiusBottom / (texturePhysicalSize / 2) + 0.5;
			}

			uvs[i * 2] = u;
			uvs[i * 2 + 1] = v;
		}

		// Apply updated UV mapping
		mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true);
	},

	setCapsuleUVs(mesh, radius, height, texturePhysicalSize = 4) {
		const positions = mesh.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		);
		const uvs =
			mesh.getVerticesData(BABYLON.VertexBuffer.UVKind) ||
			new Array((positions.length / 3) * 2).fill(0);

		const cylinderHeight = Math.max(0, height - 2 * radius); // Height of the cylindrical part
		const circumference = 2 * Math.PI * radius; // Circumference of the cylinder

		for (let i = 0; i < positions.length / 3; i++) {
			const x = positions[i * 3];
			const y = positions[i * 3 + 1];
			const z = positions[i * 3 + 2];

			let u = 0,
				v = 0;

			// Determine whether the vertex is in the spherical cap or cylindrical body
			if (Math.abs(y) > cylinderHeight / 2) {
				// Spherical cap (top or bottom)
				const theta = Math.atan2(z, x); // Longitude angle
				const offsetY =
					y > 0 ? y - cylinderHeight / 2 : y + cylinderHeight / 2; // Offset for cap position

				u = theta / (2 * Math.PI) + 0.5; // Wrap U-axis around the cap
				v = (offsetY / radius + 1) / (2 * texturePhysicalSize); // Scale V-axis by the texture size
			} else {
				// Cylindrical body
				const theta = Math.atan2(z, x); // Longitude angle

				u = theta / (2 * Math.PI) + 0.5; // Wrap U-axis around the cylinder
				v =
					(y + cylinderHeight / 2) /
					(texturePhysicalSize * cylinderHeight); // V-axis based on height
			}

			// Apply the calculated UV coordinates
			uvs[i * 2] = u * (circumference / texturePhysicalSize); // Normalize U-axis for physical size
			uvs[i * 2 + 1] = v; // V-axis remains proportional to height
		}
		mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true);
	},

	setSizeBasedPlaneUVs(mesh, width, height, texturePhysicalSize = 4) {
		const positions = mesh.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		);
		const uvs =
			mesh.getVerticesData(BABYLON.VertexBuffer.UVKind) ||
			new Array((positions.length / 3) * 2).fill(0);

		for (let i = 0; i < positions.length / 3; i++) {
			const position = new BABYLON.Vector3(
				positions[i * 3],
				positions[i * 3 + 1],
				positions[i * 3 + 2],
			);

			// Calculate UV coordinates based on the physical size of the texture
			const u =
				(position.x / width) * (width / texturePhysicalSize) + 0.5; // Scale proportionally to width
			const v =
				(position.y / height) * (height / texturePhysicalSize) + 0.5; // Scale proportionally to height

			uvs[i * 2] = u;
			uvs[i * 2 + 1] = v;
		}

		// Apply updated UV mapping
		mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, true);
	},
	
	getProperty(modelName, propertyName) {
		const mesh =
			modelName === "__active_camera__"
				? flock.scene.activeCamera
				: flock.scene.getMeshByName(modelName);

		if (!mesh) return null;

		const position =
			modelName === "__active_camera__"
				? mesh.globalPosition
				: mesh.getAbsolutePosition();

		let propertyValue = null;
		let colors = null;

		mesh.computeWorldMatrix(true);

		const rotation =
			modelName === "__active_camera__"
				? mesh.absoluteRotation.toEulerAngles()
				: mesh.absoluteRotationQuaternion.toEulerAngles();

		let allMeshes, materialNode, materialNodes;
		switch (propertyName) {
			case "POSITION_X":
				propertyValue = parseFloat(position.x.toFixed(2));
				break;
			case "POSITION_Y":
				propertyValue = parseFloat(position.y.toFixed(2));
				break;
			case "POSITION_Z":
				propertyValue = parseFloat(position.z.toFixed(2));
				break;
			case "ROTATION_X":
				propertyValue = parseFloat(
					flock.BABYLON.Tools.ToDegrees(rotation.x).toFixed(2),
				);
				break;
			case "ROTATION_Y":
				parseFloat(
					(propertyValue = flock.BABYLON.Tools.ToDegrees(
						rotation.y,
					).toFixed(2)),
				);
				break;
			case "ROTATION_Z":
				propertyValue = parseFloat(
					flock.BABYLON.Tools.ToDegrees(rotation.z).toFixed(2),
				);
				break;
			case "SCALE_X":
				propertyValue = parseFloat(mesh.scaling.x.toFixed(2));
				break;
			case "SCALE_Y":
				propertyValue = parseFloat(mesh.scaling.y.toFixed(2));
				break;
			case "SCALE_Z":
				propertyValue = parseFloat(mesh.scaling.z.toFixed(2));
				break;
			case "SIZE_X": {
				const bi = mesh.getBoundingInfo();
				propertyValue = parseFloat(
					(
						bi.boundingBox.maximumWorld.x -
						bi.boundingBox.minimumWorld.x
					).toFixed(2),
				);
				break;
			}
			case "SIZE_Y": {
				const bi = mesh.getBoundingInfo();
				propertyValue = parseFloat(
					(
						bi.boundingBox.maximumWorld.y -
						bi.boundingBox.minimumWorld.y
					).toFixed(2),
				);
				break;
			}
			case "SIZE_Z": {
				const bi = mesh.getBoundingInfo();
				propertyValue = parseFloat(
					(
						bi.boundingBox.maximumWorld.z -
						bi.boundingBox.minimumWorld.z
					).toFixed(2),
				);
				break;
			}
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
						mesh.getBoundingInfo().boundingBox.minimumWorld.y;
					//mesh.getBoundingInfo().boundingBox.minimum.y *
					//						mesh.scaling.y;
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
					propertyValue = propertyValue =
						mesh.getBoundingInfo().boundingBox.maximumWorld.y;
					//mesh.getBoundingInfo().boundingBox.maximum.y *
					//						mesh.scaling.y;
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
				colors = materialNodes
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
		// Combine all input sources: keys, buttons, and controllers
		const pressedKeys = flock.canvas.pressedKeys;
		const pressedButtons = flock.canvas.pressedButtons;

		// Check VR controller inputs
		const vrPressed =
			flock.xrHelper?.baseExperience?.input?.inputSources.some(
				(inputSource) => {
					if (inputSource.gamepad) {
						const gamepad = inputSource.gamepad;

						// Thumbstick movement
						if (key === "W" && gamepad.axes[1] < -0.5) return true; // Forward
						if (key === "S" && gamepad.axes[1] > 0.5) return true; // Backward
						if (key === "A" && gamepad.axes[0] < -0.5) return true; // Left
						if (key === "D" && gamepad.axes[0] > 0.5) return true; // Right

						// Button mappings
						if (key === "SPACE" && gamepad.buttons[0]?.pressed)
							return true; // A button for jump
						if (key === "Q" && gamepad.buttons[1]?.pressed)
							return true; // B button for action 1
						if (key === "F" && gamepad.buttons[2]?.pressed)
							return true; // X button for action 2
						if (key === "E" && gamepad.buttons[3]?.pressed)
							return true; // Y button for action 3

						// General button check
						if (
							key === "ANY" &&
							gamepad.buttons.some((button) => button.pressed)
						)
							return true;
					}
					return false;
				},
			);

		// Combine all sources
		if (key === "ANY") {
			return pressedKeys.size > 0 || pressedButtons.size > 0 || vrPressed;
		} else if (key === "NONE") {
			return (
				pressedKeys.size === 0 &&
				pressedButtons.size === 0 &&
				!vrPressed
			);
		} else {
			return (
				pressedKeys.has(key) ||
				pressedKeys.has(key.toLowerCase()) ||
				pressedKeys.has(key.toUpperCase()) ||
				pressedButtons.has(key) ||
				vrPressed
			);
		}
	},
	seededRandom(from, to, seed) {
		const x = Math.sin(seed) * 10000;
		const random = x - Math.floor(x);
		const result = Math.floor(random * (to - from + 1)) + from;
		return result;
	},	
	checkMeshesTouching(mesh1VarName, mesh2VarName) {
		const mesh1 = flock.scene.getMeshByName(mesh1VarName);
		const mesh2 = flock.scene.getMeshByName(mesh2VarName);
		if (mesh1 && mesh2 && mesh2.isEnabled()) {
			return mesh1.intersectsMesh(mesh2, false);
		}
		return false;
	},
	onTrigger(modelName, trigger, doCode, options = { mode: "wait" }) {
		return flock.whenModelReady(modelName, async function (target) {
			if (!target) {
				console.log("Model or GUI Button not loaded:", modelName);
				return;
			}

			let { mode } = options;
			let isExecuting = false; // Tracks whether action is currently executing
			let hasExecuted = false; // Tracks whether action has executed in 'once' mode
			let doCodes = Array.isArray(doCode) ? doCode : [doCode];
			let currentIndex = 0;

			// Helper to handle action registration for meshes
			function registerMeshAction(mesh, trigger, action) {
				mesh.isPickable = true;
				if (!mesh.actionManager) {
					mesh.actionManager = new flock.BABYLON.ActionManager(
						flock.scene,
					);
					mesh.actionManager.isRecursive = true;
				}

				let actionSequence = new flock.BABYLON.ExecuteCodeAction(
					flock.BABYLON.ActionManager[trigger],
					action,
				);

				for (let i = 1; i < doCodes.length; i++) {
					actionSequence = actionSequence.then(
						new flock.BABYLON.ExecuteCodeAction(
							flock.BABYLON.ActionManager[trigger],
							async () => await doCodes[i](),
						),
					);
				}

				mesh.actionManager.registerAction(actionSequence);
			}

			// Helper to handle GUI button registration
			function registerButtonAction(button, trigger, action) {
				if (trigger === "OnPointerUpTrigger") {
					button.onPointerUpObservable.add(action);
				} else {
					button.onPointerClickObservable.add(action);
				}
			}

			// Execute the next code in sequence
			async function executeAction() {
				// Handle 'once' mode - execute only once
				if (mode === "once") {
					if (hasExecuted) return; // Skip if already executed
					hasExecuted = true; // Mark as executed
				}

				// Handle 'wait' mode - discard if already executing
				if (mode === "wait") {
					if (isExecuting) return; // Skip if still processing
					isExecuting = true;
				}

				try {
					await doCodes[currentIndex]();
					currentIndex = (currentIndex + 1) % doCodes.length;
				} catch (e) {
					console.error("Action execution failed:", e);
				} finally {
					// Reset execution flag only for 'wait' mode
					if (mode === "wait") isExecuting = false;
				}
			}

			// Handle meshes
			if (target instanceof flock.BABYLON.AbstractMesh) {
				registerMeshAction(target, trigger, async () => {
					await executeAction(); // Always execute immediately
				});

				// Handle AR/VR-specific interactions
				if (flock.xrHelper && flock.xrHelper.baseExperience) {
					flock.xrHelper.baseExperience.onStateChangedObservable.add(
						(state) => {
							if (
								state === flock.BABYLON.WebXRState.IN_XR &&
								flock.xrHelper.baseExperience.sessionManager
									.sessionMode === "immersive-ar"
							) {
								flock.xrHelper.baseExperience.featuresManager.enableFeature(
									BABYLON.WebXRHitTest.Name,
									"latest",
									{
										onHitTestResultObservable: (
											results,
										) => {
											if (results.length > 0) {
												const hitTest = results[0];
												const position =
													hitTest.transformationMatrix.getTranslation();
												target.position.copyFrom(
													position,
												);
												target.isVisible = true;
											}
										},
									},
								);

								flock.scene.onPointerDown = function (
									evt,
									pickResult,
								) {
									if (
										pickResult.hit &&
										pickResult.pickedMesh === target
									) {
										executeAction(); // Discard extra triggers in 'wait' mode
									}
								};
							} else if (state === BABYLON.WebXRState.NOT_IN_XR) {
								flock.scene.onPointerDown = null;
							}
						},
					);
				}
			}
			// Handle GUI buttons
			else if (target instanceof flock.GUI.Button) {
				registerButtonAction(target, trigger, async () => {
					await executeAction(); // Execute immediately
				});
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
	sanitizeEventName(eventName) {
		return eventName.replace(/[^a-zA-Z0-9_-]/g, "");
	},
	isAllowedEventName(eventName) {
		return !eventName.startsWith("_");
	},
	onEvent(eventName, handler, once = false) {
		eventName = flock.sanitizeEventName(eventName);
		if (!flock.isAllowedEventName(eventName)) {
			console.warn(
				`Event name ${eventName} is reserved and cannot be broadcasted.`,
			);
			return;
		}
		if (!flock.events[eventName]) {
			flock.events[eventName] = new flock.BABYLON.Observable();
		}
		if (once) {
			const wrappedHandler = (data) => {
				handler(data);
				flock.events[eventName].remove(wrappedHandler);
			};
			flock.events[eventName].add(wrappedHandler);
		} else {
			flock.events[eventName].add(handler);
		}
	},
	broadcastEvent(eventName, data) {
		eventName = flock.sanitizeEventName(eventName);
		if (!flock.isAllowedEventName(eventName)) {
			console.warn(
				`Event name ${eventName} is reserved and cannot be broadcasted.`,
			);
			return;
		}
		if (flock.events[eventName]) {
			flock.events[eventName].notifyObservers(data);
		}
	},
	whenKeyEvent(key, callback, isReleased = false) {
		// Handle keyboard input
		const eventType = isReleased
			? flock.BABYLON.KeyboardEventTypes.KEYUP
			: flock.BABYLON.KeyboardEventTypes.KEYDOWN;

		flock.scene.onKeyboardObservable.add((kbInfo) => {
			if (
				kbInfo.type === eventType &&
				kbInfo.event.key.toLowerCase() === key
			) {
				callback();
			}
		});

		// Register the callback for the grid input observable
		const gridObservable = isReleased
			? flock.gridKeyReleaseObservable
			: flock.gridKeyPressObservable;

		gridObservable.add((inputKey) => {
			if (inputKey === key) {
				callback();
			}
		});

		flock.xrHelper?.input.onControllerAddedObservable.add((controller) => {
			console.log(
				`DEBUG: Controller added: ${controller.inputSource.handedness}`,
			);

			const handedness = controller.inputSource.handedness;

			// Map button IDs to the corresponding keyboard keys
			const buttonMap =
				handedness === "left"
					? { "y-button": "q", "x-button": "e" } // Left controller: Y -> Q, X -> E
					: handedness === "right"
						? { "b-button": "f", "a-button": " " } // Right controller: B -> F, A -> Space
						: {}; // Unknown handedness: No mapping

			controller.onMotionControllerInitObservable.add(
				(motionController) => {
					Object.entries(buttonMap).forEach(
						([buttonId, mappedKey]) => {
							// Trigger the callback only for the specific key
							if (mappedKey !== key) {
								return;
							}
							const component =
								motionController.getComponent(buttonId);

							if (!component) {
								console.warn(
									`DEBUG: Button ID '${buttonId}' not found for ${handedness} controller.`,
								);
								return;
							}

							console.log(
								`DEBUG: Observing button ID '${buttonId}' for key '${mappedKey}' on ${handedness} controller.`,
							);

							// Track the last known pressed state for this specific button
							let lastPressedState = false;

							// Monitor state changes for this specific button
							component.onButtonStateChangedObservable.add(() => {
								const isPressed = component.pressed;

								// Debugging to verify button states
								console.log(
									`DEBUG: Observable fired for '${buttonId}', pressed: ${isPressed}`,
								);

								// Ensure this logic only processes events for the current button
								if (
									motionController.getComponent(buttonId) !==
									component
								) {
									console.log(
										`DEBUG: Skipping event for '${buttonId}' as it doesn't match the triggering component.`,
									);
									return;
								}

								// Ignore repeated callbacks for the same state
								if (isPressed === lastPressedState) {
									console.log(
										`DEBUG: No state change for '${buttonId}', skipping callback.`,
									);
									return;
								}

								// Only handle "released" transitions
								if (!isPressed && lastPressedState) {
									console.log(
										`DEBUG: Key '${mappedKey}' (button ID '${buttonId}') released on ${handedness} controller.`,
									);
									callback(mappedKey, "released");
								}

								// Update last pressed state
								lastPressedState = isPressed;
							});
						},
					);
				},
			);
		});
	},
	start(action) {
		flock.scene.onBeforeRenderObservable.addOnce(action);
	},
	async forever(action) {
		let isDisposed = false;
		let isActionRunning = false;

		// Function to run the action
		const runAction = async () => {
			if (isDisposed) {
				console.log("Scene is disposed. Exiting action.");
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
};

export function initializeFlock() {
	const scriptElement = flock.document.getElementById("flock");
	if (scriptElement) {
		flock
			.initialize()
			.then(() => {
				flock.modelPath =
					"https://flipcomputing.github.io/flock/models/";
				flock.soundPath =
					"https://flipcomputing.github.io/flock/sounds/";
				flock.imagePath =
					"https://flipcomputing.github.io/flock/images/";
				flock.texturePath =
					"https://flipcomputing.github.io/flock/textures/";
				const userCode = scriptElement.textContent;
				flock.runCode(userCode);
			})
			.catch((error) => {
				console.error("Error initializing flock:", error);
			});
	}
}
