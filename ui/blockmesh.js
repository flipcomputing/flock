import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators";
import { flock } from "../flock.js";
import { objectColours } from "../config.js";
import { createMeshOnCanvas } from "./addmeshes.js";
import { createBlockWithShadows, highlightBlockById } from "./addmenu.js";

const characterMaterials = [
  "Hair",
  "Skin",
  "Eyes",
  "Sleeves",
  "Shorts",
  "TShirt",
];

const colorFields = {
  HAIR_COLOR: true,
  SKIN_COLOR: true,
  EYES_COLOR: true,
  TSHIRT_COLOR: true,
  SHORTS_COLOR: true,
  SLEEVES_COLOR: true,
};

export function getRootMesh(mesh) {
  if (flock.meshDebug) console.log(mesh.parent);
  if (!mesh) return null;
  if (!mesh.parent) return mesh;
  return getRootMesh(mesh.parent);
}

export function deleteMeshFromBlock(blockId) {
  const blockKey = getBlockKeyFromBlockID(blockId);

  if (!blockKey) {
    const block = Blockly.getMainWorkspace().getBlockById(blockId);
    if (block && block.type === "create_map") {
      const mesh = flock?.scene?.getMeshByName("ground");
      if (mesh) {
        flock.disposeMesh(mesh);
        return;
      }
    }
  }

  if (!blockKey) {
    return;
  }

  const mesh = getMeshFromBlockKey(blockKey);

  if (!mesh || mesh.name === "__root__") {
  } else {
    flock.disposeMesh(mesh);
  }

  // Remove mappings
  delete meshMap[blockKey];
  delete meshBlockIdMap[blockKey];
}

export function getBlockKeyFromBlock(block) {
  return Object.keys(meshMap).find((key) => meshMap[key] === block);
}

export function getBlockKeyFromBlockID(blockId) {
  return Object.keys(meshBlockIdMap).find(
    (key) => meshBlockIdMap[key] === blockId,
  );
}

export function getMeshFromBlockKey(blockKey) {
  return flock.scene?.meshes?.find(
    (mesh) => mesh.metadata?.blockKey === blockKey,
  );
}

export function getMeshFromBlock(block) {
  if (block && block.type === "create_map") {
    return flock?.scene?.getMeshByName("ground");
  }

  if (block && block.type === "rotate_to") {
    block = block.getParent();
  }

  const blockKey = getBlockKeyFromBlock(block);

  if (!blockKey) return null;
  const found = getMeshFromBlockKey(blockKey);
  return found;
}

function getMeshFromBlockId(blockId) {
  const blockKey = getBlockKeyFromBlockID(blockId);

  return getMeshFromBlockKey(blockKey);
}

function rescaleBoundingBox(bb, newScale) {
  // Get the current world matrix before any transformation
  const originalWorldMatrix = bb.getWorldMatrix().clone();

  // Extract the original world position
  const originalPosition = originalWorldMatrix.getTranslation();

  // Bake current transform into vertices
  bb.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1 first
  bb.scaling.set(1, 1, 1);

  // Set the new scale and bake it
  bb.scaling.set(newScale, newScale, newScale);
  bb.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1 again
  bb.scaling.set(1, 1, 1);

  // Restore the original world position
  bb.position.copyFrom(originalPosition);
}

// Safe field getter. Returns null when field is missing or name is invalid.
function getBlockValue(block, fieldName) {
  if (!block) return null;
  if (typeof fieldName !== "string" || !fieldName) return null;
  const fld = block.getField(fieldName);
  return fld ? fld.getValue() : null;
}

// Safe colour reader: supports single colour, lists, and random_colour via API.
function readColourValue(block) {
  if (!block) return { value: null, kind: "none" };

  if (block.type === "lists_create_with") {
    const list = [];
    for (const input of block.inputList) {
      const tb = input.connection?.targetBlock();
      if (!tb) continue;

      if (tb.type === "random_colour") {
        const c =
          typeof flock?.randomColour === "function"
            ? flock.randomColour()
            : "#71BC78";
        list.push(c);
        continue;
      }

      const c =
        tb.getField?.("COLOR")?.getValue?.() ??
        tb.getField?.("COLOUR")?.getValue?.() ??
        null;

      if (c) list.push(c);
    }
    return { value: list, kind: "list" };
  }

  if (block.type === "random_colour") {
    const c =
      typeof flock?.randomColour === "function"
        ? flock.randomColour()
        : "#71BC78";
    return { value: c, kind: "single" };
  }

  const single =
    block.getField?.("COLOR")?.getValue?.() ??
    block.getField?.("COLOUR")?.getValue?.() ??
    null;

  return { value: single, kind: single ? "single" : "none" };
}

