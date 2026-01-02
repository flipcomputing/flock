let flock;

const sceneReady = () => !!(flock && flock.scene && flock.BABYLON);

export function setFlockReference(ref) {
  flock = ref;
}

export const flockScene = {
  /*
   Category: Scene
  */
  setSky(input, options = {}) {
    if (!sceneReady()) return;

    let color = input;

    // Convert object input to a material (handles texture + colors)
    if (
      typeof input === "object" &&
      !(input instanceof flock.BABYLON.Material) &&
      !Array.isArray(input)
    ) {
      color = flock.createMaterial(input);
    }

    if (!color) return;

    const { clear = false } = options;

    if (flock.sky) {
      flock.disposeMesh(flock.sky);
      flock.sky = null;
    }

    if (clear === true) {
      const c3 = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );
      flock.scene.clearColor = c3;
      return;
    }

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

      const isShader = typeof color.setFloat === "function";
      const tex =
        color.diffuseTexture || color.albedoTexture || color.baseTexture;

      if (tex || isShader) {
        
        const scaleValue = 10;

        if (tex) {
          tex.uScale = scaleValue;
          tex.vScale = scaleValue;
        }

        if (isShader) {
          color.setFloat("uScale", scaleValue);
          color.setFloat("vScale", scaleValue);
        }
      }

      color.backFaceCulling = false;
      skySphere.material = color;
      return;
    }

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
        mat.disableLighting = true;
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
      skyMat.disableLighting = false;
      skyMat.emissiveColor = c3.scale(0.3);
      skyMat.diffuseColor = c3;
      skyMat.ambientColor = c3.scale(0.1);
      skyMat.fogEnabled = false;

      skySphere.material = skyMat;
      return;
    }

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
  createMap(image, material) {
    if (!sceneReady() || !material) return;

    const mapTexturePhysicalSize = 4;

    const applyMaterialToGround = (mesh, mat) => {
      if (Array.isArray(mat) && mat.length >= 2) {
        const standardMat = new flock.BABYLON.StandardMaterial(
          "mapGradientMat",
          flock.scene,
        );
        const dt = flock.createLinearGradientTexture(mat, {
          size: 1024,
          horizontal: false,
        });
        standardMat.diffuseTexture = dt;
        standardMat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
        standardMat.diffuseTexture.wrapU =
          flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        standardMat.diffuseTexture.wrapV =
          flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        flock.setMaterialWithCleanup(mesh, standardMat);
      } else {
        flock.setMaterialWithCleanup(mesh, material);
      }
    };

    if (flock.ground && flock.ground.metadata?.heightMapImage === image) {
      applyMaterialToGround(flock.ground, material);
      return flock.ground;
    }

    if (flock.ground) {
      flock.disposeMesh(flock.ground);
    }

    const scaleGroundUVs = (mesh) => {
      const positions = mesh.getVerticesData(
        flock.BABYLON.VertexBuffer.PositionKind,
      );
      if (!positions) return;
      const { minimum } = mesh.getBoundingInfo();
      const uvs = new Float32Array((positions.length / 3) * 2);
      for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
        uvs[ui] = (positions[i] - minimum.x) / mapTexturePhysicalSize;
        uvs[ui + 1] = (positions[i + 2] - minimum.z) / mapTexturePhysicalSize;
      }
      mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
    };

    const shouldScaleUVs =
      !(Array.isArray(material) && material.length >= 2) &&
      !(material instanceof flock.GradientMaterial);

    let ground;
    if (image === "NONE") {
      ground = flock.BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 100, height: 100, subdivisions: 2 },
        flock.scene,
      );
      ground.physics = new flock.BABYLON.PhysicsAggregate(
        ground,
        flock.BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5 },
        flock.scene,
      );
      ground.metadata = {
        blockKey: "ground",
        skipAutoTiling: true,
        textureTileSize: mapTexturePhysicalSize,
        heightMapImage: "NONE",
      };
      ground.receiveShadows = true;
      if (shouldScaleUVs) scaleGroundUVs(ground);
      applyMaterialToGround(ground, material);
      flock.ground = ground;
    } else {
      ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
        "ground",
        flock.texturePath + image,
        {
          width: 100,
          height: 100,
          minHeight: 0,
          maxHeight: 10,
          subdivisions: 64,
          onReady: (gm) => {
            if (flock.ground !== gm) {
              gm.dispose();
              return;
            }
            gm.metadata = {
              blockKey: "ground",
              skipAutoTiling: true,
              textureTileSize: mapTexturePhysicalSize,
              heightMapImage: image,
            };
            const vertexData = gm.getVerticesData(
              flock.BABYLON.VertexBuffer.PositionKind,
            );
            let minDistance = Infinity;
            let closestY = 0;
            for (let i = 0; i < vertexData.length; i += 3) {
              const dist = Math.sqrt(
                vertexData[i] ** 2 + vertexData[i + 2] ** 2,
              );
              if (dist < minDistance) {
                minDistance = dist;
                closestY = vertexData[i + 1];
              }
            }
            gm.position.y -= closestY;
            const body = new flock.BABYLON.PhysicsBody(
              gm,
              flock.BABYLON.PhysicsMotionType.STATIC,
              false,
              flock.scene,
            );
            body.shape = new flock.BABYLON.PhysicsShapeMesh(gm, flock.scene);
            if (shouldScaleUVs) scaleGroundUVs(gm);
            applyMaterialToGround(gm, material);
          },
        },
        flock.scene,
      );
      flock.ground = ground;
    }

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
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, function (mesh) {
        if (mesh) {
          mesh.setEnabled(true);
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
        resolve();
      });
    });
  },
  hide(meshName) {
    const uiButton = flock.scene.UITexture?.getControlByName(meshName);

    if (uiButton) {
      // Handle UI button case
      uiButton.isVisible = false; // Hide the button
      return;
    }
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (mesh) {
          mesh.setEnabled(false);
          if (mesh.physics && mesh.physics._pluginData) {
            flock.hk._hknp.HP_World_RemoveBody(
              flock.hk.world,
              mesh.physics._pluginData.hpBodyId,
            );
          }
        } else {
          console.log("Mesh not loaded:", meshName);
        }
        resolve();
      });
    });
  },
  disposeMesh(mesh) {
    if (!mesh) return;

    if (mesh.name === "ground") {
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

    flock.scene.animationGroups.slice().forEach((animationGroup) => {
      const targets = animationGroup.targetedAnimations.map(
        (anim) => anim.target,
      );

      if (
        targets.some((target) => meshesToDispose.includes(target)) ||
        targets.some((target) => mesh.getDescendants().includes(target)) ||
        targets.length === 0
      ) {
        animationGroup.targetedAnimations.forEach((anim) => {
          anim.target = null;
        });
        animationGroup.stop();
        animationGroup.dispose();
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh.animations) {
        currentMesh.animations.forEach((animation) => {
          animation.dispose?.();
        });
        currentMesh.animations.length = 0;
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      const material = currentMesh.material;
      if (!material) return;

      const cacheKey = material.metadata?.cacheKey;
      currentMesh.material = null;

      if (material.metadata?.isManaged) {
        const isStillInUse = flock.scene.meshes.some(
          (m) =>
            !meshesToDispose.includes(m) &&
            !m.isDisposed() &&
            m.material === material,
        );

        if (!isStillInUse) {
          if (cacheKey && flock.materialCache?.[cacheKey]) {
            delete flock.materialCache[cacheKey];
          }
          material.dispose(true, true);
        }
      } else if (currentMesh.metadata?.sharedMaterial === false) {
        material.dispose();
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      if (currentMesh?.metadata?.currentSound) {
        currentMesh.metadata.currentSound.stop();
      }
    });

    meshesToDispose.forEach((currentMesh) => {
      currentMesh.parent = null;
    });

    meshesToDispose.reverse().forEach((currentMesh) => {
      if (!currentMesh.isDisposed()) {
        if (currentMesh.physics) {
          currentMesh.physics.dispose();
        }
        flock.scene.removeMesh(currentMesh);
        currentMesh.setEnabled(false);
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
