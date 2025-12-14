// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as acorn from "acorn";
import * as walk from "acorn-walk";
import HavokPhysics from "@babylonjs/havok";
import * as BABYLON from "@babylonjs/core";
import * as BABYLON_GUI from "@babylonjs/gui";
import * as BABYLON_LOADER from "@babylonjs/loaders";
import { GradientMaterial } from "@babylonjs/materials";
import * as BABYLON_EXPORT from "@babylonjs/serializers";
import { FlowGraphLog10Block, SetMaterialIDBlock } from "babylonjs";
// Point Babylon’s Draco loader at local folder for offline use
BABYLON.DracoCompression.Configuration = {
        decoder: {
                wasmUrl: "./draco/draco_wasm_wrapper_gltf.js",
                wasmBinaryUrl: "./draco/draco_decoder_gltf.wasm",
                fallbackUrl: "./draco/draco_decoder_gltf.js",
        },
};
import earcut from "earcut";
import "@fontsource/atkinson-hyperlegible-next";
import "@fontsource/atkinson-hyperlegible-next/500.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";

import "@fontsource/asap";
import "@fontsource/asap/500.css";
import "@fontsource/asap/600.css";
import { characterNames } from "./config";

const optionalBabylonDeps = { earcut, FlowGraphLog10Block, SetMaterialIDBlock };
const globalEarcutTarget =
        typeof globalThis !== "undefined" ? globalThis : undefined;
