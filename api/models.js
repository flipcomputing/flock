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

    // --- validate ---
    if (!modelName || typeof modelName !== "string" || modelName.length > 100) {
      console.warn("createCharacter: invalid modelName");
      return "error_" + flock.scene.getUniqueId();
    }
    if (!modelId || typeof modelId !== "string" || modelId.length > 100) {
      console.warn("createCharacter: invalid modelId");
      return "error_" + flock.scene.getUniqueId();
    }

    // --- parse BEFORE sanitizing so blockKey remains RAW ---
    let desiredBase = modelId; // e.g. "player__j9#WY5..."
    let blockKey = null;
    if (desiredBase.includes("__")) {
      [desiredBase, blockKey] = desiredBase.split("__");
    }
    // If no "__" was provided, fall back to base as the key (keeps prior behavior safe)
    if (!blockKey) blockKey = desiredBase;

    // --- sanitize ONLY modelName + BASE (NOT the blockKey) ---
    modelName   = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
    desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

    // --- compose final runtime name using RAW key, and reserve it ---
    const desiredFinalName = `${desiredBase}__${blockKey}`;
    const meshName  = flock._reserveName(desiredFinalName); // may suffix on true collision
    const groupName = desiredBase;                          // group by base for onTrigger applyToGroup

    // position/scale clamps
    const x = Number.isFinite(position?.x) ? Math.max(-1000, Math.min(1000, position.x)) : 0;
    const y = Number.isFinite(position?.y) ? Math.max(-1000, Math.min(1000, position.y)) : 0;
    const z = Number.isFinite(position?.z) ? Math.max(-1000, Math.min(1000, position.z)) : 0;
    if (!(typeof scale === "number" && scale >= 0.01 && scale <= 100)) scale = 1;

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

    // --- single load path ---
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

        // make descendants interactive
        const descendants = mesh.getChildMeshes(false);
        descendants.forEach((childMesh) => {
          if (childMesh.getTotalVertices() > 0) {
            childMesh.isPickable = true;
            childMesh.flipFaces(true);
          }
        });

        // Hide initially (readiness still announced so others can wire up)
        mesh.setEnabled(false);

        // Preload animations (non-blocking for readiness)
        const animationPromises = ["Idle", "Walk", "Jump"].map((name) =>
          flock.switchToAnimation(flock.scene, bb, name, false, false, false)
        );

        // After anims, run optional callback (await if it returns a promise), then show
        Promise.all(animationPromises)
          .then(async () => {
            if (callback) {
              try {
                const result = callback();
                if (result && typeof result.then === "function") await result;
              } catch (err) {
                console.error("Callback error:", err);
              }
            }
          })
          .then(() => {
            mesh.setEnabled(true);
          });

        // Announce readiness as soon as mesh is configured
        flock.announceMeshReady(meshName, groupName);
        flock._markNameCreated(meshName);
        resolveReady(mesh);
        cleanupAbort();

        // Allow the container to be GC'd (anims/skeletons are now in the scene)
        releaseContainer(container);
      })
      .catch((error) => {
        console.log("❌ Error loading character:", error);
        rejectReady(error);
        flock._releaseName(meshName);
        flock.modelReadyPromises.delete(meshName);
        cleanupAbort();
      })
      .finally(() => {
        // Optional: drop resolved entry after a short TTL to avoid map growth
        setTimeout(() => {
          flock.modelReadyPromises.delete(meshName);
        }, 5000);
      });

    // Return the final (possibly suffixed) id
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
      // Validate
      if (!modelName || typeof modelName !== "string" || modelName.length > 100) {
        console.warn("createObject: Invalid modelName parameter");
        return "error_" + flock.scene.getUniqueId();
      }
      if (!modelId || typeof modelId !== "string" || modelId.length > 100) {
        console.warn("createObject: Invalid modelId parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      // Parse BEFORE sanitizing so blockKey remains RAW (unchanged)
      let desiredBase = modelId;  // e.g. "star__zq?)gH+/2$^1Sh9Cbmky"
      let blockKey = null;
      if (desiredBase.includes("__")) {
        [desiredBase, blockKey] = desiredBase.split("__");
      }
      // If no "__" provided, fall back to base as the key (previous behavior)
      if (!blockKey) blockKey = desiredBase;

      // Sanitize ONLY modelName + BASE (NOT the blockKey)
      modelName   = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
      desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

      // Final runtime name uses RAW blockKey so mapping works: base__blockKey
      const desiredFinalName = `${desiredBase}__${blockKey}`;

      // Position/scale clamps
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

      // Reserve the actual runtime name; group by BASE (intuitive for onTrigger)
      let meshName = flock._reserveName(desiredFinalName);
      const groupName = desiredBase;

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