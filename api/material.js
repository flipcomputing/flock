let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockMaterial = {
  adjustMaterialTilingToMesh(mesh, material, unitsPerTile = null) {
    return; // Don't scale textures - need to change the mesh UVs instead
    if (!mesh || !material) return;

    if (mesh.metadata?.skipAutoTiling) return;

    const shapeType = mesh?.metadata?.shapeType;
    const bakedShapes = new Set([
      "Box",
      "Sphere",
      "Cylinder",
      "Capsule",
      "Plane",
    ]);
    if (shapeType && bakedShapes.has(shapeType)) return;

    const tex =
      material.diffuseTexture ||
      material.albedoTexture ||
      material.baseTexture ||
      null;

    if (
      !tex ||
      typeof tex.uScale !== "number" ||
      typeof tex.vScale !== "number"
    ) {
      return;
    }

    const wrap = flock?.BABYLON?.Texture?.WRAP_ADDRESSMODE ?? 1;
    tex.wrapU = wrap;
    tex.wrapV = wrap;

    mesh.computeWorldMatrix?.(true);
    mesh.refreshBoundingInfo?.();
    const extend = mesh.getBoundingInfo?.()?.boundingBox?.extendSizeWorld;
    if (!extend) return;

    const existingTile = mesh.metadata?.textureTileSize;
    const tile =
      Number.isFinite(unitsPerTile) && unitsPerTile > 0
        ? unitsPerTile
        : Number.isFinite(existingTile) && existingTile > 0
          ? existingTile
          : 2;
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.textureTileSize = tile;
    const worldWidth = extend.x * 2;
    const worldHeight = extend.y * 2;
    const worldDepth = extend.z * 2;

    const newUScale = worldWidth / tile;
    const newVScale = Math.max(worldHeight, worldDepth) / tile;

    if (Number.isFinite(newUScale) && newUScale > 0) tex.uScale = newUScale;
    if (Number.isFinite(newVScale) && newVScale > 0) tex.vScale = newVScale;
  },
  adjustMaterialTilingForHierarchy(mesh, unitsPerTile) {
    if (!mesh) return;
    const targets = [mesh, ...(mesh.getDescendants?.() || [])];
    targets.forEach((m) => {
      const mat =
        m.material ||
        (m.getClassName?.() === "InstancedMesh"
          ? m.sourceMesh?.material
          : null);
      flock.adjustMaterialTilingToMesh(m, mat, unitsPerTile);
    });
  },
  /* randomColour() {
          const colors = [
                  "#FF6B6B",
                  "#4ECDC4",
                  "#45B7D1",
                  "#96CEB4",
                  "#FFEAA7",
                  "#DDA0DD",
                  "#98D8C8",
                  "#F7DC6F",
                  "#BB8FCE",
                  "#85C1E9",
                  "#F8C471",
                  "#82E0AA",
                  "#F1948A",
                  "#85C1E9",
                  "#D7BDE2",
          ];
          return colors[Math.floor(Math.random() * colors.length)];
  },
  hexToRgba(hex, alpha = 1) {
          // Remove the hash if present
          hex = hex.replace(/^#/, "");

          // Parse the hex values
          const bigint = parseInt(hex, 16);
          const r = (bigint >> 16) & 255;
          const g = (bigint >> 8) & 255;
          const b = bigint & 255;

          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
  hexToRgb(hex) {
          // Remove the hash if present
          hex = hex.replace(/^#/, "");

          // Parse the hex values
          const bigint = parseInt(hex, 16);
          const r = (bigint >> 16) & 255;
          const g = (bigint >> 8) & 255;
          const b = bigint & 255;

          return { r, g, b };
  },
  rgbToHex(r, g, b) {
          // Ensure values are within valid range
          r = Math.max(0, Math.min(255, Math.round(r)));
          g = Math.max(0, Math.min(255, Math.round(g)));
          b = Math.max(0, Math.min(255, Math.round(b)));

          // Convert to hex and pad with zeros if needed
          const hex =
                  "#" +
                  [r, g, b]
                          .map((x) => {
                                  const hex = x.toString(16);
                                  return hex.length === 1
                                          ? "0" + hex
                                          : hex;
                          })
                          .join("");

          return hex;
  },*/
  randomColour() {
    const letters = "0123456789ABCDEF";
    let colour = "#";
    for (let i = 0; i < 6; i++) {
      colour += letters[Math.floor(Math.random() * 16)];
    }
    if (flock.materialsDebug)
      console.log(`  Generated the random colour ${colour}`);
    return colour;
  },
  rgbToHex(rgb) {
    const matches = rgb.match(/\d+/g);
    if (!matches || matches.length < 3) {
      return "#000000"; // fallback to black for invalid input
    }
    const result = matches.slice(0, 3).map(function (x) {
      const num = parseInt(x);
      if (isNaN(num)) return "00";
      const hex = Math.max(0, Math.min(255, num)).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    });
    return "#" + result.join("");
  },
  hexToRgba(hex, alpha) {
    hex = hex.replace(/^#/, "");
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    // if (flock.materialsDebug) console.log(`  Converted ${hex} with alpha ${alpha} to rgba(${r}, ${g}, ${b}, ${alpha})`);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
  // Helper function to convert hex to RGB
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
  getColorFromString(colourString) {
    // if (flock.materialsDebug) console.log(` Getting a colour from ${colourString}`);

    if (/^#([0-9A-F]{3}){1,2}$/i.test(colourString)) {
      return colourString;
    }

    try {
      const colorDiv = flock.document.createElement("div");
      colorDiv.style.color = colourString;
      flock.document.body.appendChild(colorDiv);
      const computedColor = getComputedStyle(colorDiv).color;

      flock.document.body.removeChild(colorDiv);
      // Parse the rgb(r, g, b) string and convert to individual numbers
      const matches = computedColor.match(/\d+/g);
      if (!matches || matches.length < 3) {
        return "#000000";
      }
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      const result = flock.rgbToHex(r, g, b);
      return result;
    } catch (e) {
      return "#000000";
    }
  },

  tint(meshName, { color } = {}) {
    if (flock.materialsDebug)
      console.log(`Changing tint of ${meshName} by ${color}`);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (mesh.material) {
          mesh.renderOverlay = true;
          mesh.overlayAlpha = 0.5;
          mesh.overlayColor = flock.BABYLON.Color3.FromHexString(
            flock.getColorFromString(color),
          );
        }

        mesh.getChildMeshes().forEach(function (childMesh) {
          if (childMesh.material) {
            childMesh.renderOverlay = true;
            childMesh.overlayAlpha = 0.5;
            childMesh.overlayColor = flock.BABYLON.Color3.FromHexString(
              flock.getColorFromString(flock.getColorFromString(color)),
            );
          }
        });
        mesh.metadata?.clones?.forEach((cloneName) =>
          flock.tint(cloneName, { color: color }),
        );
        resolve();
      });
    });
  },
  highlight(meshName, { color } = {}) {
    if (flock.materialsDebug)
      console.log(`Highlighting ${meshName} with ${color}`);
    const applyHighlight = (mesh) => {
      if (mesh.material) {
        flock.highlighter.addMesh(
          mesh,
          flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color)),
        );
      }
    };

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        applyHighlight(mesh);
        mesh.getChildMeshes().forEach(applyHighlight);
        mesh.metadata?.clones?.forEach((cloneName) =>
          flock.highlight(cloneName, { color: color }),
        );
        resolve();
      });
    });
  },
  glow(meshName, { color } = {}) {
    if (flock.materialsDebug) console.log(`Making ${meshName} glow`);
    // Ensure the glow layer is initialised
    if (!flock.glowLayer) {
      flock.glowLayer = new flock.BABYLON.GlowLayer("glowLayer", flock.scene);
      flock.glowLayer.intensity = 0.5;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        flock.glowMesh(mesh, color);
        mesh.metadata?.clones?.forEach((cloneName) =>
          flock.whenModelReady((cloneMesh) =>
            flock.glowMesh(cloneMesh, { color: color }),
          ),
        );
        resolve();
      });
    });
  },
  glowMesh(mesh, glowColor = null) {
    const applyGlow = (m) => {
      m.metadata = m.metadata || {};
      m.metadata.glow = true;

      if (m.material) {
        const currentMat = m.material;
        const color = glowColor
          ? flock.getColorFromString(glowColor)
          : (currentMat.diffuseColor
              ? "#" + currentMat.diffuseColor.toHexString().slice(1)
              : (currentMat.albedoColor
                  ? "#" + currentMat.albedoColor.toHexString().slice(1)
                  : "#ffffff"));

        const materialParams = {
          color: color,
          materialName: currentMat.metadata?.cacheKey?.split("_")[3] || "none.png",
          alpha: currentMat.alpha ?? 1,
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
        const allMeshes = [mesh, ...mesh.getDescendants()].filter(
          (m) => m instanceof flock.BABYLON.Mesh && m.getTotalVertices() > 0,
        );

        allMeshes.forEach((nextMesh) => {
          const oldMat = nextMesh.material;
          if (!oldMat || !oldMat.metadata?.cacheKey) return;

          const parts = oldMat.metadata.cacheKey.split("_");
          const colorPart = parts[1];
          const texPart = parts[3];

          const color = colorPart.includes("-")
            ? colorPart.split("-")
            : colorPart;

          const materialParams = {
            color: color,
            materialName: texPart,
            alpha: value,
          };

          flock.setMaterialWithCleanup(nextMesh, materialParams);

          if (nextMesh.material) {
            nextMesh.material.transparencyMode =
              flock.BABYLON.Material.MATERIAL_ALPHABLEND;
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
        if (flock.materialsDebug)
          console.log(`Clear effects from ${meshName}:`);
        const removeEffects = (targetMesh) => {
          if (targetMesh.material) {
            const currentMat = targetMesh.material;
            const color = currentMat.diffuseColor
              ? "#" + currentMat.diffuseColor.toHexString().slice(1)
              : (currentMat.albedoColor
                  ? "#" + currentMat.albedoColor.toHexString().slice(1)
                  : "#ffffff");

            const materialParams = {
              color: color,
              materialName: currentMat.metadata?.cacheKey?.split("_")[3] || "none.png",
              alpha: currentMat.alpha ?? 1,
              glow: false,
            };

            flock.setMaterialWithCleanup(targetMesh, materialParams);
          }

          targetMesh.metadata = targetMesh.metadata || {};
          targetMesh.metadata.glow = false;

          if (flock.glowLayer) {
            flock.glowLayer.removeIncludedOnlyMesh(targetMesh);
          }

          flock.highlighter.removeMesh(targetMesh);
          targetMesh.renderOverlay = false;
        };

        removeEffects(mesh);
        mesh.getChildMeshes().forEach(removeEffects);
        mesh?.metadata?.clones?.forEach((cloneName) =>
          flock.clearEffects(cloneName),
        );
        resolve();
      });
    });
  },
  ensureUniqueMaterial(mesh) {
    // Helper function to clone material for a mesh
    const cloneMaterial = (originalMaterial) => {
      return originalMaterial.clone(`${originalMaterial.name}`);
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
            console.log(
              ` Cloning material, ${currentMesh.material}, of ${currentMesh.name}`,
            );
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
      new flock.BABYLON.StandardMaterial("defaultMaterial", flock.scene);
    defaultMaterial.backFaceCulling = false;

    // Helper function to copy color properties from PBR to Standard material
    const copyColorProperties = (pbrMaterial, standardMaterial) => {
      // Check for albedoColor first (as seen in your debug output)
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
      if (material && material.getClassName() === "PBRMaterial") {
        if (!replacedMaterialsMap.has(material)) {
          // Replace with a cloned default material, preserving the name
          const originalName = material.name;
          const newMaterial = defaultMaterial.clone(originalName);

          // Check if this is a target material and copy colors
          const materialNameLower = originalName.toLowerCase();
          const targetMaterials = ["black", "white", "mouth", "nose"];
          const isTargetMaterial = targetMaterials.some((target) =>
            materialNameLower.includes(target),
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
        const targetMaterials = ["black", "white", "mouth", "nose"];
        const isTargetMaterial = targetMaterials.some((target) =>
          materialNameLower.includes(target),
        );

        if (!isTargetMaterial) {
          targetMesh.material.alpha = 1;
        }

        targetMesh.material.transparencyMode =
          flock.BABYLON.Material.MATERIAL_OPAQUE;
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
    // Dispose of all replaced materials
    replacedMaterialsMap.forEach((newMaterial, oldMaterial) => {
      oldMaterial.dispose();
    });
  },
  changeColor(meshName, { color } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (flock.materialsDebug)
          console.log(`Change colour of ${meshName} to ${color}:`);
        if (!mesh) {
          flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
            flock.getColorFromString(color),
          );
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
      flock.scene.clearColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );
      return;
    }

    if (
      mesh.metadata?.sharedMaterial &&
      !(mesh?.metadata?.clones && mesh.metadata?.clones?.length >= 1)
    )
      flock.ensureUniqueMaterial(mesh);

    // Ensure color is an array
    const colors = Array.isArray(color) ? color : [color];
    let colorIndex = 0;

    if (flock.materialsDebug)
      console.log(` Changing the colour of ${mesh.name} to ${colors}`);

    // Map to keep track of materials and their assigned colours and indices
    const materialToColorMap = new Map();

    function applyColorInOrder(part) {
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
        .sort((a, b) => a.name.localeCompare(b.name));
      sortedChildMeshes.forEach((child) => applyColorInOrder(child));
    }

    // Start applying colours to the main mesh and its hierarchy

    if (!flock.characterNames.includes(mesh.metadata?.meshName)) {
      applyColorInOrder(mesh);
    } else {
      const characterColors = {
        hair: colors[0],
        skin: colors[1],
        eyes: colors[2],
        tshirt: colors[3],
        shorts: colors[4],
        sleeves: colors[5],
      };
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
      if (mesh.metadata.shapeType === "Cylinder") {
        mesh.forceSharedVertices();
        mesh.convertToFlatShadedMesh();
      }
    } catch (e) {
      console.log("Error converting mesh to flat shaded:", e);
    }

    if (mesh.metadata?.glow) {
      flock.glowMesh(mesh);
    }
  },
  applyColorToMaterial(part, materialName, color) {
    const CHARACTER_PART_ALIASES = {
      hair: "hair",
      skin: "skin",
      eyes: "eyes",
      shorts: "shorts",
      tshirt: "tshirt",
      "t-shirt": "tshirt",
      tee: "tshirt",
      sleeves: "sleeves",
      sleeve: "sleeves",
      detail: "sleeves",
      shoes: "sleeves",
    };

    const canonicalizePartName = (name = "") => {
      const s = String(name).toLowerCase();
      for (const key of Object.keys(CHARACTER_PART_ALIASES)) {
        if (s === key || s.includes(key)) return CHARACTER_PART_ALIASES[key];
      }
      return null;
    };

    const getPartNameFromMesh = (mesh) => {
      const metaName = mesh?.metadata?.materialPartName;
      return (
        canonicalizePartName(metaName) ||
        canonicalizePartName(mesh?.material?.name) ||
        canonicalizePartName(mesh?.name)
      );
    };

    const targetPart = canonicalizePartName(materialName);
    const partName = getPartNameFromMesh(part);

    if (part.material && targetPart && partName === targetPart) {
      part.material.diffuseColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
      );
      part.material.albedoColor = flock.BABYLON.Color3.FromHexString(
        flock.getColorFromString(color),
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
        const rawName =
          part.metadata?.materialPartName || part.material?.name || part.name;
        const lower = String(rawName || "").toLowerCase();
        if (lower.includes("hair")) seedPartMetadata(part, "hair");
        else if (lower.includes("skin")) seedPartMetadata(part, "skin");
        else if (lower.includes("eyes")) seedPartMetadata(part, "eyes");
        else if (lower.includes("shorts")) seedPartMetadata(part, "shorts");
        else if (
          lower.includes("tshirt") ||
          lower.includes("t-shirt") ||
          lower.includes("tee")
        )
          seedPartMetadata(part, "tshirt");
        else if (
          lower.includes("sleeves") ||
          lower.includes("sleeve") ||
          lower.includes("detail") ||
          lower.includes("shoes")
        )
          seedPartMetadata(part, "sleeves");
      });
    };

    ensurePartMetadata(mesh);

    flock.applyColorToMaterial(mesh, "Hair", hairColor);
    flock.applyColorToMaterial(mesh, "Skin", skinColor);
    flock.applyColorToMaterial(mesh, "Eyes", eyesColor);
    flock.applyColorToMaterial(mesh, "Detail", sleevesColor);
    flock.applyColorToMaterial(mesh, "Shorts", shortsColor);
    flock.applyColorToMaterial(mesh, "TShirt", tshirtColor);
    flock.applyColorToMaterial(mesh, "Tshirt", tshirtColor);
    flock.applyColorToMaterial(mesh, "Sleeves", sleevesColor);
    flock.applyColorToMaterial(mesh, "Shoes", sleevesColor);
  },
  changeMaterial(meshName, materialName, color) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
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
  changeMaterialMesh(mesh, materialName, texturePath, color, alpha = 1) {
    if (flock.materialsDebug)
      console.log("Change material", materialName, color);
    flock.ensureUniqueMaterial(mesh);

    // Create a new material
    const material = new flock.BABYLON.StandardMaterial(
      materialName,
      flock.scene,
    );

    // Load the texture if provided
    if (texturePath) {
      const texture = new flock.BABYLON.Texture(texturePath, flock.scene);
      material.diffuseTexture = texture;
    }

    // Set colour if provided
    if (color) {
      const hexColor = flock.getColorFromString(color);
      const babylonColor = flock.BABYLON.Color3.FromHexString(hexColor);
      material.diffuseColor = babylonColor;
    }

    material.alpha = alpha;
    material.backFaceCulling = false;

    // Assign the material to the mesh and its descendants
    const allMeshes = [mesh].concat(mesh.getDescendants());
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
    console.log("Applying material to", meshName, "with", materials);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
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
  createMaterial({ color, materialName, alpha, glow = false } = {}) {
    if (flock?.materialsDebug) console.log(`Create material: ${materialName}`);
    let material;
    const texturePath = flock.texturePath + materialName;

    // Handle two-color case
    if (Array.isArray(color) && color.length === 2) {
      // Use gradient for Flat material
      if (materialName === "none.png") {
        material = new flock.GradientMaterial(materialName, flock.scene);
        material.bottomColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color[0]),
        );
        material.topColor = flock.BABYLON.Color3.FromHexString(
          flock.getColorFromString(color[1]),
        );
        material.offset = 0.5;
        material.smoothness = 0.5;
        material.scale = 1.0;
        material.backFaceCulling = false;
      } else {
        // Use shader-based color replacement for patterned materials
        material = flock.createColorReplaceShaderMaterial(
          materialName,
          texturePath,
          color,
        );
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
        material.diffuseTexture = texture;
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
      material.setFloat("alpha", alpha);
    }

    // Apply glow properties if enabled
    if (glow && material.emissiveColor !== undefined) {
      const emissiveColor = color
        ? flock.BABYLON.Color3.FromHexString(flock.getColorFromString(Array.isArray(color) ? color[0] : color))
        : flock.BABYLON.Color3.White();
      material.emissiveColor = emissiveColor;
      material.emissiveIntensity = 1.0;
    }

    if (flock.materialsDebug)
      console.log(`Created the material: ${material.name}`);
    return material;
  },
  createMultiColorGradientMaterial(name, colors) {
    const shaderMaterial = new flock.BABYLON.ShaderMaterial(
      name,
      flock.scene,
      {
        vertex: "multiGradient",
        fragment: "multiGradient",
      },
      {
        attributes: ["position"],
        uniforms: [
          "worldViewProjection",
          "colorCount",
          "colors",
          "alpha",
          "minMax",
        ],
      },
    );

    // Convert colors to Color3 array
    const color3Array = colors
      .map((c) => {
        const hex = flock.getColorFromString(c);
        const color3 = flock.BABYLON.Color3.FromHexString(hex);
        return [color3.r, color3.g, color3.b];
      })
      .flat();

    if (flock.materialsDebug) {
      console.log("Color count:", colors.length);
      console.log("Color array:", color3Array);
    }

    shaderMaterial.setInt("colorCount", colors.length);
    shaderMaterial.setArray3("colors", color3Array);
    shaderMaterial.setFloat("alpha", 1.0);
    shaderMaterial.setVector2("minMax", new flock.BABYLON.Vector2(-1, 1)); // Will be updated when applied to mesh

    // Define shaders
    flock.BABYLON.Effect.ShadersStore["multiGradientVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      uniform vec2 minMax;
      varying float vGradient;

      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        // Normalize Y position to 0-1 range using minMax
        vGradient = (position.y - minMax.x) / (minMax.y - minMax.x);
      }
    `;

    flock.BABYLON.Effect.ShadersStore["multiGradientFragmentShader"] = `
      precision highp float;
      varying float vGradient;
      uniform int colorCount;
      uniform vec3 colors[16];
      uniform float alpha;

      void main(void) {
        float t = clamp(vGradient, 0.0, 1.0);
        int count = colorCount;

        if (count > 16) count = 16;
        if (count < 2) count = 2;

        // Calculate position in the gradient (0 to count-1)
        float position = t * float(count - 1);
        int segment = int(floor(position));
        float localT = position - float(segment);

        // Ensure we don't go out of bounds
        if (segment >= count - 1) {
          segment = count - 2;
          localT = 1.0;
        }

        // Get the two colors to interpolate between
        vec3 color1 = colors[segment];
        vec3 color2 = colors[segment + 1];

        // Smooth interpolation
        vec3 finalColor = mix(color1, color2, localT);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    return shaderMaterial;
  },
  // Create shader material for color replacement
  createColorReplaceShaderMaterial(materialName, texturePath, colors) {
    // Define vertex shader
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

    // Define updated fragment shader
    const fragmentShader = `
      precision highp float;

      varying vec2 vUV;

      uniform sampler2D textureSampler;
      uniform vec3 lightColor;      // Replaces white
      uniform vec3 greyTintColor;   // Tints greys in proportion
      uniform float alpha;
      uniform float uScale;         // Horizontal tiling
      uniform float vScale;         // Vertical tiling

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
        } else if (colorDiff < 0.05) {
          // Tint greys
          finalColor = brightness * greyTintColor;
        } else {
          // Leave as is
          finalColor = texColor.rgb;
        }

        gl_FragColor = vec4(finalColor, texColor.a * alpha);
      }
    `;

    // Create shader material
    const shaderMaterial = new flock.BABYLON.ShaderMaterial(
      materialName + "_shader",
      flock.scene,
      {
        vertex: "colorReplace",
        fragment: "colorReplace",
      },
      {
        attributes: ["position", "uv"],
        uniforms: [
          "worldViewProjection",
          "textureSampler",
          "lightColor",
          "greyTintColor",
          "alpha",
          "uScale",
          "vScale",
        ],
        needAlphaBlending: false,
      },
    );

    // Register shaders
    flock.BABYLON.Effect.ShadersStore["colorReplaceVertexShader"] =
      vertexShader;
    flock.BABYLON.Effect.ShadersStore["colorReplaceFragmentShader"] =
      fragmentShader;

    // Set texture
    if (texturePath) {
      const texture = new flock.BABYLON.Texture(texturePath, flock.scene);
      texture.wrapU = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      texture.wrapV = flock.BABYLON.Texture.WRAP_ADDRESSMODE;
      shaderMaterial.setTexture("textureSampler", texture);
      // Apply tiling through shader uniforms (shader materials don't automatically use texture matrix)
      // Use scale of 1 to match single-color material behavior
      shaderMaterial.setFloat("uScale", 1);
      shaderMaterial.setFloat("vScale", 1);
    }

    // Convert colors and set uniforms
    const colorLight = flock.hexToRgb(flock.getColorFromString(colors[0])); // replaces white
    const colorGrey = flock.hexToRgb(flock.getColorFromString(colors[1])); // tints greys

    shaderMaterial.setVector3(
      "lightColor",
      new flock.BABYLON.Vector3(
        colorLight.r / 255.0,
        colorLight.g / 255.0,
        colorLight.b / 255.0,
      ),
    );

    shaderMaterial.setVector3(
      "greyTintColor",
      new flock.BABYLON.Vector3(
        colorGrey.r / 255.0,
        colorGrey.g / 255.0,
        colorGrey.b / 255.0,
      ),
    );

    shaderMaterial.setFloat("alpha", 1.0);

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
    if (!flock.BABYLON.Effect.ShadersStore["multiGradientVertexShader"]) {
      flock.BABYLON.Effect.ShadersStore["multiGradientVertexShader"] =
        vertexShader;
    }
    if (!flock.BABYLON.Effect.ShadersStore["multiGradientFragmentShader"]) {
      flock.BABYLON.Effect.ShadersStore["multiGradientFragmentShader"] =
        fragmentShader;
    }

    // Create shader material
    const shaderMaterial = new flock.BABYLON.ShaderMaterial(
      materialName + "_multiGradient",
      flock.scene,
      {
        vertex: "multiGradient",
        fragment: "multiGradient",
      },
      {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "color", "colorCount", "alpha"],
        needAlphaBlending: false,
      },
    );

    // Clamp to max 6 colors
    const clampedColors = colors.slice(0, 6);
    const count = clampedColors.length;

    for (let i = 0; i < 6; i++) {
      const hex = flock.getColorFromString(
        clampedColors[i] || clampedColors[count - 1],
      );
      const rgb = flock.hexToRgb(hex);
      shaderMaterial.setVector3(
        `color[${i}]`,
        new flock.BABYLON.Vector3(rgb.r / 255.0, rgb.g / 255.0, rgb.b / 255.0),
      );
    }

    shaderMaterial.setInt("colorCount", count);
    shaderMaterial.setFloat("alpha", 1.0);

    return shaderMaterial;
  },
  setMaterialWithCleanup(mesh, materialData) {
    if (!mesh) return;

    const oldMat = mesh.material;

    // Get or create from cache
    const newMat = flock.getOrCreateMaterial(materialData);

    if (oldMat === newMat) return;

    mesh.material = newMat;

    if (oldMat && oldMat.metadata && oldMat.metadata.isManaged) {
      const cacheKey = oldMat.metadata.cacheKey;
      const isStillInUse = flock.scene.meshes.some(
        (m) => m !== mesh && !m.isDisposed() && m.material === oldMat,
      );

      if (!isStillInUse) {
        if (cacheKey && flock.materialCache[cacheKey]) {
          delete flock.materialCache[cacheKey];
        }
        oldMat.dispose(true, true);
      }
    }
  },
  getOrCreateMaterial(colorInput, alpha = 1, scene) {
    const isObject =
      typeof colorInput === "object" &&
      colorInput !== null &&
      !Array.isArray(colorInput);

    let rawColor = "#ffffff";
    let texName = "none.png";
    let finalAlpha = alpha;
    let finalGlow = false;

    if (isObject) {
      const inner = colorInput.color || colorInput.baseColor;
      const isInnerObject =
        typeof inner === "object" && inner !== null && !Array.isArray(inner);

      if (isInnerObject) {
        rawColor = inner.color || inner.baseColor || "#ffffff";
        texName =
          inner.materialName ||
          inner.textureSet ||
          colorInput.materialName ||
          colorInput.textureSet ||
          "none.png";
        finalAlpha =
          inner.alpha !== undefined
            ? inner.alpha
            : colorInput.alpha !== undefined
              ? colorInput.alpha
              : alpha;
        finalGlow = inner.glow !== undefined ? inner.glow : (colorInput.glow ?? false);
      } else {
        rawColor = inner || "#ffffff";
        texName =
          colorInput.materialName || colorInput.textureSet || "none.png";
        finalAlpha = colorInput.alpha !== undefined ? colorInput.alpha : alpha;
        finalGlow = colorInput.glow ?? false;
      }
    } else {
      rawColor = colorInput || "#ffffff";
    }

    const colorKey = Array.isArray(rawColor) ? rawColor.join("-") : rawColor;
    const alphaKey = parseFloat(finalAlpha).toFixed(2);
    const glowKey = finalGlow ? "glow" : "noglow";
    const cacheKey = `mat_${colorKey}_${alphaKey}_${texName}_${glowKey}`.toLowerCase();

    if (!flock.materialCache) flock.materialCache = {};
    if (flock.materialCache[cacheKey]) return flock.materialCache[cacheKey];

    const materialParams = {
      color: rawColor,
      materialName: texName,
      alpha: finalAlpha,
      glow: finalGlow,
    };

    const newMat = flock.createMaterial(materialParams);

    newMat.name = cacheKey;
    newMat.alpha = finalAlpha;

    if (!newMat.metadata) newMat.metadata = {};
    newMat.metadata.cacheKey = cacheKey;
    newMat.metadata.isManaged = true;

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

    const geometryMeshes = rootMesh
      .getDescendants(false)
      .filter(
        (n) => n instanceof flock.BABYLON.Mesh && n.getTotalVertices() > 0,
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    const targets = geometryMeshes.length ? geometryMeshes : [rootMesh];

    const isMaterialDescriptor = (v) =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    const getRawColor = (v) =>
      isMaterialDescriptor(v) ? v.color || v.baseColor : v;

    const getTexName = (v) =>
      isMaterialDescriptor(v)
        ? v.materialName || v.textureSet || "NONE"
        : "NONE";

    const getAlpha = (v) =>
      isMaterialDescriptor(v)
        ? (v.alpha ?? opts.alpha ?? 1)
        : (opts.alpha ?? 1);

    const makeTargetCacheKey = (v) => {
      const rawColor = getRawColor(v);
      const resolvedHex = flock.getColorFromString(rawColor) || "#ffffff";
      const texName = String(getTexName(v));
      const alpha = getAlpha(v);

      // This matches your existing cache key convention closely while also
      // respecting alpha when it’s provided via descriptor or opts.
      return `mat_${resolvedHex.toLowerCase()}_${alpha}_${texName}`.toLowerCase();
    };

    const applyOne = (m, v, index) => {
      if (!(m instanceof flock.BABYLON.Mesh)) return;

      m.metadata = m.metadata || {};

      if (index !== undefined) m.metadata.materialIndex = index;
      else if (m.metadata.materialIndex !== undefined)
        delete m.metadata.materialIndex;

      const targetCacheKey = makeTargetCacheKey(v);
      if (m.material?.metadata?.cacheKey === targetCacheKey) return;

      flock.setMaterialWithCleanup(m, v);

      if (m.material) {
        flock.adjustMaterialTilingToMesh(m, m.material);
        m.material.needDepthPrePass = getAlpha(v) > 0;
      }
    };

    if (Array.isArray(colorInput)) {
      const flat = colorInput.flat();
      if (!flat.length) return rootMesh;

      targets.forEach((m, i) => {
        const v = flat[i % flat.length];
        applyOne(m, v, i);
      });
    } else {
      targets.forEach((m) => applyOne(m, colorInput));
    }

    return rootMesh;
  },
};
