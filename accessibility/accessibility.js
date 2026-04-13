// flock/accessibility/accessibility.js
import { translate } from "../main/translation.js";

let speechMuted = false;
let currentScene = null;
let keyListenerAttached = false;

// Pointer observer must be reattached per scene
let pointerObserverRef = null;
let pointerObserverScene = null;

// Message sequencing to stop stale/laggy announcements
let announceSeq = 0;
let lastAnnouncedText = "";
let lastAnnouncedAt = 0;

// Helps avoid repeating the same click announcement too many times in a row
let lastInteractionKey = "";
let lastInteractionTime = 0;

// Track whether initial intro has been announced for the current scene
let lastIntroScene = null;
let introInProgress = false;
let queuedIntroSayText = "";
let suppressPointerUntil = 0;
let suppressRuntimeTextUntil = 0;
let objectSayTextCache = new Map();
let objectPromptTextCache = new Map();
let hasSpokenInitialPageIntro = false;

function createA11yRoot() {
  let root = document.getElementById("flock-a11y-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "flock-a11y-root";

    // Visually hidden but readable by screen readers
    root.style.position = "absolute";
    root.style.left = "-9999px";
    root.style.top = "0";
    root.style.width = "1px";
    root.style.height = "1px";
    root.style.overflow = "hidden";

    document.body.appendChild(root);
  }
  return root;
}

export function createLiveRegion() {
  let region = document.getElementById("flock-live-region");
  if (!region) {
    const root = createA11yRoot();

    region = document.createElement("div");
    region.id = "flock-live-region";

    // Status (not log) avoids a backlog of old messages
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");

    root.appendChild(region);
  }
  return region;
}

export function announce(message, options = {}) {
  const { force = false } = options;
  if (speechMuted && !force) return;

  const text = String(message ?? "").trim();
  if (!text) return;

  const now = Date.now();

  // Tiny dedupe to prevent noisy repeats
  if (text === lastAnnouncedText && now - lastAnnouncedAt < 2000) return;
  lastAnnouncedText = text;
  lastAnnouncedAt = now;

  const region = createLiveRegion();
  const mySeq = ++announceSeq;

  region.textContent = "";

  setTimeout(() => {
    if (mySeq !== announceSeq) return;
    region.textContent = text;
  }, 20);
}

