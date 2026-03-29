// flock/accessibility/accessibility.js

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
  if (text === lastAnnouncedText && now - lastAnnouncedAt < 250) return;
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

export function toggleMute() {
  speechMuted = !speechMuted;
  announce(
    speechMuted
      ? "Screen reader announcements muted."
      : "Screen reader announcements unmuted.",
    { force: true },
  );
}

export function setMute(value) {
  speechMuted = Boolean(value);
  announce(
    speechMuted
      ? "Screen reader announcements muted."
      : "Screen reader announcements unmuted.",
    { force: true },
  );
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
    if (text && String(text).trim()) return String(text).trim();
  }
  return "";
}

function getObjectLabel(mesh) {
  const md = mesh?.metadata || {};

  const explicit = md.a11yLabel || md.label || md.displayName || md.name;

  if (explicit) return String(explicit).trim();

  const root = getEntityRoot(mesh);
  const rootMd = root?.metadata || {};

  const rootExplicit =
    rootMd.a11yLabel || rootMd.label || rootMd.displayName || rootMd.name;

  if (rootExplicit) return String(rootExplicit).trim();

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

  if (interactive) return "You can interact with this.";
  return "";
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

    let score = 0;
    if (md.a11yAnchor === "player" || md.a11yRole === "player") score += 100;
    if (md.a11yRole === "character" || md.role === "character") score += 80;
    if (md.character === true) score += 70;

    if (label.includes("player")) score += 60;
    if (label.includes("avatar")) score += 60;
    if (label.includes("character")) score += 55;
    if (label.includes("bird")) score += 40; // starter world fallback

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

function buildEnvironmentSummary(objects) {
  const env = objects.filter((o) => o.isEnvironment);
  if (!env.length) return "";

  const labels = [];

  const sky = env.find((o) => o.isSkyLike);
  if (sky) labels.push(sky.label);

  const ground = env.find((o) => o.isGroundLike);
  if (ground && !labels.includes(ground.label)) labels.push(ground.label);

  for (const o of env) {
    if (!labels.includes(o.label)) labels.push(o.label);
    if (labels.length >= 4) break;
  }

  if (!labels.length) return "";
  if (labels.length === 1) return `The environment includes ${labels[0]}.`;
  if (labels.length === 2)
    return `The environment includes ${labels[0]} and ${labels[1]}.`;
  return `The environment includes ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}.`;
}

function describeCharacterIntro(scene) {
  const anchor = getReferenceAnchor(scene);

  if (!anchor?.mesh || anchor.kind !== "character") {
    return "";
  }

  const label = getObjectLabel(anchor.mesh);
  const p = getRepresentativePosition(anchor.mesh, anchor.mesh);
  const texts = collectNearbyTextForObject(scene, p, anchor.mesh);

  let msg = `Main character: ${label}.`;
  if (texts.length) {
    msg += ` Text on or near the character: ${texts.join(". ")}.`;
  }
  return msg;
}

export function describeScene(scene) {
  if (!scene) return "No scene loaded.";
  if (!scene.activeCamera) return "No active camera is available.";

  const anchor = getReferenceAnchor(scene);
  const objects = getSceneObjects(scene, { anchor });
  if (objects.length === 0) {
    return "I cannot detect any objects around you yet.";
  }

  const environmentSummary = buildEnvironmentSummary(objects);

  // Sort by distance from character (or camera fallback) for description
  const mainObjects = objects
    .filter((o) => !o.isEnvironment)
    .sort((a, b) => a.distFromAnchor - b.distFromAnchor);

  const top = mainObjects.slice(0, 6);

  const parts = [];

  if (environmentSummary) parts.push(environmentSummary);

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

  if (custom) return custom;

  return "Use W A S D to move. Use the mouse to look around. Press Control plus I to hear a scene summary. Press Control plus J to hear the nearest object. Press Control plus H to repeat these instructions. Press Control plus M to mute or unmute announcements.";
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

  // Remove observer from previous scene
  if (pointerObserverScene && pointerObserverRef) {
    try {
      pointerObserverScene.onPointerObservable.remove(pointerObserverRef);
    } catch (error) {
   console.warn("Suppressed non-critical error:", error);
 }
    pointerObserverRef = null;
    pointerObserverScene = null;
  }

  const PointerTypes =
    window.BABYLON?.PointerEventTypes || globalThis.BABYLON?.PointerEventTypes;

  pointerObserverScene = scene;

  pointerObserverRef = scene.onPointerObservable.add((pointerInfo) => {
    try {
      if (scene !== currentScene) return;

      const type = pointerInfo?.type;
      const pickInfo = pointerInfo?.pickInfo;
      const pickedMesh = pickInfo?.pickedMesh;

      if (!pickedMesh) return;

      const isPick = PointerTypes
        ? type === PointerTypes.POINTERPICK || type === PointerTypes.POINTERDOWN
        : true;

      if (!isPick) return;

      announceInteraction(pickedMesh, "selected");
    } catch {
      // fail silently
    }
  });
}

function scheduleInitialIntro(scene) {
  // Avoid duplicate intro for same scene instance
  if (!scene || lastIntroScene === scene) return;
  lastIntroScene = scene;

  // Delay slightly so scene meshes/text have time to exist
  setTimeout(() => {
    if (scene !== currentScene) return;
    announce(describeInitialWorld(scene));
  }, 400);
}

export function enableSceneDescription(scene) {
  currentScene = scene;

  // Reset per-world state
  lastInteractionKey = "";
  lastInteractionTime = 0;
  lastAnnouncedText = "";
  lastAnnouncedAt = 0;
  announceSeq += 1; // invalidate pending async live-region updates

  attachPointerAnnouncements(scene);
  scheduleInitialIntro(scene);

  if (keyListenerAttached) return;
  keyListenerAttached = true;

  document.addEventListener(
    "keydown",
    (e) => {
      const tag =
        e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable)
        return;

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

      if (key === "m") {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
        return;
      }

      if (key === "h") {
        e.preventDefault();
        e.stopPropagation();
        announceHelp(currentScene);
      }
    },
    true,
  );
}

/**
 * Optional helper for Flock code to call directly on custom events
 * (e.g., collisions, scripted triggers, button clicks).
 */
export function announceSceneEvent(mesh, verb = "interacted with") {
  announceInteraction(mesh, verb);
}
