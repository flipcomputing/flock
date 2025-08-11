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
    // Helper to drop container references (do NOT call container.dispose() after addAllToScene)
    const releaseContainer = (container) => {
      try {
        container.meshes = [];
        container.materials = [];
        container.textures = [];
        container.skeletons = [];
        container.animationGroups = [];
      } catch (_) {}
    };

    const { x, y, z } = position;

    let blockKey;
    if (modelId.includes("__")) {
      [modelId, blockKey] = modelId.split("__");
    }

    let groupName = modelId;
    if (flock.scene.getMeshByName(modelId)) {
      modelId = modelId + "_" + flock.scene.getUniqueId();
    }

    if (flock.callbackMode) {
      // ✅ Create deferred promise now (resolve with the mesh, not the container)
      let resolveLater;
      const pendingPromise = new Promise((resolve) => {
        resolveLater = resolve;
      });

      // ✅ Store immediately to avoid race conditions
      flock.modelReadyPromises.set(modelId, pendingPromise);

      flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
        null,
        null,
        { signal: flock.abortController.signal },
      )
        .then((container) => {
          container.addAllToScene();
          const mesh = container.meshes[0];

          const bb = flock.setupMesh(
            mesh,
            modelName,
            modelId,
            blockKey,
            scale,
            x,
            y,
            z,
          );

          flock.ensureStandardMaterial(mesh);
          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          // Hide the character initially
          mesh.setEnabled(false);

          // Load animations first
          const animationPromises = ["Idle", "Walk", "Jump"].map((name) =>
            flock.switchToAnimation(flock.scene, bb, name, false, false, false),
          );

          // Wait for all animations to load, then add a delay to ensure they're fully processed
          Promise.all(animationPromises).then(async () => {
            // Run callback if present
            if (callback) {
              try {
                const result = callback();
                // Check if callback returns a promise
                if (result && typeof result.then === 'function') {
                  await result; // Wait for the promise to fully resolve
                }
              } catch (error) {
                console.error("Callback error:", error);
              }
            }
          }).then(() => {
            // Show the character after everything completes
            mesh.setEnabled(true);
          });

          flock.announceMeshReady(modelId, groupName);

          resolveLater(mesh);

          // 🔑 Allow the AssetContainer object itself to be GC'd (keep anims/skeletons in scene)
          releaseContainer(container);
        })
        .catch((error) => {
          console.log("❌ Error loading character:", error);
          flock.modelReadyPromises.delete(modelId);
          throw error;
        })
        .finally(() => {
          setTimeout(() => {
            flock.modelReadyPromises.delete(modelId);
          }, 1000);
        });

      return modelId;
    } else {
      // Polling mode fallback
      flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
        null,
        null,
        { signal: flock.abortController.signal },
      )
        .then((container) => {
          container.addAllToScene();
          const mesh = container.meshes[0];

          const bb = flock.setupMesh(
            mesh,
            modelName,
            modelId,
            blockKey,
            scale,
            x,
            y,
            z,
          );

          flock.ensureStandardMaterial(mesh);
          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          // Hide the character initially
          mesh.setEnabled(false);

          // Load animations first
          const animationPromises = ["Idle", "Walk", "Jump"].map((name) =>
            flock.switchToAnimation(flock.scene, bb, name, false, false, false),
          );

          // Wait for all animations to load, then add a delay to ensure they're fully processed
          Promise.all(animationPromises).then(async () => {
            // Run callback if present
            if (callback) {
              try {
                const result = callback();
                // Check if callback returns a promise
                if (result && typeof result.then === 'function') {
                  await result; // Wait for the promise to fully resolve
                }
              } catch (error) {
                console.error("Callback error:", error);
              }
            }
          }).then(() => {
            // Show the character after everything completes
            mesh.setEnabled(true);
          });

          flock.announceMeshReady(modelId, groupName);

          // 🔑 Drop container references (characters keep their scene anims/skeletons)
          releaseContainer(container);
        })
        .catch((error) => {
          console.log("❌ Error loading character (fallback):", error);
          throw error;
        });

      return modelId;
    }
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
    // Helper (scoped here to keep the patch self-contained)
    const releaseContainer = (container) => {
      try {
        // Do NOT call container.dispose() after addAllToScene() — it would dispose scene assets.
        container.meshes = [];
        container.materials = [];
        container.textures = [];
        container.skeletons = [];
        container.animationGroups = [];
      } catch (_) {}
    };

    try {
      if (applyColor) {
        if (!color && flock.objectColours && flock.objectColours[modelName]) {
          color = flock.objectColours[modelName];
        } else if (!color) {
          color = ["#FFFFFF", "#FFFFFF"];
        }
      }

      if (!modelName || typeof modelName !== "string" || modelName.length > 100) {
        console.warn("createObject: Invalid modelName parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      if (!modelId || typeof modelId !== "string" || modelId.length > 100) {
        console.warn("createObject: Invalid modelId parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      modelName.replace(/[^a-zA-Z0-9._-]/g, "");
      modelId.replace(/[^a-zA-Z0-9._-]/g, "");

      if (!position || typeof position !== "object") {
        console.warn("createObject: Invalid position parameter");
        position = { x: 0, y: 0, z: 0 };
      }

      if (typeof scale !== "number" || scale < 0.01 || scale > 100) {
        scale = 1;
      }

      ["x", "y", "z"].forEach((axis) => {
        if (typeof position[axis] !== "number" || !isFinite(position[axis])) {
          position[axis] = 0;
        }
        position[axis] = Math.max(-1000, Math.min(1000, position[axis]));
      });

      const { x, y, z } = position;

      let blockKey = modelId;
      let meshName = modelId;
      if (modelId.includes("__")) {
        [meshName, blockKey] = modelId.split("__");
      }

      let groupName = meshName;

      if (
        flock.scene.getMeshByName(meshName) ||
        flock.modelsBeingLoaded[modelName]
      ) {
        meshName = meshName + "_" + flock.scene.getUniqueId();
      }

      // --- Cache hit: clone from cached "first" mesh ---
      if (flock.modelCache[modelName]) {
        const firstMesh = flock.modelCache[modelName];
        const mesh = firstMesh.clone(blockKey);
        mesh.scaling.copyFrom(flock.BABYLON.Vector3.One());
        mesh.position.copyFrom(flock.BABYLON.Vector3.Zero());

        flock.setupMesh(
          mesh,
          modelName,
          meshName,
          blockKey,
          scale,
          x,
          y,
          z,
          color,
        );
        if (applyColor) flock.changeColorMesh(mesh, color);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        mesh.setEnabled(true);

        // Keep existing behaviour: make descendants enabled & pickable
        const allDescendantMeshes = [
          mesh,
          ...mesh
            .getDescendants(false)
            .filter((node) => node instanceof flock.BABYLON.AbstractMesh),
        ];
        allDescendantMeshes.forEach((m) => {
          m.isPickable = true;
          m.setEnabled(true);
        });

        flock.announceMeshReady(meshName, groupName);

        // Store a resolved promise for this clone (unchanged public contract)
        const resolved = Promise.resolve(mesh);
        flock.modelReadyPromises.set(meshName, resolved);

        if (callback) requestAnimationFrame(callback);
        return meshName;
      }

      // --- Cache miss but model currently loading: wait, then clone ---
      if (flock.modelsBeingLoaded[modelName]) {
        let resolveLater;
        const pendingPromise = new Promise((resolve) => {
          resolveLater = resolve;
        });
        flock.modelReadyPromises.set(meshName, pendingPromise);

        flock.modelsBeingLoaded[modelName].then(() => {
          if (flock.modelCache[modelName]) {
            const firstMesh = flock.modelCache[modelName];
            const mesh = firstMesh.clone(blockKey);
            mesh.scaling.copyFrom(flock.BABYLON.Vector3.One());
            mesh.position.copyFrom(flock.BABYLON.Vector3.Zero());

            flock.setupMesh(
              mesh,
              modelName,
              meshName,
              blockKey,
              scale,
              x,
              y,
              z,
              color,
            );
            if (applyColor) flock.changeColorMesh(mesh, color);
            mesh.computeWorldMatrix(true);
            mesh.refreshBoundingInfo();

            const allDescendantMeshes = [
              mesh,
              ...mesh
                .getDescendants(false)
                .filter(
                  (node) => node instanceof flock.BABYLON.AbstractMesh,
                ),
            ];
            allDescendantMeshes.forEach((m) => {
              m.isPickable = true;
              m.setEnabled(true);
            });

            flock.announceMeshReady(meshName, groupName);
            if (callback) requestAnimationFrame(callback);

            resolveLater(mesh);
          }
        });

        return meshName;
      }

      // --- Cache miss: load via AssetContainer, but don't retain it ---
      let resolveReady;
      const readyPromise = new Promise((res) => (resolveReady = res));
      flock.modelReadyPromises.set(meshName, readyPromise);

      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
      );

      flock.modelsBeingLoaded[modelName] = loadPromise;

      loadPromise
        .then((container) => {
          if (applyColor) flock.ensureStandardMaterial(container.meshes[0]);

          container.addAllToScene();

          // Create hidden template for future clones
          const firstMesh = container.meshes[0].clone(`${modelName}_first`);
          firstMesh.setEnabled(false);
          firstMesh.isPickable = false;
          firstMesh.getChildMeshes().forEach((child) => {
            child.isPickable = false;
            child.setEnabled(false);
          });

          // Mark internal materials if desired (unchanged behaviour)
          container.meshes.forEach((m) => {
            if (m.id != "__root__" && m.material) {
              m.material.metadata = m.material.metadata || {};
              m.material.metadata.internal = true;
            }
          });

          flock.modelCache[modelName] = firstMesh;

          // Configure the live instance that came from the container
          const live = container.meshes[0];
          live.isPickable = true;
          live.setEnabled(true);
          live.getChildMeshes().forEach((child) => {
            child.isPickable = true;
            child.setEnabled(true);
          });

          flock.setupMesh(
            live,
            modelName,
            meshName,
            blockKey,
            scale,
            x,
            y,
            z,
            color,
          );

          if (applyColor) flock.changeColorMesh(live, color);

          requestAnimationFrame(() => {
            const mesh = flock.scene.getMeshByName(meshName);
            flock.announceMeshReady(meshName, groupName);
            if (callback) callback();
            resolveReady(mesh);

            // 🔑 Allow the AssetContainer to be garbage-collected
            releaseContainer(container);
          });
        })
        .catch((error) => {
          console.error(`Error loading model: ${modelName}`, error);
          flock.modelReadyPromises.delete(meshName);
        })
        .finally(() => {
          delete flock.modelsBeingLoaded[modelName];
          setTimeout(() => {
            flock.modelReadyPromises.delete(meshName);
          }, 5000);
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