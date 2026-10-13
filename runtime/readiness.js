let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockReadiness = {
  whenModelReady(id, callback) {
    // Capture the signal now, never re-read flock.abortController at settle time: stopping a
    // run replaces the controller, so a late promise would see the new run's unaborted signal.
    const signal = flock.abortController?.signal;

    // Fast path: _liveNameCache. A miss, or a stale entry whose mesh was disposed, falls
    // through to the full lookup. Sentinel ids are never cached, so they take the normal path.
    const cached = flock._ambiguousLiveNames?.has(id) ? null : flock._liveNameCache.get(id);
    if (cached) {
      if (cached.isDisposed()) {
        flock._liveNameCache.delete(id);
      } else if (signal?.aborted) {
        // Match the locate() hit path below: when aborted the callback is
        // not run and the returned promise never settles.
        return new Promise(() => {});
      } else {
        // Run the callback inline and resolve once it completes (awaiting
        // async callbacks) — same contract as settle on the hit path.
        try {
          const result = typeof callback === 'function' ? callback(cached) : undefined;
          return result && typeof result.then === 'function'
            ? Promise.resolve(result).then(() => cached)
            : Promise.resolve(cached);
        } catch (error) {
          return Promise.reject(error);
        }
      }
    }

    // --- Promise that resolves when ready (or undefined on abort/dispose) ---
    let settled = false;
    let resolveP;
    let rejectP;
    const promise = new Promise((resolve, reject) => {
      resolveP = resolve;
      rejectP = reject;
    });

    const settle = async (val) => {
      if (settled) return;
      settled = true;
      try {
        // Cache the resolved target (meshes only) so later lookups take the fast path.
        flock._registerLiveName(id, val);
        // Await the callback so the promise doesn't resolve before user async work completes.
        if (typeof callback === 'function') await callback(val);
        resolveP(val);
      } catch (error) {
        rejectP(error);
      }
    };

    // Helper: locate current object
    const locate = () => {
      const scene = flock.scene;
      if (!scene) return null;
      if (id === '__active_camera__') return scene.activeCamera ?? null;
      if (id === '__main_light__') return flock.mainLight ?? null;

      let t = scene.getMeshByName?.(id) ?? null;
      if (!t && scene.UITexture) t = scene.UITexture.getControlByName?.(id) ?? null;
      if (!t && Array.isArray(scene.animationGroups))
        t = scene.animationGroups.find((g) => g.name === id) ?? null;
      if (!t && Array.isArray(scene.particleSystems))
        t = scene.particleSystems.find((s) => s.name === id) ?? null;
      return t ?? null;
    };

    // Runs at call time and again when a late-arriving scene appears (the rAF wait below).
    // Returns true when a path claimed the lookup and will settle.
    const tryFastPaths = () => {
      // Prefer a pending promise, so we wait for geometry to be attached.
      if (flock.modelReadyPromises.has(id)) {
        const pendingPromise = flock.modelReadyPromises.get(id);
        pendingPromise
          .then((resolvedMesh) => {
            // Re-locate for geometry; fall back to the resolved mesh for alias lookups where
            // id is the pre-sanitization name ("dimnnd monkey" vs "dimnndmonkey").
            const meshWithGeometry = locate() ?? resolvedMesh ?? null;
            if (!signal?.aborted) void settle(meshWithGeometry);
          })
          .catch(() => {
            // On error, still try to return what we can find
            const meshWithGeometry = locate();
            if (!signal?.aborted) void settle(meshWithGeometry);
          });
        return true;
      }

      if (flock.scene) {
        const existing = locate();
        if (existing) {
          if (!signal?.aborted) void settle(existing);
          return true;
        }
      }

      // createCharacter/createObject strip special characters but createBox etc. do not, so
      // normalizing upfront would break box lookups ("centre platform" stays as typed). Only
      // redirect to the normalized id when the exact one is absent.
      if (id && !id.startsWith('__')) {
        let norm = id.includes('__') ? id.split('__')[0] : id;
        norm = norm.replace(/[^a-zA-Z0-9._-]/g, '');
        if (norm && norm !== id) {
          if (flock.modelReadyPromises.has(norm)) {
            const pendingPromise = flock.modelReadyPromises.get(norm);
            pendingPromise
              .then((resolvedMesh) => {
                const meshWithGeometry = flock.scene?.getMeshByName(norm) ?? resolvedMesh ?? null;
                if (!signal?.aborted) void settle(meshWithGeometry);
              })
              .catch(() => {
                if (!signal?.aborted) void settle(null);
              });
            return true;
          }
          const existing = flock.scene?.getMeshByName(norm);
          if (existing) {
            if (!signal?.aborted) void settle(existing);
            return true;
          }
        }
      }

      return false;
    };

    if (tryFastPaths()) return promise;

    // --- Observer path ---
    const attachObservers = () => {
      const scene = flock.scene;
      if (!scene) return;

      const disposers = [];
      let done = false;
      const finish = async (target /*, source */) => {
        if (done) return;
        done = true;
        try {
          if (!signal?.aborted) await settle(target);
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
      if (id === '__active_camera__') {
        const camNow = scene.activeCamera;
        if (camNow) {
          finish(camNow);
          return;
        }
        if (scene.onActiveCameraChanged) {
          const cb = () => {
            if (scene.activeCamera) finish(scene.activeCamera);
          };
          scene.onActiveCameraChanged.add(cb);
          disposers.push(() => scene.onActiveCameraChanged.removeCallback(cb));
        }
        if (scene.onDisposeObservable) {
          const h = scene.onDisposeObservable.add(() => finish(undefined));
          disposers.push(() => scene.onDisposeObservable.remove(h));
        }
        if (signal) {
          const onAbort = () => finish(undefined);
          signal.addEventListener('abort', onAbort, { once: true });
          disposers.push(() => signal.removeEventListener('abort', onAbort));
        }
        return;
      }

      // main light — a plain property with no assignment event, so poll per frame. The
      // mesh/GUI observers below can never match a light, so without this a waiter pends
      // until scene dispose.
      if (id === '__main_light__') {
        const lightNow = flock.mainLight;
        if (lightNow) {
          finish(lightNow);
          return;
        }
        const tick = scene.onBeforeRenderObservable.add(() => {
          if (flock.mainLight) finish(flock.mainLight);
        });
        disposers.push(() => scene.onBeforeRenderObservable.remove(tick));
        if (scene.onDisposeObservable) {
          const h = scene.onDisposeObservable.add(() => finish(undefined));
          disposers.push(() => scene.onDisposeObservable.remove(h));
        }
        if (signal) {
          const onAbort = () => finish(undefined);
          signal.addEventListener('abort', onAbort, { once: true });
          disposers.push(() => signal.removeEventListener('abort', onAbort));
        }
        return;
      }

      // meshes
      if (scene.onNewMeshAddedObservable) {
        const h = scene.onNewMeshAddedObservable.add((mesh) => {
          if (done) return;
          if (mesh?.name === id) {
            finish(mesh);
            return;
          }
          // This observer may predate createCharacter registering id's pre-sanitization
          // alias, so re-check modelReadyPromises and switch to that promise if it appeared.
          if (flock.modelReadyPromises?.has(id)) {
            done = true;
            while (disposers.length) {
              try {
                disposers.pop()();
              } catch {
                /* ignore */
              }
            }
            flock.modelReadyPromises
              .get(id)
              .then((resolvedMesh) => {
                const m = locate() ?? resolvedMesh ?? null;
                if (!signal?.aborted) void settle(m);
              })
              .catch(() => {
                if (!signal?.aborted) void settle(undefined);
              });
          }
        });
        disposers.push(() => scene.onNewMeshAddedObservable.remove(h));
      }

      // animation groups
      if (scene.onAnimationGroupAddedObservable) {
        const h = scene.onAnimationGroupAddedObservable.add((group) => {
          if (!done && group?.name === id) finish(group);
        });
        disposers.push(() => scene.onAnimationGroupAddedObservable.remove(h));
      }

      // particle systems
      if (scene.onNewParticleSystemAddedObservable) {
        const h = scene.onNewParticleSystemAddedObservable.add((ps) => {
          if (!done && ps?.name === id) finish(ps);
        });
        disposers.push(() => scene.onNewParticleSystemAddedObservable.remove(h));
      }

      // GUI controls (attach when UITexture exists)
      const attachGui = () => {
        const tex = scene.UITexture;
        if (!tex) return false;
        // The texture (and the target control) may have been created since
        // the last check — a control added before we subscribe below would
        // otherwise be missed.
        const existing = tex.getControlByName?.(id) ?? null;
        if (existing) {
          finish(existing);
          return true;
        }
        if (!tex.onControlAddedObservable) return false;
        const h = tex.onControlAddedObservable.add((ctrl) => {
          if (!done && ctrl?.name === id) finish(ctrl);
        });
        disposers.push(() => tex.onControlAddedObservable.remove(h));
        return true;
      };
      if (!attachGui()) {
        const tick = scene.onBeforeRenderObservable.add(() => {
          if (attachGui()) scene.onBeforeRenderObservable.remove(tick);
        });
        disposers.push(() => scene.onBeforeRenderObservable.remove(tick));
      }

      // scene dispose / abort
      if (scene.onDisposeObservable) {
        const h = scene.onDisposeObservable.add(() => finish(undefined));
        disposers.push(() => scene.onDisposeObservable.remove(h));
      }
      if (signal) {
        const onAbort = () => finish(undefined);
        signal.addEventListener('abort', onAbort, { once: true });
        disposers.push(() => signal.removeEventListener('abort', onAbort));
      }
    };

    // wait for scene if needed
    if (!flock.scene) {
      let rafId = 0;
      const check = () => {
        if (signal?.aborted) return;
        if (flock.scene) {
          cancelAnimationFrame(rafId);
          // The scene may already contain the target — its addition event
          // fired before any observer could attach — so re-run the fast
          // paths first or the promise would pend forever.
          if (!tryFastPaths()) attachObservers();
          return;
        }
        rafId = requestAnimationFrame(check);
      };
      rafId = requestAnimationFrame(check);
      if (signal) {
        const onAbort = () => cancelAnimationFrame(rafId);
        signal.addEventListener('abort', onAbort, { once: true });
      }
      return promise; // <— still return the promise
    }

    attachObservers();
    return promise;
  },
  _flushPendingTriggers(meshName, groupName) {
    if (!flock.pendingTriggers.has(groupName)) return;

    const triggers = flock.pendingTriggers.get(groupName);
    const remaining = [];

    for (const pending of triggers) {
      const {
        meshName: pendingMeshName,
        trigger,
        callback,
        mode,
        applyToGroup,
        owningSignal,
      } = pending;
      const targetMeshName = pendingMeshName ?? meshName;

      if (applyToGroup) {
        // Register trigger only on the newly announced mesh; keep pending for future siblings.
        flock.onTrigger(meshName, {
          trigger,
          callback,
          mode,
          applyToGroup: false,
          __owningSignal: owningSignal,
        });
        remaining.push(pending);
      } else {
        const guiControl = flock.scene?.UITexture?.getControlByName?.(targetMeshName) ?? null;
        const targetExists = flock.scene?.getMeshByName(targetMeshName) || guiControl;

        if (targetExists) {
          // ✅ Apply to the original target this pending registration was created for.
          flock.onTrigger(targetMeshName, {
            trigger,
            callback,
            mode,
            applyToGroup: false,
            __owningSignal: owningSignal,
          });
        } else {
          remaining.push(pending);
        }
      }
    }

    flock.pendingTriggers.set(groupName, remaining);
  },
  announceMeshReady(meshName, groupName) {
    flock._registerLiveName(meshName, flock.scene?.getMeshByName(meshName));

    groupName = flock._familyOf(flock._nameRegistry.has(meshName) ? meshName : groupName);

    flock._applyGroupHandlers(meshName, groupName);
    const mesh = flock.scene?.getMeshByName(meshName);
    for (const node of mesh ? [mesh, ...mesh.getDescendants(false)] : []) {
      for (const tag of node.metadata?.tags ?? []) {
        flock._applyGroupHandlers(node.name, tag);
      }
    }
  },
  _applyGroupHandlers(meshName, groupName) {
    flock._flushPendingTriggers(meshName, groupName);

    if (flock._isTag(groupName)) {
      for (const pending of flock.pendingTagIntersections?.get(groupName) ?? []) {
        pending.register(meshName);
      }
    }

    if (flock.pendingIntersections.has(groupName)) {
      const intersections = flock.pendingIntersections.get(groupName);
      for (const pending of intersections) {
        if (meshName !== pending.meshName && !pending.registeredOthers.has(meshName)) {
          pending.registeredOthers.add(meshName);
          flock.onIntersect(pending.meshName, meshName, {
            trigger: pending.trigger,
            callback: pending.callback,
            applyToGroupOther: false,
          });
        }
      }
    }

    if (flock.pendingSelfIntersections.has(groupName)) {
      const newMesh = flock.scene?.getMeshByName(meshName);
      if (newMesh) {
        for (const pending of flock.pendingSelfIntersections.get(groupName)) {
          const existing = flock.scene.meshes.filter(
            (m) => flock._inGroup(m, groupName) && m.name !== meshName
          );
          for (const existingMesh of existing) {
            const meshA = existingMesh.uniqueId < newMesh.uniqueId ? existingMesh : newMesh;
            const meshB = meshA === existingMesh ? newMesh : existingMesh;
            const pairKey = `${meshA.uniqueId}|${meshB.uniqueId}`;
            if (!pending.registeredPairs.has(pairKey)) {
              pending.registeredPairs.add(pairKey);
              flock.onIntersect(meshA.name, meshB.name, {
                trigger: pending.trigger,
                callback: pending.callback,
                applyToGroupOther: false,
              });
            }
          }
        }
      }
    }
  },
  /** Reserve a unique name. If desired is taken or pending, suffix it. */
  _reserveName(desired, family = desired) {
    const has = (n) => flock._nameRegistry.has(n) || !!flock.scene?.getMeshByName(n);
    let name = desired;
    while (has(name)) {
      name = `${desired}_${flock.scene.getUniqueId()}`;
    }
    if (flock._isTag(family)) family = `${family}__object`;
    flock._nameRegistry.set(name, { pending: true, exists: false, family });
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

  /** The name a mesh was reserved from; repeats and clones share it. */
  _familyOf(name) {
    const family = flock._nameRegistry.get(name)?.family;
    if (family) return family;
    const dot = name.indexOf('.');
    if (dot > 0) {
      const parentFamily = flock._nameRegistry.get(name.slice(0, dot))?.family;
      if (parentFamily) return parentFamily;
    }
    return name.includes('__') ? name.split('__')[0] : name;
  },

  _isTag(name) {
    return !!flock._nameRegistry.get(name)?.tag;
  },

  _inGroup(mesh, groupName) {
    return flock._familyOf(mesh.name) === groupName || !!mesh.metadata?.tags?.includes(groupName);
  },

  /** Release a reservation on failure/disposal. */
  _releaseName(name) {
    flock._nameRegistry.delete(name);
  },

  /**
   * Cache a resolved name → live mesh so whenModelReady can skip per-call
   * scene scans. Meshes only: other target types (GUI controls, animation
   * groups, particle systems) keep using the fallback lookup. Entries are
   * evicted when the mesh is disposed (via onDisposeObservable here, plus
   * a lazy isDisposed check on read) and when a run starts or ends.
   */
  _registerLiveName(name, target) {
    if (!name || !(target instanceof flock.BABYLON.AbstractMesh) || target.isDisposed()) return;
    const cached = flock._liveNameCache.get(name);
    if (cached === target) return; // Already registered with observer
    if (cached && !cached.isDisposed()) {
      flock._liveNameCache.delete(name);
      flock._ambiguousLiveNames ??= new Set();
      flock._ambiguousLiveNames.add(name);
      return;
    }
    if (flock._ambiguousLiveNames?.has(name)) return;
    flock._liveNameCache.set(name, target);
    target.onDisposeObservable.addOnce(() => {
      if (flock._liveNameCache.get(name) === target) {
        flock._liveNameCache.delete(name);
      }
    });
  },
};
