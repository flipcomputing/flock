import { TEXTURE_TILE_SIZE } from '../config.js';
import { isBodyAlive, restoreRestingState } from './physics.js';

let flock;

// Babylon's clone gives every cloned node a copy of its source's body and
// also copies the source's `physics` reference, so a node can end up with
// several bodies syncing it (one cloned mid-glide pins it in place). Replace
// them with one body per node, cloned from its source in its resting state.
function clonePhysicsHierarchy(sourceMesh, clone) {
  // Babylon names a cloned child "<parent clone name>.<source name>".
  const sourceName = (node) => (node === clone ? '' : node.name.slice(node.parent.name.length + 1));
  const pathOf = (node, root, nameOf) => {
    const path = [];
    for (let n = node; n && n !== root; n = n.parent) path.unshift(nameOf(n));
    return path.join('/');
  };
  const sourceByPath = new Map(
    [sourceMesh, ...sourceMesh.getDescendants(false)].map((node) => [
      pathOf(node, sourceMesh, (n) => n.name),
      node,
    ])
  );
  const cloneNodes = [clone, ...clone.getDescendants(false)];
  const cloneSet = new Set(cloneNodes);
  flock.scene
    .getPhysicsEngine?.()
    ?.getBodies?.()
    .filter((body) => cloneSet.has(body.transformNode))
    .forEach((body) => body.dispose());

  for (const node of cloneNodes) {
    node.physics = null;
    const source = sourceByPath.get(pathOf(node, clone, sourceName));
    if (!isBodyAlive(source?.physics)) continue;
    node.physics = source.physics.clone(node);
    restoreRestingState(source, node.physics);
    // PhysicsBody.clone() shares the shape; mark it so disposePhysics on
    // one mesh won't destroy the other's.
    if (source.physics.shape) source.physics.shape._isShared = true;
  }
}

const sceneReady = () => !!(flock && flock.scene && flock.BABYLON);

export function setFlockReference(ref) {
  flock = ref;
}

// Two sky stops become a shaped multi-stop ramp for the clamped texture
// machinery: the blend eases across the visible band (cosine, flat at both
// ends so there is no seam) and the top colour holds to the zenith. Ramp
// values stay literal colours, so unlike Babylon's GradientMaterial mix
// factor (unclamped above 1) this can never overshoot past either stop.
function skyTwoStopRamp(bottom, top) {
  const stops = 17;
  const lo = 0.42;
  const hi = 0.75;
  const c0 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(bottom));
  const c1 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(top));
  const ramp = [];
  for (let i = 0; i < stops; i++) {
    const t = i / (stops - 1);
    const u = Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
    const e = (1 - Math.cos(u * Math.PI)) / 2;
    ramp.push(c0.scale(1 - e).add(c1.scale(e)).toHexString());
  }
  return ramp;
}

