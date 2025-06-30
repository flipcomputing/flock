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
import { flockScene, setFlockReference as setFlockScene } from "./api/scene";
import { flockMesh, setFlockReference as setFlockMesh } from "./api/mesh";
import { flockCamera, setFlockReference as setFlockCamera } from "./api/camera";
// Helper functions to make flock.BABYLON js easier to use in Flock
console.log("Flock helpers loading");

export const flock = {
	callbackMode: true,
	separateAnimations: false,
	memoryDebug: false,
	maxMeshes: 5000,
	console: console,
	modelPath: "./models/",
	soundPath: "./sounds/",
	imagePath: "./images/",
	texturePath: "./textures/",
	engine: null,
	engineReady: false,
	modelReadyPromises: new Map(),
	pendingMeshCreations: 0,
	pendingTriggers: new Map(),
	_animationFileCache: {},
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
	...flockScene,
	...flockMesh,
	...flockCamera,
	// Enhanced error reporting with block context
	createEnhancedError(error, code) {
		const lines = code.split("\n");
		const errorContext = {
			message: error.message,
			stack: error.stack,
			codeSnippet: null,
			suggestion: null,
		};

		// Try to extract line number from error
		const lineMatch = error.stack?.match(/at .*:(\d+):\d+/);
		if (lineMatch) {
			const lineNum = parseInt(lineMatch[1]) - 1;
			if (lineNum >= 0 && lineNum < lines.length) {
				const start = Math.max(0, lineNum - 2);
				const end = Math.min(lines.length, lineNum + 3);
				errorContext.codeSnippet = lines
					.slice(start, end)
					.map((line, idx) => {
						const actualLine = start + idx;
						const marker = actualLine === lineNum ? ">>> " : "    ";
						return `${marker}${actualLine + 1}: ${line}`;
					})
					.join("\n");
			}
		}

		// Add common error suggestions
		if (error.message.includes("is not defined")) {
			errorContext.suggestion =
				"Check if the variable or function name is spelled correctly and has been declared.";
		} else if (error.message.includes("Cannot read property")) {
			errorContext.suggestion =
				"Check if the object exists before accessing its properties.";
		}

		return errorContext;
	},
	createVector3(x, y, z) {
		return new flock.BABYLON.Vector3(x, y, z);
	},
	maxMeshesReached() {
		const scene = flock?.scene;
		if (!scene || typeof flock.maxMeshes !== "number") return false;

		const meshCount = scene.meshes.length;
		const max = flock.maxMeshes;

		if (meshCount >= max) {
			flock.printText?.(
				`⚠️ Limit reached: You can only have ${max} meshes in your world.`,
				30,
				"#ff0000",
			);
			return true;
		}

		return false;
	},
	getTotalSceneVertices() {
		return flock.scene.meshes.reduce((total, mesh) => {
			return total + mesh.getTotalVertices();
		}, 0);
	},
	checkMemoryUsage() {
		if (!performance.memory) {
			return; // Not available in all browsers
		}

		const used = performance.memory.usedJSHeapSize / 1024 / 1024;
		const total = performance.memory.totalJSHeapSize / 1024 / 1024;
		const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;

		// Log to console (you might want to display in UI instead)
		console.log(
			`Memory: ${used.toFixed(1)}MB used / ${total.toFixed(1)}MB allocated / ${limit.toFixed(1)}MB limit`,
		);

		// Warn if approaching limits
		const usagePercent = (used / limit) * 100;
		if (usagePercent > 80) {
			console.warn(
				`High memory usage: ${usagePercent.toFixed(1)}% of limit`,
			);
			// Maybe show user warning in your UI
			this.printText(
				`Warning: High memory usage (${usagePercent.toFixed(1)}%)`,
				3,
				"#ff9900",
			);
		}

		// Count Babylon.js objects for more specific monitoring
		if (flock.scene) {
			const counts = {
				meshes: flock.scene.meshes.length,
				geometries: Object.keys(flock.geometryCache).length,
				vertices: flock.getTotalSceneVertices(),
				materials: flock.scene.materials.length,
				cachedMaterials: Object.keys(flock.materialCache).length,
				textures: flock.scene.textures.length,
				animationGroups: flock.scene.animationGroups.length,
			};
			console.log("Scene objects:", counts);
		}
	},
	startMemoryMonitoring() {
		// Clear any existing monitoring
		if (this.memoryMonitorInterval) {
			clearInterval(flock.memoryMonitorInterval);
		}

		// Get the abort signal
		const signal = flock.abortController?.signal;

		if (signal?.aborted) {
			return; // Don't start if already aborted
		}

		// Monitor every 5 seconds
		flock.memoryMonitorInterval = setInterval(() => {
			// Check if aborted before each check
			if (signal?.aborted) {
				clearInterval(flock.memoryMonitorInterval);
				this.memoryMonitorInterval = null;
				return;
			}

			flock.checkMemoryUsage();
		}, 5000);

		// Clean up when aborted
		signal?.addEventListener("abort", () => {
			if (flock.memoryMonitorInterval) {
				clearInterval(flock.memoryMonitorInterval);
				flock.memoryMonitorInterval = null;
			}
		});
	},
	validateCode(code) {
		if (typeof code !== "string") {
			throw new Error("Code must be a string");
		}

		// Length check (reasonable)
		if (code.length > 100000) {
			throw new Error("Code too long (max 100KB)");
		}

		// Basic syntax check
		try {
			new Function(code); // Just check if it parses
		} catch (e) {
			throw new Error(`Syntax error: ${e.message}`);
		}

		// Optional: Warn about patterns (don't block)
		const warnings = [];
		if (/eval\s*\(/.test(code)) {
			warnings.push(
				"Warning: eval() detected - this won't work in the sandbox",
			);
		}

		if (warnings.length > 0) {
			console.warn(warnings.join("\n"));
		}

		return true;
	},
	async runCode2(code) {
		let iframe = document.getElementById("flock-iframe");

		try {
			// Validate code first
			this.validateCode(code);

			// Dispose old scene if iframe exists
			if (iframe) {
				try {
					iframe.contentWindow.flock?.disposeOldScene();
					delete iframe.contentWindow.flock;
				} catch (error) {
					console.warn("Error disposing old scene in iframe:", error);
				}
			} else {
				// Create a new iframe if not found
				iframe = document.createElement("iframe");
				iframe.id = "flock-iframe";
				iframe.style.display = "none";
				document.body.appendChild(iframe);
			}

			// Wait for iframe to load with stricter CSP
			await new Promise((resolve, reject) => {
				iframe.onload = () => resolve();
				iframe.onerror = () =>
					reject(new Error("Failed to load iframe"));
				iframe.srcdoc = `
				<!DOCTYPE html>
				<html>
				  <head>
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline';">
				  </head>
				  <body></body>
				</html>`;
			});

			const iframeWindow = iframe.contentWindow;
			if (!iframeWindow) throw new Error("Iframe window is unavailable");

			// Define API methods list once to avoid duplication
			const apiMethods = [
				// Core
				"initialize",
				"createEngine",
				"createScene",

				// Animation & Movement
				"playAnimation",
				"switchAnimation",
				"glideTo",
				"createAnimation",
				"animateFrom",
				"playAnimationGroup",
				"pauseAnimationGroup",
				"stopAnimationGroup",
				"animateKeyFrames",
				"setPivotPoint",
				"rotate",
				"lookAt",
				"moveTo",
				"rotateTo",
				"rotateCamera",
				"rotateAnim",
				"animateProperty",
				"positionAt",
				"moveForward",
				"moveSideways",
				"strafe",

				// Audio
				"playSound",
				"stopAllSounds",
				"playNotes",
				"setBPM",
				"createInstrument",

				// Effects
				"highlight",
				"glow",
				"tint",
				"setAlpha",
				"clearEffects",
				"stopAnimations",

				// 3D Objects
				"createCharacter",
				"createObject",
				"createParticleEffect",
				"create3DText",
				"createModel",
				"createBox",
				"createSphere",
				"createCylinder",
				"createCapsule",
				"createPlane",

				// Mesh Operations
				"cloneMesh",
				"parentChild",
				"setParent",
				"mergeMeshes",
				"subtractMeshes",
				"intersectMeshes",
				"createHull",
				"hold",
				"drop",
				"makeFollow",
				"stopFollow",
				"removeParent",

				// Environment
				"createGround",
				"createMap",
				"createCustomMap",
				"setSky",
				"lightIntensity",
				"setFog",

				// Camera & Controls
				"buttonControls",
				"getCamera",
				"cameraControl",
				"setCameraBackground",
				"setXRMode",
				"attachCamera",
				"canvasControls",

				// Physics
				"applyForce",
				"moveByVector",
				"setPhysics",
				"setPhysicsShape",
				"checkMeshesTouching",

				// Particles
				"startParticleSystem",
				"stopParticleSystem",
				"resetParticleSystem",

				// Utilities
				"distanceTo",
				"wait",
				"safeLoop",
				"waitUntil",
				"show",
				"hide",
				"dispose",
				"keyPressed",
				"isTouchingSurface",
				"seededRandom",
				"randomColour",
				"scale",
				"resize",

				// Materials & Colors
				"changeColor",
				"changeColorMesh",
				"changeMaterial",
				"setMaterial",
				"createMaterial",
				"textMaterial",

				// Events & Interaction
				"say",
				"onTrigger",
				"onEvent",
				"broadcastEvent",
				"start",
				"forever",
				"whenKeyEvent",
				"onIntersect",

				// UI
				"printText",
				"UIText",
				"UIButton",
				"UIInput",
				"UISlider",

				// Utilities & Data
				"randomInteger",
				"getProperty",
				"exportMesh",
				"abortSceneExecution",
				"ensureUniqueGeometry",
				"createVector3",
				"disposeOldScene",
			];

			// Create API object dynamically
			const flockAPI = {};
			apiMethods.forEach((method) => {
				if (typeof this[method] === "function") {
					flockAPI[method] = (...args) => this[method](...args);
				}
			});

			// Initialize new scene in iframe context
			await this.initializeNewScene();
			if (flock.memoryDebug) this.startMemoryMonitoring();
			// Create and execute sandboxed function more directly
			const sandboxFunction = new iframeWindow.Function(
				"flock",
				`
				"use strict";

				// Destructure the API for clean user access
				const {
					${apiMethods.join(",\n                ")}
				} = flock;

				// Add some safety measures
				const setTimeout = undefined;
				const setInterval = undefined;
				const clearTimeout = undefined;
				const clearInterval = undefined;

				// Wrap user code in async function with better error handling
				return (async function() {
					try {
						${code}
					} catch (error) {
						// Enhanced error reporting with line numbers
						const stack = error.stack || '';
						const match = stack.match(/<anonymous>:(\\d+):(\\d+)/);
						const lineNumber = match ? parseInt(match[1]) - 20 : 'unknown'; // Adjust for wrapper code

						console.error(\`User code error at line \${lineNumber}:\`, error.message);
						throw new Error(\`Line \${lineNumber}: \${error.message}\`);
					}
				})();
			`,
			);

			// Execute with better error context
			try {
				await sandboxFunction(flockAPI);
			} catch (sandboxError) {
				throw new Error(
					`Code execution failed: ${sandboxError.message}`,
				);
			}

			// Focus render canvas
			document.getElementById("renderCanvas")?.focus();
		} catch (error) {
			// Enhanced error reporting
			const enhancedError = this.createEnhancedError(error, code);
			console.error("Enhanced error details:", enhancedError);

			// Show user-friendly error
			this.printText(`Error: ${error.message}`, 5, "#ff0000");

			// Clean up on error
			try {
				this.audioContext?.close();
				this.engine?.stopRenderLoop();
				this.removeEventListeners();
			} catch (cleanupError) {
				console.error("Error during cleanup:", cleanupError);
			}

			throw error;
		}
	},
	async runCode(code) {
		let iframe = document.getElementById("flock-iframe");

		try {
			// Validate code first
			this.validateCode(code);

			// Step 1: Dispose old scene if iframe exists
			if (iframe) {
				try {
					await iframe.contentWindow?.flock?.disposeOldScene();
				} catch (error) {
					console.warn("Error disposing old scene in iframe:", error);
				}
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

			// Copy flock reference to iframe
			iframeWindow.flock = this;

			// Initialize new scene in iframe context
			await this.initializeNewScene();

			// Step 5: Create sandboxed function with all flock API methods
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
						scale,
						resize,
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
						UIInput,
						UISlider,
						onIntersect,
						getProperty,
						exportMesh,
						abortSceneExecution,
						ensureUniqueGeometry,
						createVector3,
				} = flock;

				${code}
			`);

			// Execute sandboxed code
			try {
				await sandboxFunction();
			} catch (sandboxError) {
				throw new Error(
					`Sandbox execution failed: ${sandboxError.message}`,
				);
			}

			// Focus render canvas
			document.getElementById("renderCanvas")?.focus();
		} catch (error) {
			// Enhanced error reporting
			const enhancedError = this.createEnhancedError(error, code);
			console.error("Enhanced error details:", enhancedError);

			// Show user-friendly error
			this.printText(`Error: ${error.message}`, 5, "#ff0000");

			// Clean up on error
			try {
				this.audioContext?.close();
				this.engine?.stopRenderLoop();
				this.removeEventListeners();
			} catch (cleanupError) {
				console.error("Error during cleanup:", cleanupError);
			}

			throw error;
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
			preserveDrawingBuffer: true,
			stencil: true,
			powerPreference: "default",
		});

		flock.engine.enableOfflineSupport = false;
		flock.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
	},
	async disposeOldScene() {
		console.log("Disposing old scene");
		flock.flockNotReady = true;

		if (flock.scene) {
			// Stop all sounds and animations first
			flock.stopAllSounds();
			flock.engine.stopRenderLoop();

			// Abort any ongoing operations
			if (flock.abortController) {
				flock.abortController.abort();
			}

			// Stop all animations and dispose animation groups
			flock.scene.stopAllAnimations();
			if (flock.scene.animationGroups) {
				flock.scene.animationGroups.forEach((group) => {
					if (group) {
						try {
							group.stop();
							group.dispose();
						} catch (error) {
							console.warn(
								"Error disposing animation group:",
								error,
							);
						}
					}
				});
			}

			// Clear all observables and event listeners
			flock.removeEventListeners();

			// Dispose UI elements
			flock.controlsTexture?.dispose();
			flock.controlsTexture = null;

			// Clear main UI texture and all its controls
			if (flock.scene.UITexture) {
				flock.scene.UITexture.dispose();
				flock.scene.UITexture = null;
			}

			// Clear advanced texture and stack panel
			if (flock.advancedTexture) {
				flock.advancedTexture.dispose();
				flock.advancedTexture = null;
			}

			if (flock.stackPanel) {
				flock.stackPanel.dispose();
				flock.stackPanel = null;
			}

			flock.gridKeyPressObservable?.clear();
			flock.gridKeyReleaseObservable?.clear();

			// Dispose effects
			flock.highlighter?.dispose();
			flock.highlighter = null;
			flock.glowLayer?.dispose();
			flock.glowLayer = null;

			// Dispose lighting
			flock.mainLight?.dispose();
			flock.mainLight = null;

			// Dispose all meshes and their action managers
			const meshesToDispose = flock.scene.meshes
				? [...flock.scene.meshes]
				: [];
			meshesToDispose.forEach((mesh) => {
				if (mesh && mesh.actionManager) {
					mesh.actionManager.dispose();
				}
				if (
					mesh &&
					mesh.material &&
					mesh.material.dispose &&
					typeof mesh.material.dispose === "function"
				) {
					try {
						mesh.material.dispose();
					} catch (error) {
						console.warn("Error disposing material:", error);
					}
				}
				if (
					mesh &&
					mesh.dispose &&
					typeof mesh.dispose === "function"
				) {
					try {
						mesh.dispose();
					} catch (error) {
						console.warn("Error disposing mesh:", error);
					}
				}
			});

			// Clear camera
			flock.scene.activeCamera?.inputs?.clear();
			flock.scene.activeCamera?.dispose();

			// Wait for async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Clear all references
			flock.events = {};
			flock.modelCache = {};
			flock.globalSounds = [];
			flock.modelsBeingLoaded = {};
			flock.originalModelTransformations = {};
			flock.geometryCache = {};
			flock.materialCache = {};
			flock.pendingTriggers = new Map();
			flock._animationFileCache = {};
			flock.ground = null;
			flock.sky = null;

			// Dispose particle systems
			const particleSystems = flock.scene.particleSystems
				? [...flock.scene.particleSystems]
				: [];
			particleSystems.forEach((system) => {
				if (system && system.dispose) {
					system.dispose();
				}
			});

			// Dispose textures
			const textures = flock.scene.textures
				? [...flock.scene.textures]
				: [];
			textures.forEach((texture) => {
				if (
					texture &&
					texture.dispose &&
					typeof texture.dispose === "function"
				) {
					try {
						texture.dispose();
					} catch (error) {
						console.warn("Error disposing texture:", error);
					}
				}
			});

			// Dispose materials that weren't caught earlier
			const materials = flock.scene.materials
				? [...flock.scene.materials]
				: [];
			materials.forEach((material) => {
				if (
					material &&
					material.dispose &&
					typeof material.dispose === "function"
				) {
					try {
						material.dispose();
					} catch (error) {
						console.warn("Error disposing material:", error);
					}
				}
			});

			// Clear all observables
			flock.scene.onBeforeRenderObservable?.clear();
			flock.scene.onAfterRenderObservable?.clear();
			flock.scene.onBeforeAnimationsObservable?.clear();
			flock.scene.onAfterAnimationsObservable?.clear();
			flock.scene.onReadyObservable?.clear();
			flock.scene.onDataLoadedObservable?.clear();
			flock.scene.onDisposedObservable?.clear();

			// Dispose of the scene
			flock.scene.dispose();
			flock.scene = null;

			// Dispose physics
			flock.hk?.dispose();
			flock.hk = null;

			// Close audio context
			if (flock.audioContext && flock.audioContext.state !== "closed") {
				try {
					await flock.audioContext.close();
				} catch (error) {
					console.warn(
						"AudioContext was already closed or closing:",
						error,
					);
				}
			}
			flock.audioContext = null;

			// Clear abort controller
			flock.abortController = null;
		}
	},
	async initializeNewScene() {
		// Wait a bit more to ensure all disposal operations are complete
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Stop existing render loop or create a new engine
		flock.engine ? flock.engine.stopRenderLoop() : flock.createEngine();

		// Reset scene-wide state
		flock.events = {};
		flock.modelCache = {};
		flock.globalSounds = [];
		flock.modelsBeingLoaded = {};
		flock.originalModelTransformations = {};
		flock.geometryCache = {};
		flock.pendingTriggers = new Map();
		flock._animationFileCache = {};
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
		setFlockScene(flock);
		setFlockMesh(flock);
		setFlockCamera(flock);

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
		const signal = flock.abortController?.signal;

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

					if (signal) {
						signal.addEventListener("abort", onAbort, {
							once: true,
						});

						// Ensure the event listener is cleaned up after resolving
						signal.addEventListener(
							"abort",
							() => signal.removeEventListener("abort", onAbort),
							{ once: true },
						);
					}
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

		// Yield null to indicate the mesh was not found
		yield null;
	},
	whenModelReady2(targetId, callback) {
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
				if (flock.abortController?.signal?.aborted) {
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
					if (flock.abortController?.signal?.aborted) {
						console.log(`Aborted waiting for target: ${targetId}`);
						return; // Exit the loop if the operation was aborted
					}
					// Call the callback - don't await it since it's not async
					callback(target);
					return; // Exit after first yield (whether it's the mesh or null)
				}
			} catch (err) {
				if (flock.abortController?.signal?.aborted) {
					console.log(`Operation was aborted: ${targetId}`);
				} else {
					console.error(`Error in whenModelReady: ${err}`);
				}
			}
		})();
	},
	whenModelReady(id, callback) {
		// Always check for immediate availability first
		if (flock.scene) {
			let target = null;

			// Handle special camera identifier
			if (id === "__active_camera__") {
				target = flock.scene.activeCamera;
			} else {
				target = flock.scene.getMeshByName(id);
				if (!target && flock.scene.UITexture) {
					target = flock.scene.UITexture.getControlByName(id);
				}
				if (!target) {
					target = flock.scene.animationGroups.find(
						(group) => group.name === id,
					);
				}
				if (!target) {
					target = flock.scene.particleSystems.find(
						(system) => system.name === id,
					);
				}
			}

			if (target) {
				if (flock.abortController?.signal?.aborted) {
					return;
				}
				callback(target);
				return;
			}
		}

		// Use promise-based approach when callbackMode is true
		if (flock.callbackMode) {
			const promise = flock.modelReadyPromises.get(id);

			if (!promise) {
				console.warn(`No load started for object with id '${id}'`);
				return;
			}

			promise
				.then(() => {
					// Check again for the target after promise resolves
					let target = flock.scene.getMeshByName(id);
					if (!target && flock.scene.UITexture) {
						target = flock.scene.UITexture.getControlByName(id);
					}
					if (!target) {
						target = flock.scene.animationGroups.find(
							(group) => group.name === id,
						);
					}
					if (!target) {
						target = flock.scene.particleSystems.find(
							(system) => system.name === id,
						);
					}

					if (!target) {
						console.error(
							`Target with id '${id}' not found in scene after loading.`,
						);
						return;
					}
					callback(target);
				})
				.catch((err) => {
					console.error(`Error in whenModelReady for '${id}':`, err);
				});
			return;
		}

		// Use generator approach when callbackMode is false
		(async () => {
			const generator = flock.modelReadyGenerator(id);
			try {
				for await (const target of generator) {
					if (flock.abortController?.signal?.aborted) {
						console.log(`Aborted waiting for target: ${id}`);
						return;
					}
					callback(target);
					return;
				}
			} catch (err) {
				if (flock.abortController?.signal?.aborted) {
					console.log(`Operation was aborted: ${id}`);
				} else {
					console.error(`Error in whenModelReady: ${err}`);
				}
			}
		})();
	},
	announceMeshReady(meshName, groupName) {
		//console.log(`[flock] Mesh ready: ${meshName} (group: ${groupName})`);

		if (!flock.pendingTriggers.has(groupName)) return;

		//console.log(`[flock] Registering pending triggers for group: '${groupName}'`);
		const triggers = flock.pendingTriggers.get(groupName);

		for (const { trigger, callback, mode, applyToGroup } of triggers) {
			if (applyToGroup) {
				// 🔁 Reapply trigger across all matching meshes
				const matching = flock.scene.meshes.filter((m) =>
					m.name.startsWith(groupName),
				);
				for (const m of matching) {
					flock.onTrigger(m.name, {
						trigger,
						callback,
						mode,
						applyToGroup: false, // prevent recursion
					});
				}
			} else {
				// ✅ Apply to just this specific mesh
				flock.onTrigger(meshName, {
					trigger,
					callback,
					mode,
					applyToGroup: false,
				});
			}
		}
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

	wait(duration) {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (flock.abortController?.signal) {
					flock.abortController.signal.removeEventListener(
						"abort",
						onAbort,
					);
				}
				resolve();
			}, duration * 1000);

			const onAbort = () => {
				clearTimeout(timeoutId); // Clear the timeout if aborted
				if (flock.abortController?.signal) {
					flock.abortController.signal.removeEventListener(
						"abort",
						onAbort,
					);
				}
				// Instead of throwing an error, resolve gracefully here
				reject(new Error("Wait aborted"));
			};

			if (flock.abortController?.signal) {
				flock.abortController.signal.addEventListener("abort", onAbort);
			}
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
		const colors = [
			"#FF6B6B",
			"#4ECDC4",
			"#45B7D1",
			"#96CEB4",
			"#FFEAA7",
			"#DDA0DD",
			"#98D8C8",
			"#F7DC6F",
			"#BB8FCE",
			"#85C1E9",
			"#F8C471",
			"#82E0AA",
			"#F1948A",
			"#85C1E9",
			"#D7BDE2",
		];
		return colors[Math.floor(Math.random() * colors.length)];
	},
	hexToRgba(hex, alpha = 1) {
		// Remove the hash if present
		hex = hex.replace(/^#/, "");

		// Parse the hex values
		const bigint = parseInt(hex, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;

		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	},
	sanitizeEventName(eventName) {
		if (typeof eventName !== "string") {
			return "";
		}
		// Remove disallowed characters (symbols, control chars), allow emoji, spaces, letters, numbers
		// This allows everything except common punctuation and control characters
		const clean = eventName.replace(
			/[!@#\$%\^&\*\(\)\+=\[\]\{\};:'"\\|,<>\?\/\n\r\t]/g,
			"",
		);
		return clean.substring(0, 50);
	},
	isAllowedEventName(eventName) {
		if (!eventName || typeof eventName !== "string") {
			return false;
		}

		if (eventName.length > 30) {
			return false;
		}

		const lower = eventName.toLowerCase();
		const reservedPrefixes = [
			"_",
			"on",
			"system",
			"internal",
			"babylon",
			"flock",
		];
		if (reservedPrefixes.some((prefix) => lower.startsWith(prefix))) {
			return false;
		}

		const disallowedChars =
			/[!@#\$%\^&\*\(\)\+=\[\]\{\};:'"\\|,<>\?\/\n\r\t]/;
		if (disallowedChars.test(eventName)) {
			return false;
		}

		return true;
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
		if (flock.events && flock.events[eventName]) {
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
