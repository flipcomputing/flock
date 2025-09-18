// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from "@babylonjs/havok";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import * as BABYLON_LOADER from "@babylonjs/loaders";
import { GradientMaterial } from "@babylonjs/materials";
import * as BABYLON_EXPORT from "@babylonjs/serializers";
import { FlowGraphLog10Block, SetMaterialIDBlock } from "babylonjs";
import "@fontsource/atkinson-hyperlegible-next";
import "@fontsource/atkinson-hyperlegible-next/500.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";

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
        blockDebug: false,
        callbackMode: true,
        separateAnimations: true,
        memoryDebug: false,
        memoryMonitorInterval: 5000,
        materialsDebug: false,
        meshDebug: false,
        performanceOverlay: false,
        maxMeshes: 5000,
        console: console,
        triggerHandlingDebug: false,
        modelPath: "./models/",
        soundPath: "./sounds/",
        imagePath: "./images/",
        texturePath: "./textures/",
        engine: null,
        engineReady: false,
        eventDebug: false,
        modelReadyPromises: new Map(),
        pendingMeshCreations: 0,
        pendingTriggers: new Map(),
        _nameRegistry: new Map(),
        _animationFileCache: {},
        characterNames: characterNames,
        alert: alert,
        BABYLON: BABYLON,
        BABYLON_LOADER: BABYLON_LOADER,
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
                                                const marker =
                                                        actualLine === lineNum
                                                                ? ">>> "
                                                                : "    ";
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
                        flock.printText?.({
                                text: `⚠️ Limit reached: You can only have ${max} meshes in your world.`,
                                duration: 30,
                                color: "#ff0000",
                        });

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
                        // Show user warning in your UI
                        this.printText({
                                text: `Warning: High memory usage (${usagePercent.toFixed(1)}%)`,
                                duration: 3,
                                color: "#ff9900",
                        });
                }

                // Count Babylon.js objects for more specific monitoring
                if (flock.scene) {
                        const counts = {
                                meshes: flock.scene.meshes.length,
                                geometries: Object.keys(flock.geometryCache)
                                        .length,
                                vertices: flock.getTotalSceneVertices(),
                                materials: flock.scene.materials.length,
                                cachedMaterials: Object.keys(
                                        flock.materialCache,
                                ).length,
                                textures: flock.scene.textures.length,
                                animationGroups:
                                        flock.scene.animationGroups.length,
                        };
                        console.log("Scene objects:", counts);
                }
        },
        startMemoryMonitoring() {
                console.log("Starting memory monitoring...");
                // Clear any existing monitoring
                if (flock.memoryMonitorInterval) {
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
                                flock.memoryMonitorInterval = null;
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
        // Updated runCode with whitelisting + constructor hardening + frozen built-ins
        async runCode(code) {
                let iframe = document.getElementById("flock-iframe");

                try {
                        // 1) Dispose old scene if iframe exists
                        if (iframe) {
                                try {
                                        await iframe.contentWindow?.flock?.disposeOldScene?.();
                                } catch (err) {
                                        console.warn(
                                                "Error disposing old scene in iframe:",
                                                err,
                                        );
                                }
                        } else {
                                // 2) Create a new iframe if not found
                                iframe = document.createElement("iframe");
                                iframe.id = "flock-iframe";
                                iframe.style.display = "none";
                                document.body.appendChild(iframe);
                        }

                        // 3) Load a clean iframe context
                        await new Promise((resolve, reject) => {
                                iframe.onload = () => resolve();
                                iframe.onerror = () =>
                                        reject(
                                                new Error(
                                                        "Failed to load iframe",
                                                ),
                                        );
                                iframe.src = "about:blank";
                        });

                        // 4) Set up iframe window and flock reference
                        const iframeWindow = iframe.contentWindow;
                        if (!iframeWindow)
                                throw new Error("Iframe window is unavailable");
                        iframeWindow.flock = this;

                        // Initialise a fresh scene (unchanged)
                        await this.initializeNewScene?.();
                        if (this.memoryDebug) this.startMemoryMonitoring?.();

                        // 5) Build the whitelisted environment
                        const whitelist = this.createWhitelist();
                        const wlNames = Object.keys(whitelist);
                        const wlValues = Object.values(whitelist);

                        // Shadow dangerous globals by passing them as undefined params
                        const shadowNames = [
                                "window",
                                "document",
                                "globalThis",
                                "self",
                                "parent",
                                "top",
                                "frames",
                                "Function",
                                "fetch",
                                "XMLHttpRequest",
                        ];
                        const shadowValues = new Array(shadowNames.length).fill(
                                undefined,
                        );

                        const paramNames = shadowNames.concat(wlNames);
                        const paramValues = shadowValues.concat(wlValues);

                        // Harden constructor escape paths
                        const hardenPrelude =
                                "try{" +
                                'Object.defineProperty(Object.prototype,"constructor",{value:undefined,writable:true,configurable:true});' +
                                'Object.defineProperty(Function.prototype,"constructor",{value:undefined,writable:true,configurable:true});' +
                                "}catch{}";

                        // Freeze safe built-ins to prevent tampering
                        const freezePrelude =
                                "try{" +
                                "Object.freeze(Math);" +
                                "Object.freeze(JSON);" +
                                "Object.freeze(Date);" +
                                "Object.freeze(Number);" +
                                "Object.freeze(String);" +
                                "Object.freeze(Boolean);" +
                                "Object.freeze(Array);" +
                                "Object.freeze(Object);" +
                                "}catch{}";

                        // Assemble the function body safely (no template literals)
                        const body =
                                '"use strict";\n' +
                                hardenPrelude +
                                "\n" +
                                freezePrelude +
                                "\n" +
                                "return (async () => {\n" +
                                code +
                                "\n})();\n";

                        // Create the sandboxed function using only whitelisted APIs + shadowed globals
                        const run = new iframeWindow.Function(
                                ...paramNames,
                                body,
                        );

                        // Execute code with whitelisting enforced
                        await run(...paramValues);

                        document.getElementById("renderCanvas")?.focus();
                } catch (error) {
                        const enhancedError =
                                this.createEnhancedError?.(error, code) ??
                                error;
                        console.error("Enhanced error details:", enhancedError);

                        this.printText?.({
                                text: `Error: ${error.message}`,
                                duration: 5,
                                color: "#ff0000",
                        });

                        try {
                                this.audioContext?.close?.();
                                this.engine?.stopRenderLoop?.();
                                this.removeEventListeners?.();
                        } catch (cleanupError) {
                                console.error(
                                        "Error during cleanup:",
                                        cleanupError,
                                );
                        }

                        throw error;
                }
        },
        createWhitelist() {
                const api = {
                        // Safe built-ins
                        Object,
                        Array,
                        String,
                        Number,
                        Boolean,
                        Math,
                        Date,
                        JSON,
                        Promise,
                        console,

                        // All Flock API methods — unchanged
                        initialize: this.initialize?.bind(this),
                        createEngine: this.createEngine?.bind(this),
                        createScene: this.createScene?.bind(this),
                        playAnimation: this.playAnimation?.bind(this),
                        playSound: this.playSound?.bind(this),
                        stopAllSounds: this.stopAllSounds?.bind(this),
                        playNotes: this.playNotes?.bind(this),
                        setBPM: this.setBPM?.bind(this),
                        createInstrument: this.createInstrument?.bind(this),
                        speak: this.speak?.bind(this),
                        switchAnimation: this.switchAnimation?.bind(this),
                        highlight: this.highlight?.bind(this),
                        glow: this.glow?.bind(this),
                        createCharacter: this.createCharacter?.bind(this),
                        createObject: this.createObject?.bind(this),
                        createParticleEffect:
                                this.createParticleEffect?.bind(this),
                        create3DText: this.create3DText?.bind(this),
                        createModel: this.createModel?.bind(this),
                        createBox: this.createBox?.bind(this),
                        createSphere: this.createSphere?.bind(this),
                        createCylinder: this.createCylinder?.bind(this),
                        createCapsule: this.createCapsule?.bind(this),
                        createPlane: this.createPlane?.bind(this),
                        cloneMesh: this.cloneMesh?.bind(this),
                        parentChild: this.parentChild?.bind(this),
                        setParent: this.setParent?.bind(this),
                        mergeMeshes: this.mergeMeshes?.bind(this),
                        subtractMeshes: this.subtractMeshes?.bind(this),
                        intersectMeshes: this.intersectMeshes?.bind(this),
                        createHull: this.createHull?.bind(this),
                        hold: this.hold?.bind(this),
                        attach: this.attach?.bind(this),
                        drop: this.drop?.bind(this),
                        makeFollow: this.makeFollow?.bind(this),
                        stopFollow: this.stopFollow?.bind(this),
                        removeParent: this.removeParent?.bind(this),
                        createGround: this.createGround?.bind(this),
                        createMap: this.createMap?.bind(this),
                        createCustomMap: this.createCustomMap?.bind(this),
                        setSky: this.setSky?.bind(this),
                        lightIntensity: this.lightIntensity?.bind(this),
                        buttonControls: this.buttonControls?.bind(this),
                        getCamera: this.getCamera?.bind(this),
                        cameraControl: this.cameraControl?.bind(this),
                        setCameraBackground:
                                this.setCameraBackground?.bind(this),
                        setXRMode: this.setXRMode?.bind(this),
                        applyForce: this.applyForce?.bind(this),
                        moveByVector: this.moveByVector?.bind(this),
                        glideTo: this.glideTo?.bind(this),
                        createAnimation: this.createAnimation?.bind(this),
                        animateFrom: this.animateFrom?.bind(this),
                        playAnimationGroup: this.playAnimationGroup?.bind(this),
                        pauseAnimationGroup:
                                this.pauseAnimationGroup?.bind(this),
                        stopAnimationGroup: this.stopAnimationGroup?.bind(this),
                        startParticleSystem:
                                this.startParticleSystem?.bind(this),
                        stopParticleSystem: this.stopParticleSystem?.bind(this),
                        resetParticleSystem:
                                this.resetParticleSystem?.bind(this),
                        animateKeyFrames: this.animateKeyFrames?.bind(this),
                        setPivotPoint: this.setPivotPoint?.bind(this),
                        rotate: this.rotate?.bind(this),
                        lookAt: this.lookAt?.bind(this),
                        moveTo: this.moveTo?.bind(this),
                        rotateTo: this.rotateTo?.bind(this),
                        rotateCamera: this.rotateCamera?.bind(this),
                        rotateAnim: this.rotateAnim?.bind(this),
                        animateProperty: this.animateProperty?.bind(this),
                        positionAt: this.positionAt?.bind(this),
                        distanceTo: this.distanceTo?.bind(this),
                        wait: this.wait?.bind(this),
                        safeLoop: this.safeLoop?.bind(this),
                        waitUntil: this.waitUntil?.bind(this),
                        show: this.show?.bind(this),
                        hide: this.hide?.bind(this),
                        clearEffects: this.clearEffects?.bind(this),
                        stopAnimations: this.stopAnimations?.bind(this),
                        tint: this.tint?.bind(this),
                        setAlpha: this.setAlpha?.bind(this),
                        dispose: this.dispose?.bind(this),
                        setFog: this.setFog?.bind(this),
                        keyPressed: this.keyPressed?.bind(this),
                        isTouchingSurface: this.isTouchingSurface?.bind(this),
                        meshExists: this.meshExists?.bind(this),
                        seededRandom: this.seededRandom?.bind(this),
                        randomColour: this.randomColour?.bind(this),
                        scale: this.scale?.bind(this),
                        resize: this.resize?.bind(this),
                        changeColor: this.changeColor?.bind(this),
                        changeColorMesh: this.changeColorMesh?.bind(this),
                        changeMaterial: this.changeMaterial?.bind(this),
                        setMaterial: this.setMaterial?.bind(this),
                        createMaterial: this.createMaterial?.bind(this),
                        textMaterial: this.textMaterial?.bind(this),
                        createDecal: this.createDecal?.bind(this),
                        placeDecal: this.placeDecal?.bind(this),
                        moveForward: this.moveForward?.bind(this),
                        moveSideways: this.moveSideways?.bind(this),
                        strafe: this.strafe?.bind(this),
                        attachCamera: this.attachCamera?.bind(this),
                        canvasControls: this.canvasControls?.bind(this),
                        setPhysics: this.setPhysics?.bind(this),
                        setPhysicsShape: this.setPhysicsShape?.bind(this),
                        checkMeshesTouching:
                                this.checkMeshesTouching?.bind(this),
                        say: this.say?.bind(this),
                        onTrigger: this.onTrigger?.bind(this),
                        onEvent: this.onEvent?.bind(this),
                        broadcastEvent: this.broadcastEvent?.bind(this),
                        Mesh: this.Mesh,
                        start: this.start?.bind(this),
                        forever: this.forever?.bind(this),
                        whenKeyEvent: this.whenKeyEvent?.bind(this),
                        randomInteger: this.randomInteger?.bind(this),
                        printText: this.printText?.bind(this),
                        UIText: this.UIText?.bind(this),
                        UIButton: this.UIButton?.bind(this),
                        UIInput: this.UIInput?.bind(this),
                        UISlider: this.UISlider?.bind(this),
                        onIntersect: this.onIntersect?.bind(this),
                        getProperty: this.getProperty?.bind(this),
                        exportMesh: this.exportMesh?.bind(this),
                        abortSceneExecution:
                                this.abortSceneExecution?.bind(this),
                        ensureUniqueGeometry:
                                this.ensureUniqueGeometry?.bind(this),
                        createVector3: this.createVector3?.bind(this),
                };

                // Freeze for safety — prevents mutation of the API surface
                try {
                        return Object.freeze(api);
                } catch {
                        return api;
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
                                if (event.touches.length === 0) {
                                        const input =
                                                flock.scene.activeCamera.inputs
                                                        ?.attached?.pointers;
                                        // Add null check for input itself
                                        if (
                                                input &&
                                                (input._pointA !== null ||
                                                        input._pointB !==
                                                                null ||
                                                        input._isMultiTouch ===
                                                                true)
                                        ) {
                                                flock.scene.activeCamera.detachControl(
                                                        flock.canvas,
                                                );
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
                flock.engine.setHardwareScalingLevel(
                        1 / window.devicePixelRatio,
                );
        },
        async disposeOldScene() {
                console.log("Disposing old scene");
                flock.flockNotReady = true;

                if (flock.scene) {
                        try {
                                // Check if WebGL context is lost before disposal operations
                                const canvas =
                                        flock.engine?.getRenderingCanvas();
                                const gl =
                                        canvas?.getContext("webgl") ||
                                        canvas?.getContext("webgl2");
                                if (gl?.isContextLost?.()) {
                                        console.warn(
                                                "WebGL context already lost, skipping some disposal operations",
                                        );
                                        return;
                                }

                                // Stop all sounds and animations first
                                flock.stopAllSounds();
                                flock.engine?.stopRenderLoop();

                                // Abort any ongoing operations
                                if (flock.abortController) {
                                        flock.abortController.abort();
                                }

                                // Stop all animations and dispose animation groups
                                flock.scene.stopAllAnimations();

                                // Dispose animatables
                                if (flock.scene.animatables) {
                                        [...flock.scene.animatables].forEach(
                                                (animatable) => {
                                                        try {
                                                                animatable.stop();
                                                                animatable.dispose?.();
                                                        } catch (error) {
                                                                console.warn(
                                                                        "Error disposing animatable:",
                                                                        error,
                                                                );
                                                        }
                                                },
                                        );
                                }

                                // Dispose animation groups
                                if (flock.scene.animationGroups) {
                                        [
                                                ...flock.scene.animationGroups,
                                        ].forEach((group) => {
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

                                // Clear observables
                                flock.gridKeyPressObservable?.clear();
                                flock.gridKeyReleaseObservable?.clear();

                                // Dispose sound tracks
                                if (flock.scene.mainSoundTrack) {
                                        flock.scene.mainSoundTrack.dispose();
                                }
                                if (flock.scene.soundTracks) {
                                        flock.scene.soundTracks.forEach(
                                                (track) => track?.dispose(),
                                        );
                                }

                                // Dispose post-processing effects
                                if (flock.scene.postProcesses) {
                                        [...flock.scene.postProcesses].forEach(
                                                (pp) => pp?.dispose(),
                                        );
                                }
                                flock.scene.postProcessRenderPipelineManager?.dispose();

                                // Dispose effects
                                flock.highlighter?.dispose();
                                flock.highlighter = null;
                                flock.glowLayer?.dispose();
                                flock.glowLayer = null;

                                // Dispose lighting
                                flock.mainLight?.dispose();
                                flock.mainLight = null;

                                // Dispose particle systems first (before meshes they might be attached to)
                                const particleSystems = flock.scene
                                        .particleSystems
                                        ? [...flock.scene.particleSystems]
                                        : [];
                                particleSystems.forEach((system) => {
                                        if (system?.dispose) {
                                                try {
                                                        system.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing particle system:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Dispose all meshes and their action managers
                                const meshesToDispose = flock.scene.meshes
                                        ? [...flock.scene.meshes]
                                        : [];
                                meshesToDispose.forEach((mesh) => {
                                        if (mesh?.actionManager) {
                                                try {
                                                        mesh.actionManager.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing action manager:",
                                                                error,
                                                        );
                                                }
                                        }
                                        if (
                                                mesh?.material?.dispose &&
                                                typeof mesh.material.dispose ===
                                                        "function"
                                        ) {
                                                try {
                                                        mesh.material.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing mesh material:",
                                                                error,
                                                        );
                                                }
                                        }
                                        if (
                                                mesh?.dispose &&
                                                typeof mesh.dispose ===
                                                        "function"
                                        ) {
                                                try {
                                                        mesh.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing mesh:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Dispose transform nodes
                                const transformNodes = flock.scene
                                        .transformNodes
                                        ? [...flock.scene.transformNodes]
                                        : [];
                                transformNodes.forEach((node) => {
                                        if (node?.dispose) {
                                                try {
                                                        node.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing transform node:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Dispose geometries (after meshes)
                                const geometries = flock.scene.geometries
                                        ? [...flock.scene.geometries]
                                        : [];
                                geometries.forEach((geometry) => {
                                        if (geometry?.dispose) {
                                                try {
                                                        geometry.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing geometry:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Clear camera
                                if (flock.scene.activeCamera) {
                                        flock.scene.activeCamera.inputs?.clear();
                                        flock.scene.activeCamera.dispose();
                                }

                                // Dispose textures
                                const textures = flock.scene.textures
                                        ? [...flock.scene.textures]
                                        : [];
                                textures.forEach((texture) => {
                                        if (
                                                texture?.dispose &&
                                                typeof texture.dispose ===
                                                        "function"
                                        ) {
                                                try {
                                                        texture.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing texture:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Dispose materials that weren't caught earlier
                                const materials = flock.scene.materials
                                        ? [...flock.scene.materials]
                                        : [];
                                materials.forEach((material) => {
                                        if (
                                                material?.dispose &&
                                                typeof material.dispose ===
                                                        "function"
                                        ) {
                                                try {
                                                        material.dispose();
                                                } catch (error) {
                                                        console.warn(
                                                                "Error disposing material:",
                                                                error,
                                                        );
                                                }
                                        }
                                });

                                // Clear all scene observables
                                flock.scene.onBeforeRenderObservable?.clear();
                                flock.scene.onAfterRenderObservable?.clear();
                                flock.scene.onBeforeAnimationsObservable?.clear();
                                flock.scene.onAfterAnimationsObservable?.clear();
                                flock.scene.onReadyObservable?.clear();
                                flock.scene.onDataLoadedObservable?.clear();
                                flock.scene.onDisposedObservable?.clear();
                                flock.scene.onPointerObservable?.clear();
                                flock.scene.onKeyboardObservable?.clear();

                                // Wait for async operations to complete
                                await new Promise((resolve) =>
                                        setTimeout(resolve, 100),
                                );

                                // Dispose of the scene
                                flock.scene.dispose();
                                flock.scene = null;

                                // Dispose physics engine
                                flock.hk?.dispose();
                                flock.hk = null;

                                // Dispose the Babylon.js engine
                                flock.engine?.dispose();
                                flock.engine = null;

                                // Close audio context
                                if (
                                        flock.audioContext &&
                                        flock.audioContext.state !== "closed"
                                ) {
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

                                // Clear all references
                                flock.events = {};
                                flock.modelCache = {};
                                flock.globalSounds = [];
                                flock.modelsBeingLoaded = {};
                                flock.originalModelTransformations = {};
                                flock.geometryCache = {};
                                flock.materialCache = {};
                                flock.pendingTriggers = new Map();
                                flock._nameRegistry = new Map();
                                flock._animationFileCache = {};
                                flock.ground = null;
                                flock.sky = null;

                                // Clear abort controller
                                flock.abortController = null;

                                // Force garbage collection in development (if available)
                                if (
                                        typeof window !== "undefined" &&
                                        window.gc
                                ) {
                                        setTimeout(() => {
                                                try {
                                                        window.gc();
                                                        console.log(
                                                                "Forced garbage collection",
                                                        );
                                                } catch (error) {
                                                        // Silently fail if gc is not available
                                                }
                                        }, 100);
                                }

                                console.log(
                                        "Scene disposal completed successfully",
                                );
                        } catch (error) {
                                console.error(
                                        "Error during scene disposal:",
                                        error,
                                );
                                // Even if disposal fails, clear critical references
                                flock.scene = null;
                                flock.engine = null;
                                flock.flockNotReady = true;
                        }
                } else {
                        console.log("No scene to dispose");
                }
        },
        async initializeNewScene() {
                // Wait a bit more to ensure all disposal operations are complete
                await new Promise((resolve) => setTimeout(resolve, 200));

                // Stop existing render loop or create a new engine
                flock.engine
                        ? flock.engine.stopRenderLoop()
                        : flock.createEngine();

                // Reset scene-wide state
                flock.events = {};
                flock.modelCache = {};
                flock.globalSounds = [];
                flock.modelsBeingLoaded = {};
                flock.originalModelTransformations = {};
                flock.geometryCache = {};
                flock.pendingTriggers = new Map();
                flock._nameRegistry = new Map();
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
                flock.hk = new flock.BABYLON.HavokPlugin(
                        true,
                        flock.havokInstance,
                );
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
                hemisphericLight.groundColor = new flock.BABYLON.Color3(
                        0.5,
                        0.5,
                        0.5,
                );

                flock.mainLight = hemisphericLight;

                flock.audioEnginePromise = flock.BABYLON.CreateAudioEngineAsync(
                        {
                                volume: 1,
                                listenerAutoUpdate: true,
                                listenerEnabled: true,
                                resumeOnInteraction: true,
                        },
                );

                flock.audioEnginePromise.then((audioEngine) => {
                        flock.audioEngine = audioEngine;
                        flock.globalStartTime =
                                flock.getAudioContext().currentTime;
                        if (flock.scene.activeCamera) {
                                audioEngine.listener.attach(
                                        flock.scene.activeCamera,
                                );
                        }

                        // Reattach listener if the active camera ever changes
                        flock.scene.onActiveCameraChanged.add(() => {
                                audioEngine.listener.attach(
                                        flock.scene.activeCamera,
                                );
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
                                flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
                                        "UI",
                                );
                        flock.createArrowControls("white");
                        flock.createButtonControls("white");
                }

                // Create the UI
                flock.advancedTexture =
                        flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
                                "UI",
                        );

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
                        flock.xrHelper =
                                await flock.scene.createDefaultXRExperienceAsync();
                } else if (mode === "AR") {
                        flock.xrHelper =
                                await flock.scene.createDefaultXRExperienceAsync(
                                        {
                                                uiOptions: {
                                                        sessionMode:
                                                                "immersive-ar",
                                                },
                                        },
                                );
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

                flock.meshTexture =
                        flock.GUI.AdvancedDynamicTexture.CreateForMesh(
                                flock.uiPlane,
                        );

                // Ensure the UI plane follows the wrist (using a controller or camera offset)
                flock.xrHelper.input.onControllerAddedObservable.add(
                        (controller) => {
                                if (
                                        controller.inputSource.handedness ===
                                        "left"
                                ) {
                                        // Attach the UI plane to the left-hand controller
                                        flock.uiPlane.parent =
                                                controller.grip ||
                                                controller.pointer;

                                        // Position the UI plane to simulate a watch
                                        flock.uiPlane.position.set(
                                                0.1,
                                                -0.05,
                                                0,
                                        ); // Slightly to the side, closer to the wrist
                                        flock.uiPlane.rotation.set(
                                                Math.PI / 2,
                                                0,
                                                0,
                                        ); // Rotate to face the user
                                }
                        },
                );

                // Handle XR state changes
                flock.xrHelper.baseExperience.onStateChangedObservable.add(
                        (state) => {
                                if (
                                        state ===
                                        flock.BABYLON.WebXRState.ENTERING_XR
                                ) {
                                        flock.advancedTexture.removeControl(
                                                flock.stackPanel,
                                        );
                                        flock.meshTexture.addControl(
                                                flock.stackPanel,
                                        );
                                        flock.uiPlane.isVisible = true;

                                        // Update alignment for wrist UI
                                        flock.stackPanel.horizontalAlignment =
                                                flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                                        flock.stackPanel.verticalAlignment =
                                                flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

                                        flock.advancedTexture.isVisible = false; // Hide fullscreen UI
                                } else if (
                                        state ===
                                        flock.BABYLON.WebXRState.EXITING_XR
                                ) {
                                        flock.meshTexture.removeControl(
                                                flock.stackPanel,
                                        );
                                        flock.advancedTexture.addControl(
                                                flock.stackPanel,
                                        );
                                        flock.uiPlane.isVisible = false;

                                        // Restore alignment for non-XR
                                        flock.stackPanel.width = "100%";
                                        flock.stackPanel.horizontalAlignment =
                                                flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                                        flock.stackPanel.verticalAlignment =
                                                flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

                                        flock.advancedTexture.rootContainer.isVisible = true;
                                }
                        },
                );
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
                        if (
                                flock.disposed ||
                                !flock.scene ||
                                flock.scene.isDisposed
                        ) {
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
                                        const mesh =
                                                flock.scene.getMeshByName(
                                                        meshId,
                                                );
                                        if (mesh) {
                                                yield mesh;
                                                return;
                                        }
                                }
                        }

                        try {
                                await new Promise((resolve, reject) => {
                                        const timeoutId = setTimeout(
                                                resolve,
                                                interval,
                                        );

                                        // Reject the promise if the abort signal is triggered
                                        const onAbort = () => {
                                                clearTimeout(timeoutId);
                                                reject(
                                                        new Error(
                                                                "Wait aborted",
                                                        ),
                                                );
                                        };

                                        if (signal) {
                                                signal.addEventListener(
                                                        "abort",
                                                        onAbort,
                                                        {
                                                                once: true,
                                                        },
                                                );

                                                // Ensure the event listener is cleaned up after resolving
                                                signal.addEventListener(
                                                        "abort",
                                                        () =>
                                                                signal.removeEventListener(
                                                                        "abort",
                                                                        onAbort,
                                                                ),
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
        whenModelReady(id, callback) {
                // --- Promise that resolves when ready (or undefined on abort/dispose) ---
                let settled = false;
                let resolveP;
                const promise = new Promise((r) => {
                        resolveP = r;
                });

                const safeCall = (val) => {
                        if (settled) return;
                        settled = true;
                        try {
                                if (typeof callback === "function")
                                        callback(val);
                        } finally {
                                resolveP(val);
                        }
                };

                // Helper: locate current object
                const locate = () => {
                        const scene = flock.scene;
                        if (!scene) return null;
                        if (id === "__active_camera__")
                                return scene.activeCamera ?? null;

                        let t = scene.getMeshByName?.(id) ?? null;
                        if (!t && scene.UITexture)
                                t =
                                        scene.UITexture.getControlByName?.(
                                                id,
                                        ) ?? null;
                        if (!t && Array.isArray(scene.animationGroups))
                                t =
                                        scene.animationGroups.find(
                                                (g) => g.name === id,
                                        ) ?? null;
                        if (!t && Array.isArray(scene.particleSystems))
                                t =
                                        scene.particleSystems.find(
                                                (s) => s.name === id,
                                        ) ?? null;
                        return t ?? null;
                };

                // --- Fast path ---
                if (flock.scene) {
                        const existing = locate();
                        if (existing) {
                                if (!flock.abortController?.signal?.aborted)
                                        safeCall(existing);
                                return promise; // <— return the promise even in fast path
                        }
                }

                // --- CallbackMode (observer) path ---
                if (flock.callbackMode) {
                        const signal = flock.abortController?.signal;

                        const attachObservers = () => {
                                const scene = flock.scene;
                                if (!scene) return;

                                const disposers = [];
                                let done = false;
                                const finish = (target /*, source */) => {
                                        if (done) return;
                                        done = true;
                                        try {
                                                if (!signal?.aborted)
                                                        safeCall(target);
                                        } finally {
                                                while (disposers.length) {
                                                        try {
                                                                disposers.pop()();
                                                        } catch {}
                                                }
                                        }
                                };

                                // active camera
                                if (id === "__active_camera__") {
                                        const camNow = scene.activeCamera;
                                        if (camNow) {
                                                finish(camNow);
                                                return;
                                        }
                                        if (scene.onActiveCameraChanged) {
                                                const cb = () => {
                                                        if (scene.activeCamera)
                                                                finish(
                                                                        scene.activeCamera,
                                                                );
                                                };
                                                scene.onActiveCameraChanged.add(
                                                        cb,
                                                );
                                                disposers.push(() =>
                                                        scene.onActiveCameraChanged.removeCallback(
                                                                cb,
                                                        ),
                                                );
                                        }
                                        if (scene.onDisposeObservable) {
                                                const h =
                                                        scene.onDisposeObservable.add(
                                                                () =>
                                                                        finish(
                                                                                undefined,
                                                                        ),
                                                        );
                                                disposers.push(() =>
                                                        scene.onDisposeObservable.remove(
                                                                h,
                                                        ),
                                                );
                                        }
                                        if (signal) {
                                                const onAbort = () =>
                                                        finish(undefined);
                                                signal.addEventListener(
                                                        "abort",
                                                        onAbort,
                                                        { once: true },
                                                );
                                                disposers.push(() =>
                                                        signal.removeEventListener(
                                                                "abort",
                                                                onAbort,
                                                        ),
                                                );
                                        }
                                        return;
                                }

                                // meshes
                                if (scene.onNewMeshAddedObservable) {
                                        const h =
                                                scene.onNewMeshAddedObservable.add(
                                                        (mesh) => {
                                                                if (
                                                                        !done &&
                                                                        mesh?.name ===
                                                                                id
                                                                )
                                                                        finish(
                                                                                mesh,
                                                                        );
                                                        },
                                                );
                                        disposers.push(() =>
                                                scene.onNewMeshAddedObservable.remove(
                                                        h,
                                                ),
                                        );
                                }

                                // animation groups
                                if (scene.onAnimationGroupAddedObservable) {
                                        const h =
                                                scene.onAnimationGroupAddedObservable.add(
                                                        (group) => {
                                                                if (
                                                                        !done &&
                                                                        group?.name ===
                                                                                id
                                                                )
                                                                        finish(
                                                                                group,
                                                                        );
                                                        },
                                                );
                                        disposers.push(() =>
                                                scene.onAnimationGroupAddedObservable.remove(
                                                        h,
                                                ),
                                        );
                                }

                                // particle systems
                                if (scene.onNewParticleSystemAddedObservable) {
                                        const h =
                                                scene.onNewParticleSystemAddedObservable.add(
                                                        (ps) => {
                                                                if (
                                                                        !done &&
                                                                        ps?.name ===
                                                                                id
                                                                )
                                                                        finish(
                                                                                ps,
                                                                        );
                                                        },
                                                );
                                        disposers.push(() =>
                                                scene.onNewParticleSystemAddedObservable.remove(
                                                        h,
                                                ),
                                        );
                                }

                                // GUI controls (attach when UITexture exists)
                                const attachGui = () => {
                                        const tex = scene.UITexture;
                                        if (!tex?.onControlAddedObservable)
                                                return false;
                                        const h =
                                                tex.onControlAddedObservable.add(
                                                        (ctrl) => {
                                                                if (
                                                                        !done &&
                                                                        ctrl?.name ===
                                                                                id
                                                                )
                                                                        finish(
                                                                                ctrl,
                                                                        );
                                                        },
                                                );
                                        disposers.push(() =>
                                                tex.onControlAddedObservable.remove(
                                                        h,
                                                ),
                                        );
                                        return true;
                                };
                                if (!attachGui()) {
                                        const tick =
                                                scene.onBeforeRenderObservable.add(
                                                        () => {
                                                                if (attachGui())
                                                                        scene.onBeforeRenderObservable.remove(
                                                                                tick,
                                                                        );
                                                        },
                                                );
                                        disposers.push(() =>
                                                scene.onBeforeRenderObservable.remove(
                                                        tick,
                                                ),
                                        );
                                }

                                // scene dispose / abort
                                if (scene.onDisposeObservable) {
                                        const h = scene.onDisposeObservable.add(
                                                () => finish(undefined),
                                        );
                                        disposers.push(() =>
                                                scene.onDisposeObservable.remove(
                                                        h,
                                                ),
                                        );
                                }
                                if (signal) {
                                        const onAbort = () => finish(undefined);
                                        signal.addEventListener(
                                                "abort",
                                                onAbort,
                                                { once: true },
                                        );
                                        disposers.push(() =>
                                                signal.removeEventListener(
                                                        "abort",
                                                        onAbort,
                                                ),
                                        );
                                }
                        };

                        // wait for scene if needed
                        if (!flock.scene) {
                                let rafId = 0;
                                const check = () => {
                                        if (
                                                flock.abortController?.signal
                                                        ?.aborted
                                        )
                                                return;
                                        if (flock.scene) {
                                                cancelAnimationFrame(rafId);
                                                attachObservers();
                                                return;
                                        }
                                        rafId = requestAnimationFrame(check);
                                };
                                rafId = requestAnimationFrame(check);
                                if (signal) {
                                        const onAbort = () =>
                                                cancelAnimationFrame(rafId);
                                        signal.addEventListener(
                                                "abort",
                                                onAbort,
                                                { once: true },
                                        );
                                }
                                return promise; // <— still return the promise
                        }

                        attachObservers();
                        return promise;
                }

                // --- Polling fallback (generator) ---
                (async () => {
                        const generator = flock.modelReadyGenerator(id);
                        try {
                                for await (const target of generator) {
                                        if (
                                                flock.abortController?.signal
                                                        ?.aborted
                                        ) {
                                                safeCall(undefined);
                                                return;
                                        }
                                        if (target) safeCall(target);
                                        return;
                                }
                        } catch (err) {
                                if (flock.abortController?.signal?.aborted) {
                                        // resolve undefined on abort
                                        safeCall(undefined);
                                } else {
                                        console.error(
                                                `Error in whenModelReady for '${id}':`,
                                                err,
                                        );
                                        // resolve undefined on error to prevent hangs
                                        safeCall(undefined);
                                }
                        }
                })();

                return promise; // <— important: always return the promise
        },
        announceMeshReady(meshName, groupName) {
                //console.log(`[flock] Mesh ready: ${meshName} (group: ${groupName})`);

                if (!flock.pendingTriggers.has(groupName)) return;

                //console.log(`[flock] Registering pending triggers for group: '${groupName}'`);
                const triggers = flock.pendingTriggers.get(groupName);

                for (const {
                        trigger,
                        callback,
                        mode,
                        applyToGroup,
                } of triggers) {
                        if (applyToGroup) {
                                // 🔁 Reapply trigger across all matching meshes
                                const matching = flock.scene.meshes.filter(
                                        (m) => m.name.startsWith(groupName),
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
        /** Reserve a unique name. If desired is taken or pending, suffix it. */
        _reserveName(desired) {
                const has = (n) =>
                        flock._nameRegistry.has(n) ||
                        !!flock.scene?.getMeshByName(n);
                let name = desired;
                while (has(name)) {
                        name = `${desired}_${flock.scene.getUniqueId()}`;
                }
                flock._nameRegistry.set(name, { pending: true, exists: false });
                return name;
        },

        /** Mark a reserved name as created (exists in scene). */
        _markNameCreated(name) {
                const rec = flock._nameRegistry.get(name);
                if (rec) {
                        rec.pending = false;
                        rec.exists = true;
                }
        },

        /** Release a reservation on failure/disposal. */
        _releaseName(name) {
                flock._nameRegistry.delete(name);
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
                flock.printText({
                        text: "XR Mode!",
                        duration: 5,
                        color: "white",
                });
        },
        exportMesh(meshName, format) {
                //meshName = "scene";
  
                if (meshName === "scene" && format === "GLB") {
                        const scene = flock.scene;

                        const cls = (n) => n?.getClassName?.();
                        const isEnabledDeep = (n) =>
                                typeof n.isEnabled === "function"
                                        ? n.isEnabled(true)
                                        : true;

                        // Treat ALL mesh subclasses as geometry; we'll still skip LinesMesh explicitly
                        const isAbstractMesh = (n) =>
                                typeof BABYLON !== "undefined" &&
                                n instanceof BABYLON.AbstractMesh;
                        const isLines = (n) => cls(n) === "LinesMesh";

                        // --- Ghost: top-level + enabled + AbstractMesh + no material (not lines)
                        const targets = scene.meshes.filter(
                                (m) =>
                                        !m.parent &&
                                        isEnabledDeep(m) &&
                                        isAbstractMesh(m) &&
                                        !isLines(m) &&
                                        !m.material,
                        );

                        // Shared transparent PBR material (GLTF-friendly)
                        const ghostMat = new BABYLON.PBRMaterial(
                                "_tmpExportGhost",
                                scene,
                        );
                        ghostMat.alpha = 0;
                        ghostMat.alphaMode = BABYLON.Engine.ALPHA_BLEND;
                        ghostMat.transparencyMode =
                                BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
                        ghostMat.disableLighting = true;
                        ghostMat.metallic = 0;
                        ghostMat.roughness = 1;
                        ghostMat.albedoColor = new BABYLON.Color4(1, 1, 1, 0);

                        const patches = targets.map((mesh) => ({
                                mesh,
                                prev: mesh.material ?? null,
                        }));
                        for (const { mesh } of patches)
                                mesh.material = ghostMat;

                        // Optional: name allowlist for safety (keeps ground even if disabled, if you want)
                        const alwaysKeepNames = new Set(["ground", "Ground"]);

                        const shouldExportNode = (node) => {
                                const c = cls(node);
                                if (!c) return false;

                                // Always keep ground (by name) before any other checks
                                if (node.name && alwaysKeepNames.has(node.name))
                                        return true;

                                // Respect enabled state (includes ancestors)
                                if (!isEnabledDeep(node)) return false;

                                // Never export cameras/lights
                                if (c === "Camera" || c === "Light")
                                        return false;

                                // Skip line helpers entirely
                                if (c === "LinesMesh") return false;

                                // Keep all transform containers
                                if (c === "TransformNode") return true;

                                // Keep ALL mesh subclasses (e.g., Mesh, InstancedMesh, GroundMesh, etc.)
                                if (isAbstractMesh(node)) return true;

                                return false;
                        };

                        flock.EXPORT.GLTF2Export.GLBAsync(scene, "scene.glb", {
                                exportMaterials: true,
                                exportTextures: true,
                                shouldExportNode,
                        })
                                .then((glb) => glb.downloadFiles())
                                .finally(() => {
                                        // Restore originals
                                        for (const { mesh, prev } of patches)
                                                mesh.material = prev;
                                        ghostMat.dispose();
                                });

                        return;
                }

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
                                const stlData =
                                        flock.EXPORT.STLExport.CreateSTL(
                                                meshList,
                                                true,
                                                mesh.name,
                                                false,
                                                false,
                                        );
                        } else if (format === "OBJ") {
                                const objData =
                                        flock.EXPORT.OBJExport.OBJ(mesh);
                                //download(mesh.name + ".obj", objData, "text/plain");
                        } else if (format === "GLB") {
                                mesh.flipFaces();
                                flock.EXPORT.GLTF2Export.GLBAsync(
                                        flock.scene,
                                        mesh.name + ".glb",
                                        {
                                                shouldExportNode: (node) =>
                                                        node === mesh ||
                                                        mesh
                                                                .getChildMeshes()
                                                                .includes(node),
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
                                flock.abortController.signal.addEventListener(
                                        "abort",
                                        onAbort,
                                );
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
                                await new Promise((resolve) =>
                                        requestAnimationFrame(resolve),
                                );
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
                        flock.scene.onBeforeRenderObservable.add(
                                checkCondition,
                        );
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
                                propertyValue = parseFloat(
                                        position.x.toFixed(2),
                                );
                                break;
                        case "POSITION_Y":
                                propertyValue = parseFloat(
                                        position.y.toFixed(2),
                                );
                                break;
                        case "POSITION_Z":
                                propertyValue = parseFloat(
                                        position.z.toFixed(2),
                                );
                                break;
                        case "ROTATION_X":
                                propertyValue = parseFloat(
                                        flock.BABYLON.Tools.ToDegrees(
                                                rotation.x,
                                        ).toFixed(2),
                                );
                                break;
                        case "ROTATION_Y":
                                parseFloat(
                                        (propertyValue =
                                                flock.BABYLON.Tools.ToDegrees(
                                                        rotation.y,
                                                ).toFixed(2)),
                                );
                                break;
                        case "ROTATION_Z":
                                propertyValue = parseFloat(
                                        flock.BABYLON.Tools.ToDegrees(
                                                rotation.z,
                                        ).toFixed(2),
                                );
                                break;
                        case "SCALE_X":
                                propertyValue = parseFloat(
                                        mesh.scaling.x.toFixed(2),
                                );
                                break;
                        case "SCALE_Y":
                                propertyValue = parseFloat(
                                        mesh.scaling.y.toFixed(2),
                                );
                                break;
                        case "SCALE_Z":
                                propertyValue = parseFloat(
                                        mesh.scaling.z.toFixed(2),
                                );
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
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.x;
                                } else if (
                                        mesh.metadata?.origin?.xOrigin ===
                                        "RIGHT"
                                ) {
                                        // Adjust based on RIGHT origin
                                        const diffX =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.x -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.x) *
                                                (1 - mesh.scaling.x);
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.x - diffX;
                                } else {
                                        // Default CENTER origin
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox.minimum.x *
                                                mesh.scaling.x;
                                }
                                break;

                        case "MAX_X":
                                if (
                                        mesh.metadata?.origin?.xOrigin ===
                                        "RIGHT"
                                ) {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.x;
                                } else if (
                                        mesh.metadata?.origin?.xOrigin ===
                                        "LEFT"
                                ) {
                                        const diffX =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.x -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.x) *
                                                mesh.scaling.x;
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.x + diffX;
                                } else {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox.maximum.x *
                                                mesh.scaling.x;
                                }
                                break;

                        case "MIN_Y":
                                if (mesh.metadata?.origin?.yOrigin === "BASE") {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.y;
                                } else if (
                                        mesh.metadata?.origin?.yOrigin === "TOP"
                                ) {
                                        const diffY =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.y -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.y) *
                                                (1 - mesh.scaling.y);
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.y - diffY;
                                } else {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.y;
                                        //mesh.getBoundingInfo().boundingBox.minimum.y *
                                        //                                              mesh.scaling.y;
                                }

                                break;

                        case "MAX_Y":
                                if (mesh.metadata?.origin?.yOrigin === "TOP") {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.y;
                                } else if (
                                        mesh.metadata?.origin?.yOrigin ===
                                        "BASE"
                                ) {
                                        const diffY =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.y -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.y) *
                                                mesh.scaling.y;
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.y + diffY;
                                } else {
                                        propertyValue = propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.y;
                                        //mesh.getBoundingInfo().boundingBox.maximum.y *
                                        //                                              mesh.scaling.y;
                                }
                                break;

                        case "MIN_Z":
                                if (
                                        mesh.metadata?.origin?.zOrigin ===
                                        "FRONT"
                                ) {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.z;
                                } else if (
                                        mesh.metadata?.origin?.zOrigin ===
                                        "BACK"
                                ) {
                                        const diffZ =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.z -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.z) *
                                                (1 - mesh.scaling.z);
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.z - diffZ;
                                } else {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox.minimum.z *
                                                mesh.scaling.z;
                                }
                                break;

                        case "MAX_Z":
                                if (mesh.metadata?.origin?.zOrigin === "BACK") {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .maximumWorld.z;
                                } else if (
                                        mesh.metadata?.origin?.zOrigin ===
                                        "FRONT"
                                ) {
                                        const diffZ =
                                                (mesh.getBoundingInfo()
                                                        .boundingBox.maximum.z -
                                                        mesh.getBoundingInfo()
                                                                .boundingBox
                                                                .minimum.z) *
                                                mesh.scaling.z;
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox
                                                        .minimumWorld.z + diffZ;
                                } else {
                                        propertyValue =
                                                mesh.getBoundingInfo()
                                                        .boundingBox.maximum.z *
                                                mesh.scaling.z;
                                }
                                break;
                        case "VISIBLE":
                                propertyValue = mesh.isVisible;
                                break;
                        case "ALPHA":
                                allMeshes = [mesh].concat(
                                        mesh.getDescendants(),
                                );
                                materialNode = allMeshes.find(
                                        (node) => node.material,
                                );

                                if (materialNode) {
                                        propertyValue =
                                                materialNode.material.alpha;
                                }
                                break;
                        case "COLOUR":
                                allMeshes = [mesh].concat(
                                        mesh.getDescendants(),
                                );
                                materialNodes = allMeshes.filter(
                                        (node) => node.material,
                                );

                                // Map to get the diffuseColor or albedoColor of each material as a hex string
                                colors = materialNodes
                                        .map((node) => {
                                                if (
                                                        node.material
                                                                .diffuseColor
                                                ) {
                                                        return node.material.diffuseColor.toHexString();
                                                } else if (
                                                        node.material
                                                                .albedoColor
                                                ) {
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
                                                const gamepad =
                                                        inputSource.gamepad;

                                                // Thumbstick movement
                                                if (
                                                        key === "W" &&
                                                        gamepad.axes[1] < -0.5
                                                )
                                                        return true; // Forward
                                                if (
                                                        key === "S" &&
                                                        gamepad.axes[1] > 0.5
                                                )
                                                        return true; // Backward
                                                if (
                                                        key === "A" &&
                                                        gamepad.axes[0] < -0.5
                                                )
                                                        return true; // Left
                                                if (
                                                        key === "D" &&
                                                        gamepad.axes[0] > 0.5
                                                )
                                                        return true; // Right

                                                // Button mappings
                                                if (
                                                        key === "SPACE" &&
                                                        gamepad.buttons[0]
                                                                ?.pressed
                                                )
                                                        return true; // A button for jump
                                                if (
                                                        key === "Q" &&
                                                        gamepad.buttons[1]
                                                                ?.pressed
                                                )
                                                        return true; // B button for action 1
                                                if (
                                                        key === "F" &&
                                                        gamepad.buttons[2]
                                                                ?.pressed
                                                )
                                                        return true; // X button for action 2
                                                if (
                                                        key === "E" &&
                                                        gamepad.buttons[3]
                                                                ?.pressed
                                                )
                                                        return true; // Y button for action 3

                                                // General button check
                                                if (
                                                        key === "ANY" &&
                                                        gamepad.buttons.some(
                                                                (button) =>
                                                                        button.pressed,
                                                        )
                                                )
                                                        return true;
                                        }
                                        return false;
                                },
                        );

                // Combine all sources
                if (key === "ANY") {
                        return (
                                pressedKeys.size > 0 ||
                                pressedButtons.size > 0 ||
                                vrPressed
                        );
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
        hexToRgb(hex) {
                // Remove the hash if present
                hex = hex.replace(/^#/, "");

                // Parse the hex values
                const bigint = parseInt(hex, 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;

                return { r, g, b };
        },
        rgbToHex(r, g, b) {
                // Ensure values are within valid range
                r = Math.max(0, Math.min(255, Math.round(r)));
                g = Math.max(0, Math.min(255, Math.round(g)));
                b = Math.max(0, Math.min(255, Math.round(b)));

                // Convert to hex and pad with zeros if needed
                const hex =
                        "#" +
                        [r, g, b]
                                .map((x) => {
                                        const hex = x.toString(16);
                                        return hex.length === 1
                                                ? "0" + hex
                                                : hex;
                                })
                                .join("");

                return hex;
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
                if (
                        reservedPrefixes.some((prefix) =>
                                lower.startsWith(prefix),
                        )
                ) {
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
                        flock.events[eventName] =
                                new flock.BABYLON.Observable();
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

                flock.xrHelper?.input.onControllerAddedObservable.add(
                        (controller) => {
                                console.log(
                                        `DEBUG: Controller added: ${controller.inputSource.handedness}`,
                                );

                                const handedness =
                                        controller.inputSource.handedness;

                                // Map button IDs to the corresponding keyboard keys
                                const buttonMap =
                                        handedness === "left"
                                                ? {
                                                          "y-button": "q",
                                                          "x-button": "e",
                                                  } // Left controller: Y -> Q, X -> E
                                                : handedness === "right"
                                                  ? {
                                                            "b-button": "f",
                                                            "a-button": " ",
                                                    } // Right controller: B -> F, A -> Space
                                                  : {}; // Unknown handedness: No mapping

                                controller.onMotionControllerInitObservable.add(
                                        (motionController) => {
                                                Object.entries(
                                                        buttonMap,
                                                ).forEach(
                                                        ([
                                                                buttonId,
                                                                mappedKey,
                                                        ]) => {
                                                                // Trigger the callback only for the specific key
                                                                if (
                                                                        mappedKey !==
                                                                        key
                                                                ) {
                                                                        return;
                                                                }
                                                                const component =
                                                                        motionController.getComponent(
                                                                                buttonId,
                                                                        );

                                                                if (
                                                                        !component
                                                                ) {
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
                                                                component.onButtonStateChangedObservable.add(
                                                                        () => {
                                                                                const isPressed =
                                                                                        component.pressed;

                                                                                // Debugging to verify button states
                                                                                console.log(
                                                                                        `DEBUG: Observable fired for '${buttonId}', pressed: ${isPressed}`,
                                                                                );

                                                                                // Ensure this logic only processes events for the current button
                                                                                if (
                                                                                        motionController.getComponent(
                                                                                                buttonId,
                                                                                        ) !==
                                                                                        component
                                                                                ) {
                                                                                        console.log(
                                                                                                `DEBUG: Skipping event for '${buttonId}' as it doesn't match the triggering component.`,
                                                                                        );
                                                                                        return;
                                                                                }

                                                                                // Ignore repeated callbacks for the same state
                                                                                if (
                                                                                        isPressed ===
                                                                                        lastPressedState
                                                                                ) {
                                                                                        console.log(
                                                                                                `DEBUG: No state change for '${buttonId}', skipping callback.`,
                                                                                        );
                                                                                        return;
                                                                                }

                                                                                // Only handle "released" transitions
                                                                                if (
                                                                                        !isPressed &&
                                                                                        lastPressedState
                                                                                ) {
                                                                                        console.log(
                                                                                                `DEBUG: Key '${mappedKey}' (button ID '${buttonId}') released on ${handedness} controller.`,
                                                                                        );
                                                                                        callback(
                                                                                                mappedKey,
                                                                                                "released",
                                                                                        );
                                                                                }

                                                                                // Update last pressed state
                                                                                lastPressedState =
                                                                                        isPressed;
                                                                        },
                                                                );
                                                        },
                                                );
                                        },
                                );
                        },
                );
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
                                console.log(
                                        "Scene is disposed. Exiting action.",
                                );
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
                                console.log(
                                        "Error while running action:",
                                        error,
                                );
                        } finally {
                                isActionRunning = false;
                                if (!isDisposed) {
                                        flock.scene.onBeforeRenderObservable.addOnce(
                                                runAction,
                                        );
                                }
                        }
                };

                flock.scene.onBeforeRenderObservable.addOnce(runAction);
                // Handle scene disposal
                const disposeHandler = () => {
                        if (isDisposed) {
                                console.log(
                                        "Dispose handler already triggered.",
                                );
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
                flock.initialize()
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
                                console.error(
                                        "Error initializing flock:",
                                        error,
                                );
                        });
        }
}

window.setBPM = flockSound.setBPM;
window.updateListenerPositionAndOrientation =
        flockSound.updateListenerPositionAndOrientation;
window.speak = flockSound.speak;
