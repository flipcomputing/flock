let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockModels = {
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
    // Drop container references (do NOT dispose after addAllToScene)
    const releaseContainer = (container) => {
      try {
        container.meshes = [];
        container.materials = [];
        container.textures = [];
        container.skeletons = [];
        container.animationGroups = [];
      } catch (_) {}
    };

    // --- sanitize inputs ---
    modelName = (typeof modelName === "string" ? modelName : "").replace(/[^a-zA-Z0-9._-]/g, "");
    modelId   = (typeof modelId   === "string" ? modelId   : "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!modelName || !modelId) {
      console.warn("createCharacter: invalid modelName/modelId");
      return "error_" + flock.scene.getUniqueId();
    }

    const x = Number.isFinite(position?.x) ? Math.max(-1000, Math.min(1000, position.x)) : 0;
    const y = Number.isFinite(position?.y) ? Math.max(-1000, Math.min(1000, position.y)) : 0;
    const z = Number.isFinite(position?.z) ? Math.max(-1000, Math.min(1000, position.z)) : 0;
    if (!(typeof scale === "number" && scale >= 0.01 && scale <= 100)) scale = 1;

    // --- parse "name__blockKey" and reserve a unique final name (REAL collisions only) ---
    let blockKey = modelId;
    let desiredName = modelId;
    if (desiredName.includes("__")) [desiredName, blockKey] = desiredName.split("__");

    const meshName = flock._reserveName(desiredName); // only suffix on true name collision
    const groupName = desiredName;

    // --- create readiness deferred (resolve OR reject) + abort hookup ---
    let resolveReady, rejectReady;
    const readyPromise = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
    flock.modelReadyPromises.set(meshName, readyPromise);

    const signal = flock.abortController?.signal;
    const onAbort = () => {
      try { rejectReady(new Error("aborted")); } catch {}
      flock.modelReadyPromises.delete(meshName);
      flock._releaseName?.(meshName);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanupAbort = () => signal?.removeEventListener("abort", onAbort);

    // --- load character (single path; works in both modes) ---
    flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
      flock.modelPath,
      modelName,
      flock.scene,
      null,
      null,
      { signal: flock.abortController?.signal }
    )
      .then((container) => {
        container.addAllToScene();

        const mesh = container.meshes[0];
        const bb = flock.setupMesh(mesh, modelName, meshName, blockKey, scale, x, y, z);

        // materials & colors
        flock.ensureStandardMaterial(mesh);
        flock.applyColorsToCharacter(mesh, colors);

        // pickable + face orientation on descendants with geometry
        const descendants = mesh.getChildMeshes(false);
        descendants.forEach((childMesh) => {
          if (childMesh.getTotalVertices() > 0) {
            childMesh.isPickable = true;
            childMesh.flipFaces(true);
          }
        });

        // Hide initially (we still resolve readiness so other systems can wire up)
        mesh.setEnabled(false);

        // Kick off animation preloads (non-blocking for readiness)
        const animationPromises = ["Idle", "Walk", "Jump"].map((name) =>
          flock.switchToAnimation(flock.scene, bb, name, false, false, false)
        );

        // After anims, run optional callback (await if it returns a promise), then show
        Promise.all(animationPromises)
          .then(async () => {
            if (callback) {
              try {
                const result = callback();
                if (result && typeof result.then === "function") {
                  await result;
                }
              } catch (err) {
                console.error("Callback error:", err);
              }
            }
          })
          .then(() => {
            mesh.setEnabled(true);
          });

        // Announce readiness immediately after mesh is in the scene & configured
        flock.announceMeshReady(meshName, groupName);
        flock._markNameCreated(meshName);
        resolveReady(mesh);
        cleanupAbort();

        // Allow the container to be GC'd (anims/skeletons are in the scene now)
        releaseContainer(container);
      })
      .catch((error) => {
        console.log("❌ Error loading character:", error);
        rejectReady(error);                 // propagate failure to waiters
        flock._releaseName(meshName);       // free reserved name
        flock.modelReadyPromises.delete(meshName);
        cleanupAbort();
      })
      .finally(() => {
        // Optional: keep resolved promises for a short time, then drop to avoid map growth
        setTimeout(() => {
          flock.modelReadyPromises.delete(meshName);
        }, 5000);
      });

    // Return the final (possibly suffixed) name so callers can reference this instance
    return meshName;
  },
  createObject({
    modelName,
    modelId,
    color = null,
    scale = 1,
    position = { x: 0, y: 0, z: 0 },
    callback = null,
    applyColor = true,
  } = {}) {
    // Helper (do NOT dispose container after addAllToScene; just drop refs)
    const releaseContainer = (container) => {
      try {
        container.meshes = [];
        container.materials = [];
        container.textures = [];
        container.skeletons = [];
        container.animationGroups = [];
      } catch (_) {}
    };

    try {
      // Validate / sanitize
      if (!modelName || typeof modelName !== "string" || modelName.length > 100) {
        console.warn("createObject: Invalid modelName parameter");
        return "error_" + flock.scene.getUniqueId();
      }
      if (!modelId || typeof modelId !== "string" || modelId.length > 100) {
        console.warn("createObject: Invalid modelId parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      modelName = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
      modelId   = modelId.replace(/[^a-zA-Z0-9._-]/g, "");

      if (!position || typeof position !== "object") position = { x: 0, y: 0, z: 0 };
      if (typeof scale !== "number" || scale < 0.01 || scale > 100) scale = 1;

      ["x", "y", "z"].forEach((axis) => {
        const v = position[axis];
        position[axis] = (typeof v === "number" && isFinite(v)) ? Math.max(-1000, Math.min(1000, v)) : 0;
      });
      const { x, y, z } = position;

      if (applyColor) {
        if (!color && flock.objectColours && flock.objectColours[modelName]) {
          color = flock.objectColours[modelName];
        } else if (!color) {
          color = ["#FFFFFF", "#FFFFFF"];
        }
      }

      // Parse "name__blockKey"
      let blockKey = modelId;
      let desiredName = modelId;
      if (desiredName.includes("__")) [desiredName, blockKey] = desiredName.split("__");

      // Reserve final unique name (only actual name collisions cause suffixes)
      let meshName = flock._reserveName(desiredName);
      const groupName = desiredName;

      // Create readiness deferred (resolve OR reject) + abort cleanup
      let resolveReady, rejectReady;
      const readyPromise = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
      flock.modelReadyPromises.set(meshName, readyPromise);

      const signal = flock.abortController?.signal;
      const onAbort = () => {
        try { rejectReady(new Error("aborted")); } catch {}
        flock.modelReadyPromises.delete(meshName);
        flock._releaseName?.(meshName);
        signal?.removeEventListener("abort", onAbort);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      const cleanupAbort = () => signal?.removeEventListener("abort", onAbort);

      // ===== A) CACHE HIT → clone hidden template =====
      if (flock.modelCache[modelName]) {
        const firstMesh = flock.modelCache[modelName];
        const mesh = firstMesh.clone(blockKey);
        mesh.scaling.copyFrom(flock.BABYLON.Vector3.One());
        mesh.position.copyFrom(flock.BABYLON.Vector3.Zero());

        flock.setupMesh(mesh, modelName, meshName, blockKey, scale, x, y, z, color);
        if (applyColor) flock.changeColorMesh(mesh, color);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        mesh.setEnabled(true);

        const all = [mesh, ...mesh.getDescendants(false).filter(n => n instanceof flock.BABYLON.AbstractMesh)];
        all.forEach((m) => { m.isPickable = true; m.setEnabled(true); });

        flock.announceMeshReady(meshName, groupName);
        flock._markNameCreated(meshName);
        resolveReady(mesh);
        cleanupAbort();

        if (callback) requestAnimationFrame(callback);

        setTimeout(() => { flock.modelReadyPromises.delete(meshName); }, 5000);
        return meshName;
      }

      // ===== B) CACHE MISS but model already loading → wait, then clone =====
      if (flock.modelsBeingLoaded[modelName]) {
        flock.modelsBeingLoaded[modelName]
          .then(() => {
            if (!flock.modelCache[modelName]) throw new Error("Template missing after load");
            const firstMesh = flock.modelCache[modelName];
            const mesh = firstMesh.clone(blockKey);
            mesh.scaling.copyFrom(flock.BABYLON.Vector3.One());
            mesh.position.copyFrom(flock.BABYLON.Vector3.Zero());

            flock.setupMesh(mesh, modelName, meshName, blockKey, scale, x, y, z, color);
            if (applyColor) flock.changeColorMesh(mesh, color);
            mesh.computeWorldMatrix(true);
            mesh.refreshBoundingInfo();

            const all = [mesh, ...mesh.getDescendants(false).filter(n => n instanceof flock.BABYLON.AbstractMesh)];
            all.forEach((m) => { m.isPickable = true; m.setEnabled(true); });

            flock.announceMeshReady(meshName, groupName);
            flock._markNameCreated(meshName);
            if (callback) requestAnimationFrame(callback);

            resolveReady(mesh);
            cleanupAbort();
          })
          .catch((err) => {
            console.error("createObject (clone-after-load) failed:", err);
            rejectReady(err);
            flock._releaseName(meshName);
            flock.modelReadyPromises.delete(meshName);
            cleanupAbort();
          })
          .finally(() => {
            setTimeout(() => { flock.modelReadyPromises.delete(meshName); }, 5000);
          });

        return meshName;
      }

      // ===== C) First load → AssetContainer → cache hidden template → configure live =====
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath, modelName, flock.scene
      );
      flock.modelsBeingLoaded[modelName] = loadPromise;

      loadPromise
        .then((container) => {
          if (applyColor) flock.ensureStandardMaterial(container.meshes[0]);
          container.addAllToScene();

          // Hidden template for future clones
          const firstMesh = container.meshes[0].clone(`${modelName}_first`);
          firstMesh.setEnabled(false);
          firstMesh.isPickable = false;
          firstMesh.getChildMeshes().forEach((child) => {
            child.isPickable = false;
            child.setEnabled(false);
          });

          // Mark internal materials
          container.meshes.forEach((m) => {
            if (m.id !== "__root__" && m.material) {
              m.material.metadata = m.material.metadata || {};
              m.material.metadata.internal = true;
            }
          });

          flock.modelCache[modelName] = firstMesh;

          // Live instance
          const live = container.meshes[0];
          live.isPickable = true;
          live.setEnabled(true);
          live.getChildMeshes().forEach((child) => { child.isPickable = true; child.setEnabled(true); });

          flock.setupMesh(live, modelName, meshName, blockKey, scale, x, y, z, color);
          if (applyColor) flock.changeColorMesh(live, color);

          requestAnimationFrame(() => {
            const mesh = flock.scene.getMeshByName(meshName) || live;

            flock.announceMeshReady(meshName, groupName);
            flock._markNameCreated(meshName);
            if (callback) callback();

            resolveReady(mesh);
            cleanupAbort();

            // Allow container GC
            releaseContainer(container);
          });
        })
        .catch((error) => {
          console.error(`Error loading model: ${modelName}`, error);
          rejectReady(error);
          flock._releaseName(meshName);
          flock.modelReadyPromises.delete(meshName);
          cleanupAbort();
        })
        .finally(() => {
          delete flock.modelsBeingLoaded[modelName];
          setTimeout(() => { flock.modelReadyPromises.delete(meshName); }, 5000);
        });

      return meshName;
    } catch (error) {
      console.warn("createObject: Error creating object:", error);
      return "error_" + flock.scene.getUniqueId();
    }
  },
  createModel({
    modelName,
    modelId,
    scale = 1,
    position = { x: 0, y: 0, z: 0 },
    callback = null,
  }) {
    return flock.createObject({
      modelName,
      modelId,
      scale,
      position,
      callback,
      applyColor: false,
    });
  },
  releaseContainer(container, { disposeAnims = false } = {}) {
    try {
      if (disposeAnims) {
        container.animationGroups?.forEach(ag => ag.dispose?.());
      }
      // Drop references so the container itself can be GC’d
      container.meshes = [];
      container.materials = [];
      container.textures = [];
      container.skeletons = [];
      container.animationGroups = [];
    } catch (_) { /* ignore */ }
  }

};