function normaliseName(name) {
  return String(name || "object")
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeInternalMeshName(name) {
  const n = String(name || "").toLowerCase();
  return (
    !n ||
    n === "__root__" ||
    n.includes("camera") ||
    n.includes("light") ||
    n.includes("highlighter") ||
    n.includes("gizmo") ||
    n.includes("bounding") ||
    n.includes("debug") ||
    n.includes("hitbox") ||
    n.includes("collider")
  );
}

function looksLikeTextName(name) {
  const n = String(name || "").toLowerCase();
  return (
    n.includes("text") ||
    n.includes("label") ||
    n.includes("caption") ||
    n.includes("title")
  );
}

function getEntityRoot(mesh) {
  let node = mesh;
  let lastValid = mesh;

  while (node) {
    const n = node.name || "";
    if (!looksLikeInternalMeshName(n)) {
      lastValid = node;
    }
    node = node.parent || null;
  }

  return lastValid || mesh;
}

function getMetadataText(mesh) {
  const candidates = [mesh, getEntityRoot(mesh)];
  for (const m of candidates) {
    const md = m?.metadata || {};
    const text =
      md.a11yText ||
      md.a11yActionHint ||
      md.a11yDescription ||
      md.interactionHint ||
      md.prompt ||
      md.instruction ||
      md.clickText ||
      md.text ||
      md.say ||
      md.description;
    if (text && String(text).trim()) return resolveSpokenText(text);
  }
  return "";
}

function cleanSpokenAnnouncement(text) {
  let s = String(text || "");

  // Remove variation selectors
  s = s.replace(/[\uFE0E\uFE0F]/g, "");

  // Remove Fitzpatrick skin tone modifiers
  s = s.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");

  // Remove most emoji / pictographs
  s = s.replace(/[\p{Extended_Pictographic}]/gu, "");

  // Collapse extra spacing left behind
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function resolveSpokenText(value) {
  // Unwrap common object shapes
  let rawValue = value;
  if (rawValue && typeof rawValue === "object") {
    rawValue =
      rawValue.key ??
      rawValue.id ??
      rawValue.name ??
      rawValue.label ??
      rawValue.value ??
      "";
  }

  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";

  const original = raw;
  const lower = raw.toLowerCase();
  const underscored = lower
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const stripped = underscored.replace(/^(key|id|name|label)[:=]\s*/i, "");

  const candidates = [original, lower, underscored, stripped].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  );

  const looksKeyLike = (s) =>
    s.startsWith("model_display_") ||
    s.endsWith("_ui") ||
    s.endsWith("_aria") ||
    s.endsWith("_tooltip") ||
    s.includes("_option") ||
    s.includes("_message") ||
    s.includes("_label") ||
    /^[a-z0-9]+(_[a-z0-9]+){1,}$/.test(s);

  for (const c of candidates) {
    const k = String(c);
    if (!looksKeyLike(k.toLowerCase())) continue;

    const t = translate(k);
    if (t && t !== k) return String(t).trim();
  }

  // If it still looks like a key, humanise it
  if (looksKeyLike(stripped)) {
    const human = stripped
      .replace(/^model_display_/, "")
      .replace(/_/g, " ")
      .trim();
    if (human) return human;
  }

  return original;
}

function getObjectLabel(mesh) {
  const md = mesh?.metadata || {};

  const explicit = md.a11yLabel || md.label || md.displayName || md.name;

  if (explicit) return resolveSpokenText(explicit);

  const root = getEntityRoot(mesh);
  const rootMd = root?.metadata || {};

  const rootExplicit =
    rootMd.a11yLabel || rootMd.label || rootMd.displayName || rootMd.name;

  if (rootExplicit) return resolveSpokenText(rootExplicit);

  const rootName = normaliseName(root?.name || "");
  if (rootName && !/^mesh\b/i.test(rootName) && !/^node\b/i.test(rootName)) {
    return rootName;
  }

  return normaliseName(mesh?.name || "object");
}

function getDistanceLabel(distance) {
  if (distance < 1.5) return "very close";
  if (distance < 4) return "nearby";
  if (distance < 8) return "a short distance away";
  if (distance < 15) return "further away";
  return "far away";
}

function getVerticalLabel(dy) {
  if (dy > 1.5) return "above you";
  if (dy < -1.5) return "below you";
  return "";
}

function getHorizontalLabel(dot, cross) {
  const frontBack =
    dot > 0.45 ? "in front of you" : dot < -0.45 ? "behind you" : "beside you";

  let leftRight = "";
  if (Math.abs(cross) > 0.3) {
    leftRight = cross > 0 ? "to your right" : "to your left";
  }

  if (frontBack === "beside you" && leftRight) return leftRight;
  if (leftRight) return `${frontBack}, ${leftRight}`;
  return frontBack;
}

function getCameraForward(scene) {
  const camera = scene?.activeCamera;
  if (!camera) return { x: 0, z: 1 };

  try {
    const dir = camera.getForwardRay?.(1)?.direction;
    if (dir && Number.isFinite(dir.x) && Number.isFinite(dir.z)) {
      const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z) || 1;
      return { x: dir.x / len, z: dir.z / len };
    }
  } catch (error) {
    console.warn("Suppressed non-critical error:", error);
  }

  try {
    const pos = camera.globalPosition || camera.position;
    const target = camera.getTarget?.();
    if (pos && target) {
      const x = target.x - pos.x;
      const z = target.z - pos.z;
      const len = Math.sqrt(x * x + z * z) || 1;
      return { x: x / len, z: z / len };
    }
  } catch (error) {
    console.warn("Suppressed non-critical error:", error);
  }

  return { x: 0, z: 1 };
}