// Numeric from an input's NUM field, with fallback.
function readNumberInput(parent, inputName, fallback = 1) {
  const b = parent?.getInputTargetBlock?.(inputName);
  const v = b?.getField?.("NUM")?.getValue?.();
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

// Extract texture set, base colour (single or list), and alpha.
export function extractMaterialInfo(materialBlock) {
  if (!materialBlock) return { textureSet: "NONE", baseColor: null, alpha: 1 };

  const textureSet =
    getBlockValue(materialBlock, "TEXTURE_SET") ??
    getBlockValue(materialBlock, "TEXTURE") ??
    "NONE";

  const baseColorInput = materialBlock.getInputTargetBlock("BASE_COLOR");
  const read = readColourValue(baseColorInput);
  const baseColor = read.value ?? null;

  const alpha = readNumberInput(materialBlock, "ALPHA", 1);

  return { textureSet, baseColor, alpha };
}

// Add this function before updateMeshFromBlock
export function updateOrCreateMeshFromBlock(block, changeEvent) {
  if (flock.meshDebug)
    console.log(
      "Update or create mesh from block",
      block.type,
      changeEvent.type,
    );
  if (
    [
      "set_sky_color",
      "set_background_color",
      "create_ground",
      "create_map",
    ].includes(block.type)
  ) {
    // Always proceed to update
    updateMeshFromBlock(null, block, changeEvent);
    return;
  }
  const mesh = getMeshFromBlock(block);
  if (flock.meshDebug) console.log(mesh);
  const isEnabledEvent =
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "disabled" &&
    changeEvent.oldValue &&
    !changeEvent.newValue;
  const isImmediateEnabledCreate =
    changeEvent?.type === Blockly.Events.BLOCK_CREATE &&
    block.isEnabled() &&
    !mesh;
  if (window.loadingCode || block.disposed) return;
  const alreadyCreatingMesh = meshMap[block.id] !== undefined;
  if (!alreadyCreatingMesh && (isEnabledEvent || isImmediateEnabledCreate)) {
    createMeshOnCanvas(block);
    return;
  }
  if (flock.meshDebug) {
    console.log(
      "Should update?",
      changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
        changeEvent?.type === Blockly.Events.BLOCK_CREATE ||
        changeEvent?.type === Blockly.Events.BLOCK_MOVE,
    );
  }
  if (
    (changeEvent?.type === Blockly.Events.BLOCK_CHANGE ||
      changeEvent?.type === Blockly.Events.BLOCK_CREATE ||
      changeEvent?.type === Blockly.Events.BLOCK_MOVE) &&
    (mesh ||
      [
        "set_sky_color",
        "set_background_color",
        "create_ground",
        "create_map",
      ].includes(block.type))
  ) {
    updateMeshFromBlock(mesh, block, changeEvent);
  }
}

function setWorldBaseY(mesh, baseYWorld) {
  // Ensure up-to-date world AABB first
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();
  const bi = mesh.getBoundingInfo().boundingBox;
  const halfY = bi.extendSizeWorld.y;

  // Desired WORLD-space center Y = base + half-height
  const desiredCenterY = baseYWorld + halfY;

  // Keep current WORLD X/Z, move only Y in WORLD space
  const wp = mesh.getAbsolutePosition();
  mesh.setAbsolutePosition(new flock.BABYLON.Vector3(wp.x, desiredCenterY, wp.z));

  // Recompute after the move
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();
}

export function updateMeshFromBlock(mesh, block, changeEvent) {
  // --- Debug header ----------------------------------------------------------
  if (flock.meshDebug) {
    console.log("=== UPDATE MESH FROM BLOCK ===");
    console.log("Block type:", block?.type);
    console.log("Block ID:", block?.id);
    console.log("Change event type:", changeEvent?.type);
    console.log("Change event details:", changeEvent);
  }

  // --- Early outs for blocks that don't need a mesh --------------------------
  if (
    !mesh &&
    !["set_sky_color", "set_background_color", "create_ground", "create_map"].includes(block.type)
  ) {
    if (flock.meshDebug) console.log("No mesh and not a special block type, returning");
    return;
  }

  // --- Workspace helpers -----------------------------------------------------
  const ws = Blockly.getMainWorkspace();
  const getById = (id) => (id ? ws.getBlockById(id) : null);

  const inSubtree = (root, id) => {
    if (!root || !id) return false;
    const b = getById(id);
    if (!b) return false;
    if (b === root) return true;
    return root.getDescendants(false).some((d) => d.id === b.id);
  };

  const safeGetFieldValue = (b, field) => {
    if (!b || !field) return null;
    const f = b.getField(field);
    return f ? f.getValue() : null;
  };

  const numFrom = (b, inputName) => {
    // Defensive numeric read from an INPUT -> SHADOW/TARGET number
    const inp = b?.getInput(inputName);
    const tb = inp?.connection?.targetBlock();
    const v = tb?.getFieldValue("NUM");
    return v != null ? Number(v) : 0;
  };

  const readColourValue = (colourBlock) => {
    if (!colourBlock) return { value: null, kind: "none" };

    if (colourBlock.type === "lists_create_with") {
      const list = [];
      for (const input of colourBlock.inputList) {
        const tb = input.connection?.targetBlock();
        if (!tb) continue;

        if (tb.type === "random_colour") {
          list.push(flock.randomColour());
          continue;
        }

        const c = safeGetFieldValue(tb, "COLOR") ?? safeGetFieldValue(tb, "COLOUR") ?? null;
        if (c) list.push(c);
      }
      return { value: list, kind: "list" };
    }

    if (colourBlock.type === "random_colour") {
      return { value: flock.randomColour(), kind: "single" };
    }

    const single = safeGetFieldValue(colourBlock, "COLOR") ?? safeGetFieldValue(colourBlock, "COLOUR") ?? null;
    return { value: single, kind: single ? "single" : "none" };
  };

  // --- Work out WHAT changed -------------------------------------------------
  let changed = null; // <- ensure defined before any use
  const changedBlock = getById(changeEvent.blockId);
  const parent = changedBlock?.getParent() || changedBlock;

  if (flock.meshDebug) {
    console.log("Changed block:", changedBlock?.type);
    console.log("Parent block:", parent?.type);
  }

  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "field" &&
    changeEvent.blockId === block.id
  ) {
    if (
      (block.type === "load_object" && changeEvent.name === "MODELS") ||
      (block.type === "load_multi_object" && changeEvent.name === "MODELS") ||
      (block.type === "load_character" && changeEvent.name === "MODELS")
    ) {
      changed = "MODELS";
    } else if (block.type === "create_map" && changeEvent.name === "MAP_NAME") {
      changed = "MAP_NAME";
    } else if (["X", "Y", "Z", "SCALE", "WIDTH", "HEIGHT", "DEPTH", "DIAMETER", "DIAMETER_X", "DIAMETER_Y", "DIAMETER_Z", "DIAMETER_TOP", "DIAMETER_BOTTOM", "TESSELLATIONS"].includes(changeEvent.name)) {
      changed = changeEvent.name;
    }
  }

  if (!changed && parent?.inputList) {
    parent.inputList.forEach((input) => {
      const value =
        input?.connection?.shadowState?.id ||
        input?.connection?.targetConnection?.sourceBlock_?.id;
      if (value && changedBlock && value === changedBlock.id) {
        changed = input.name;
        if (flock.meshDebug) console.log(`Change detected in input: ${input.name}`);
      }
    });
  }

  if (!changed) {
    const colorInput = block.getInputTargetBlock("COLOR");
    if (colorInput) {
      const isMaterialChange =
        changeEvent.blockId === colorInput.id ||
        inSubtree(colorInput, changeEvent.blockId) ||
        inSubtree(colorInput, changeEvent.newParentId) ||
        inSubtree(colorInput, changeEvent.oldParentId);

      if (isMaterialChange) {
        changed = "COLOR";
        if (flock.meshDebug) console.log("Material change detected in COLOR input subtree");
      }
    }
  }

  if (!changed && block.type === "create_map") {
    const m = block.getInputTargetBlock("MATERIAL");
    if (m) {
      const touched =
        inSubtree(m, changeEvent.blockId) ||
        inSubtree(m, changeEvent.newParentId) ||
        inSubtree(m, changeEvent.oldParentId) ||
        (changeEvent.type === Blockly.Events.BLOCK_CHANGE && changeEvent.blockId === m.id);
      if (touched) changed = "MATERIAL";
    }
  }

  if (!changed) {
    if (["set_sky_color", "create_ground", "create_map"].includes(block.type)) {
      changed = "COLOR";
    } else {
      if (flock.meshDebug) console.log("No relevant change detected, returning");
      return;
    }
  }

  if (flock.meshDebug) console.log(`Processing change type: ${changed}`);

  // --- If this is a loader and MODELS changed, hand off ----------------------
  const shapeType = block.type;

  if (
    (block.type === "load_object" ||
      block.type === "load_multi_object" ||
      block.type === "load_character") &&
    changed === "MODELS" &&
    !mesh
  ) {
    mesh = getMeshFromBlock(block);
  }

  // Temporarily stop physics pre-step while we mutate transforms
  if (mesh?.physics) mesh.physics.disablePreStep = true;

  // --- Position inputs (from the BLOCK, i.e., "base" coordinates) -----------
  // NOTE: This is the *source of truth* for the desired base position.
  const position = {
    x: numFrom(block, "X"),
    y: numFrom(block, "Y"),
    z: numFrom(block, "Z"),
  };
  if (flock.meshDebug) console.log("Block position (base coords):", position);

  // --- Helpers to keep base-at-Y after any size/scale change -----------------
  const recomputeBI = (m) => {
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo();
    return m.getBoundingInfo().boundingBox.extendSizeWorld;
  };

  const ensureOrigScaleBaseline = (m) => {
    m.metadata = m.metadata || {};
    if (!m.metadata.__origScale) {
      // baseline = first time we touch scale in this session
      const ext = recomputeBI(m);
      m.metadata.__origScale = { x: m.scaling.x, y: m.scaling.y, z: m.scaling.z };
      m.metadata.__origExtent = { x: ext.x, y: ext.y, z: ext.z };
      if (flock.meshDebug) {
        console.log("Captured original scaling baseline:", m.metadata.__origScale);
        console.log("Captured original extent baseline:", m.metadata.__origExtent);
      }
    }
  };

  const placeBaseAtY = (m, baseY) => {
    const ext = recomputeBI(m); // extent AFTER size/scale change
    const newCenterY = Number(baseY) + ext.y;
    m.position.y = newCenterY;
    if (flock.meshDebug) {
      console.log("placeBaseAtY -> extent.y:", ext.y, "baseY:", baseY, "centerY:", newCenterY);
    }
  };

  // --- Sky / Background / Ground / Map branches (kept from your logic) -------
  if (block.type === "set_sky_color") {
    const colorInput = block.getInputTargetBlock("COLOR");
    if (colorInput && colorInput.type === "material") {
      const { textureSet, baseColor, alpha } = extractMaterialInfo(colorInput);
      const baseColorBlock = colorInput.getInputTargetBlock("BASE_COLOR");
      let read = readColourValue(baseColorBlock);
      if (read.value == null && !block.__skyRetry) {
        block.__skyRetry = true;
        requestAnimationFrame(() => {
          block.__skyRetry = false;
          updateMeshFromBlock(mesh, block, changeEvent);
        });
        return;
      }
      const colorValue = read.value ?? baseColor;
      if (textureSet && textureSet !== "NONE") {
        const materialOptions = { color: colorValue, materialName: textureSet, alpha };
        const material = flock.createMaterial(materialOptions);
        flock.setSky(material || colorValue);
        return;
      }
      flock.setSky(colorValue);
      return;
    }
    const read = readColourValue(colorInput);
    flock.setSky(read.value);
    return;
  }

  if (block.type === "set_background_color") {
    const read = readColourValue(block.getInputTargetBlock("COLOR"));
    flock.setSky(read.value);
    return;
  }

  if (block.type === "create_ground") {
    const colorInput = block.getInputTargetBlock("COLOR");
    if (colorInput && colorInput.type === "material") {
      const { textureSet, baseColor, alpha } = extractMaterialInfo(colorInput);
      const baseColorBlock = colorInput.getInputTargetBlock("BASE_COLOR");
      let read = readColourValue(baseColorBlock);
      if (flock.meshDebug) {
        console.log("Ground material info:", { textureSet, baseColor, alpha, colorValue: read.value });
      }
      if (read.value == null && !block.__groundRetry) {
        block.__groundRetry = true;
        requestAnimationFrame(() => {
          block.__groundRetry = false;
          updateMeshFromBlock(mesh, block, changeEvent);
        });
        return;
      }
      const colorValue = read.value ?? baseColor;
      if (textureSet && textureSet !== "NONE") {
        const materialOptions = { color: colorValue, materialName: textureSet, alpha };
        const material = flock.createMaterial(materialOptions);
        flock.createGround(material || colorValue, "ground");
        return;
      }
      flock.createGround(colorValue, "ground");
      return;
    }
    const read = readColourValue(colorInput);
    flock.createGround(read.value, "ground");
    return;
  }

  if (block.type === "create_map") {
    const map = block.getFieldValue("MAP_NAME");
    const materialBlock = block.getInputTargetBlock("MATERIAL");
    if (materialBlock) {
      const { textureSet, alpha } = extractMaterialInfo(materialBlock);
      const baseColorInput = materialBlock.getInputTargetBlock("BASE_COLOR");
      let read = readColourValue(baseColorInput);
      if (read.value == null && !block.__mapRetry) {
        block.__mapRetry = true;
        requestAnimationFrame(() => {
          block.__mapRetry = false;
          updateMeshFromBlock(mesh, block, changeEvent);
        });
        return;
      }
      const materialOptions = { color: read.value, materialName: textureSet, alpha };
      const material = flock.createMaterial(materialOptions);
      flock.createMap(map, material);
    }
    return;
  }

  // --- Color/material collection for object & primitives ---------------------
  let color;
  let materialInfo = null;

  const pullColor = () => {
    const ci = block.getInputTargetBlock("COLOR");
    if (ci && ci.type === "material") {
      materialInfo = extractMaterialInfo(ci);
      const baseColorBlock = ci.getInputTargetBlock("BASE_COLOR");
      const read = readColourValue(baseColorBlock);
      if (flock.meshDebug) {
        console.log("Material block detected:", {
          texture: materialInfo.textureSet, baseColor: materialInfo.baseColor,
          inputColor: read.value, alpha: materialInfo.alpha
        });
      }
      return read.value ?? materialInfo.baseColor;
    }
    const read = readColourValue(ci);
    return read.value;
  };

  if (!["load_object", "load_multi_object", "load_character", "create_map", "rotate_to"].includes(block.type)) {
    color = pullColor();
  } else if (block.type === "load_object" || block.type === "load_character") {
    color = pullColor();
  } else if (block.type === "load_multi_object") {
    const colorsBlock = block.getInput("COLORS").connection.targetBlock();
    const read = readColourValue(colorsBlock);
    color = read.value;
  }

  // --- Handle model replacement shortcuts ------------------------------------
  if (["load_object", "load_multi_object", "load_character"].includes(shapeType) && changed === "MODELS") {
    replaceMeshModel(mesh, block, changeEvent);
    return;
  }

  // --- SCALE handling (load_*): scale relative to original, keep base at Y ---
  if (shapeType.startsWith("load_") && changed === "SCALE") {
    const newScale = numFrom(block, "SCALE"); // scalar
    ensureOrigScaleBaseline(mesh);

    // Set scaling relative to original baseline, not compounding
    const os = mesh.metadata.__origScale;
    mesh.scaling.set(os.x * newScale, os.y * newScale, os.z * newScale);

    // Reposition so base sits at the block Y
    placeBaseAtY(mesh, position.y);

    if (flock.meshDebug) {
      console.log("=== LOAD_* SCALE APPLIED ===");
      console.log("New scale (scalar):", newScale);
      console.log("Applied scaling vector:", mesh.scaling);
      console.log("Mesh position after base placement:", mesh.position);
    }

    if (mesh.physics) {
      mesh.physics.disablePreStep = false;
      mesh.physics.setTargetTransform(mesh.position, mesh.rotationQuaternion);
    }
  }

  // --- Primitive dimension changes: keep base at Y ---------------------------
  const rebaseAfterSizeChange = () => {
    placeBaseAtY(mesh, position.y);
    if (flock.meshDebug) {
      console.log("Rebased mesh to base-Y after size change. pos:", mesh.position);
    }
  };

  switch (shapeType) {
    case "create_box": {
      if (["WIDTH", "HEIGHT", "DEPTH"].includes(changed)) {
        const width  = numFrom(block, "WIDTH");
        const height = numFrom(block, "HEIGHT");
        const depth  = numFrom(block, "DEPTH");
        if (flock.meshDebug) {
          console.log("=== BOX DIMENSION CHANGE ===", { width, height, depth });
        }
        setAbsoluteSize(mesh, width, height, depth);
        rebaseAfterSizeChange();
      }
      break;
    }
    case "create_sphere": {
      if (["DIAMETER_X", "DIAMETER_Y", "DIAMETER_Z"].includes(changed)) {
        const dx = numFrom(block, "DIAMETER_X");
        const dy = numFrom(block, "DIAMETER_Y");
        const dz = numFrom(block, "DIAMETER_Z");
        setAbsoluteSize(mesh, dx, dy, dz);
        rebaseAfterSizeChange();
      }
      break;
    }
    case "create_cylinder": {
      if (["HEIGHT", "DIAMETER_TOP", "DIAMETER_BOTTOM", "TESSELLATIONS"].includes(changed)) {
        const h  = numFrom(block, "HEIGHT");
        const dt = numFrom(block, "DIAMETER_TOP");
        const db = numFrom(block, "DIAMETER_BOTTOM");
        const s  = numFrom(block, "TESSELLATIONS");
        updateCylinderGeometry(mesh, dt, db, h, s);
        rebaseAfterSizeChange();
      }
      break;
    }
    case "create_capsule": {
      if (["HEIGHT", "DIAMETER"].includes(changed)) {
        const d = numFrom(block, "DIAMETER");
        const h = numFrom(block, "HEIGHT");
        setAbsoluteSize(mesh, d, h, d);
        rebaseAfterSizeChange();
      }
      break;
    }
    case "create_plane": {
      if (["HEIGHT", "WIDTH"].includes(changed)) {
        const w = numFrom(block, "WIDTH");
        const h = numFrom(block, "HEIGHT");
        setAbsoluteSize(mesh, w, h, 0);
        rebaseAfterSizeChange();
      }
      break;
    }
  }

  // --- Material / color updates (unchanged logic with debug) -----------------
  if (["COLOR", "COLORS", "BASE_COLOR"].includes(changed) || changed.startsWith?.("ADD")) {
    if (flock.meshDebug) {
      console.log("=== APPLYING COLOR/MATERIAL CHANGE ===");
      console.log("Block type:", block.type);
      console.log("Material info:", materialInfo);
      console.log("Color:", color);
      console.log("Color type:", typeof color, Array.isArray(color));
      console.log("Mesh position before color change:", mesh.position);
    }

    if (color) {
      if (color === "#9932cc" && block.type === "load_object") {
        const modelName = block.getFieldValue("MODELS");
        color = objectColours[modelName] || "#FFD700";
      }

      const ultimateParent = (m) => (m.parent ? ultimateParent(m.parent) : m);
      mesh = ultimateParent(mesh);

      const currentMaterial = mesh.material;
      const hasTexture =
        currentMaterial?.diffuseTexture ||
        currentMaterial?.name?.includes(".png") ||
        currentMaterial instanceof flock.GradientMaterial;

      if (materialInfo && materialInfo.textureSet && materialInfo.textureSet !== "NONE") {
        const materialOptions = { color, materialName: materialInfo.textureSet, alpha: materialInfo.alpha };
        if (flock.meshDebug) console.log("Creating & applying textured material:", materialOptions);
        const material = flock.createMaterial(materialOptions);
        flock.setMaterial(mesh.name, [material]);
      } else if (Array.isArray(color) && color.length === 2) {
        if (flock.meshDebug) console.log("Applying two-color array:", color);
        flock.changeColorMesh(mesh, color);
      } else if (hasTexture) {
        if (flock.meshDebug) console.log("Switching from textured -> flat color:", color);
        const materialOptions = { color, materialName: "none.png", alpha: materialInfo?.alpha ?? 1.0 };
        const material = flock.createMaterial(materialOptions);
        flock.setMaterial(mesh.name, [material]);
      } else {
        if (flock.meshDebug) console.log("Applying simple color change via changeColor:", color);
        flock.changeColor(mesh.name, { color });
      }
    }
  }

  // --- Position / rotation changes from block fields -------------------------
  if (["X", "Y", "Z"].includes(changed)) {
    if (flock.meshDebug) {
      console.log("=== POSITION CHANGE ===");
      console.log("Changed field:", changed);
      console.log("Desired base position:", position);
      console.log("Mesh position before:", mesh.position);
    }
    if (block.type === "rotate_to") {
      flock.rotateTo(mesh.name, position);
    } else {
      // positionAt: your API interprets base coords when useY=true
      flock.positionAt(mesh.name, { ...position, useY: true });
    }
    if (flock.meshDebug) console.log("Mesh position after:", mesh.position);
  } else if (changed === "SCALE") {
    // Re-apply any child rotate_to blocks after scale
    for (const child of block.getChildren()) {
      if (child.type === "rotate_to") {
        const rotation = {
          x: numFrom(child, "X"),
          y: numFrom(child, "Y"),
          z: numFrom(child, "Z"),
        };
        flock.rotateTo(mesh.name, rotation);
      }
    }
  }

  // --- Physics resume & final recompute --------------------------------------
  flock.updatePhysics(mesh);
  if (mesh?.physics) mesh.physics.disablePreStep = false;

  if (flock.meshDebug) console.log("=== UPDATE COMPLETE ===");
}


