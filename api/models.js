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
      // ✅ Create deferred promise now
      let resolveLater;
      const pendingPromise = new Promise((resolve) => {
        resolveLater = resolve;
      });

      // ✅ Store immediately to avoid race conditions
      flock.modelReadyPromises.set(modelId, pendingPromise);
      /*console.log(
        "📦 [character] Storing early pending modelReadyPromise",
        modelId,
      );*/

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
          flock.setupMesh(mesh, modelName, modelId, blockKey, scale, x, y, z);

          //if (modelName.startsWith("Character"))
            flock.ensureStandardMaterial(mesh);
          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          flock.announceMeshReady(modelId, groupName);

          if (callback) {
            requestAnimationFrame(() => callback());
          }

          resolveLater(mesh);
          //console.log("✅ [character] Resolved modelReadyPromise", modelId);
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

          flock.setupMesh(mesh, modelName, modelId, blockKey, scale, x, y, z);

          //if (modelName.startsWith("Character")) {
            flock.ensureStandardMaterial(mesh);
         // }

          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          flock.announceMeshReady(modelId, groupName);

          if (callback) {
            requestAnimationFrame(() => callback());
          }
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
    //console.log("📦 [model] Creating object", modelName, modelId);
    try {
      if (applyColor) {
        if (!color && flock.objectColours && flock.objectColours[modelName]) {
          color = flock.objectColours[modelName];
        } else if (!color) {
          color = ["#FFFFFF", "#FFFFFF"];
        }
      }

      if (
        !modelName ||
        typeof modelName !== "string" ||
        modelName.length > 100
      ) {
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

        const allDescendantMeshes = [
          mesh,
          ...mesh
            .getDescendants(false)
            .filter((node) => node instanceof flock.BABYLON.AbstractMesh),
        ];
  
        allDescendantMeshes.forEach((mesh) => {
          mesh.isPickable = true;
          mesh.setEnabled(true);
        });

        flock.announceMeshReady(meshName, groupName);

        // ✅ FIX: Store resolved promise for clones too
        const resolved = Promise.resolve(mesh);
        flock.modelReadyPromises.set(meshName, resolved);
        /*console.log(
          "Storing resolved modelReadyPromise for clone",
          meshName,
          resolved,
        );*/

        if (callback) {
          requestAnimationFrame(callback);
        }

        return meshName;
      }
  
      if (flock.modelsBeingLoaded[modelName]) {
        // 👇 Create a deferred promise to resolve later
        let resolveLater;
        const pendingPromise = new Promise((resolve) => {
          resolveLater = resolve;
        });

        // Immediately store the pending promise under meshName
        flock.modelReadyPromises.set(meshName, pendingPromise);
        /*console.log(
          "📦 [deferred] Storing early pending modelReadyPromise",
          meshName,
          pendingPromise,
        );*/

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
                .filter((node) => node instanceof flock.BABYLON.AbstractMesh),
            ];
            allDescendantMeshes.forEach((mesh) => {
              mesh.isPickable = true;
              mesh.setEnabled(true);
            });

            flock.announceMeshReady(meshName, groupName);

            if (callback) {
              requestAnimationFrame(callback);
            }

            // ✅ Resolve the previously stored promise
            resolveLater(mesh);
            //console.log("✅ [deferred] Resolving modelReadyPromise after model load", meshName);
          }
        });

        return meshName;
      }
      // ✅ Create and immediately register the promise
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
      );

      flock.modelReadyPromises.set(meshName, loadPromise);
      //console.log("Storing modelReadyPromise", meshName, loadPromise);

      flock.modelsBeingLoaded[modelName] = loadPromise;

      loadPromise
        .then((container) => {
          if (applyColor) flock.ensureStandardMaterial(container.meshes[0]);

          container.addAllToScene();

          const firstMesh = container.meshes[0].clone(`${modelName}_first`);
          firstMesh.setEnabled(false);
          firstMesh.isPickable = false;
          firstMesh.getChildMeshes().forEach((child) => {
            child.isPickable = false;
            child.setEnabled(false);
          });
          
          container.meshes.forEach(mesh => {
            if (mesh.id != "__root__") {
              mesh.material.metadata = mesh.material.metadata || {};
              mesh.material.metadata.internal = true;
            }
          });

          flock.modelCache[modelName] = firstMesh;

          container.meshes[0].isPickable = true;
          container.meshes[0].setEnabled(true);
          container.meshes[0].getChildMeshes().forEach((child) => {
            child.isPickable = true;
            child.setEnabled(true);
          });

          flock.setupMesh(
            container.meshes[0],
            modelName,
            meshName,
            blockKey,
            scale,
            x,
            y,
            z,
            color,
          );

          if (applyColor) flock.changeColorMesh(container.meshes[0], color);

          return new Promise((resolve) => {
            requestAnimationFrame(() => {
              const mesh = flock.scene.getMeshByName(meshName);
              flock.announceMeshReady(meshName, groupName);
              if (callback) callback();
              resolve(mesh);
            });
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
};