function isEnvironmentObject(label) {
  const n = String(label || "").toLowerCase();
  return (
    n.includes("sky") ||
    n.includes("ground") ||
    n.includes("floor") ||
    n.includes("terrain") ||
    n.includes("land") ||
    n.includes("grass") ||
    n.includes("road") ||
    n.includes("path")
  );
}

function isSkyLike(label) {
  const n = String(label || "").toLowerCase();
  return n.includes("sky") || n.includes("cloud");
}

function isGroundLike(label) {
  const n = String(label || "").toLowerCase();
  return (
    n.includes("ground") ||
    n.includes("floor") ||
    n.includes("terrain") ||
    n.includes("grass") ||
    n.includes("road") ||
    n.includes("path")
  );
}

function getInteractionHint(mesh) {
  const root = getEntityRoot(mesh);
  const candidates = [mesh, root];

  for (const m of candidates) {
    const md = m?.metadata || {};
    const hint =
      md.a11yActionHint ||
      md.actionHint ||
      md.interactionHint ||
      md.prompt ||
      md.instruction ||
      md.clickText ||
      md.text ||
      md.say;

    if (hint && String(hint).trim()) {
      return String(hint).trim();
    }
  }

  const interactive = candidates.some(
    (m) =>
      m?.actionManager || m?.metadata?.interactive || m?.metadata?.clickable,
  );


}

function getRepresentativePosition(root, fallbackMesh) {
  const candidates = [root, fallbackMesh];

  for (const node of candidates) {
    if (!node) continue;

    try {
      node.computeWorldMatrix?.(true);
    } catch (error) {
      console.warn("Suppressed non-critical error:", error);
    }

    try {
      const center = node.getBoundingInfo?.()?.boundingBox?.centerWorld;
      if (
        center &&
        Number.isFinite(center.x) &&
        Number.isFinite(center.y) &&
        Number.isFinite(center.z)
      ) {
        return center;
      }
    } catch (error) {
      console.warn("Suppressed non-critical error:", error);
    }

    try {
      const p = node.getAbsolutePosition?.() ?? node.position;
      if (
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.z)
      ) {
        return p;
      }
    } catch (error) {
      console.warn("Suppressed non-critical error:", error);
    }
  }

  return null;
}

function getReferenceAnchor(scene) {
  // Prefer a character/player/avatar in the world, fallback to camera
  const camera = scene?.activeCamera;
  const cameraPos = camera?.globalPosition || camera?.position;

  let bestCharacter = null;
  let bestScore = -Infinity;

  for (const mesh of scene?.meshes || []) {
    if (!mesh || !mesh.isVisible || !mesh.name) continue;
    if (looksLikeInternalMeshName(mesh.name)) continue;

    const root = getEntityRoot(mesh);
    if (!root || !root.isVisible) continue;

    const label = getObjectLabel(root).toLowerCase();
    const md = root?.metadata || {};

    // Never use environment meshes as the player/character anchor
    if (isEnvironmentObject(label)) continue;

    let score = 0;

    // Strong explicit metadata first
    if (md.a11yAnchor === "player" || md.a11yRole === "player") score += 200;
    if (md.a11yRole === "character" || md.role === "character") score += 150;
    if (md.character === true) score += 120;
    if (md.isPlayer === true) score += 200;
    if (md.player === true) score += 180;
    if (md.mainCharacter === true) score += 180;

    // Name-based fallback only if explicit metadata is absent
    if (label.includes("player")) score += 80;
    if (label.includes("avatar")) score += 70;
    if (label.includes("character")) score += 60;
    if (label.includes("bird")) score += 40;// starter world fallback

    const p = getRepresentativePosition(root, mesh);
    if (p && cameraPos) {
      const dx = p.x - cameraPos.x;
      const dy = p.y - cameraPos.y;
      const dz = p.z - cameraPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      score += Math.max(0, 30 - d);
    }

    if (score > bestScore) {
      bestScore = score;
      bestCharacter = root;
    }
  }

  const characterPos = bestCharacter
    ? getRepresentativePosition(bestCharacter, bestCharacter)
    : null;

  if (bestCharacter && characterPos) {
    return {
      kind: "character",
      mesh: bestCharacter,
      position: characterPos,
    };
  }

  // Better fallback: nearest non-environment visible object to the camera
  let fallbackMesh = null;
  let fallbackPos = null;
  let bestFallbackDistance = Infinity;

  for (const mesh of scene?.meshes || []) {
    if (!mesh || !mesh.isVisible || !mesh.name) continue;
    if (looksLikeInternalMeshName(mesh.name)) continue;

    const root = getEntityRoot(mesh);
    if (!root || !root.isVisible) continue;

    const label = getObjectLabel(root).toLowerCase();
    if (isEnvironmentObject(label)) continue;

    const p = getRepresentativePosition(root, mesh);
    if (!p || !cameraPos) continue;

    const dx = p.x - cameraPos.x;
    const dy = p.y - cameraPos.y;
    const dz = p.z - cameraPos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (d < bestFallbackDistance) {
      bestFallbackDistance = d;
      fallbackMesh = root;
      fallbackPos = p;
    }
  }

  if (fallbackMesh && fallbackPos) {
    return {
      kind: "character",
      mesh: fallbackMesh,
      position: fallbackPos
    };
  }

  return {
    kind: "camera",
    mesh: camera || null,
    position: cameraPos || { x: 0, y: 0, z: 0 },
  };
}