function moveMeshToOrigin(mesh) {
  mesh.position = flock.BABYLON.Vector3.Zero();
  mesh.rotation = flock.BABYLON.Vector3.Zero();
  return mesh;
}

function setAbsoluteSize(mesh, width, height, depth) {
  flock.ensureUniqueGeometry(mesh);
  const boundingInfo = mesh.getBoundingInfo();
  const originalSize = boundingInfo.boundingBox.extendSize;

  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(
    currentScale,
    currentRotationQuaternion,
    currentPosition,
  );

  // Temporarily move mesh to origin
  mesh = moveMeshToOrigin(mesh);

  // Calculate new scaling
  const newScaleX = width / (originalSize.x * 2);
  const newScaleY = height / (originalSize.y * 2);
  const newScaleZ = depth === 0 ? 1 : depth / (originalSize.z * 2);

  // Apply scaling
  mesh.scaling = new flock.BABYLON.Vector3(newScaleX, newScaleY, newScaleZ);

  // Bake the scaling into the vertices
  mesh.bakeCurrentTransformIntoVertices();

  // Reset scaling to 1,1,1
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Restore original position and rotation from world matrix
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;

  let shapeType = null;
  if (mesh.metadata) shapeType = mesh.metadata.shapeType;
  if (mesh.physics && shapeType) {
    const shape = mesh.physics.shape;
    let newShape, diameterBottom, startPoint, endPoint, diameter;

    // Create the new physics shape based on the type
    switch (shapeType) {
      case "Box":
        newShape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          new flock.BABYLON.Vector3(width, height, depth),
          mesh.getScene(),
        );
        break;
      case "Cylinder":
        diameterBottom = Math.min(width, depth);
        startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
        endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);
        newShape = new flock.BABYLON.PhysicsShapeCylinder(
          startPoint,
          endPoint,
          diameterBottom / 2,
          mesh.getScene(),
        );
        break;
      case "Sphere":
        newShape = new flock.BABYLON.PhysicsShapeSphere(
          flock.BABYLON.Vector3.Zero(),
          Math.max(width, depth, height) / 2,
          mesh.getScene(),
        );
        break;
      case "Capsule":
        diameter = Math.min(width, depth);

        newShape = flock.createCapsuleFromBoundingBox(mesh, mesh.getScene());
        break;
      default:
        console.log("Unknown or unsupported physics shape type: " + shapeType);
        break;
    }

    if (newShape) {
      shape.dispose();
      const physicsBody = mesh.physics;
      physicsBody.shape = newShape;
      mesh.physics.disablePreStep;
      mesh.computeWorldMatrix(true);
    }
  }
}

