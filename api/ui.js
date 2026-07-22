import { getBoundKeys } from '../input/bindings.js';
import { JoystickSource } from '../input/joystickSource.js';
import {
  registerUIButton,
  registerUISlider,
  registerUIInput,
  registerUIText,
  unregisterUIControl,
} from '../accessibility/uiA11y.js';
import { setInteractIndicatorEnabled } from '../ui/interactIndicator.js';

let flock;
//let fontFamily = "Asap";
let fontFamily = 'Atkinson Hyperlegible Next';

// Canvas-painted GUI text can't inherit the browser's font-size preferences,
// so approximate them from the root font-size. baseCssPx is the size at a 16px
// root.
function uiFontSizePx(baseCssPx = 16) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  let rootPx = 16;
  try {
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (Number.isFinite(px) && px > 0) rootPx = px;
  } catch {
    /* non-DOM env (e.g. tests) — fall back to the 16px default */
  }
  // Clamped to 1×–2×: small preferences must not shrink captions, extreme ones
  // must not blow out the layout.
  const prefScale = Math.min(2, Math.max(1, rootPx / 16));
  return Math.round(baseCssPx * prefScale * dpr);
}

export function setFlockReference(ref) {
  flock = ref;
}

export const flockUI = {
  UIText({
    text,
    x,
    y,
    fontSize,
    color,
    backgroundColor = '#ffffff',
    alpha = 1,
    duration,
    id = null,
  } = {}) {
    if (!flock.scene || !flock.GUI) return;

    flock.scene.UITexture ??= flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'UI',
      true,
      flock.scene,
      window.devicePixelRatio || 1
    );

    const textBlockId = id || `textBlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const bgId = `${textBlockId}_bg`;

    const resolvedX = Number(x || 0);
    const resolvedY = Number(y || 0);
    const resolvedAlpha = isFinite(Number(alpha)) ? Math.min(Math.max(Number(alpha), 0), 1) : 1;
    const paddingH = 12 * flock.displayScale;
    const paddingV = 6 * flock.displayScale;

    let bg = flock.scene.UITexture.getControlByName(bgId);
    let textBlock = flock.scene.UITexture.getControlByName(textBlockId);

    if (!bg) {
      bg = new flock.GUI.Rectangle(bgId);
      bg.thickness = 0;
      bg.cornerRadius = 4;
      bg.adaptWidthToChildren = true;
      bg.adaptHeightToChildren = true;
      bg.isPointerBlocker = false;
      flock.scene.UITexture.addControl(bg);

      textBlock = new flock.GUI.TextBlock(textBlockId);
      textBlock.name = textBlockId;
      textBlock.resizeToFit = true;
      textBlock.forceResizeWidth = true;
      textBlock.paddingLeft = `${paddingH}px`;
      textBlock.paddingRight = `${paddingH}px`;
      textBlock.paddingTop = `${paddingV}px`;
      textBlock.paddingBottom = `${paddingV}px`;
      bg.addControl(textBlock);

      textBlock.textWrapping = false;
      textBlock.isPointerBlocker = false;
      textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

      // Hiding/showing the text block (e.g. via flock.hide/flock.show, which
      // look up the control by textBlockId) should hide/show its background too.
      textBlock.onIsVisibleChangedObservable.add((visible) => {
        bg.isVisible = visible;
      });
    }

    bg.background = flock.hexToRgba(backgroundColor || '#ffffff', resolvedAlpha);

    textBlock.text = text;
    textBlock.color = color || 'white';
    textBlock.isVisible = true;

    const px = Number(fontSize || 24) * flock.displayScale;
    textBlock.fontSize = px;
    const linePx = Math.max(1, Math.round(px * 1.2));
    textBlock.lineHeight = `${linePx}px`;
    textBlock.height = `${Math.max(linePx, px + 4) + paddingV * 2}px`;

    bg.left = `${resolvedX}px`;
    bg.top = `${resolvedY}px`;

    bg.horizontalAlignment =
      resolvedX < 0
        ? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        : flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    bg.verticalAlignment =
      resolvedY < 0
        ? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        : flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    if (document.fonts && document.fonts.status !== 'loaded') {
      bg.alpha = 0;
      document.fonts.ready.then(() => {
        if (!bg.isDisposed) {
          bg._markAsDirty();
          bg.alpha = 1;
        }
      });
    } else {
      Promise.resolve().then(() => bg._markAsDirty());
    }

    registerUIText(textBlockId, textBlock.text, {
      x: resolvedX,
      y: resolvedY,
      w: 200,
      h: Math.max(linePx, px + 4) + paddingV * 2,
    });

    if (duration > 0) {
      setTimeout(() => {
        const ctl = flock.scene.UITexture.getControlByName(bgId);
        if (ctl) {
          ctl.dispose();
        }
        unregisterUIControl(textBlockId);
      }, duration * 1000);
    }

    return textBlockId;
  },
  UIButton({ text, x, y, width, textSize, textColor, backgroundColor, buttonId } = {}) {
    if (!flock.scene || !flock.GUI) {
      throw new Error('flock.scene or flock.GUI is not initialized.');
    }

    flock.scene.UITexture ??= flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'UI',
      true,
      flock.scene,
      window.devicePixelRatio || 1
    );

    if (!buttonId || typeof buttonId !== 'string') {
      throw new Error('buttonId must be a valid non-empty string.');
    }

    const existing = flock.scene.UITexture.getControlByName(buttonId);
    if (existing) {
      existing.dispose();
    }

    const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);

    const buttonSizes = {
      SMALL: { width: '100px', height: '40px' },
      MEDIUM: { width: '150px', height: '50px' },
      LARGE: { width: '200px', height: '60px' },
    };

    if (typeof width !== 'string') {
      throw new Error("Invalid button size. Use 'SMALL', 'MEDIUM', or 'LARGE'.");
    }

    const size = buttonSizes[width.toUpperCase()] || buttonSizes['SMALL'];
    const scaledWidth = Math.round(parseInt(size.width) * flock.displayScale);
    const scaledHeight = Math.round(parseInt(size.height) * flock.displayScale);
    button.width = `${scaledWidth}px`;
    button.height = `${scaledHeight}px`;

    if (button.textBlock) {
      button.textBlock.textWrapping = true;
      button.textBlock.resizeToFit = true;
      const parsedSize = parseInt(textSize) || 20;
      const scaledSize = Math.round(parsedSize * flock.displayScale);
      button.textBlock.fontSize = scaledSize;
    }

    button.color = textColor || 'white';
    button.background = backgroundColor || 'blue';

    button.left = `${x}px`;
    button.top = `${y}px`;

    button.horizontalAlignment =
      x < 0
        ? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        : flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    button.verticalAlignment =
      y < 0
        ? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        : flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    flock.scene.UITexture.addControl(button);

    registerUIButton(buttonId, text, button, {
      x,
      y,
      w: parseInt(size.width),
      h: parseInt(size.height),
    });

    return buttonId;
  },
  async UIInput({
    text,
    x,
    y,
    size,
    fontSize,
    textColor,
    backgroundColor,
    id = null,
    mode = 'AWAIT',
  } = {}) {
    if (!flock.scene || !flock.GUI) {
      throw new Error('flock.scene or flock.GUI is not initialized.');
    }
    flock.scene.UITexture ??= flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'UI',
      true,
      flock.scene,
      window.devicePixelRatio || 1
    );

    const sanitize = (val, { maxLen = 500 } = {}) => {
      if (val == null) return '';
      let s = String(val);
      s = s.normalize('NFKC');
      const doc = new DOMParser().parseFromString(s, 'text/html');
      s = doc.body.textContent || '';
      s = s.replace(/\p{Cc}/gu, '');
      s = s.replace(/\s+/g, ' ').trim();
      if (s.length > maxLen) s = s.slice(0, maxLen);
      return s;
    };

    const inputId = id
      ? sanitize(id, { maxLen: 100 })
      : `input_${Date.now()}_${crypto.randomUUID()}`;
    const submitId = `submit_${inputId}`;

    const existingInput = flock.scene.UITexture.getControlByName(inputId);
    const existingSubmit = flock.scene.UITexture.getControlByName(submitId);
    if (existingInput) existingInput.dispose();
    if (existingSubmit) existingSubmit.dispose();

    const sizeMap = {
      SMALL: { width: '200px', height: '40px' },
      MEDIUM: { width: '300px', height: '50px' },
      LARGE: { width: '400px', height: '60px' },
    };
    const resolvedSize = sizeMap[(size || '').toUpperCase()] || sizeMap['MEDIUM'];
    const scaledInputWidth = Math.round(parseInt(resolvedSize.width) * flock.displayScale);
    const scaledInputHeight = Math.round(parseInt(resolvedSize.height) * flock.displayScale);
    const buttonWidth = Math.round(50 * flock.displayScale);
    const spacing = Math.round(10 * flock.displayScale);

    const input = new flock.GUI.InputText(inputId);
    input.placeholderText = sanitize(text);
    input.width = `${scaledInputWidth}px`;
    input.height = `${scaledInputHeight}px`;
    input.color = textColor || 'black';
    input.background = backgroundColor || 'white';
    input.focusedBackground = backgroundColor || 'white';
    input.fontSize = Math.round((fontSize || 24) * flock.displayScale);
    input.text = '';

    input.left = `${x}px`;
    input.top = `${y}px`;
    input.horizontalAlignment =
      x < 0
        ? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        : flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    input.verticalAlignment =
      y < 0
        ? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        : flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    const button = flock.GUI.Button.CreateSimpleButton(submitId, '✓');
    button.width = `${buttonWidth}px`;
    button.height = `${scaledInputHeight}px`;
    button.color = backgroundColor || 'gray';
    button.background = textColor || 'white';
    button.fontSize = Math.round((fontSize || 24) * flock.displayScale);

    const offset = scaledInputWidth + spacing;
    button.left = x < 0 ? `${x - offset}px` : `${x + offset}px`;
    button.top = `${y}px`;
    button.horizontalAlignment = input.horizontalAlignment;
    button.verticalAlignment = input.verticalAlignment;

    flock.scene.UITexture.addControl(input);
    flock.scene.UITexture.addControl(button);

    const submitX = x < 0 ? x - (scaledInputWidth + spacing) : x + (scaledInputWidth + spacing);
    registerUIInput(
      inputId,
      submitId,
      input,
      button,
      { x, y, w: scaledInputWidth, h: scaledInputHeight },
      { x: submitX, y, w: buttonWidth, h: scaledInputHeight }
    );

    if (mode === 'START') {
      return inputId;
    }

    return new Promise((resolve) => {
      const submit = () => {
        const cleanValue = sanitize(input.text);
        input.dispose();
        button.dispose();
        resolve(cleanValue);
      };
      button.onPointerUpObservable.add(submit);
      input.onKeyboardEventProcessedObservable.add((event) => {
        if (event.type === 'keydown' && event.key === 'Enter') {
          submit();
        }
      });
    });
  },
  UISlider({ id, min, max, value, x, y, size, textColor, backgroundColor } = {}) {
    if (!flock.scene || !flock.GUI) {
      throw new Error('flock.scene or flock.GUI is not initialized.');
    }

    if (!flock.scene.UITexture) {
      flock.scene.UITexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        'UI',
        true,
        flock.scene
      );
    }

    const existing = flock.scene.UITexture.getControlByName(id);
    if (existing) existing.dispose();

    const sliderSizes = {
      SMALL: { width: '100px', height: '20px' },
      MEDIUM: { width: '200px', height: '30px' },
      LARGE: { width: '300px', height: '40px' },
    };

    const resolvedSize = sliderSizes[(size || 'MEDIUM').toUpperCase()] || sliderSizes.MEDIUM;

    const slider = new flock.GUI.Slider(id);
    slider.minimum = min;
    slider.maximum = max;
    slider.value = value;

    slider.thickness = 0;
    slider.borderColor = 'transparent';

    slider.isPointerBlocker = true;
    slider.thumbWidth = '20px';
    slider.isFocusLinker = true;

    slider.color = textColor || '#000000'; // Color of the "filled" part and thumb
    slider.background = backgroundColor || '#ffffff'; // Color of the "empty" track
    slider.height = resolvedSize.height;
    slider.width = resolvedSize.width;

    slider.left = `${x}px`;
    slider.top = `${y}px`;
    slider.horizontalAlignment =
      x < 0
        ? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        : flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    slider.verticalAlignment =
      y < 0
        ? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        : flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    slider.zIndex = 1000;

    flock.scene.UITexture.addControl(slider);

    registerUISlider(id, slider, {
      x,
      y,
      w: parseInt(resolvedSize.width),
      h: parseInt(resolvedSize.height),
    });

    return slider;
  },
  createSmallButton(text, keys, color) {
    if (!flock.controlsTexture) return;

    const keyList = Array.isArray(keys) ? keys : [keys];
    const uniqueKeys = Array.from(new Set(keyList.filter((k) => k != null && k !== '')));

    const buttonId = `small-${text}-${Math.random().toString(36).slice(2)}`;
    const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);

    const size = 70 * flock.displayScale;
    button.width = `${size}px`;
    button.height = `${size}px`;
    button.color = color;
    button.background = 'transparent';
    button.fontSize = `${40 * flock.displayScale}px`;
    button.fontFamily = fontFamily;

    const releaseKeys = () => {
      uniqueKeys.forEach((key) => {
        flock._onScreenSource.release(key);
      });
    };

    let isPointerTouch = false;

    button.onPointerDownObservable.add((info) => {
      isPointerTouch = info.pointerType === 'touch';
      uniqueKeys.forEach((key) => {
        flock._onScreenSource.press(key);
      });
    });

    // Release on pointer up
    button.onPointerUpObservable.add(releaseKeys);
    // For touch only: also release if finger slides out of button area
    button.onPointerOutObservable.add(() => {
      if (isPointerTouch) {
        releaseKeys();
      }
    });

    return button;
  },
  createArrowControls(color) {
    if (!flock.controlsTexture) return;

    const grid = new flock.GUI.Grid();
    grid.width = `${240 * flock.displayScale}px`;
    grid.height = `${160 * flock.displayScale}px`;
    grid.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    grid.addRowDefinition(1);
    grid.addRowDefinition(1);
    grid.addColumnDefinition(1);
    grid.addColumnDefinition(1);
    grid.addColumnDefinition(1);

    flock.controlsTexture.addControl(grid);

    const upButton = flock.createSmallButton('△', ['w', 'ArrowUp'], color);
    const downButton = flock.createSmallButton('▽', ['s', 'ArrowDown'], color);
    const leftButton = flock.createSmallButton('◁', ['a', 'ArrowLeft'], color);
    const rightButton = flock.createSmallButton('▷', ['d', 'ArrowRight'], color);

    grid.addControl(upButton, 0, 1);
    grid.addControl(leftButton, 1, 0);
    grid.addControl(downButton, 1, 1);
    grid.addControl(rightButton, 1, 2);
  },
  createButtonControls(color) {
    if (!flock.controlsTexture) return;

    const rightGrid = new flock.GUI.Grid();
    rightGrid.width = `${160 * flock.displayScale}px`;
    rightGrid.height = `${160 * flock.displayScale}px`;
    rightGrid.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightGrid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rightGrid.addRowDefinition(1);
    rightGrid.addRowDefinition(1);
    rightGrid.addColumnDefinition(1);
    rightGrid.addColumnDefinition(1);

    flock.controlsTexture.addControl(rightGrid);

    const button1 = flock.createSmallButton('①', [...getBoundKeys('BUTTON1'), 'PageUp'], color);
    const button2 = flock.createSmallButton('②', getBoundKeys('BUTTON2'), color);
    const button3 = flock.createSmallButton('③', [...getBoundKeys('BUTTON3'), 'PageDown'], color);
    const button4 = flock.createSmallButton('④', getBoundKeys('BUTTON4'), color);

    rightGrid.addControl(button1, 0, 0);
    rightGrid.addControl(button2, 0, 1);
    rightGrid.addControl(button3, 1, 0);
    rightGrid.addControl(button4, 1, 1);
  },
  buttonControls(control = 'BOTH', mode = 'AUTO', color = '#ffffff') {
    // Check if touch is available
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    const shouldShow = mode === 'ENABLED' || (mode === 'AUTO' && isTouchDevice);

    if (!shouldShow) {
      if (flock.controlsTexture) {
        flock.controlsTexture.dispose();
        flock.controlsTexture = null;
      }
      return;
    }

    // Clean restart
    if (flock.controlsTexture) flock.controlsTexture.dispose();

    // Attach to the scene so it receives input
    flock.controlsTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'VirtualControls',
      true,
      flock.scene
    );

    if (control === 'ARROWS' || control === 'BOTH') flock.createArrowControls(color);
    if (control === 'ACTIONS' || control === 'BOTH') flock.createButtonControls(color);
  },
  createJoystickControls(color) {
    if (!flock.controlsTexture) return;

    const baseRadius = 55 * flock.displayScale;
    const thumbRadius = 30 * flock.displayScale;

    const base = new flock.GUI.Ellipse();
    base.width = `${baseRadius * 2}px`;
    base.height = `${baseRadius * 2}px`;
    base.color = color;
    base.thickness = 3 * flock.displayScale;
    base.background = 'transparent';
    base.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    base.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

    const thumb = new flock.GUI.Ellipse();
    thumb.width = `${thumbRadius * 2}px`;
    thumb.height = `${thumbRadius * 2}px`;
    thumb.color = color;
    thumb.background = color;
    thumb.thickness = 0;

    base.addControl(thumb);
    flock.controlsTexture.addControl(base);

    return new JoystickSource(flock.inputManager, flock._onScreenSource, {
      canvas: flock.canvas,
      baseEllipse: base,
      thumbEllipse: thumb,
      baseRadius,
      thumbRadius,
      scene: flock.scene,
    });
  },
  onScreenControls(movement = 'ARROWS', actions = 'YES', mode = 'AUTO', color = '#ffffff') {
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    const shouldShow = mode === 'ENABLED' || (mode === 'AUTO' && isTouchDevice);

    if (flock._joystickSource) {
      flock._joystickSource.stop();
      flock._joystickSource = null;
    }

    if (!shouldShow) {
      if (flock.controlsTexture) {
        flock.controlsTexture.dispose();
        flock.controlsTexture = null;
      }
      return;
    }

    if (flock.controlsTexture) flock.controlsTexture.dispose();

    flock.controlsTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'VirtualControls',
      true,
      flock.scene
    );

    if (movement === 'ARROWS') {
      flock.createArrowControls(color);
    } else if (movement === 'JOYSTICK') {
      flock._joystickSource = flock.createJoystickControls(color);
      flock._joystickSource?.start();
    }

    if (actions === 'YES') flock.createButtonControls(color);

    window.__flockSizeDebug?.sample('controls-created');
  },
  canvasControls(setting) {
    flock._canvasControlsEnabled = !!setting;
    if (setting) {
      flock.scene.activeCamera.attachControl(flock.canvas, false);
    } else {
      flock.scene.activeCamera.detachControl();
    }
  },
  interactIndicator(setting) {
    setInteractIndicatorEnabled(!!setting);
  },
  say(meshName, options = {}) {
    let {
      text,
      duration,
      textColor = '#ffffff',
      backgroundColor = '#000000',
      alpha = 1,
      size = 24,
      mode = 'ADD',
    } = options;

    // Validate duration
    duration = isFinite(Number(duration)) && Number(duration) >= 0 ? Number(duration) : 0;
    // Validate alpha
    alpha = isFinite(Number(alpha)) ? Math.min(Math.max(Number(alpha), 0), 1) : 0.7;
    // Validate size
    size = isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 16;

    if (!flock.scene) {
      console.error('Scene is not available.');
      return Promise.reject('Scene is not available.');
    }

    const mesh = flock.scene.getMeshByName(meshName);

    if (mesh) {
      return handleMesh(mesh);
    } else {
      return new Promise((resolve, reject) => {
        flock.whenModelReady(meshName, function (readyMesh) {
          if (readyMesh) {
            handleMesh(readyMesh).then(resolve).catch(reject);
          } else {
            console.error('Mesh is not defined.');
            reject('Mesh is not defined.');
          }
        });
      });
    }

    function handleMesh(targetMesh) {
      return new Promise((resolve) => {
        let plane;
        let background = 'transparent';

        if (targetMesh.metadata && targetMesh.metadata.shape == 'plane') {
          plane = targetMesh;
          background = plane.material.diffuseColor.toHexString();
          plane.material.needDepthPrePass = true;
          plane.metadata = {
            ...(plane.metadata || {}),
            hasSayTexture: true,
            originalPlaneColor: plane.material?.diffuseColor?.toHexString?.() || '#ffffff',
          };
        } else {
          plane = targetMesh.getDescendants().find((child) => child.name === 'textPlane');
        }

        if (!plane) {
          plane = flock.BABYLON.MeshBuilder.CreatePlane(
            'textPlane',
            { width: 4, height: 4 },
            flock.scene
          );
          plane.name = 'textPlane';
          plane.parent = targetMesh;
          plane.metadata = {
            ...(plane.metadata || {}),
            isTextPlane: true,
          };
          plane.checkCollisions = false;
          plane.isPickable = false;
          plane.billboardMode = flock.BABYLON.Mesh.BILLBOARDMODE_ALL;

          // FIX: Cleanup observer to prevent memory leak
          const observer = flock.scene.onBeforeRenderObservable.add(() => {
            if (targetMesh.isDisposed()) {
              flock.scene.onBeforeRenderObservable.remove(observer);
              plane.dispose();
              return;
            }
            const boundingInfo = targetMesh.getBoundingInfo();
            const parentScale = targetMesh.scaling;
            plane.scaling.set(1 / parentScale.x, 1 / parentScale.y, 1 / parentScale.z);
            plane.position.y = boundingInfo.boundingBox.maximum.y + 2.1 / parentScale.y;
          });

          plane.onDisposeObservable.add(() => {
            flock.scene.onBeforeRenderObservable.remove(observer);
          });
        }

        let advancedTexture;
        if (!plane.advancedTexture) {
          const planeBoundingInfo = plane.getBoundingInfo();
          const planeWidth = planeBoundingInfo.boundingBox.extendSize.x * 2;
          const planeHeight = planeBoundingInfo.boundingBox.extendSize.y * 2;
          const aspectRatio = planeWidth / planeHeight;
          const baseResolution = 1024;
          const textureWidth = baseResolution * (aspectRatio > 1 ? 1 : aspectRatio);
          const textureHeight = baseResolution * (aspectRatio > 1 ? 1 / aspectRatio : 1);

          advancedTexture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(
            plane,
            textureWidth,
            textureHeight
          );
          advancedTexture.isTransparent = true;
          plane.advancedTexture = advancedTexture;

          if (targetMesh.metadata && targetMesh.metadata.shape == 'plane') {
            let fullScreenRect = new flock.GUI.Rectangle();
            fullScreenRect.width = '100%';
            fullScreenRect.height = '100%';
            fullScreenRect.background = background;
            fullScreenRect.color = 'transparent';
            advancedTexture.addControl(fullScreenRect);
          }

          const stackPanel = new flock.GUI.StackPanel('stackPanel');
          stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
          stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
          stackPanel.isVertical = true;
          stackPanel.width = '100%';
          stackPanel.adaptHeightToChildren = true;
          stackPanel.resizeToFit = true;
          stackPanel.forceResizeWidth = true;
          stackPanel.forceResizeHeight = true;
          stackPanel.spacing = 4;
          advancedTexture.addControl(stackPanel);
        } else {
          advancedTexture = plane.advancedTexture;
        }

        const stackPanel = advancedTexture.getControlByName('stackPanel');
        if (mode === 'REPLACE') {
          stackPanel.clearControls();
        }

        if (text) {
          const bg = new flock.GUI.Rectangle('textBackground');
          bg.background = flock.hexToRgba(backgroundColor, alpha);
          bg.adaptWidthToChildren = true;
          bg.adaptHeightToChildren = true;
          bg.cornerRadius = 30;
          bg.thickness = 0;
          bg.resizeToFit = true;
          bg.forceResizeWidth = true;
          bg.checkCollisions = false;
          bg.isPickable = false;
          stackPanel.addControl(bg);

          const scale = 8;
          const textBlock = new flock.GUI.TextBlock();
          textBlock.text = String(text);
          textBlock.color = textColor;
          textBlock.fontSize = size * scale;
          textBlock.fontFamily = fontFamily;
          textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
          textBlock.resizeToFit = true;
          textBlock.forceResizeWidth = true;
          textBlock.paddingLeft = 50;
          textBlock.paddingRight = 50;
          textBlock.paddingTop = 20;
          textBlock.paddingBottom = 20;
          textBlock.textVerticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
          textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
          bg.addControl(textBlock);

          if (duration > 0) {
            const timeoutId = setTimeout(() => {
              stackPanel.removeControl(bg);
              bg.dispose();
              textBlock.dispose();
              resolve();
            }, duration * 1000);

            flock.abortController.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId);
                bg.dispose();
                textBlock.dispose();
                resolve(new Error('Action aborted'));
              },
              { once: true }
            );
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    }
  },
  printText({ text, duration = 30, color = 'white' } = {}) {
    console.log(text);

    if (!flock.scene || !flock.stackPanel) return;

    const safeDuration = isFinite(Number(duration)) && Number(duration) >= 0 ? Number(duration) : 0;

    try {
      const bg = new flock.GUI.Rectangle('textBackground');
      bg.background = 'rgba(255, 255, 255, 0.5)';
      bg.adaptWidthToChildren = true;
      bg.adaptHeightToChildren = true;
      bg.cornerRadius = 2;
      bg.thickness = 0;
      bg.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      bg.left = '5px';
      bg.top = '5px';

      const textBlock = new flock.GUI.TextBlock('textBlock', text);
      const fontSize = uiFontSizePx(16);
      textBlock.color = color;
      textBlock.fontSize = fontSize;
      textBlock.fontFamily = fontFamily;
      textBlock.height = `${Math.round(fontSize * 1.6)}px`;
      textBlock.paddingLeft = '10px';
      textBlock.paddingRight = '10px';
      textBlock.paddingTop = '2px';
      textBlock.paddingBottom = '2px';
      textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
      textBlock.resizeToFit = true;
      textBlock.forceResizeWidth = true;

      bg.addControl(textBlock);
      flock.stackPanel.addControl(bg);

      const fadeOut = () => {
        const anim = new flock.BABYLON.Animation(
          'fadeOut',
          'alpha',
          30,
          flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT,
          flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        anim.setKeys([
          { frame: 0, value: 1 },
          { frame: 30, value: 0 },
        ]);

        bg.animations = [];
        bg.animations.push(anim);

        flock.scene.beginAnimation(bg, 0, 30, false, 1.0, () => {
          flock.stackPanel.removeControl(bg);
          bg.dispose();
        });
      };

      let timeoutId = null;
      if (safeDuration > 0) {
        timeoutId = setTimeout(fadeOut, safeDuration * 1000);
      }

      flock.abortController.signal.addEventListener(
        'abort',
        () => {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          if (flock.stackPanel) {
            flock.stackPanel.removeControl(bg);
            bg.dispose();
          }
        },
        { once: true }
      );
    } catch (error) {
      console.warn('Unable to print text:', error);
    }
  },

  clearText() {
    if (!flock.stackPanel) return;
    const toRemove = flock.stackPanel.children.filter((c) => c.name === 'textBackground');
    for (const bg of toRemove) {
      flock.stackPanel.removeControl(bg);
      bg.dispose();
    }
  },

  enableSubtitles({ enabled = true } = {}) {
    flock.subtitlesEnabled = !!enabled;
    // Turning subtitles off should also clear anything currently on screen.
    if (!enabled) flock.clearSubtitle();
  },

  // duration: seconds before the caption auto-clears; 0 keeps it until the next
  // subtitle replaces it (or the run ends), like printText.
  showSubtitle(text, duration = 0) {
    if (!flock.scene || !flock.advancedTexture) return;
    if (!text || !String(text).trim()) return;

    // Only ever one subtitle on screen at a time.
    flock.clearSubtitle();

    try {
      const fontSize = uiFontSizePx(16);
      const hPad = 24; // per-line box: paddingLeft + paddingRight on the text

      // Width budget for the caption block, measured against the subtitle's own
      // ADT so units match the px sizes used here and by the controls.
      const screenWidth = flock.advancedTexture.getSize?.().width ?? 0;
      // Cap to a comfortable subtitle reading length (~32 chars at this font);
      // on wide screens an 80%-width line is far too long.
      const maxWidth = 320 * flock.displayScale;
      let captionWidth = screenWidth > 0 ? Math.min(0.8 * screenWidth, maxWidth) : maxWidth;

      // Position relative to the on-screen touch controls when they're visible.
      // They sit in the bottom corners: arrows/joystick (~240px) bottom-left and
      // action buttons (~160px) bottom-right, scaled by displayScale. If the gap
      // between them is at least a third of the screen width, drop the caption
      // into that gap; otherwise lift it clear above the whole control band.
      let leftOffset = 0;
      let bottomMargin = 20 * flock.displayScale;
      if (flock.controlsTexture) {
        const leftReserve = 240 * flock.displayScale; // arrows / joystick
        const rightReserve = 160 * flock.displayScale; // action buttons
        const gap = screenWidth - leftReserve - rightReserve;
        if (screenWidth > 0 && gap >= screenWidth / 3) {
          captionWidth = Math.min(gap, maxWidth);
          // Centre the block within the gap (shift toward the narrower right).
          leftOffset = Math.round((leftReserve - rightReserve) / 2);
        } else {
          bottomMargin = 180 * flock.displayScale;
        }
      }

      // Measure with the ADT's own 2D context (the canvas Babylon renders text
      // into, where the subtitle font is active) so wrapping matches the GUI.
      const measureCtx = flock.advancedTexture.getContext?.();
      const measure = (s) => {
        if (!measureCtx) return s.length * fontSize * 0.6;
        measureCtx.font = `${fontSize}px ${fontFamily}`;
        return measureCtx.measureText(s).width;
      };

      // Greedy word-wrap into lines that fit the caption width.
      const maxTextWidth = Math.max(40, captionWidth - hPad);
      const words = String(text).split(/\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      for (const word of words) {
        const trial = current ? `${current} ${word}` : word;
        if (!current || measure(trial) <= maxTextWidth) {
          current = trial;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
      if (lines.length === 0) return;

      // One hugging background box per line (YouTube-style), stacked and
      // left-aligned within a bottom-anchored panel that is centred in the gap.
      let blockWidth = 0;
      const lineWidths = lines.map((line) => {
        const w = Math.min(Math.round(measure(line) + hPad), Math.round(captionWidth));
        if (w > blockWidth) blockWidth = w;
        return w;
      });

      const panel = new flock.GUI.StackPanel('subtitlePanel');
      panel.isVertical = true;
      panel.width = `${blockWidth}px`;
      panel.spacing = 0; // lines abut so the boxes read as one continuous block
      panel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      panel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      panel.left = `${leftOffset}px`;
      panel.top = `-${bottomMargin}px`;

      lines.forEach((line, i) => {
        const box = new flock.GUI.Rectangle('subtitleLine');
        box.background = 'rgba(0, 0, 0, 0.6)';
        box.adaptWidthToChildren = true;
        box.adaptHeightToChildren = true;
        // Square corners so stacked line boxes merge with no seam/notch gap.
        box.cornerRadius = 0;
        box.thickness = 0;
        // Left-align each line box to share a common left edge.
        box.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

        const tb = new flock.GUI.TextBlock('subtitleLineText', line);
        tb.color = 'white';
        tb.fontSize = fontSize;
        tb.fontFamily = fontFamily;
        tb.paddingLeft = '12px';
        tb.paddingRight = '12px';
        tb.paddingTop = '4px';
        tb.paddingBottom = '4px';
        tb.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tb.resizeToFit = true;
        tb.width = `${lineWidths[i]}px`;

        box.addControl(tb);
        panel.addControl(box);
      });

      flock.advancedTexture.addControl(panel);
      flock._subtitleControl = panel;

      // Token identifies this particular caption so a delayed clear (duration
      // timer, speech end, abort) only removes the subtitle it was scheduled
      // for — never a newer one that has since replaced it.
      const token = (flock._subtitleToken || 0) + 1;
      flock._subtitleToken = token;

      const seconds = Number(duration);
      if (isFinite(seconds) && seconds > 0) {
        flock._subtitleTimer = setTimeout(() => {
          if (flock._subtitleToken === token) flock.clearSubtitle();
        }, seconds * 1000);
      }

      // Clear on run abort so a stale caption never lingers between runs.
      flock.abortController?.signal.addEventListener('abort', () => flock.clearSubtitle(), {
        once: true,
      });
    } catch (error) {
      console.warn('Unable to show subtitle:', error);
    }
  },

  clearSubtitle() {
    if (flock._subtitleTimer) {
      clearTimeout(flock._subtitleTimer);
      flock._subtitleTimer = null;
    }
    if (!flock._subtitleControl) return;
    flock.advancedTexture?.removeControl(flock._subtitleControl);
    flock._subtitleControl.dispose();
    flock._subtitleControl = null;
  },
};
