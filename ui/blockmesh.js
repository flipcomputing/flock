import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators/generators.js";
import { flock } from "../flock.js";
import { objectColours } from "../config.js";
import { createMeshOnCanvas } from "./addmeshes.js";
import { highlightBlockById } from "./blocklyutil.js";
import { createBlockWithShadows } from "./addmenu.js";

const colorFields = {
  HAIR_COLOR: true,
  SKIN_COLOR: true,
  EYES_COLOR: true,
  TSHIRT_COLOR: true,
  SHORTS_COLOR: true,
  SLEEVES_COLOR: true,
};

function isMainWorkspaceEvent(changeEvent, block) {
  const mainWs = Blockly.getMainWorkspace();
  const ws = block?.workspace;

  if (!ws) {
    console.log("[isMainWorkspaceEvent] false: block has no workspace", {
      blockId: block?.id,
      eventType: changeEvent?.type,
      eventWorkspaceId: changeEvent?.workspaceId,
    });
    return false;
  }

  if (ws.isFlyout) {
    console.log("[isMainWorkspaceEvent] false: block is in flyout workspace", {
      blockId: block?.id,
      eventType: changeEvent?.type,
      eventWorkspaceId: changeEvent?.workspaceId,
      blockWorkspaceId: ws.id,
      mainWorkspaceId: mainWs?.id,
    });
    return false;
  }

  if (ws !== mainWs) {
    console.log(
      "[isMainWorkspaceEvent] false: block is in a non-main, non-flyout workspace",
      {
        blockId: block?.id,
        eventType: changeEvent?.type,
        eventWorkspaceId: changeEvent?.workspaceId,
        blockWorkspaceId: ws.id,
        mainWorkspaceId: mainWs?.id,
      },
    );
    return false;
  }

  if (changeEvent?.workspaceId && changeEvent.workspaceId !== ws.id) {
    console.log("[isMainWorkspaceEvent] false: event workspaceId mismatch", {
      blockId: block?.id,
      eventType: changeEvent?.type,
      eventWorkspaceId: changeEvent.workspaceId,
      blockWorkspaceId: ws.id,
      mainWorkspaceId: mainWs?.id,
    });
    return false;
  }

  return true;
}

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
  if (!block) return null;

  if (block.type === "create_map") {
    return flock?.scene?.getMeshByName("ground");
  }

  if (block.type === "rotate_to" || block.type === "resize") {
    let container = null;
    let node = block;

    while (node) {
      const parent = node.getParent();
      if (!parent) break;

      // Find the top of the stack within this parent
      let top = node;
      while (
        top.getPrevious &&
        top.getPrevious() &&
        top.getPrevious().getParent() === parent
      ) {
        top = top.getPrevious();
      }

      const input = parent.getInputWithBlock
        ? parent.getInputWithBlock(top)
        : null;

      // If this parent has a DO-style statement input containing our stack,
      // treat that parent as the owning block.
      if (
        input &&
        input.type === Blockly.NEXT_STATEMENT &&
        input.name === "DO"
      ) {
        container = parent;
        break;
      }

      // Climb further up in case we're nested inside another structure
      node = parent;
    }

    if (container) {
      block = container;
    }
  }

  const blockKey = getBlockKeyFromBlock(block);
  if (!blockKey) return null;

  return getMeshFromBlockKey(blockKey);
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
export function readColourValue(block) {
  if (!block) return { value: null, kind: "none" };

  const randomColour = () =>
    typeof flock?.randomColour === "function"
      ? flock.randomColour()
      : "#71BC78";

  if (block.type === "lists_create_with") {
    const list = [];
    for (const input of block.inputList) {
      const tb = input.connection?.targetBlock();
      if (!tb) continue;

      if (tb.type === "random_colour") {
        const c = randomColour();
        list.push(c);
        continue;
      }

      const c =
        safeGetFieldValue(tb, "COLOR") ??
        safeGetFieldValue(tb, "COLOUR") ??
        null;

      if (c) list.push(c);
    }
    return { value: list, kind: "list" };
  }

  if (block.type === "random_colour") {
    const c = randomColour();
    return { value: c, kind: "single" };
  }

  const single =
    safeGetFieldValue(block, "COLOR") ??
    safeGetFieldValue(block, "COLOUR") ??
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

// Reads a colour from an input's target block, falling back to the shadow's value when present.
function readColourFromInputOrShadow(parent, inputName) {
  const target = parent?.getInputTargetBlock?.(inputName);
  if (target) return readColourValue(target);

  const shadowDom = parent?.getInput?.(inputName)?.connection?.getShadowDom?.();

  if (!shadowDom?.querySelector) return { value: null, kind: "none" };

  const shadowField =
    shadowDom.querySelector('field[name="COLOUR"]') ||
    shadowDom.querySelector('field[name="COLOR"]');

  const shadowValue =
    shadowField?.textContent || shadowField?.innerText || null;
  return shadowValue
    ? { value: shadowValue, kind: "shadow" }
    : { value: null, kind: "none" };
}

// Extract texture set, base colour (single or list), and alpha.
export function extractMaterialInfo(materialBlock) {
  if (!materialBlock) return { textureSet: "NONE", baseColor: null, alpha: 1 };

  const textureSet =
    getBlockValue(materialBlock, "TEXTURE_SET") ??
    getBlockValue(materialBlock, "TEXTURE") ??
    "NONE";

  const read = readColourFromInputOrShadow(materialBlock, "BASE_COLOR");
  const baseColor = read.value ?? null;

  const alpha = readNumberInput(materialBlock, "ALPHA", 1);

  return { textureSet, baseColor, alpha };
}

function applyBackgroundColorFromBlock(block) {
  if (!block.isEnabled()) {
    setClearSkyToBlack();
    return;
  }

  const read = readColourFromInputOrShadow(block, "COLOR");
  flock.setSky(read.value, { clear: true });
}

export function clearSkyMesh({ preserveClearColor = true } = {}) {
  // Dispose the existing sky dome without forcing the clear colour to change;
  // callers decide what the next background should be.
  if (flock.sky) {
    flock.disposeMesh(flock.sky);
    flock.sky = null;
  }

  if (!preserveClearColor) {
    const clearColor = flock.initialClearColor
      ? (flock.initialClearColor.clone?.() ?? flock.initialClearColor)
      : new flock.BABYLON.Color3(0, 0, 0);

    flock.scene.clearColor = clearColor;
  }

  delete meshMap["sky"];
}

export function setClearSkyToBlack() {
  console.log("*** Setting clear sky to black");
  const fallbackColor =
    flock.initialClearColor?.toHexString?.() ??
    flock.initialClearColor ??
    "#000000";

  flock.setSky(fallbackColor, { clear: true });
}

// Add this function before updateMeshFromBlock
export function updateOrCreateMeshFromBlock(block, changeEvent) {
  if (flock.meshDebug)
    console.log(
      "Update or create mesh from block",
      block.type,
      changeEvent.type,
    );

  if (!isMainWorkspaceEvent(changeEvent, block)) {
    return;
  }

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
  const wasDisabled =
    changeEvent?.oldValue === true || changeEvent?.oldValue === "true";
  const nowEnabled =
    changeEvent?.newValue === false || changeEvent?.newValue === "false";
  const isEnabledEvent =
    changeEvent?.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.element === "disabled" &&
    wasDisabled &&
    nowEnabled;
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

function isBlockIdDescendantOf(rootBlock, id) {
  if (!rootBlock || !id) return false;
  if (rootBlock.id === id) return true;

  const descendants = rootBlock.getDescendants(false);
  return descendants.some((d) => d.id === id);
}

function safeGetFieldValue(block, fieldName) {
  if (!block || !fieldName) return null;
  const fld = block.getField(fieldName);
  return fld ? fld.getValue() : null;
}

function updateSkyFromBlock(mesh, block, changeEvent) {
  if (!block.isEnabled()) {
    console.log("Block disabled, setting clear sky to black");
    setClearSkyToBlack();
    return;
  }

  const colorInput = block.getInputTargetBlock("COLOR");

  if (!colorInput) return;

  if (colorInput && colorInput.type === "material") {
    const { textureSet, baseColor, alpha } = extractMaterialInfo(colorInput);
    let read = readColourFromInputOrShadow(colorInput, "BASE_COLOR");

    if (flock.meshDebug) {
      console.log("Sky material info:", {
        textureSet,
        baseColor,
        alpha,
        colorValue: read.value,
      });
    }

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
      const materialOptions = {
        color: colorValue,
        materialName: textureSet,
        alpha,
      };
      const material = flock.createMaterial(materialOptions);
      flock.setSky(material || colorValue);
      return;
    }

    flock.setSky(colorValue);
    return;
  }

  const read = readColourFromInputOrShadow(block, "COLOR");
  flock.setSky(read.value);
}

function updateLoadBlockScaleFromEvent(mesh, block, changeEvent) {
  mesh.metadata = mesh.metadata || {};

  // Extract old/new values from the Blockly change event, even if it came from the child math_number
  const getScaleFromEvent = (blk, ev) => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // 1) If this change came from the child plugged into SCALE, use its old/new
    const inp = blk.getInput && blk.getInput("SCALE");
    const child =
      inp &&
      inp.connection &&
      inp.connection.targetBlock &&
      inp.connection.targetBlock();

    if (
      child &&
      ev &&
      ev.type === Blockly.Events.CHANGE &&
      ev.blockId === child.id
    ) {
      // ev.element likely "field", ev.name likely "NUM"
      return {
        oldScale: num(ev.oldValue),
        newScale: num(ev.newValue),
      };
    }

    // 2) If the change came from an inline field on the parent, use that
    if (
      ev &&
      ev.type === Blockly.Events.CHANGE &&
      ev.blockId === blk.id &&
      ev.name === "SCALE"
    ) {
      return {
        oldScale: num(ev.oldValue),
        newScale: num(ev.newValue),
      };
    }

    // 3) Fallback: read current value block (post-change)
    const readCurrent = () => {
      if (child && typeof child.getFieldValue === "function") {
        const v = num(child.getFieldValue("NUM"));
        if (v != null) return v;
      }
      // inline field fallback
      const v2 = num(
        blk.getField && blk.getField("SCALE") && blk.getFieldValue("SCALE"),
      );
      return v2 != null ? v2 : 1;
    };

    const cur = readCurrent();
    return { oldScale: null, newScale: cur };
  };

  const { oldScale, newScale } = getScaleFromEvent(block, changeEvent);
  const toNum = (v, d) => (Number.isFinite(v) ? Number(v) : d);
  const prev = toNum(oldScale, null);
  const next = toNum(newScale, 1);

  if (!mesh.metadata.__unitScale) {
    const divider = prev || next || 1;
    mesh.metadata.__unitScale = {
      x: mesh.scaling.x / divider,
      y: mesh.scaling.y / divider,
      z: mesh.scaling.z / divider,
    };
  }

  // Apply absolute scale: scaling = unit × newScale
  const u = mesh.metadata.__unitScale;
  mesh.scaling.set(u.x * next, u.y * next, u.z * next);
  mesh.metadata.__lastAppliedScale = next;

  // Keep base on ground
  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();
  const ext = mesh.getBoundingInfo().boundingBox.extendSizeWorld;

  const getNumInput = (blk, name, def = 0) => {
    const inp = blk.getInput && blk.getInput(name);
    const tgt =
      inp &&
      inp.connection &&
      inp.connection.targetBlock &&
      inp.connection.targetBlock();
    const v = tgt ? Number(tgt.getFieldValue("NUM")) : def;
    return Number.isFinite(v) ? v : def;
  };
  const baseY = getNumInput(block, "Y", 0);
  mesh.position.y = baseY + ext.y;

  mesh.computeWorldMatrix(true);
  mesh.refreshBoundingInfo();

  flock.updatePhysics(mesh);

  if (flock.meshDebug) {
    console.log("[SCALE change]", {
      oldScale,
      newScale,
      unit: mesh.metadata.__unitScale,
      applied: mesh.scaling.clone(),
    });
  }
}

