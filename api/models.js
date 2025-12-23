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
    modelName = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
    desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

    // --- compose final runtime name using RAW key, and reserve it ---
    const desiredFinalName = desiredBase;
    const meshName = flock._reserveName(desiredFinalName); // may suffix on true collision
    const groupName = desiredBase; // group by base for onTrigger applyToGroup

    // position/scale clamps
    const x = Number.isFinite(position?.x)
      ? Math.max(-1000, Math.min(1000, position.x))
      : 0;
    const y = Number.isFinite(position?.y)
      ? Math.max(-1000, Math.min(1000, position.y))
      : 0;
    const z = Number.isFinite(position?.z)
      ? Math.max(-1000, Math.min(1000, position.z))
      : 0;
    if (!(typeof scale === "number" && scale >= 0.01 && scale <= 100))
      scale = 1;

    // --- create readiness deferred (resolve OR reject) + abort hookup ---
    let resolveReady, rejectReady;
    const readyPromise = new Promise((res, rej) => {
      resolveReady = res;
      rejectReady = rej;
    });
    flock.modelReadyPromises.set(meshName, readyPromise);

    const signal = flock.abortController?.signal;
    const onAbort = () => {
      try {
        rejectReady(new Error("aborted"));
      } catch {}
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
      { signal: flock.abortController?.signal },
    )
      .then((container) => {
        container.addAllToScene();

        const mesh = container.meshes[0];
        const bb = flock.setupMesh(
          mesh,
          modelName,
          meshName,
          blockKey,
          scale,
          x,
          y,
          z,
        );

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
        const animationPromises = ["Walk", "Jump", "Idle"].map((name) =>
          flock.switchToAnimation(flock.scene, bb, name, false, false, false),
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
    const releaseContainer = (container) => {
      try {
        container.meshes = [];
        container.materials = [];
        container.textures = [];
        container.skeletons = [];
        container.animationGroups = [];
      } catch (_) {}
    };

    /**
     * Helper to ensure texture tiling matches world size
     */
    const adjustTiling = (mesh, mat) => {
      const tex = mat.diffuseTexture || mat.albedoTexture || mat.baseTexture;

      if (tex && typeof tex.uScale === "number") {
        const unitsPerTile = 2; 

        tex.wrapU = 1; // WRAP
        tex.wrapV = 1; // WRAP

        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        const extend = boundingInfo.boundingBox.extendSizeWorld; // Half-dimensions

        const worldWidth = extend.x * 2;
        const worldHeight = extend.y * 2;
        const worldDepth = extend.z * 2;

        let newUScale = worldWidth / unitsPerTile;
        let newVScale = (worldHeight > worldDepth ? worldHeight : worldDepth) / unitsPerTile;

        tex.uScale = newUScale || 1;
        tex.vScale = newVScale || 1;
      }
    };

    const applyMaterialToHierarchy = (mesh, colorInput) => {
      if (!applyColor || !colorInput) return;

      let targetMaterials = [];

      // Case: Single Object/Material
      if (colorInput && typeof colorInput === "object" && !Array.isArray(colorInput)) {
        const mat = (colorInput.materialName && !colorInput.getClassName) 
          ? flock.createMaterial(colorInput) 
          : colorInput;
        targetMaterials = [mat];
      } 
      // Case: Array of Materials
      else if (Array.isArray(colorInput) && colorInput.length && typeof colorInput[0] === "object") {
        targetMaterials = colorInput.map(c => 
          (c.materialName && !c.getClassName) ? flock.createMaterial(c) : c
        );
      } 
      // Case: Simple Color strings/hex
      else {
        flock.changeColorMesh(mesh, colorInput);
        return;
      }

      // Apply to Root
      if (targetMaterials[0]) {
        mesh.material = targetMaterials[0];
        adjustTiling(mesh, targetMaterials[0]);
      }

      // Apply to Children
      const children = mesh.getChildMeshes(false);
      children.forEach((child, i) => {
        const m = targetMaterials[i] || targetMaterials[0];
        if (m) {
          child.material = m;
          adjustTiling(child, m);
        }
      });
    };

    const finalizeMesh = (mesh, mName, gName, bKey) => {
      flock.setupMesh(mesh, modelName, mName, bKey, scale, position.x, position.y, position.z, color);
      applyMaterialToHierarchy(mesh, color);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();

      const all = [mesh, ...mesh.getDescendants(false).filter(n => n instanceof flock.BABYLON.AbstractMesh)];
      all.forEach(m => {
        m.isPickable = true;
        m.setEnabled(true);
      });

      flock.announceMeshReady(mName, gName);
      flock._markNameCreated(mName);
      if (callback) requestAnimationFrame(callback);
    };

    try {
      // Validation & Name Reservation
      let [desiredBase, bKey] = modelId.includes("__") ? modelId.split("__") : [modelId, modelId];
      modelName = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
      desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

      const meshName = flock._reserveName(desiredBase);
      const groupName = desiredBase;

      // Default Color Logic
      if (applyColor && !color) {
        color = flock.objectColours?.[modelName] || ["#FFFFFF", "#FFFFFF"];
      }

      // Promise for flock.whenModelReady
      let resolveReady;
      const readyPromise = new Promise(res => { resolveReady = res; });
      flock.modelReadyPromises.set(meshName, readyPromise);

      // PATH A: Cache
      if (flock.modelCache[modelName]) {
        const mesh = flock.modelCache[modelName].clone(bKey);
        finalizeMesh(mesh, meshName, groupName, bKey);
        resolveReady(mesh);
        return meshName;
      }

      // PATH B: Loading
      if (flock.modelsBeingLoaded[modelName]) {
        flock.modelsBeingLoaded[modelName].then(() => {
          const mesh = flock.modelCache[modelName].clone(bKey);
          finalizeMesh(mesh, meshName, groupName, bKey);
          resolveReady(mesh);
        });
        return meshName;
      }

      // PATH C: Fresh Load
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(flock.modelPath, modelName, flock.scene);
      flock.modelsBeingLoaded[modelName] = loadPromise;

      loadPromise.then((container) => {
        container.addAllToScene();
        const root = container.meshes[0];

        if (applyColor) flock.ensureStandardMaterial(root);

        // Cache Template
        const template = root.clone(`${modelName}_template`);
        template.setEnabled(false);
        template.isPickable = false;
        template.getChildMeshes().forEach(c => c.setEnabled(false));
        flock.modelCache[modelName] = template;

        // Finalize the one currently in scene
        finalizeMesh(root, meshName, groupName, bKey);
        resolveReady(root);
        releaseContainer(container);
      }).finally(() => {
        delete flock.modelsBeingLoaded[modelName];
      });

      return meshName;
    } catch (e) {
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
        container.animationGroups?.forEach((ag) => ag.dispose?.());
      }
      // Drop references so the container itself can be GC’d
      container.meshes = [];
      container.materials = [];
      container.textures = [];
      container.skeletons = [];
      container.animationGroups = [];
    } catch (_) {
      /* ignore */
    }
  },
};
