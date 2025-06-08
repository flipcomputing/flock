let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockScene = {
  /*
   Category: Scene
  */
  setSky(color) {
    // If color is a Babylon.js material, apply it directly
    if (flock.sky) {
      flock.disposeMesh(flock.sky);
    }
    if (color && color instanceof flock.BABYLON.Material) {
      const skySphere = flock.BABYLON.MeshBuilder.CreateSphere(
        "sky",
        { segments: 32, diameter: 1000 },
        flock.scene,
      );

      flock.sky = skySphere;
      color.diffuseTexture.uScale = 10.0;
      color.diffuseTexture.vScale = 10.0;
      skySphere.material = color;
      skySphere.isPickable = false; // Make non-interactive
    } else if (Array.isArray(color) && color.length === 2) {
      // Handle gradient case
      const skySphere = flock.BABYLON.MeshBuilder.CreateSphere(
        "sky",
        { segments: 32, diameter: 1000 },
        flock.scene,
      );
      flock.sky = skySphere;
      const gradientMaterial = new flock.GradientMaterial(
        "skyGradient",
        flock.scene,
      );

      gradientMaterial.bottomColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color[0]),
      );
      gradientMaterial.topColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color[1]),
      );
      gradientMaterial.offset = 0.8; // Push the gradient midpoint towards the top
      gradientMaterial.smoothness = 0.5; // Sharper gradient transition
      gradientMaterial.scale = 0.01;
      gradientMaterial.backFaceCulling = false; // Render on the inside of the sphere

      skySphere.material = gradientMaterial;
      skySphere.isPickable = false; // Make non-interactive
    } else {
      // Handle single color case
      flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );
    }
  },
  createGround(color, modelId) {
    if (flock.ground) {
      flock.disposeMesh(flock.ground);
    }
    const ground = flock.BABYLON.MeshBuilder.CreateGround(
      modelId,
      { width: 100, height: 100, subdivisions: 2 },
      flock.scene,
    );
    const blockId = modelId;
    const groundAggregate = new flock.BABYLON.PhysicsAggregate(
      ground,
      flock.BABYLON.PhysicsShapeType.BOX,
      { mass: 0, friction: 0.5 },
      flock.scene,
    );

    ground.name = modelId;
    ground.blockKey = blockId;
    ground.receiveShadows = true;
    const groundMaterial = new flock.BABYLON.StandardMaterial(
      "groundMaterial",
      flock.scene,
    );
    ground.physics = groundAggregate;

    groundMaterial.diffuseColor = flock.BABYLON.Color3.FromHexString(
      flock.getColorFromString(color),
    );
    ground.material = groundMaterial;
    flock.ground = ground;
  },
  createMap(image, material) {
    if (flock.ground) {
      flock.disposeMesh(flock.ground);
    }
    let ground;
    if (image === "NONE") {
      const modelId = "flatGround";
      ground = flock.BABYLON.MeshBuilder.CreateGround(
        modelId,
        { width: 100, height: 100, subdivisions: 2 },
        flock.scene,
      );
      const groundAggregate = new flock.BABYLON.PhysicsAggregate(
        ground,
        flock.BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5 },
        flock.scene,
      );
      ground.physics = groundAggregate;
      ground.name = modelId;
      ground.blockKey = modelId;
      ground.receiveShadows = true;
    } else {
      const minHeight = 0;
      const maxHeight = 10;
      ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
        "heightmap",
        flock.texturePath + image,
        {
          width: 100,
          height: 100,
          minHeight: minHeight,
          maxHeight: maxHeight,
          subdivisions: 64,
          onReady: (groundMesh) => {
            const vertexData = groundMesh.getVerticesData(
              flock.BABYLON.VertexBuffer.PositionKind,
            );
            let minDistance = Infinity;
            let closestY = 0;
            for (let i = 0; i < vertexData.length; i += 3) {
              const x = vertexData[i];
              const z = vertexData[i + 2];
              const y = vertexData[i + 1];
              const distance = Math.sqrt(x * x + z * z);
              if (distance < minDistance) {
                minDistance = distance;
                closestY = y;
              }
            }

            groundMesh.position.y -= closestY;
            const heightMapGroundShape =
              new flock.BABYLON.PhysicsShapeMesh(
                ground,
                flock.scene,
              );
            const heightMapGroundBody =
              new flock.BABYLON.PhysicsBody(
                ground,
                flock.BABYLON.PhysicsMotionType.STATIC,
                false,
                flock.scene,
              );
            heightMapGroundShape.material = {
              friction: 0.3,
              restitution: 0,
            };
            heightMapGroundBody.shape = heightMapGroundShape;
            heightMapGroundBody.setMassProperties({ mass: 0 });
          },
        },
        flock.scene,
      );
    }
    ground.name = "ground";
    ground.blockKey = "ground";

    //console.log("Scaling material");
    // Simply assign the passed-through material:
    if (material.diffuseTexture) {
      material.diffuseTexture.wrapU =
        flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      material.diffuseTexture.wrapV =
        flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      material.diffuseTexture.uScale = 25;
      material.diffuseTexture.vScale = 25;
    }
    ground.material = material;
    flock.ground = ground;
    return ground;
  },
  show(meshName) {
    // Check if the ID refers to a UI button
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.isVisible = true; // Hide the button
      return;
    }
    return flock.whenModelReady(meshName, function (mesh) {
      if (mesh) {
        mesh.setEnabled(true);
        // Only try to add physics body if mesh has physics
        if (mesh.physics && mesh.physics._pluginData) {
          flock.hk._hknp.HP_World_AddBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
            mesh.physics.startAsleep,
          );
        }
      } else {
        console.log("Model not loaded:", meshName);
      }
    });
  },
  hide(meshName) {
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.isVisible = false; // Hide the button
      return;
    }
    return flock.whenModelReady(meshName, async function (mesh) {
      if (mesh) {
        mesh.setEnabled(false);
        // Only try to remove physics body if mesh has physics
        if (mesh.physics && mesh.physics._pluginData) {
          flock.hk._hknp.HP_World_RemoveBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
          );
        }
      } else {
        console.log("Mesh not loaded:", meshName);
      }
    });
  },
  disposeMesh(mesh) {
    if (mesh.name === "ground") {
      mesh.material.dispose();
      mesh.dispose();
      flock.ground = null;
      return;
    }
    if (mesh.name === "sky") {
      mesh.material.dispose();
      mesh.dispose();
      flock.sky = null;
      return;
    }

    let meshesToDispose = [mesh];

    const particleSystem = flock.scene.particleSystems.find(
      (system) => system.name === mesh.name,
    );

    if (particleSystem) {
      particleSystem.dispose();
      return;
    }

    if (mesh.getChildMeshes) {
      meshesToDispose = mesh.getChildMeshes().concat(mesh);
    }

    const disposedMaterials = new Set();

    // Process AnimationGroups
    flock.scene.animationGroups.slice().forEach((animationGroup) => {
      const targets = animationGroup.targetedAnimations.map(
        (anim) => anim.target,
      );

      if (
        targets.some((target) => meshesToDispose.includes(target)) ||
        targets.some((target) =>
          mesh.getDescendants().includes(target),
        ) ||
        targets.length === 0 // Orphaned group
      ) {
        animationGroup.targetedAnimations.forEach((anim) => {
          anim.target = null; // Detach references
        });
        animationGroup.stop();
        animationGroup.dispose();
      }
    });

    // Dispose standalone animations
    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh.animations) {
        currentMesh.animations.forEach((animation) => {
          animation.dispose?.();
        });
        currentMesh.animations.length = 0;
      }
    });

    // Detach and Dispose Materials
    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh.material) {
        const material = currentMesh.material;

        // Detach material from the mesh
        currentMesh.material = null;

        // Dispose material if not already disposed
        if (!disposedMaterials.has(material)) {
          const sharedMaterial = currentMesh.metadata?.sharedMaterial;

          if (sharedMaterial === false) {
            disposedMaterials.add(material);

            // Remove from scene.materials
            flock.scene.materials = flock.scene.materials.filter(
              (mat) => mat !== material,
            );

            material.dispose();
          }
        }
      }
    });

    // Break parent-child relationships
    meshesToDispose.forEach((currentMesh) => {
      //console.log("Stopping current sound");
      if (currentMesh?.metadata?.currentSound) {
        currentMesh.metadata.currentSound.stop();
      }
    });
    // Break parent-child relationships
    meshesToDispose.forEach((currentMesh) => {
      currentMesh.parent = null;
    });

    // Dispose meshes in reverse order
    meshesToDispose.reverse().forEach((currentMesh) => {
      if (!currentMesh.isDisposed()) {
        // Remove physics body
        if (currentMesh.physics) {
          currentMesh.physics.dispose();
        }

        // Remove from scene
        flock.scene.removeMesh(currentMesh);
        currentMesh.setEnabled(false);

        // Dispose the mesh
        currentMesh.dispose();
      }
    });
  },
  dispose(meshName) {
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.dispose();
      return;
    }
    return flock.whenModelReady(meshName, (mesh) => {
      flock.disposeMesh(mesh);
    });
  },
  cloneMesh({ sourceMeshName, cloneId, callback = null }) {
    const uniqueCloneId = cloneId + "_" + flock.scene.getUniqueId();

    flock.whenModelReady(sourceMeshName, (sourceMesh) => {
      const clone = sourceMesh.clone(uniqueCloneId);

      if (clone) {
        sourceMesh.computeWorldMatrix(true);

        const worldPosition = new flock.BABYLON.Vector3();
        const worldRotation = new flock.BABYLON.Quaternion();
        sourceMesh
          .getWorldMatrix()
          .decompose(undefined, worldRotation, worldPosition);

        clone.parent = null;
        clone.position.copyFrom(worldPosition);
        clone.rotationQuaternion = worldRotation.clone();
        clone.scaling.copyFrom(sourceMesh.scaling);

        // Clone and synchronise the physics body
        if (sourceMesh.physics) {
          const cloneBody = sourceMesh.physics.clone(clone);
          clone.physics = cloneBody;
        }

        const setMetadata = (mesh) => {
          // Ensure metadata exists
          mesh.metadata = mesh.metadata || {};

          // Add or update specific properties without overwriting existing metadata
          mesh.metadata.sharedMaterial = true;
          mesh.metadata.sharedGeometry = true;
        };

        clone.metadata = { ...(sourceMesh.metadata || {}) };
        setMetadata(clone);
        clone.getDescendants().forEach(setMetadata);

        if (callback) {
          requestAnimationFrame(() => callback());
        }
      }
    });

    return uniqueCloneId;
  },

};