function collectNearbyTextForObject(scene, objectPos, objectRoot) {
  if (!scene || !objectPos) return [];

  const texts = [];

  // 1) Metadata text on object itself
  const direct = getMetadataText(objectRoot);
  if (direct) texts.push(direct);

  // 2) Nearby text meshes hovering around object
  for (const mesh of scene.meshes || []) {
    if (!mesh || !mesh.isVisible || !mesh.name) continue;
    if (!looksLikeTextName(mesh.name)) continue;

    const p = getRepresentativePosition(mesh, mesh);
    if (!p) continue;

    const dx = p.x - objectPos.x;
    const dy = p.y - objectPos.y;
    const dz = p.z - objectPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > 3.5) continue;

    const t = getMetadataText(mesh) || normaliseName(mesh.name);
    if (t && !texts.includes(t)) texts.push(t);
  }

  return texts.slice(0, 2);
}

function getSceneObjects(scene, options = {}) {
  const camera = scene?.activeCamera;
  if (!scene || !camera) return [];

  const cameraPos = camera.globalPosition || camera.position;
  const fwd = getCameraForward(scene);
  const anchor = options.anchor || getReferenceAnchor(scene);

  const byEntityName = new Map();

  for (const mesh of scene.meshes || []) {
    if (!mesh || !mesh.isVisible || !mesh.name) continue;
    if (looksLikeInternalMeshName(mesh.name)) continue;

    const root = getEntityRoot(mesh);
    if (!root || !root.isVisible) continue;

    const p = getRepresentativePosition(root, mesh);
    if (!p) continue;

    // Exclude the character/player anchor from object lists
    if (anchor?.mesh && root === anchor.mesh) continue;

    // Direction is relative to the user's viewpoint (camera)
    const dxCam = p.x - cameraPos.x;
    const dyCam = p.y - cameraPos.y;
    const dzCam = p.z - cameraPos.z;
    const distFromCamera = Math.sqrt(
      dxCam * dxCam + dyCam * dyCam + dzCam * dzCam,
    );
    if (distFromCamera < 0.2) continue;

    const lenXZ = Math.sqrt(dxCam * dxCam + dzCam * dzCam) || 1;
    const dirX = dxCam / lenXZ;
    const dirZ = dzCam / lenXZ;

    const dot = fwd.x * dirX + fwd.z * dirZ;
    const cross = fwd.x * dirZ - fwd.z * dirX;

    const horizontal = getHorizontalLabel(dot, cross);
    const vertical = getVerticalLabel(dyCam);

    // Distance wording is relative to the character/player anchor
    let distFromAnchor = distFromCamera;
    if (anchor?.position) {
      const ax = p.x - anchor.position.x;
      const ay = p.y - anchor.position.y;
      const az = p.z - anchor.position.z;
      distFromAnchor = Math.sqrt(ax * ax + ay * ay + az * az);
    }

    const distanceLabel = getDistanceLabel(distFromAnchor);

    const label = getObjectLabel(root);
    const interactionHint = getInteractionHint(root);
    const interactive = Boolean(
      root.actionManager ||
      mesh.actionManager ||
      root?.metadata?.interactive ||
      root?.metadata?.clickable ||
      interactionHint,
    );

    const textLabels = collectNearbyTextForObject(scene, p, root);

    const dedupeKey = `${label.toLowerCase()}|${Math.round(p.x)}|${Math.round(p.y)}|${Math.round(p.z)}`;
    const existing = byEntityName.get(dedupeKey);

    if (!existing || distFromAnchor < existing.distFromAnchor) {
      byEntityName.set(dedupeKey, {
        mesh: root,
        label,
        distFromCamera,
        distFromAnchor,
        interactive,
        interactionHint,
        textLabels,
        horizontal,
        vertical,
        distanceLabel,
        isEnvironment: isEnvironmentObject(label),
        isSkyLike: isSkyLike(label),
        isGroundLike: isGroundLike(label),
      });
    }
  }

  return Array.from(byEntityName.values());
}