export const flockScene = {
  /*
   Category: Scene
  */
  // The sky is a mesh, so the clear colour is what shows until its material is
  // ready to draw. Matching the middle of the ramp keeps that gap from flashing
  // the scene default; an average of every stop could land on a colour the sky
  // never shows.
  matchClearColorToSky(colors) {
    if (!sceneReady()) return;
    const list = (Array.isArray(colors) ? colors : [colors]).filter(Boolean);
    if (!list.length) return;

    const toColor3 = (c) =>
      c instanceof flock.BABYLON.Color3
        ? c
        : flock.BABYLON.Color3.FromHexString(flock.getColorFromString(c));

    // Cloned, so a colour read off a material can't be mutated through the scene.
    const middle = list.length / 2;
    flock.scene.clearColor =
      list.length % 2
        ? toColor3(list[(list.length - 1) / 2]).clone()
        : toColor3(list[middle - 1])
            .add(toColor3(list[middle]))
            .scale(0.5);
  },
  setSky(input, options = {}) {
    if (!sceneReady()) return;

    let color = input;

    // The gradient colour block hands over a descriptor. Unwrap to its colours
    // before the material conversion below, so the sky builds its own gradient
    // sized to the sky sphere; the sky only does bottom to top, so the
    // direction is ignored.
    if (color && typeof color === 'object' && !Array.isArray(color) && Array.isArray(color.color)) {
      // Only for an untextured descriptor: with a texture the colour list means
      // palette replacement, which the material conversion has to handle.
      const texName = color.materialName || color.textureSet || 'none.png';
      if (texName === 'none.png') color = color.color;
    }

    // Convert object input to a material (handles texture + colors)
    if (
      color &&
      typeof color === 'object' &&
      !(color instanceof flock.BABYLON.Material) &&
      !Array.isArray(color)
    ) {
      const scale = Number(color.scale);
      color = flock.createMaterial(color);
      if (Number.isFinite(scale) && scale > 0 && scale !== 1) {
        color.metadata = { ...color.metadata, textureScale: scale };
      }
    }

    if (!color) return;

    const { clear = false, flipV = true } = options;

    if (flock.sky) {
      flock.disposeMesh(flock.sky);
      flock.sky = null;
    }

    if (clear === true) {
      const c3 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
      flock.scene.clearColor = c3;
      return;
    }

    const createSkySphere = () => {
      const s = flock.BABYLON.MeshBuilder.CreateSphere(
        'sky',
        {
          segments: 32,
          diameter: 1000,
          sideOrientation: flock.BABYLON.Mesh.BACKSIDE,
        },
        flock.scene
      );
      s.infiniteDistance = true;
      s.isPickable = false;
      s.applyFog = false;
      return s;
    };

    if (color && color instanceof flock.BABYLON.Material) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      const isShader = typeof color.setFloat === 'function';
      const tex = flock.materialTexture(color);

      if (tex || isShader) {
        const scaleValue = 10 / (color.metadata?.textureScale ?? 1);
        const verticalScale = flipV ? -scaleValue : scaleValue;

        if (tex) {
          tex.uScale = scaleValue;
          tex.vScale = verticalScale;
        }

        if (isShader) {
          color.setFloat('uScale', scaleValue);
          color.setFloat('vScale', verticalScale);
        }
      }

      color.backFaceCulling = false;
      skySphere.material = color;
      flock.matchClearColorToSky(
        color.metadata?.gradientColors ??
          color.diffuseColor ??
          color.albedoColor ??
          color.emissiveColor
      );
      return;
    }

    if (Array.isArray(color) && color.length === 1) color = color[0];

    if (Array.isArray(color) && color.length >= 2) {
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      // Two stops expand to a shaped ramp through the same clamped texture
      // machinery as longer ramps; the clear colour still comes from the
      // original pair.
      const ramp = color.length === 2 ? skyTwoStopRamp(color[0], color[1]) : color;
      // Colours come through the lit diffuse, so an unlit sky needs a white
      // emissive or the lighting term multiplies it to black.
      const mat = flock.createGradientMaterial('skyGradient', ramp);
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      mat.emissiveColor = flock.BABYLON.Color3.White();
      skySphere.material = mat;
      flock.matchClearColorToSky(color);
      return;
    }

    if (typeof color === 'string') {
      const c3 = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
      const skySphere = createSkySphere();
      flock.sky = skySphere;
      if (flock.glowLayer) flock.glowLayer.addExcludedMesh(flock.sky);

      const skyMat = new flock.BABYLON.StandardMaterial('skyMaterial', flock.scene);
      skyMat.backFaceCulling = false;
      skyMat.disableLighting = false;
      skyMat.emissiveColor = c3.scale(0.3);
      skyMat.diffuseColor = c3;
      skyMat.ambientColor = c3.scale(0.1);
      skyMat.fogEnabled = false;

      skySphere.material = skyMat;
      flock.matchClearColorToSky(c3);
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
      'groundGradientDT',
      { width: horizontal ? size : 1, height: horizontal ? 1 : size },
      flock.scene,
      false
    );
    const ctx = dt.getContext();
    const w = dt.getSize().width;
    const h = dt.getSize().height;

    // Build canvas gradient
    const grad = horizontal
      ? ctx.createLinearGradient(0, 0, w, 0)
      : ctx.createLinearGradient(0, 0, 0, h);
    const normalizedColors = colors.length === 1 ? [colors[0], colors[0]] : colors;
    const n = normalizedColors.length;
    for (let i = 0; i < n; i++) {
      const stop = i / (n - 1);
      const hex = flock.getColorFromString(normalizedColors[i]);
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

    return dt;
  },
  createMap(image, material) {
    if (!sceneReady() || !material) return;

    const mapTexturePhysicalSize = TEXTURE_TILE_SIZE;

    const applyMaterialToGround = (mesh, mat) => {
      if (Array.isArray(mat) && mat.length === 1) mat = mat[0];

      // Resolve a color list from either a plain array or a material object with
      // none.png texture and an array of colors.
      const colorList =
        Array.isArray(mat) && mat.length >= 2
          ? mat
          : mat &&
              typeof mat === 'object' &&
              Array.isArray(mat.color) &&
              mat.color.length >= 2 &&
              (mat.materialName === 'none.png' || !mat.materialName)
            ? mat.color
            : null;

      if (colorList) {
        // Normalise UVs to 0–1 so the gradient texture fills the mesh
        // regardless of whether UVs were previously scaled for tiling.
        const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
        if (positions) {
          const { minimum, maximum } = mesh.getBoundingInfo();
          const rangeX = maximum.x - minimum.x || 1;
          const rangeZ = maximum.z - minimum.z || 1;
          const uvs = new Float32Array((positions.length / 3) * 2);
          for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
            uvs[ui] = (positions[i] - minimum.x) / rangeX;
            uvs[ui + 1] = (positions[i + 2] - minimum.z) / rangeZ;
          }
          mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
        }

        const oldMat = mesh.material;
        const standardMat = new flock.BABYLON.StandardMaterial('mapGradientMat', flock.scene);
        const dt = flock.createLinearGradientTexture(colorList, {
          size: 1024,
          horizontal: false,
        });
        standardMat.diffuseTexture = dt;
        if (mat && typeof mat === 'object' && mat.alpha !== undefined) {
          const parsedAlpha = parseFloat(mat.alpha);
          if (Number.isFinite(parsedAlpha)) standardMat.alpha = parsedAlpha;
        }
        standardMat.specularColor = new flock.BABYLON.Color3(0, 0, 0);
        standardMat.diffuseTexture.wrapU = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        standardMat.diffuseTexture.wrapV = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        mesh.material = standardMat;
        flock.disposeOldMaterial(oldMat, [mesh]);
      } else {
        // Re-scale UVs for tiled textures in case they were previously
        // normalised for a gradient (switching back from gradient to texture).
        const needsTiling = !mat?.metadata?.gradientColors;
        if (needsTiling) {
          const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
          if (positions) {
            const { minimum } = mesh.getBoundingInfo();
            const uvs = new Float32Array((positions.length / 3) * 2);
            for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
              uvs[ui] = (positions[i] - minimum.x) / mapTexturePhysicalSize;
              uvs[ui + 1] = (positions[i + 2] - minimum.z) / mapTexturePhysicalSize;
            }
            mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
          }
        }
        flock.setMaterialWithCleanup(mesh, mat);
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
      const positions = mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
      if (!positions) return;
      const { minimum } = mesh.getBoundingInfo();
      const uvs = new Float32Array((positions.length / 3) * 2);
      for (let i = 0, ui = 0; i < positions.length; i += 3, ui += 2) {
        uvs[ui] = (positions[i] - minimum.x) / mapTexturePhysicalSize;
        uvs[ui + 1] = (positions[i + 2] - minimum.z) / mapTexturePhysicalSize;
      }
      mesh.setVerticesData(flock.BABYLON.VertexBuffer.UVKind, uvs, true);
    };

    const isMaterialColorList =
      material &&
      typeof material === 'object' &&
      !Array.isArray(material) &&
      Array.isArray(material.color) &&
      material.color.length >= 2 &&
      (material.materialName === 'none.png' || !material.materialName);
    const shouldScaleUVs =
      !(Array.isArray(material) && material.length >= 2) &&
      !isMaterialColorList &&
      !material?.metadata?.gradientColors;

    let ground;
    if (image === 'NONE') {
      ground = flock.BABYLON.MeshBuilder.CreateGround(
        'ground',
        { width: 100, height: 100, subdivisions: 2 },
        flock.scene
      );
      ground.isPickable = true;
      ground.physics = new flock.BABYLON.PhysicsAggregate(
        ground,
        flock.BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5 },
        flock.scene
      );
      ground.metadata = {
        blockKey: 'ground',
        skipAutoTiling: true,
        textureTileSize: mapTexturePhysicalSize,
        heightMapImage: 'NONE',
      };
      // Same helper as the heightmap ground below, so both behave identically.
      // Defaults to 0; set ground.metadata.bounciness first to give it a bounce.
      flock.applyBounciness(ground.physics.body, ground);
      ground.receiveShadows = true;
      if (shouldScaleUVs) scaleGroundUVs(ground);
      applyMaterialToGround(ground, material);
      flock.ground = ground;
    } else {
      ground = flock.BABYLON.MeshBuilder.CreateGroundFromHeightMap(
        'ground',
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
              blockKey: 'ground',
              skipAutoTiling: true,
              textureTileSize: mapTexturePhysicalSize,
              heightMapImage: image,
            };
            gm.isPickable = true;
            const vertexData = gm.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
            let minDistance = Infinity;
            let closestY = 0;
            for (let i = 0; i < vertexData.length; i += 3) {
              const dist = Math.sqrt(vertexData[i] ** 2 + vertexData[i + 2] ** 2);
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
              flock.scene
            );
            body.shape = new flock.BABYLON.PhysicsShapeMesh(gm, flock.scene);
            flock.applyBounciness(body, gm);
            gm.physics = body;
            gm.physicsShape = body.shape;
            body.disablePreStep = false;
            if (shouldScaleUVs) scaleGroundUVs(gm);
            applyMaterialToGround(gm, material);
          },
        },
        flock.scene
      );
      flock.ground = ground;
    }

    return ground;
  },
  getGroundLevelAt(x = 0, z = 0, { rayStartY = 1000, rayLength = 5000 } = {}) {
    if (!sceneReady()) return 0;

    const groundMesh = flock.ground;
    if (!groundMesh) return 0;

    const rayOrigin = new flock.BABYLON.Vector3(x, rayStartY, z);
    const rayDirection = new flock.BABYLON.Vector3(0, -1, 0);
    const ray = new flock.BABYLON.Ray(rayOrigin, rayDirection, rayLength);

    const hit = flock.scene.pickWithRay(ray, (mesh) => {
      if (mesh === groundMesh) return true;
      const name = mesh?.name?.toLowerCase?.() ?? '';
      return name === 'ground' || name.includes('ground') || mesh?.metadata?.blockKey === 'ground';
    });

    if (hit?.pickedPoint) {
      return hit.pickedPoint.y;
    }

    return 0;
  },
  waitForGroundReady() {
    if (!sceneReady()) return Promise.resolve(null);
    if (flock.ground) return Promise.resolve(flock.ground);

    return new Promise((resolve) => {
      const observer = flock.scene.onBeforeRenderObservable.add(() => {
        if (flock.ground) {
          flock.scene.onBeforeRenderObservable.remove(observer);
          resolve(flock.ground);
        }
      });
    });
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
              mesh.physics.startAsleep
            );
          }
        } else {
          console.log('Model not loaded:', meshName);
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
            flock.hk._hknp.HP_World_RemoveBody(flock.hk.world, mesh.physics._pluginData.hpBodyId);
          }
        } else {
          console.log('Mesh not loaded:', meshName);
        }
        resolve();
      });
    });
  },
  disposeMesh(mesh) {
    if (!mesh) return;

    if (mesh.name === 'ground') {
      const material = mesh.material;
      mesh.material = null;
      flock.disposeOldMaterial(material, [mesh]);
      if (mesh.physicsShape) {
        mesh.physicsShape.dispose();
      }
      mesh.dispose();
      flock.ground = null;
      return;
    }
    if (mesh.name === 'sky') {
      const material = mesh.material;
      mesh.material = null;
      flock.disposeOldMaterial(material, [mesh]);
      mesh.dispose();
      flock.sky = null;
      return;
    }

    let meshesToDispose = [mesh];

    const particleSystem = flock.scene.particleSystems.find((system) => system.name === mesh.name);

    if (particleSystem) {
      particleSystem.dispose();
      return;
    }

    if (mesh.getChildMeshes) {
      meshesToDispose = mesh.getChildMeshes().concat(mesh);
    }

    flock.scene.animationGroups.slice().forEach((animationGroup) => {
      const targets = animationGroup.targetedAnimations.map((anim) => anim.target);

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

      currentMesh.material = null;
      flock.disposeOldMaterial(material, meshesToDispose);
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
        const md = currentMesh.metadata;
        if (md?.uprightConstraint) {
          try {
            md.uprightConstraint.dispose();
          } catch (e) {
            console.warn('Error disposing constraint:', e);
          }
          md.uprightConstraint = null;
        }
        if (currentMesh._postPhysicsUpkeep) {
          flock.scene.onAfterPhysicsObservable.remove(currentMesh._postPhysicsUpkeep);
          currentMesh._postPhysicsUpkeep = null;
        }
        if (currentMesh.physics) {
          if (!currentMesh.physics.shape?._isShared) {
            currentMesh.physics.shape?.dispose();
          }
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
  cloneMesh({
    sourceMeshName,
    cloneId,
    cloneName = null,
    blockKey = cloneId,
    callback = null,
    then = null,
    transform = null,
    inheritConstruction = true,
    family = null,
  } = {}) {
    if (!sourceMeshName || typeof sourceMeshName !== 'string' || sourceMeshName.length > 100) {
      console.warn('cloneMesh: invalid sourceMeshName');
      return null;
    }
    if (!cloneId || typeof cloneId !== 'string' || cloneId.length > 100) {
      console.warn('cloneMesh: invalid cloneId');
      return null;
    }
    if (callback != null && typeof callback !== 'function') {
      console.warn('cloneMesh: callback must be a function');
      callback = null;
    }
    if (then != null && typeof then !== 'function') {
      console.warn('cloneMesh: then must be a function');
      then = null;
    }
    if (flock.maxMeshesReached()) return 'error_' + cloneId;

    const uniqueCloneId = flock._reserveName(cloneId, family ?? flock._familyOf(sourceMeshName));

    const signal = flock.abortController?.signal;

    let resolveReady;
    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    flock.modelReadyPromises.set(uniqueCloneId, readyPromise);
    readyPromise.finally(() => {
      setTimeout(() => {
        if (flock.modelReadyPromises.get(uniqueCloneId) === readyPromise)
          flock.modelReadyPromises.delete(uniqueCloneId);
      }, 5000);
    });

    flock.whenModelReady(sourceMeshName, async (sourceMesh) => {
      if (!sourceMesh || sourceMesh.isDisposed?.()) {
        resolveReady(null);
        return;
      }

      await flock._whenHierarchySettled(sourceMesh);
      if (signal?.aborted) return;
      if (sourceMesh.isDisposed?.()) {
        resolveReady(null);
        return;
      }

      flock._recycleOldestByKey(sourceMeshName);

      const sayPlanes = sourceMesh
        .getDescendants(false)
        .filter((node) => node.metadata?.isTextPlane);
      const sayParents = sayPlanes.map((plane) => plane.parent);
      sayPlanes.forEach((plane) => (plane.parent = null));
      let clone;
      try {
        clone = sourceMesh.clone(uniqueCloneId);
      } finally {
        sayPlanes.forEach((plane, i) => (plane.parent = sayParents[i]));
      }

      flock._registerInstance(sourceMeshName, clone.name);

      if (clone) {
        sourceMesh.computeWorldMatrix(true);

        const worldPosition = new flock.BABYLON.Vector3();
        const worldRotation = new flock.BABYLON.Quaternion();
        sourceMesh.getWorldMatrix().decompose(undefined, worldRotation, worldPosition);

        clone.parent = null;
        clone.position.copyFrom(worldPosition);
        clone.rotationQuaternion = worldRotation.clone();
        clone.scaling.copyFrom(sourceMesh.scaling);

        clonePhysicsHierarchy(sourceMesh, clone);

        const setMetadata = (mesh) => {
          // Ensure metadata exists
          mesh.metadata = mesh.metadata || {};

          // Add or update specific properties without overwriting existing metadata
          mesh.metadata.sharedMaterial = true;
          mesh.metadata.sharedGeometry = true;
        };

        clone.metadata = { ...(sourceMesh.metadata || {}) };
        clone.metadata.clones = [];
        if (clone.metadata.tags) clone.metadata.tags = [...clone.metadata.tags];
        clone.metadata.sourceBlockKey ??= sourceMesh.metadata?.blockKey;
        clone.metadata.blockKey = blockKey;
        setMetadata(clone);
        clone.getDescendants().forEach((node) => {
          setMetadata(node);
          node.metadata = { ...node.metadata };
          if (node.metadata.tags) node.metadata.tags = [...node.metadata.tags];
          delete node.metadata.blockKey;
          delete node.metadata.mirror;
        });
        // A copy of a mirror is not a mirror itself; mirror() sets its own.
        delete clone.metadata.mirror;

        if (clone.metadata?.shapeType === 'Group') {
          // A cloned action manager would still close over the source shell,
          // so drop any copied forwarders and bind fresh ones to the clone.
          if (clone.actionManager) {
            for (const action of [...clone.actionManager.actions]) {
              if (action?._flockForwarder) clone.actionManager.unregisterAction(action);
            }
          }
          delete clone.metadata._pickForwarded;
          flock.ensureGroupPickForwarder?.(clone);
        }

        const cloneNameFor = (sourceNode) => {
          const path = [];
          for (let node = sourceNode; node && node !== sourceMesh; node = node.parent) {
            path.unshift(node.name);
          }
          return [clone.name, ...path].join('.');
        };

        const sayTexturePlanes = [sourceMesh, ...sourceMesh.getDescendants(false)].filter(
          (node) => node.metadata?.hasSayTexture && node.advancedTexture
        );
        for (const sourcePlane of sayTexturePlanes) {
          const cloneTargetName = cloneNameFor(sourcePlane);
          const clonePlane = flock.scene.getMeshByName(cloneTargetName);
          if (!clonePlane) continue;
          if (clonePlane.advancedTexture !== sourcePlane.advancedTexture) {
            clonePlane.advancedTexture?.dispose?.();
          }
          delete clonePlane.advancedTexture;
          flock.say(cloneTargetName, { text: '', duration: 0 })?.catch?.(() => {});
        }

        if (typeof transform === 'function') {
          const kept = await transform(clone, sourceMesh);
          if (signal?.aborted) return;
          if (kept === false || clone.isDisposed()) {
            resolveReady(null);
            return;
          }
        }

        const inherited = inheritConstruction
          ? flock._constructionOf(sourceMesh)
          : { dos: [], thens: [] };
        flock._rememberConstruction(clone, {
          dos: [...inherited.dos, callback],
          thens: [...inherited.thens, then],
        });
        const { dos, thens } = flock._constructionOf(clone);

        resolveReady(clone);
        flock.announceMeshReady(clone.name, clone.name);
        if (typeof cloneName === 'string' && cloneName) {
          const cloneFamily = flock._familyOf(cloneName);
          if (cloneFamily !== flock._familyOf(clone.name)) {
            flock._flushPendingTriggers(clone.name, cloneFamily);
          }
        }

        if (dos.length || thens.length) {
          requestAnimationFrame(async () => {
            for (const fn of [...dos, ...thens]) {
              if (signal?.aborted || clone.isDisposed()) return;
              try {
                const result = fn(uniqueCloneId);
                if (result && typeof result.then === 'function') await result;
              } catch (err) {
                console.error('cloneMesh callback error:', err);
              }
            }
          });
        }
      }
    });

    return uniqueCloneId;
  },
  _trackPendingChild(parentName, attached) {
    const pending = (flock._pendingChildren ??= new Map());
    let set = pending.get(parentName);
    if (!set) pending.set(parentName, (set = new Set()));
    set.add(attached);

    const signal = flock.abortController?.signal;
    const done = () => {
      set.delete(attached);
      if (!set.size && pending.get(parentName) === set) pending.delete(parentName);
    };
    attached.then(done, done);
    signal?.addEventListener('abort', done, { once: true });
  },
  _constructionOf(mesh) {
    return (mesh && flock._constructions?.get(mesh)) || { dos: [], thens: [] };
  },
  _rememberConstruction(mesh, { dos = [], thens = [] } = {}) {
    const isFn = (fn) => typeof fn === 'function';
    dos = dos.filter(isFn);
    thens = thens.filter(isFn);
    if (!mesh || (!dos.length && !thens.length)) return;
    const current = flock._constructionOf(mesh);
    flock._constructions ??= new WeakMap();
    flock._constructions.set(mesh, {
      dos: [...current.dos, ...dos],
      thens: [...current.thens, ...thens],
    });
  },
  runDo(meshName, fn) {
    flock._rememberConstruction(flock.scene?.getMeshByName(meshName), { dos: [fn] });
    return fn(meshName);
  },
  runThen(meshName, fn) {
    flock._rememberConstruction(flock.scene?.getMeshByName(meshName), { thens: [fn] });
    return fn(meshName);
  },
  _trackReveal(mesh, revealed) {
    const settled = revealed.then(
      () => {},
      () => {}
    );
    mesh._flockRevealed = settled;
    settled.then(() => {
      if (mesh._flockRevealed === settled) delete mesh._flockRevealed;
    });
    return revealed;
  },
  async _whenHierarchySettled(root) {
    for (;;) {
      const waits = [];
      for (const node of [root, ...root.getDescendants(false)]) {
        const children = flock._pendingChildren?.get(node.name);
        if (children) waits.push(...children);
        if (node._flockRevealed) waits.push(node._flockRevealed);
      }
      if (!waits.length) return;
      await Promise.allSettled(waits);
    }
  },
};
