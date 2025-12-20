let flock;

const sceneReady = () => !!(flock && flock.scene && flock.BABYLON);

export function setFlockReference(ref) {
  flock = ref;
}

export const flockScene = {
  /*
   Category: Scene
  */
  setSky(color, options = {}) {
    if (!sceneReady()) {
      return;
    }

    if (!color) {
      console.log("[set sky] No color provided");
      return;
    }

    const { clear = false } = options;

    if (flock.sky) {
      flock.disposeMesh(flock.sky);
      flock.sky = null;
    }

    // Set background clear color
    if (clear === true) {
      const c3 = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );
      flock.scene.clearColor = c3;
      return;
    }

    // Helper to create an inside-facing dome that follows the camera
    const createSkySphere = () => {
      const s = flock.BABYLON.MeshBuilder.CreateSphere(
        "sky",
        {
          segments: 32,
          diameter: 1000,
          sideOrientation: flock.BABYLON.Mesh.BACKSIDE,
        },
        flock.scene,
      );
      s.infiniteDistance = true;
      s.isPickable = false;
      s.applyFog = false;
      return s;
    };

    if (color && color instanceof flock.BABYLON.Material) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;

      // Optional tiling if there’s a texture
      const tex =
        color.diffuseTexture || color.albedoTexture || color.baseTexture;
      if (
        tex &&
        typeof tex.uScale === "number" &&
        typeof tex.vScale === "number"
      ) {
        tex.uScale = 10;
        tex.vScale = 10;
      }
      color.backFaceCulling = false;
      color.disableLighting = !!color.disableLighting; // leave caller’s intent
      skySphere.material = color;
      return;
    }

    // Use gradient material for multi-color sky
    if (Array.isArray(color) && color.length >= 2) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;

      if (color.length === 2) {
        const mat = new flock.GradientMaterial("skyGradient", flock.scene);
        mat.bottomColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color[0]),
        );
        mat.topColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color[1]),
        );
        mat.offset = 0.8;
        mat.smoothness = 0.5;
        mat.scale = 0.01;
        mat.backFaceCulling = false;
        mat.disableLighting = true; // gradient is usually unlit
        skySphere.material = mat;
      } else {
        const mat = flock.createMultiColorGradientMaterial(
          "skyGradient",
          color,
        );
        const { minimum, maximum } = skySphere.getBoundingInfo();
        mat.setVector2(
          "minMax",
          new flock.BABYLON.Vector2(minimum.y, maximum.y),
        );
        mat.backFaceCulling = false;
        mat.disableLighting = true;
        skySphere.material = mat;
      }
      return;
    }

    // --- SINGLE-COLOUR SKY DOME (this is the key change) ---
    if (typeof color === "string") {
      const c3 = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );

      const skySphere = createSkySphere();
      flock.sky = skySphere;

      const skyMat = new flock.BABYLON.StandardMaterial(
        "skyMaterial",
        flock.scene,
      );
      skyMat.backFaceCulling = false;
      skyMat.disableLighting = false; // ensure lit
      skyMat.diffuseColor = c3; // reacts to lights
      skyMat.ambientColor = c3.scale(0.05); // gentle lift, optional
      skyMat.fogEnabled = false;

      skySphere.material = skyMat;
      return;
    }

    // Fallback (shouldn’t hit)
    flock.scene.clearColor = new flock.BABYLON.Color3(0, 0, 0);
  },
  createLinearGradientTexture(colors, opts = {}) {
    if (!sceneReady()) {
      return null;
    }

    const size = opts.size || 512; // texture width
    const horizontal = !!opts.horizontal; // false => vertical along V, true => along U

    const dt = new flock.BABYLON.DynamicTexture(
      "groundGradientDT",
      { width: horizontal ? size : 1, height: horizontal ? 1 : size },
      flock.scene,
      false,
    );
    const ctx = dt.getContext();
    const w = dt.getSize().width;
    const h = dt.getSize().height;

    // Build canvas gradient
    const grad = horizontal
      ? ctx.createLinearGradient(0, 0, w, 0)
      : ctx.createLinearGradient(0, 0, 0, h);
    const n = Math.max(2, colors.length);
    for (let i = 0; i < n; i++) {
      const stop = i / (n - 1);
      const hex = flock.getColorFromString(colors[i]);
      const c3 = flock.BABYLON.Color3.FromHexString(hex);
      const rgb = `rgb(${Math.round(c3.r * 255)}, ${Math.round(c3.g * 255)}, ${Math.round(c3.b * 255)})`;
      grad.addColorStop(stop, rgb);
    }

    if (horizontal) {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 1);
    } else {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, h);
    }
    dt.update(false);

    const tex = new flock.BABYLON.Texture(null, flock.scene);
    tex._texture = dt.getInternalTexture();
    tex.wrapU = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
    return dt;
  },
  createGround(colorOrMaterial, modelId, opts = {}) {
    if (!sceneReady()) {
      return;
    }

    const tile = typeof opts.tile === "number" ? opts.tile : 10;

    if (flock.ground) {
      flock.disposeMesh(flock.ground);
    }

    const ground = flock.BABYLON.MeshBuilder.CreateGround(
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

    ground.name = modelId;
    ground.metadata = ground.metadata || {};
    ground.metadata.blockKey = modelId;
    ground.receiveShadows = true;
    ground.physics = groundAggregate;

    // Helper to apply tiling consistently (diffuse/albedo/base)
    const applyTilingIfAnyTexture = (mat, repeat = tile) => {
      const setTextureTiling = (tex) => {
        if (
          tex &&
          typeof tex.uScale === "number" &&
          typeof tex.vScale === "number"
        ) {
          tex.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
          tex.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
          tex.uScale = repeat;
          tex.vScale = repeat;
        }
      };

      const tex =
        mat?.diffuseTexture ||
        mat?.albedoTexture ||
        mat?.baseTexture ||
        mat?.getTexture?.("textureSampler") ||
        null;

      setTextureTiling(tex);

      if (mat instanceof flock.BABYLON.ShaderMaterial) {
        mat.setFloat("uScale", repeat);
        mat.setFloat("vScale", repeat);
      }
    };

    if (colorOrMaterial && colorOrMaterial instanceof flock.BABYLON.Material) {
      ground.material = colorOrMaterial;
      applyTilingIfAnyTexture(ground.material);
    } else if (Array.isArray(colorOrMaterial) && colorOrMaterial.length >= 2) {
      const mat = new flock.BABYLON.StandardMaterial(
        "groundGradientMat",
        flock.scene,
      );
      const dt = flock.createLinearGradientTexture(colorOrMaterial, {
        size: 1024,
        horizontal: false,
      });
      mat.diffuseTexture = dt;
      mat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
      mat.backFaceCulling = true;

      // Clamp so the gradient spans the plane once
      mat.diffuseTexture.wrapU = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
      mat.diffuseTexture.wrapV = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
      mat.diffuseTexture.uScale = 1;
      mat.diffuseTexture.vScale = 1;

      ground.material = mat;
    } else {
      // Single color
      const mat = new flock.BABYLON.StandardMaterial(
        "groundMaterial",
        flock.scene,
      );
      mat.diffuseColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(colorOrMaterial),
      );
      mat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
      ground.material = mat;
    }

    flock.ground = ground;
  },
  createMap(image, material) {
    if (!sceneReady()) {
      return;
    }

    if (!material) {
      console.log("[create map] No material provided");
      return;
    }

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
      ground.metadata = ground.metadata || {};
      ground.metadata.blockKey = modelId;
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
            const heightMapGroundShape = new flock.BABYLON.PhysicsShapeMesh(
              ground,
              flock.scene,
            );
            const heightMapGroundBody = new flock.BABYLON.PhysicsBody(
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
    ground.metadata = ground.metadata || {};
    ground.metadata.blockKey = "ground";

    // Helper to apply tiling consistently (diffuse/albedo/base)
    const applyTilingIfAnyTexture = (mat, repeat = 25) => {
      const tex =
        mat?.diffuseTexture || mat?.albedoTexture || mat?.baseTexture || null;
      if (
        tex &&
        typeof tex.uScale === "number" &&
        typeof tex.vScale === "number"
      ) {
        tex.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
        tex.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
        tex.uScale = repeat;
        tex.vScale = repeat;
      }
    };

    if (material && material instanceof flock.BABYLON.Material) {
      ground.material = material;
      applyTilingIfAnyTexture(ground.material);
    } else if (Array.isArray(material) && material.length >= 2) {
      const mat = new flock.BABYLON.StandardMaterial(
        "mapGradientMat",
        flock.scene,
      );
      const dt = flock.createLinearGradientTexture(material, {
        size: 1024,
        horizontal: false,
      });
      mat.diffuseTexture = dt;
      mat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
      mat.backFaceCulling = true;

      // Apply tiling to gradient
      mat.diffuseTexture.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      mat.diffuseTexture.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      mat.diffuseTexture.uScale = 25;
      mat.diffuseTexture.vScale = 25;

      ground.material = mat;
    } else if (material) {
      // Single colour
      const mat = new flock.BABYLON.StandardMaterial(
        "mapColorMat",
        flock.scene,
      );
      mat.diffuseColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(material),
      );
      mat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
      ground.material = mat;
    }

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
    if (!mesh) {
      return;
    }

    if (mesh.name === "ground") {
      mesh.material?.dispose();
      mesh.dispose();
      flock.ground = null;
      return;
    }
    if (mesh.name === "sky") {
      mesh.material?.dispose();
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
        targets.some((target) => mesh.getDescendants().includes(target)) ||
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
          const internalMaterial = material.metadata?.internal;

          if (sharedMaterial === false && internalMaterial === true) {
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

    flock.whenModelReady(meshName, (mesh) => {
      if (mesh) flock.disposeMesh(mesh);
    });
  },
  cloneMesh({ sourceMeshName, cloneId, callback = null }) {
    const uniqueCloneId = cloneId + "_" + flock.scene.getUniqueId();

    flock.whenModelReady(sourceMeshName, (sourceMesh) => {
      const clone = sourceMesh.clone(uniqueCloneId);

      sourceMesh.metadata.clones = sourceMesh.metadata.clones || [];
      sourceMesh.metadata.clones = sourceMesh.metadata.clones.concat(
        clone.name,
      );

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
        clone.metadata.clones = [];
        setMetadata(clone);
        clone.getDescendants().forEach(setMetadata);

        if (callback) {
          requestAnimationFrame(() => callback());
        }
      }
    });

    return uniqueCloneId;
  },
  wait(duration) {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  },
};