function objectToSentence(
  obj,
  { includeActionHint = false, includeText = false } = {},
) {
  const where = [obj.horizontal, obj.vertical].filter(Boolean).join(" and ");
  let sentence = `${obj.label} is ${where || "nearby"}, ${obj.distanceLabel}.`;

  if (includeText && obj.textLabels?.length) {
    sentence += ` Text: ${obj.textLabels.join(". ")}.`;
  }

  if (includeActionHint && obj.interactive) {
    const hint = obj.interactionHint || "You can interact with this.";
    sentence += ` ${hint}`;
  }

  return sentence;
}

function enrichEnvironmentLabel(obj) {
  const raw = String(obj?.label || "").trim();
  const label = raw.toLowerCase();

  // Hide vague or unhelpful labels
  if (!label) return "";
  if (
    label === "environment" ||
    label === "scene" ||
    label === "object" ||
    label === "mesh" ||
    label === "ground" ||
    label === "floor" ||
    label === "terrain" ||
    label === "sky"
  ) {
    return "";
  }

  // Make some common labels sound nicer
  if (obj?.isSkyLike && raw) return raw;
  if (obj?.isGroundLike && raw) return raw;

  return raw;
}

function buildEnvironmentSummary(objects, anchor = null, scene = null) {
  if (!objects?.length) return "";

  const normalise = (s) => String(s || "").trim();
  const lower = (s) => normalise(s).toLowerCase();

  // Exclude the main character label from the environment glimpse
  const anchorLabel = anchor?.mesh ? lower(getObjectLabel(anchor.mesh)) : "";

  // Group objects by spoken label
  const counts = new Map();
  let hasGround = false;
  let hasSky = false;

  for (const obj of objects) {
    const label = normalise(obj.label);
    const labelLower = lower(label);
    if (!label) continue;

    if (labelLower === anchorLabel) continue;

    if (obj.isGroundLike || ["ground", "floor", "terrain", "grass"].includes(labelLower)) {
      hasGround = true;
      continue;
    }

    if (obj.isSkyLike || labelLower.includes("sky")) {
      hasSky = true;
      continue;
    }

    counts.set(label, (counts.get(label) || 0) + 1);
  }

  // Optional fallback: if no sky mesh exists, infer from scene background
  if (!hasSky && scene?.clearColor) {
    hasSky = true;
  }

  // Sort repeated scene elements by count, then label
  const grouped = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

  const parts = [];

  // Mention the most important repeated world elements first
  for (const [label, count] of grouped.slice(0, 4)) {
    if (count === 1) {
      parts.push(`${label}`);
    } else {
      parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
    }
  }

  if (hasGround) {
    parts.push("ground");
  }

  if (hasSky) {
    parts.push("sky");
  }

  const chosen = parts.slice(0, 6);
  if (!chosen.length) return "";

  if (chosen.length === 1) {
    return `The scene includes ${chosen[0]}.`;
  }

  if (chosen.length === 2) {
    return `The scene includes ${chosen[0]} and ${chosen[1]}.`;
  }

  return `The scene includes ${chosen.slice(0, -1).join(", ")}, and ${chosen[chosen.length - 1]}.`;
}