function handleMaterialOrColorChange(
  mesh,
  block,
  changed,
  color,
  materialInfo,
) {
  // Only handle relevant change types
  if (
    !(
      ["COLOR", "COLORS", "BASE_COLOR", "ALPHA"].includes(changed) ||
      changed.startsWith?.("ADD")
    )
  ) {
    return mesh;
  }

  if (flock.meshDebug) {
    console.log("=== APPLYING COLOR/MATERIAL CHANGE ===");
    console.log("Material info:", materialInfo);
    console.log("Color:", color);
    console.log("Color type:", typeof color, Array.isArray(color));
  }

  const hasMaterial =
    materialInfo &&
    materialInfo.textureSet &&
    materialInfo.textureSet !== "NONE";

  const alpha =
    materialInfo?.alpha != null
      ? materialInfo.alpha
      : hasMaterial
        ? (mesh?.material?.alpha ?? 1)
        : 1;

  let baseColor =
    color ??
    materialInfo?.baseColor ??
    mesh?.material?.diffuseColor?.toHexString?.() ??
    mesh?.material?.albedoColor?.toHexString?.();

  const isColorList = Array.isArray(baseColor) && baseColor.length > 1;
  let appliedColourList = false;

  const blockShapeMap = {
    create_box: "Box",
    create_sphere: "Sphere",
    create_cylinder: "Cylinder",
    create_capsule: "Capsule",
    create_plane: "Plane",
  };

  const rootShapeType =
    mesh?.metadata?.shapeType || blockShapeMap[block.type] || block.type;

  if (isColorList && !hasMaterial) {
    const ultimateParent = (m) => (m.parent ? ultimateParent(m.parent) : m);
    mesh = ultimateParent(mesh);

    const useMeshWideColorCycle =
      block.type === "load_object" || block.type === "load_multi_object";

    if (useMeshWideColorCycle) {
      flock.changeColorMesh(mesh, baseColor);
      appliedColourList = true;
    }
  }

  if (
    !appliedColourList &&
    (baseColor != null || hasMaterial || mesh?.material)
  ) {
    // Special handling for load_object default color
    if (color === "#9932cc" && block.type === "load_object") {
      const modelName = block.getFieldValue("MODELS");
      baseColor = objectColours[modelName] || "#FFD700";
    }

    const ultimateParent = (m) => (m.parent ? ultimateParent(m.parent) : m);
    mesh = ultimateParent(mesh);

    const colorOrMaterial = hasMaterial
      ? { materialName: materialInfo.textureSet, color: baseColor, alpha }
      : (baseColor ?? mesh.material);

    if (colorOrMaterial != null) {
      const targets = [mesh]
        .concat(mesh.getDescendants?.() || [])
        .filter((m) => m instanceof flock.BABYLON.Mesh);

      targets.forEach((target) => {
        const shape = target?.metadata?.shapeType || rootShapeType;
        flock.applyMaterialToMesh(target, shape, colorOrMaterial, alpha);
      });
    }
  }

  // mesh may now be its ultimate parent; return so caller keeps using the same one
  return mesh;
}

