import { CreateScreenshotAsync, UtilityLayerRenderer, VideoRecorder } from '@babylonjs/core';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { flock } from '../flock.js';
import { translate } from '../main/translation.js';
import { openSaveTarget } from '../main/saveFile.js';
import { ICON_MESH_NAME } from './interactIndicator.js';
import { NAME_LABELS_TEXTURE } from './nameLabels.js';

const GIF_MAX_SIDE = 480;
const GIF_FRAME_MS = 100;
const GIF_MAX_MS = 10_000;
const VIDEO_MAX_MS = 60_000;
const EDITOR_GUI_TEXTURES = new Set(['VirtualControls', 'GizmoHUD', NAME_LABELS_TEXTURE]);
const VIDEO_TYPES = [
  { mimeType: 'video/mp4;codecs=avc1', type: 'video/mp4', extension: '.mp4' },
  { mimeType: 'video/mp4', type: 'video/mp4', extension: '.mp4' },
  { mimeType: 'video/webm;codecs=vp9', type: 'video/webm', extension: '.webm' },
  { mimeType: 'video/webm', type: 'video/webm', extension: '.webm' },
];

let session = null;

function projectName() {
  return document.getElementById('projectName')?.value.trim() || 'Flock XR';
}

function videoFormat() {
  if (typeof MediaRecorder === 'undefined' || !flock.engine) return null;
  if (!VideoRecorder.IsSupported(flock.engine)) return null;
  return VIDEO_TYPES.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function hideEditorOverlays(scene) {
  const restores = [];
  const hide = (target, key, value) => {
    const previous = target[key];
    target[key] = value;
    restores.push(() => (target[key] = previous));
  };
  for (const texture of scene.textures) {
    if (EDITOR_GUI_TEXTURES.has(texture.name) && texture.rootContainer) {
      hide(texture.rootContainer, 'isVisible', false);
    }
  }
  const icon = scene.getMeshByName(ICON_MESH_NAME);
  if (icon?.isEnabled()) {
    icon.setEnabled(false);
    restores.push(() => icon.setEnabled(true));
  }
  hide(UtilityLayerRenderer.DefaultUtilityLayer, 'shouldRender', false);
  hide(UtilityLayerRenderer.DefaultKeepDepthUtilityLayer, 'shouldRender', false);
  hide(scene.getBoundingBoxRenderer(), 'enabled', false);
  return () => restores.forEach((restore) => restore());
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: header.slice(5).split(';')[0] });
}

