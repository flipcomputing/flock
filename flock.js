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

		let audioEnginePromise = flock.BABYLON.CreateAudioEngineAsync({
			volume: 1,
			listenerAutoUpdate: true,
			listenerEnabled: true,
			resumeOnInteraction: true,
		});

		audioEnginePromise.then((audioEngine) => {
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
		flock.globalStartTime = flock.getAudioContext().currentTime;
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
	async resetScene() {
		// Dispose of the old scene
		await flock.disposeOldScene();

		// Initialize the new scene
		await flock.initializeNewScene();
	},
	UIText(text, x, y, fontSize, color, duration, id = null) {
		// Ensure flock.scene and flock.GUI are initialized
		if (!flock.scene || !flock.GUI) {
			throw new Error("flock.scene or flock.GUI is not initialized.");
		}

		// Ensure UITexture and controls exist
		flock.scene.UITexture ??=
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
		flock.scene.UITexture.controls ??= [];
		flock.abortController ??= new AbortController();

		// Generate a unique ID if none is provided
		const textBlockId =
			id ||
			`textBlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Get canvas dimensions
		const maxWidth = flock.scene.getEngine().getRenderWidth();
		const maxHeight = flock.scene.getEngine().getRenderHeight();

		// Adjust negative coordinates
		const adjustedX = x < 0 ? maxWidth + x : x;
		const adjustedY = y < 0 ? maxHeight + y : y;

		// Check if a TextBlock with the given ID already exists
		let textBlock = flock.scene.UITexture.getControlByName(textBlockId);

		if (textBlock) {
			// Reuse the existing TextBlock and update its properties
			textBlock.text = text;
			textBlock.color = color || "white"; // Default color
			textBlock.fontSize = fontSize || 24; // Default font size
			textBlock.left = adjustedX;
			textBlock.top = adjustedY;
			textBlock.isVisible = true; // Ensure the text block is visible
		} else {
			textBlock = new flock.GUI.TextBlock(textBlockId); // Assign the ID as the name
			flock.scene.UITexture.addControl(textBlock);
			flock.scene.UITexture.controls.push(textBlock);

			// Set initial text properties
			textBlock.text = text;
			textBlock.color = color || "white"; // Default color
			textBlock.fontSize = fontSize || 24; // Default font size
			textBlock.textHorizontalAlignment =
				flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			textBlock.textVerticalAlignment =
				flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
			textBlock.left = adjustedX;
			textBlock.top = adjustedY;
		}

		// Ensure the text disappears after the duration
		if (duration > 0) {
			setTimeout(() => {
				if (flock.scene.UITexture.controls.includes(textBlock)) {
					textBlock.isVisible = false; // Hide the text block
				} else {
					console.warn(
						`TextBlock "${textBlockId}" not found in controls array.`,
					);
				}
			}, duration * 1000);
		}

		// Return the ID for future reference
		return textBlockId;
	},
	UIButton(
		text,
		x,
		y,
		width,
		textSize,
		textColor,
		backgroundColor,
		buttonId,
	) {
		// Ensure flock.scene and flock.GUI are initialized
		if (!flock.scene || !flock.GUI) {
			throw new Error("flock.scene or flock.GUI is not initialized.");
		}

		// Ensure UITexture exists
		flock.scene.UITexture ??=
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

		// Validate buttonId
		if (!buttonId || typeof buttonId !== "string") {
			throw new Error("buttonId must be a valid non-empty string.");
		}

		// Create a Babylon.js GUI button
		const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);

		// Preset button sizes for consistency
		const buttonSizes = {
			SMALL: { width: "100px", height: "40px" },
			MEDIUM: { width: "150px", height: "50px" },
			LARGE: { width: "200px", height: "60px" },
		};

		// Validate and apply the selected size
		if (typeof width !== "string") {
			throw new Error(
				"Invalid button size. Please provide a valid size: 'SMALL', 'MEDIUM', or 'LARGE'.",
			);
		}

		const size = buttonSizes[width.toUpperCase()] || buttonSizes["SMALL"];
		button.width = size.width;
		button.height = size.height;

		// Configure text block settings
		if (button.textBlock) {
			button.textBlock.textWrapping = true;
			button.textBlock.resizeToFit = true;
			button.textBlock.fontSize = textSize ? `${textSize}px` : "16px"; // Default font size
		} else {
			console.warn(
				"No textBlock found for the button. Text-related settings will not be applied.",
			);
		}

		// Set button text color and background color
		button.color = textColor || "white";
		button.background = backgroundColor || "blue";

		// Validate x and y positions
		if (typeof x !== "number" || typeof y !== "number") {
			throw new Error("x and y must be numbers.");
		}

		// Set button alignment
		button.left = `${x}px`;
		button.top = `${y}px`;
		button.horizontalAlignment =
			x < 0
				? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
				: flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

		button.verticalAlignment =
			y < 0
				? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
				: flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

		// Add the button to the UI
		flock.scene.UITexture.addControl(button);

		// Return the buttonId for future reference
		return buttonId;
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

		if (flock.flockNotReady) return null;

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
		const applyHighlight = (mesh) => {
			if (mesh.material) {
				flock.highlighter.addMesh(
					mesh,
					flock.BABYLON.Color3.FromHexString(
						flock.getColorFromString(color),
					),
				);
			}
		};

		return flock.whenModelReady(modelName, (mesh) => {
			applyHighlight(mesh);
			mesh.getChildMeshes().forEach(applyHighlight);
		});
	},
	glow(modelName, glowColor) {
		// Ensure the glow layer is initialised
		if (!flock.glowLayer) {
			flock.glowLayer = new flock.BABYLON.GlowLayer(
				"glowLayer",
				flock.scene,
			);
			flock.glowLayer.intensity = 0.5;
		}

		return flock.whenModelReady(modelName, (mesh) => {
			flock.glowMesh(mesh, glowColor);
		});
	},

	glowMesh(mesh, glowColor = null) {
		const applyGlow = (m) => {
			m.metadata = m.metadata || {};
			m.metadata.glow = true;

			if (m.material) {
				const emissiveColor =
					glowColor ||
					m.material.diffuseColor ||
					m.material.albedoColor ||
					flock.BABYLON.Color3.Black();
				m.material.emissiveColor = emissiveColor;
				m.material.emissiveIntensity = 1.0;
			}
		};

		applyGlow(mesh);
		mesh.getChildMeshes().forEach(applyGlow);
	},
	createModel({
		modelName,
		modelId,
		scale = 1,
		position = { x: 0, y: 0, z: 0 },
		callback = null,
	}) {
		const { x, y, z } = position;
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		// Check if a first copy is already cached
		if (flock.modelCache[modelName]) {
			//console.log(`Using cached first model: ${modelName}`);

			// Clone from the cached first copy
			const firstMesh = flock.modelCache[modelName];
			const mesh = firstMesh.clone(blockId);

			// Reset transformations
			mesh.scaling.copyFrom(BABYLON.Vector3.One());
			mesh.position.copyFrom(BABYLON.Vector3.Zero());
			mesh.rotationQuaternion = null;
			mesh.rotation.copyFrom(BABYLON.Vector3.Zero());

			flock.setupMesh(mesh, modelName, modelId, blockId, scale, x, y, z); // Neutral setup

			mesh.computeWorldMatrix(true);
			mesh.refreshBoundingInfo();
			mesh.setEnabled(true);
			mesh.visibility = 1;

			if (callback) {
				requestAnimationFrame(callback);
			}

			return modelId;
		}

		// Check if model is already being loaded
		if (flock.modelsBeingLoaded[modelName]) {
			//console.log(`Waiting for model to load: ${modelName}`);
			return flock.modelsBeingLoaded[modelName].then(() => {
				return flock.createModel({
					modelName,
					modelId,
					scale,
					position,
					callback,
				});
			});
		}

		// Start loading the model
		//console.log(`Loading model: ${modelName}`);
		const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
			flock.modelPath,
			modelName,
			flock.scene,
		)
			.then((container) => {
				// Clone a first copy from the first mesh
				const firstMesh = container.meshes[0].clone(
					`${modelName}_first`,
				);

				firstMesh.setEnabled(false); // Disable the first copy
				flock.modelCache[modelName] = firstMesh;

				container.addAllToScene();

				flock.setupMesh(
					container.meshes[0],
					modelName,
					modelId,
					blockId,
					scale,
					x,
					y,
					z,
				);

				if (callback) {
					requestAnimationFrame(callback);
				}
			})
			.catch((error) => {
				console.error(`Error loading model: ${modelName}`, error);
			})
			.finally(() => {
				delete flock.modelsBeingLoaded[modelName]; // Remove from loading map
			});

		// Track the ongoing load
		flock.modelsBeingLoaded[modelName] = loadPromise;

		return modelId;
	},
	ensureUniqueMaterial(mesh) {
		// Helper function to clone material for a mesh
		const cloneMaterial = (originalMaterial) => {
			return originalMaterial.clone(`${originalMaterial.name}`);
		};

		// Recursive function to collect all meshes in the hierarchy
		const collectMeshes = (node, meshes = []) => {
			if (node instanceof BABYLON.Mesh) {
				meshes.push(node);
			}
			if (node.getChildren) {
				node.getChildren().forEach((child) =>
					collectMeshes(child, meshes),
				);
			}
			return meshes;
		};

		// Collect all meshes in the hierarchy (root + descendants)
		const allMeshes = collectMeshes(mesh);

		// Create a mapping of original materials to their clones
		const materialMapping = new Map();

		// Iterate through all collected meshes
		allMeshes.forEach((currentMesh) => {
			if (currentMesh.material && currentMesh.metadata?.sharedMaterial) {
				// Check if the material has already been cloned
				if (!materialMapping.has(currentMesh.material)) {
					// Clone the material and store it in the mapping
					const clonedMaterial = cloneMaterial(currentMesh.material);
					materialMapping.set(currentMesh.material, clonedMaterial);
				}

				// Assign the cloned material to the current mesh
				currentMesh.material = materialMapping.get(
					currentMesh.material,
				);
				currentMesh.metadata.sharedMaterial = false; // Material is now unique to this hierarchy
			}
		});
	},
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
	applyColorToMaterial(part, materialName, color) {
		if (part.material && part.material.name === materialName) {
			part.material.diffuseColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
			part.material.albedoColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
		}
		part.getChildMeshes().forEach((child) => {
			flock.applyColorToMaterial(child, materialName, color);
		});
	},
	applyColorsToCharacter(mesh, colors) {
		const {
			hair: hairColor,
			skin: skinColor,
			eyes: eyesColor,
			sleeves: sleevesColor,
			shorts: shortsColor,
			tshirt: tshirtColor,
		} = colors;

		flock.applyColorToMaterial(mesh, "Hair", hairColor);
		flock.applyColorToMaterial(mesh, "Skin", skinColor);
		flock.applyColorToMaterial(mesh, "Eyes", eyesColor);
		flock.applyColorToMaterial(mesh, "Detail", sleevesColor);
		flock.applyColorToMaterial(mesh, "Shorts", shortsColor);
		flock.applyColorToMaterial(mesh, "TShirt", tshirtColor);
		flock.applyColorToMaterial(mesh, "Tshirt", tshirtColor);
		flock.applyColorToMaterial(mesh, "Sleeves", sleevesColor);
		flock.applyColorToMaterial(mesh, "Shoes", sleevesColor);
	},
	createCharacter({
		modelName,
		modelId,
		scale = 1,
		position = { x: 0, y: 0, z: 0 },
		colors = {
			hair: "#000000",
			skin: "#a15c33",
			eyes: "#0000ff",
			sleeves: "#ff0000",
			shorts: "#00ff00",
			tshirt: "#0000ff",
		},
		callback = () => {},
	}) {
		const { x, y, z } = position;

		let blockKey;
		if (modelId.includes("__")) {
			[modelId, blockKey] = modelId.split("__");
		}

		if (flock.scene.getMeshByName(modelId)) {
			modelId = modelId + "_" + flock.scene.getUniqueId();
		}
		flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
			flock.modelPath,
			modelName,
			flock.scene,
			null,
			null,
			{ signal: flock.abortController.signal },
		)
			.then((container) => {
				container.addAllToScene();
				const mesh = container.meshes[0];
				flock.setupMesh(
					mesh,
					modelName,
					modelId,
					blockKey,
					scale,
					x,
					y,
					z,
				);

				if (modelName.startsWith("Character"))
					flock.ensureStandardMaterial(mesh);
				flock.applyColorsToCharacter(mesh, colors);

				const descendants = mesh.getChildMeshes(false);
				descendants.forEach((childMesh) => {
					if (childMesh.getTotalVertices() > 0) {
						// Ensure it has geometry
						childMesh.isPickable = true;
						childMesh.flipFaces(true);
					}
				});

				if (callback) {
					requestAnimationFrame(() => callback());
				}
			})
			.catch((error) => {
				console.log("Error loading", error);
			});

		return modelId;
	},
	ensureStandardMaterial(mesh) {
		if (!mesh) return;

		// Set to track replaced materials and their corresponding replacements
		const replacedMaterialsMap = new Map();

		// Default material to use as the replacement base
		const defaultMaterial =
			flock.scene.defaultMaterial ||
			new flock.BABYLON.StandardMaterial("defaultMaterial", flock.scene);
		defaultMaterial.backFaceCulling = false;

		const replaceIfPBRMaterial = (targetMesh) => {
			const material = targetMesh.material;

			if (material && material.getClassName() === "PBRMaterial") {
				if (!replacedMaterialsMap.has(material)) {
					// Replace with a cloned default material, preserving the name
					const originalName = material.name;
					const newMaterial = defaultMaterial.clone(originalName);
					replacedMaterialsMap.set(material, newMaterial);
				}

				// Assign the replaced material to the mesh
				targetMesh.material = replacedMaterialsMap.get(material);
				targetMesh.backFaceCulling = false;
			}
		};

		// Replace material on the main mesh
		replaceIfPBRMaterial(mesh);

		// Replace materials on all child meshes
		mesh.getChildMeshes().forEach(replaceIfPBRMaterial);

		// Dispose of all replaced materials
		replacedMaterialsMap.forEach((newMaterial, oldMaterial) => {
			oldMaterial.dispose();
		});
	},
	createObject({
		modelName,
		modelId,
		color = ["#FFFFFF", "#FFFFFF"],
		scale = 1,
		position = { x: 0, y: 0, z: 0 },
		callback = null,
	} = {}) {
		try {
			// Basic parameter validation with warnings
			if (!modelName) {
				console.warn("createObject: Missing modelName parameter");
				return "error_" + flock.scene.getUniqueId();
			}

			if (!modelId) {
				console.warn("createObject: Missing modelId parameter");
				return "error_" + flock.scene.getUniqueId();
			}

			if (!position || typeof position !== "object") {
				console.warn("createObject: Invalid position parameter");
				position = { x: 0, y: 0, z: 0 };
			}

			const { x, y, z } = position;

			let blockKey = modelId;
			let meshName;
			if (modelId.includes("__")) {
				[meshName, blockKey] = modelId.split("__");
			}

			if (
				flock.scene.getMeshByName(meshName) ||
				flock.modelsBeingLoaded[modelName]
			) {
				meshName = meshName + "_" + flock.scene.getUniqueId();
			}

			if (flock.modelCache[modelName]) {
				const firstMesh = flock.modelCache[modelName];
				const mesh = firstMesh.clone(blockKey);
				mesh.scaling.copyFrom(BABYLON.Vector3.One());
				mesh.position.copyFrom(BABYLON.Vector3.Zero());

				flock.setupMesh(
					mesh,
					modelName,
					meshName,
					blockKey,
					scale,
					x,
					y,
					z,
					color,
				);
				flock.changeColorMesh(mesh, color);
				mesh.computeWorldMatrix(true);
				mesh.refreshBoundingInfo();
				mesh.setEnabled(true);
				const allDescendantMeshes = [
					mesh,
					...mesh
						.getDescendants(false)
						.filter((node) => node instanceof BABYLON.AbstractMesh),
				];

				allDescendantMeshes.forEach((mesh) => {
					mesh.isPickable = true;
					mesh.setEnabled(true);
				});
				if (callback) {
					requestAnimationFrame(callback);
				}
				return meshName;
			}

			if (flock.modelsBeingLoaded[modelName]) {
				//console.log(`Waiting for model to load: ${modelName}`);
				flock.modelsBeingLoaded[modelName].then(() => {
					if (flock.modelCache[modelName]) {
						const firstMesh = flock.modelCache[modelName];
						const mesh = firstMesh.clone(blockKey);
						mesh.scaling.copyFrom(BABYLON.Vector3.One());
						mesh.position.copyFrom(BABYLON.Vector3.Zero());
						flock.setupMesh(
							mesh,
							modelName,
							meshName,
							blockKey,
							scale,
							x,
							y,
							z,
							color,
						);
						flock.changeColorMesh(mesh, color);
						mesh.computeWorldMatrix(true);
						mesh.refreshBoundingInfo();
						const allDescendantMeshes = [
							mesh,
							...mesh
								.getDescendants(false)
								.filter(
									(node) =>
										node instanceof BABYLON.AbstractMesh,
								),
						];
						allDescendantMeshes.forEach((mesh) => {
							mesh.isPickable = true;
							mesh.setEnabled(true);
						});
						if (callback) {
							requestAnimationFrame(callback);
						}
					}
				});
				return meshName;
			}

			const loadPromise =
				flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
					flock.modelPath,
					modelName,
					flock.scene,
				)
					.then((container) => {
						flock.ensureStandardMaterial(container.meshes[0]);

						// First, add everything to the scene
						container.addAllToScene();

						// Create the template mesh AFTER adding to scene
						const firstMesh = container.meshes[0].clone(
							`${modelName}_first`,
						);
						firstMesh.setEnabled(false);
						firstMesh.isPickable = false;

						// Make sure all children of the template are also not pickable
						firstMesh.getChildMeshes().forEach((child) => {
							child.isPickable = false;
							child.setEnabled(false);
						});

						// Store in cache
						flock.modelCache[modelName] = firstMesh;

						// Make sure the original mesh and its children ARE pickable and enabled
						container.meshes[0].isPickable = true;
						container.meshes[0].setEnabled(true);
						container.meshes[0]
							.getChildMeshes()
							.forEach((child) => {
								child.isPickable = true;
								child.setEnabled(true); // Fixed the missing closing parenthesis
							});

						// Setup and color the active mesh
						flock.setupMesh(
							container.meshes[0],
							modelName,
							meshName,
							blockKey,
							scale,
							x,
							y,
							z,
							color,
						);
						flock.changeColorMesh(container.meshes[0], color);

						if (callback) {
							requestAnimationFrame(callback);
						}
					})
					.catch((error) => {
						console.error(
							`Error loading model: ${modelName}`,
							error,
						);
					})
					.finally(() => {
						delete flock.modelsBeingLoaded[modelName];
					});

			flock.modelsBeingLoaded[modelName] = loadPromise;
			return meshName;
		} catch (error) {
			console.warn("createObject: Error creating object:", error);
			return "error_" + flock.scene.getUniqueId();
		}
	},
	create3DText({
		text,
		font,
		color = "#FFFFFF",
		size = 50,
		depth = 1.0,
		position = { x: 0, y: 0, z: 0 },
		modelId,
		callback = null,
	}) {
		const { x, y, z } = position;

		// Return modelId immediately
		setTimeout(async () => {
			const fontData = await (await fetch(font)).json();

			const mesh = BABYLON.MeshBuilder.CreateText(
				modelId,
				text,
				fontData,
				{
					size: size,
					depth: depth,
				},
				flock.scene,
				earcut,
			);

			mesh.position.set(x, y, z);
			const material = new BABYLON.StandardMaterial(
				"textMaterial",
				flock.scene,
			);

			material.diffuseColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);

			mesh.material = material;

			mesh.computeWorldMatrix(true);
			mesh.refreshBoundingInfo();
			mesh.setEnabled(true);
			mesh.visibility = 1;

			const textShape = new flock.BABYLON.PhysicsShapeMesh(
				mesh,
				flock.scene,
			);
			flock.applyPhysics(mesh, textShape);

			if (callback) {
				requestAnimationFrame(callback);
			}
		}, 0);

		return modelId;
	},
	createParticleEffect({
		name,
		emitterMesh,
		emitRate,
		colors,
		alphas,
		sizes,
		lifetime,
		shape,
		gravity,
		direction,
		rotation,
	}) {
		let resultName = name + "_" + flock.scene.getUniqueId(); // Placeholder for the synchronous return value

		flock.whenModelReady(emitterMesh, (meshInstance) => {
			// Create the particle system
			const particleSystem = new flock.BABYLON.ParticleSystem(
				resultName,
				500,
				flock.scene,
			);

			// Texture of each particle
			const texturePath = flock.texturePath + shape;
			particleSystem.particleTexture = new flock.BABYLON.Texture(
				texturePath,
				flock.scene,
			);

			// Set the emitter mesh
			particleSystem.emitter = meshInstance;

			// Use a MeshParticleEmitter to emit particles from the mesh's surface
			const meshEmitter = new flock.BABYLON.MeshParticleEmitter(
				meshInstance,
			);
			particleSystem.particleEmitterType = meshEmitter;
			particleSystem.blendMode = 4;

			const startColor = flock.BABYLON.Color4.FromHexString(colors.start);
			const endColor = flock.BABYLON.Color4.FromHexString(colors.end);

			// Combine colors with alpha values
			const startColorWithAlpha = new flock.BABYLON.Color4(
				startColor.r,
				startColor.g,
				startColor.b,
				alphas.start,
			);
			const endColorWithAlpha = new flock.BABYLON.Color4(
				endColor.r,
				endColor.g,
				endColor.b,
				alphas.end,
			);

			/*			particleSystem.blendMode =
				BABYLON.ParticleSystem.BLENDMODE_STANDARD;
			particleSystem.particleTexture.hasAlpha = true;
			particleSystem.particleTexture.getAlphaFromRGB = false;*/

			// Set colors with alpha
			// Add color gradients with alpha values
			particleSystem.addColorGradient(0, startColorWithAlpha);
			particleSystem.addColorGradient(1, endColorWithAlpha);

			// Add size gradients
			particleSystem.addSizeGradient(0, sizes.start);
			particleSystem.addSizeGradient(1, sizes.end);

			// Apply lifetime values
			particleSystem.minLifeTime = lifetime.min;
			particleSystem.maxLifeTime = lifetime.max;

			// Set the emit rate with a maximum limit
			const MAX_EMIT_RATE = 500;
			particleSystem.emitRate = Math.min(emitRate, MAX_EMIT_RATE);

			// Apply gravity if enabled
			particleSystem.gravity = gravity
				? new flock.BABYLON.Vector3(0, -9.81, 0)
				: new flock.BABYLON.Vector3(0, 0, 0);

			if (direction) {
				const { x, y, z } = direction;

				if (x != 0 || y != 0 || z != 0) {
					particleSystem.minEmitPower = 1;
					particleSystem.maxEmitPower = 3;
					meshEmitter.useMeshNormalsForDirection = false;

					meshEmitter.direction1 = new flock.BABYLON.Vector3(x, y, z);
					meshEmitter.direction2 = new flock.BABYLON.Vector3(x, y, z);
				}
			}

			if (rotation) {
				// Convert angular speeds from degrees per second to radians per second
				if (rotation.angularSpeed) {
					particleSystem.minAngularSpeed =
						(rotation.angularSpeed.min * Math.PI) / 180;
					particleSystem.maxAngularSpeed =
						(rotation.angularSpeed.max * Math.PI) / 180;
				}
				// Convert initial rotations from degrees to radians
				if (rotation.initialRotation) {
					particleSystem.minInitialRotation =
						(rotation.initialRotation.min * Math.PI) / 180;
					particleSystem.maxInitialRotation =
						(rotation.initialRotation.max * Math.PI) / 180;
				}
			}

			// Start the particle system
			particleSystem.start();

			return particleSystem;
		});

		return resultName; // Return the name immediately
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
	mergeMeshes(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Create the base CSG from the first mesh, respecting its world matrix

					let firstMesh = validMeshes[0];
					// If metadata exists, use the mesh with material.
					if (firstMesh.metadata?.modelName) {
						const meshWithMaterial =
							flock.findFirstDescendantWithMaterial(firstMesh);
						if (meshWithMaterial) {
							firstMesh = meshWithMaterial;
							firstMesh.refreshBoundingInfo();
							firstMesh.flipFaces();
						}
					}
					let baseCSG = flock.BABYLON.CSG2.FromMesh(firstMesh, false);

					// Merge subsequent meshes
					validMeshes.slice(1).forEach((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock.findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								mesh = meshWithMaterial;
								mesh.refreshBoundingInfo();
								mesh.flipFaces();
							}
						}
						const meshCSG = flock.BABYLON.CSG2.FromMesh(
							mesh,
							false,
						);
						baseCSG = baseCSG.add(meshCSG);
					});

					const mergedMesh1 = baseCSG.toMesh(
						"mergedMesh",
						validMeshes[0].getScene(),
						{
							centerMesh: false, // Keep the original combined position
							rebuildNormals: true, // Ensure normals are rebuilt for proper shading
						},
					);

					mergedMesh1.refreshBoundingInfo(); // Ensure bounding info is up-to-date
					const boundingInfo = mergedMesh1.getBoundingInfo();
					const worldCenter =
						boundingInfo.boundingBox.centerWorld.clone();

					const mergedMesh = baseCSG.toMesh(
						"mergedMesh",
						validMeshes[0].getScene(),
						{
							centerMesh: true, // Keep the original combined position
							rebuildNormals: true, // Ensure normals are rebuilt for proper shading
						},
					);

					mergedMesh.position = worldCenter;

					mergedMesh1.metadata = mergedMesh1.metadata || {};
					mergedMesh1.metadata.sharedMaterial = false;

					flock.applyResultMeshProperties(
						mergedMesh,
						firstMesh,
						modelId,
						blockId,
					);

					mergedMesh1.dispose();
					validMeshes.forEach((mesh) => mesh.dispose());

					return modelId; // Return the modelId as per original functionality
				} else {
					console.warn("No valid meshes to merge.");
					return null;
				}
			});
	},
	subtractMeshes(modelId, baseMeshName, meshNames) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();
		return new Promise((resolve) => {
			flock.whenModelReady(baseMeshName, (baseMesh) => {
				if (!baseMesh) {
					resolve(null);
					return;
				}

				let actualMesh = baseMesh;
				if (baseMesh.metadata?.modelName) {
					const meshWithMaterial =
						flock.findFirstDescendantWithMaterial(baseMesh);
					if (meshWithMaterial) {
						actualMesh = meshWithMaterial;
						//actualMesh.parent = null;
					}
				}

				// Ensure world matrices are computed.
				baseMesh.computeWorldMatrix(true);
				actualMesh.computeWorldMatrix(true);

				// Prepare the subtracting meshes.
				flock
					.prepareMeshes(modelId, meshNames, blockId)
					.then((validMeshes) => {
						if (validMeshes.length) {
							const scene = baseMesh.getScene();

							// Duplicate the base mesh for CSG.
							const baseDuplicate =
								actualMesh.clone("baseDuplicate");
							baseDuplicate.setParent(null);
							baseDuplicate.position = actualMesh
								.getAbsolutePosition()
								.clone();
							baseDuplicate.rotationQuaternion = null;
							baseDuplicate.rotation =
								actualMesh.absoluteRotationQuaternion
									? actualMesh.absoluteRotationQuaternion.toEulerAngles()
									: actualMesh.rotation.clone();
							baseDuplicate.computeWorldMatrix(true);

							// Duplicate the meshes to subtract.
							const meshDuplicates = validMeshes.map((mesh) => {
								// If metadata exists, use the mesh with material.
								if (mesh.metadata?.modelName) {
									const meshWithMaterial =
										flock.findFirstDescendantWithMaterial(
											mesh,
										);
									if (meshWithMaterial) {
										mesh = meshWithMaterial;
										mesh.refreshBoundingInfo();
										mesh.flipFaces();
									}
								}

								const duplicate = mesh.clone(
									"meshDuplicate",
									null,
									true,
								);
								duplicate.computeWorldMatrix(true);
								duplicate.refreshBoundingInfo();

								return duplicate;
							});
							baseDuplicate.refreshBoundingInfo();
							let outerCSG = flock.BABYLON.CSG2.FromMesh(
								baseDuplicate,
								false,
							);

							meshDuplicates.forEach((mesh) => {
								const meshCSG = flock.BABYLON.CSG2.FromMesh(
									mesh,
									false,
								);

								try {
									outerCSG = outerCSG.subtract(meshCSG);
								} catch (e) {
									console.log("CSG error", e);
								}
							});

							// Create the result mesh.
							const resultMesh = outerCSG.toMesh(
								"resultMesh",
								scene,
								{ centerMesh: false },
							);
							const localCenter = resultMesh
								.getBoundingInfo()
								.boundingBox.center.clone();

							resultMesh.setPivotMatrix(
								BABYLON.Matrix.Translation(
									localCenter.x,
									localCenter.y,
									localCenter.z,
								),
								false,
							);

							resultMesh.position.subtractInPlace(localCenter);
							//resultMesh.setParent(null);
							resultMesh.computeWorldMatrix(true);
							resultMesh.refreshBoundingInfo();

							resultMesh.computeWorldMatrix(true);

							flock.applyResultMeshProperties(
								resultMesh,
								actualMesh,
								modelId,
								blockId,
							);

							// Clean up duplicates.
							baseDuplicate.dispose();
							meshDuplicates.forEach((mesh) => mesh.dispose());

							// Clean up the original meshes used in the CSG operation.
							baseMesh.dispose();
							validMeshes.forEach((mesh) => mesh.dispose());

							resolve(modelId);
						} else {
							console.warn(
								"No valid meshes to subtract from the base mesh.",
							);
							resolve(null);
						}
					});
			});
		});
	},
	intersectMeshes(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Calculate the combined bounding box centre
					let min = new flock.BABYLON.Vector3(
						Number.MAX_VALUE,
						Number.MAX_VALUE,
						Number.MAX_VALUE,
					);
					let max = new flock.BABYLON.Vector3(
						Number.MIN_VALUE,
						Number.MIN_VALUE,
						Number.MIN_VALUE,
					);

					validMeshes.forEach((mesh) => {
						const boundingInfo = mesh.getBoundingInfo();
						const meshMin = boundingInfo.boundingBox.minimumWorld;
						const meshMax = boundingInfo.boundingBox.maximumWorld;

						min = flock.BABYLON.Vector3.Minimize(min, meshMin);
						max = flock.BABYLON.Vector3.Maximize(max, meshMax);
					});

					const combinedCentre = min.add(max).scale(0.5);

					let firstMesh = validMeshes[0];
					// If metadata exists, use the mesh with material.
					if (firstMesh.metadata?.modelName) {
						const meshWithMaterial =
							flock.findFirstDescendantWithMaterial(firstMesh);
						if (meshWithMaterial) {
							firstMesh = meshWithMaterial;
							firstMesh.refreshBoundingInfo();
							firstMesh.flipFaces();
						}
					}
					// Create the base CSG
					let baseCSG = flock.BABYLON.CSG2.FromMesh(firstMesh, false);

					// Intersect each subsequent mesh
					validMeshes.slice(1).forEach((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock.findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								mesh = meshWithMaterial;
								mesh.refreshBoundingInfo();
								mesh.flipFaces();
							}
						}
						const meshCSG = flock.BABYLON.CSG2.FromMesh(
							mesh,
							false,
						);
						baseCSG = baseCSG.intersect(meshCSG);
					});

					// Generate the resulting intersected mesh
					const intersectedMesh = baseCSG.toMesh(
						"intersectedMesh",
						validMeshes[0].getScene(),
					);

					// Align the resulting mesh to the combined centre
					intersectedMesh.position = combinedCentre;

					// Apply properties to the resulting mesh
					flock.applyResultMeshProperties(
						intersectedMesh,
						firstMesh,
						modelId,
						blockId,
					);

					validMeshes.forEach((mesh) => mesh.dispose());

					return modelId; // Return the modelId as per original functionality
				} else {
					console.warn("No valid meshes to intersect.");
					return null;
				}
			});
	},
	createHull(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Calculate the combined bounding box centre
					let min = validMeshes[0]
						.getBoundingInfo()
						.boundingBox.minimumWorld.clone();
					let max = validMeshes[0]
						.getBoundingInfo()
						.boundingBox.maximumWorld.clone();

					validMeshes.forEach((mesh) => {
						const boundingInfo = mesh.getBoundingInfo();
						const meshMin = boundingInfo.boundingBox.minimumWorld;
						const meshMax = boundingInfo.boundingBox.maximumWorld;

						min = flock.BABYLON.Vector3.Minimize(min, meshMin);
						max = flock.BABYLON.Vector3.Maximize(max, meshMax);
					});

					const combinedCentre = min.add(max).scale(0.5);

					// Merge the valid meshes into a single mesh
					const updatedValidMeshes = validMeshes.map((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock.findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								meshWithMaterial.refreshBoundingInfo();
								meshWithMaterial.flipFaces();
								return meshWithMaterial;
							}
						}
						return mesh;
					});

					const mergedMesh = BABYLON.Mesh.MergeMeshes(
						updatedValidMeshes,
						true,
					);

					if (!mergedMesh) {
						console.warn(
							"Failed to merge meshes for hull creation.",
						);
						return null;
					}

					// Offset the merged mesh to be locally centred
					mergedMesh.bakeTransformIntoVertices(
						BABYLON.Matrix.Translation(
							-combinedCentre.x,
							-combinedCentre.y,
							-combinedCentre.z,
						),
					);

					// Apply the material of the first mesh to the merged mesh
					mergedMesh.material = updatedValidMeshes[0].material;

					// Create the convex hull physics aggregate
					const hullAggregate = new BABYLON.PhysicsAggregate(
						mergedMesh,
						BABYLON.PhysicsShapeType.CONVEX_HULL,
						{ mass: 0 }, // Adjust mass based on use case
						flock.scene,
					);

					// Create a debug mesh to visualize the convex hull
					const hullMesh = flock.hullMeshFromBody(hullAggregate.body);

					// Offset the debug mesh to the original world position
					hullMesh.position = combinedCentre;

					hullMesh.material = updatedValidMeshes[0].material;

					// Apply properties to the resulting mesh
					flock.applyResultMeshProperties(
						hullMesh,
						updatedValidMeshes[0],
						modelId,
						blockId,
					);
					// Dispose of original meshes after creating the hull
					validMeshes.forEach((mesh) => mesh.dispose());
					mergedMesh.dispose();

					return modelId; // Return the debug mesh for further use
				} else {
					console.warn("No valid meshes to create a hull.");
					return null;
				}
			});
	},

	hullMeshFromBody(body) {
		const bodyInfoGeom = flock.hk.getBodyGeometry(body);
		const { positions, indices } = bodyInfoGeom;

		const hullMesh = new flock.BABYLON.Mesh("custom", flock.scene);
		indices.reverse();

		const vertexData = new flock.BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;

		vertexData.applyToMesh(hullMesh);

		return hullMesh;
	},
	prepareMeshes(modelId, meshNames, blockId) {
		return Promise.all(
			meshNames.map((meshName) => {
				return new Promise((resolve) => {
					flock.whenModelReady(meshName, (mesh) => {
						if (mesh) {
							mesh.name = modelId;
							mesh.blockKey = blockId;
							resolve(mesh);
						} else {
							console.warn(
								`Could not resolve mesh for ${meshName}`,
							);
							resolve(null);
						}
					});
				});
			}),
		).then((meshes) => meshes.filter((mesh) => mesh !== null));
	},
	applyResultMeshProperties(resultMesh, referenceMesh, modelId, blockId) {
		// Copy transformation properties
		referenceMesh.material.backFaceCulling = false;
		if (referenceMesh.rotationQuaternion) {
			resultMesh.rotationQuaternion =
				referenceMesh.rotationQuaternion.clone();
		} else {
			resultMesh.rotation.copyFrom(referenceMesh.rotation);
		}
		resultMesh.scaling.copyFrom(referenceMesh.scaling);
		resultMesh.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
		resultMesh.name = modelId;
		resultMesh.blockKey = blockId;

		// Apply physics
		flock.applyPhysics(
			resultMesh,
			new flock.BABYLON.PhysicsShapeMesh(resultMesh, flock.scene),
		);

		// Log and replace default materials
		const isDefaultMaterial = (material) => {
			return (
				material instanceof flock.BABYLON.StandardMaterial &&
				material.name === "default material"
			);
		};

		const replaceMaterial = () => {
			return referenceMesh.material.clone("clonedMaterial");
		};

		if (resultMesh.material) {
			if (resultMesh.material instanceof flock.BABYLON.MultiMaterial) {
				resultMesh.material.subMaterials =
					resultMesh.material.subMaterials.map((subMaterial) => {
						if (subMaterial && isDefaultMaterial(subMaterial)) {
							return replaceMaterial();
						}
						return subMaterial;
					});
			} else if (isDefaultMaterial(resultMesh.material)) {
				resultMesh.material = replaceMaterial();
				resultMesh.material.backFaceCulling = false;
			}
		}
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
	createCustomMap(colors) {
		console.log("Creating map", colors);
	},
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
	lightIntensity(intensity) {
		if (flock.mainLight) {
			flock.mainLight.intensity = intensity;
		} else {
			console.warn(
				"Main light is not defined. Please ensure flock.mainLight exists.",
			);
		}
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
	clearEffects(modelName) {
		return flock.whenModelReady(modelName, (mesh) => {
			const removeEffects = (targetMesh) => {
				if (targetMesh.material) {
					// Reset emissive color to black
					targetMesh.material.emissiveColor =
						flock.BABYLON.Color3.Black();
				}

				// Remove mesh from glow layer
				if (flock.glowLayer) {
					mesh.metadata.glow = false;
					flock.glowLayer.removeIncludedOnlyMesh(targetMesh);
				}

				flock.highlighter.removeMesh(targetMesh);
				// Disable any render overlay
				targetMesh.renderOverlay = false;
			};

			// Apply to the main mesh
			removeEffects(mesh);

			// Apply to child meshes
			mesh.getChildMeshes().forEach(removeEffects);
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
			// Get the mesh and all its descendants
			let allMeshes = [mesh, ...mesh.getDescendants()];

			// Set alpha for each mesh's material if it exists
			allMeshes.forEach((nextMesh) => {
				if (nextMesh.material) {
					flock.ensureUniqueMaterial(nextMesh);
					nextMesh.material.alpha = alphaValue;
					nextMesh.material.transparencyMode =
						BABYLON.Material.MATERIAL_ALPHABLEND;
				}
			});
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
	async playAnimation(
		modelName,
		animationName,
		loop = false,
		restart = true,
	) {
		const maxAttempts = 100;
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
	applyMaterialToMesh(mesh, shapeType, color, alpha = 1.0) {
		const scene = mesh.getScene();

		const makeColor4 = (c) => {
			if (typeof c === "string") {
				const col = BABYLON.Color3.FromHexString(c);
				return new BABYLON.Color4(col.r, col.g, col.b, alpha);
			} else if (c instanceof BABYLON.Color3) {
				return new BABYLON.Color4(c.r, c.g, c.b, alpha);
			} else if (c instanceof BABYLON.Color4) {
				return new BABYLON.Color4(c.r, c.g, c.b, alpha);
			} else {
				return new BABYLON.Color4(1, 1, 1, alpha); // default to white
			}
		};

		if (!Array.isArray(color) || color.length === 1) {
			const material = new BABYLON.StandardMaterial(
				`${shapeType.toLowerCase()}Material`,
				mesh.getScene(),
			);
			material.diffuseColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
			material.alpha = alpha;
			mesh.material = material;
			return;
		}

		if (shapeType === "Box") {
			const positions = mesh.getVerticesData(
				BABYLON.VertexBuffer.PositionKind,
			);
			const indices = mesh.getIndices();
			const normals = mesh.getVerticesData(
				BABYLON.VertexBuffer.NormalKind,
			);

			if (!positions || !indices || indices.length !== 36) {
				console.warn(
					"Mesh is not a standard box; falling back to uniform color.",
				);
				return this.applyMaterialToMesh(
					mesh,
					shapeType,
					color[0],
					alpha,
				);
			}

			// Face order: front, back, right, left, top, bottom
			const faceToSide = [
				"front", // face 0
				"back", // face 1
				"right", // face 2
				"left", // face 3
				"top", // face 4
				"bottom", // face 5
			];

			const sideColorMap = {
				front: makeColor4(color[0]),
				back: makeColor4(color[0]),
				left: makeColor4(color[0]),
				right: makeColor4(color[0]),
				top: makeColor4(color[0]),
				bottom: makeColor4(color[0]),
			};

			switch (color.length) {
				case 2:
					sideColorMap.top = sideColorMap.bottom = makeColor4(
						color[0],
					);
					sideColorMap.left =
						sideColorMap.right =
						sideColorMap.front =
						sideColorMap.back =
							makeColor4(color[1]);
					break;
				case 3:
					sideColorMap.top = sideColorMap.bottom = makeColor4(
						color[0],
					);
					sideColorMap.left = sideColorMap.right = makeColor4(
						color[1],
					);
					sideColorMap.front = sideColorMap.back = makeColor4(
						color[2],
					);
					break;
				case 4:
					sideColorMap.top = makeColor4(color[0]);
					sideColorMap.bottom = makeColor4(color[1]);
					sideColorMap.left = sideColorMap.right = makeColor4(
						color[2],
					);
					sideColorMap.front = sideColorMap.back = makeColor4(
						color[3],
					);
					break;
				case 5:
					sideColorMap.top = sideColorMap.bottom = makeColor4(
						color[0],
					);
					sideColorMap.left = makeColor4(color[1]);
					sideColorMap.right = makeColor4(color[2]);
					sideColorMap.front = makeColor4(color[3]);
					sideColorMap.back = makeColor4(color[4]);
					break;
				case 6:
				default:
					[
						sideColorMap.top,
						sideColorMap.bottom,
						sideColorMap.left,
						sideColorMap.right,
						sideColorMap.front,
						sideColorMap.back,
					] = color.slice(0, 6).map(makeColor4);
					break;
			}

			const colors = [];
			const newPositions = [];
			const newNormals = [];
			const newIndices = [];

			let baseIndex = 0;

			for (let i = 0; i < indices.length; i += 6) {
				const faceIndex = i / 6;
				const side = faceToSide[faceIndex];
				const faceColor = sideColorMap[side];

				for (let j = 0; j < 6; j++) {
					const vi = indices[i + j];

					newPositions.push(
						positions[vi * 3],
						positions[vi * 3 + 1],
						positions[vi * 3 + 2],
					);

					if (normals) {
						newNormals.push(
							normals[vi * 3],
							normals[vi * 3 + 1],
							normals[vi * 3 + 2],
						);
					}

					colors.push(
						faceColor.r,
						faceColor.g,
						faceColor.b,
						faceColor.a,
					);
					newIndices.push(baseIndex++);
				}
			}

			mesh.setVerticesData(
				BABYLON.VertexBuffer.PositionKind,
				newPositions,
			);
			mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, newNormals);
			mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
			mesh.setIndices(newIndices);

			mesh.hasVertexAlpha = true;

			const mat = new BABYLON.StandardMaterial("faceColorMat", scene);
			mat.diffuseColor = BABYLON.Color3.White();
			mat.backFaceCulling = false;
			mat.vertexColors = true;
			mesh.material = mat;
			return;
		}
		if (shapeType === "Cylinder") {
			const positions = mesh.getVerticesData(
				BABYLON.VertexBuffer.PositionKind,
			);
			const indices = mesh.getIndices();
			const normals = mesh.getVerticesData(
				BABYLON.VertexBuffer.NormalKind,
			);

			if (!positions || !indices) {
				console.warn(
					"Missing geometry for cylinder; falling back to uniform color.",
				);
				return this.applyMaterialToMesh(
					mesh,
					shapeType,
					color[0],
					alpha,
				);
			}

			const colors = [];
			const newPositions = [];
			const newNormals = [];
			const newIndices = [];

			const yVals = [];
			for (let i = 0; i < positions.length; i += 3) {
				yVals.push(positions[i + 1]);
			}

			const minY = Math.min(...yVals);
			const maxY = Math.max(...yVals);

			const makeColorFromIndex = (i) =>
				makeColor4(color[i % color.length]);

			let baseIndex = 0;
			let sideFaceIndex = 0;

			for (let i = 0; i < indices.length; i += 3) {
				const vi0 = indices[i];
				const vi1 = indices[i + 1];
				const vi2 = indices[i + 2];

				const y0 = positions[vi0 * 3 + 1];
				const y1 = positions[vi1 * 3 + 1];
				const y2 = positions[vi2 * 3 + 1];

				const isTop = y0 === maxY && y1 === maxY && y2 === maxY;
				const isBottom = y0 === minY && y1 === minY && y2 === minY;

				let faceColor;

				if (isTop) {
					faceColor = makeColor4(color[0]); // always color[0]
				} else if (isBottom) {
					faceColor = makeColor4(
						color.length > 1 ? color[1] : color[0],
					); // fallback to top if only 1 color
				} else {
					if (color.length === 2) {
						faceColor = makeColor4(color[1]);
					} else if (color.length === 3) {
						faceColor = makeColor4(color[2]);
					} else {
						// Use color[2+] for alternating side face colors, one color per 2 triangles
						const sideColorIndex =
							2 + Math.floor(sideFaceIndex / 2);
						faceColor = makeColor4(
							color[(sideColorIndex % (color.length - 2)) + 2],
						);
						sideFaceIndex++;
					}
				}

				for (let j = 0; j < 3; j++) {
					const vi = indices[i + j];

					newPositions.push(
						positions[vi * 3],
						positions[vi * 3 + 1],
						positions[vi * 3 + 2],
					);

					if (normals) {
						newNormals.push(
							normals[vi * 3],
							normals[vi * 3 + 1],
							normals[vi * 3 + 2],
						);
					}

					colors.push(
						faceColor.r,
						faceColor.g,
						faceColor.b,
						faceColor.a,
					);
					newIndices.push(baseIndex++);
				}
			}

			mesh.setVerticesData(
				BABYLON.VertexBuffer.PositionKind,
				newPositions,
			);
			if (normals)
				mesh.setVerticesData(
					BABYLON.VertexBuffer.NormalKind,
					newNormals,
				);
			mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
			mesh.setIndices(newIndices);

			mesh.hasVertexAlpha = true;

			const mat = new BABYLON.StandardMaterial("cylColorMat", scene);
			mat.diffuseColor = BABYLON.Color3.White();
			mat.backFaceCulling = false;
			mat.vertexColors = true;
			mesh.material = mat;
			return;
		}

		const material = new BABYLON.StandardMaterial(
			`${shapeType.toLowerCase()}Material`,
			mesh.getScene(),
		);
		material.diffuseColor = flock.BABYLON.Color3.FromHexString(
			flock.getColorFromString(color[0]),
		);
		material.alpha = alpha;
		mesh.material = material;
	},
	createPhysicsBody(
		mesh,
		shape,
		motionType = flock.BABYLON.PhysicsMotionType.STATIC,
	) {
		const physicsBody = new flock.BABYLON.PhysicsBody(
			mesh,
			motionType,
			false,
			flock.scene,
		);
		physicsBody.shape = shape;
		physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
		mesh.physics = physicsBody;
	},
	applyPhysics(geometry, physicsShape) {
		const physicsBody = new flock.BABYLON.PhysicsBody(
			geometry,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);
		physicsBody.shape = physicsShape;
		physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
		physicsBody.disablePreStep = false;

		geometry.physics = physicsBody;
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
	createBox(boxId, color, width, height, depth, position, alpha = 1) {
		let blockKey = boxId;

		if (boxId.includes("__")) {
			[boxId, blockKey] = boxId.split("__");
		}

		if (flock.scene.getMeshByName(boxId)) {
			boxId = boxId + "_" + flock.scene.getUniqueId();
		}

		const dimensions = { width, height, depth };

		// Retrieve cached VertexData or create it if this is the first instance
		const vertexData = flock.getOrCreateGeometry(
			"Box",
			dimensions,
			flock.scene,
		);

		// Create a new mesh and apply the cached VertexData
		const newBox = new BABYLON.Mesh(boxId, flock.scene);
		vertexData.applyToMesh(newBox);

		// Apply size-based UV mapping
		flock.setSizeBasedBoxUVs(newBox, width, height, depth);

		// Bake the scaling into the mesh
		newBox.bakeCurrentTransformIntoVertices();

		// Reset scaling to (1,1,1) since the transformation is now baked
		newBox.scaling.set(1, 1, 1);

		// Initialise the mesh with position, color, and other properties
		flock.initializeMesh(newBox, position, color, "Box", alpha);

		newBox.position.y += height / 2; // Middle of the box
		newBox.blockKey = blockKey;

		// Define and apply the physics shape
		const boxShape = new flock.BABYLON.PhysicsShapeBox(
			new BABYLON.Vector3(0, 0, 0),
			new BABYLON.Quaternion(0, 0, 0, 1),
			new BABYLON.Vector3(width, height, depth),
			flock.scene,
		);
		flock.applyPhysics(newBox, boxShape);

		return newBox.name;
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
	createSphere(
		sphereId,
		color,
		diameterX,
		diameterY,
		diameterZ,
		position,
		alpha = 1,
	) {
		let blockKey = sphereId;

		if (sphereId.includes("__")) {
			[sphereId, blockKey] = sphereId.split("__");
		}

		if (flock.scene.getMeshByName(sphereId)) {
			sphereId = sphereId + "_" + flock.scene.getUniqueId();
		}

		const dimensions = { diameterX, diameterY, diameterZ };

		// Retrieve cached VertexData or create it if this is the first instance
		const vertexData = flock.getOrCreateGeometry(
			"Sphere",
			dimensions,
			flock.scene,
		);

		if (!vertexData) return;

		// Create a new mesh and apply the cached VertexData
		const newSphere = new BABYLON.Mesh(sphereId, flock.scene);
		vertexData.applyToMesh(newSphere);

		flock.setSphereUVs(newSphere, diameterX, diameterY, diameterZ, 1);
		newSphere.bakeCurrentTransformIntoVertices();

		// Reset scaling to (1,1,1) since the transformation is now baked
		newSphere.scaling.set(1, 1, 1);

		// Initialise the mesh with position, color, and other properties
		flock.initializeMesh(newSphere, position, color, "Sphere", alpha);
		newSphere.position.y += diameterY / 2;

		newSphere.blockKey = blockKey;

		// Define and apply the physics shape
		const sphereShape = new flock.BABYLON.PhysicsShapeSphere(
			new BABYLON.Vector3(0, 0, 0),
			Math.max(diameterX, diameterY, diameterZ) / 2,
			flock.scene,
		);
		flock.applyPhysics(newSphere, sphereShape);

		return newSphere.name;
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
	getOrCreateMaterial(color, alpha, scene) {
		const color3 =
			typeof color === "string"
				? BABYLON.Color3.FromHexString(color)
				: color;
		const materialKey = `Color_${color3.toHexString()}_Alpha_${alpha}`;

		if (!flock.materialCache[materialKey]) {
			const material = new BABYLON.StandardMaterial(materialKey, scene);
			material.diffuseColor = color3;
			material.alpha = alpha;
			material.backFaceCulling = false;
			flock.materialCache[materialKey] = material;
		}

		return flock.materialCache[materialKey];
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
	createCylinder(
		cylinderId,
		color,
		height,
		diameterTop,
		diameterBottom,
		tessellation = 24, // Default tessellation to 12
		position,
		alpha = 1,
	) {
		const dimensions = {
			height,
			diameterTop,
			diameterBottom,
			tessellation, // Include tessellation in dimensions
			updatable: true,
		};

		let blockKey = cylinderId;

		if (cylinderId.includes("__")) {
			[cylinderId, blockKey] = cylinderId.split("__");
		}

		if (flock.scene.getMeshByName(cylinderId)) {
			cylinderId = cylinderId + "_" + flock.scene.getUniqueId();
		}

		// Get or create cached VertexData
		const vertexData = flock.getOrCreateGeometry(
			"Cylinder",
			dimensions,
			flock.scene,
		);

		// Create a new mesh and apply the cached VertexData
		const newCylinder = new BABYLON.Mesh(cylinderId, flock.scene);
		vertexData.applyToMesh(newCylinder);

		flock.setSizeBasedCylinderUVs(
			newCylinder,
			height,
			diameterTop,
			diameterBottom,
		); // Adjust texturePhysicalSize as needed

		newCylinder.bakeCurrentTransformIntoVertices();

		// Reset scaling to (1,1,1) since the transformation is now baked
		newCylinder.scaling.set(1, 1, 1);

		// Initialise the mesh with position, color, and other properties
		flock.initializeMesh(newCylinder, position, color, "Cylinder", alpha);
		newCylinder.position.y += height / 2;
		// Initialise the mesh with position, color, and other properties

		newCylinder.blockKey = blockKey;

		// Create and apply physics shape
		const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
		const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
		const cylinderShape = new flock.BABYLON.PhysicsShapeCylinder(
			startPoint,
			endPoint,
			diameterBottom / 2,
			flock.scene,
		);
		flock.applyPhysics(newCylinder, cylinderShape);

		return newCylinder.name;
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
	createCapsule(capsuleId, color, diameter, height, position, alpha = 1) {
		let radius = diameter / 2;
		let blockKey = capsuleId;

		if (capsuleId.includes("__")) {
			[capsuleId, blockKey] = capsuleId.split("__");
		}

		const dimensions = {
			radius,
			height,
			tessellation: 24,
			updatable: false,
		};

		if (flock.scene.getMeshByName(capsuleId)) {
			capsuleId = capsuleId + "_" + flock.scene.getUniqueId();
		}

		// Get or create cached VertexData
		const vertexData = flock.getOrCreateGeometry(
			"Capsule",
			dimensions,
			flock.scene,
		);

		// Create a new mesh and apply the cached VertexData
		const newCapsule = new BABYLON.Mesh(capsuleId, flock.scene);
		vertexData.applyToMesh(newCapsule);
		newCapsule.bakeCurrentTransformIntoVertices();

		// Reset scaling to (1,1,1) since the transformation is now baked
		newCapsule.scaling.set(1, 1, 1);

		// Initialise the mesh with position, color, and other properties
		flock.initializeMesh(newCapsule, position, color, "Capsule", alpha);
		newCapsule.position.y += height / 2;

		flock.setCapsuleUVs(newCapsule, radius, height, 1); // Adjust texturePhysicalSize as needed

		newCapsule.blockKey = blockKey;
		// Define central point for the capsule
		const center = new flock.BABYLON.Vector3(0, 0, 0);

		// Calculate physics shape parameters
		const capsuleRadius = radius;
		const cylinderHeight = Math.max(0, height - 2 * capsuleRadius);

		// Define the start and end points of the cylindrical segment
		const segmentStart = new flock.BABYLON.Vector3(
			center.x,
			center.y - cylinderHeight / 2 + 0.1,
			center.z,
		);
		const segmentEnd = new flock.BABYLON.Vector3(
			center.x,
			center.y + cylinderHeight / 2 + 0.1,
			center.z,
		);

		// Create and apply the physics shape using the central reference
		const capsuleShape = new flock.BABYLON.PhysicsShapeCapsule(
			segmentStart,
			segmentEnd,
			capsuleRadius,
			flock.scene,
		);
		flock.applyPhysics(newCapsule, capsuleShape);

		return newCapsule.name;
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
	createPlane(planeId, color, width, height, position) {
		// Handle block key
		let blockKey = planeId;
		if (planeId.includes("__")) {
			[planeId, blockKey] = planeId.split("__");
		}

		if (flock.scene.getMeshByName(planeId)) {
			planeId = planeId + "_" + flock.scene.getUniqueId();
		}

		console.log(
			"Creating plane with id: " + planeId,
			flock.scene.getMeshByName(planeId),
		);

		// Create plane with specified dimensions
		const newPlane = flock.BABYLON.MeshBuilder.CreatePlane(
			planeId,
			{
				width,
				height,
				sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE,
			},
			flock.scene,
		);
		// Set metadata and name
		newPlane.metadata = newPlane.metadata || {};
		newPlane.metadata.shape = "plane";

		// Set final position including the height offset all at once
		newPlane.position = new flock.BABYLON.Vector3(
			position[0],
			position[1] + height / 2,
			position[2],
		);

		// Create physics body
		const planeBody = new flock.BABYLON.PhysicsBody(
			newPlane,
			flock.BABYLON.PhysicsMotionType.STATIC,
			false,
			flock.scene,
		);

		// Create physics shape - matching the mesh position
		const planeShape = new flock.BABYLON.PhysicsShapeBox(
			new flock.BABYLON.Vector3(0, 0, 0), // Center offset
			new flock.BABYLON.Quaternion(0, 0, 0, 1),
			new flock.BABYLON.Vector3(width, height, 0.001),
			flock.scene,
		);

		// Set up physics properties
		planeBody.shape = planeShape;
		planeBody.setMassProperties({
			mass: 0,
			restitution: 0.5,
			inertia: flock.BABYLON.Vector3.ZeroReadOnly,
		});
		newPlane.physics = planeBody;

		flock.applyMaterialToMesh(newPlane, "Plane", color);

		newPlane.blockKey = blockKey;

		return newPlane.name;
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
	moveByVector(modelName, x, y, z) {
		return flock.whenModelReady(modelName, (mesh) => {
			mesh.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));
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
	scaleMesh(
		modelName,
		x,
		y,
		z,
		xOrigin = "CENTRE",
		yOrigin = "BOTTOM",
		zOrigin = "CENTRE",
	) {
		return flock.whenModelReady(modelName, (mesh) => {
			mesh.metadata = mesh.metadata || {};
			mesh.metadata.origin = { xOrigin, yOrigin, zOrigin };

			if (mesh.physics) {
				mesh.physics.disablePreStep = false;
			}
			// Get the original bounding box dimensions and positions
			const boundingInfo = mesh.getBoundingInfo();
			const originalMinY = boundingInfo.boundingBox.minimumWorld.y;
			const originalMaxY = boundingInfo.boundingBox.maximumWorld.y;
			const originalMinX = boundingInfo.boundingBox.minimumWorld.x;
			const originalMaxX = boundingInfo.boundingBox.maximumWorld.x;
			const originalMinZ = boundingInfo.boundingBox.minimumWorld.z;
			const originalMaxZ = boundingInfo.boundingBox.maximumWorld.z;

			// Apply scaling to the mesh
			mesh.scaling = new flock.BABYLON.Vector3(x, y, z);

			mesh.refreshBoundingInfo();
			mesh.computeWorldMatrix(true);

			// Get the new bounding box information after scaling
			const newBoundingInfo = mesh.getBoundingInfo();
			//console.log(newBoundingInfo);
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
			flock.updatePhysics(mesh);
		});
	},
	resizeMesh(
		modelName,
		newWidth,
		newHeight,
		newDepth,
		xOrigin = "CENTRE",
		yOrigin = "BASE", // Default is BASE
		zOrigin = "CENTRE",
	) {
		return flock.whenModelReady(modelName, (mesh) => {
			mesh.metadata = mesh.metadata || {};

			// Save the original local bounding box once.
			if (!mesh.metadata.originalMin || !mesh.metadata.originalMax) {
				const bi = mesh.getBoundingInfo();
				mesh.metadata.originalMin = bi.boundingBox.minimum.clone();
				mesh.metadata.originalMax = bi.boundingBox.maximum.clone();
			}
			const origMin = mesh.metadata.originalMin;
			const origMax = mesh.metadata.originalMax;

			// Compute the original dimensions.
			const origWidth = origMax.x - origMin.x;
			const origHeight = origMax.y - origMin.y;
			const origDepth = origMax.z - origMin.z;

			// Compute new scaling factors based on the original dimensions.
			const scaleX = origWidth ? newWidth / origWidth : 1;
			const scaleY = origHeight ? newHeight / origHeight : 1;
			const scaleZ = origDepth ? newDepth / origDepth : 1;

			// Refresh current bounding info and compute the old anchor (world space)
			mesh.refreshBoundingInfo();
			const oldBI = mesh.getBoundingInfo();
			const oldMinWorld = oldBI.boundingBox.minimumWorld;
			const oldMaxWorld = oldBI.boundingBox.maximumWorld;

			const oldAnchor = new flock.BABYLON.Vector3(
				xOrigin === "LEFT"
					? oldMinWorld.x
					: xOrigin === "RIGHT"
						? oldMaxWorld.x
						: (oldMinWorld.x + oldMaxWorld.x) / 2,
				yOrigin === "BASE"
					? oldMinWorld.y
					: yOrigin === "TOP"
						? oldMaxWorld.y
						: (oldMinWorld.y + oldMaxWorld.y) / 2,
				zOrigin === "FRONT"
					? oldMinWorld.z
					: zOrigin === "BACK"
						? oldMaxWorld.z
						: (oldMinWorld.z + oldMaxWorld.z) / 2,
			);

			// Apply the new scaling.
			mesh.scaling = new flock.BABYLON.Vector3(scaleX, scaleY, scaleZ);
			mesh.refreshBoundingInfo();
			mesh.computeWorldMatrix(true);

			// Now compute the new anchor (world space) after scaling.
			const newBI = mesh.getBoundingInfo();
			const newMinWorld = newBI.boundingBox.minimumWorld;
			const newMaxWorld = newBI.boundingBox.maximumWorld;

			const newAnchor = new flock.BABYLON.Vector3(
				xOrigin === "LEFT"
					? newMinWorld.x
					: xOrigin === "RIGHT"
						? newMaxWorld.x
						: (newMinWorld.x + newMaxWorld.x) / 2,
				yOrigin === "BASE"
					? newMinWorld.y
					: yOrigin === "TOP"
						? newMaxWorld.y
						: (newMinWorld.y + newMaxWorld.y) / 2,
				zOrigin === "FRONT"
					? newMinWorld.z
					: zOrigin === "BACK"
						? newMaxWorld.z
						: (newMinWorld.z + newMaxWorld.z) / 2,
			);

			// Compute the difference and adjust the mesh's position so the anchor stays fixed.
			const diff = newAnchor.subtract(oldAnchor);
			mesh.position.subtractInPlace(diff);

			// Final updates.
			mesh.refreshBoundingInfo();
			mesh.computeWorldMatrix(true);
			flock.updatePhysics(mesh);
		});
	},
	updatePhysics(mesh, parent = null) {
		if (!parent) parent = mesh;
		// If the mesh has a physics body, update its shape
		if (parent.physics) {
			// Preserve the disablePreStep setting if it exists
			const disablePreStep = parent.physics.disablePreStep || false;

			// Recreate the physics shape based on the new scale
			//console.log(parent.physics.shape.constructor.name);

			// Handling Capsule shape
			if (
				parent.physics.shape.constructor.name === "_PhysicsShapeCapsule"
			) {
				const newShape = flock.createCapsuleFromBoundingBox(
					mesh,
					flock.scene,
				);
				parent.physics.shape = newShape;
				parent.physics.setMassProperties({ mass: 1, restitution: 0.5 }); // Adjust properties as needed
			}

			// Handling Box shape
			else if (
				parent.physics.shape.constructor.name === "_PhysicsShapeBox"
			) {
				// Extract bounding box dimensions in world space (after scaling)
				const boundingBox = mesh.getBoundingInfo().boundingBox;
				const width =
					boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
				const height =
					boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
				const depth =
					boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

				const boxShape = new flock.BABYLON.PhysicsShapeBox(
					new flock.BABYLON.Vector3(0, 0, 0),
					new BABYLON.Quaternion(0, 0, 0, 1), // No rotation
					new BABYLON.Vector3(width, height, depth), // Updated dimensions
					flock.scene,
				);

				// Update the physics body with the new shape
				parent.physics.shape = boxShape;
			}

			// Handling Mesh shape
			else if (
				parent.physics.shape.constructor.name === "_PhysicsShapeMesh"
			) {
				// Create a new mesh shape based on the updated geometry of the mesh
				const newMeshShape = new flock.BABYLON.PhysicsShapeMesh(
					mesh,
					flock.scene,
				);

				// Update the physics body with the new mesh shape
				parent.physics.shape = newMeshShape;
			}

			// Preserve the disablePreStep setting from the previous physics object
			parent.physics.disablePreStep = disablePreStep;
			parent.physics.setMassProperties({ mass: 1, restitution: 0.5 });
		}
	},
	/*scaleMeshProportional(modelName, x, y, z) {
		return flock.whenModelReady(modelName, (mesh) => {
			// Get the first actual mesh inside the bounding box
			let targetMesh = mesh.getChildMeshes()[0] || mesh;

			// Ensure the world matrix is up-to-date
			targetMesh.computeWorldMatrix(true);
			targetMesh.refreshBoundingInfo();

			// Get the bounding box's scaling (it may not be 1,1,1)
			const boundingBoxScale = mesh.scaling.clone(); // This is the wrapper’s scale

			// Compensate for the bounding box’s transformation
			const correctedScale = new flock.BABYLON.Vector3(
				x / boundingBoxScale.x,
				y / boundingBoxScale.y,
				z / boundingBoxScale.z,
			);

			targetMesh.scaling = correctedScale;

			targetMesh.getChildMeshes()[0].refreshBoundingInfo();
			targetMesh.getChildMeshes()[0].computeWorldMatrix(true);
			// Refresh bounding info and world matrix
			targetMesh.refreshBoundingInfo();
			targetMesh.computeWorldMatrix(true);

			mesh.refreshBoundingInfo();
			mesh.computeWorldMatrix(true);

			// Update the physics shape based on the new scale
			flock.updatePhysics(
				targetMesh.getChildMeshes()[0] || targetMesh,
				mesh,
			);
		});
	},*/
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
					// Calculate the direction vector and its opposite
					const direction = targetPosition.subtract(
						mesh1.absolutePosition,
					);
					const oppositeTarget =
						mesh1.absolutePosition.subtract(direction);
					mesh1.lookAt(oppositeTarget);
				}

				if (mesh1.physics) {
					mesh1.physics.disablePreStep = false;
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
	rotate(meshName, x, y, z) {
		// Handle mesh rotation
		return flock.whenModelReady(meshName, (mesh) => {
			if (meshName === "__active_camera__") {
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
					if (!camera.rotationQuaternion) {
						camera.rotationQuaternion =
							flock.BABYLON.Quaternion.RotationYawPitchRoll(
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.y,
								),
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.x,
								),
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.z,
								),
							);
					}

					camera.rotationQuaternion
						.multiplyInPlace(incrementalRotation)
						.normalize();
				}
				return;
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

			if (mesh.physics) {
				mesh.physics.disablePreStep = false;
				mesh.physics.setTargetTransform(
					mesh.absolutePosition,
					mesh.rotationQuaternion,
				);
			}
			mesh.computeWorldMatrix(true);
		});
	},
	rotateTo(meshName, targetX, targetY, targetZ) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (meshName === "__active_camera__") {
				const camera = flock.scene.activeCamera;
				if (!camera) return;

				// For an ArcRotateCamera, set the absolute alpha (horizontal) and beta (vertical) angles.
				if (camera.alpha !== undefined) {
					camera.alpha = flock.BABYLON.Tools.ToRadians(targetY); // horizontal
					camera.beta = flock.BABYLON.Tools.ToRadians(targetX); // vertical
				}
				// For a FreeCamera or any camera using a rotationQuaternion:
				else if (camera.rotation !== undefined) {
					// Ensure a rotationQuaternion exists.
					if (!camera.rotationQuaternion) {
						camera.rotationQuaternion =
							flock.BABYLON.Quaternion.RotationYawPitchRoll(
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.y,
								),
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.x,
								),
								flock.BABYLON.Tools.ToRadians(
									camera.rotation.z,
								),
							).normalize();
					}
					// Create the target quaternion using the absolute Euler angles.
					// Here we assume targetY is yaw, targetX is pitch, and targetZ is roll.
					const targetQuat =
						flock.BABYLON.Quaternion.RotationYawPitchRoll(
							flock.BABYLON.Tools.ToRadians(targetY),
							flock.BABYLON.Tools.ToRadians(targetX),
							flock.BABYLON.Tools.ToRadians(targetZ),
						).normalize();

					// Set the camera's rotationQuaternion directly to the target.
					camera.rotationQuaternion = targetQuat;
				}
				return;
			}

			// Create the target rotation quaternion from absolute Euler angles (degrees)
			const radX = flock.BABYLON.Tools.ToRadians(targetX);
			const radY = flock.BABYLON.Tools.ToRadians(targetY);
			const radZ = flock.BABYLON.Tools.ToRadians(targetZ);
			const targetQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
				radY,
				radX,
				radZ,
			).normalize();

			// Get the current rotation quaternion of the mesh
			const currentQuat = mesh.rotationQuaternion.clone();

			// Calculate the incremental rotation needed:
			// q_increment = targetQuat * inverse(currentQuat)
			const diffQuat = targetQuat
				.multiply(currentQuat.conjugate())
				.normalize();

			// Convert the incremental rotation quaternion to Euler angles (in radians)
			const diffEuler = diffQuat.toEulerAngles();

			// Convert the incremental angles to degrees
			const incX = flock.BABYLON.Tools.ToDegrees(diffEuler.x);
			const incY = flock.BABYLON.Tools.ToDegrees(diffEuler.y);
			const incZ = flock.BABYLON.Tools.ToDegrees(diffEuler.z);

			flock.rotate(meshName, incX, incY, incZ);
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
					// Store the original rotation
					const startRotation = mesh.rotation.clone();

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
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO;
					} else if (loop) {
						loopMode =
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE;
					} else {
						loopMode =
							flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT;
					}

					// Create animation for rotation only
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

					// Use beginDirectAnimation to apply ONLY the rotation animation
					// This ensures we don't interfere with any other properties
					const animatable = flock.scene.beginDirectAnimation(
						mesh,
						[rotateAnimation],
						0,
						frames,
						loop,
					);

					animatable.onAnimationEndObservable.add(() => {
						resolve();
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

			// Check if we have pivot settings in metadata
			if (mesh.metadata && mesh.metadata.pivotSettings) {
				const pivotSettings = mesh.metadata.pivotSettings;
				const boundingBox =
					mesh.getBoundingInfo().boundingBox.extendSize;

				// Helper to resolve pivot values
				function resolvePivotValue(value, axis) {
					if (typeof value === "string") {
						switch (value) {
							case "MIN":
								return -boundingBox[axis];
							case "MAX":
								return boundingBox[axis];
							case "CENTER":
							default:
								return 0;
						}
					} else if (typeof value === "number") {
						return value;
					} else {
						return 0;
					}
				}

				// Calculate offset based on pivot settings
				const pivotOffsetX = resolvePivotValue(pivotSettings.x, "x");
				const pivotOffsetY = resolvePivotValue(pivotSettings.y, "y");
				const pivotOffsetZ = resolvePivotValue(pivotSettings.z, "z");

				// Apply position with pivot offset
				mesh.position.set(
					x - pivotOffsetX,
					useY ? y - pivotOffsetY : mesh.position.y,
					z - pivotOffsetZ,
				);
			} else {
				// Original behavior if no pivot settings
				const addY =
					meshName === "__active_camera__"
						? 0
						: mesh.getBoundingInfo().boundingBox.extendSize.y *
							mesh.scaling.y;
				let targetY = useY ? y + addY : mesh.position.y;
				mesh.position.set(x, targetY, z);
			}

			// Update physics and world matrix
			if (mesh.physics) {
				mesh.physics.disablePreStep = false;
				mesh.physics.setTargetTransform(
					mesh.position,
					mesh.rotationQuaternion,
				);
			}
			mesh.computeWorldMatrix(true);
			//console.log("Position at", x, y, z, mesh.position.y, mesh);
		});
	},
	setPivotPoint(meshName, xPivot, yPivot, zPivot) {
		return flock.whenModelReady(meshName, (mesh) => {
			if (mesh) {
				const boundingBox =
					mesh.getBoundingInfo().boundingBox.extendSize;

				// Helper to resolve "MIN", "CENTER", "MAX", or numbers
				function resolvePivotValue(value, axis) {
					if (typeof value === "string") {
						switch (value) {
							case "MIN":
								return -boundingBox[axis];
							case "MAX":
								return boundingBox[axis];
							case "CENTER":
							default:
								return 0;
						}
					} else if (typeof value === "number") {
						return value;
					} else {
						return 0;
					}
				}

				// Resolve pivot values for each axis
				const resolvedX = resolvePivotValue(xPivot, "x");
				const resolvedY = resolvePivotValue(yPivot, "y");
				const resolvedZ = resolvePivotValue(zPivot, "z");

				const pivotPoint = new flock.BABYLON.Vector3(
					resolvedX,
					resolvedY,
					resolvedZ,
				);
				mesh.setPivotPoint(pivotPoint);

				// Set pivot point on child meshes
				mesh.getChildMeshes().forEach((child) => {
					child.setPivotPoint(pivotPoint);
				});

				// Store original pivot settings in metadata
				mesh.metadata = mesh.metadata || {};
				mesh.metadata.pivotSettings = {
					x: xPivot,
					y: yPivot,
					z: zPivot,
				};
			}
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
	createSmallButton(text, key, color) {
		if (!flock.controlsTexture) return;

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
		// Add a safety check at the beginning of the function
		if (!flock.controlsTexture) return;

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
		if (!flock.controlsTexture) return;
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

		flock.controlsTexture =
			flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

		// Set all controls to be non-interactive if disabled
		flock.controlsTexture.rootContainer.isEnabled = enabled;

		// Only create/update controls if they don't exist yet
		if (enabled) {
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
					const startPosition = mesh.position.clone(); // Capture start position

					const addY =
						meshName === "__active_camera__"
							? 0
							: mesh.getBoundingInfo().boundingBox.extendSize.y *
								mesh.scaling.y;

					let targetY = y + addY;

					const endPosition = new flock.BABYLON.Vector3(
						x,
						targetY,
						z,
					);
					const fps = 30;
					const frames = fps * (duration / 1000);

					const glideAnimation = new flock.BABYLON.Animation(
						"glideTo",
						"position",
						fps,
						flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
						loop || reverse
							? flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE // Continuous loop or reverse
							: flock.BABYLON.Animation
									.ANIMATIONLOOPMODE_CONSTANT, // Stops at end
					);

					// Define keyframes for forward and reverse motion
					const glideKeys = [
						{ frame: 0, value: startPosition }, // Start position
						{ frame: frames, value: endPosition }, // End position
					];

					// Add reverse motion if required
					if (reverse || loop) {
						glideKeys.push(
							{ frame: frames * 2, value: startPosition }, // Return to start
						);
					}

					// Set keyframes
					glideAnimation.setKeys(glideKeys);

					// Apply easing if specified
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
								easingFunction = new flock.BABYLON.SineEase(); // Default to SineEase
						}
						easingFunction.setEasingMode(
							flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
						);
						glideAnimation.setEasingFunction(easingFunction);
					}

					// Attach the animation to the mesh
					mesh.animations.push(glideAnimation);

					// Start the animation
					const animatable = flock.scene.beginAnimation(
						mesh,
						0,
						reverse ? frames * 2 : frames,
						loop,
					);

					if (mesh.physics) {
						mesh.physics.disablePreStep = false;
						mesh.physics.setPrestepType(
							flock.BABYLON.PhysicsPrestepType.ACTION,
						);
					}
					animatable.onAnimationEndObservable.add(() => {
						if (reverse) {
							// Ensure mesh ends at the final position for non-looping animations
							mesh.position = startPosition.clone();
						} else {
							mesh.position = endPosition.clone();
						}
						resolve();
					});
				} else {
					resolve(); // Resolve immediately if the mesh is not available
				}
			});
		});
	},
	resolvePropertyToAnimate(property, mesh) {
		if (!mesh) {
			console.warn("Mesh not found.");
			return null;
		}

		switch (property) {
			case "color":
				flock.ensureUniqueMaterial(mesh);
				return mesh.material?.diffuseColor !== undefined
					? "material.diffuseColor"
					: "material.albedoColor";

			case "alpha":
				if (mesh.material) {
					mesh.material.transparencyMode =
						BABYLON.Material.MATERIAL_ALPHABLEND;
				}
				return "material.alpha";

			default:
				// Handle rotation.x, rotation.y, rotation.z with quaternions
				if (
					["rotation.x", "rotation.y", "rotation.z"].includes(
						property,
					) &&
					mesh.rotationQuaternion // Only applies if using quaternions
				) {
					return "rotationQuaternion"; // Map to rotationQuaternion
				}

				// Leave everything else unchanged
				return property;
		}
	},
	determineAnimationType(property) {
		// Handle rotation.x, rotation.y, rotation.z with quaternions
		if (["rotation.x", "rotation.y", "rotation.z"].includes(property)) {
			return flock.BABYLON.Animation.ANIMATIONTYPE_QUATERNION; // Quaternion type
		}

		switch (property) {
			case "color":
				return flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3;

			case "position":
			case "rotation":
			case "scaling":
				return flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3; // Full Vector3 properties

			default:
				return flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT; // Scalars like position.x and scaling.x
		}
	},
	parseKeyframeValue(property, value, mesh) {
		// Handle quaternion rotation for rotation.x, rotation.y, and rotation.z
		if (
			["rotation.x", "rotation.y", "rotation.z"].includes(property) &&
			mesh.rotationQuaternion // Only applies if using quaternions
		) {
			// Ensure the quaternion exists
			if (!mesh.rotationQuaternion) {
				mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(
					mesh.rotation || BABYLON.Vector3.Zero(),
				);
			}

			// Convert quaternion to Euler angles
			const euler = mesh.rotationQuaternion.toEulerAngles();

			// Update the specified axis (convert degrees to radians)
			const radians = BABYLON.Tools.ToRadians(value); // Degrees → Radians
			switch (property) {
				case "rotation.x":
					euler.x = radians;
					break;
				case "rotation.y":
					euler.y = radians;
					break;
				case "rotation.z":
					euler.z = radians;
					break;
			}

			// Return the updated quaternion
			return BABYLON.Quaternion.RotationYawPitchRoll(
				euler.y,
				euler.x,
				euler.z,
			);
		}

		// Handle full Vector3 rotations
		if (property.startsWith("rotation")) {
			if (value instanceof BABYLON.Vector3) {
				return new BABYLON.Vector3(
					BABYLON.Tools.ToRadians(value.x || 0),
					BABYLON.Tools.ToRadians(value.y || 0),
					BABYLON.Tools.ToRadians(value.z || 0),
				);
			} else if (typeof value === "string") {
				const vectorValues = value.match(/-?\d+(\.\d+)?/g).map(Number);
				return new BABYLON.Vector3(
					BABYLON.Tools.ToRadians(vectorValues[0] || 0),
					BABYLON.Tools.ToRadians(vectorValues[1] || 0),
					BABYLON.Tools.ToRadians(vectorValues[2] || 0),
				);
			}
		}

		// Colors remain unchanged
		if (property === "color") {
			return BABYLON.Color3.FromHexString(value);
		}

		// Handle position and scaling as Vector3
		if (["position", "scaling"].some((p) => property.startsWith(p))) {
			if (value instanceof BABYLON.Vector3) {
				return value;
			} else if (typeof value === "string") {
				const vectorValues = value.match(/-?\d+(\.\d+)?/g).map(Number);
				return new BABYLON.Vector3(
					vectorValues[0] || 0,
					vectorValues[1] || 0,
					vectorValues[2] || 0,
				);
			}
		}

		// Scalar values for properties like position.x, scaling.x
		if (/\.(x|y|z)$/.test(property)) {
			return parseFloat(value); // Scalar values remain unchanged
		}

		return parseFloat(value); // Default for scalar properties
	},
	findFirstDescendantWithMaterial(mesh) {
		if (mesh.material) return mesh;
		const descendants = mesh.getDescendants();
		return descendants.find((descendant) => descendant.material) || null;
	},
	addAnimationToGroup(animationGroup, animation, target) {
		// Add the animation to the group
		animationGroup.addTargetedAnimation(animation, target);

		if (animationGroup.isStarted) {
			// Get the current frame of the first animation in the group
			const currentFrame =
				animationGroup.targetedAnimations[0]?.animation
					.runtimeAnimations[0]?.currentFrame;

			if (currentFrame !== undefined) {
				// Find the RuntimeAnimation for the newly added animation
				const runtimeAnimation = animation.runtimeAnimations.find(
					(ra) => ra.target === target,
				);

				if (runtimeAnimation) {
					runtimeAnimation.goToFrame(currentFrame);
					//console.log(`New animation synchronised to frame ${currentFrame}.`);
				}
			} else {
				console.warn(
					"Could not retrieve the current frame for synchronisation.",
				);
			}
		}
	},
	playAnimationGroup(groupName) {
		const animationGroup = flock.scene.animationGroups.find(
			(group) => group.name === groupName,
		);
		if (animationGroup) {
			animationGroup.play();
		} else {
			console.warn(`Animation group '${groupName}' not found.`);
		}
	},
	pauseAnimationGroup(groupName) {
		const animationGroup = flock.scene.animationGroups.find(
			(group) => group.name === groupName,
		);
		if (animationGroup) {
			animationGroup.pause();
		} else {
			console.warn(`Animation group '${groupName}' not found.`);
		}
	},
	stopAnimationGroup(groupName) {
		const animationGroup = flock.scene.animationGroups.find(
			(group) => group.name === groupName,
		);
		if (animationGroup) {
			animationGroup.stop();
		} else {
			console.warn(`Animation group '${groupName}' not found.`);
		}
	},
	startParticleSystem(systemName) {
		const particleSystem = flock.scene.particleSystems.find(
			(system) => system.name === systemName,
		);
		if (particleSystem) {
			particleSystem.start();
		} else {
			console.warn(`Particle system '${systemName}' not found.`);
		}
	},

	stopParticleSystem(systemName) {
		const particleSystem = flock.scene.particleSystems.find(
			(system) => system.name === systemName,
		);

		if (particleSystem) {
			particleSystem.stop();
		} else {
			console.warn(`Particle system '${systemName}' not found.`);
		}
	},
	resetParticleSystem(systemName) {
		const particleSystem = flock.scene.particleSystems.find(
			(system) => system.name === systemName,
		);
		if (particleSystem) {
			particleSystem.reset();
		} else {
			console.warn(`Particle system '${systemName}' not found.`);
		}
	},
	animateFrom(groupName, timeInSeconds) {
		const animationGroup = flock.scene.animationGroups.find(
			(group) => group.name === groupName,
		);
		if (animationGroup) {
			const animation = animationGroup.targetedAnimations[0]?.animation;
			if (!animation) {
				console.warn(
					`Animation group '${groupName}' has no animations.`,
				);
				return;
			}

			const fps = animation.framePerSecond;
			const frame = timeInSeconds * fps;

			animationGroup.goToFrame(frame);
			animationGroup.play();
		} else {
			console.warn(`Animation group '${groupName}' not found.`);
		}
	},
	createAnimation(
		animationGroupName,
		meshName,
		property,
		keyframes,
		easing = "Linear",
		loop = false,
		reverse = false,
		mode = "START", // Default to starting the animation
	) {
		return new Promise(async (resolve) => {
			// Ensure animationGroupName is not null; generate a unique name if it is
			animationGroupName =
				animationGroupName || `animation_${flock.scene.getUniqueId()}`;

			// Ensure the animation group exists or create a new one
			let animationGroup =
				flock.scene.getAnimationGroupByName(animationGroupName);
			if (!animationGroup) {
				animationGroup = new flock.BABYLON.AnimationGroup(
					animationGroupName,
					flock.scene,
				);
				//console.log(`Created new animation group: ${animationGroupName}`);
			}

			await flock.whenModelReady(meshName, async (mesh) => {
				if (!mesh) {
					console.warn(`Mesh ${meshName} not found.`);
					resolve(animationGroupName);
					return;
				}
				/*mesh.physics.disablePreStep = false;
				mesh.physics.setPrestepType(
					flock.BABYLON.PhysicsPrestepType.ACTION,
				);*/

				if (property === "alpha") {
					flock.ensureUniqueMaterial(mesh);
				}

				// Determine the meshes to animate
				const meshesToAnimate =
					property === "alpha"
						? [mesh, ...mesh.getDescendants()].filter(
								(m) => m.material,
							) // Include descendants for alpha
						: [mesh]; // Only the root mesh for other properties

				for (const targetMesh of meshesToAnimate) {
					const propertyToAnimate = flock.resolvePropertyToAnimate(
							property,
							targetMesh,
						),
						fps = 30, // Frames per second
						animationType = flock.determineAnimationType(property),
						loopMode = BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE; // Always use cycle mode for looping

					const keyframeAnimation = new flock.BABYLON.Animation(
						`${animationGroupName}_${property}`,
						propertyToAnimate,
						fps,
						animationType,
						loopMode,
					);

					// Convert keyframes (with absolute time in seconds) to Babylon.js frames
					const forwardKeyframes = keyframes.map((keyframe) => ({
						frame: Math.round((keyframe.duration || 0) * fps), // Convert seconds to frames
						value: flock.parseKeyframeValue(
							property,
							keyframe.value,
							targetMesh,
						),
					}));

					// Add a keyframe at frame 0 if one doesn't exist already.
					if (!forwardKeyframes.some((k) => k.frame === 0)) {
						let currentValue;
						if (property === "alpha") {
							// For alpha, get the current alpha from the mesh's material.
							if (
								targetMesh.material &&
								typeof targetMesh.material.alpha !== "undefined"
							) {
								currentValue = targetMesh.material.alpha;
							} else {
								currentValue = 1; // Default alpha value.
							}
						} else if (
							[
								"color",
								"colour",
								"diffuseColor",
								"colour_keyframe",
							].includes(property)
						) {
							// For colors, get and clone the diffuseColor.
							if (
								targetMesh.material &&
								targetMesh.material.diffuseColor
							) {
								currentValue =
									targetMesh.material.diffuseColor.clone();
							} else {
								currentValue =
									BABYLON.Color3.FromHexString("#ffffff");
							}
						} else {
							// For other properties, read the value directly.
							currentValue = targetMesh[propertyToAnimate];
							if (
								currentValue &&
								typeof currentValue.clone === "function"
							) {
								currentValue = currentValue.clone();
							}
						}
						forwardKeyframes.unshift({
							frame: 0,
							value: currentValue,
						});
					}

					// Generate reverse keyframes by mirroring forward frames
					const reverseKeyframes = reverse
						? forwardKeyframes
								.slice(0, -1) // Exclude the last frame to avoid duplication
								.reverse()
								.map((keyframe, index) => ({
									frame:
										forwardKeyframes[
											forwardKeyframes.length - 1
										].frame +
										(forwardKeyframes[index + 1]?.frame -
											keyframe.frame),
									value: keyframe.value,
								}))
						: [];

					// Combine forward and reverse keyframes
					const allKeyframes = [
						...forwardKeyframes,
						...reverseKeyframes,
					];

					// Ensure sufficient keyframes
					if (allKeyframes.length > 1) {
						keyframeAnimation.setKeys(allKeyframes);
					} else {
						console.warn("Insufficient keyframes for animation.");
						continue; // Skip this mesh
					}

					// Apply easing function
					flock.applyEasing(keyframeAnimation, easing);

					// Add the animation to the group
					flock.addAnimationToGroup(
						animationGroup,
						keyframeAnimation,
						targetMesh,
					);

					//console.log(`Added animation to group "${animationGroupName}" for property "${property}" on mesh "${targetMesh.name}".`);
				}

				if (animationGroup.targetedAnimations.length === 0) {
					console.warn("No animations added to the group.");
					resolve(animationGroupName);
					return;
				}

				if (mode === "START" || mode === "AWAIT") {
					// Start the animation group
					animationGroup.play(loop);

					if (mode === "AWAIT") {
						animationGroup.onAnimationEndObservable.add(() => {
							resolve(animationGroupName);
						});
					} else {
						resolve(animationGroupName);
					}
				} else if (mode === "CREATE") {
					// Do not start the animation group and prevent automatic playback
					animationGroup.stop(); // Explicitly ensure animations do not play
					animationGroup.onAnimationGroupPlayObservable.clear(); // Clear any unintended triggers
					//console.log("Animation group created but not started.");
					resolve(animationGroupName);
				} else {
					console.warn(`Unknown mode: ${mode}`);
					resolve(animationGroup);
				}
			});
		});
	},
	createAnimation2(
		animationGroupName,
		meshName,
		property,
		keyframes,
		easing = "Linear",
		loop = false,
		reverse = false,
		mode = "START", // Default to starting the animation
	) {
		console.log("Keyframe animation with", keyframes);

		return new Promise(async (resolve) => {
			// Ensure animationGroupName is not null; generate a unique name if it is
			animationGroupName =
				animationGroupName || `animation_${flock.scene.getUniqueId()}`;

			// Ensure the animation group exists or create a new one
			let animationGroup =
				flock.scene.getAnimationGroupByName(animationGroupName);
			if (!animationGroup) {
				animationGroup = new flock.BABYLON.AnimationGroup(
					animationGroupName,
					flock.scene,
				);
				//console.log(`Created new animation group: ${animationGroupName}`);
			}

			await flock.whenModelReady(meshName, async (mesh) => {
				if (!mesh) {
					console.warn(`Mesh ${meshName} not found.`);
					resolve(animationGroupName);
					return;
				}
				/*mesh.physics.disablePreStep = false;
				mesh.physics.setPrestepType(
					flock.BABYLON.PhysicsPrestepType.ACTION,
				);*/

				if (property === "alpha") {
					flock.ensureUniqueMaterial(mesh);
				}

				// Determine the meshes to animate
				const meshesToAnimate =
					property === "alpha"
						? [mesh, ...mesh.getDescendants()].filter(
								(m) => m.material,
							) // Include descendants for alpha
						: [mesh]; // Only the root mesh for other properties

				for (const targetMesh of meshesToAnimate) {
					const propertyToAnimate = flock.resolvePropertyToAnimate(
							property,
							targetMesh,
						),
						fps = 30, // Frames per second
						animationType = flock.determineAnimationType(property),
						loopMode = BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE; // Always use cycle mode for looping

					const keyframeAnimation = new flock.BABYLON.Animation(
						`${animationGroupName}_${property}`,
						propertyToAnimate,
						fps,
						animationType,
						loopMode,
					);

					// Convert keyframes (with absolute time in seconds) to Babylon.js frames
					const forwardKeyframes = keyframes.map((keyframe) => ({
						frame: Math.round((keyframe.duration || 0) * fps), // Convert seconds to frames
						value: flock.parseKeyframeValue(
							property,
							keyframe.value,
							mesh,
						),
					}));

					// Generate reverse keyframes by mirroring forward frames
					const reverseKeyframes = reverse
						? forwardKeyframes
								.slice(0, -1) // Exclude the last frame to avoid duplication
								.reverse()
								.map((keyframe, index) => ({
									frame:
										forwardKeyframes[
											forwardKeyframes.length - 1
										].frame +
										(forwardKeyframes[index + 1]?.frame -
											keyframe.frame),
									value: keyframe.value,
								}))
						: [];

					// Combine forward and reverse keyframes
					const allKeyframes = [
						...forwardKeyframes,
						...reverseKeyframes,
					];

					// Debugging: Log keyframes
					/*console.log(
						"Generated Keyframes (with frames):",
						allKeyframes,
						propertyToAnimate,
						animationType,
						"quaternion",
						mesh.rotationQuaternion,
					);*/

					// Ensure sufficient keyframes
					if (allKeyframes.length > 1) {
						keyframeAnimation.setKeys(allKeyframes);
					} else {
						console.warn("Insufficient keyframes for animation.");
						continue; // Skip this mesh
					}

					// Apply easing function
					flock.applyEasing(keyframeAnimation, easing);

					// Add the animation to the group
					flock.addAnimationToGroup(
						animationGroup,
						keyframeAnimation,
						targetMesh,
					);

					//console.log(`Added animation to group "${animationGroupName}" for property "${property}" on mesh "${targetMesh.name}".`);
				}

				if (animationGroup.targetedAnimations.length === 0) {
					console.warn("No animations added to the group.");
					resolve(animationGroupName);
					return;
				}

				if (mode === "START" || mode === "AWAIT") {
					// Start the animation group
					animationGroup.play(loop);

					if (mode === "AWAIT") {
						animationGroup.onAnimationEndObservable.add(() => {
							resolve(animationGroupName);
						});
					} else {
						resolve(animationGroupName);
					}
				} else if (mode === "CREATE") {
					// Do not start the animation group and prevent automatic playback
					animationGroup.stop(); // Explicitly ensure animations do not play
					animationGroup.onAnimationGroupPlayObservable.clear(); // Clear any unintended triggers
					//console.log("Animation group created but not started.");
					resolve(animationGroupName);
				} else {
					console.warn(`Unknown mode: ${mode}`);
					resolve(animationGroup);
				}
			});
		});
	},
	applyEasing(animation, easing) {
		let easingFunction;

		switch (easing.toLowerCase()) {
			case "ease-in":
				easingFunction = new BABYLON.QuadraticEase();
				easingFunction.setEasingMode(
					BABYLON.EasingFunction.EASINGMODE_EASEIN,
				);
				break;
			case "ease-out":
				easingFunction = new BABYLON.QuadraticEase();
				easingFunction.setEasingMode(
					BABYLON.EasingFunction.EASINGMODE_EASEOUT,
				);
				break;
			case "ease-in-out":
				easingFunction = new BABYLON.QuadraticEase();
				easingFunction.setEasingMode(
					BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
				);
				break;
			case "linear":
			default:
				easingFunction = null; // No easing for linear
				break;
		}

		if (easingFunction) {
			animation.setEasingFunction(easingFunction);
			//console.log(`Applied easing: ${easing}`);
		}
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
			await flock.whenModelReady(meshName, async (mesh) => {
				if (!mesh) {
					resolve();
					return;
				}

				let propertyToAnimate;

				// Resolve material-related properties
				if (property === "color" || property === "alpha") {
					function findFirstDescendantWithMaterial(mesh) {
						if (mesh.material) {
							return mesh;
						}
						const descendants = mesh.getDescendants();
						for (const descendant of descendants) {
							if (descendant.material) {
								return descendant;
							}
						}
						return null;
					}
					mesh = findFirstDescendantWithMaterial(mesh);
				}

				// Resolve the property to animate
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
						: ["position", "rotation", "scaling"].includes(property)
							? flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3
							: flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT;

				const keyframeAnimation = new flock.BABYLON.Animation(
					"keyframeAnimation",
					propertyToAnimate,
					fps,
					animationType,
					flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, // Force cycle mode
				);

				// Generate forward keyframes with seconds-to-frames conversion
				let currentFrame = 0;
				const forwardKeyframes = keyframes.map((keyframe) => {
					let value;

					// Resolve value based on property type
					if (property === "color") {
						value = flock.BABYLON.Color3.FromHexString(
							keyframe.value,
						);
					} else if (
						["position", "rotation", "scaling"].includes(property)
					) {
						if (keyframe.value instanceof flock.BABYLON.Vector3) {
							value =
								property === "rotation"
									? new flock.BABYLON.Vector3(
											flock.BABYLON.Tools.ToRadians(
												keyframe.value.x,
											),
											flock.BABYLON.Tools.ToRadians(
												keyframe.value.y,
											),
											flock.BABYLON.Tools.ToRadians(
												keyframe.value.z,
											),
										)
									: keyframe.value;
						} else if (typeof keyframe.value === "string") {
							const vectorValues =
								keyframe.value.match(/-?\d+(\.\d+)?/g);
							value =
								property === "rotation"
									? new flock.BABYLON.Vector3(
											flock.BABYLON.Tools.ToRadians(
												parseFloat(vectorValues[0]),
											),
											flock.BABYLON.Tools.ToRadians(
												parseFloat(vectorValues[1]),
											),
											flock.BABYLON.Tools.ToRadians(
												parseFloat(vectorValues[2]),
											),
										)
									: new flock.BABYLON.Vector3(
											parseFloat(vectorValues[0]),
											parseFloat(vectorValues[1]),
											parseFloat(vectorValues[2]),
										);
						}
					} else {
						value = parseFloat(keyframe.value);
					}

					// Calculate frame duration based on FPS
					const frameDuration = Math.round(
						(keyframe.duration || 1) * fps,
					); // Convert seconds to frames
					const frame = currentFrame;
					currentFrame += frameDuration; // Increment frames
					return { frame, value };
				});

				// Add an initial keyframe at the end for smooth looping if necessary
				if (
					loop &&
					!reverse &&
					forwardKeyframes.length > 0 &&
					keyframes.length > 0 &&
					keyframes[keyframes.length - 1].duration > 0 // Explicit check for non-zero duration
				) {
					const initialKeyframe = {
						frame: currentFrame,
						value: forwardKeyframes[0].value, // Use the initial keyframe value
					};
					forwardKeyframes.push(initialKeyframe);
					currentFrame += fps; // Increment frames for the loop-back duration
				}

				// Generate reverse keyframes if required
				const reverseKeyframes = reverse
					? forwardKeyframes
							.slice(0, -1) // Exclude the last frame to avoid duplication
							.reverse()
							.map((keyframe, index) => ({
								frame: currentFrame + index, // Continue frame numbering
								value: keyframe.value,
							}))
					: [];

				// Combine forward and reverse keyframes
				const allKeyframes = [...forwardKeyframes, ...reverseKeyframes];

				// Log generated keyframes for debugging
				//console.log("Generated Keyframes: ", allKeyframes);

				if (allKeyframes.length > 1) {
					keyframeAnimation.setKeys(allKeyframes);
				} else {
					console.warn("Insufficient keyframes for animation.");
					resolve();
					return;
				}

				mesh.animations.push(keyframeAnimation);

				if (property === "alpha") {
					mesh.material.markAsDirty(
						flock.BABYLON.Material.MiscDirtyFlag,
					);
				}

				const lastFrame = allKeyframes[allKeyframes.length - 1].frame;

				//console.log(`Animating from frame 0 to ${lastFrame}`);

				const animatable = flock.scene.beginAnimation(
					mesh,
					0,
					lastFrame,
					loop,
				);

				animatable.onAnimationEndObservable.add(() => {
					//console.log("Animation completed.");
					resolve();
				});
			});
		});
	},
	stopAnimations(modelName) {
		return flock.whenModelReady(modelName, (mesh) => {
			if (mesh && mesh.animations) {
				// Stop all animations directly on the mesh
				flock.scene.stopAnimation(mesh);
			}

			// Alternatively, if using animation groups:
			if (mesh.animationGroups) {
				mesh.animationGroups.forEach((group) => {
					group.stop();
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
	},
	show(modelName) {
		// Check if the ID refers to a UI button
		const uiButton = flock.scene.UITexture?.getControlByName(modelName);

		if (uiButton) {
			// Handle UI button case
			uiButton.isVisible = true; // Hide the button
			return;
		}
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
	changeColor(modelName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
			flock.changeColorMesh(mesh, color);
		});
	},
	changeColorMesh(mesh, color) {
		if (!mesh) {
			flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
			return;
		}

		if (mesh.metadata?.sharedMaterial) flock.ensureUniqueMaterial(mesh);

		// Ensure color is an array
		const colors = Array.isArray(color) ? color : [color];
		let colorIndex = 0;

		// Map to keep track of materials and their assigned colours and indices
		const materialToColorMap = new Map();

		function applyColorInOrder(part) {
			if (part.material) {
				// Check if the material is already processed
				if (!materialToColorMap.has(part.material)) {
					const currentIndex = colorIndex % colors.length;

					const hexColor = flock.getColorFromString(
						colors[currentIndex],
					);
					const babylonColor =
						flock.BABYLON.Color3.FromHexString(hexColor);

					// Apply the colour to the material
					if (part.material.diffuseColor !== undefined) {
						part.material.diffuseColor = babylonColor;
					} else {
						part.material.albedoColor =
							babylonColor.toLinearSpace();
						part.material.emissiveColor =
							babylonColor.toLinearSpace();
						part.material.emissiveIntensity = 0.1;
					}

					// Map the material to the colour and its assigned index
					materialToColorMap.set(part.material, {
						hexColor,
						index: currentIndex,
					});

					// Set metadata on this mesh with its colour index
					if (!part.metadata) {
						part.metadata = {};
					}
					if (!part.metadata.materialIndex) {
						part.metadata.materialIndex = colorIndex;
					}

					colorIndex++;
				} else {
					// Material already processed, reapply the existing index
					if (!part.metadata) {
						part.metadata = {};
					}

					if (part.metadata.materialIndex === undefined) {
						part.metadata.materialIndex = colorIndex;
					}
				}
			}

			// Process the submeshes (children) of the current mesh, sorted alphabetically
			const sortedChildMeshes = part
				.getChildMeshes()
				.sort((a, b) => a.name.localeCompare(b.name));
			sortedChildMeshes.forEach((child) => applyColorInOrder(child));
		}

		// Start applying colours to the main mesh and its hierarchy

		if (!flock.characterNames.includes(mesh.metadata?.modelName)) {
			applyColorInOrder(mesh);
		} else {
			const characterColors = {
				hair: colors[0],
				skin: colors[1],
				eyes: colors[2],
				tshirt: colors[3],
				shorts: colors[4],
				sleeves: colors[5],
			};
			flock.applyColorsToCharacter(mesh, characterColors);
			return;
		}

		// If no material was found, create a new one and set metadata
		if (materialToColorMap.size === 0) {
			const material = new flock.BABYLON.StandardMaterial(
				"meshMaterial",
				flock.scene,
			);
			material.diffuseColor = flock.BABYLON.Color3.FromHexString(
				colors[0],
			);
			material.backFaceCulling = false;
			mesh.material = material;
			if (!mesh.metadata) {
				mesh.metadata = {};
			}
			mesh.metadata.materialIndex = 0;
		}

		try {
			if (mesh.metadata.shapeType === "Cylinder") {
				mesh.forceSharedVertices();
				mesh.convertToFlatShadedMesh();
			}
		} catch (e) {
			console.log("Error converting mesh to flat shaded:", e);
		}

		if (mesh.metadata?.glow) {
			flock.glowMesh(mesh);
		}
	},
	changeMaterial(modelName, materialName, color) {
		return flock.whenModelReady(modelName, (mesh) => {
			const texturePath = flock.texturePath + materialName;
			flock.changeMaterialMesh(mesh, materialName, texturePath, color);
		});
	},
	changeMaterialMesh(mesh, materialName, texturePath, color, alpha = 1) {
		flock.ensureUniqueMaterial(mesh);

		// Create a new material
		const material = new flock.BABYLON.StandardMaterial(
			materialName,
			flock.scene,
		);

		// Load the texture if provided
		if (texturePath) {
			const texture = new flock.BABYLON.Texture(texturePath, flock.scene);
			material.diffuseTexture = texture;
		}

		// Set colour if provided
		if (color) {
			const hexColor = flock.getColorFromString(color);
			const babylonColor = flock.BABYLON.Color3.FromHexString(hexColor);
			material.diffuseColor = babylonColor;
		}

		material.alpha = alpha;
		material.backFaceCulling = false;

		// Assign the material to the mesh and its descendants
		const allMeshes = [mesh].concat(mesh.getDescendants());
		allMeshes.forEach((part) => {
			part.material = material;
		});

		if (mesh.metadata?.glow) {
			flock.glowMesh(mesh);
		}

		return material;
	},
	setMaterial(modelName, materials) {
		return flock.whenModelReady(modelName, (mesh) => {
			const allMeshes = [mesh].concat(mesh.getDescendants());
			const validMeshes = allMeshes.filter(
				(part) => part instanceof flock.BABYLON.Mesh,
			);

			// Sort meshes alphabetically by name
			const sortedMeshes = validMeshes.sort((a, b) =>
				a.name.localeCompare(b.name),
			);

			sortedMeshes.forEach((part, index) => {
				const material = Array.isArray(materials)
					? materials[index % materials.length]
					: materials;

				if (material instanceof flock.GradientMaterial) {
					mesh.computeWorldMatrix(true);

					const boundingInfo = mesh.getBoundingInfo();

					const yDimension =
						boundingInfo.boundingBox.extendSizeWorld.y;

					material.scale = yDimension > 0 ? 1 / yDimension : 1;
				}
				if (!(material instanceof flock.BABYLON.Material)) {
					console.error(
						`Invalid material provided for mesh ${part.name}:`,
						material,
					);
					return;
				}

				// Apply the material to the mesh
				part.material = material;
			});

			if (mesh.metadata?.glow) {
				flock.glowMesh(mesh);
			}
		});
	},
	createTriplanarMaterial(scene, texturePath, scale = 1) {
		const shaderMaterial = new BABYLON.ShaderMaterial(
			"triplanar",
			scene,
			{
				vertex: "default",
				fragment: "triplanar",
			},
			{
				attributes: ["position", "normal", "uv"],
				uniforms: ["worldViewProjection", "world", "scale"],
			},
		);

		const texture = new BABYLON.Texture(texturePath, scene);
		shaderMaterial.setTexture("textureSampler", texture);
		shaderMaterial.setFloat("scale", scale);

		return shaderMaterial;
	},
	createMaterial(color, materialName, alpha) {
		let material;

		const texturePath = flock.texturePath + materialName;

		// Handle gradient color case
		if (Array.isArray(color) && color.length === 2) {
			material = new flock.GradientMaterial(materialName, flock.scene);

			material.bottomColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color[0]),
			);
			material.topColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color[1]),
			);
			material.offset = 0.5;
			material.smoothness = 0.5;
			material.scale = 1.0;
			material.backFaceCulling = false;
		} else {
			// Default to StandardMaterial
			material = new flock.BABYLON.StandardMaterial(
				materialName,
				flock.scene,
			);

			// Load texture if provided
			if (texturePath) {
				const texture = new flock.BABYLON.Texture(
					texturePath,
					flock.scene,
				);
				material.diffuseTexture = texture;
			}

			// Set single color if provided
			if (color) {
				const hexColor = flock.getColorFromString(color);
				const babylonColor =
					flock.BABYLON.Color3.FromHexString(hexColor);
				material.diffuseColor = babylonColor;
			}

			material.backFaceCulling = false;
		}

		material.alpha = alpha;

		return material;
	},
	createMaterial2(
		albedoColor,
		emissiveColor,
		textureSet,
		metallic,
		roughness,
		alpha,
		texturePhysicalSize = 1, // Default physical size in meters
	) {
		let material;

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
				const baseTexturePath = flock.texturePath + textureSet;
				material.baseTexture = new flock.BABYLON.Texture(
					baseTexturePath,
					flock.scene,
				);

				const normalTexturePath = `${flock.texturePath}normal/${textureSet}`;
				material.normalTexture = new flock.BABYLON.Texture(
					normalTexturePath,
					flock.scene,
				);

				// Apply consistent texture scaling
				material.baseTexture.uScale = 1 / texturePhysicalSize;
				material.baseTexture.vScale = 1 / texturePhysicalSize;
				material.normalTexture.uScale = 1 / texturePhysicalSize;
				material.normalTexture.vScale = 1 / texturePhysicalSize;
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
				const baseTexturePath = flock.texturePath + textureSet;
				material.diffuseTexture = new flock.BABYLON.Texture(
					baseTexturePath,
					flock.scene,
				);

				const normalTexturePath = flock.texturePath + textureSet;
				material.bumpTexture = new flock.BABYLON.Texture(
					normalTexturePath,
					flock.scene,
				);

				// Apply consistent texture scaling
				material.diffuseTexture.uScale = 1 / texturePhysicalSize;
				material.diffuseTexture.vScale = 1 / texturePhysicalSize;
				material.bumpTexture.uScale = 1 / texturePhysicalSize;
				material.bumpTexture.vScale = 1 / texturePhysicalSize;
				material.backFaceCulling = false;
			}
		}

		material.emissiveColor =
			flock.BABYLON.Color3.FromHexString(emissiveColor);

		material.alpha = alpha;

		material.backFaceCulling = false;
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
		material.backFaceCulling = false;

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

		// --- CONFIGURATION ---
		const capsuleHeightBottomOffset = 1.0;
		const capsuleRadius = 0.5;
		const deltaTime = 0.016;
		const maxSlopeAngle = 45;
		const groundCheckDistance = 0.3; // Increased ground check distance
		const DEBUG = true;

		// --- MOVEMENT CALCULATION ---
		const camForward = flock.scene.activeCamera.getForwardRay().direction;
		const horizontalForward = new flock.BABYLON.Vector3(
			camForward.x,
			0,
			camForward.z,
		).normalize();
		let desiredMovement = horizontalForward.scale(speed);

		// --- GROUND CHECK ---
		const groundCheckStart = model.position.clone();
		const groundCheckEnd = groundCheckStart.add(
			new flock.BABYLON.Vector3(0, -groundCheckDistance, 0),
		);

		const groundQuery = {
			shape: new BABYLON.PhysicsShapeCapsule(
				new flock.BABYLON.Vector3(0, -capsuleHeightBottomOffset, 0),
				new flock.BABYLON.Vector3(0, capsuleHeightBottomOffset, 0),
				capsuleRadius,
				flock.scene,
			),
			rotation:
				model.rotationQuaternion || flock.BABYLON.Quaternion.Identity(),
			startPosition: groundCheckStart,
			endPosition: groundCheckEnd,
			shouldHitTriggers: false,
		};

		const groundResult = new BABYLON.ShapeCastResult();
		const groundHitResult = new BABYLON.ShapeCastResult();

		const physicsEngine = flock.scene.getPhysicsEngine();
		if (!physicsEngine) {
			console.warn("No physics engine available.");
			return;
		}
		const havokPlugin = physicsEngine.getPhysicsPlugin();

		havokPlugin.shapeCast(groundQuery, groundResult, groundHitResult);

		// --- STATE TRACKING ---
		const currentVelocity = model.physics.getLinearVelocity();
		let grounded = false;
		let previouslyGrounded = model.isGrounded || false; // Store previous state
		let stateChanged = false;

		// --- SLOPE AND GROUND HANDLING ---
		/*
		if (groundHitResult.hit) {
		console.log("Ground hit");
			const upVector = new flock.BABYLON.Vector3(0, 1, 0);
			const slopeAngle = Math.acos(
				flock.BABYLON.Vector3.Dot(groundHitResult.hitNormal, upVector),
			);
			const slopeAngleDegrees = flock.BABYLON.Tools.ToDegrees(slopeAngle);

			grounded = slopeAngleDegrees <= maxSlopeAngle;
			stateChanged = grounded !== previouslyGrounded;

			if (DEBUG && (stateChanged || Math.abs(currentVelocity.y) > 5)) {
				console.log("=== Significant State Change ===");
				console.log("Ground hit detected!");
				console.log(`Slope angle: ${slopeAngleDegrees.toFixed(1)}°`);
				console.log("Grounded:", grounded);
				console.log("Current Y velocity:", currentVelocity.y);
				console.log(
					"Ground normal:",
					groundHitResult.hitNormal.toString(),
				);
			}

			if (grounded) {
				console.log("Grounded!");
				// Project movement along the slope
				const slopeRight = flock.BABYLON.Vector3.Cross(
					groundHitResult.hitNormal,
					upVector,
				).normalize();
				const slopeForward = flock.BABYLON.Vector3.Cross(
					slopeRight,
					groundHitResult.hitNormal,
				).normalize();
				const dot = flock.BABYLON.Vector3.Dot(
					desiredMovement,
					slopeForward,
				);
				desiredMovement = slopeForward.scale(dot);
			}
		} else {
			grounded = false;
			stateChanged = previouslyGrounded !== false;

			if (DEBUG && stateChanged) {
				console.log("=== Lost Ground Contact ===");
				console.log("Current Y velocity:", currentVelocity.y);
				console.log("Position Y:", model.position.y);
			}
		}*/

		// Store grounded state for next frame
		model.isGrounded = grounded;
		// --- APPLY MOVEMENT ---
		const maxVerticalVelocity = 3.0; // Reduced max vertical velocity
		let newVertical = grounded ? 0 : currentVelocity.y;
		newVertical = Math.min(
			Math.max(newVertical, -maxVerticalVelocity),
			maxVerticalVelocity,
		);

		const finalVelocity = new flock.BABYLON.Vector3(
			desiredMovement.x,
			newVertical,
			desiredMovement.z,
		);

		/*
		if (DEBUG && Math.abs(newVertical) > 3) {
			console.log("=== High Vertical Velocity ===");
			console.log("Vertical velocity:", newVertical);
			console.log("Grounded state:", grounded);
			console.log("-------------------");
		}*/

		model.physics.setLinearVelocity(finalVelocity);

		// If your mesh is coming out backwards, flip the vector:
		const facingDirection =
			speed >= 0 ? horizontalForward : horizontalForward.scale(-1);

		// Compute the target rotation based on the facing direction.
		const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
			facingDirection,
			flock.BABYLON.Vector3.Up(),
		);

		// Use the current rotation (defaulting to identity if missing).
		const currentRotation =
			model.rotationQuaternion || flock.BABYLON.Quaternion.Identity();

		// Compute the difference between the current and target rotations.
		const deltaRotation = targetRotation.multiply(
			currentRotation.conjugate(),
		);
		const deltaEuler = deltaRotation.toEulerAngles();

		// Apply angular velocity (adjust multiplier as needed for smoothness).
		model.physics.setAngularVelocity(
			new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
		);

		// Keep the mesh’s rotation constrained to the Y axis.
		model.rotationQuaternion.x = 0;
		model.rotationQuaternion.z = 0;
		model.rotationQuaternion.normalize();
	},
	moveSideways(modelName, speed) {
		const model = flock.scene.getMeshByName(modelName);
		if (!model || speed === 0) return;

		flock.ensureVerticalConstraint(model);

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
			sidewaysSpeed <= 0
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

		const sidewaysSpeed = speed;

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
		/*
		scene.onBeforeRenderObservable.add(() => {
			dynamicMeshes.forEach((mesh) => {
				if (mesh.physics) {
					console.log("----- Frame Debug Info -----");
					console.log("Capsule Position:", mesh.position);
					const velocity = mesh.physics.getLinearVelocity();
					console.log("Capsule Velocity:", velocity);

					// Set up the ray starting near the bottom of the capsule.
					const rayOrigin = mesh.position
						.clone()
						.add(new BABYLON.Vector3(0, -capsuleHalfHeight, 0));
					const downDirection = new BABYLON.Vector3(0, -1, 0);
					const rayLength = 3;
					const downRay = new BABYLON.Ray(
						rayOrigin,
						downDirection,
						rayLength,
					);

					// Pick a ground mesh.
					const hit = scene.pickWithRay(
						downRay,
						(m) =>
							m !== mesh &&
							(m.isGround ||
								m.name.toLowerCase().includes("ground") ||
								m.name.toLowerCase().includes("slope")),
					);

					if (hit && hit.pickedMesh) {
						console.log("Ground detected:", hit.pickedMesh.name);
						console.log("Hit Point:", hit.pickedPoint);
						const surfaceNormal = hit.getNormal();
						console.log("Surface Normal:", surfaceNormal);

						const groundY = hit.pickedPoint.y;
						const capsuleBottomY =
							mesh.position.y - capsuleHalfHeight;
						const gap = capsuleBottomY - groundY;
						console.log("Gap (capsule bottom - ground):", gap);

						const up = new BABYLON.Vector3(0, 1, 0);
						const slopeFactor = BABYLON.Scalar.Clamp(
							surfaceNormal.dot(up),
							0,
							1,
						);
						console.log("Slope factor:", slopeFactor);

						// Only apply ground correction if:
						// - The capsule is falling (velocity.y < -0.1), and
						// - The capsule’s bottom is very near the ground (gap < maxGroundContactGap)
						// - And the surface is nearly flat.
						if (
							velocity.y < -0.1 &&
							Math.abs(gap) < maxGroundContactGap &&
							slopeFactor >= flatThreshold
						) {
							const desiredY = groundY + capsuleHalfHeight;
							// Gradually move the capsule toward the desired Y.
							mesh.position.y = BABYLON.Scalar.Lerp(
								mesh.position.y,
								desiredY,
								lerpFactor,
							);
							console.log(
								"Correcting capsule position. Ground Y:",
								groundY,
								"New Y:",
								mesh.position.y,
							);
							// Optionally damp vertical velocity.
							const currentVel = mesh.physics.getLinearVelocity();
							mesh.physics.setLinearVelocity(
								new BABYLON.Vector3(
									currentVel.x,
									currentVel.y * 0.5,
									currentVel.z,
								),
							);
						} else {
							if (Math.abs(gap) >= maxGroundContactGap) {
								console.log(
									"Skipping ground correction: capsule gap =",
									gap,
									" (assumed airborne).",
								);
							} else {
								console.log(
									"Skipping ground correction: vertical velocity =",
									velocity.y,
								);
							}
						}
					} else {
						console.log(
							"No ground detected at adjusted ray origin.",
						);
					}
					console.log("----- End Frame Debug Info -----");
				}
			});
		});*/
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
	setPhysicsShape(modelName, shapeType) {
		return flock.whenModelReady(modelName, (mesh) => {
			const disposePhysics = (targetMesh) => {
				if (targetMesh.physics) {
					const body = targetMesh.physics;

					// Remove the body from the physics world
					flock.hk._hknp.HP_World_RemoveBody(
						flock.hk.world,
						body._pluginData.hpBodyId,
					);

					// Dispose of the shape explicitly
					if (body.shape) {
						body.shape.dispose();
						body.shape = null; // Clear shape reference
					}

					// Dispose of the body explicitly
					body.dispose();
					targetMesh.physics = null; // Clear reference
				}
			};

			const applyPhysicsShape = (targetMesh) => {
				// Dispose physics if no material
				if (!targetMesh.material) {
					disposePhysics(targetMesh);
					return; // Skip further processing
				}

				if (!targetMesh.geometry) {
					return; // Skip if no geometry
				}

				// Dispose existing physics before applying a new shape
				disposePhysics(targetMesh);

				let physicsShape, radius, boundingBox, height;
				switch (shapeType) {
					case "CAPSULE":
						boundingBox = targetMesh.getBoundingInfo().boundingBox;
						radius =
							Math.max(
								boundingBox.maximum.x - boundingBox.minimum.x,
								boundingBox.maximum.z - boundingBox.minimum.z,
							) / 2;
						height = boundingBox.maximum.y - boundingBox.minimum.y;
						physicsShape = new flock.BABYLON.PhysicsShapeCapsule(
							targetMesh,
							flock.scene,
							{ radius: radius, height: height },
						);
						break;
					case "MESH":
						physicsShape = new flock.BABYLON.PhysicsShapeMesh(
							targetMesh,
							flock.scene,
						);
						break;
					default:
						console.error(
							"Invalid shape type provided:",
							shapeType,
						);
						return;
				}

				const physicsBody = new flock.BABYLON.PhysicsBody(
					targetMesh,
					flock.BABYLON.PhysicsMotionType.STATIC, // Default motion type
					false,
					flock.scene,
				);
				physicsBody.shape = physicsShape;
				physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
				physicsBody.disablePreStep = false;

				targetMesh.physics = physicsBody;
			};

			// Apply to main mesh
			applyPhysicsShape(mesh);

			// Apply to submeshes
			if (mesh.getChildMeshes) {
				mesh.getChildMeshes().forEach((subMesh) => {
					applyPhysicsShape(subMesh);
				});
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
						{ width: 4, height: 4 },
						flock.scene,
					);
					plane.name = "textPlane";
					plane.parent = targetMesh; // Remains parented to inherit rotation/position.

					plane.alpha = 1;
					plane.checkCollisions = false;
					plane.isPickable = false;

					// Get initial bounding info.
					let boundingInfo = targetMesh.getBoundingInfo();
					// Set initial local position:
					plane.position.y =
						boundingInfo.boundingBox.maximum.y +
						2.5 / targetMesh.scaling.y;

					plane.billboardMode = flock.BABYLON.Mesh.BILLBOARDMODE_ALL;

					// On each frame, update the plane’s scale and local Y offset.
					flock.scene.onBeforeRenderObservable.add(() => {
						// Update bounding info in case the mesh has been resized.
						boundingInfo = targetMesh.getBoundingInfo();
						const parentScale = targetMesh.scaling;

						// Cancel out parent's scaling for the plane's size.
						plane.scaling.x = 1 / parentScale.x;
						plane.scaling.y = 1 / parentScale.y;
						plane.scaling.z = 1 / parentScale.z;

						// Adjust the local Y offset so the world-space distance remains constant.
						plane.position.y =
							boundingInfo.boundingBox.maximum.y +
							2.1 / parentScale.y;
					});
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

					const scale = 8;
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
	async playSound(meshName = "__everywhere__", soundName, options = {}) {
	
		const audioEngine = await flock.audioEnginePromise;
		const loop = !!options.loop;
		const soundUrl = flock.soundPath + soundName;

		const createSound = async (spatialEnabled) => {
			return BABYLON.CreateSoundAsync(soundName, soundUrl, {
				spatialEnabled,
				spatialDistanceModel: "linear",
				spatialMaxDistance: 20,
				autoplay: false,
				loop: loop,
				volume: options.volume ?? 1,
				playbackRate: options.playbackRate ?? 1,
			});
		};

		if (meshName === "__everywhere__") {
			const sound = await createSound(false);
			flock.globalSounds.push(sound);
			sound.play();

			if (!loop) {
				return new Promise((resolve) => {
					sound.onEndedObservable.add(() => {
						const index = flock.globalSounds.indexOf(sound);
						if (index !== -1) {
							flock.globalSounds.splice(index, 1);
						}
						resolve();
					});
				});
			}

			return;
		}

		return flock.whenModelReady(meshName, async (mesh) => {
			if (!mesh) {
				console.warn(
					`Mesh "${meshName}" not found. Cannot play sound "${soundName}".`,
				);
				return;
			}

			mesh.metadata ??= {};

			const currentSound = mesh.metadata.currentSound;
			if (currentSound) {
				if (currentSound.name === soundName) {
					console.log(
						`Sound "${soundName}" is already playing on mesh "${meshName}". Ignoring.`,
					);
					return;
				} else {
					currentSound.stop();
					currentSound.dispose?.();
				}
			}

			const sound = await createSound(true);

			if (sound.spatial) {
				await sound.spatial.attach(mesh);
			}

			mesh.metadata.currentSound = sound;
			sound._attachedMesh = mesh;
			flock.globalSounds.push(sound);
			sound.play();

			if (!loop) {
				sound.onEndedObservable.add(() => {
					const index = flock.globalSounds.indexOf(sound);
					if (index !== -1) {
						flock.globalSounds.splice(index, 1);
					}
					if (mesh.metadata.currentSound === sound) {
						delete mesh.metadata.currentSound;
					}
				});
			}
		});
	},
	stopAllSounds() {
		flock.globalSounds.forEach((sound) => {
			try {
				const mesh = sound._attachedMesh;
				if (mesh?.metadata?.currentSound === sound) {
					delete mesh.metadata.currentSound;
				}

				sound.stop();
			} catch (e) {
				console.warn("Error stopping sound:", sound.name, e);
			}
		});

		flock.globalSounds = [];
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

		if (context.listener.positionX) {
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
		} else {
			// Firefox
			context.listener.setPosition(cx, cy, cz);
			context.listener.setOrientation(
				-forwardVector.x,
				forwardVector.y,
				forwardVector.z,
				0,
				1,
				0,
			);
		}
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
