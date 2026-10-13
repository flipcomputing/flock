import HavokPhysics from '@babylonjs/havok';
import { translate } from '../main/translation.js';
import { handleError, isReported, markReported } from '../ui/notifications.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockDiagnostics = {
  // Testing phase: warnings ON by default (?debug=false silences).
  // TODO: revert to opt-in (`=== 'true'`, default false) after testing.
  isDebugLoggingEnabled() {
    if (flock._debugLogging === undefined) {
      try {
        flock._debugLogging = new URLSearchParams(window.location.search).get('debug') !== 'false';
      } catch {
        flock._debugLogging = true;
      }
    }
    return flock._debugLogging;
  },
  reportBlockError({ key, values = {}, api, error } = {}) {
    // A caught value can come straight from user code, so classify and report
    // through safe primitives rather than its own getters.
    const safe = error == null ? undefined : flock.sanitizeError(error);
    if (safe?.name === 'AbortError') return;
    // A stack overflow is nearly always runaway user recursion; report it as
    // such. Message differs by engine (V8 "call stack", Firefox "recursion").
    if (
      (safe?.name === 'RangeError' || safe?.name === 'InternalError') &&
      /call stack|recursion/i.test(safe.message)
    ) {
      key = 'recursion_too_deep';
    }
    // One fault can fire in a burst (stack-overflow cascade, per-frame loop error), so
    // collapse within a short window when key, API and message match (`values` is not compared).
    const now = Date.now();
    const sig = `${key}\0${api ?? ''}\0${safe?.message ?? ''}`;
    if (sig === flock._lastErrorSig && now - flock._lastErrorAt < 1000) {
      return;
    }
    flock._lastErrorSig = sig;
    flock._lastErrorAt = now;
    if (flock.isDebugLoggingEnabled()) {
      console.warn(`[flock] ${api ?? 'block'}: ${key}`, values, safe ?? '');
    }
    try {
      flock.onBlockError?.({ key, values, api, error: safe });
    } catch {
      // a broken listener must not break the swallow path
    }
  },
  // User code can throw any value, including one whose name/message/stack getters throw or
  // return non-strings. Read each once into a plain Error so host handlers see only safe
  // primitives. A getter that hangs is undefendable — that's user code hanging itself.
  sanitizeError(error) {
    const read = (get) => {
      try {
        const v = get();
        return v == null ? '' : String(v);
      } catch {
        return '';
      }
    };
    // A thrown primitive (e.g. `throw "bad input"`) has no .message, so use the
    // value itself rather than losing the text.
    const isPrimitive = error == null || (typeof error !== 'object' && typeof error !== 'function');
    const safe = new Error(isPrimitive ? read(() => error) : read(() => error?.message));
    safe.name = isPrimitive ? 'Error' : read(() => error?.name) || 'Error';
    safe.stack = isPrimitive ? '' : read(() => error?.stack);
    return safe;
  },
  requireMesh(target, { api, name } = {}) {
    if (target instanceof flock.BABYLON.AbstractMesh) return true;
    flock.reportBlockError({
      key: target == null ? 'object_not_found' : 'target_not_a_mesh',
      api,
      values: { object: name },
    });
    return false;
  },
  // Enhanced error reporting with block context
  createEnhancedError(error, code) {
    const lines = code.split('\n');
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
            const marker = actualLine === lineNum ? '>>> ' : '    ';
            return `${marker}${actualLine + 1}: ${line}`;
          })
          .join('\n');
      }
    }

    // Add common error suggestions
    if (error.message.includes('is not defined')) {
      errorContext.suggestion =
        'Check if the variable or function name is spelled correctly and has been declared.';
    } else if (error.message.includes('Cannot read property')) {
      errorContext.suggestion = 'Check if the object exists before accessing its properties.';
    }

    return errorContext;
  },
  // Used by all mesh creation paths; inert unless flock.meshRecyclingEnabled.
  _recycleOldestByKey(key) {
    if (!flock.meshRecyclingEnabled) return;
    if (!flock._modelInstances) flock._modelInstances = Object.create(null);
    const current = Array.isArray(flock._modelInstances[key]) ? flock._modelInstances[key] : [];
    flock._modelInstances[key] = current.filter((name) => {
      const m = flock.scene?.getMeshByName(name);
      return m && !m.isDisposed();
    });
    const max = flock.maxClonesPerSource ?? 500;
    if (flock._modelInstances[key].length >= max) {
      const oldestName = flock._modelInstances[key][0];
      const oldest = flock.scene?.getMeshByName(oldestName);
      if (oldest) flock.disposeMesh(oldest);
      flock._modelInstances[key] = flock._modelInstances[key].slice(1);
    }
  },
  _registerInstance(key, meshName) {
    if (!flock._modelInstances) flock._modelInstances = Object.create(null);
    const current = Array.isArray(flock._modelInstances[key]) ? flock._modelInstances[key] : [];
    flock._modelInstances[key] = current.concat(meshName);
  },
  maxMeshesReached() {
    if (!flock.meshLimitEnabled) return false;
    const scene = flock?.scene;
    if (!scene || typeof flock.maxMeshes !== 'number') return false;

    const meshCount = scene.meshes.length;
    const max = flock.maxMeshes;

    if (meshCount >= max) {
      flock.printText?.({
        text: translate('max_mesh_limit_reached').replace('{max}', max),
        duration: 30,
        color: '#ff0000',
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
      `Memory: ${used.toFixed(1)}MB used / ${total.toFixed(1)}MB allocated / ${limit.toFixed(1)}MB limit`
    );

    // Warn if approaching limits
    const usagePercent = (used / limit) * 100;
    if (usagePercent > 80) {
      console.warn(`High memory usage: ${usagePercent.toFixed(1)}% of limit`);
      // Show user warning in UI
      this.printText({
        text: translate('high_memory_usage_warning').replace('{percent}', usagePercent.toFixed(1)),
        duration: 3,
        color: '#ff9900',
      });
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
      console.log('Scene objects:', counts);
    }
  },
  startMemoryMonitoring() {
    console.log('Starting memory monitoring...');
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
    signal?.addEventListener('abort', () => {
      if (flock.memoryMonitorInterval) {
        clearInterval(flock.memoryMonitorInterval);
        flock.memoryMonitorInterval = null;
      }
    });
  },
  // Havok's wasm needs WebAssembly SIMD, which iOS Safari only has from 16.4.
  // Older engines can't parse the v128 return type in this module's type
  // section, so validate() is false there and true everywhere Havok can run.
  isWasmSimdSupported() {
    if (flock._wasmSimdSupported === undefined) {
      try {
        flock._wasmSimdSupported =
          typeof WebAssembly !== 'undefined' &&
          WebAssembly.validate(
            new Uint8Array([
              0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65,
              0, 253, 15, 253, 98, 11,
            ])
          );
      } catch {
        // A throwing validate() means the engine can't handle the module at all.
        flock._wasmSimdSupported = false;
      }
    }
    return flock._wasmSimdSupported;
  },
  isPhysicsMemoryAbort(error) {
    const message = `${error?.message ?? error}`.toLowerCase();
    const isWasmRuntimeError =
      typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError;
    // Emscripten wraps a wasm parse failure as "Aborted(CompileError: …)".
    // That's a missing capability, not memory pressure.
    if (message.includes('compileerror') || !flock.isWasmSimdSupported()) {
      return false;
    }
    return message.includes('out of memory') || (isWasmRuntimeError && message.includes('abort'));
  },
  // Loader is injectable so tests can assert the wasm is never fetched when
  // the device can't run it.
  async ensurePhysicsInstance(loadHavok = HavokPhysics) {
    if (!flock.isWasmSimdSupported()) {
      const error = new Error('WebAssembly SIMD is unavailable, so Havok physics cannot start.');
      handleError(error, { source: 'physics-unsupported' });
      throw markReported(error);
    }

    // Callers that arrive together share one in-flight load, so a second
    // caller can't start a duplicate wasm instance and leak the loser.
    if (!flock.havokInstance) {
      const pending = (flock._havokInstancePromise ??= loadHavok());
      try {
        const instance = await pending;
        // Commit/clear only our own load: a mid-await reset (OOM) must not
        // restore a stale instance, and a rejection must still allow a retry.
        if (flock._havokInstancePromise === pending) {
          flock.havokInstance = instance;
        }
      } catch (error) {
        // Callers sharing one load all land here with the same error; report it once.
        if (!isReported(error)) {
          if (flock.isPhysicsMemoryAbort(error)) {
            flock.handlePhysicsOutOfMemory(error);
          } else {
            // The wasm is fetched on first use, so this is nearly always a connection problem.
            handleError(error, { source: 'chunk-load', fatal: true });
          }
        }
        throw markReported(error);
      } finally {
        if (flock._havokInstancePromise === pending) {
          flock._havokInstancePromise = undefined;
        }
      }
    }

    return flock.havokInstance;
  },
  handlePhysicsOutOfMemory(error) {
    if (flock.havokAbortHandled) {
      return;
    }

    flock.havokAbortHandled = true;

    try {
      flock._renderLoopStopped = true;
      if (flock._renderLoop) {
        flock.engine?.stopRenderLoop(flock._renderLoop);
      } else {
        flock.engine?.stopRenderLoop();
      }
      flock.abortController?.abort();
    } catch (e) {
      console.log('Failed to stop render loop during physics OOM handling:', e);
    }

    try {
      flock.hk?.dispose?.();
    } catch (e) {
      console.log('Failed to dispose Havok instance during physics OOM handling:', e);
    }

    // Clear the instance so the next run reloads a fresh one.
    flock.hk = null;
    flock.havokInstance = null;
    flock._havokInstancePromise = undefined;

    handleError(error, { source: 'physics-oom', fatal: true });
  },
};