export function recordObjectSayText(targetName, text) {
  const key = String(targetName || "").trim().toLowerCase();
  const spoken = cleanSpokenAnnouncement(resolveSpokenText(text));
  if (!key || !spoken) return;
  objectSayTextCache.set(key, spoken);
}

function getCachedSayTextForMesh(mesh) {
  if (!mesh) return "";

  const candidates = [
    mesh?.name,
    getEntityRoot(mesh)?.name,
    getObjectLabel(mesh),
    getObjectLabel(getEntityRoot(mesh))
  ]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  for (const key of candidates) {
    const hit = objectSayTextCache.get(key);
    if (hit) return hit;
  }

  return "";
}

function describeCharacterIntro(scene) {
  const anchor = getReferenceAnchor(scene);

  if (!anchor?.mesh || anchor.kind !== "character") {
    return "";
  }

  const label = getObjectLabel(anchor.mesh);
  const promptText = getCachedPromptTextForMesh(anchor.mesh);
  const hint = cleanSpokenAnnouncement(
    resolveSpokenText(getInteractionHint(anchor.mesh))
  );

  let msg = "";

  if (promptText) {
    msg += ` You can interact with ${label}. ${label} says: ${promptText}.`;
  } else if (hint) {
    msg += ` ${hint}`;
  }

  return msg;
}

export function describeScene(scene) {
  if (!scene) return "No scene loaded.";
  if (!scene.activeCamera) return "No active camera is available.";

  const anchor = getReferenceAnchor(scene);
  const objects = getSceneObjects(scene, { anchor });

  const labelCounts = new Map();
  for (const o of objects) {
    const key = String(o.label || "").trim().toLowerCase();
    if (!key) continue;
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
  }

  const parts = [];

  const charIntro = describeCharacterIntro(scene);
  if (charIntro) {
    parts.push(charIntro);
  }

  if (objects.length === 0) {
    if (parts.length) return parts.join(" ");
    return "I cannot detect any objects around you yet.";
  }

  const environmentSummary = buildEnvironmentSummary(objects, anchor, scene);

  const mainObjects = objects
    .filter((o) => {
      const key = String(o.label || "").trim().toLowerCase();
      const repeatedScenery = (labelCounts.get(key) || 0) >= 4;
      return !o.isEnvironment && !repeatedScenery;
    })
    .sort((a, b) => a.distFromAnchor - b.distFromAnchor);

  const top = mainObjects.slice(0, 6);

  if (environmentSummary) {
    parts.push(environmentSummary);
  }

  if (mainObjects.length > 0) {
    parts.push(
      top.map((o) => objectToSentence(o, { includeText: true })).join(" "),
    );
  } else {
    parts.push("I can detect the environment, but no nearby main objects.");
  }

  return parts.join(" ");
}

export function describeNearestObject(scene) {
  if (!scene) return "No scene loaded.";
  if (!scene.activeCamera) return "No active camera is available.";

  const anchor = getReferenceAnchor(scene);
  const objects = getSceneObjects(scene, { anchor })
    .filter((o) => !o.isEnvironment)
    .sort((a, b) => a.distFromAnchor - b.distFromAnchor);

  if (objects.length === 0) {
    return "I cannot detect any nearby objects.";
  }

  const nearest = objects[0];
  return `Nearest object: ${objectToSentence(nearest, {
    includeActionHint: true,
    includeText: true,
  })}`;
}

function describeInitialWorld(scene) {
  const charIntro = describeCharacterIntro(scene);
  const sceneIntro = describeScene(scene);

  if (charIntro && sceneIntro) return `${charIntro} ${sceneIntro}`;
  return charIntro || sceneIntro || "World loaded.";
}