if (globalEarcutTarget) {
        Object.assign(globalEarcutTarget, optionalBabylonDeps);
}
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
import { flockXR, setFlockReference as setFlockXR } from "./api/xr";
import {
        flockControl,
        setFlockReference as setFlockControl,
} from "./api/control";
import { flockScene, setFlockReference as setFlockScene } from "./api/scene";
import { flockMesh, setFlockReference as setFlockMesh } from "./api/mesh";
import { flockCamera, setFlockReference as setFlockCamera } from "./api/camera";
import { flockEvents, setFlockReference as setFlockEvents } from "./api/events";
import { flockMath, setFlockReference as setFlockMath } from "./api/math";
import {
        flockSensing,
        setFlockReference as setFlockSensing,
} from "./api/sensing";
import { translate } from "./main/translation.js";
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
        havokAbortHandled: false,
        triggerHandlingDebug: false,
        modelPath: "./models/",
        soundPath: "./sounds/",
        imagePath: "./images/",
        texturePath: "./textures/",
        // Keep optional Babylon dependencies referenced so bundlers include them.
        optionalBabylonDeps,
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
        initialClearColor: null,
        ground: null,
        sky: null,
        GUI: null,
        EXPORT: null,
        controlsTexture: null,
        canvas: {
                pressedKeys: null,
        },
        abortController: null,
        _renderLoop: null,
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
        ...flockXR,
        ...flockControl,
        ...flockEvents,
        ...flockSensing,
        ...flockMath,
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
        maxMeshesReached() {
                const scene = flock?.scene;
                if (!scene || typeof flock.maxMeshes !== "number") return false;

                const meshCount = scene.meshes.length;
                const max = flock.maxMeshes;

                if (meshCount >= max) {
                        flock.printText?.({
                                text: translate(
                                        "max_mesh_limit_reached",
                                ).replace("{max}", max),
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

                console.log(
                        `Memory: ${used.toFixed(1)}MB used / ${total.toFixed(1)}MB allocated / ${limit.toFixed(1)}MB limit`,
                );

                // Warn if approaching limits
                const usagePercent = (used / limit) * 100;
                if (usagePercent > 80) {
                        console.warn(
                                `High memory usage: ${usagePercent.toFixed(1)}% of limit`,
                        );
                        // Show user warning in UI
                        this.printText({
                                text: translate(
                                        "high_memory_usage_warning",
                                ).replace("{percent}", usagePercent.toFixed(1)),
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
        isPhysicsMemoryAbort(error) {
                const message = `${error?.message ?? error}`.toLowerCase();
                const isWasmRuntimeError =
                        typeof WebAssembly !== "undefined" &&
                        error instanceof WebAssembly.RuntimeError;
                return (
                        message.includes("out of memory") ||
                        (isWasmRuntimeError && message.includes("abort"))
                );
        },
        handlePhysicsOutOfMemory(error) {
                if (flock.havokAbortHandled) {
                        return;
                }

                flock.havokAbortHandled = true;
                console.error(translate("physics_out_of_memory_log"), error);

                try {
                        if (flock._renderLoop) {
                                flock.engine?.stopRenderLoop(flock._renderLoop);
                        } else {
                                flock.engine?.stopRenderLoop();
                        }
                        flock.abortController?.abort();
                } catch {}

                try {
                        flock.hk?.dispose?.();
                } catch {}

                const doc = flock.document;
                if (!doc?.body) return;

                const warningId = "havok-oom-warning";
                if (doc.getElementById(warningId)) return;

                const banner = doc.createElement("div");
                banner.id = warningId;
                banner.textContent = translate(
                        "physics_out_of_memory_banner_ui",
                );
                banner.style.position = "fixed";
                banner.style.top = "0";
                banner.style.left = "0";
                banner.style.right = "0";
                banner.style.padding = "12px";
                banner.style.background = "#3b0b0b";
                banner.style.color = "#ffb3b3";
                banner.style.fontSize = "16px";
                banner.style.fontFamily = "'Asap', sans-serif";
                banner.style.zIndex = "10000";
                banner.style.textAlign = "center";
                banner.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.4)";
                banner.style.borderBottom = "2px solid #d33";

                doc.body.prepend(banner);
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
        validateUserCodeAST(src) {
                // 1) Very broad identifier blocklist (names anywhere in user code)
                const REJECT_IDENTIFIERS = new Set([
                        // dynamic code / reflection
                        "eval",
                        "Function",
                        "AsyncFunction",
                        "GeneratorFunction",
                        "Proxy",
                        "Reflect",
                        // frames & globals
                        "window",
                        "document",
                        "globalThis",
                        "self",
                        "parent",
                        "top",
                        "frames",
                        "frameElement",
                        // navigation & env
                        "location",
                        "history",
                        "navigator",
                        "opener",
                        // network / ipc
                        "fetch",
                        "XMLHttpRequest",
                        "WebSocket",
                        "EventSource",
                        "postMessage",
                        "MessageChannel",
                        "MessagePort",
                        "BroadcastChannel",
                        // workers & worklets
                        "Worker",
                        "SharedWorker",
                        "ServiceWorker",
                        "Worklet",
                        "importScripts",
                        // storage / persistence
                        "localStorage",
                        "sessionStorage",
                        "indexedDB",
                        "caches",
                        "cookieStore",
                        // file/blob/crypto
                        "Blob",
                        "File",
                        "FileReader",
                        "crypto",
                        // urls & media constructors
                        "URL",
                        "URLSearchParams",
                        "Image",
                        "Audio",
                        "RTCPeerConnection",
                        "MediaDevices",
                        "Notification",
                        // popups / UI
                        "open",
                        "alert",
                        "confirm",
                        "prompt",
                        "print",
                        "showModalDialog",
                        // timers (we’ll also do special checks)
                        "setTimeout",
                        "setInterval",
                        "setImmediate",
                        "queueMicrotask",
                        // module-ish
                        "require",
                ]);

                // 2) Callees we never allow (even if shadowed)
                const REJECT_CALLEES = new Set([
                        "eval",
                        "Function",
                        "AsyncFunction",
                        "GeneratorFunction",
                        "setTimeout",
                        "setInterval",
                        "setImmediate",
                        "queueMicrotask",
                        "open",
                        "alert",
                        "confirm",
                        "prompt",
                        "print",
                ]);

                // 3) Member/property names that are escape hatches
                const REJECT_PROPERTIES = new Set([
                        "constructor",
                        "__proto__",
                        "prototype",
                        "caller",
                        "callee",
                        "arguments",
                ]);
                const ast = acorn.parse(src, {
                        ecmaVersion: "latest",
                        sourceType: "script",
                        allowAwaitOutsideFunction: true,
                        locations: false,
                });

                walk.simple(ast, {
                        // Syntax we never allow
                        WithStatement() {
                                throw new Error("with() not allowed");
                        },
                        DebuggerStatement() {
                                throw new Error("debugger not allowed");
                        },
                        ImportDeclaration() {
                                throw new Error(
                                        "import declarations not allowed",
                                );
                        },
                        ExportNamedDeclaration() {
                                throw new Error("export not allowed");
                        },
                        ExportDefaultDeclaration() {
                                throw new Error("export not allowed");
                        },
                        ImportExpression() {
                                throw new Error("dynamic import() not allowed");
                        },
                        MetaProperty(n) {
                                if (n.meta?.name === "import")
                                        throw new Error(
                                                "import.meta not allowed",
                                        );
                        },

                        // Any usage of these identifiers anywhere
                        Identifier(n) {
                                if (REJECT_IDENTIFIERS.has(n.name)) {
                                        throw new Error(
                                                `Identifier '${n.name}' is not allowed`,
                                        );
                                }
                        },

                        // Ban .constructor / .__proto__ / .prototype / .caller / .callee / .arguments
                        MemberExpression(n) {
                                // foo.bar
                                if (
                                        !n.computed &&
                                        n.property?.type === "Identifier" &&
                                        REJECT_PROPERTIES.has(n.property.name)
                                ) {
                                        throw new Error(
                                                `Access to '.${n.property.name}' is not allowed`,
                                        );
                                }
                                // foo["constructor"]
                                if (
                                        n.computed &&
                                        n.property?.type === "Literal" &&
                                        typeof n.property.value === "string" &&
                                        REJECT_PROPERTIES.has(n.property.value)
                                ) {
                                        throw new Error(
                                                `Access to '["${n.property.value}"]' is not allowed`,
                                        );
                                }
                        },

                        // Disallow dangerous callees; forbid string-eval timers
                        CallExpression(n) {
                                const callee = n.callee;
                                const name =
                                        callee?.type === "Identifier"
                                                ? callee.name
                                                : callee?.type ===
                                                            "MemberExpression" &&
                                                    !callee.computed &&
                                                    callee.property?.type ===
                                                            "Identifier"
                                                  ? callee.property.name
                                                  : null;

                                if (name && REJECT_CALLEES.has(name)) {
                                        // Special case: timers with string as first arg (string-eval)
                                        if (
                                                (name === "setTimeout" ||
                                                        name ===
                                                                "setInterval") &&
                                                n.arguments[0]?.type ===
                                                        "Literal" &&
                                                typeof n.arguments[0].value ===
                                                        "string"
                                        ) {
                                                throw new Error(
                                                        "String-eval timers are not allowed",
                                                );
                                        }
                                        // Block all the listed callees regardless
                                        throw new Error(
                                                `Call to '${name}()' is not allowed`,
                                        );
                                }
                        },

                        // new Function(), new Worker(), etc.
                        NewExpression(n) {
                                const callee = n.callee;
                                const name =
                                        callee?.type === "Identifier"
                                                ? callee.name
                                                : null;
                                if (
                                        name &&
                                        (REJECT_CALLEES.has(name) ||
                                                REJECT_IDENTIFIERS.has(name))
                                ) {
                                        throw new Error(
                                                `'new ${name}()' is not allowed`,
                                        );
                                }
                        },
                });
        },
        async runCode(code) {
                try {
                        flock.validateUserCodeAST(code);
                        await flock.disposeOldScene();

                        // --- remove any existing iframe ---
                        const oldIframe =
                                document.getElementById("flock-iframe");
                        if (oldIframe) {
                                try {
                                        await oldIframe.contentWindow?.flock?.disposeOldScene?.();
                                } catch {
                                        /* ignore cleanup errors */
                                }
                                try {
                                        oldIframe.onload = oldIframe.onerror =
                                                null;
                                } catch {
                                        /* ignore cleanup errors */
                                }
                                try {
                                        oldIframe.src = "about:blank";
                                } catch {
                                        /* ignore cleanup errors */
                                }
                                try {
                                        oldIframe.remove();
                                } catch {
                                        /* ignore cleanup errors */
                                }
                        }

                        // --- create fresh same-origin iframe ---
                        const { win, doc } = await flock.replaceSandboxIframe({
                                id: "flock-iframe",
                                sameOrigin: true,
                        });

                        // --- load SES text in parent and inject inline into iframe (CSP allows inline) ---
                        const sesResp = await fetch(
                                "vendor/ses/lockdown.umd.min.js",
                        );
                        if (!sesResp.ok)
                                throw new Error(
                                        `Failed to fetch SES: ${sesResp.status}`,
                                );
                        const sesText = await sesResp.text();
                        const sesScript = doc.createElement("script");
                        sesScript.type = "text/javascript";
                        sesScript.text = sesText;
                        doc.head.appendChild(sesScript);

                        // lockdown the iframe realm
                        win.lockdown();

                        // initialise scene
                        await this.initializeNewScene?.();
                        if (this.memoryDebug) this.startMemoryMonitoring?.();

                        // abort plumbing
                        this.__runToken = (this.__runToken || 0) + 1;
                        const runToken = this.__runToken;
                        this.abortController?.abort?.();
                        this.abortController = new AbortController();
                        const signal = this.abortController.signal;
                        const guard =
                                (fn) =>
                                (...args) => {
                                        if (
                                                signal.aborted ||
                                                runToken !== this.__runToken
                                        )
                                                return;
                                        return fn(...args);
                                };

                        const whitelist = this.createWhitelist({
                                win,
                                signal,
                                guard,
                        });

                        // Create an endowments object in the iframe's realm
                        const endowments = new win.Object();

                        for (const [key, value] of Object.entries(whitelist)) {
                                const t = typeof value;
                                if (t === "function") {
                                        // Bind to null so we don't leak host `this`
                                        endowments[key] = value.bind(null);
                                } else if (
                                        value == null ||
                                        (t !== "object" && t !== "symbol")
                                ) {
                                        // primitives only
                                        endowments[key] = value;
                                } else {
                                        // skip complex objects (meshes, DOM nodes, etc). Expose via functions instead.
                                }
                        }

                        endowments.performance = {
                                now: win.performance.now.bind(win.performance),
                        };

                        endowments.requestAnimationFrame =
                                win.requestAnimationFrame.bind(win);

                        endowments.Date = { now: win.Date.now.bind(win.Date) };

                        // Undefine unwanted globals
                        // --- shadow unsafe / unneeded globals ---
                        const toUndefine = [
                                // Host / DOM / cross-frame
                                "flock",
                                "window",
                                "self",
                                "globalThis",
                                "parent",
                                "top",
                                "frames",
                                "opener",
                                "frameElement",
                                "document",

                                // SES meta
                                "lockdown",
                                "harden",
                                "Compartment",

                                // Legacy / GC / crypto
                                "escape",
                                "unescape",
                                "FinalizationRegistry",
                                "WeakRef",
                                "crypto",

                                // Dynamic code creation
                                "eval",
                                "Function",
                                "AsyncFunction",
                                "GeneratorFunction",
                                "AsyncGeneratorFunction",

                                // Threads / native
                                "SharedArrayBuffer",
                                "Atomics",
                                "WebAssembly",

                                // Workers & messaging
                                "Worker",
                                "SharedWorker",
                                "MessageChannel",
                                "BroadcastChannel",
                                "queueMicrotask",

                                // Network / storage / env
                                "fetch",
                                "XMLHttpRequest",
                                "navigator",
                                "location",
                                "localStorage",
                                "sessionStorage",
                                "indexedDB",
                                "caches",

                                // UX
                                "Notification",

                                //Events
                                "addEventListener",
                                "removeEventListener",
                                "dispatchEvent",
                        ];

                        for (const k of toUndefine) endowments[k] = undefined;

                        for (const key of toUndefine) {
                                endowments[key] = undefined;
                        }

                        Object.freeze(endowments);

                        // Wrap user code to allow top-level await
                        /*const wrapped =
                                '(async () => {\n"use strict";\n' +
                                code +
                                "\n})()\n//# sourceURL=user-code.js";*/

                        const wrapped =
                                '(async function () {\n"use strict";\n' +
                                code +
                                "\n}).call(undefined)\n//# sourceURL=user-code.js";

                        // Evaluate in SES Compartment
                        const c = new win.Compartment(endowments);

                        const MAX_MS = 5000;
                        const hostSetTimeout = window.setTimeout.bind(window);
                        await Promise.race([
                                c.evaluate(wrapped),
                                new Promise((_, rej) =>
                                        hostSetTimeout(
                                                () =>
                                                        rej(
                                                                new Error(
                                                                        "User code timed out",
                                                                ),
                                                        ),
                                                MAX_MS,
                                        ),
                                ),
                        ]);

                        // focus canvas if present
                        (
                                document.getElementById("renderCanvas") ||
                                doc.getElementById("renderCanvas")
                        )?.focus();
                } catch (error) {
                        const enhancedError =
                                this.createEnhancedError?.(error, code) ??
                                error;
                        console.error("Enhanced error details:", enhancedError);

                        this.printText?.({
                                text: translate(
                                        "runtime_error_message",
                                ).replace("{message}", error.message),
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
        createWhitelist({ win, signal, guard } = {}) {
                // --- Bind realm-scoped primitives (fallback to parent if win missing) ---
                const raf =
                        win?.requestAnimationFrame?.bind(win) ??
                        window.requestAnimationFrame.bind(window);
                const caf =
                        win?.cancelAnimationFrame?.bind(win) ??
                        window.cancelAnimationFrame.bind(window);

                // RAF-based nextTick tied to the iframe realm
                const nextFrame = () =>
                        new Promise((resolve, reject) => {
                                if (signal?.aborted) {
                                        return reject(
                                                new DOMException(
                                                        "Aborted",
                                                        "AbortError",
                                                ),
                                        );
                                }
                                const id = raf(() => resolve());
                                const onAbort = () => {
                                        try {
                                                caf(id);
                                        } catch {
                                                /* ignore animation cancel errors */
                                        }
                                        reject(
                                                new DOMException(
                                                        "Aborted",
                                                        "AbortError",
                                                ),
                                        );
                                };
                                signal?.addEventListener?.("abort", onAbort, {
                                        once: true,
                                });
                        });

                const api = {
                        // Per-run helpers
                        nextFrame,
                        isAborted: () => !!signal?.aborted,

                        // Flock API methods — bound to host `this`
                        initialize: this.initialize?.bind(this),
                        createEngine: this.createEngine?.bind(this),
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
                        setSky: this.setSky?.bind(this),
                        lightIntensity: this.lightIntensity?.bind(this),
                        lightColor: this.lightColor?.bind(this),
                        buttonControls: this.buttonControls?.bind(this),
                        getCamera: this.getCamera?.bind(this),
                        getMainLight: this.getMainLight?.bind(this),
                        cameraControl: this.cameraControl?.bind(this),
                        setCameraBackground:
                                this.setCameraBackground?.bind(this),
                        setXRMode: this.setXRMode?.bind(this),
                        applyForce: this.applyForce?.bind(this),
                        moveByVector: this.moveByVector?.bind(this),
                        glideTo: this.glideTo?.bind(this),
                        glideToObject: this.glideToObject?.bind(this),
                        wait: this.wait?.bind(this),
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
                        setAnchor: this.setAnchor?.bind(this),
                        rotate: this.rotate?.bind(this),
                        lookAt: this.lookAt?.bind(this),
                        moveTo: this.moveTo?.bind(this),
                        rotateTo: this.rotateTo?.bind(this),
                        rotateAnim: this.rotateAnim?.bind(this),
                        animateProperty: this.animateProperty?.bind(this),
                        positionAt: this.positionAt?.bind(this),
                        positionAtSingleCoordinate:
                                this.positionAtSingleCoordinate?.bind(this),
                        distanceTo: this.distanceTo?.bind(this),
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
                        actionPressed: this.actionPressed?.bind(this),
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
                        moveForward: this.moveForward?.bind(this),
                        moveSideways: this.moveSideways?.bind(this),
                        strafe: this.strafe?.bind(this),
                        attachCamera: this.attachCamera?.bind(this),
                        canvasControls: this.canvasControls?.bind(this),
                        setPhysics: this.setPhysics?.bind(this),
                        setPhysicsShape: this.setPhysicsShape?.bind(this),
                        showPhysics: this.showPhysics?.bind(this),
                        checkMeshesTouching:
                                this.checkMeshesTouching?.bind(this),
                        say: this.say?.bind(this),
                        onTrigger: this.onTrigger?.bind(this),
                        onEvent: this.onEvent?.bind(this),
                        broadcastEvent: this.broadcastEvent?.bind(this),
                        start: this.start?.bind(this),
                        forever: this.forever?.bind(this),
                        whenActionEvent: this.whenActionEvent?.bind(this),
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
                        createVector3: this.createVector3?.bind(this),
                };

                // Guard side-effecting APIs so stale runs no-op
                const SIDE_EFFECT_APIS = [
                        "printText",
                        "UIText",
                        "UIButton",
                        "UIInput",
                        "UISlider",
                        "say",
                        "highlight",
                        "glow",
                        "createParticleEffect",
                        "startParticleSystem",
                        "stopParticleSystem",
                        "resetParticleSystem",
                        "playSound",
                        "stopAllSounds",
                        "speak",
                        "broadcastEvent",
                        "onEvent",
                        "onTrigger",
                        "start",
                        "forever",
                        "canvasControls",
                        "buttonControls",
                        "cameraControl",
                        "attachCamera",
                        "setSky",
                        "setFog",
                        "setCameraBackground",
                        "lightIntensity",
                        "lightColor",
                        "create3DText",
                        "createModel",
                        "createBox",
                        "createSphere",
                        "createCylinder",
                        "createCapsule",
                        "createPlane",
                        "mergeMeshes",
                        "subtractMeshes",
                        "intersectMeshes",
                        "createHull",
                        "dispose",
                        "clearEffects",
                        "stopAnimations",
                ];
                for (const name of SIDE_EFFECT_APIS) {
                        if (typeof api[name] === "function")
                                api[name] = guard(api[name]);
                }

                // Avoid hard errors if freezing fails in some environments
                try {
                        return Object.freeze(api);
                } catch {
                        return api;
                }
        },
        async replaceSandboxIframe({
                id = "flock-iframe",
                sameOrigin = true,
                srcdocHtml,
        } = {}) {
                const old = document.getElementById(id);

                // --- 1) Hard teardown of the old iframe (if any) ---
                if (old) {
                        try {
                                // Detach handlers first
                                old.onload = null;
                                old.onerror = null;

                                // Best-effort stop inside the old realm
                                const w = old.contentWindow;
                                try {
                                        w?.cancelAnimationFrame?.(w.__raf);
                                } catch {
                                        /* ignore teardown errors */
                                }
                                try {
                                        w?.stop?.();
                                } catch {
                                        /* ignore teardown errors */
                                        // stops loading
                                }
                                try {
                                        w?.close?.();
                                } catch {
                                        /* ignore teardown errors */
                                        // some browsers free resources
                                }

                                // Navigate to a harmless page to break references, then remove
                                try {
                                        old.src = "about:blank";
                                } catch {
                                        /* ignore teardown errors */
                                }
                        } finally {
                                // Remove from DOM to release the realm
                                old.remove?.();
                        }
                }

                // --- 2) Create a brand-new iframe (fresh realm) ---
                const iframe = document.createElement("iframe");
                iframe.id = id;
                iframe.style.display = "none";

                // Keep same-origin only if you need to touch iframe DOM/Canvas/WebGL from parent
                iframe.sandbox = `allow-scripts${sameOrigin ? " allow-same-origin" : ""}`;

                // Prefer srcdoc so CSP is present before any script runs
                const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'`;
                const html =
                        srcdocHtml ??
                        `<!doctype html>
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <canvas id="renderCanvas"></canvas>`;

                // Attach to DOM before setting src/srcdoc to ensure load events fire consistently
                document.body.appendChild(iframe);

                // Load and await readiness
                await new Promise((resolve, reject) => {
                        iframe.onload = () => {
                                iframe.onload = iframe.onerror = null;
                                resolve();
                        };
                        iframe.onerror = () => {
                                iframe.onload = iframe.onerror = null;
                                reject(new Error("iframe failed to load"));
                        };
                        // Use srcdoc when possible; fallback to about:blank + injected head if needed
                        try {
                                iframe.srcdoc = html;
                        } catch {
                                iframe.src = "about:blank";
                        }
                });

                // If we fell back to about:blank, inject CSP meta now (runs before user code anyway)
                if (
                        !("srcdoc" in document.createElement("iframe")) ||
                        !iframe.srcdoc
                ) {
                        const doc =
                                iframe.contentDocument ||
                                iframe.contentWindow?.document;
                        if (!doc.head)
                                doc.documentElement.appendChild(
                                        doc.createElement("head"),
                                );
                        const meta = doc.createElement("meta");
                        meta.httpEquiv = "Content-Security-Policy";
                        meta.content = csp;
                        doc.head.appendChild(meta);
                }

                const win = iframe.contentWindow;
                const doc = iframe.contentDocument || win?.document;
                if (!win || !doc) throw new Error("New iframe is unavailable");

                return { iframe, win, doc };
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
        setupGamepadCameraControls() {
                if (!flock.scene) {
                        return;
                }

                const deadZone = 0.2;
                const yawSpeed = 2.5;
                const pitchSpeed = 2.0;

                if (flock._gamepadCameraObserver) {
                        flock.scene.onBeforeRenderObservable.remove(
                                flock._gamepadCameraObserver,
                        );
                        flock._gamepadCameraObserver = null;
                }

                flock._gamepadCameraObserver =
                        flock.scene.onBeforeRenderObservable.add(() => {
                                if (!navigator.getGamepads) {
                                        return;
                                }

                                const gamepads = navigator.getGamepads() || [];
                                const gamepad = gamepads.find((pad) => pad);

                                if (!gamepad) {
                                        return;
                                }

                                const [, , rawRightX = 0, rawRightY = 0] =
                                        gamepad.axes || [];

                                const rightX =
                                        Math.abs(rawRightX) > deadZone
                                                ? rawRightX
                                                : 0;
                                const rightY =
                                        Math.abs(rawRightY) > deadZone
                                                ? rawRightY
                                                : 0;

                                const leftShoulder = gamepad.buttons?.[4];
                                const rightShoulder = gamepad.buttons?.[5];
                                const normalizeShoulder = (button) =>
                                        Boolean(
                                                button?.pressed ||
                                                        button?.value > 0.5,
                                        );
                                const shoulderTurn =
                                        (normalizeShoulder(rightShoulder)
                                                ? 1
                                                : 0) -
                                        (normalizeShoulder(leftShoulder)
                                                ? 1
                                                : 0);

                                const yawInput = rightX + shoulderTurn;

                                if (!yawInput && !rightY) {
                                        return;
                                }

                                const camera = flock.scene.activeCamera;

                                if (!camera) {
                                        return;
                                }

                                const deltaTime =
                                        (flock.engine?.getDeltaTime?.() ?? 16) /
                                        1000;
                                const yawDelta =
                                        yawInput * yawSpeed * deltaTime;
                                const pitchDelta =
                                        rightY * pitchSpeed * deltaTime;

                                const cameraType = camera.getClassName?.();

                                if (cameraType === "ArcRotateCamera") {
                                        camera.alpha -= yawDelta;
                                        camera.beta -= pitchDelta;

                                        const lowerBeta =
                                                camera.lowerBetaLimit ?? 0.01;
                                        const upperBeta =
                                                camera.upperBetaLimit ??
                                                Math.PI - 0.01;

                                        camera.beta = Math.min(
                                                upperBeta,
                                                Math.max(
                                                        lowerBeta,
                                                        camera.beta,
                                                ),
                                        );
                                } else {
                                        camera.rotation.y += yawDelta;
                                        camera.rotation.x += pitchDelta;

                                        const minPitch = -Math.PI / 2 + 0.01;
                                        const maxPitch = Math.PI / 2 - 0.01;

                                        camera.rotation.x = Math.min(
                                                maxPitch,
                                                Math.max(
                                                        minPitch,
                                                        camera.rotation.x,
                                                ),
                                        );
                                }
                        });
        },
        setupGamepadButtonMapping() {
                if (!flock.scene) {
                        return;
                }

                if (flock._gamepadButtonObserver) {
                        flock.scene.onBeforeRenderObservable.remove(
                                flock._gamepadButtonObserver,
                        );
                        flock._gamepadButtonObserver = null;
                }

                const buttonToKeys = {
                        0: [" ", "SPACE"], // Bottom face button (A/Cross) -> Space
                        1: ["e", "E"], // Right face button (B/Circle) -> E
                        2: ["f", "F"], // Left face button (X/Square) -> F
                        3: ["r", "R"], // Top face button (Y/Triangle) -> R
                };

                const normalizeButtonState = (button) => {
                        if (!button) return false;
                        return Boolean(button.pressed || button.value > 0.5);
                };

                const trackedGamepadKeys = new Set();

                flock._gamepadButtonObserver =
                        flock.scene.onBeforeRenderObservable.add(() => {
                                if (!navigator.getGamepads) {
                                        return;
                                }

                                const pressedButtons =
                                        flock.canvas.pressedButtons;
                                const nextGamepadKeys = new Set();

                                const gamepads = navigator.getGamepads() || [];
                                const gamepad = gamepads.find((pad) => pad);

                                if (gamepad) {
                                        Object.entries(buttonToKeys).forEach(
                                                ([index, keys]) => {
                                                        const button =
                                                                gamepad
                                                                        .buttons?.[
                                                                        Number(
                                                                                index,
                                                                        )
                                                                ];
                                                        const isPressed =
                                                                normalizeButtonState(
                                                                        button,
                                                                );

                                                        if (isPressed) {
                                                                keys.forEach(
                                                                        (k) =>
                                                                                nextGamepadKeys.add(
                                                                                        k,
                                                                                ),
                                                                );
                                                        }
                                                },
                                        );
                                }

                                // Remove only the keys that previously came from
                                // the gamepad but are no longer active.
                                trackedGamepadKeys.forEach((key) => {
                                        if (!nextGamepadKeys.has(key)) {
                                                pressedButtons.delete(key);
                                        }
                                });

                                // Add the currently active gamepad keys without
                                // disturbing other input sources (e.g. touch).
                                nextGamepadKeys.forEach((key) =>
                                        pressedButtons.add(key),
                                );

                                trackedGamepadKeys.clear();
                                nextGamepadKeys.forEach((key) =>
                                        trackedGamepadKeys.add(key),
                                );
                        });
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
                                }

                                // Stop all sounds and animations first
                                flock.stopAllSounds();
                                flock.engine?.stopRenderLoop();

                                if (flock._gamepadCameraObserver) {
                                        flock.scene.onBeforeRenderObservable.remove(
                                                flock._gamepadCameraObserver,
                                        );
                                        flock._gamepadCameraObserver = null;
                                }

                                if (flock._gamepadButtonObserver) {
                                        flock.scene.onBeforeRenderObservable.remove(
                                                flock._gamepadButtonObserver,
                                        );
                                        flock._gamepadButtonObserver = null;
                                }

                                try {
                                        const canvas =
                                                flock.engine?.getRenderingCanvas?.();
                                        flock.scene?.activeCamera?.detachControl?.(
                                                canvas,
                                        );
                                        flock.scene?.detachControl?.();
                                } catch {
                                        /* ignore scene cleanup errors */
                                }

                                try {
                                        const containers = Array.isArray(
                                                flock._assetContainers,
                                        )
                                                ? flock._assetContainers
                                                : [];
                                        for (const c of containers) {
                                                try {
                                                        c?.dispose?.();
                                                } catch {
                                                        /* ignore asset disposal errors */
                                                }
                                        }
                                        flock._assetContainers = [];
                                } catch {
                                        /* ignore asset container cleanup errors */
                                }

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
                                                } catch {
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
                flock.havokAbortHandled = false;
                flock.disposed = false;

                const existingOomBanner =
                        flock.document?.getElementById("havok-oom-warning");
                existingOomBanner?.remove?.();

                // Create the new scene
                flock.scene = new flock.BABYLON.Scene(flock.engine);

                flock._renderLoop = () => {
                        try {
                                flock.scene.render();
                        } catch (error) {
                                if (flock.isPhysicsMemoryAbort(error)) {
                                        flock.handlePhysicsOutOfMemory(error);
                                        return;
                                }
                                throw error;
                        }
                };

                // Apply and remember the app's default clear colour so it can be
                // restored if the user removes their sky/background blocks later.
                const defaultClearColor =
                        flock.BABYLON.Color3.FromHexString("#33334c");
                flock.scene.clearColor =
                        defaultClearColor.clone?.() ?? defaultClearColor;
                flock.initialClearColor =
                        defaultClearColor.clone?.() ?? defaultClearColor;

                // Abort controller for clean-up
                flock.abortController = new AbortController();

                // Start the render loop
                flock.engine.runRenderLoop(flock._renderLoop);

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
                setFlockXR(flock);
                setFlockMath(flock);
                setFlockControl(flock);
                setFlockEvents(flock);
                setFlockSensing(flock);

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
                flock.setupGamepadCameraControls();
                flock.setupGamepadButtonMapping();
                // Set up lighting
                const hemisphericLight = new flock.BABYLON.HemisphericLight(
                        "hemisphericLight",
                        new flock.BABYLON.Vector3(0, 3, 0),
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

                flock.buttonControls("BOTH", "AUTO", "#ffffff");

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
                                } else if (meshId === "__main_light__") {
                                        yield flock.mainLight;
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
                let rejectP;
                const promise = new Promise((resolve, reject) => {
                        resolveP = resolve;
                        rejectP = reject;
                });

                // The callback often does async setup (e.g. awaiting materials,
                // loading textures, or chaining other whenModelReady calls).
                // Await it so the readiness promise only resolves once that
                // user-provided async work is finished.
                const settle = async (val) => {
                        if (settled) return;
                        settled = true;
                        try {
                                // Await the callback so the readiness promise doesn't resolve
                                // before user async work completes (premature resolution).
                                if (typeof callback === "function")
                                        await callback(val);
                                resolveP(val);
                        } catch (error) {
                                rejectP(error);
                        }
                };

                // Helper: locate current object
                const locate = () => {
                        const scene = flock.scene;
                        if (!scene) return null;
                        if (id === "__active_camera__")
                                return scene.activeCamera ?? null;
                        if (id === "__main_light__")
                                return flock.mainLight ?? null;

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
                                        void settle(existing);
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
                                const finish = async (target /*, source */) => {
                                        if (done) return;
                                        done = true;
                                        try {
                                                if (!signal?.aborted)
                                                        await settle(target);
                                        } finally {
                                                while (disposers.length) {
                                                        try {
                                                                disposers.pop()();
                                                        } catch {
                                                                /* ignore disposer errors */
                                                        }
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
                                                await settle(undefined);
                                                return;
                                        }
                                        if (target) await settle(target);
                                        return;
                                }
                        } catch (err) {
                                if (flock.abortController?.signal?.aborted) {
                                        // resolve undefined on abort
                                        await settle(undefined);
                                } else {
                                        console.error(
                                                `Error in whenModelReady for '${id}':`,
                                                err,
                                        );
                                        // resolve undefined on error to prevent hangs
                                        await settle(undefined);
                                }
                        }
                })();

                return promise; // <— important: always return the promise
        },
        announceMeshReady(meshName, groupName) {
                //console.log(`[flock] Mesh ready: ${meshName} (group: ${groupName})`);

                const getGroupRoot = (name) =>
                        name.includes("__")
                                ? name.split("__")[0]
                                : name.split("_")[0];

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
                                        (m) =>
                                                getGroupRoot(m.name) ===
                                                groupName,
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

        // Runtime helper
        sanitizeInlineText(input) {
                return String(input)
                        .replace(/\r?\n/g, " ")
                        .replace(/\*\//g, "*∕")
                        .replace(/\/\//g, "∕∕")
                        .replace(/`/g, "ˋ");
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

window.onload = async function () {
        const scriptElement = document.getElementById("flock");
        if (scriptElement) {
                console.log("Standalone Flock 🐦");
                initializeFlock();
                // Hide loading screen after a short delay for standalone flock
                setTimeout(hideLoadingScreen, 1000);
                return; // standalone flock
        }
};