function startGifCapture() {
  const engine = flock.engine;
  const canvas = engine.getRenderingCanvas();
  const scale = Math.min(1, GIF_MAX_SIDE / Math.max(canvas.width, canvas.height));
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const context = frameCanvas.getContext('2d', { willReadFrequently: true });
  const frames = [];
  let lastFrameTime = -Infinity;

  const observer = engine.onEndFrameObservable.add(() => {
    const now = performance.now();
    if (now - lastFrameTime < GIF_FRAME_MS) return;
    lastFrameTime = now;
    context.drawImage(canvas, 0, 0, width, height);
    frames.push({ time: now, data: context.getImageData(0, 0, width, height).data });
  });

  return {
    maxMs: GIF_MAX_MS,
    fileType: 'image/gif',
    extension: '.gif',
    fileDescription: translate('capture_gif_file_description'),
    finishingKey: 'capture_making_gif',
    stop() {
      engine.onEndFrameObservable.remove(observer);
    },
    dispose() {
      engine.onEndFrameObservable.remove(observer);
      frames.length = 0;
    },
    async toBlob() {
      const gif = GIFEncoder();
      for (let i = 0; i < frames.length; i++) {
        const { data, time } = frames[i];
        const next = frames[i + 1]?.time ?? time + GIF_FRAME_MS;
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, {
          palette,
          delay: Math.round(next - time),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      gif.finish();
      return new Blob([gif.bytes()], { type: 'image/gif' });
    },
  };
}

function startVideoCapture(format) {
  const recorder = new VideoRecorder(flock.engine, { mimeType: format.mimeType });
  const recording = recorder.startRecording(null, 0);
  recording.catch(() => {});

  return {
    maxMs: VIDEO_MAX_MS,
    fileType: format.type,
    extension: format.extension,
    fileDescription: translate('capture_video_file_description'),
    finishingKey: 'capture_saving',
    stop() {
      recorder.stopRecording();
    },
    dispose() {
      recorder.stopRecording();
      recorder._mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
      recorder.dispose();
    },
    async toBlob() {
      const blob = await recording;
      return new Blob([blob], { type: format.type });
    },
  };
}

export function initCapturePanel() {
  const panelStatus = document.getElementById('captureStatus');
  const pictureButton = document.getElementById('capturePictureButton');
  const includeEverything = document.getElementById('captureIncludeEverything');
  const gifButton = document.getElementById('captureGifButton');
  const videoButton = document.getElementById('captureVideoButton');
  const videoSection = document.getElementById('captureVideoSection');
  const indicator = document.getElementById('captureIndicator');
  const indicatorStatus = document.getElementById('captureIndicatorStatus');
  const indicatorTime = document.getElementById('captureIndicatorTime');
  const stopButton = document.getElementById('captureStopButton');
  if (!pictureButton || !indicator) return;

  const captureButtons = [pictureButton, gifButton, videoButton];

  function setBusy(busy) {
    captureButtons.forEach((button) => (button.disabled = busy));
  }

  document.addEventListener('toolstabselect', (e) => {
    if (e.detail.tab !== 'toolsCaptureTab') return;
    panelStatus.textContent = '';
    videoSection.hidden = !videoFormat();
    setBusy(Boolean(session));
  });

  async function takePicture(engine, camera) {
    const restore = includeEverything.checked ? () => {} : hideEditorOverlays(camera.getScene());
    try {
      return await CreateScreenshotAsync(engine, camera, { precision: 1 });
    } finally {
      restore();
    }
  }

  pictureButton.addEventListener('click', async () => {
    const camera = flock.scene?.activeCamera;
    if (!flock.engine || !camera) return;
    setBusy(true);
    panelStatus.textContent = '';
    try {
      const dataUrl = await takePicture(flock.engine, camera);
      const blob = dataUrlToBlob(dataUrl);
      const target = await openSaveTarget(
        `${projectName()}.png`,
        'image/png',
        '.png',
        translate('capture_picture_file_description')
      );
      if (target) {
        await target.write(blob);
        panelStatus.textContent = translate('capture_picture_saved');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      panelStatus.textContent = translate('capture_failed');
    } finally {
      setBusy(false);
    }
  });

  function showIndicator(statusKey, buttonKey) {
    indicatorStatus.textContent = translate(statusKey);
    if (buttonKey) stopButton.textContent = translate(buttonKey);
    stopButton.hidden = !buttonKey;
    indicator.classList.toggle('capture-indicator--recording', statusKey === 'capture_recording');
    indicator.hidden = false;
  }

  function endSession(statusKey) {
    clearInterval(session.timer);
    session = null;
    setBusy(false);
    indicatorTime.textContent = '';
    if (!statusKey) {
      indicator.hidden = true;
      return;
    }
    showIndicator(statusKey, null);
    setTimeout(() => {
      if (!session) indicator.hidden = true;
    }, 2000);
  }

  function reachLimit() {
    session.capture.stop();
    session.stopped = true;
    clearInterval(session.timer);
    showIndicator('capture_time_up', 'capture_save_button');
  }

  function startRecording(start) {
    if (session || !flock.engine) return;
    let capture;
    try {
      capture = start();
    } catch (error) {
      console.error('Error starting recording:', error);
      panelStatus.textContent = translate('capture_failed');
      return;
    }
    const startTime = performance.now();
    session = { capture, stopped: false };
    session.timer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      indicatorTime.textContent = formatTime(elapsed);
      if (elapsed >= capture.maxMs) reachLimit();
    }, 250);
    setBusy(true);
    indicatorTime.textContent = formatTime(0);
    showIndicator('capture_recording', 'capture_stop_button');
    document.dispatchEvent(new CustomEvent('toolspanelclose'));
  }

  gifButton.addEventListener('click', () => startRecording(startGifCapture));
  videoButton.addEventListener('click', () => {
    const format = videoFormat();
    if (format) startRecording(() => startVideoCapture(format));
  });

  stopButton.addEventListener('click', async () => {
    if (!session) return;
    const { capture } = session;
    if (!session.stopped) {
      capture.stop();
      session.stopped = true;
      clearInterval(session.timer);
    }
    stopButton.hidden = true;
    try {
      const target = await openSaveTarget(
        `${projectName()}${capture.extension}`,
        capture.fileType,
        capture.extension,
        capture.fileDescription
      );
      if (!target) {
        endSession(null);
        return;
      }
      showIndicator(capture.finishingKey, null);
      await target.write(await capture.toBlob());
      endSession('capture_saved');
    } catch (error) {
      console.error('Error saving recording:', error);
      endSession('capture_failed');
    } finally {
      capture.dispose();
    }
  });
}