function updateGroundFromBlock(mesh, block, changeEvent) {
  meshMap["ground"] = block;
  meshBlockIdMap["ground"] = block.id;

  const colorInput = block.getInputTargetBlock("COLOR");

  if (colorInput && colorInput.type === "material") {
    const { textureSet, baseColor, alpha } = extractMaterialInfo(colorInput);
    let read = readColourFromInputOrShadow(colorInput, "BASE_COLOR");

    if (flock.meshDebug) {
      console.log("Ground material info:", {
        textureSet,
        baseColor,
        alpha,
        colorValue: read.value,
      });
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
      const materialOptions = {
        color: colorValue,
        materialName: textureSet,
        alpha,
      };
      const material = flock.createMaterial(materialOptions);
      flock.createGround(material || colorValue, "ground");
      return;
    }

    flock.createGround(colorValue, "ground");
    return;
  }

  const read = readColourFromInputOrShadow(block, "COLOR");
  flock.createGround(read.value, "ground");
}

function updateMapFromBlock(mesh, block, changeEvent) {
  // Track ownership so deletions can dispose the ground mesh
  meshMap["ground"] = block;
  meshBlockIdMap["ground"] = block.id;

  const mapName = block.getFieldValue("MAP_NAME");
  const materialBlock = block.getInputTargetBlock("MATERIAL");

  if (!materialBlock) return;

  const { textureSet, alpha } = extractMaterialInfo(materialBlock);
  let read = readColourFromInputOrShadow(materialBlock, "BASE_COLOR");

  if (read.value == null && !block.__mapRetry) {
    block.__mapRetry = true;
    requestAnimationFrame(() => {
      block.__mapRetry = false;
      updateMeshFromBlock(mesh, block, changeEvent);
    });
    return;
  }

  const materialOptions = {
    color: read.value,
    materialName: textureSet,
    alpha,
  };

  const material = flock.createMaterial(materialOptions);
  flock.createMap(mapName, material);
}

