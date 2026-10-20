import * as BABYLON from '@babylonjs/core';
import * as BABYLON_GUI from '@babylonjs/gui/2D/index.js';
import * as BABYLON_EXPORT from '@babylonjs/serializers';
import { flockRuntimeUrl } from './urls.js';
import { getManifold } from '../api/shapes';
import { releaseShape } from '../api/physics.js';
import {
  getMicrobitManager,
  setFlockReference as setFlockMicrobitManager,
} from '../microbit/manager.js';
import { translate } from '../main/translation.js';
import { handleError, dismissBanner, showBanner, markReported } from '../ui/notifications.js';
import { attachInteractIndicator, detachInteractIndicator } from '../ui/interactIndicator.js';
import { InputManager } from '../input/inputManager.js';
import { KeyboardSource } from '../input/keyboardSource.js';
import { OnScreenSource } from '../input/onScreenSource.js';
import { GamepadSource } from '../input/gamepadSource.js';
import { CameraControls } from '../input/cameraControls.js';
import { getBoundKeys } from '../input/bindings.js';
import {
  enableSceneDescription,
  announceSayText,
  announceObjectSay,
  getObjectLabel,
  recordObjectPromptText,
  recordObjectSayText,
  setTransientSayText,
  recordWorldInstructionText,
} from '../accessibility/accessibility.js';
import { initUIAccessibility, clearUIControls } from '../accessibility/uiA11y.js';

const MAX_RENDER_PIXELS = 2560 * 1440;

function isRenderResolutionCapEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('capResolution') === '1';
  } catch {
    return false;
  }
}

function renderPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = (window.screen?.width || 0) * (window.screen?.height || 0);
  if (!isRenderResolutionCapEnabled() || !screenPixels) return dpr;
  return Math.max(1, Math.min(dpr, Math.sqrt(MAX_RENDER_PIXELS / screenPixels)));
}

function watchPixelRatio(onChange) {
  const query = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
  query?.addEventListener(
    'change',
    () => {
      onChange();
      watchPixelRatio(onChange);
    },
    { once: true }
  );
}