function updateCylinderGeometry(
  mesh,
  diameterTop,
  diameterBottom,
  height,
  sides,
) {
  // Store the current world matrix and decompose it
  const worldMatrix = mesh.computeWorldMatrix(true);
  const currentScale = new flock.BABYLON.Vector3();
  const currentRotationQuaternion = new flock.BABYLON.Quaternion();
  const currentPosition = new flock.BABYLON.Vector3();
  worldMatrix.decompose(
    currentScale,
    currentRotationQuaternion,
    currentPosition,
  );

  // If the mesh has geometry, dispose of it before updating
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  // Temporarily reset mesh transform
  mesh = moveMeshToOrigin(mesh);
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Create a temporary mesh with the provided dimensions (already in world space)
  const tempMesh = flock.BABYLON.MeshBuilder.CreateCylinder(
    "",
    {
      height: height,
      diameterTop: diameterTop,
      diameterBottom: diameterBottom,
      tessellation: sides,
      updatable: true,
    },
    mesh.getScene(),
  );

  // Extract vertex data from the temporary mesh
  const vertexData = flock.BABYLON.VertexData.ExtractFromMesh(tempMesh);

  // Create new geometry for the mesh
  const newGeometry = new flock.BABYLON.Geometry(
    mesh.name + "_geometry",
    mesh.getScene(),
    vertexData,
    true,
    mesh,
  );

  // Apply the new geometry to the mesh
  newGeometry.applyToMesh(mesh);
  mesh.makeGeometryUnique();

  // Dispose of the temporary mesh after extracting vertex data
  tempMesh.dispose();

  // Restore position and rotation only, keep scale at 1,1,1
  mesh.position = currentPosition;
  mesh.rotationQuaternion = currentRotationQuaternion;
  mesh.scaling = flock.BABYLON.Vector3.One();

  // Ensure the world matrix is updated
  mesh.computeWorldMatrix(true);
}