function resolveColorAndMaterialForBlock(block) {
  let color;
  let materialInfo = null;

  if (
    ![
      "load_object",
      "load_multi_object",
      "load_character",
      "create_map",
    ].includes(block.type)
  ) {
    const colorInput = block.getInputTargetBlock("COLOR");

    // Check if it's a material block
    if (colorInput && colorInput.type === "material") {
      materialInfo = extractMaterialInfo(colorInput);
      const read = readColourFromInputOrShadow(colorInput, "BASE_COLOR");

      if (flock.meshDebug) {
        console.log("Material block detected:");
        console.log("  Texture:", materialInfo.textureSet);
        console.log("  Base color from material:", materialInfo.baseColor);
        console.log("  Color from input:", read.value);
        console.log("  Alpha:", materialInfo.alpha);
      }

      color = read.value ?? materialInfo.baseColor;
    } else {
      // Simple color block
      const read = readColourFromInputOrShadow(block, "COLOR");
      color = read.value;

      if (flock.meshDebug) {
        console.log("Simple color block detected:", color);
      }
    }
  } else if (block.type === "load_object" || block.type === "load_character") {
    // Handle load_object and load_character color input
    const colorInput = block.getInputTargetBlock("COLOR");

    if (flock.meshDebug) {
      console.log("Processing load_object/load_character color input");
      console.log("  Color input type:", colorInput?.type);
    }

    // Check if it's a material block
    if (colorInput && colorInput.type === "material") {
      materialInfo = extractMaterialInfo(colorInput);
      const read = readColourFromInputOrShadow(colorInput, "BASE_COLOR");

      if (flock.meshDebug) {
        console.log("Material block detected for load_object:");
        console.log("  Texture:", materialInfo.textureSet);
        console.log("  Base color from material:", materialInfo.baseColor);
        console.log("  Color from input:", read.value);
        console.log("  Alpha:", materialInfo.alpha);
      }

      color = read.value ?? materialInfo.baseColor;
    } else {
      // Simple color block
      const read = readColourFromInputOrShadow(block, "COLOR");
      color = read.value;

      if (flock.meshDebug) {
        console.log("Simple color for load_object:", color);
      }
    }
  } else if (block.type === "load_multi_object") {
    const colorsBlock = block.getInput("COLORS").connection.targetBlock();
    const read = readColourValue(colorsBlock);
    color = read.value;
  }

  return { color, materialInfo };
}

