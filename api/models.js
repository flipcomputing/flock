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

    const setTemplateFlags = (node, tag) => {
      const list = [
        node,
        ...node
          .getDescendants(false)
          .filter((n) => n instanceof flock.BABYLON.AbstractMesh),
      ];
      list.forEach((m) => {
        m.metadata = m.metadata || {};
        m.metadata.isTemplate = true;
        m.metadata.templateTag = tag;
        m.isPickable = false;
        if (typeof m.setEnabled === "function") m.setEnabled(false);
        m.isVisible = false;
        m.visibility = 0;
      });
    };

    const setInstanceFlags = (node) => {
      const list = [
        node,
        ...node
          .getDescendants(false)
          .filter((n) => n instanceof flock.BABYLON.AbstractMesh),
      ];
      list.forEach((m) => {
        if (m.metadata?.isTemplate) {
          m.metadata = { ...m.metadata, isTemplate: false };
        }
        m.isPickable = true;
        if (typeof m.setEnabled === "function") m.setEnabled(true);
        m.isVisible = true;
        m.visibility = 1;
      });
    };

    const finalizeMesh = (mesh, mName, gName, bKey) => {
      const bb = flock.setupMesh(
        mesh,
        modelName,
        mName,
        bKey,
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
      setInstanceFlags(mesh);

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
      flock.announceMeshReady(mName, gName);
      flock._markNameCreated(mName);
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
    const groundLevelSentinel = -999999;
    const numericY =
      typeof position?.y === "string" ? Number(position.y) : position?.y;
    const y =
      position?.y === "__ground__level__" || numericY === groundLevelSentinel
        ? position.y
        : Number.isFinite(position?.y)
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
    if (flock.modelCache[modelName]) {
      const mesh = flock.modelCache[modelName].clone(blockKey);
      finalizeMesh(mesh, meshName, groupName, blockKey);
      resolveReady(mesh);
      cleanupAbort();
    } else if (flock.modelsBeingLoaded[modelName]) {
      flock.modelsBeingLoaded[modelName]
        .then(() => {
          const mesh = flock.modelCache[modelName].clone(blockKey);
          finalizeMesh(mesh, meshName, groupName, blockKey);
          resolveReady(mesh);
          cleanupAbort();
        })
        .catch((error) => {
          console.log("❌ Error loading character:", error);
          rejectReady(error);
          flock._releaseName(meshName);
          flock.modelReadyPromises.delete(meshName);
          cleanupAbort();
        });
    } else {
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
        null,
        null,
        { signal: flock.abortController?.signal },
      );
      flock.modelsBeingLoaded[modelName] = loadPromise;

      loadPromise
        .then((container) => {
          container.addAllToScene();

          const mesh = container.meshes[0];
          const template = mesh.clone(`${modelName}_template`);
          setTemplateFlags(template, modelName);
          flock.modelCache[modelName] = template;

          finalizeMesh(mesh, meshName, groupName, blockKey);
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
        });
    }

    // Optional: drop resolved entry after a short TTL to avoid map growth
    setTimeout(() => {
      flock.modelReadyPromises.delete(meshName);
    }, 5000);

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

    const applyMaterialToHierarchy = (mesh, colorInput) => {
      if (!applyColor || !colorInput) return;

      flock.applyMaterialToHierarchy(mesh, color);
    };
    
    const setTemplateFlags = (node, tag) => {
      const list = [
        node,
        ...node
          .getDescendants(false)
          .filter((n) => n instanceof flock.BABYLON.AbstractMesh),
      ];
      list.forEach((m) => {
        m.metadata = m.metadata || {};
        m.metadata.isTemplate = true;
        m.metadata.templateTag = tag;
        m.isPickable = false;
        if (typeof m.setEnabled === "function") m.setEnabled(false);
        m.isVisible = false;
        m.visibility = 0;
      });
    };

    const setInstanceFlags = (node) => {
      const list = [
        node,
        ...node
          .getDescendants(false)
          .filter((n) => n instanceof flock.BABYLON.AbstractMesh),
      ];
      list.forEach((m) => {
        if (m.metadata?.isTemplate) {
          m.metadata = { ...m.metadata, isTemplate: false };
        }
        m.isPickable = true;
        if (typeof m.setEnabled === "function") m.setEnabled(true);
        m.isVisible = true;
        m.visibility = 1;
      });
    };

    const finalizeMesh = (mesh, mName, gName, bKey) => {
      flock.setupMesh(
        mesh,
        modelName,
        mName,
        bKey,
        scale,
        position.x,
        position.y,
        position.z,
        color,
      );
      applyMaterialToHierarchy(mesh, color);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo(true);
      setInstanceFlags(mesh);
      flock.announceMeshReady(mName, gName);
      flock._markNameCreated(mName);
      if (callback) requestAnimationFrame(callback);
    };

    try {
      let [desiredBase, bKey] = modelId.includes("__")
        ? modelId.split("__")
        : [modelId, modelId];
      modelName = modelName.replace(/[^a-zA-Z0-9._-]/g, "");
      desiredBase = desiredBase.replace(/[^a-zA-Z0-9._-]/g, "");

      const meshName = flock._reserveName(desiredBase);
      const groupName = desiredBase;

      if (applyColor && !color) {
        color = flock.objectColours?.[modelName] || ["#FFFFFF", "#FFFFFF"];
      }

      let resolveReady;
      const readyPromise = new Promise((res) => {
        resolveReady = res;
      });
      flock.modelReadyPromises.set(meshName, readyPromise);

      if (flock.modelCache[modelName]) {
        const mesh = flock.modelCache[modelName].clone(bKey);
        finalizeMesh(mesh, meshName, groupName, bKey);
        resolveReady(mesh);
        return meshName;
      }

      if (flock.modelsBeingLoaded[modelName]) {
        flock.modelsBeingLoaded[modelName].then(() => {
          const mesh = flock.modelCache[modelName].clone(bKey);
          finalizeMesh(mesh, meshName, groupName, bKey);
          resolveReady(mesh);
        });
        return meshName;
      }

      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
      );
      flock.modelsBeingLoaded[modelName] = loadPromise;

      // ... inside the loadPromise.then block ...

      loadPromise.then((container) => {
        container.addAllToScene();

        container.meshes.forEach((m) => {
          m.metadata = m.metadata || {};
          m.metadata.isTemplate = true;
          m.metadata.templateTag = modelName;

          // Only clear materials if we are intending to apply our own color system
          if (applyColor) {
            if (m.material) {
              m.material.dispose(true, true);
              m.material = null;
            }
          }

          m.isPickable = false;
        });

        const root = container.meshes[0];

        // Only force standard material if we are applying custom colors
        if (applyColor) {
          flock.ensureStandardMaterial(root);
        }

        const template = root.clone(`${modelName}_template`);
        setTemplateFlags(template, modelName);
        flock.modelCache[modelName] = template;

        finalizeMesh(root, meshName, groupName, bKey);
        resolveReady(root);
        releaseContainer(container);
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