function replaceMeshModel(currentMesh, block) {
  if (!currentMesh || !block) return;

  const animationInfo = flock.getCurrentAnimationInfo(currentMesh);

  const modelName = block.getFieldValue("MODELS");
  if (!modelName) return;

  // ---------- helpers ----------
  function walkNodes(root) {
    const out = [];
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      out.push(n);
      if (n.getChildren) {
        const kids = n.getChildren();
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
    }
    return out;
  }

  function isRenderableMesh(n) {
    const cls = n?.getClassName?.();
    return cls === "Mesh" || cls === "InstancedMesh";
  }

  function firstRenderable(node) {
    const nodes = walkNodes(node);
    for (const n of nodes) {
      if (isRenderableMesh(n) && n.name !== "__root__") return n;
    }
    return null;
  }

  function disposeTree(node) {
    if (!node || node.isDisposed?.()) return;
    const kids = node.getChildren ? node.getChildren() : [];
    for (const k of kids) disposeTree(k);
    try {
      node.setParent?.(null);
    } catch {}
    try {
      node.dispose?.();
    } catch {}
  }

  function disposePhysics(node) {
    try {
      node.physics?.dispose?.();
    } catch {}
  }

  function stripPhysicsTree(root) {
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      disposePhysics(n);
      if (n.getChildren) {
        const kids = n.getChildren();
        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
    }
  }

  function _colToHex(c) {
    if (!c) return null;
    const r = Math.round(c.r * 255),
      g = Math.round(c.g * 255),
      b = Math.round(c.b * 255);
    return flock.rgbToHex(r, g, b);
  }

  function _matPrimaryColor(mat) {
    if (!mat) return null;
    return mat.diffuseColor !== undefined && mat.diffuseColor
      ? mat.diffuseColor
      : mat.albedoColor !== undefined && mat.albedoColor
        ? mat.albedoColor
        : null;
  }

  function printMaterialTree(root, label = "MATERIAL_TREE") {
    function printNode(node, depth) {
      const indent = "  ".repeat(depth);
      const cls = node?.getClassName?.();
      const nm = node?.name;
      const metaIdx = node?.metadata?.materialIndex;
      console.log(
        `${label} - ${indent}${nm} [${cls}] meta.materialIndex=${metaIdx}`,
      );

      let mat = node?.material;
      let matOwner = "self";
      if (!mat && cls === "InstancedMesh") {
        mat = node?.sourceMesh?.material || null;
        matOwner = mat ? "sourceMesh" : "self";
      }

      if (!mat) {
        console.log(`${label}   ${indent}material: none`);
      } else {
        const mCls = mat.getClassName?.();
        console.log(
          `${label}   ${indent}material(${matOwner}): ${mat.name || "(unnamed)"} [${mCls}]`,
        );
        if (mCls === "MultiMaterial") {
          const subs = mat.subMaterials || [];
          const subMeshes = node.subMeshes || [];
          console.log(
            `${label}   ${indent}subMaterials: ${subs.length} | subMeshes: ${subMeshes.length}`,
          );
          for (let i = 0; i < subs.length; i++) {
            const sm = subs[i];
            const c = _matPrimaryColor(sm);
            console.log(
              `${label}   ${indent}[${i}] ${sm?.name || "(unnamed)"} color=${_colToHex(c)}`,
            );
          }
          for (let i = 0; i < subMeshes.length; i++) {
            const s = subMeshes[i];
            const idx = s.materialIndex;
            const sm = (mat.subMaterials || [])[idx] || null;
            const c = _matPrimaryColor(sm);
            console.log(
              `${label}   ${indent}subMesh#${i} -> subMat#${idx} (${sm?.name || "?"}) color=${_colToHex(c)}`,
            );
          }
        } else {
          const c = _matPrimaryColor(mat);
          const hasDiff = mat.diffuseColor !== undefined;
          const hasAlb = mat.albedoColor !== undefined;
          console.log(
            `${label}   ${indent}color=${_colToHex(c)} diffuse?=${hasDiff} albedo?=${hasAlb}`,
          );
        }
      }

      const kids =
        node.getChildMeshes?.().sort((a, b) => a.name.localeCompare(b.name)) ||
        [];
      for (const k of kids) printNode(k, depth + 1);
    }
    try {
      printNode(root, 0);
    } catch (e) {
      console.warn(label, "print error", e);
    }
  }

  function extractColorsForChangeOrder(root) {
    const colors = [];
    const materialToIndex = new Map();

    function visit(part) {
      let mat = part.material;
      if (!mat && part.getClassName?.() === "InstancedMesh") {
        mat = part.sourceMesh?.material || null;
      }
      if (mat && !materialToIndex.has(mat)) {
        const mCls = mat.getClassName?.();
        if (mCls === "MultiMaterial") {
          const subs = mat.subMaterials || [];
          const subMeshes = part.subMeshes || [];
          let chosen = null;
          if (subs.length && subMeshes.length) {
            const idx = subMeshes[0].materialIndex;
            chosen = _matPrimaryColor(subs[idx]);
          }
          if (!chosen && subs.length) chosen = _matPrimaryColor(subs[0]);
          if (!chosen) chosen = _matPrimaryColor(mat);
          colors.push(_colToHex(chosen));
        } else {
          colors.push(_colToHex(_matPrimaryColor(mat)));
        }
        materialToIndex.set(mat, colors.length - 1);
      }
      const kids =
        part.getChildMeshes?.().sort((a, b) => a.name.localeCompare(b.name)) ||
        [];
      for (const k of kids) visit(k);
    }

    visit(root);
    return colors.filter(Boolean);
  }

  function worldBaseYOfRenderables(roots) {
    let minY = Infinity;
    const collect = Array.isArray(roots) ? roots : [roots];
    for (const r of collect) {
      const nodes = walkNodes(r);
      for (const n of nodes) {
        if (!isRenderableMesh(n)) continue;
        try {
          n.computeWorldMatrix(true);
          n.refreshBoundingInfo?.();
          const y = n.getBoundingInfo().boundingBox.minimumWorld.y;
          if (y < minY) minY = y;
        } catch {}
      }
    }
    return isFinite(minY) ? minY : null;
  }

  const NAME_TO_PART = {
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
  };
  const partFromName = (name = "") => {
    const s = name.toLowerCase();
    for (const key of Object.keys(NAME_TO_PART)) {
      if (s === key || s.includes(key)) return NAME_TO_PART[key];
    }
    return null;
  };

  function extractCharacterColorsFromHierarchy(root) {
    const found = {};
    const nodes = walkNodes(root);
    for (const n of nodes) {
      if (!isRenderableMesh(n) || n.name === "__root__") continue;
      const mat = n.material;
      if (!mat) continue;

      const cls = mat.getClassName?.();
      if (cls === "MultiMaterial") {
        const subMats = mat.subMaterials || [];
        const subMeshes = n.subMeshes || [];
        for (let i = 0; i < subMeshes.length; i++) {
          const idx = subMeshes[i].materialIndex;
          const sm = subMats[idx] || null;
          const part =
            partFromName(sm?.name) ||
            partFromName(n.name) ||
            partFromName(mat.name);
          const color = sm?.albedoColor || sm?.diffuseColor || null;
          const hex = _colToHex(color);
          if (part && hex && !found[part]) found[part] = hex;
        }
      } else {
        const part = partFromName(mat.name) || partFromName(n.name);
        const color = mat?.albedoColor || mat?.diffuseColor || null;
        const hex = _colToHex(color);
        if (part && hex && !found[part]) found[part] = hex;
      }
    }
    return found;
  }

  function logCharacterPalette(palette, label = "CHAR_COLORS") {
    console.log(`[${label}]`, JSON.stringify(palette, null, 2));
  }

  // ---------- capture original children and debug ----------
  const originalDirectChildren = (
    currentMesh.getChildren ? currentMesh.getChildren() : []
  ).slice();
  const oldFirstChild = originalDirectChildren.length
    ? originalDirectChildren[0]
    : null;
  const oldChildScale = oldFirstChild?.scaling?.clone?.() || null;
  //const originalNames = originalDirectChildren.map(n => n?.name);
  //console.log("[replaceMeshModel] Snapshot direct children:", originalNames);

  // Debug old tree before removal
  /*for (const oc of originalDirectChildren) {
    if (oc && !oc.isDisposed?.()) {
      printMaterialTree(oc, "OLD");
    }
  }*/

  // ---------- create temp new mesh ----------
  const tempId = `${modelName}__temp__${Date.now()}`;
  const isCharacter = block.type === "load_character";
  let createArgs;

  if (isCharacter) {
    const prev = (currentMesh.metadata && currentMesh.metadata.colors) || {};
    const extracted = extractCharacterColorsFromHierarchy(currentMesh);
    const characterPalette = { ...prev, ...extracted };
    //logCharacterPalette(characterPalette, "CHAR_FINAL");
    createArgs = Object.keys(characterPalette).length
      ? { modelName, modelId: tempId, colors: characterPalette }
      : { modelName, modelId: tempId };
  } else {
    createArgs = { modelName, modelId: tempId };
  }

  //console.log("[replaceMeshModel] create() args:", createArgs);
  const newMeshName = isCharacter
    ? flock.createCharacter(createArgs)
    : flock.createObject(createArgs);

  flock.whenModelReady(newMeshName, (loadedMesh) => {
    if (!loadedMesh) return;

    const newChild = firstRenderable(loadedMesh) || loadedMesh;

    // Debug new incoming temp tree
    //printMaterialTree(loadedMesh, "NEW");

    // Colors to reapply for non-characters
    let nonCharacterColors = null;
    if (!isCharacter) {
      const cols = [];
      for (const oc of originalDirectChildren) {
        if (oc && !oc.isDisposed?.()) {
          const c = extractColorsForChangeOrder(oc);
          if (c.length) cols.push(...c);
        }
      }
      nonCharacterColors = cols;
      //console.log("[NONCHAR_COLORS]", nonCharacterColors);
    }

    // Measure old base (world) before removing originals
    const oldBaseY = worldBaseYOfRenderables(originalDirectChildren);

    // Remove physics on the temp container to avoid duplicate bodies
    stripPhysicsTree(loadedMesh);

    // Detach new child from its loader wrapper
    try {
      newChild.setParent?.(null, true);
    } catch {}

    // Remove ONLY the original direct children
    const removed = [];
    const skipped = [];
    for (const child of originalDirectChildren) {
      if (!child || child.isDisposed?.()) {
        skipped.push({ name: child?.name, reason: "already disposed" });
        continue;
      }
      if (child === currentMesh) {
        skipped.push({ name: child.name, reason: "is parent" });
        continue;
      }
      if (child.parent !== currentMesh) {
        skipped.push({ name: child.name, reason: "no longer direct child" });
        continue;
      }
      stripPhysicsTree(child);
      disposeTree(child);
      removed.push(child.name);
    }
    //console.log("[replaceMeshModel] Disposed original direct children:", removed);
    //if (skipped.length) console.log("[replaceMeshModel] Skipped (not removed):", skipped);

    // Parent the replacement under the existing parent
    newChild.parent = currentMesh;

    // Apply old first child's local scale (if any) to the new child
    if (oldChildScale && newChild.scaling) {
      try {
        newChild.scaling.copyFrom(oldChildScale);
      } catch {}
      try {
        newChild.computeWorldMatrix(true);
        newChild.refreshBoundingInfo?.();
      } catch {}
    }

    // Base alignment (world) uses updated bounds
    if (oldBaseY != null) {
      try {
        newChild.computeWorldMatrix(true);
        newChild.refreshBoundingInfo?.();
        const newBaseY = newChild.getBoundingInfo().boundingBox.minimumWorld.y;
        if (isFinite(newBaseY)) {
          const dy = oldBaseY - newBaseY;
          const abs = newChild.getAbsolutePosition();
          newChild.setAbsolutePosition(
            new flock.BABYLON.Vector3(abs.x, abs.y + dy, abs.z),
          );
        }
      } catch {}
    }

    // Base alignment (world)
    if (oldBaseY != null) {
      try {
        newChild.computeWorldMatrix(true);
        newChild.refreshBoundingInfo?.();
        const newBaseY = newChild.getBoundingInfo().boundingBox.minimumWorld.y;
        if (isFinite(newBaseY)) {
          const dy = oldBaseY - newBaseY;
          const abs = newChild.getAbsolutePosition();
          newChild.setAbsolutePosition(
            new flock.BABYLON.Vector3(abs.x, abs.y + dy, abs.z),
          );
        }
      } catch {}
    }

    // Apply colours
    if (isCharacter) {
      const palette =
        (currentMesh.metadata && currentMesh.metadata.colors) || null;
      if (palette && Object.keys(palette).length) {
        try {
          flock.applyColorsToCharacter(currentMesh, palette);
        } catch {}
      }
    } else if (nonCharacterColors && nonCharacterColors.length) {
      try {
        flock.changeColorMesh(newChild, nonCharacterColors);
      } catch (e) {
        console.warn("changeColorMesh failed", e);
      }
    }

    // Dispose loader wrapper if distinct (physics already stripped)
    if (loadedMesh !== newChild && !loadedMesh.isDisposed?.()) {
      try {
        loadedMesh.setParent?.(null);
      } catch {}
      try {
        loadedMesh.dispose?.();
      } catch {}
    }

    if (animationInfo?.name) {
      flock.switchAnimation(loadedMesh.name, {
        animationName: animationInfo.name,
        restart: true,
        loop: animationInfo.isLooping ?? true, // defaults to true if undefined
      });
    }

    /*const childNames = (currentMesh.getChildren ? currentMesh.getChildren() : []).map(n => n.name);
    console.log(`[replaceMeshModel] Parent '${currentMesh.name}' kept. New children:`, childNames);*/
  });
}