// assumes getXYZFromBlock is imported / available in this module

function handlePrimitiveGeometryChange(mesh, block, changed) {
  if (!mesh || !block) return;

  const repositionPrimitiveFromBlock = () => {
    const { x, y, z } = getXYZFromBlock(block);
    flock.positionAt(mesh.name, { x, y, z, useY: true });
  };

  switch (block.type) {
    case "create_box": {
      if (["WIDTH", "HEIGHT", "DEPTH"].includes(changed)) {
        const width = block
          .getInput("WIDTH")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const height = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const depth = block
          .getInput("DEPTH")
          .connection.targetBlock()
          .getFieldValue("NUM");

        setAbsoluteSize(mesh, width, height, depth);
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case "create_sphere": {
      if (["DIAMETER_X", "DIAMETER_Y", "DIAMETER_Z"].includes(changed)) {
        const dx = block
          .getInput("DIAMETER_X")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const dy = block
          .getInput("DIAMETER_Y")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const dz = block
          .getInput("DIAMETER_Z")
          .connection.targetBlock()
          .getFieldValue("NUM");

        setAbsoluteSize(mesh, dx, dy, dz);
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case "create_cylinder": {
      if (
        ["HEIGHT", "DIAMETER_TOP", "DIAMETER_BOTTOM", "TESSELLATIONS"].includes(
          changed,
        )
      ) {
        const h = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const dt = block
          .getInput("DIAMETER_TOP")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const db = block
          .getInput("DIAMETER_BOTTOM")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const s = block
          .getInput("TESSELLATIONS")
          .connection.targetBlock()
          .getFieldValue("NUM");

        updateCylinderGeometry(mesh, dt, db, h, s);

        // only reposition when actual dimensions change, not tessellation
        if (["HEIGHT", "DIAMETER_TOP", "DIAMETER_BOTTOM"].includes(changed)) {
          repositionPrimitiveFromBlock();
        }
      }
      break;
    }

    case "create_capsule": {
      if (["HEIGHT", "DIAMETER"].includes(changed)) {
        const d = block
          .getInput("DIAMETER")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const h = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");

        setAbsoluteSize(mesh, d, h, d);
        repositionPrimitiveFromBlock();
      }
      break;
    }

    case "create_plane": {
      if (["HEIGHT", "WIDTH"].includes(changed)) {
        const w = block
          .getInput("WIDTH")
          .connection.targetBlock()
          .getFieldValue("NUM");
        const h = block
          .getInput("HEIGHT")
          .connection.targetBlock()
          .getFieldValue("NUM");

        setAbsoluteSize(mesh, w, h, 0);
        repositionPrimitiveFromBlock();
      }
      break;
    }
  }
}

function handleLoadBlockChange(mesh, block, changed, changeEvent) {
  // All load_* blocks: replace model when MODELS changes
  if (
    ["load_object", "load_multi_object", "load_character"].includes(
      block.type,
    ) &&
    changed === "MODELS"
  ) {
    replaceMeshModel(mesh, block, changeEvent);
    return true; // caller should return early
  }

  // Extra handling for load_character colour fields
  if (block.type === "load_character" && changed in colorFields) {
    const colors = {
      hair: block
        .getInput("HAIR_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
      skin: block
        .getInput("SKIN_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
      eyes: block
        .getInput("EYES_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
      tshirt: block
        .getInput("TSHIRT_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
      shorts: block
        .getInput("SHORTS_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
      sleeves: block
        .getInput("SLEEVES_COLOR")
        .connection.targetBlock()
        .getFieldValue("COLOR"),
    };

    flock.applyColorsToCharacter(getMeshFromBlock(block), colors);
  }

  return false;
}

// Utility: read X/Y/Z numeric inputs from a Blockly block
function getXYZFromBlock(block) {
  if (!block) return { x: null, y: null, z: null };

  const getNum = (inputName) => {
    const input = block.getInput(inputName);
    const targetBlock = input?.connection?.targetBlock();
    return targetBlock?.getFieldValue("NUM");
  };

  return {
    x: getNum("X"),
    y: getNum("Y"),
    z: getNum("Z"),
  };
}

export function updateMeshFromBlock(mesh, block, changeEvent) {
  if (flock.meshDebug) {
    console.log("=== UPDATE MESH FROM BLOCK ===");
    console.log("Block type:", block.type);
    console.log("Block ID:", block.id);
    console.log("Change event type:", changeEvent.type);
    console.log("Change event details:", changeEvent);
  }

  if (
    !mesh &&
    ![
      "set_sky_color",
      "set_background_color",
      "create_ground",
      "create_map",
    ].includes(block.type)
  ) {
    if (flock.meshDebug)
      console.log("No mesh and not a special block type, returning");
    return;
  }

  const changedBlock = changeEvent.blockId
    ? Blockly.getMainWorkspace().getBlockById(changeEvent.blockId)
    : null;

  const parent = changedBlock?.getParent() || changedBlock;

  let changed;

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
      ["load_object", "load_multi_object", "load_character"].includes(
        block.type,
      ) &&
      changeEvent.name === "MODELS"
    ) {
      changed = "MODELS";
    } else if (block.type === "create_map" && changeEvent.name === "MAP_NAME") {
      changed = "MAP_NAME";
    }
  }

  // Check if the changed block is in one of our inputs
  if (!changed && parent?.inputList) {
    changed =
      parent.inputList.find((input) => {
        const id =
          input?.connection?.targetConnection?.sourceBlock_?.id ??
          input?.connection?.shadowState?.id;
        return id === changedBlock.id;
      })?.name || changed;

    if (changed && flock.meshDebug) {
      console.log(`Change detected in input: ${changed}`);
    }
  }

  // Special handling for material blocks - check if change is in material subtree
  if (!changed) {
    const colorInput = block.getInputTargetBlock("COLOR");
    if (colorInput) {
      // Check if the changed block is the color input or in its subtree
      const isMaterialChange =
        changeEvent.blockId === colorInput.id ||
        isBlockIdDescendantOf(colorInput, changeEvent.blockId) ||
        isBlockIdDescendantOf(colorInput, changeEvent.newParentId) ||
        isBlockIdDescendantOf(colorInput, changeEvent.oldParentId);

      if (isMaterialChange) {
        changed = "COLOR";
        if (flock.meshDebug)
          console.log("Material change detected in COLOR input subtree");
      }
    }
  }

  if (!changed && block.type === "create_map") {
    const m = block.getInputTargetBlock("MATERIAL");
    if (m) {
      const touched =
        isBlockIdDescendantOf(m, changeEvent.blockId) ||
        isBlockIdDescendantOf(m, changeEvent.newParentId) ||
        isBlockIdDescendantOf(m, changeEvent.oldParentId) ||
        (changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.blockId === m.id);
      if (touched) changed = "MATERIAL";
    }
  }

  if (!changed) {
    if (
      block.type === "set_sky_color" ||
      block.type === "set_background_color" ||
      block.type === "create_ground" ||
      block.type === "create_map"
    ) {
      if (changeEvent.type === Blockly.Events.BLOCK_MOVE) {
        if (flock.meshDebug)
          console.log(
            "Ignoring BLOCK_MOVE for scene block with no input change",
          );
        return;
      }
      changed = "COLOR";
    } else {
      if (flock.meshDebug)
        console.log("No relevant change detected, returning");
      return;
    }
  }

  if (flock.meshDebug) console.log(`Processing change type: ${changed}`);

  if (
    (block.type === "load_object" ||
      block.type === "load_multi_object" ||
      block.type === "load_character") &&
    changed === "MODELS" &&
    !mesh
  ) {
    mesh = getMeshFromBlock(block);
  }

  //if (mesh && mesh.physics) mesh.physics.disablePreStep = true;

  if (block.type === "set_sky_color") {
    console.log("Updating sky from block");
    updateSkyFromBlock(mesh, block, changeEvent);
    return;
  }

  if (block.type === "set_background_color") {
    applyBackgroundColorFromBlock(block);
    return;
  }

  if (block.type === "create_ground") {
    updateGroundFromBlock(mesh, block, changeEvent);
    return;
  }

  if (block.type === "create_map") {
    updateMapFromBlock(mesh, block, changeEvent);
    return;
  }

  let color;
  let materialInfo = null;

  ({ color, materialInfo } = resolveColorAndMaterialForBlock(block));

  if (block.type.startsWith("load_") && changed === "SCALE") {
    updateLoadBlockScaleFromEvent(mesh, block, changeEvent);
  }

  // Handle load_* blocks (models and character colours)
  if (handleLoadBlockChange(mesh, block, changed, changeEvent)) {
    return;
  }

  // Handle primitive geometry updates (box, sphere, etc.)
  handlePrimitiveGeometryChange(mesh, block, changed);

  // Handle material/color changes
  handleMaterialOrColorChange(mesh, block, changed, color, materialInfo);

  if (["X", "Y", "Z"].includes(changed)) {
    const isFieldChange =
      changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
      changeEvent.element === "field";

    // Decide which block actually owns the X/Y/Z inputs:
    // - rotate_to / resize child (nested inside DO)
    // - otherwise the root block itself
    const contextBlock =
      parent && (parent.type === "rotate_to" || parent.type === "resize")
        ? parent
        : block;

    // --- rotate_to: allow gizmo / non-field events ---
    if (contextBlock.type === "rotate_to") {
      const rotation = getXYZFromBlock(contextBlock);
      flock.rotateTo(mesh.name, rotation);
      return;
    }

    // --- resize: also allow gizmo / non-field events ---
    if (contextBlock.type === "resize") {
      const dims = getXYZFromBlock(contextBlock);
      const resizeOptions = {
        width: dims.x ?? null,
        height: dims.y ?? null,
        depth: dims.z ?? null,
        xOrigin: contextBlock.getFieldValue("X_ORIGIN") || "CENTRE",
        yOrigin: contextBlock.getFieldValue("Y_ORIGIN") || "BASE",
        zOrigin: contextBlock.getFieldValue("Z_ORIGIN") || "CENTRE",
      };

      if (flock.meshDebug) {
        console.log(
          "Resize",
          resizeOptions,
          "on mesh",
          mesh?.name,
          "from block",
          block.type,
          "event type",
          changeEvent.type,
        );
      }

      flock.resize(mesh.name, resizeOptions);
      if (flock.meshDebug) console.log("After resize", mesh);
      return;
    }

    // --- Everything else (positionAt) stays strict: only real field edits ---
    if (!isFieldChange) {
      if (flock.meshDebug) {
        console.log(
          "Ignoring X/Y/Z change for non-field event on",
          block.type,
          "event type:",
          changeEvent.type,
        );
      }
      return;
    }

    // This is a direct X/Y/Z on the root block (e.g. create_box, load_object)
    if (parent && parent.id !== block.id) {
      if (flock.meshDebug) {
        console.log(
          "X/Y/Z change is on a nested block; skipping positionAt for",
          "root:",
          block.type,
          "parent:",
          parent.type,
        );
      }
      return;
    }

    const position = getXYZFromBlock(block);
    if (flock.meshDebug) console.log("Position", position, block.type);
    flock.positionAt(mesh.name, { ...position, useY: true });
  }

  flock.updatePhysics(mesh);

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

  const animationInfo = flock._getCurrentAnimationInfo(currentMesh);

  const modelName = block.getFieldValue("MODELS");
  if (!modelName) return;

  const wasEnabled =
    typeof currentMesh.isEnabled === "function"
      ? currentMesh.isEnabled()
      : currentMesh.isVisible ?? true;
  const setMeshEnabled = (enabled) => {
    if (typeof currentMesh.setEnabled === "function") {
      currentMesh.setEnabled(enabled);
    } else {
      currentMesh.isVisible = enabled;
    }
  };

  if (wasEnabled) setMeshEnabled(false);

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
    return _rgbToHex(r, g, b);
  }

  function _rgbToHex(r, g, b) {
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
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("");

    return hex;
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
    if (!loadedMesh) {
      if (wasEnabled) setMeshEnabled(true);
      return;
    }

    try {
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
    const blockColors = (() => {
      if (block.type === "load_multi_object") {
        const colorsInput = block.getInput("COLORS");
        const listBlock = colorsInput?.connection?.targetBlock?.();
        if (listBlock?.type === "lists_create_with") {
          const collected = [];
          for (const input of listBlock.inputList || []) {
            if (!input?.name?.startsWith("ADD")) continue;
            const target = input.connection?.targetBlock?.();
            const hex =
              target?.getFieldValue?.("COLOR") ||
              target?.getFieldValue?.("COLOUR") ||
              null;
            if (hex) collected.push(hex);
          }
          return collected;
        }
      }
      return null;
    })();

    nonCharacterColors =
      blockColors && blockColors.length ? blockColors : cols;
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
          const newBaseY =
            newChild.getBoundingInfo().boundingBox.minimumWorld.y;
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
          const newBaseY =
            newChild.getBoundingInfo().boundingBox.minimumWorld.y;
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
    } finally {
      if (wasEnabled) setMeshEnabled(true);
    }
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

  const isColorishName = (name) =>
    /(?:^|_)(MAP_)?COL(?:OU)?R$/i.test(name || "");

  const findNestedColorTarget = (rootBlock, visited = new Set()) => {
    if (!rootBlock || visited.has(rootBlock.id)) return null;
    visited.add(rootBlock.id);

    if (rootBlock.getField?.("COLOR") || rootBlock.getField?.("COLOUR")) {
      return { input: null, targetBlock: rootBlock, ownerBlock: rootBlock };
    }

    for (const inp of rootBlock.inputList || []) {
      if (isColorishName(inp?.name)) {
        const targetBlock = ensureColorTargetOnInput(inp);
        return { input: inp, targetBlock, ownerBlock: rootBlock };
      }
    }

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

  // Special case: background/sky fallback
  if (!mesh || mesh.type === "set_sky_color") {
    const ws = Blockly.getMainWorkspace();
    const backgroundBlock =
      ws
        ?.getAllBlocks(false)
        .find((b) => b.type === "set_background_color" && b.isEnabled()) ??
      ws?.getAllBlocks(false).find((b) => b.type === "set_background_color");
    const skyBlock =
      ws
        ?.getAllBlocks(false)
        .find((b) => b.type === "set_sky_color" && b.isEnabled()) ??
      ws?.getAllBlocks(false).find((b) => b.type === "set_sky_color");

    block = backgroundBlock || skyBlock || meshMap?.["sky"];

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
        console.warn("[color] No color target found on background/sky block");
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

  if (block.type === "load_multi_object") {
    withUndoGroup(() => {
      block.updateColorAtIndex?.(selectedColor, colorIndex);
      block.initSvg?.();
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });
    return;
  }

  const found = findNestedColorTarget(block);
  if (!found) {
    console.warn(
      `[color] No nested color target found under block '${block.type}' for mesh '${mesh.name}'`,
    );
    return;
  }

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
