// Dev-only: an immersive session hides the DOM, so XR state is posted to logs/xr-debug.log.

let flock = null;

export function setFlockReference(ref) {
  flock = ref;
}

const TICK_FRAMES = 60;

// One bad read must not cost the whole sample.
function safe(fn) {
  try {
    const value = fn();
    return typeof value === 'number' ? +value.toFixed(3) : value;
  } catch (error) {
    return `threw: ${error?.message ?? error}`;
  }
}

// The raw platform pose, recorded beside Babylon's camera so the two can be compared.
function viewerPoseY(sessionManager) {
  const frame = sessionManager?.currentFrame;
  const space = sessionManager?.referenceSpace;
  if (!frame || !space) return null;
  const pose = frame.getViewerPose(space);
  return pose ? +pose.transform.position.y.toFixed(3) : null;
}

function snapshot(label) {
  const baseExperience = flock.xrHelper?.baseExperience;
  const sessionManager = baseExperience?.sessionManager;
  const camera = baseExperience?.camera;
  return {
    label,
    xrMode: flock._xrMode ?? null,
    sessionMode: safe(() => sessionManager?.session?.environmentBlendMode ?? null),
    interactionMode: safe(() => sessionManager?.session?.interactionMode ?? null),
    handheld: safe(() => flock._isHandheldXRSession()),
    projectCameraOrbits: flock._xrProjectCameraOrbits ?? null,
    referenceSpaceType: safe(() => sessionManager?.referenceSpace?.constructor?.name ?? null),
    sizeCm: safe(() => flock._arSceneSizeCentimetres()),
    arSceneSizeCm: flock._arSceneSizeCm ?? null,
    arWorldScale: safe(() => flock._arWorldScale),
    worldScalingFactor: safe(() => sessionManager?.worldScalingFactor),
    placementFrames: flock._arPlacementFrames ?? null,
    bounds: safe(() => {
      const bounds = flock._arSceneBounds();
      if (!bounds) return null;
      return {
        width: +bounds.width.toFixed(3),
        minY: +bounds.min.y.toFixed(3),
        centre: [
          +bounds.centre.x.toFixed(2),
          +bounds.centre.y.toFixed(2),
          +bounds.centre.z.toFixed(2),
        ],
      };
    }),
    // Which meshes set the bounds, and how far each sits above the diorama's floor.
    contributors: safe(() => {
      const meshes = (flock.scene?.meshes ?? []).filter((mesh) => flock._isARSceneContent(mesh));
      return meshes
        .map((mesh) => {
          const box = mesh.getBoundingInfo?.()?.boundingBox;
          if (!box) return null;
          return {
            name: mesh.name,
            minY: +box.minimumWorld.y.toFixed(2),
            maxY: +box.maximumWorld.y.toFixed(2),
            width: +Math.max(
              box.maximumWorld.x - box.minimumWorld.x,
              box.maximumWorld.z - box.minimumWorld.z
            ).toFixed(2),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.minY - b.minY)
        .slice(0, 20);
    }),
    groundY: safe(() => flock.ground?.position?.y ?? null),
    groundHeightMap: safe(() => flock.ground?.metadata?.heightMapImage ?? null),
    activeCamera: safe(() => flock.scene?.activeCamera?.getClassName?.() ?? null),
    // The heading moveForward derives from the active camera, and where the character sits.
    activeCameraYaw: safe(() => {
      const active = flock.scene?.activeCamera;
      if (!active?.getDirection) return null;
      const forward = active.getDirection(flock.BABYLON.Vector3.Forward());
      return Math.round((Math.atan2(forward.x, forward.z) * 180) / Math.PI);
    }),
    // The camera's follow target is the character; picking by capsule finds a gem instead.
    player: safe(() => {
      const mesh = flock._xrFollowTarget;
      if (!mesh || mesh.isDisposed?.()) return null;
      const p = mesh.getAbsolutePosition();
      return { name: mesh.name, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
    }),
    // The exact vectors moveForward and moveSideways drive the character along.
    axes: safe(() => {
      const active = flock.scene?.activeCamera;
      if (!active?.getDirection) return null;
      const round = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      return {
        forward: round(active.getDirection(flock.BABYLON.Vector3.Forward())),
        right: round(active.getDirection(flock.BABYLON.Vector3.Right())),
      };
    }),
    // Which branch the comfort aids took; a null pose is the one that hides the overlay.
    comfort: {
      tunnel: flock._xrComfortTunnel ?? null,
      overlay: flock._xrComfortRestFrame ?? null,
      shown: flock._xrComfortRestFrameShow ?? null,
      pose: flock._xrComfortPoseStatus ?? null,
      motion: safe(() => flock._xrComfortMotion),
      fade: safe(() => flock._xrRestFrameFade),
      restriction: safe(() => flock._xrVignetteRestriction),
      anchor: safe(() => {
        const anchor = flock._xrRestFrameAnchor;
        return anchor ? [+anchor.x.toFixed(2), +anchor.z.toFixed(2)] : null;
      }),
      overlayLocal: safe(() => {
        const node = flock._xrRestFrameNode;
        if (!node) return null;
        const q = node.rotationQuaternion;
        return {
          position: [+node.position.x.toFixed(2), +node.position.y.toFixed(2)],
          yaw: Math.round((2 * Math.atan2(q?.y ?? 0, q?.w ?? 1) * 180) / Math.PI),
        };
      }),
    },
    cameraY: safe(() => camera?.position?.y),
    cameraPos: safe(() =>
      camera?.position ? [+camera.position.x.toFixed(2), +camera.position.z.toFixed(2)] : null
    ),
    poseY: safe(() => viewerPoseY(sessionManager)),
    realWorldHeight: safe(() => camera?.realWorldHeight ?? null),
    groundVisible: safe(() => flock.ground?.isVisible ?? null),
    groundMaterial: safe(() => flock.ground?.material?.getClassName?.() ?? null),
  };
}

export function xrDebugPost(label) {
  if (!flock?.isDebugLoggingEnabled?.()) return;
  let body;
  try {
    body = JSON.stringify(snapshot(label));
  } catch {
    // A snapshot that will not serialise is not worth failing a render frame over.
    return;
  }
  fetch('/__xr-debug', { method: 'POST', body, keepalive: true }).catch(() => {
    // The sink only exists on the dev server; elsewhere the post is meant to be ignored.
  });
}

let frames = 0;

export function xrDebugTick() {
  if (!flock?.isDebugLoggingEnabled?.()) return;
  if (++frames % TICK_FRAMES) return;
  xrDebugPost(`tick ${frames / TICK_FRAMES}`);
}

export function xrDebugResetTicks() {
  frames = 0;
}