export function updateBlockColorAndHighlight(mesh, selectedColor) {
  // ---------- helpers
  const withUndoGroup = (fn) => {
    try {
      Blockly.Events.setGroup(true);
      fn();
    } finally {
      Blockly.Events.setGroup(false);
    }
  };

  const getUltimateParent = (m) =>
    m?.parent ? getUltimateParent(m.parent) : m;

  // Try to set colour on a target block (colour picker) or, failing that, on the parent block's field.
  const setColorOnTargetOrField = (targetBlock, parentBlock, colorHex) => {
    if (targetBlock) {
      if (targetBlock.getField?.("COLOR")) {
        targetBlock.setFieldValue(colorHex, "COLOR");
        return true;
      }
      if (targetBlock.getField?.("COLOUR")) {
        targetBlock.setFieldValue(colorHex, "COLOUR");
        return true;
      }
    }
    if (parentBlock) {
      if (parentBlock.getField?.("COLOR")) {
        parentBlock.setFieldValue(colorHex, "COLOR");
        return true;
      }
      if (parentBlock.getField?.("COLOUR")) {
        parentBlock.setFieldValue(colorHex, "COLOUR");
        return true;
      }
    }
    return false;
  };

  // Ensure a colour target exists on an input: connect shadow if needed, then return the target block.
  const ensureColorTargetOnInput = (input) => {
    if (!input?.connection) return null;
    let tgt = input.connection.targetBlock?.();
    const ws = input.sourceBlock_?.workspace;
    if (!tgt && ws) {
      // materialize existing shadow if present
      const shadowDom = input.connection.getShadowDom?.();
      if (shadowDom) {
        const shadowBlock = Blockly.Xml.domToBlock(shadowDom, ws);
        if (shadowBlock?.outputConnection)
          input.connection.connect(shadowBlock.outputConnection);
        tgt = input.connection.targetBlock?.();
      }
      // or create a new colour picker shadow
      if (!tgt) {
        const picker = ws.newBlock("colour_picker");
        picker.setShadow(true);
        picker.initSvg();
        picker.render();
        input.connection.connect(picker.outputConnection);
        tgt = picker;
      }
    }
    return tgt || null;
  };

  // Heuristic: is this input likely to be a color input?
  const isColorishName = (name) =>
    /(?:^|_)(MAP_)?COL(?:OU)?R$/i.test(name || "");

  // Depth-first search for a colour input/field anywhere under a block.
  // Returns { input, targetBlock, ownerBlock } where:
  //  - input: the Input that should hold a color picker (could be nested)
  //  - targetBlock: the colour picker (created if needed)
  //  - ownerBlock: the block that owns `input` (fallback for direct field set)
  const findNestedColorTarget = (rootBlock, visited = new Set()) => {
    if (!rootBlock || visited.has(rootBlock.id)) return null;
    visited.add(rootBlock.id);

    // 0) direct field on this block (rare but cheap to check)
    if (rootBlock.getField?.("COLOR") || rootBlock.getField?.("COLOUR")) {
      return { input: null, targetBlock: rootBlock, ownerBlock: rootBlock };
    }

    // 1) look for an input that is explicitly colour-ish
    for (const inp of rootBlock.inputList || []) {
      if (isColorishName(inp?.name)) {
        const targetBlock = ensureColorTargetOnInput(inp);
        return { input: inp, targetBlock, ownerBlock: rootBlock };
      }
    }

    // 2) Otherwise, traverse all connected children; many designs have a MATERIAL input → material block → colour input
    for (const inp of rootBlock.inputList || []) {
      const child = inp?.connection?.targetBlock?.();
      if (!child) continue;
      const found = findNestedColorTarget(child, visited);
      if (found) return found;
    }

    return null;
  };

  const materialToFieldMap = {
    Hair: "HAIR_COLOR",
    Skin: "SKIN_COLOR",
    Eyes: "EYES_COLOR",
    Sleeves: "SLEEVES_COLOR",
    Shorts: "SHORTS_COLOR",
    TShirt: "TSHIRT_COLOR",
  };

  // ---------- main ----------
  let block = null;

  // Special case: sky fallback
  if (!mesh || mesh.type === "set_sky_color") {
    block = meshMap?.["sky"];
    if (!block) {
      // Create sky block
      block = createBlockWithShadows("set_sky_color", null, selectedColor);
      meshMap["sky"] = block;
      // Create start block
      const startBlock = Blockly.getMainWorkspace().newBlock("start");
      startBlock.initSvg();
      startBlock.render();
      // Wrap sky block around start block
      const connection = startBlock.getInput("DO").connection;
      if (connection && block.previousConnection)
        connection.connect(block.previousConnection);
    }
    withUndoGroup(() => {
      const found = findNestedColorTarget(block);
      if (!found) {
        console.warn("[color] No color target found on 'sky' block");
        return;
      }
      setColorOnTargetOrField(
        found.targetBlock,
        found.ownerBlock,
        selectedColor,
      );
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // Mesh → block
  const root = getUltimateParent(mesh);
  const blockKey = root?.metadata?.blockKey;

  if (!blockKey || !meshMap?.[blockKey]) {
    console.warn("[color] Block not found for mesh", {
      mesh: mesh?.name,
      blockKey,
      root: root?.name,
    });
    return;
  }
  block = meshMap[blockKey];

  const materialName = mesh?.material?.name?.replace(/_clone$/, "");
  const colorIndex = mesh?.metadata?.materialIndex;

  // 1) Character sub-mesh path (these use fixed field inputs on the character block)
  if (
    materialName &&
    Object.prototype.hasOwnProperty.call(materialToFieldMap, materialName)
  ) {
    const fieldName = materialToFieldMap[materialName];
    const input = block.getInput(fieldName);
    if (!input) {
      console.warn(
        `[color] Character field input '${fieldName}' not found on '${block.type}'`,
      );
      return;
    }
    withUndoGroup(() => {
      const target = ensureColorTargetOnInput(input);
      setColorOnTargetOrField(target, block, selectedColor);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // 2) Multi-object path stays as-is
  if (block.type === "load_multi_object") {
    withUndoGroup(() => {
      block.updateColorAtIndex?.(selectedColor, colorIndex);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  // 3) Generic / map / ground / load_object, including NESTED MATERIAL BLOCKS
  //    We now search recursively for a colour input under this block.
  const found = findNestedColorTarget(block);
  if (!found) {
    console.warn(
      `[color] No nested color target found under block '${block.type}' for mesh '${mesh.name}'`,
    );
    return;
  }

  // Respect your special purple → config default for load_object (only if top-level is load_object).
  const isDefaultPurple = selectedColor?.toLowerCase?.() === "#9932cc";
  let finalColor = selectedColor;
  if (
    block.type === "load_object" &&
    isDefaultPurple &&
    typeof objectColours === "object"
  ) {
    finalColor = objectColours[block.getFieldValue?.("MODELS")] || "#FFD700";
  }

  withUndoGroup(() => {
    setColorOnTargetOrField(found.targetBlock, found.ownerBlock, finalColor);
    block.initSvg?.();
    highlightBlockById(Blockly.getMainWorkspace(), block);
  });
}