function keepHoverCursorCurrent(scene) {
  scene.constantlyUpdateMeshUnderPointer = true;
  const move = BABYLON.PointerEventTypes.POINTERMOVE;
  let overlayHasPointer = false;
  scene.onPrePointerObservable.add(() => (overlayHasPointer = true), move);
  scene.onPointerObservable.add(() => (overlayHasPointer = false), move);
  let wanted = null;
  const applyCursor = () => {
    const canvas = scene.getEngine().getInputElement();
    if (!canvas || scene.doNotHandleCursors || overlayHasPointer) return;
    const paused = flock?.isPaused?.();
    const manager = paused ? null : scene.meshUnderPointer?._getActionManagerForTrigger();
    const cursor = manager?.hasPointerTriggers
      ? manager.hoverCursor || scene.hoverCursor
      : scene.defaultCursor;
    if (cursor === wanted && !paused) return;
    wanted = cursor;
    if (canvas.style.cursor !== 'none') canvas.style.cursor = cursor;
  };
  scene.onPointerObservable.add(() => {
    if (flock?.isPaused?.()) applyCursor();
  }, move);
  scene.onAfterRenderObservable.add(applyCursor);
}

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockLifecycle = {
  async initialize() {
    flock.BABYLON = BABYLON;
    flock.GUI = BABYLON_GUI;
    flock.EXPORT = BABYLON_EXPORT;
    flock.document = document;
    flock.canvas = flock.document.getElementById('renderCanvas');
    // Make canvas focusable for keyboard events
    flock.canvas.tabIndex = -1;
    initUIAccessibility(flock.canvas);
    //flock.canvas.setAttribute("aria-label", "Flock 3D world canvas");
    flock.scene = null;
    flock.ground = null;
    flock.sky = null;
    flock.engineReady = false;
    flock.inputManager = new InputManager();
    flock._onScreenSource = new OnScreenSource(flock.inputManager, { target: flock.canvas });

    // micro:bit events also pulse the key pipeline as a momentary edge, so
    // "any"-device micro:bit blocks (and legacy projects, which generate
    // whenKeyEvent) respond to boards connected over WebUSB.
    if (!flock._microbitKeySinkAttached) {
      flock._microbitKeySinkAttached = true;
      setFlockMicrobitManager(flock); // lets the manager read flock.microbitDebug
      const microbitManager = getMicrobitManager();
      microbitManager.onAnyEvent((char) => {
        flock.inputManager?._setKey(char, true);
        flock.inputManager?._setKey(char, false);
      });
      // Silently reconnect known boards (navigator.usb.getDevices) and watch
      // for replugs. No-op where WebUSB is unavailable.
      microbitManager.init();
    }
    flock.displayScale = renderPixelRatio() * 0.75;
    flock.BABYLON.Database.IDBStorageEnabled = true;
    flock.BABYLON.Engine.CollisionsEpsilon = 0.00005;
    await flock.document.fonts.ready; // Wait for all fonts to be loaded
    flock.abortController = new AbortController();

    try {
      const manifoldWasm = await getManifold(flockRuntimeUrl('wasm/manifold.wasm'));
      await flock.BABYLON.InitializeCSG2Async({
        manifoldInstance: manifoldWasm.Manifold,
        manifoldMeshInstance: manifoldWasm.Mesh,
      });
    } catch (error) {
      // CSG2 powers only boolean mesh blocks; the rest of the app still works.
      console.warn('CSG2 unavailable; mesh boolean blocks are disabled.', error);
    }

    flock.canvas.addEventListener(
      'touchend',
      (event) => {
        if (event.touches.length === 0) {
          // Canvas is touchable before the first run and after disposal, when
          // there is no scene yet.
          const camera = flock.scene?.activeCamera;
          const input = camera?.inputs?.attached?.pointers;
          if (
            input &&
            (input._pointA !== null || input._pointB !== null || input._isMultiTouch === true)
          ) {
            flock._hardResetCameraControls(camera, {
              reattachDelayMs: 100,
              noPreventDefault: true,
            });
          }
        }
      },
      { passive: false }
    );

    // Block synthetic on-screen key events from reaching Babylon camera plugins
    // when an ArcRotateCamera is active — physical arrow keys still work for
    // keyboard accessibility; only __flockSynthetic events are stopped.
    const _blockSyntheticForArcRotate = (e) => {
      if (
        e.__flockSynthetic &&
        flock.scene?.activeCamera instanceof flock.BABYLON.ArcRotateCamera
      ) {
        e.stopImmediatePropagation();
      }
    };
    flock.canvas.addEventListener('keydown', _blockSyntheticForArcRotate, true);
    flock.canvas.addEventListener('keyup', _blockSyntheticForArcRotate, true);

    flock._keyboardSource = new KeyboardSource(flock.inputManager, {
      target: flock.canvas,
      onBlur: () => flock._hardResetCameraControls(flock.scene?.activeCamera),
    });
    flock._keyboardSource.start();

    // Hardening for rare pointer/input desync where camera keeps moving
    // after input ends or browser focus changes.
    window.addEventListener('blur', () => {
      flock._gamepadSource?.releaseAllKeys();
      // Babylon.js bug: camera drifts after window blur; force-reset to stop it.
      flock._hardResetCameraControls(flock.scene?.activeCamera);
    });

    window.addEventListener('pointerup', () => {
      flock._hardResetCameraControls(flock.scene?.activeCamera);
    });

    // macOS suppresses keyup for keys released while ⌘ is held; Babylon's
    // camera keyboard input keeps them in _keys, so the camera would drift
    // until the next blur. Clear its held keys when ⌘ comes up.
    flock.canvas.addEventListener('keyup', (e) => {
      if (e.key !== 'Meta') return;
      const kb = flock.scene?.activeCamera?.inputs?.attached?.keyboard;
      if (kb?._keys) kb._keys.length = 0;
    });

    flock.engineReady = true;
  },
  _scheduleContextEscalation() {
    clearTimeout(flock._escalationTimer);
    flock._escalationTimer = setTimeout(() => {
      flock._escalationTimer = null;
      if (flock.engine?.isContextLost?.()) {
        handleError(new Error('WebGL context restore timeout'), {
          source: 'webgl-lost',
          fatal: true,
        });
      }
    }, 8000);
  },
  createEngine() {
    flock.engine?.dispose();
    flock.engine = null;

    try {
      flock.engine = new flock.BABYLON.Engine(flock.canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        powerPreference: 'default',
      });
    } catch (error) {
      // A device problem, not the project's. With no WebGL API at all, reloading can't help;
      // otherwise it's disabled, blocklisted or blocked after GPU crashes, which can be temporary.
      const unsupported = typeof WebGLRenderingContext === 'undefined';
      handleError(error, {
        source: unsupported ? 'webgl-unsupported' : 'webgl-unavailable',
        fatal: !unsupported,
      });
      throw markReported(error);
    }
    // Play retries a failed engine, so a temporary failure can recover without a reload.
    dismissBanner('webgl-unavailable');

    flock.engine.disableUniformBuffers = true; // Meshes with alpha black on Samsung A14

    // Set on the engine, not the element: Babylon reapplies its default on every pointer move.
    flock.engine.canvasTabIndex = 0;

    if (!flock._webglContextLostListenerAdded) {
      flock._webglContextLostListenerAdded = true;
      // Call preventDefault() on the raw event so the browser is willing to restore.
      flock.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
      });
    }

    flock.engine.onContextLostObservable.add(() => {
      flock._contextLostAt = Date.now();
      showBanner('webgl-lost', {
        message: translate('error_webgl_restoring'),
      });
      if (document.visibilityState === 'visible') {
        flock._scheduleContextEscalation();
      }
    });

    flock.engine.onContextRestoredObservable.add(() => {
      clearTimeout(flock._escalationTimer);
      flock._escalationTimer = null;
      flock._contextLostAt = null;
      dismissBanner('webgl-lost');
      flock.engine.resize();
      flock._resumeRenderLoop();
    });

    if (!flock._webglVisibilityListenerAdded) {
      flock._webglVisibilityListenerAdded = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && flock._contextLostAt) {
          flock.engine?.resize();
          if (!flock._escalationTimer) {
            flock._scheduleContextEscalation();
          }
        }
      });
    }

    if (!flock._audioFreezeListenerAdded) {
      flock._audioFreezeListenerAdded = true;
      flock.freezeEvents.addEventListener('change', () => {
        flock.syncAudioWithFreeze?.();
      });
    }

    if (!flock._renderFreezeListenerAdded) {
      flock._renderFreezeListenerAdded = true;
      flock.freezeEvents.addEventListener('change', () => {
        if (document.hidden) {
          // Stop outright rather than leaning on the browser to throttle rAF:
          // everything driven by scene.render() (physics, animations, forever,
          // waitUntil) then freezes with the clock, audio and loop yields
          // instead of crawling on in the background.
          flock.engine?.stopRenderLoop();
        } else {
          flock._resumeRenderLoop();
        }
      });
    }

    if (!flock._gameClockFreezeListenerAdded) {
      flock._gameClockFreezeListenerAdded = true;
      flock._frozenAccumMs = 0;
      flock._frozenAt = flock.isFrozen() ? Date.now() : null;
      flock.freezeEvents.addEventListener('change', () => {
        if (flock.isFrozen()) {
          flock._frozenAt ??= Date.now();
        } else if (flock._frozenAt != null) {
          flock._frozenAccumMs += Date.now() - flock._frozenAt;
          flock._frozenAt = null;
        }
      });
    }

    flock.engine.enableOfflineSupport = false;
    flock.engine.setHardwareScalingLevel(1 / renderPixelRatio());

    if (!flock._pixelRatioListenerAdded) {
      flock._pixelRatioListenerAdded = true;
      watchPixelRatio(() => flock._applyPixelRatio());
    }
  },
  _applyPixelRatio() {
    if (!flock.engine) return;
    const ratio = renderPixelRatio();
    flock.displayScale = ratio * 0.75;
    flock.engine.setHardwareScalingLevel(1 / ratio);
    flock.engine.resize();
    flock._relayoutUIControls?.();
  },
  async disposeOldScene() {
    flock.flockNotReady = true;

    if (flock.memoryDebug)
      if (flock.hk) {
        const [, stats] = flock.hk._hknp.HP_GetStatistics();

        const [
          numBodies,
          numShapes,
          numConstraints,
          numDebugGeometries,
          numWorlds,
          numQueryCollectors,
        ] = stats;

        console.log('Havok bodies:', numBodies);
        console.log('Havok shapes:', numShapes);
        console.log('Havok constraints:', numConstraints);
        console.log('Havok debug geometries:', numDebugGeometries);
        console.log('Havok worlds:', numWorlds);
        console.log('Havok query collectors:', numQueryCollectors);
        console.log(
          'Havok heap memory:',
          (flock.havokInstance.HEAPU8.buffer.byteLength / (1024 * 1024)).toFixed(2),
          'MB'
        );
      }

    if (flock.scene) {
      try {
        // Stop all sounds and animations first
        flock.stopAllSounds();
        flock.engine?.stopRenderLoop();

        if (flock.ground?.metadata) {
          const md = flock.ground.metadata;
          try {
            if (md.heightmapBody?._pluginData?.hpBodyId && flock.hk?.world) {
              flock.hk._hknp.HP_World_RemoveBody(
                flock.hk.world,
                md.heightmapBody._pluginData.hpBodyId
              );
            }
          } catch {
            /* ignore */
          }
          try {
            md.heightmapBody?.dispose();
          } catch {
            /* already disposed */
          }
          try {
            md.heightmapShape?.dispose();
          } catch {
            /* already disposed */
          }
          md.heightmapBody = null;
          md.heightmapShape = null;
        }

        flock._cameraControlBindings = null;
        flock._onScreenSource?.releaseAll();
        flock._onScreenSource?.stop();
        flock._joystickSource?.stop();
        flock._joystickSource = null;
        flock._gamepadSource?.stop();
        flock._gamepadSource = null;
        flock._xrSource?.stop();
        flock._xrSource = null;
        flock._restoreXREmbodiedVisibility?.();
        if (flock._xrViewObserver && flock._xrViewObserverScene) {
          flock._xrViewObserverScene.onBeforeRenderObservable.remove(flock._xrViewObserver);
          flock._xrViewObserver = null;
          flock._xrViewObserverScene = null;
        }
        try {
          flock.xrHelper?.dispose?.();
        } catch (error) {
          console.warn('Error disposing xrHelper:', error);
        }
        flock.xrHelper = null;
        flock.inputManager.resetActionKeys();
        detachInteractIndicator();

        flock._cameraControls?.stop();
        flock._cameraControls = null;

        if (flock._gamepadButtonObserver) {
          flock.scene.onBeforeRenderObservable.remove(flock._gamepadButtonObserver);
          flock._gamepadButtonObserver = null;
        }

        try {
          const canvas = flock.engine?.getRenderingCanvas?.();
          flock.scene?.activeCamera?.detachControl?.(canvas);
          flock.scene?.detachControl?.();
        } catch {
          /* ignore scene cleanup errors */
        }

        // Abort any ongoing operations
        if (flock.abortController) {
          flock.abortController.abort();
        }

        // Stop all animations and dispose animation groups
        flock.scene.stopAllAnimations();

        // Dispose animatables
        if (flock.scene.animatables) {
          [...flock.scene.animatables].forEach((animatable) => {
            try {
              animatable.stop();
              animatable.dispose?.();
            } catch (error) {
              console.warn('Error disposing animatable:', error);
            }
          });
        }

        // Dispose animation groups
        if (flock.scene.animationGroups) {
          [...flock.scene.animationGroups].forEach((group) => {
            if (group) {
              try {
                group.stop();
                group.dispose();
              } catch (error) {
                console.warn('Error disposing animation group:', error);
              }
            }
          });
        }

        // Clear all observables and event listeners
        flock.removeEventListeners();

        // Dispose UI elements
        flock.controlsTexture?.dispose();
        flock.controlsTexture = null;
        flock._xrHUDControlRoots = [];

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

        // Dispose sound tracks
        if (flock.scene.mainSoundTrack) {
          flock.scene.mainSoundTrack.dispose();
        }
        if (flock.scene.soundTracks) {
          flock.scene.soundTracks.forEach((track) => track?.dispose());
        }

        // Dispose post-processing effects
        if (flock.scene.postProcesses) {
          [...flock.scene.postProcesses].forEach((pp) => pp?.dispose());
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
        const particleSystems = flock.scene.particleSystems ? [...flock.scene.particleSystems] : [];
        particleSystems.forEach((system) => {
          if (system?.dispose) {
            try {
              system.dispose();
            } catch (error) {
              console.warn('Error disposing particle system:', error);
            }
          }
        });

        if (flock.scene.meshes) {
          for (const mesh of flock.scene.meshes) {
            const c = mesh?.metadata?.uprightConstraint;
            if (c) {
              try {
                c.dispose();
              } catch (e) {
                console.warn('Error disposing constraint:', e);
              }
              mesh.metadata.uprightConstraint = null;
            }
          }
        }

        // Dispose all meshes and their action managers
        const meshesToDispose = flock.scene.meshes ? [...flock.scene.meshes] : [];
        meshesToDispose.forEach((mesh) => {
          if (mesh?.actionManager) {
            try {
              mesh.actionManager.dispose();
            } catch (error) {
              console.warn('Error disposing action manager:', error);
            }
          }
          if (mesh?.material?.dispose && typeof mesh.material.dispose === 'function') {
            try {
              mesh.material.dispose();
            } catch (error) {
              console.warn('Error disposing mesh material:', error);
            }
          }
          if (mesh?.dispose && typeof mesh.dispose === 'function') {
            try {
              // Cached shapes are disposed via physicsShapeCache below
              releaseShape(mesh.physics?.shape);
              mesh.physics?.dispose();

              mesh.dispose();
            } catch (error) {
              console.warn('Error disposing mesh:', error);
            }
          }
        });

        // Dispose transform nodes
        const transformNodes = flock.scene.transformNodes ? [...flock.scene.transformNodes] : [];
        transformNodes.forEach((node) => {
          if (node?.dispose) {
            try {
              node.dispose();
            } catch (error) {
              console.warn('Error disposing transform node:', error);
            }
          }
        });

        // Dispose geometries (after meshes)
        const geometries = flock.scene.geometries ? [...flock.scene.geometries] : [];
        geometries.forEach((geometry) => {
          if (geometry?.dispose) {
            try {
              geometry.dispose();
            } catch (error) {
              console.warn('Error disposing geometry:', error);
            }
          }
        });

        // Clear camera
        if (flock.scene.activeCamera) {
          flock.scene.activeCamera.inputs?.clear();
          flock.scene.activeCamera.dispose();
        }

        // Dispose textures
        const textures = flock.scene.textures ? [...flock.scene.textures] : [];
        textures.forEach((texture) => {
          if (texture?.dispose && typeof texture.dispose === 'function') {
            try {
              texture.dispose();
            } catch (error) {
              console.warn('Error disposing texture:', error);
            }
          }
        });

        // Dispose materials that weren't caught earlier
        const materials = flock.scene.materials ? [...flock.scene.materials] : [];
        materials.forEach((material) => {
          if (material?.dispose && typeof material.dispose === 'function') {
            try {
              material.dispose();
            } catch (error) {
              console.warn('Error disposing material:', error);
            }
          }
        });

        // Clear all scene observables
        flock.scene.onActiveCameraChanged?.remove(flock._audioListenerObserver);
        flock._audioListenerObserver = null;
        flock._audioListenerTickObserver = null;
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
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Dispose any shapes still in the cache (e.g. from models disposed mid-scene
        // whose cache entry was never cleaned up). Must happen before hk.dispose().
        for (const shape of Object.values(flock.physicsShapeCache)) {
          if (!shape?._isDisposed) {
            try {
              shape.dispose();
            } catch {
              /* already disposed */
            }
          }
        }

        // Dispose physics engine and release WASM heap
        try {
          flock.hk?.dispose(); // Babylon's HavokPlugin wrapper
        } catch (error) {
          console.warn('Error disposing HavokPlugin:', error);
        }
        flock.hk = null;

        // Dispose of the scene
        flock.scene.dispose();
        flock.scene = null;

        // Dispose the Babylon.js engine
        //flock.engine?.dispose();
        //flock.engine = null;

        // Dispose Babylon audio engine, then close the underlying context.
        // Capture the context reference now — stopAllSounds() (called earlier) nulls
        // flock.audioContext without closing it when Babylon owns it, so we must
        // grab _audioContext directly before dispose clears the engine reference.
        // Closing the context kills all scheduled oscillators from playMidiNote that
        // are not tracked in globalSounds.
        const audioContextToClose = flock.audioEngine?._audioContext ?? flock.audioContext;
        try {
          flock.audioEngine?.dispose?.();
        } catch (error) {
          console.warn('Error disposing audioEngine:', error);
        }
        flock.audioEngine = null;
        flock.audioEnginePromise = null;

        if (audioContextToClose && audioContextToClose.state !== 'closed') {
          try {
            await audioContextToClose.close();
          } catch (error) {
            console.warn('AudioContext was already closed or closing:', error);
          }
        }
        flock.audioContext = null;
        flock._audioStopped = false;

        // Clear all references
        flock.events = new Map();
        flock.modelCache = {};
        flock.globalSounds = [];
        flock.modelsBeingLoaded = {};
        flock.originalModelTransformations = {};
        flock.geometryCache = {};
        flock.materialCache = {};
        flock.physicsShapeCache = {};
        flock.pendingTriggers = new Map();
        flock.pendingIntersections = new Map();
        flock.pendingSelfIntersections = new Map();
        flock.pendingTagIntersections = new Map();
        flock._nameRegistry = new Map();
        flock._liveNameCache = new Map();
        flock._ambiguousLiveNames = new Set();
        flock._animationFileCache = {};
        flock._modelInstances = Object.create(null);
        flock.ground = null;
        flock.sky = null;

        // Clear abort controller
        flock.abortController = null;

        // Force garbage collection in development (if available)
        if (typeof window !== 'undefined' && window.gc) {
          setTimeout(() => {
            try {
              window.gc();
              console.log('Forced garbage collection');
            } catch {
              // Silently fail if gc is not available
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error during scene disposal:', error);
        // Even if disposal fails, clear critical references
        flock.scene = null;
        flock.engine = null;
        flock.flockNotReady = true;
      }
    } else {
      console.log('No scene to dispose');
      if (flock.abortController) {
        flock.abortController.abort();
        flock.abortController = null;
      }
    }
  },
  ensureAudio() {
    if (!flock.audioEnginePromise) {
      // iOS Safari polyfill — must run before Babylon calls new AudioContext().
      if (typeof window !== 'undefined' && !window.AudioContext && window.webkitAudioContext) {
        window.AudioContext = window.webkitAudioContext;
      }
      try {
        // Capture the promise reference so the .then() handler can detect if
        // cleanup ran (set audioEnginePromise to null) or a new scene replaced
        // it before this async init resolved — and dispose the stale engine.
        let enginePromise;
        // listenerAutoUpdate ticks on window rAF, which stops in an immersive XR
        // session. Driven from the scene render loop below so VR keeps distance falloff.
        enginePromise = flock.BABYLON.CreateAudioEngineAsync({
          volume: 1,
          listenerAutoUpdate: false,
          listenerEnabled: true,
          resumeOnInteraction: true,
        })
          .then((audioEngine) => {
            if (flock.audioEnginePromise !== enginePromise) {
              try {
                audioEngine.dispose?.();
              } catch {
                /* best-effort */
              }
              return;
            }
            flock.audioEngine = audioEngine;
            // resumeOnInteraction resumes on any click on the page, which
            // would restart audio that a pause suspended.
            audioEngine.stateChangedObservable?.add((state) => {
              if (state === 'running' && flock._audioSuspendedByFreeze) {
                audioEngine.pauseAsync().catch(() => {});
              }
            });
            dismissBanner('audio');
            flock.audioContext = audioEngine._audioContext ?? flock.audioContext;
            flock.globalStartTime = flock.audioContext?.currentTime ?? 0;
            if (flock.scene?.activeCamera) {
              audioEngine.listener.attach(flock.scene.activeCamera);
            }
            flock._audioListenerObserver = flock.scene?.onActiveCameraChanged?.add(() => {
              if (flock.scene?.activeCamera) {
                audioEngine.listener.attach(flock.scene.activeCamera);
              }
            });
            flock._audioListenerTickObserver = flock.scene?.onBeforeRenderObservable?.add(() => {
              if (flock.audioEngine !== audioEngine) return;
              audioEngine.listener.update();
            });
          })
          .catch((err) => {
            console.warn('[flock] Audio engine unavailable:', err);
            flock.audioEngine = null;
            showBanner('audio', { message: translate('error_audio') });
          });
        flock.audioEnginePromise = enginePromise;
      } catch (err) {
        console.warn('[flock] Audio engine unavailable:', err);
        flock.audioEngine = null;
        flock.audioEnginePromise = Promise.resolve();
        showBanner('audio', { message: translate('error_audio') });
      }
    }
    return flock.audioEnginePromise;
  },
  async initializeNewScene() {
    // Wait a bit more to ensure all disposal operations are complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop existing render loop or create a new engine
    flock.engine ? flock.engine.stopRenderLoop() : flock.createEngine();

    // Reset scene-wide state
    flock.events = new Map();
    flock.modelCache = {};
    flock.globalSounds = [];
    flock.modelsBeingLoaded = {};
    flock.originalModelTransformations = {};
    flock.geometryCache = {};
    flock.pendingTriggers = new Map();
    flock.pendingIntersections = new Map();
    flock.pendingSelfIntersections = new Map();
    flock.pendingTagIntersections = new Map();
    flock._nameRegistry = new Map();
    flock._liveNameCache = new Map();
    flock.modelReadyPromises = new Map();
    flock._animationFileCache = {};
    flock._modelInstances = Object.create(null);
    flock.materialCache = {};
    flock._fogAwareShaderMaterials = new Set();
    flock.physicsShapeCache = {};
    flock.havokAbortHandled = false;
    flock.disposed = false;

    // Clear any error banner from a previous run now that we're starting fresh.
    dismissBanner('physics-oom');
    dismissBanner('project-run');

    // Create the new scene
    flock.scene = new flock.BABYLON.Scene(flock.engine);
    keepHoverCursorCurrent(flock.scene);

    //Enable accessibility layer
    clearUIControls();
    enableSceneDescription(flock.scene, flock.inputManager);
    // Announce "say" and "printText" outputs so NVDA reads Blockly say blocks reliably.
    if (!flock._a11yTextWrapped) {
      // Wrap say(text, ...)
      if (typeof flock.say === 'function') {
        const originalSay = flock.say.bind(flock);
        flock.say = (...args) => {
          const result = originalSay(...args);

          const targetName = args?.[0];
          const options = args?.[1];
          const text = options && typeof options.text === 'string' ? options.text : '';
          const rawDuration = options?.duration;
          const duration =
            isFinite(Number(rawDuration)) && Number(rawDuration) > 0 ? Number(rawDuration) : 0;

          if (text.trim()) {
            if (duration > 0) {
              // Transient say: announce immediately and show in Ctrl+J while visible
              const mesh = flock.scene?.getMeshByName(targetName);
              const label = mesh ? getObjectLabel(mesh) : targetName;
              announceObjectSay(`${label} says: ${text}`);
              setTransientSayText(targetName, text, duration);
            } else {
              // Persistent say: store for Ctrl+J nearest-object reading
              recordObjectPromptText(targetName, text);
              recordObjectSayText(targetName, text);
            }
          }

          return result;
        };
      }

      // Wrap printText({ text: "..." })
      if (typeof flock.printText === 'function') {
        const originalPrintText = flock.printText.bind(flock);
        flock.printText = (...args) => {
          const result = originalPrintText(...args);

          const payload = args?.[0];
          const text =
            typeof payload === 'string'
              ? payload
              : payload && typeof payload.text === 'string'
                ? payload.text
                : '';

          if (text && text.trim()) {
            recordWorldInstructionText(text);
            announceSayText(text);
          }
          return result;
        };
      }

      flock._a11yTextWrapped = true;
    }

    flock._renderLoop = () => {
      try {
        flock.scene.render();
      } catch (error) {
        if (flock.isPhysicsMemoryAbort(error)) {
          flock.handlePhysicsOutOfMemory(error);
          return;
        }
        // Stop the loop so a crash doesn't re-fire every frame.
        flock._renderLoopStopped = true;
        flock.engine?.stopRenderLoop(flock._renderLoop);
        handleError(error, { source: 'project-run', fatal: false });
      }
    };

    // Apply and remember the app's default clear colour so it can be
    // restored if the user removes their sky/background blocks later.
    const defaultClearColor = flock.BABYLON.Color3.FromHexString('#33334c');
    flock.scene.clearColor = defaultClearColor.clone?.() ?? defaultClearColor;
    flock.initialClearColor = defaultClearColor.clone?.() ?? defaultClearColor;

    // Abort controller for clean-up
    flock.abortController = new AbortController();
    // Strong-reference Set, unlike _sections - reset per run to avoid leaking.
    flock._loadedSections = new Set();
    // Reset so a stale queued load from a previous run can't hold up this one.
    flock._loadQueueTail = Promise.resolve();
    flock._canvasControlsEnabled = undefined;
    // Subtitles default off each run; the enable_subtitles block opts in.
    flock.subtitlesEnabled = false;
    flock._subtitleControl = null;
    flock._subtitleToken = 0;
    flock._subtitleTimer = null;

    // Enable physics
    await flock.ensurePhysicsInstance();
    flock.hk = new flock.BABYLON.HavokPlugin(true, flock.havokInstance);
    flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), flock.hk);
    flock._applyPauseToScene();
    flock._bindModules();

    // Add highlight layer
    flock.highlighter = new flock.BABYLON.HighlightLayer('highlighter', flock.scene);

    // Set up a new camera
    const camera = new flock.BABYLON.FreeCamera(
      'camera',
      new flock.BABYLON.Vector3(0, 3, -10),
      flock.scene
    );
    flock.savedCamera = camera;
    flock.defaultCamera = camera;
    flock.mainCamera = camera;
    camera.minZ = 0;
    camera.setTarget(flock.BABYLON.Vector3.Zero());
    camera.rotation.x = flock.BABYLON.Tools.ToRadians(0);
    flock._configureFlyCamera(camera);
    flock.scene.activeCamera = camera;
    camera.attachControl(flock.canvas, false);

    // An engine created while the canvas was hidden keeps a 1x buffer until
    // something resizes it.
    if (flock.canvas?.clientWidth > 0 && flock.canvas?.clientHeight > 0) {
      flock.engine.resize();
    }

    // Start the render loop now that a camera exists
    flock._renderLoopStopped = false;
    flock._resumeRenderLoop();
    flock._gamepadSource = new GamepadSource(flock.inputManager, {
      scene: flock.scene,
      canvas: flock.canvas,
    });
    flock._gamepadSource.start();
    flock._onScreenSource.start(flock.scene);
    flock._cameraControls = new CameraControls(flock);
    flock._cameraControls.start();
    // Set up lighting
    const hemisphericLight = new flock.BABYLON.HemisphericLight(
      'hemisphericLight',
      new flock.BABYLON.Vector3(0, 3, 0),
      flock.scene
    );
    hemisphericLight.intensity = 1.0;
    hemisphericLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
    hemisphericLight.groundColor = new flock.BABYLON.Color3(0.5, 0.5, 0.5);
    // No specular: an ambient light shouldn't cast a hard highlight that
    // blows surfaces to white when the view aligns with its direction.
    hemisphericLight.specular = new flock.BABYLON.Color3(0, 0, 0);

    flock.mainLight = hemisphericLight;

    // KHR_PBR_NEUTRAL rolls off overexposure without crushing shadows the
    // way ACES's filmic curve does.
    flock.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    flock.scene.imageProcessingConfiguration.toneMappingType =
      flock.BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    flock.scene.imageProcessingConfiguration.exposure = 1.0;

    // Directional light that drives the ShadowGenerator. A shadow is the
    // absence of this light's contribution where it's blocked, so it must
    // actually illuminate. It starts at intensity 0 (no effect, flat
    // hemispheric look by default); enableShadows() raises it so the "sun"
    // shading and cast shadows only appear while shadows are turned on.
    const shadowLight = new flock.BABYLON.DirectionalLight(
      'shadowLight',
      // Near-overhead angle keeps shadows small and tucked under objects for
      // a cartoony look (a shallower angle stretches them out). A slight
      // offset is kept so vertical faces still get some directional shading.
      new flock.BABYLON.Vector3(-0.15, -1, -0.15),
      flock.scene
    );
    shadowLight.position = new flock.BABYLON.Vector3(20, 40, 20);
    shadowLight.intensity = 0;
    flock.shadowLight = shadowLight;
    flock.shadowGenerator = null;
    flock.shadowCasters.clear();
    flock.shadowExcluded.clear();

    // Headlamp: fills in faces the hemispheric light leaves dark, by always
    // pointing where the camera looks. No specular — its direction tracks
    // the view exactly, so a head-on surface would always catch a hotspot.
    const headlampLight = new flock.BABYLON.DirectionalLight(
      'headlampLight',
      new flock.BABYLON.Vector3(0, 0, 1),
      flock.scene
    );
    headlampLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
    headlampLight.specular = new flock.BABYLON.Color3(0, 0, 0);
    flock.headlampLight = headlampLight;
    flock.updateHeadlampIntensity();
    flock.scene.onBeforeRenderObservable.add(() => {
      const camera = flock.scene.activeCamera;
      if (!camera) return;
      headlampLight.direction = camera.getForwardRay().direction;
    });

    // Enable collisions
    flock.scene.collisionsEnabled = true;

    flock.onScreenControls('ARROWS', 'YES', 'AUTO', '#ffffff');

    // Create the UI
    flock.advancedTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

    // Stack panel for text
    flock.stackPanel = new flock.GUI.StackPanel();
    flock.stackPanel.width = '100%'; // Fixed width for the panel
    flock.stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align to the left
    flock.stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align to the top

    flock.stackPanel.isVertical = true;
    flock.advancedTexture.addControl(flock.stackPanel);

    // Keep the listener up to date while sounds are playing, but don't
    // create a new AudioContext just because a frame rendered.
    flock.scene.onBeforeRenderObservable.add(() => {
      // When Babylon's audio engine is active it owns context.listener via
      // listener.attach(camera) + listenerAutoUpdate:true. Setting .value on
      // the same AudioParams would throw NotSupportedError (setValueAtTime
      // overlapping setValueCurveAtTime). Skip our manual update in that case.
      if (flock.audioEngine) return;
      const context = flock.audioContext;
      if (context && context.state !== 'closed' && flock.scene.activeCamera) {
        flock.updateListenerPositionAndOrientation(context, flock.scene.activeCamera);
      }
    });

    attachInteractIndicator(flock.scene, flock.inputManager);

    // Mark scene as ready
    flock.flockNotReady = false;

    flock._resetXRState();
  },
  removeEventListeners() {},
  _configureFlyCamera(camera) {
    camera.angularSensibilityX = 2000;
    camera.angularSensibilityY = 2000;
    camera.speed = 0.25;

    // Extend the fly camera's vertical keyboard bindings to match the
    // on-screen button layout: BUTTON1 keys + PageUp for up,
    // BUTTON3 keys + PageDown for down. Babylon's native input handles
    // these with its built-in inertia/smoothing, keeping it consistent
    // with gamepad button movement.
    const KEY_CODE = { PageUp: 33, PageDown: 34, r: 82, 1: 49, f: 70, 3: 51 };
    const toKeyCodes = (keys) => keys.map((k) => KEY_CODE[k]).filter(Boolean);
    const kbInput = camera.inputs?.attached?.keyboard;
    if (kbInput) {
      kbInput.keysUpward = toKeyCodes([...getBoundKeys('BUTTON1'), 'PageUp']);
      kbInput.keysDownward = toKeyCodes([...getBoundKeys('BUTTON3'), 'PageDown']);
      kbInput.keysLeft = [];
      kbInput.keysRight = [];
    }
  },
  _resetCameraInputState(camera = flock.scene?.activeCamera) {
    if (!camera) return;

    // ArcRotateCamera inertial offsets can keep rotating after input ends.
    if ('inertialAlphaOffset' in camera) camera.inertialAlphaOffset = 0;
    if ('inertialBetaOffset' in camera) camera.inertialBetaOffset = 0;
    if ('inertialRadiusOffset' in camera) camera.inertialRadiusOffset = 0;
    if ('inertialPanningX' in camera) camera.inertialPanningX = 0;
    if ('inertialPanningY' in camera) camera.inertialPanningY = 0;

    // Free/Universal camera deltas can persist when pointer state desyncs.
    if (camera.cameraDirection?.set) {
      camera.cameraDirection.set(0, 0, 0);
    }
    if (camera.cameraRotation?.set) {
      camera.cameraRotation.set(0, 0);
    } else if (camera.cameraRotation) {
      camera.cameraRotation.x = 0;
      camera.cameraRotation.y = 0;
    }
  },
  _hardResetCameraControls(
    camera = flock.scene?.activeCamera,
    { reattachDelayMs = 0, noPreventDefault = true } = {}
  ) {
    if (!camera || !flock.canvas) return;
    if (typeof camera.detachControl !== 'function') return;
    if (typeof camera.attachControl !== 'function') return;

    camera.detachControl(flock.canvas);
    flock._resetCameraInputState(camera);

    if (flock._cameraControlReattachTimer) {
      clearTimeout(flock._cameraControlReattachTimer);
      flock._cameraControlReattachTimer = null;
    }

    const reattach = () => {
      if (!flock.scene || flock.scene.activeCamera !== camera) return;
      if (flock._canvasControlsEnabled === false) return;
      flock._resetCameraInputState(camera);
      camera.attachControl(flock.canvas, noPreventDefault);
      flock._cameraControlReattachTimer = null;
    };

    if (reattachDelayMs > 0) {
      flock._cameraControlReattachTimer = setTimeout(reattach, reattachDelayMs);
      return;
    }

    reattach();
  },
};