export function getHelpText(scene) {
  const custom =
    scene?.metadata?.a11yInstructions || scene?.metadata?.instructions;

  const baseInstructions = custom
    ? String(custom).trim()
    : "Use keyboard controls to navigate and interact with objects. Canvas keyboard controls: Arrow keys or WASD to move camera, Mouse to look around, Space for actions, Tab to navigate to other interface elements.";

  const ctrlInstructions =
    " Press Control plus I to hear a scene summary. Press Control plus J to hear the nearest object. Press Control plus H to repeat these instructions.";

  return `${baseInstructions}${ctrlInstructions}`;
}
export function announceHelp(scene) {
  announce(getHelpText(scene));
}

function announceInteraction(mesh, actionWord = "interacted with") {
  if (!mesh) return;

  const root = getEntityRoot(mesh);
  const label = getObjectLabel(root);
  const hint = getInteractionHint(root);
  const pos = getRepresentativePosition(root, mesh);
  const textLabels = currentScene
    ? collectNearbyTextForObject(currentScene, pos, root)
    : [];

  const now = Date.now();
  const interactionKey = `${actionWord}:${label}:${hint}:${(textLabels || []).join("|")}`;
  if (
    interactionKey === lastInteractionKey &&
    now - lastInteractionTime < 400
  ) {
    return;
  }
  lastInteractionKey = interactionKey;
  lastInteractionTime = now;

  let msg = `You ${actionWord} ${label}.`;
  if (textLabels.length) {
    msg += ` Text: ${textLabels.join(". ")}.`;
  }
  if (hint) {
    msg += ` ${hint}`;
  }

  announce(msg);
}

function attachPointerAnnouncements(scene) {
  if (!scene || !scene.onPointerObservable) return;

  if (pointerObserverScene && pointerObserverRef) {
    try {
      pointerObserverScene.onPointerObservable.remove(pointerObserverRef);
    } catch {}
    pointerObserverRef = null;
    pointerObserverScene = null;
  }

  const PointerTypes =
    window.BABYLON?.PointerEventTypes ||
    globalThis.BABYLON?.PointerEventTypes;

  pointerObserverScene = scene;

  pointerObserverRef = scene.onPointerObservable.add((pointerInfo) => {
    try {
      if (scene !== currentScene) return;

      const type = pointerInfo?.type;
      const pickInfo = pointerInfo?.pickInfo;
      const pickedMesh = pickInfo?.pickedMesh;
      const evt = pointerInfo?.event;

      if (!pickedMesh) return;

      const isBabylonPick = PointerTypes
        ? type === PointerTypes.POINTERPICK
        : true;

      // Require a real primary click / tap, not hover or passive movement
      const isPrimaryMouseClick =
        !evt ||
        evt.pointerType === "touch" ||
        evt.type === "click" ||
        evt.type === "pointerup" ||
        evt.type === "mouseup";

      if (!isBabylonPick || !isPrimaryMouseClick) return;

      if (introInProgress || Date.now() < suppressPointerUntil) return;

      const root = getEntityRoot(pickedMesh);
      const pos = getRepresentativePosition(root, pickedMesh);
      const label = getObjectLabel(root);
      const sayText = getCachedSayTextForMesh(root);
      const promptText = getCachedPromptTextForMesh(root);
      const textLabels = currentScene
        ? collectNearbyTextForObject(currentScene, pos, root)
        : [];

      if (sayText) {
        announce(`${label} says: ${sayText}`);
        return;
      }

      if (promptText) {
        announce(`${label}. ${promptText}`);
        return;
      }

      if (textLabels.length) {
        announce(`${label}. ${textLabels.join(". ")}`);
        return;
      }

      announceInteraction(pickedMesh, "selected");
    } catch {
      // fail silently
    }
  });
}

export function recordObjectPromptText(targetName, text) {
  const key = String(targetName || "").trim().toLowerCase();
  const spoken = cleanSpokenAnnouncement(resolveSpokenText(text));

  if (!key || !spoken) return;

  // Keep only the first prompt text for the object
  if (!objectPromptTextCache.has(key)) {
    objectPromptTextCache.set(key, spoken);
  }
}

