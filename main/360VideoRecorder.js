/**
 * 360° Video Recording Module
 * Provides functionality to record 360-degree videos from Babylon.js scenes
 */

import { flock } from "../flock.js";

let isRecording360 = false;
let recordingOverlay = null;

// Create CSS styles for recording overlay
const overlayStyles = `
  .recording-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: "Asap", Helvetica, Arial, sans-serif;
  }

  .recording-content {
    text-align: center;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .recording-indicator {
    width: 20px;
    height: 20px;
    background: #ff4444;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  .recording-text {
    font-size: 24px;
    font-weight: 500;
    margin: 0;
  }

  .recording-time {
    font-size: 18px;
    opacity: 0.8;
    margin: 0;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
`;

// Inject CSS styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = overlayStyles;
  document.head.appendChild(styleSheet);
}

// Polyfill if captureEquirectangularFromScene isn't present (Babylon 8+ has it)
if (!BABYLON.captureEquirectangularFromScene) {
  BABYLON.captureEquirectangularFromScene = function (scene, options) {
    const size = options.size || 1024;
    const probe =
      options.probe ?? new BABYLON.ReflectionProbe("tempProbe", size, scene);
    const wasProbeProvided = !!options.probe;

    if (!wasProbeProvided) {
      if (options.position) probe.position = options.position.clone();
      else if (scene.activeCamera)
        probe.position = scene.activeCamera.position.clone();
    }

    const meshes = options.meshesFilter
      ? scene.meshes.filter(options.meshesFilter)
      : scene.meshes;
    probe.renderList?.push(...meshes);
    probe.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    probe.cubeTexture.render();

    const tex = new BABYLON.CustomProceduralTexture(
      "eqTemp",
      "equirectangularPanorama",
      { width: size * 2, height: size },
      scene,
    );
    tex.setTexture("cubeMap", probe.cubeTexture);

    return new Promise((resolve, reject) => {
      tex.onGeneratedObservable.addOnce(() => {
        const p = tex.readPixels();
        if (!p) {
          tex.dispose();
          if (!wasProbeProvided) probe.dispose();
          reject(new Error("No pixel data from equirectangular capture"));
          return;
        }
        p.then((pixelData) => {
          tex.dispose();
          if (!wasProbeProvided) probe.dispose();
          resolve(pixelData);
        });
      });
    });
  };
}

/**
 * Records a 360-degree video from a Babylon.js scene
 * @param {Object} options - Recording options
 * @param {BABYLON.Scene} options.scene - The Babylon.js scene to record
 * @param {number} options.seconds - Duration of recording in seconds (default: 10)
 * @param {number} options.size - Resolution size (default: 2048)
 * @param {number} options.fps - Frames per second (default: 30)
 * @param {string} options.filename - Output filename (default: auto-generated)
 */
/**
 * Shows the recording overlay with progress indicator
 */
function showRecordingOverlay(totalSeconds) {
  recordingOverlay = document.createElement("div");
  recordingOverlay.className = "recording-overlay";

  recordingOverlay.innerHTML = `
    <div class="recording-content">
      <div class="recording-indicator"></div>
      <p class="recording-text">Recording 360° Video</p>
      <p class="recording-time">0 / ${totalSeconds}s</p>
    </div>
  `;

  document.body.appendChild(recordingOverlay);
}

/**
 * Updates the recording time display
 */
function updateRecordingTime(elapsed, total) {
  if (recordingOverlay) {
    const timeElement = recordingOverlay.querySelector(".recording-time");
    if (timeElement) {
      timeElement.textContent = `${Math.ceil(elapsed)} / ${total}s`;
    }
  }
}

/**
 * Hides the recording overlay
 */
function hideRecordingOverlay() {
  if (recordingOverlay && recordingOverlay.parentNode) {
    recordingOverlay.parentNode.removeChild(recordingOverlay);
    recordingOverlay = null;
  }
}

export async function record360({
  scene,
  seconds = 10,
  size = 4096,
  fps = 60,
  filename = `flock-360-${Date.now()}.mp4`,
} = {}) {
  if (isRecording360) return;
  isRecording360 = true;

  // Show recording overlay
  showRecordingOverlay(seconds);

  const width = size * 2;
  const height = size;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Pick a supported codec/container - prioritize MP4
  const candidates = [
    'video/mp4;codecs=avc1.4d001f',  // Higher profile H.264
    'video/webm;codecs=vp9',         // VP9 handles motion better
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType =
    candidates.find(
      (t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t),
    ) || "";

  // Debug logging
  console.log("MediaRecorder supported:", !!window.MediaRecorder);
  console.log("Selected mime type:", mimeType);

  if (!mimeType) {
    console.error("No supported video format found!");
    isRecording360 = false;
    hideRecordingOverlay();
    return;
  }

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) {
      console.log("Chunk size:", e.data.size);
      chunks.push(e.data);
    }
  };

  const doneRecording = new Promise((res) => (recorder.onstop = res));
  recorder.start();

  const start = performance.now();
  const frameInterval = 1000 / fps;

  try {
    while (performance.now() - start < seconds * 1000) {
      // Get camera position inside the loop
      const cameraPos =
        scene.activeCamera?.globalPosition ??
        scene.activeCamera?.position ??
        new BABYLON.Vector3(0, 0, 0);

      console.log("Camera position:", cameraPos);

      const pixels = await BABYLON.captureEquirectangularFromScene(scene, {
        size,
        position: cameraPos,
        meshesFilter: (m) => m.isEnabled() && m.isVisible,
      });

      const imageData = new ImageData(
        new Uint8ClampedArray(pixels),
        width,
        height,
      );
      ctx.putImageData(imageData, 0, 0);

      // Update recording time display
      const elapsed = (performance.now() - start) / 1000;
      updateRecordingTime(elapsed, seconds);

      // Keep roughly in sync with desired fps
      const elapsedMs = performance.now() - start;
      const next = Math.ceil(elapsedMs / frameInterval) * frameInterval;
      const wait = start + next - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  } catch (err) {
    console.error("360 recording error:", err);
  } finally {
    // Hide recording overlay
    hideRecordingOverlay();
    recorder.stop();
    await doneRecording;

    console.log("Total chunks:", chunks.length);
    const blob = new Blob(chunks, { type: mimeType || "video/mp4" });
    console.log("Final blob size:", blob.size);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    isRecording360 = false;
  }
}

/**
 * Initializes the 360 video recorder with keyboard shortcut
 * Binds Ctrl+Shift+3 to start recording
 */
export function initialize360VideoRecorder() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.shiftKey && (e.code === "Digit3" || e.key === "#")) {
        const scene = flock.scene;
        if (!scene)
          return console.warn(
            "No Babylon scene found (expected at flock.scene)",
          );
        record360({ scene, seconds: 10, size: 4096, fps: 30 }); // tweak size/fps here
      }
    },
    { passive: true },
  );
}
