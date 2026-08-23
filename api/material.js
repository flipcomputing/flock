let flock;

export function setFlockReference(ref) {
  flock = ref;
}

// Gradient direction follows CSS linear-gradient: 0 is bottom to top, increasing
// clockwise, rotating within each mesh's own local XY plane.
function gradientAxisFor(direction) {
  const radians = ((Number(direction) || 0) * Math.PI) / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

// The angle is part of a gradient's identity, so it has to reach the material cache key.
function withGradientDirection(colorKey, direction) {
  return Number.isFinite(direction) ? `${colorKey}@${direction}` : colorKey;
}

// Built on first use: the class needs BABYLON, which arrives with the flock ref.
let gradientPlugin = null;

function gradientPluginClass() {
  if (gradientPlugin) return gradientPlugin;

  gradientPlugin = class FlockGradientPlugin extends flock.BABYLON.MaterialPluginBase {
    constructor(material) {
      super(material, 'FlockGradient', 200, { FLOCK_GRADIENT: true }, true, true);
      this.colors = [];
      this.direction = 0;
      this.ramp = null;
      this.axis = gradientAxisFor(0);
    }

    getClassName() {
      return 'FlockGradientPlugin';
    }

    prepareDefines(defines) {
      defines.FLOCK_GRADIENT = true;
    }

    getSamplers(samplers) {
      samplers.push('gradientRamp');
    }

    getActiveTextures(activeTextures) {
      if (this.ramp) activeTextures.push(this.ramp);
    }

    hasTexture(texture) {
      return this.ramp === texture;
    }

    getUniforms() {
      return {
        ubo: [
          { name: 'gradientAxis', size: 2, type: 'vec2' },
          { name: 'gradientRange', size: 2, type: 'vec2' },
        ],
        fragment: 'uniform vec2 gradientAxis;\nuniform vec2 gradientRange;\n',
      };
    }

    // Per draw, so meshes sharing this material get their own range; it spans
    // the whole mesh, so submeshes of one mesh share it.
    bindForSubMesh(uniformBuffer, scene, engine, subMesh) {
      const mesh = subMesh?.getMesh?.();
      const axis = this.axis;
      let low = -1;
      let high = 1;

      if (mesh) {
        const bb = mesh.getBoundingInfo().boundingBox;
        low = Infinity;
        high = -Infinity;
        for (const x of [bb.minimum.x, bb.maximum.x]) {
          for (const y of [bb.minimum.y, bb.maximum.y]) {
            const projected = x * axis.x + y * axis.y;
            low = Math.min(low, projected);
            high = Math.max(high, projected);
          }
        }
      }

      uniformBuffer.updateFloat2('gradientAxis', axis.x, axis.y);
      uniformBuffer.updateFloat2('gradientRange', low, high);
      if (this.ramp) uniformBuffer.setTexture('gradientRamp', this.ramp);
    }

    getCustomCode(shaderType) {
      if (shaderType === 'vertex') {
        return {
          CUSTOM_VERTEX_DEFINITIONS: 'varying vec3 vGradientPosition;\n',
          CUSTOM_VERTEX_UPDATE_POSITION: 'vGradientPosition = positionUpdated;\n',
        };
      }

      return {
        CUSTOM_FRAGMENT_DEFINITIONS:
          'varying vec3 vGradientPosition;\nuniform sampler2D gradientRamp;\n',
        CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
          float gradientSpan = max(1e-5, gradientRange.y - gradientRange.x);
          float gradientT = clamp(
            (dot(vGradientPosition.xy, gradientAxis) - gradientRange.x) / gradientSpan, 0.0, 1.0);
          baseColor.rgb = texture2D(gradientRamp, vec2(0.5, gradientT)).rgb;
        `,
      };
    }

    setColors(colors, direction) {
      this.colors = colors.slice();
      this.direction = Number(direction) || 0;
      this.axis = gradientAxisFor(this.direction);

      const previous = this.ramp;
      this.ramp = flock.createLinearGradientTexture(colors, { size: 256, horizontal: false });
      if (this.ramp) {
        this.ramp.wrapU = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
        this.ramp.wrapV = flock.BABYLON.Texture.CLAMP_ADDRESSMODE;
      }
      previous?.dispose();

      this.markAllDefinesAsDirty();
    }

    serialize() {
      return { name: this.name, colors: this.colors, direction: this.direction };
    }

    parse(source) {
      if (source?.colors?.length) this.setColors(source.colors, source.direction);
    }

    dispose() {
      this.ramp?.dispose();
      this.ramp = null;
    }
  };

  // Lets a material parsed back from a serialised scene rebuild its gradient.
  flock.BABYLON.RegisterClass?.('BABYLON.FlockGradientPlugin', gradientPlugin);

  return gradientPlugin;
}

function gradientPluginOn(material) {
  return (
    material?.pluginManager?._plugins?.find((p) => p.getClassName() === 'FlockGradientPlugin') ??
    null
  );
}

function readGradientDirection(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return Number.isFinite(value.direction) ? value.direction : undefined;
}

export const flockMaterial = {
  adjustMaterialTilingToMesh(mesh, material, _unitsPerTile = null) {
    return; // Don't scale textures - need to change the mesh UVs instead
  },
  adjustMaterialTilingForHierarchy(mesh, unitsPerTile) {
    if (!mesh) return;
    const targets = [mesh, ...(mesh.getDescendants?.() || [])];
    targets.forEach((m) => {
      const mat =
        m.material || (m.getClassName?.() === 'InstancedMesh' ? m.sourceMesh?.material : null);
      flock.adjustMaterialTilingToMesh(m, mat, unitsPerTile);
    });
  },
  randomColour() {
    const letters = '0123456789ABCDEF';
    let colour = '#';
    for (let i = 0; i < 6; i++) {
      colour += letters[Math.floor(Math.random() * 16)];
    }
    if (flock.materialsDebug) console.log(`  Generated the random colour ${colour}`);
    return colour.toLowerCase();
  },
  rgbToHex(rgb) {
    const matches = rgb.match(/\d+/g);
    if (!matches || matches.length < 3) {
      return '#000000'; // fallback to black for invalid input
    }
    const result = matches.slice(0, 3).map(function (x) {
      const num = parseInt(x);
      if (isNaN(num)) return '00';
      const hex = Math.max(0, Math.min(255, num)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    });
    return '#' + result.join('');
  },
  hexToRgba(hex, alpha) {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
  getColorFromString(colourString) {
    // A colour list or a material/gradient descriptor can reach solid-colour APIs
    // such as tint and highlight; fall back to the first colour rather than black.
    if (Array.isArray(colourString)) {
      return flock.getColorFromString(colourString[0]);
    }

    if (typeof colourString === 'object' && colourString !== null) {
      const inner = colourString.color ?? colourString.baseColor;
      return inner === undefined ? '#000000' : flock.getColorFromString(inner);
    }

    if (typeof colourString !== 'string') {
      return '#000000';
    }

    if (!colourString) {
      return '#000000';
    }

    // Babylon's Color3.fromHexString only accepts #RRGGBB, so expand the
    // #RGB shorthand (e.g. #f0c -> #ff00cc) rather than passing it through.
    const expandShortHex = (hex) => (hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex);

    if (/^([0-9A-F]{3}|[0-9A-F]{6})$/i.test(colourString)) {
      return `#${expandShortHex(colourString).toLowerCase()}`;
    }

    if (/^#([0-9A-F]{3}){1,2}$/i.test(colourString)) {
      return `#${expandShortHex(colourString.slice(1)).toLowerCase()}`;
    }

    try {
      const colorDiv = flock.document.createElement('div');
      colorDiv.style.color = colourString;
      flock.document.body.appendChild(colorDiv);
      const computedColor = getComputedStyle(colorDiv).color;

      flock.document.body.removeChild(colorDiv);
      // Parse the rgb(r, g, b) string and convert to individual numbers
      const matches = computedColor.match(/\d+/g);
      if (!matches || matches.length < 3) {
        return '#000000';
      }
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      const result = flock.rgbToHex(`rgb(${r}, ${g}, ${b})`);
      return result.toLowerCase();
    } catch (error) {
      console.warn('Failed to parse color to hex; using default black:', error);
      return '#000000';
    }
  },

  tint(meshName, { color } = {}) {
    if (flock.materialsDebug) console.log(`Changing tint of ${meshName} by ${color}`);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'tint', name: meshName })) {
          resolve();
          return;
        }
        if (mesh.material) {
          mesh.renderOverlay = true;
          mesh.overlayAlpha = 0.5;
          mesh.overlayColor = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
        }

        mesh.getChildMeshes().forEach(function (childMesh) {
          if (childMesh.material) {
            childMesh.renderOverlay = true;
            childMesh.overlayAlpha = 0.5;
            childMesh.overlayColor = flock.BABYLON.Color3.FromHexString(
              flock.getColorFromString(flock.getColorFromString(color))
            );
          }
        });
        mesh.metadata?.clones?.forEach((cloneName) => flock.tint(cloneName, { color: color }));
        resolve();
      });
    });
  },
  highlight(meshName, { color } = {}) {
    if (flock.materialsDebug) console.log(`Highlighting ${meshName} with ${color}`);
    const applyHighlight = (mesh) => {
      if (mesh.material) {
        flock.highlighter.addMesh(
          mesh,
          flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color))
        );
      }
    };

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'highlight', name: meshName })) {
          resolve();
          return;
        }
        applyHighlight(mesh);
        mesh.getChildMeshes().forEach(applyHighlight);
        mesh.metadata?.clones?.forEach((cloneName) => flock.highlight(cloneName, { color: color }));
        resolve();
      });
    });
  },
  glow(meshName, { color } = {}) {
    if (flock.materialsDebug) console.log(`Making ${meshName} glow`);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'glow', name: meshName })) {
          resolve();
          return;
        }
        if (!flock.glowLayer) {
          flock.glowLayer = new flock.BABYLON.GlowLayer('glowLayer', flock.scene);
          flock.glowLayer.intensity = 0.5;
          if (flock.sky) {
            flock.glowLayer.addExcludedMesh(flock.sky);
          }
          flock.glowLayer.customEmissiveColorSelector = (
            glowingMesh,
            _subMesh,
            _material,
            result
          ) => {
            const glowColor = glowingMesh.metadata?.glowColor;
            if (glowColor) {
              const c = flock.BABYLON.Color3.FromHexString(glowColor);
              result.set(c.r, c.g, c.b, 1);
            } else {
              result.set(0, 0, 0, 0);
            }
          };
        }
        // The layer is kept for the lifetime of the scene and toggled with
        // isEnabled rather than disposed/recreated: every GlowLayer burns
        // render pass ids from a never-reused page-global counter, which makes
        // each submesh's draw-wrapper array grow and slows every later run.
        flock.glowLayer.isEnabled = true;

        flock.glowMesh(mesh, color);
        mesh.metadata?.clones?.forEach((_cloneName) =>
          flock.whenModelReady((cloneMesh) => flock.glowMesh(cloneMesh, { color: color }))
        );
        resolve();
      });
    });
  },
  getMaterialParamsFromMesh(mesh) {
    const mat = mesh.material;
    if (!mat) return null;

    if (mat.metadata?.cacheKey) {
      const parts = mat.metadata.cacheKey.split('_');
      const lastPart = parts[parts.length - 1];
      const hasGlowPart = lastPart === 'glow' || lastPart === 'noglow';
      const [colorPart, directionPart] = parts[1].split('@');
      const color = colorPart.includes('-') ? colorPart.split('-') : colorPart;
      const parsedDirection = parseFloat(directionPart);
      const parsedAlpha = parseFloat(parts[2]);
      return {
        color,
        ...(Number.isFinite(parsedDirection) ? { direction: parsedDirection } : {}),
        materialName:
          mat.metadata.texName ||
          parts.slice(3, hasGlowPart ? -1 : parts.length).join('_') ||
          'none.png',
        alpha: Number.isFinite(parsedAlpha) ? parsedAlpha : (mat.alpha ?? 1),
        glow: hasGlowPart ? lastPart === 'glow' : (mesh.metadata?.glow ?? false),
      };
    }

    const matColor = mat.diffuseColor || mat.albedoColor;
    const textureName = flock.materialTexture(mat)?.name?.split('/').pop() || 'none.png';
    return {
      color: matColor ? '#' + matColor.toHexString().slice(1) : '#ffffff',
      materialName: textureName,
      alpha: mat.alpha ?? 1,
      glow: mesh.metadata?.glow ?? false,
    };
  },
  glowMesh(mesh, glowColor = null) {
    const applyGlow = (m) => {
      // Don't glow the separate say helper plane or planes using say GUI textures.
      if (m.name === 'textPlane' || m.metadata?.isTextPlane || m.metadata?.hasSayTexture) {
        return;
      }

      m.metadata = m.metadata || {};
      m.metadata.glow = true;

      const params = m.material ? flock.getMaterialParamsFromMesh(m) : null;
      const baseColor = params?.color;

      m.metadata.glowColor = glowColor
        ? flock.getColorFromString(glowColor)
        : Array.isArray(baseColor)
          ? flock.getColorFromString(baseColor[0])
          : baseColor
            ? flock.getColorFromString(baseColor)
            : '#ffffff';

      // The halo comes from the glow layer, not the material, so rebuilding one
      // without an emissive channel just costs a duplicate.
      const canEmit =
        m.material?.emissiveColor !== undefined && !m.material?.metadata?.gradientColors;

      if (params && canEmit) {
        const materialParams = {
          ...params,
          color:
            glowColor && !Array.isArray(baseColor)
              ? flock.getColorFromString(glowColor)
              : baseColor,
          glow: true,
        };
        flock.setMaterialWithCleanup(m, materialParams);
      }
    };

    applyGlow(mesh);
    mesh.getChildMeshes().forEach(applyGlow);
  },
  setAlpha(meshName, { value = 1 } = {}) {
    value = Math.max(0, Math.min(1, value));

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'setAlpha', name: meshName })) {
          resolve();
          return;
        }
        const isTextPlaneMesh = (part) => part?.name === 'textPlane' || part?.metadata?.isTextPlane;
        const allMeshes = [mesh, ...mesh.getDescendants()].filter(
          (m) => m instanceof flock.BABYLON.Mesh && m.getTotalVertices() > 0
        );

        allMeshes.forEach((nextMesh) => {
          if (!nextMesh.material) return;

          if (!nextMesh.metadata?.hasSayTexture && !isTextPlaneMesh(nextMesh)) {
            const params = flock.getMaterialParamsFromMesh(nextMesh);
            const materialParams = { ...params, alpha: value };

            flock.setMaterialWithCleanup(nextMesh, materialParams);
          } else {
            nextMesh.material.alpha = value;
          }

          if (nextMesh.material) {
            nextMesh.material.transparencyMode =
              value < 1 ? flock.BABYLON.Material.MATERIAL_ALPHABLEND : null;
            nextMesh.material.needDepthPrePass = value > 0 && value < 1;
          }
        });
        resolve();
      });
    });
  },
  clearEffects(meshName) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'clearEffects', name: meshName })) {
          resolve();
          return;
        }
        if (flock.materialsDebug) console.log(`Clear effects from ${meshName}:`);
        const isTextPlaneMesh = (part) => part?.name === 'textPlane' || part?.metadata?.isTextPlane;
        const removeEffects = (targetMesh) => {
          targetMesh.metadata = targetMesh.metadata || {};

          if (
            targetMesh.material &&
            !targetMesh.metadata.hasSayTexture &&
            !isTextPlaneMesh(targetMesh)
          ) {
            const params = flock.getMaterialParamsFromMesh(targetMesh);
            const materialParams = { ...params, alpha: 1, glow: false };

            flock.setMaterialWithCleanup(targetMesh, materialParams);

            if (targetMesh.material) {
              targetMesh.material.transparencyMode = null;
              targetMesh.material.needDepthPrePass = false;
            }
          }

          targetMesh.metadata = targetMesh.metadata || {};
          targetMesh.metadata.glow = false;
          delete targetMesh.metadata.glowColor;

          if (flock.glowLayer) {
            const anyGlowing = flock.scene.meshes.some((m) => m !== targetMesh && m.metadata?.glow);
            if (!anyGlowing) {
              flock.glowLayer.isEnabled = false;
            }
          }

          flock.highlighter.removeMesh(targetMesh);
          targetMesh.renderOverlay = false;
        };

        removeEffects(mesh);
        mesh.getChildMeshes().forEach(removeEffects);
        mesh?.metadata?.clones?.forEach((cloneName) => flock.clearEffects(cloneName));
        resolve();
      });
    });
  },
  ensureUniqueMaterial(mesh) {
    // Helper function to clone material for a mesh
    const cloneMaterial = (originalMaterial) => {
      const clone = originalMaterial.clone(`${originalMaterial.name}`);
      // Babylon copies metadata by reference and doesn't clone plugins at all.
      clone.metadata = { ...(originalMaterial.metadata || {}) };
      if (clone.metadata.gradientColors) {
        const plugin = gradientPluginOn(clone) ?? new (gradientPluginClass())(clone);
        plugin.setColors(clone.metadata.gradientColors, clone.metadata.gradientDirection);
      }
      return flock.inheritPendingTexture(originalMaterial, clone);
    };

    // Recursive function to collect all meshes in the hierarchy
    const collectMeshes = (node, meshes = []) => {
      if (node instanceof flock.BABYLON.Mesh) {
        meshes.push(node);
      }
      if (node.getChildren) {
        node.getChildren().forEach((child) => collectMeshes(child, meshes));
      }
      return meshes;
    };

    // Collect all meshes in the hierarchy (root + descendants)
    const allMeshes = collectMeshes(mesh);

    // Create a mapping of original materials to their clones
    const materialMapping = new Map();

    // Iterate through all collected meshes
    allMeshes.forEach((currentMesh) => {
      if (currentMesh.material && currentMesh.metadata?.sharedMaterial) {
        // Check if the material has already been cloned
        if (!materialMapping.has(currentMesh.material)) {
          // Clone the material and store it in the mapping
          if (flock.materialsDebug)
            console.log(` Cloning material, ${currentMesh.material}, of ${currentMesh.name}`);
          const clonedMaterial = cloneMaterial(currentMesh.material);
          materialMapping.set(currentMesh.material, clonedMaterial);
        }

        // Assign the cloned material to the current mesh
        currentMesh.material = materialMapping.get(currentMesh.material);
        currentMesh.metadata.sharedMaterial = false; // Material is now unique to this hierarchy
      }
    });
  },
  ensureStandardMaterial(mesh) {
    if (!mesh) return;
    // Set to track replaced materials and their corresponding replacements
    const replacedMaterialsMap = new Map();
    // Default material to use as the replacement base
    const defaultMaterial =
      flock.scene.defaultMaterial ||
      new flock.BABYLON.StandardMaterial('defaultMaterial', flock.scene);
    defaultMaterial.backFaceCulling = false;

    // Helper function to copy color properties from PBR to Standard material
    const copyColorProperties = (pbrMaterial, standardMaterial) => {
      // Check for albedoColor first
      if (pbrMaterial.albedoColor) {
        standardMaterial.diffuseColor = pbrMaterial.albedoColor.clone();
      }
      // Fallback to baseColor if albedoColor doesn't exist
      else if (pbrMaterial.baseColor) {
        standardMaterial.diffuseColor = pbrMaterial.baseColor.clone();
      }

      // Check for albedoTexture first
      if (pbrMaterial.albedoTexture) {
        standardMaterial.diffuseTexture = pbrMaterial.albedoTexture;
      }
      // Fallback to baseTexture
      else if (pbrMaterial.baseTexture) {
        standardMaterial.diffuseTexture = pbrMaterial.baseTexture;
      }

      if (pbrMaterial.emissiveColor) {
        standardMaterial.emissiveColor = pbrMaterial.emissiveColor.clone();
      }
      if (pbrMaterial.emissiveTexture) {
        standardMaterial.emissiveTexture = pbrMaterial.emissiveTexture;
      }
      // Copy metallicFactor as specular influence
      if (pbrMaterial.metallicFactor !== undefined) {
        standardMaterial.specularPower = (1 - pbrMaterial.metallicFactor) * 64;
      }
      // Copy roughnessFactor
      if (pbrMaterial.roughnessFactor !== undefined) {
        standardMaterial.specularPower = (1 - pbrMaterial.roughnessFactor) * 64;
      }
    };

    const replaceIfPBRMaterial = (targetMesh) => {
      const material = targetMesh.material;
      if (material && material.getClassName() === 'PBRMaterial') {
        if (!replacedMaterialsMap.has(material)) {
          // Replace with a cloned default material, preserving the name
          const originalName = material.name;
          const newMaterial = defaultMaterial.clone(originalName);

          // Check if this is a target material and copy colors
          const materialNameLower = originalName.toLowerCase();
          const targetMaterials = ['black', 'white', 'mouth', 'nose'];
          const isTargetMaterial = targetMaterials.some((target) =>
            materialNameLower.includes(target)
          );

          if (isTargetMaterial) {
            copyColorProperties(material, newMaterial);
          }

          replacedMaterialsMap.set(material, newMaterial);
        }
        // Assign the replaced material to the mesh
        targetMesh.material = replacedMaterialsMap.get(material);
        targetMesh.backFaceCulling = false;

        // Only override alpha if this isn't a target material
        const materialNameLower = targetMesh.material.name.toLowerCase();
        const targetMaterials = ['black', 'white', 'mouth', 'nose'];
        const isTargetMaterial = targetMaterials.some((target) =>
          materialNameLower.includes(target)
        );

        if (!isTargetMaterial) {
          targetMesh.material.alpha = 1;
        }

        targetMesh.material.transparencyMode = flock.BABYLON.Material.MATERIAL_OPAQUE;
        // targetMesh.material.alphaMode = undefined;
        //targetMesh.material.reflectionTexture = null;
        targetMesh.material.needDepthPrePass = false;
        targetMesh.material.specularColor = new flock.BABYLON.Color3(0, 0, 0);
      }
    };
    // Replace material on the main mesh
    replaceIfPBRMaterial(mesh);
    // Replace materials on all child meshes
    mesh.getChildMeshes().forEach(replaceIfPBRMaterial);
    // Dispose replaced PBR materials only if no other mesh still references them
    // (the cached template may still hold references to the same material objects)
    replacedMaterialsMap.forEach((newMaterial, oldMaterial) => {
      const stillInUse = flock.scene.meshes.some(
        (m) => !m.isDisposed() && m.material === oldMaterial
      );
      if (!stillInUse) oldMaterial.dispose();
    });
  },
  changeColor(meshName, { color } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (flock.materialsDebug) console.log(`Change colour of ${meshName} to ${color}:`);
        if (!mesh) {
          flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
            flock.getColorFromString(color)
          );
          resolve();
          return;
        }
        // null sets the background above; a non-mesh object is a wrong target.
        if (!flock.requireMesh(mesh, { api: 'changeColor', name: meshName })) {
          resolve();
          return;
        }

        flock.changeColorMesh(mesh, color);
        resolve();
      });
    });
  },
  changeColorMesh(mesh, color) {
    if (!mesh) {
      flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color));
      return;
    }

    // One material on every part rather than a colour each. Each mesh in the
    // hierarchy spans the gradient across its own bounds, not the model's.
    if (readGradientDirection(color) !== undefined) {
      flock.applyMaterialToHierarchy(mesh, color, { applyColor: true });
      if (mesh.metadata?.glow) flock.glowMesh(mesh);
      return;
    }

    const getPartNameFromMesh = flock.getCanonicalPartName;

    const getRootMesh = (node) => {
      let current = node;
      while (current?.parent) current = current.parent;
      return current || node;
    };

    const isCharacterMesh = (node) => {
      const root = getRootMesh(node);
      const modelName = root?.metadata?.modelName;
      const meshName = root?.metadata?.meshName;
      return flock.characterNames.includes(modelName || meshName);
    };

    const isCharacterLikeMesh = (node) => {
      const root = getRootMesh(node);
      const meshes = [root, ...root.getChildMeshes()];
      for (const part of meshes) {
        if (getPartNameFromMesh(part)) return true;
      }
      return false;
    };

    const isCharacterLike = isCharacterMesh(mesh) || isCharacterLikeMesh(mesh);
    const isTextPlaneMesh = (part) => part?.name === 'textPlane' || part?.metadata?.isTextPlane;

    if (isCharacterLike) {
      const root = getRootMesh(mesh);
      flock.ensureStandardMaterial(root);
    }

    if (
      mesh.metadata?.sharedMaterial &&
      !(mesh?.metadata?.clones && mesh.metadata?.clones?.length >= 1)
    )
      flock.ensureUniqueMaterial(mesh);

    const normalizeColorInput = (input) => {
      if (Array.isArray(input)) return input;
      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            return JSON.parse(trimmed.replace(/'/g, '"'));
          } catch {
            return input;
          }
        }
      }
      return input;
    };

    const normalizedColor = normalizeColorInput(color);
    const colors = Array.isArray(normalizedColor) ? normalizedColor : [normalizedColor];
    let colorIndex = 0;

    if (flock.materialsDebug) console.log(` Changing the colour of ${mesh.name} to ${colors}`);

    // Map to keep track of materials and their assigned colours and indices
    const materialToColorMap = new Map();

    function applyColorInOrder(part) {
      if (isTextPlaneMesh(part)) return;

      if (part.material) {
        // Check if the material is already processed
        if (!materialToColorMap.has(part.material)) {
          const currentIndex = colorIndex % colors.length;

          const hexColor = flock.getColorFromString(colors[currentIndex]);

          // Use setMaterialWithCleanup to request a new material with the color
          flock.setMaterialWithCleanup(part, { color: hexColor });

          // Map the original material to the colour and its assigned index
          materialToColorMap.set(part.material, {
            hexColor,
            index: currentIndex,
          });

          // Set metadata on this mesh with its colour index
          if (!part.metadata) {
            part.metadata = {};
          }
          if (!part.metadata.materialIndex) {
            part.metadata.materialIndex = colorIndex;
          }

          colorIndex++;
        } else {
          // Material already processed, reapply the existing index
          if (!part.metadata) {
            part.metadata = {};
          }

          if (part.metadata.materialIndex === undefined) {
            part.metadata.materialIndex = colorIndex;
          }
        }
      }

      // Process the submeshes (children) of the current mesh, sorted alphabetically
      const sortedChildMeshes = part
        .getChildMeshes()
        .filter((child) => !isTextPlaneMesh(child))
        .sort((a, b) => a.name.localeCompare(b.name));
      sortedChildMeshes.forEach((child) => applyColorInOrder(child));
    }

    // Start applying colours to the main mesh and its hierarchy

    if (!isCharacterLike) {
      applyColorInOrder(mesh);
    } else {
      const root = getRootMesh(mesh);
      const currentPalette = {};
      const parts = [root, ...root.getChildMeshes()];
      parts.forEach((part) => {
        const partName = getPartNameFromMesh(part);
        if (!partName || currentPalette[partName]) return;
        const mat = part.material;
        const color = mat?.albedoColor || mat?.diffuseColor || null;
        if (color?.toHexString) currentPalette[partName] = color.toHexString();
      });

      let characterColors;
      if (Array.isArray(color) && color.length > 1) {
        characterColors = {
          hair: colors[0] ?? currentPalette.hair,
          skin: colors[1] ?? currentPalette.skin,
          eyes: colors[2] ?? currentPalette.eyes,
          tshirt: colors[3] ?? currentPalette.tshirt,
          shorts: colors[4] ?? currentPalette.shorts,
          sleeves: colors[5] ?? currentPalette.sleeves,
        };
      } else {
        const singleColor = Array.isArray(color) ? color[0] : color;
        characterColors = {
          hair: singleColor,
          skin: singleColor,
          eyes: singleColor,
          tshirt: singleColor,
          shorts: singleColor,
          sleeves: singleColor,
        };
      }

      flock.applyColorsToCharacter(mesh, characterColors);
      return;
    }

    // If no material was found, create a new one and set metadata
    if (materialToColorMap.size === 0) {
      flock.setMaterialWithCleanup(mesh, { color: colors[0] });
      mesh.metadata = mesh.metadata || {};
      if (mesh.metadata.materialIndex === undefined) {
        mesh.metadata.materialIndex = 0;
      }
    }

    try {
      if (mesh.metadata.shapeType === 'Cylinder') {
        mesh.forceSharedVertices();
        mesh.convertToFlatShadedMesh();
      }
    } catch (e) {
      console.log('Error converting mesh to flat shaded:', e);
    }

    if (mesh.metadata?.glow) {
      flock.glowMesh(mesh);
    }
  },
  // Map a raw name (mesh/material/metadata) onto one of the canonical
  // character part names (hair, skin, eyes, tshirt, shorts, sleeves), or null
  // if it isn't a recognised character part.
  canonicalizePartName(name = '') {
    const CHARACTER_PART_ALIASES = {
      hair: 'hair',
      skin: 'skin',
      eyes: 'eyes',
      shorts: 'shorts',
      tshirt: 'tshirt',
      't-shirt': 'tshirt',
      tee: 'tshirt',
      sleeves: 'sleeves',
      sleeve: 'sleeves',
      detail: 'sleeves',
      shoes: 'sleeves',
    };

    const s = String(name).toLowerCase();
    for (const key of Object.keys(CHARACTER_PART_ALIASES)) {
      if (s === key || s.includes(key)) return CHARACTER_PART_ALIASES[key];
    }
    return null;
  },
  getCanonicalPartName(node) {
    return (
      flock.canonicalizePartName(node?.metadata?.materialPartName) ||
      flock.canonicalizePartName(node?.material?.name) ||
      flock.canonicalizePartName(node?.name)
    );
  },
  applyColorToMaterial(part, materialName, color) {
    const targetPart = flock.canonicalizePartName(materialName);
    const partName = flock.getCanonicalPartName(part);

    if (part.material && targetPart && partName === targetPart) {
      part.material.diffuseColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color)
      );
      part.material.albedoColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color)
      );
      part.metadata = part.metadata || {};
      part.metadata.materialPartName = targetPart;
    }

    part.getChildMeshes().forEach((child) => {
      flock.applyColorToMaterial(child, materialName, color);
    });
  },
  applyColorsToCharacter(mesh, colors) {
    const {
      hair: hairColor,
      skin: skinColor,
      eyes: eyesColor,
      sleeves: sleevesColor,
      shorts: shortsColor,
      tshirt: tshirtColor,
    } = colors;

    const seedPartMetadata = (part, label) => {
      if (!part) return;
      part.metadata = part.metadata || {};
      if (!part.metadata.materialPartName) {
        part.metadata.materialPartName = label;
      }
    };

    const ensurePartMetadata = (root) => {
      if (!root) return;
      const parts = [root, ...root.getChildMeshes()];
      parts.forEach((part) => {
        if (!part) return;
        const rawName = part.metadata?.materialPartName || part.material?.name || part.name;
        const lower = String(rawName || '').toLowerCase();
        if (lower.includes('hair')) seedPartMetadata(part, 'hair');
        else if (lower.includes('skin')) seedPartMetadata(part, 'skin');
        else if (lower.includes('eyes')) seedPartMetadata(part, 'eyes');
        else if (lower.includes('shorts')) seedPartMetadata(part, 'shorts');
        else if (lower.includes('tshirt') || lower.includes('t-shirt') || lower.includes('tee'))
          seedPartMetadata(part, 'tshirt');
        else if (
          lower.includes('sleeves') ||
          lower.includes('sleeve') ||
          lower.includes('detail') ||
          lower.includes('shoes')
        )
          seedPartMetadata(part, 'sleeves');
      });
    };

    ensurePartMetadata(mesh);

    if (hairColor != null) flock.applyColorToMaterial(mesh, 'Hair', hairColor);
    if (skinColor != null) flock.applyColorToMaterial(mesh, 'Skin', skinColor);
    if (eyesColor != null) flock.applyColorToMaterial(mesh, 'Eyes', eyesColor);
    if (sleevesColor != null) flock.applyColorToMaterial(mesh, 'Detail', sleevesColor);
    if (shortsColor != null) flock.applyColorToMaterial(mesh, 'Shorts', shortsColor);
    if (tshirtColor != null) flock.applyColorToMaterial(mesh, 'TShirt', tshirtColor);
    if (tshirtColor != null) flock.applyColorToMaterial(mesh, 'Tshirt', tshirtColor);
    if (sleevesColor != null) flock.applyColorToMaterial(mesh, 'Sleeves', sleevesColor);
    if (sleevesColor != null) flock.applyColorToMaterial(mesh, 'Shoes', sleevesColor);
  },
  changeMaterial(meshName, materialName, color) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'changeMaterial', name: meshName })) {
          resolve();
          return;
        }
        if (flock.materialsDebug)
          console.log(`Changing material of ${meshName} to ${materialName}`);
        const texturePath = flock.texturePath + materialName;
        flock.changeMaterialMesh(mesh, materialName, texturePath, color);
        resolve();
      });
    });
  },
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },
  // Babylon skips a mesh until every texture on its material has loaded, so
  // attaching up front leaves a hole where the mesh should be. Show the flat
  // colour immediately and attach once the image is in.
  attachTextureWhenLoaded(material, texture) {
    if (!material || !texture) return texture;

    if (texture.isReady()) {
      material.diffuseTexture = texture;
      return texture;
    }

    material.metadata ??= {};
    material.metadata.pendingTexture = texture;

    const observer = texture.onLoadObservable.addOnce(() => {
      material.diffuseTexture = texture;
      if (material.metadata?.pendingTexture === texture) {
        delete material.metadata.pendingTexture;
      }
    });
    material.onDisposeObservable.addOnce(() => texture.onLoadObservable.remove(observer));

    return texture;
  },
  // A clone taken mid-load has no texture of its own; it waits for the same one.
  inheritPendingTexture(source, clone) {
    const pending = source?.metadata?.pendingTexture;
    if (pending && clone && !clone.diffuseTexture) {
      flock.attachTextureWhenLoaded(clone, pending);
    }
    return clone;
  },
  // 1x1 white stand-in for shader materials, which sample the texture directly
  // and so can't defer it. Scene-owned so it dies with the scene.
  whitePlaceholderTexture() {
    const scene = flock.scene;
    if (!scene) return null;

    const store = (scene.reservedDataStore ??= {});
    if (!store.flockWhitePlaceholder || store.flockWhitePlaceholder.isDisposed?.()) {
      const texture = new flock.BABYLON.DynamicTexture(
        'flockTexturePlaceholder',
        { width: 1, height: 1 },
        scene,
        false
      );
      const ctx = texture.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
      texture.update();
      store.flockWhitePlaceholder = texture;
    }
    return store.flockWhitePlaceholder;
  },
  // The texture a material renders with, which mid-load is still pending.
  materialTexture(material) {
    if (!material) return null;
    return (
      material.diffuseTexture ||
      material.albedoTexture ||
      material.baseTexture ||
      material.metadata?.pendingTexture ||
      null
    );
  },
  changeMaterialMesh(mesh, materialName, texturePath, color, alpha = 1) {
    if (flock.materialsDebug) console.log('Change material', materialName, color);
    flock.ensureUniqueMaterial(mesh);

    // Create a new material
    const material = new flock.BABYLON.StandardMaterial(materialName, flock.scene);

    // Load the texture if provided
    if (texturePath) {
      flock.attachTextureWhenLoaded(material, new flock.BABYLON.Texture(texturePath, flock.scene));
    }

    // Set colour if provided
    if (color) {
      const hexColor = flock.getColorFromString(color);
      const babylonColor = flock.BABYLON.Color3.FromHexString(hexColor);
      material.diffuseColor = babylonColor;
    }

    material.alpha = alpha;
    material.backFaceCulling = false;

    const isTextPlaneMesh = (part) => part?.name === 'textPlane' || part?.metadata?.isTextPlane;

    // Assign the material to the mesh and its descendants
    const allMeshes = [mesh].concat(mesh.getDescendants()).filter((part) => !isTextPlaneMesh(part));
    allMeshes.forEach((part) => {
      part.material = material;
      flock.adjustMaterialTilingToMesh(part, material);
    });

    if (mesh.metadata?.glow) {
      flock.glowMesh(mesh);
    }

    return material;
  },

  setMaterial(meshName, materials) {
    const materialArray = Array.isArray(materials) ? materials : [materials];

    flock.setMaterialInternal(meshName, materialArray);

    flock.whenModelReady(meshName, (mesh) => {
      mesh.metadata?.clones?.forEach((cloneName) => {
        flock.setMaterialInternal(cloneName, materialArray);
      });
    });
  },
  setMaterialInternal(meshName, materials) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'setMaterial', name: meshName })) {
          resolve();
          return;
        }
        flock.applyMaterialToHierarchy(mesh, materials, {
          applyColor: true,
          blockKey: null,
        });

        if (mesh.metadata?.glow) {
          flock.glowMesh(mesh);
        }
        resolve();
      });
    });
  },
  createMaterial({ color, materialName, alpha, glow = false, direction } = {}) {
    if (flock?.materialsDebug) console.log(`Create material: ${materialName}`);
    let material;
    const texturePath = flock.texturePath + materialName;

    // Normalize single-element array to plain value
    if (Array.isArray(color) && color.length === 1) color = color[0];
    if (Array.isArray(color) && color.length >= 2) {
      const normalizedColors = color.map((c) => flock.getColorFromString(c).toLowerCase());
      const allColorsIdentical = normalizedColors.every((c) => c === normalizedColors[0]);
      if (allColorsIdentical) {
        color = normalizedColors[0];
      }
    }

    if (Array.isArray(color) && color.length >= 2) {
      // Use gradient for Flat material
      if (materialName === 'none.png') {
        material = flock.createGradientMaterial(materialName, color, direction);
        material.backFaceCulling = false;
      } else {
        // Use shader-based color replacement for patterned materials
        material = flock.createColorReplaceShaderMaterial(materialName, texturePath, color);
        material.backFaceCulling = false;
      }
    } else {
      // Default to StandardMaterial for single color or no color
      material = new flock.BABYLON.StandardMaterial(materialName, flock.scene);

      // Load texture if provided
      if (texturePath) {
        const texture = new flock.BABYLON.Texture(texturePath, flock.scene);
        // Apply default tiling for consistency
        texture.uScale = 1;
        texture.vScale = 1;
        flock.attachTextureWhenLoaded(material, texture);
      }

      // Set single color if provided
      if (color) {
        const hexColor = flock.getColorFromString(color);
        const babylonColor = flock.BABYLON.Color3.FromHexString(hexColor);
        material.diffuseColor = babylonColor;
      }

      material.backFaceCulling = false;
    }

    material.alpha = alpha;

    // Update alpha for shader materials
    if (material.setFloat && alpha !== undefined) {
      material.setFloat('alpha', alpha);
    }

    // Emissive would flatten a gradient, so those glow through the halo alone.
    if (glow && material.emissiveColor !== undefined && !Array.isArray(color)) {
      material.emissiveColor = color
        ? flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color))
        : flock.BABYLON.Color3.White();
      material.emissiveIntensity = 1.0;
    }

    if (flock.materialsDebug) console.log(`Created the material: ${material.name}`);
    return material;
  },
  // A gradient material is shared between meshes, so the range it spans has to be
  // set per draw call. Every route that produces one must attach this, or the
  // gradient keeps the placeholder bounds it was constructed with.
  createGradientMaterial(name, colors, direction) {
    const material = new flock.BABYLON.StandardMaterial(name, flock.scene);
    const plugin = gradientPluginOn(material) ?? new (gradientPluginClass())(material);
    plugin.setColors(colors, direction);

    material.metadata = {
      ...(material.metadata || {}),
      gradientDirection: Number(direction) || 0,
      gradientColors: colors.slice(),
    };

    return material;
  },
  // Create shader material for color replacement
  registerFogAwareShaderMaterial(material) {
    if (!material) return;
    flock._fogAwareShaderMaterials ??= new Set();
    flock._fogAwareShaderMaterials.add(material);
    material.onDisposeObservable?.add(() => {
      flock._fogAwareShaderMaterials?.delete(material);
    });
  },
  updateFogUniformsForShaderMaterial(material) {
    if (!material?.setVector3 || !material?.setFloat || !material?.setInt) return;

    const scene = flock.scene;
    const fogColor = scene?.fogColor || flock.BABYLON.Color3.Black();

    material.setVector3('fogColor', new flock.BABYLON.Vector3(fogColor.r, fogColor.g, fogColor.b));
    material.setFloat('fogDensity', scene?.fogDensity ?? 0);
    material.setFloat('fogStart', scene?.fogStart ?? 0);
    material.setFloat('fogEnd', scene?.fogEnd ?? 0);
    material.setInt('fogMode', scene?.fogMode ?? flock.BABYLON.Scene.FOGMODE_NONE);
  },
  updateFogAwareShaderMaterials() {
    if (!flock._fogAwareShaderMaterials) return;
    flock._fogAwareShaderMaterials.forEach((material) => {
      flock.updateFogUniformsForShaderMaterial(material);
    });
  },
  createColorReplaceShaderMaterial(materialName, texturePath, colors) {
    // Define vertex shader
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;

      uniform mat4 worldViewProjection;
      uniform mat4 world;
      uniform mat4 view;

      varying vec2 vUV;
      varying vec3 vFogPosition;

      void main(void) {
        vec4 worldPosition = world * vec4(position, 1.0);
        vec4 viewPosition = view * worldPosition;
        gl_Position = worldViewProjection * vec4(position, 1.0);
        vUV = uv;
        vFogPosition = viewPosition.xyz;
      }
    `;

    // Define updated fragment shader
    const fragmentShader = `
      precision highp float;

      varying vec2 vUV;

      uniform sampler2D textureSampler;
      uniform vec3 lightColor;      // Replaces white
      uniform vec3 greyTintColor;   // Tints greys in proportion
      uniform vec3 darkColor;       // Replaces black (when colorCount >= 3)
      uniform int colorCount;
      uniform float alpha;
      uniform float uScale;         // Horizontal tiling
      uniform float vScale;         // Vertical tiling
      uniform vec3 fogColor;
      uniform float fogDensity;
      uniform float fogStart;
      uniform float fogEnd;
      uniform int fogMode;

      varying vec3 vFogPosition;

      void main(void) {
        vec2 scaledUV = vec2(vUV.x * uScale, vUV.y * vScale);
        vec4 texColor = texture2D(textureSampler, scaledUV);

        if (texColor.a < 0.5) {
          discard;
        }

        float brightness = (texColor.r + texColor.g + texColor.b) / 3.0;
        float colorDiff = max(
          max(abs(texColor.r - texColor.g), abs(texColor.r - texColor.b)),
          abs(texColor.g - texColor.b)
        );

        vec3 finalColor;
        if (brightness > 0.95 && colorDiff < 0.05) {
          // Replace near-white
          finalColor = lightColor;
        } else if (colorCount >= 3 && brightness < 0.2 && colorDiff < 0.2) {
          // Replace near-black (third color)
          finalColor = darkColor;
        } else if (colorDiff < 0.2) {
          // Tint greys
          finalColor = brightness * greyTintColor;
        } else {
          // Leave as is
          finalColor = texColor.rgb;
        }

        float fogDistance = length(vFogPosition);
        float fogFactor = 1.0;
        if (fogMode == 1) {
          fogFactor = exp(-fogDensity * fogDistance);
        } else if (fogMode == 2) {
          fogFactor = exp(-pow(fogDensity * fogDistance, 2.0));
        } else if (fogMode == 3) {
          fogFactor = (fogEnd - fogDistance) / max(0.0001, fogEnd - fogStart);
        }
        fogFactor = clamp(fogFactor, 0.0, 1.0);

        vec3 foggedColor = mix(fogColor, finalColor, fogFactor);
        gl_FragColor = vec4(foggedColor, texColor.a * alpha);
      }
    `;

    // Create shader material
    const shaderMaterial = new flock.BABYLON.ShaderMaterial(
      materialName + '_shader',
      flock.scene,
      {
        vertex: 'colorReplace',
        fragment: 'colorReplace',
      },
      {
        attributes: ['position', 'uv'],
        uniforms: [
          'worldViewProjection',
          'world',
          'view',
          'textureSampler',
          'lightColor',
          'greyTintColor',
          'darkColor',
          'colorCount',
          'alpha',
          'uScale',
          'vScale',
          'fogColor',
          'fogDensity',
          'fogStart',
          'fogEnd',
          'fogMode',
        ],
        needAlphaBlending: false,
      }
    );

    // Register shaders
    flock.BABYLON.Effect.ShadersStore['colorReplaceVertexShader'] = vertexShader;
    flock.BABYLON.Effect.ShadersStore['colorReplaceFragmentShader'] = fragmentShader;

    // Set texture
    if (texturePath) {
      const texture = new flock.BABYLON.Texture(texturePath, flock.scene);
      texture.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      texture.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      const placeholder = texture.isReady() ? null : flock.whitePlaceholderTexture();
      if (placeholder) {
        // White resolves to the first colour below, so the mesh shows flat
        // colour rather than vanishing until the image arrives.
        shaderMaterial.setTexture('textureSampler', placeholder);
        const observer = texture.onLoadObservable.addOnce(() => {
          shaderMaterial.setTexture('textureSampler', texture);
        });
        shaderMaterial.onDisposeObservable.addOnce(() => texture.onLoadObservable.remove(observer));
      } else {
        shaderMaterial.setTexture('textureSampler', texture);
      }
      // Apply tiling through shader uniforms (shader materials don't automatically use texture matrix)
      // Use scale of 1 to match single-color material behavior
      shaderMaterial.setFloat('uScale', 1);
      shaderMaterial.setFloat('vScale', 1);
    }

    // Convert colors and set uniforms
    const colorLight = flock.hexToRgb(flock.getColorFromString(colors[0])); // replaces white
    const colorGrey = flock.hexToRgb(flock.getColorFromString(colors[1])); // tints greys

    shaderMaterial.setVector3(
      'lightColor',
      new flock.BABYLON.Vector3(colorLight.r / 255.0, colorLight.g / 255.0, colorLight.b / 255.0)
    );

    shaderMaterial.setVector3(
      'greyTintColor',
      new flock.BABYLON.Vector3(colorGrey.r / 255.0, colorGrey.g / 255.0, colorGrey.b / 255.0)
    );

    const colorDark =
      colors.length >= 3
        ? flock.hexToRgb(flock.getColorFromString(colors[2]))
        : { r: 0, g: 0, b: 0 };
    shaderMaterial.setVector3(
      'darkColor',
      new flock.BABYLON.Vector3(colorDark.r / 255.0, colorDark.g / 255.0, colorDark.b / 255.0)
    );
    shaderMaterial.setInt('colorCount', colors.length);

    shaderMaterial.setFloat('alpha', 1.0);
    flock.registerFogAwareShaderMaterial(shaderMaterial);
    flock.updateFogUniformsForShaderMaterial(shaderMaterial);
    shaderMaterial.onBindObservable?.add(() => {
      flock.updateFogUniformsForShaderMaterial(shaderMaterial);
    });

    return shaderMaterial;
  },
  createMultiGradientShaderMaterial(materialName, colors) {
    // Vertex Shader
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;

      uniform mat4 worldViewProjection;
      varying vec2 vUV;

      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        vUV = uv;
      }
    `;

    // Fixed Fragment Shader with unrolled blending logic
    const fragmentShader = `
      precision highp float;

      varying vec2 vUV;
      uniform vec3 color[6];
      uniform int colorCount;
      uniform float alpha;

      void main(void) {
        float y = clamp(vUV.y, 0.0, 1.0);
        float step = 1.0 / float(colorCount - 1);
        vec3 finalColor = color[colorCount - 1];

        if (colorCount >= 2) {
          float lower = 0.0 * step;
          float upper = 1.0 * step;
          if (y >= lower && y <= upper) {
            float t = (y - lower) / step;
            finalColor = mix(color[0], color[1], t);
          }
        }

        if (colorCount >= 3) {
          float lower = 1.0 * step;
          float upper = 2.0 * step;
          if (y >= lower && y <= upper) {
            float t = (y - lower) / step;
            finalColor = mix(color[1], color[2], t);
          }
        }

        if (colorCount >= 4) {
          float lower = 2.0 * step;
          float upper = 3.0 * step;
          if (y >= lower && y <= upper) {
            float t = (y - lower) / step;
            finalColor = mix(color[2], color[3], t);
          }
        }

        if (colorCount >= 5) {
          float lower = 3.0 * step;
          float upper = 4.0 * step;
          if (y >= lower && y <= upper) {
            float t = (y - lower) / step;
            finalColor = mix(color[3], color[4], t);
          }
        }

        if (colorCount >= 6) {
          float lower = 4.0 * step;
          float upper = 5.0 * step;
          if (y >= lower && y <= upper) {
            float t = (y - lower) / step;
            finalColor = mix(color[4], color[5], t);
          }
        }

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // Register shaders once
    if (!flock.BABYLON.Effect.ShadersStore['multiGradientVertexShader']) {
      flock.BABYLON.Effect.ShadersStore['multiGradientVertexShader'] = vertexShader;
    }
    if (!flock.BABYLON.Effect.ShadersStore['multiGradientFragmentShader']) {
      flock.BABYLON.Effect.ShadersStore['multiGradientFragmentShader'] = fragmentShader;
    }

    // Create shader material
    const shaderMaterial = new flock.BABYLON.ShaderMaterial(
      materialName + '_multiGradient',
      flock.scene,
      {
        vertex: 'multiGradient',
        fragment: 'multiGradient',
      },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'color', 'colorCount', 'alpha'],
        needAlphaBlending: false,
      }
    );

    // Clamp to max 6 colors
    const clampedColors = colors.slice(0, 6);
    const count = clampedColors.length;

    for (let i = 0; i < 6; i++) {
      const hex = flock.getColorFromString(clampedColors[i] || clampedColors[count - 1]);
      const rgb = flock.hexToRgb(hex);
      shaderMaterial.setVector3(
        `color[${i}]`,
        new flock.BABYLON.Vector3(rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0)
      );
    }

    shaderMaterial.setInt('colorCount', count);
    shaderMaterial.setFloat('alpha', 1.0);

    return shaderMaterial;
  },
  setMaterialWithCleanup(mesh, materialData) {
    if (!mesh) return;

    const oldMat = mesh.material;

    // Transparency belongs to the object: a colour naming no alpha keeps the
    // mesh's own.
    const newMat = flock.getOrCreateMaterial(materialData, oldMat?.alpha ?? 1);

    if (oldMat === newMat) return;

    mesh.material = newMat;

    if (oldMat && oldMat.metadata && oldMat.metadata.isManaged) {
      const cacheKey = oldMat.metadata.cacheKey;
      const isStillInUse = flock.scene.meshes.some(
        (m) => m !== mesh && !m.isDisposed() && m.material === oldMat
      );

      if (!isStillInUse) {
        if (cacheKey && flock.materialCache[cacheKey]) {
          delete flock.materialCache[cacheKey];
        }
        oldMat.dispose(false, true);
      }
    }
  },
  getOrCreateMaterial(colorInput, alpha = 1) {
    const isObject =
      typeof colorInput === 'object' && colorInput !== null && !Array.isArray(colorInput);

    let rawColor = '#ffffff';
    let texName = 'none.png';
    let finalAlpha = alpha;
    let finalGlow = false;
    let finalDirection;

    if (isObject) {
      const inner = colorInput.color || colorInput.baseColor;
      const isInnerObject = typeof inner === 'object' && inner !== null && !Array.isArray(inner);

      if (isInnerObject) {
        rawColor = inner.color || inner.baseColor || '#ffffff';
        texName =
          inner.materialName ||
          inner.textureSet ||
          colorInput.materialName ||
          colorInput.textureSet ||
          'none.png';
        finalAlpha =
          inner.alpha !== undefined
            ? inner.alpha
            : colorInput.alpha !== undefined
              ? colorInput.alpha
              : alpha;
        finalGlow = inner.glow !== undefined ? inner.glow : (colorInput.glow ?? false);
        finalDirection = readGradientDirection(inner) ?? readGradientDirection(colorInput);
      } else {
        rawColor = inner || '#ffffff';
        texName = colorInput.materialName || colorInput.textureSet || 'none.png';
        finalAlpha = colorInput.alpha !== undefined ? colorInput.alpha : alpha;
        finalGlow = colorInput.glow ?? false;
        finalDirection = readGradientDirection(colorInput);
      }
    } else {
      rawColor = colorInput || '#ffffff';
    }

    const colorKey = withGradientDirection(
      Array.isArray(rawColor) ? rawColor.join('-') : rawColor,
      finalDirection
    );
    const alphaKey = parseFloat(finalAlpha).toFixed(2);
    const glowKey = finalGlow ? 'glow' : 'noglow';
    const cacheKey = `mat_${colorKey}_${alphaKey}_${texName}_${glowKey}`.toLowerCase();

    if (!flock.materialCache) flock.materialCache = {};
    if (flock.materialCache[cacheKey]) return flock.materialCache[cacheKey];

    const materialParams = {
      color: rawColor,
      materialName: texName,
      alpha: finalAlpha,
      glow: finalGlow,
      ...(Number.isFinite(finalDirection) ? { direction: finalDirection } : {}),
    };

    const newMat = flock.createMaterial(materialParams);

    newMat.name = cacheKey;
    newMat.alpha = finalAlpha;

    if (!newMat.metadata) newMat.metadata = {};
    newMat.metadata.cacheKey = cacheKey;
    newMat.metadata.isManaged = true;
    newMat.metadata.texName = texName;

    if (finalAlpha < 1) {
      newMat.transparencyMode = flock.BABYLON.Material.MATERIAL_ALPHABLEND;
      newMat.needDepthPrePass = true;
    }

    flock.materialCache[cacheKey] = newMat;
    return newMat;
  },
  applyMaterialToHierarchy(rootMesh, colorInput, opts = {}) {
    const applyColor = opts.applyColor ?? true;
    if (!applyColor || !rootMesh || !colorInput) return rootMesh;

    const isTextPlaneMesh = (part) => part?.name === 'textPlane' || part?.metadata?.isTextPlane;

    const geometryMeshes = rootMesh
      .getDescendants(false)
      .filter(
        (n) => n instanceof flock.BABYLON.Mesh && n.getTotalVertices() > 0 && !isTextPlaneMesh(n)
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

    const targets = geometryMeshes.length ? geometryMeshes : [rootMesh];

    const isMaterialDescriptor = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

    const getRawColor = (v) => {
      const raw = isMaterialDescriptor(v) ? v.color || v.baseColor : v;
      // A single-element colour list produces ["#rrggbb"]; normalise to a string
      // so that downstream callers like getColorFromString receive a plain string.
      return Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
    };

    const getTexName = (v) =>
      isMaterialDescriptor(v) ? v.materialName || v.textureSet || 'NONE' : 'NONE';

    const getAlpha = (v, m) =>
      (isMaterialDescriptor(v) ? (v.alpha ?? opts.alpha) : opts.alpha) ?? m?.material?.alpha ?? 1;

    const makeTargetCacheKey = (v, m) => {
      const rawColor = getRawColor(v);
      const colorKey = withGradientDirection(
        Array.isArray(rawColor)
          ? rawColor.join('-')
          : flock.getColorFromString(rawColor) || '#ffffff',
        readGradientDirection(v)
      );
      const texName = String(getTexName(v));
      const alphaKey = parseFloat(getAlpha(v, m)).toFixed(2);
      const glow =
        typeof v === 'object' && v !== null && !Array.isArray(v) ? (v.glow ?? false) : false;
      const glowKey = glow ? 'glow' : 'noglow';

      return `mat_${colorKey}_${alphaKey}_${texName}_${glowKey}`.toLowerCase();
    };

    const applyOne = (m, v, index) => {
      if (!(m instanceof flock.BABYLON.Mesh)) return;

      m.metadata = m.metadata || {};

      if (index !== undefined) m.metadata.materialIndex = index;
      else if (m.metadata.materialIndex !== undefined) delete m.metadata.materialIndex;

      const targetCacheKey = makeTargetCacheKey(v, m);
      if (m.material?.metadata?.cacheKey === targetCacheKey) return;

      flock.setMaterialWithCleanup(m, v);

      if (m.material) {
        flock.adjustMaterialTilingToMesh(m, m.material);
        m.material.needDepthPrePass = getAlpha(v, m) > 0;
      }
    };

    if (Array.isArray(colorInput)) {
      const flat = colorInput.flat();
      if (!flat.length) return rootMesh;

      // Character models split a single logical part (e.g. the shorts) across
      // several sub-meshes. Group those by canonical part name so the whole
      // part draws one entry from the list, mirroring how the colour list is
      // distributed; otherwise the top and bottom of the shorts would land on
      // adjacent indices and get different materials. Meshes with no recognised
      // part name fall back to one slot each, preserving the per-mesh ordering
      // used by ordinary multi-mesh objects.
      const isCharacterLike = targets.some((m) => flock.getCanonicalPartName(m));

      if (isCharacterLike) {
        const groupIndexByKey = new Map();
        targets.forEach((m) => {
          const key = flock.getCanonicalPartName(m) || `mesh:${m.uniqueId}`;
          let index = groupIndexByKey.get(key);
          if (index === undefined) {
            index = groupIndexByKey.size;
            groupIndexByKey.set(key, index);
          }
          applyOne(m, flat[index % flat.length], index);
        });
      } else {
        targets.forEach((m, i) => {
          const v = flat[i % flat.length];
          applyOne(m, v, i);
        });
      }
    } else {
      targets.forEach((m) => applyOne(m, colorInput));
    }

    return rootMesh;
  },
};