function getCachedPromptTextForMesh(mesh) {
  if (!mesh) return "";

  const candidates = [
    mesh?.name,
    getEntityRoot(mesh)?.name,
    getObjectLabel(mesh),
    getObjectLabel(getEntityRoot(mesh))
  ]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  for (const key of candidates) {
    const hit = objectPromptTextCache.get(key);
    if (hit) return hit;
  }

  return "";
}

export function announceSayText(text, options = {}) {
  const resolved = resolveSpokenText(text);
  const spoken = cleanSpokenAnnouncement(resolved);

  if (!spoken) return;

  const lower = spoken.toLowerCase();
  if (
    lower.includes("flock xr loaded successfully") ||
    lower.includes("flock world successfully loaded")
  ) {
    return;
  }

  if (introInProgress || Date.now() < suppressRuntimeTextUntil) return;

  announce(spoken, options);
}

function scheduleInitialIntro(scene) {
  if (!scene) return;

  // Only speak the full intro once per page load, not once per world/scene.
  if (hasSpokenInitialPageIntro) {
    introInProgress = false;
    suppressPointerUntil = 0;
    suppressRuntimeTextUntil = 0;
    lastIntroScene = scene;
    return;
  }

  if (lastIntroScene === scene) return;
  lastIntroScene = scene;

  introInProgress = true;

  // Keep suppression longer than the help text is likely to take
  suppressPointerUntil = Date.now() + 12000;
  suppressRuntimeTextUntil = Date.now() + 12000;

  const finishIntro = () => {
    introInProgress = false;
    suppressPointerUntil = 0;
    suppressRuntimeTextUntil = 0;
  };

  const speakIntro = () => {
    if (scene !== currentScene) return;

    const helpText = getHelpText(scene);
    if (helpText) {
      announce(helpText, { force: true });
    }

    hasSpokenInitialPageIntro = true;

    // Finish after the screen reader has had time to get through the intro
    setTimeout(() => {
      if (scene !== currentScene) return;
      finishIntro();
    }, 10000);
  };

  const waitUntilReady = (tries = 0) => {
    if (scene !== currentScene) return;

    const loadingScreen = document.getElementById("loadingScreen");
    const stillLoading =
      document.body.classList.contains("loading") ||
      (loadingScreen && !loadingScreen.classList.contains("fade-out"));

    if (stillLoading && tries < 40) {
      setTimeout(() => waitUntilReady(tries + 1), 250);
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scene !== currentScene) return;
          speakIntro();
        }, 500);
      });
    });
  };

  if (document.readyState === "complete") {
    waitUntilReady();
  } else {
    window.addEventListener("load", () => waitUntilReady(), { once: true });
  }
}

export function enableSceneDescription(scene) {
  currentScene = scene;

  // Ensure live region exists early
  createLiveRegion();

  // Reset per-world state
  lastInteractionKey = "";
  lastInteractionTime = 0;
  lastAnnouncedText = "";
  lastAnnouncedAt = 0;
  announceSeq += 1;

  // Only clear caches when switching to a different scene object
  if (lastIntroScene !== scene) {
    objectSayTextCache = new Map();
    objectPromptTextCache = new Map();
  }

  attachPointerAnnouncements(scene);
  scheduleInitialIntro(scene);

  if (keyListenerAttached) return;
  keyListenerAttached = true;

  document.addEventListener(
    "keydown",
    (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;

      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (!e.key) return;

      const key = e.key.toLowerCase();

      if (key === "i") {
        e.preventDefault();
        e.stopPropagation();
        announce(describeScene(currentScene));
        return;
      }

      if (key === "j") {
        e.preventDefault();
        e.stopPropagation();
        announce(describeNearestObject(currentScene));
        return;
      }

      if (key === "h") {
        e.preventDefault();
        e.stopPropagation();
        announceHelp(currentScene);
      }
    },
    true
  );
}

/**
 * Helper for Flock code to call directly on custom events
 * (e.g., collisions, scripted triggers, button clicks).
 */
export function announceSceneEvent(mesh, verb = "interacted with") {
  announceInteraction(mesh, verb);
}
