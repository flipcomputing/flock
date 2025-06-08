let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockModels = {
  createCharacter2({
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

    if (flock.scene.getMeshByName(modelId)) {
      modelId = modelId + "_" + flock.scene.getUniqueId();
    }
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
        flock.setupMesh(
          mesh,
          modelName,
          modelId,
          blockKey,
          scale,
          x,
          y,
          z,
        );

        if (modelName.startsWith("Character"))
          flock.ensureStandardMaterial(mesh);
        flock.applyColorsToCharacter(mesh, colors);

        const descendants = mesh.getChildMeshes(false);
        descendants.forEach((childMesh) => {
          if (childMesh.getTotalVertices() > 0) {
            // Ensure it has geometry
            childMesh.isPickable = true;
            childMesh.flipFaces(true);
          }
        });

        if (callback) {
          requestAnimationFrame(() => callback());
        }
      })
      .catch((error) => {
        console.log("Error loading", error);
      });

    return modelId;
  },
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

    if (flock.scene.getMeshByName(modelId)) {
      modelId = modelId + "_" + flock.scene.getUniqueId();
    }

    if (flock.callbackMode) {
      // Create promise with proper error handling and cleanup
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
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
          flock.setupMesh(
            mesh,
            modelName,
            modelId,
            blockKey,
            scale,
            x,
            y,
            z,
          );

          if (modelName.startsWith("Character"))
            flock.ensureStandardMaterial(mesh);
          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              // Ensure it has geometry
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          if (callback) {
            requestAnimationFrame(() => callback());
          }

          // Return the mesh for whenModelReady to use
          return mesh;
        })
        .catch((error) => {
          console.log("Error loading", error);
          // Clean up on error to prevent memory leaks
          flock.modelReadyPromises.delete(modelId);
          throw error;
        });

      // Store promise immediately to prevent race conditions
      flock.modelReadyPromises.set(modelId, loadPromise);

      // Clean up promise after a reasonable delay to allow dependent operations
      loadPromise.finally(() => {
        setTimeout(() => {
          flock.modelReadyPromises.delete(modelId);
        }, 1000); // Reduced from 5000ms for faster cleanup
      });

      return modelId;
    } else {
      // Use promise-based approach (original createCharacter style)
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
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

          if (modelName.startsWith("Character")) {
            flock.ensureStandardMaterial(mesh);
          }

          flock.applyColorsToCharacter(mesh, colors);

          const descendants = mesh.getChildMeshes(false);
          descendants.forEach((childMesh) => {
            if (childMesh.getTotalVertices() > 0) {
              childMesh.isPickable = true;
              childMesh.flipFaces(true);
            }
          });

          if (callback) {
            requestAnimationFrame(() => callback());
          }

          // Return nothing! Setup already handled it.
          return;
        })
        .catch((error) => {
          console.log("Error loading", error);
          throw error;
        });

      // Don't store promise in this mode - use generator approach instead

      return modelId;
    }
  },
  createObject({
    modelName,
    modelId,
    color = ["#FFFFFF", "#FFFFFF"],
    scale = 1,
    position = { x: 0, y: 0, z: 0 },
    callback = null,
  } = {}) {
    try {
      // Basic parameter validation with warnings
      if (!modelName) {
        console.warn("createObject: Missing modelName parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      if (!modelId) {
        console.warn("createObject: Missing modelId parameter");
        return "error_" + flock.scene.getUniqueId();
      }

      if (!position || typeof position !== "object") {
        console.warn("createObject: Invalid position parameter");
        position = { x: 0, y: 0, z: 0 };
      }

      const { x, y, z } = position;

      let blockKey = modelId;
      let meshName = modelId;  // Default meshName to modelId
      if (modelId.includes("__")) {
        [meshName, blockKey] = modelId.split("__");
      }

      // Debug output for concurrency test
      //console.log(`createObject: modelName=${modelName}, modelId=${modelId}, meshName=${meshName}, blockKey=${blockKey}`);

      if (
        flock.scene.getMeshByName(meshName) ||
        flock.modelsBeingLoaded[modelName]
      ) {
        meshName = meshName + "_" + flock.scene.getUniqueId();
        //console.log(`createObject: Updated meshName to avoid collision: ${meshName}`);
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
        flock.changeColorMesh(mesh, color);
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
        if (callback) {
          requestAnimationFrame(callback);
        }
        return meshName;
      }

      if (flock.modelsBeingLoaded[modelName]) {
        //console.log(`Waiting for model to load: ${modelName}`);
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
            flock.changeColorMesh(mesh, color);
            mesh.computeWorldMatrix(true);
            mesh.refreshBoundingInfo();
            const allDescendantMeshes = [
              mesh,
              ...mesh
                .getDescendants(false)
                .filter(
                  (node) =>
                    node instanceof flock.BABYLON.AbstractMesh,
                ),
            ];
            allDescendantMeshes.forEach((mesh) => {
              mesh.isPickable = true;
              mesh.setEnabled(true);
            });
            if (callback) {
              requestAnimationFrame(callback);
            }
          }
        });
        return meshName;
      }

      // Use unified approach with optimization systems for both modes
      const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
        flock.modelPath,
        modelName,
        flock.scene,
      )
        .then((container) => {
          flock.ensureStandardMaterial(container.meshes[0]);

          // First, add everything to the scene
          container.addAllToScene();

          // Create the template mesh AFTER adding to scene
          const firstMesh = container.meshes[0].clone(
            `${modelName}_first`,
          );
          firstMesh.setEnabled(false);
          firstMesh.isPickable = false;

          // Make sure all children of the template are also not pickable
          firstMesh.getChildMeshes().forEach((child) => {
            child.isPickable = false;
            child.setEnabled(false);
          });

          // Store in cache
          flock.modelCache[modelName] = firstMesh;

          // Make sure the original mesh and its children ARE pickable and enabled
          container.meshes[0].isPickable = true;
          container.meshes[0].setEnabled(true);
          container.meshes[0]
            .getChildMeshes()
            .forEach((child) => {
              child.isPickable = true;
              child.setEnabled(true);
            });

          // Setup and color the active mesh
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
          flock.changeColorMesh(container.meshes[0], color);

          // Ensure physics setup is complete before resolving
          // Use requestAnimationFrame to ensure all synchronous setup is done
          return new Promise((resolve) => {
            requestAnimationFrame(() => {
              // Verify physics was created
              const mesh = flock.scene.getMeshByName(meshName);
              if (mesh && mesh.physics) {
                //console.log(`Physics setup verified for ${meshName}`);
              } else {
                //console.warn(`Physics missing for ${meshName} after setup`);
              }

              if (callback) {
                callback();
              }
              resolve(mesh);
            });
          });
        })
        .catch((error) => {
          console.error(
            `Error loading model: ${modelName}`,
            error,
          );
          // Clean up promise on error
          flock.modelReadyPromises.delete(meshName);
        })
        .finally(() => {
          delete flock.modelsBeingLoaded[modelName];
          // Clean up promise after a delay to allow other operations to complete
          setTimeout(() => {
            flock.modelReadyPromises.delete(meshName);
          }, 5000);
        });

      // Always track the loading promise for optimization
      flock.modelsBeingLoaded[modelName] = loadPromise;

      // Store promise BEFORE starting async work to prevent race conditions
      flock.modelReadyPromises.set(meshName, loadPromise);

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
    const { x, y, z } = position;
    const blockId = modelId;
    modelId += "_" + flock.scene.getUniqueId();

    // Check if a first copy is already cached
    if (flock.modelCache[modelName]) {
      //console.log(`Using cached first model: ${modelName}`);

      // Clone from the cached first copy
      const firstMesh = flock.modelCache[modelName];
      const mesh = firstMesh.clone(blockId);

      // Reset transformations
      mesh.scaling.copyFrom(flock.BABYLON.Vector3.One());
      mesh.position.copyFrom(flock.BABYLON.Vector3.Zero());
      mesh.rotationQuaternion = null;
      mesh.rotation.copyFrom(flock.BABYLON.Vector3.Zero());

      flock.setupMesh(mesh, modelName, modelId, blockId, scale, x, y, z); // Neutral setup

      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
      mesh.setEnabled(true);
      mesh.visibility = 1;

      if (callback) {
        requestAnimationFrame(callback);
      }

      return modelId;
    }

    // Check if model is already being loaded
    if (flock.modelsBeingLoaded[modelName]) {
      //console.log(`Waiting for model to load: ${modelName}`);
      return flock.modelsBeingLoaded[modelName].then(() => {
        return flock.createModel({
          modelName,
          modelId,
          scale,
          position,
          callback,
        });
      });
    }

    // Start loading the model using unified approach
    //console.log(`Loading model: ${modelName}`);
    const loadPromise = flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
      flock.modelPath,
      modelName,
      flock.scene,
    )
      .then((container) => {
        // Clone a first copy from the first mesh
        const firstMesh = container.meshes[0].clone(
          `${modelName}_first`,
        );

        firstMesh.setEnabled(false); // Disable the first copy
        flock.modelCache[modelName] = firstMesh;

        container.addAllToScene();

        flock.setupMesh(
          container.meshes[0],
          modelName,
          modelId,
          blockId,
          scale,
          x,
          y,
          z,
        );

        if (callback) {
          requestAnimationFrame(callback);
        }
      })
      .catch((error) => {
        console.error(`Error loading model: ${modelName}`, error);
        // Clean up promise on error
        flock.modelReadyPromises.delete(modelId);
      })
      .finally(() => {
        delete flock.modelsBeingLoaded[modelName]; // Remove from loading map
        // Clean up promise after a delay to allow other operations to complete
        setTimeout(() => {
          flock.modelReadyPromises.delete(modelId);
        }, 5000);
      });

    // Always track the ongoing load for optimization
    flock.modelsBeingLoaded[modelName] = loadPromise;

    // Store promise BEFORE starting async work to prevent race conditions
    flock.modelReadyPromises.set(modelId, loadPromise);

    return modelId;
  },
}