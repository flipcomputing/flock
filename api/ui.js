let flock;
//let fontFamily = "Asap";
let fontFamily = "Atkinson Hyperlegible Next";

export function setFlockReference(ref) {
  flock = ref;
}

export const flockUI = {
  UIText({ text, x, y, fontSize, color, duration, id = null } = {}) {
    if (!flock.scene || !flock.GUI) return;

    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    const textBlockId =
      id ||
      `textBlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const maxWidth = flock.scene.getEngine().getRenderWidth();
    const maxHeight = flock.scene.getEngine().getRenderHeight();
    const adjustedX = x < 0 ? maxWidth + x : x;
    const adjustedY = y < 0 ? maxHeight + y : y;

    let textBlock = flock.scene.UITexture.getControlByName(textBlockId);

    if (!textBlock) {
      textBlock = new flock.GUI.TextBlock(textBlockId);
      textBlock.name = textBlockId;
      flock.scene.UITexture.addControl(textBlock);

      textBlock.horizontalAlignment =
        flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      textBlock.textWrapping = false;
      textBlock.isPointerBlocker = false;
      textBlock.textHorizontalAlignment =
        flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment =
        flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    }

    textBlock.text = text;
    textBlock.color = color || "white";
    textBlock.isVisible = true;

    const px = Number(fontSize || 24);
    textBlock.fontSize = px;
    const linePx = Math.max(1, Math.round(px * 1.2));
    textBlock.lineHeight = `${linePx}px`;
    textBlock.height = `${Math.max(linePx, px + 4)}px`;

    textBlock.left = adjustedX;
    textBlock.top = adjustedY;

    if (document.fonts && document.fonts.status !== "loaded") {
      textBlock.alpha = 0;
      document.fonts.ready.then(() => {
        if (!textBlock.isDisposed) {
          textBlock._markAsDirty();
          textBlock.alpha = 1;
        }
      });
    } else {
      Promise.resolve().then(() => textBlock._markAsDirty());
    }

    if (duration > 0) {
      setTimeout(() => {
        const ctl = flock.scene.UITexture.getControlByName(textBlockId);
        if (ctl) {
          ctl.dispose();
        }
      }, duration * 1000);
    }

    return textBlockId;
  },
  UIButton({
    text,
    x,
    y,
    width,
    textSize,
    textColor,
    backgroundColor,
    buttonId,
  } = {}) {
    if (!flock.scene || !flock.GUI) {
      throw new Error("flock.scene or flock.GUI is not initialized.");
    }

    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    if (!buttonId || typeof buttonId !== "string") {
      throw new Error("buttonId must be a valid non-empty string.");
    }

    const existing = flock.scene.UITexture.getControlByName(buttonId);
    if (existing) {
      existing.dispose();
    }

    const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);

    const buttonSizes = {
      SMALL: { width: "100px", height: "40px" },
      MEDIUM: { width: "150px", height: "50px" },
      LARGE: { width: "200px", height: "60px" },
    };

    if (typeof width !== "string") {
      throw new Error(
        "Invalid button size. Use 'SMALL', 'MEDIUM', or 'LARGE'.",
      );
    }

    const size = buttonSizes[width.toUpperCase()] || buttonSizes["SMALL"];
    button.width = size.width;
    button.height = size.height;

    if (button.textBlock) {
      button.textBlock.textWrapping = true;
      button.textBlock.resizeToFit = true;
      button.textBlock.fontSize = textSize ? `${textSize}px` : "16px";
    }

    button.color = textColor || "white";
    button.background = backgroundColor || "blue";

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
    mode = "AWAIT", // "START" or "AWAIT"
  } = {}) {
    if (!flock.scene || !flock.GUI) {
      throw new Error("flock.scene or flock.GUI is not initialized.");
    }

    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    const inputId =
      id || `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const submitId = `submit_${inputId}`;

    // Sanitization Helper
    const sanitize = (val) => {
      if (typeof val !== "string") return "";
      return val
        .replace(/<[^>]*>?/gm, "") // Remove HTML tags
        .replace(
          /[^\w\s\?\.\,\!\@\#\$\%\^\&\*\(\)\-\+\=\[\]\{\}\:\;\x22\x27\/]/gi,
          "",
        ) // Basic char filter
        .trim();
    };

    // Cleanup existing controls with same ID
    const existingInput = flock.scene.UITexture.getControlByName(inputId);
    const existingSubmit = flock.scene.UITexture.getControlByName(submitId);
    if (existingInput) existingInput.dispose();
    if (existingSubmit) existingSubmit.dispose();

    const sizeMap = {
      SMALL: { width: "200px", height: "40px" },
      MEDIUM: { width: "300px", height: "50px" },
      LARGE: { width: "400px", height: "60px" },
    };

    const resolvedSize =
      sizeMap[(size || "").toUpperCase()] || sizeMap["MEDIUM"];
    const inputWidth = resolvedSize.width;
    const inputHeight = resolvedSize.height;
    const buttonWidth = "50px";
    const spacing = 10;

    // Create input box
    const input = new flock.GUI.InputText(inputId);
    input.placeholderText = text;
    input.width = inputWidth;
    input.height = inputHeight;
    input.color = textColor || "black";
    input.background = backgroundColor || "white";
    input.focusedBackground = backgroundColor || "white";
    input.fontSize = fontSize || 24;
    input.text = "";

    // Original Positioning Logic
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

    // Create submit button
    const button = flock.GUI.Button.CreateSimpleButton(submitId, "✓");
    button.width = buttonWidth;
    button.height = inputHeight;
    button.color = backgroundColor || "gray";
    button.background = textColor || "white";
    button.fontSize = fontSize || 24;

    // Handle button offset based on alignment
    const offset = parseInt(inputWidth) + spacing;
    button.left = x < 0 ? `${x - offset}px` : `${x + offset}px`;
    button.top = `${y}px`;
    button.horizontalAlignment = input.horizontalAlignment;
    button.verticalAlignment = input.verticalAlignment;

    flock.scene.UITexture.addControl(input);
    flock.scene.UITexture.addControl(button);

    if (mode === "START") {
      return inputId;
    }

    // Await mode
    return new Promise((resolve) => {
      const submit = () => {
        const cleanValue = sanitize(input.text);
        input.dispose();
        button.dispose();
        resolve(cleanValue);
      };

      button.onPointerUpObservable.add(submit);

      input.onKeyboardEventProcessedObservable.add((event) => {
        if (event.type === "keydown" && event.key === "Enter") {
          submit();
        }
      });
    });
  },
  UISlider({
    id,
    min,
    max,
    value,
    x,
    y,
    size,
    textColor,
    backgroundColor,
  } = {}) {
    if (!flock.scene || !flock.GUI) {
        throw new Error("flock.scene or flock.GUI is not initialized.");
    }

    if (!flock.scene.UITexture) {
        flock.scene.UITexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, flock.scene);
    }

    const existing = flock.scene.UITexture.getControlByName(id);
    if (existing) existing.dispose();

    const sliderSizes = {
        SMALL: { width: "100px", height: "20px" },
        MEDIUM: { width: "200px", height: "30px" },
        LARGE: { width: "300px", height: "40px" },
    };

    const resolvedSize = sliderSizes[(size || "MEDIUM").toUpperCase()] || sliderSizes.MEDIUM;

    const slider = new flock.GUI.Slider(id);
    slider.minimum = min;
    slider.maximum = max;
    slider.value = value;

    slider.thickness = 0;            
    slider.borderColor = "transparent"; 

    slider.isPointerBlocker = true;
    slider.thumbWidth = "20px";
    slider.isFocusLinker = true;

    slider.color = textColor || "#000000";       // Color of the "filled" part and thumb
    slider.background = backgroundColor || "#ffffff"; // Color of the "empty" track
    slider.height = resolvedSize.height;
    slider.width = resolvedSize.width;

    slider.left = `${x}px`;
    slider.top = `${y}px`;
    slider.horizontalAlignment = x < 0
        ? flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
        : flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    slider.verticalAlignment = y < 0
        ? flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
        : flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    slider.zIndex = 1000;

    flock.scene.UITexture.addControl(slider);

    return slider;
  },
  createSmallButton(text, keys, color) {
    if (!flock.controlsTexture) return;

    const keyList = Array.isArray(keys) ? keys : [keys];
    const uniqueKeys = Array.from(
      new Set(
        keyList.filter(
          (key) => key !== undefined && key !== null && key !== "",
        ),
      ),
    );
    // Use a unique ID per button so Babylon doesn't recycle the same control
    // name, which can prevent some buttons from receiving pointer events when
    // multiple instances share an identifier.
    const buttonId = `small-${text}-${Math.random().toString(36).slice(2)}`;
    const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);
    button.width = `${70 * flock.displayScale}px`; // Scale size
    button.height = `${70 * flock.displayScale}px`;
    button.color = color;
    button.background = "transparent";
    button.fontSize = `${40 * flock.displayScale}px`; // Scale font size

    button.fontFamily = fontFamily;
    button.onPointerDownObservable.add(() => {
      uniqueKeys.forEach((key) => {
        flock.canvas.pressedButtons.add(key);
        flock.gridKeyPressObservable.notifyObservers(key);
      });
    });

    button.onPointerUpObservable.add(() => {
      uniqueKeys.forEach((key) => {
        flock.canvas.pressedButtons.delete(key);
        flock.gridKeyReleaseObservable.notifyObservers(key);
      });
    });
    return button;
  },
  createArrowControls(color) {
    // Add a safety check at the beginning of the function
    if (!flock.controlsTexture) return;

    // Create a grid
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
    const upButton = flock.createSmallButton("△", ["w", "ArrowUp"], color);
    const downButton = flock.createSmallButton("▽", ["s", "ArrowDown"], color);
    const leftButton = flock.createSmallButton("◁", ["a", "ArrowLeft"], color);
    const rightButton = flock.createSmallButton(
      "▷",
      ["d", "ArrowRight"],
      color,
    );
    // Add buttons to the grid
    grid.addControl(upButton, 0, 1); // Add to row 0, column 1
    grid.addControl(leftButton, 1, 0); // Add to row 1, column 0
    grid.addControl(downButton, 1, 1); // Add to row 1, column 1
    grid.addControl(rightButton, 1, 2); // Add to row 1, column 2
  },
  createButtonControls(color) {
    if (!flock.controlsTexture) return;
    // Create another grid for the buttons on the right
    const rightGrid = new flock.GUI.Grid();
    rightGrid.width = `${160 * flock.displayScale}px`; // Scale width
    rightGrid.height = `${160 * flock.displayScale}px`; // Scale height
    rightGrid.horizontalAlignment =
      flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightGrid.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rightGrid.addRowDefinition(1);
    rightGrid.addRowDefinition(1);
    rightGrid.addColumnDefinition(1);
    rightGrid.addColumnDefinition(1);
    flock.controlsTexture.addControl(rightGrid);

    // Create buttons for the right grid
    const button1 = flock.createSmallButton("①", "e", color);
    const button2 = flock.createSmallButton("②", "r", color);
    const button3 = flock.createSmallButton("③", "f", color);
    const button4 = flock.createSmallButton("④", " ", color);

    // Add buttons to the right grid in a 2x2 layout
    rightGrid.addControl(button1, 0, 0); // Row 0, Column 0
    rightGrid.addControl(button2, 0, 1); // Row 0, Column 1
    rightGrid.addControl(button3, 1, 0); // Row 1, Column 0
    rightGrid.addControl(button4, 1, 1); // Row 1, Column 1
  },
  buttonControls(control = "BOTH", mode = "AUTO", color = "#ffffff") {
    const shouldShow =
      mode === "ENABLED" ||
      (mode === "AUTO" &&
        ("ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches));

    if (!shouldShow) {
      flock.controlsTexture?.dispose();
      flock.controlsTexture = null;
      return;
    }

    flock.controlsTexture?.dispose();

    flock.controlsTexture =
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    if (control === "ARROWS" || control === "BOTH")
      flock.createArrowControls(color ?? "#ffffff");
    if (control === "ACTIONS" || control === "BOTH")
      flock.createButtonControls(color ?? "#ffffff");
  },
  canvasControls(setting) {
    if (setting) {
      flock.scene.activeCamera.attachControl(flock.canvas, false);
    } else {
      flock.scene.activeCamera.detachControl();
    }
  },
  say(meshName, options = {}) {
    let {
      text,
      duration,
      textColor = "#ffffff",
      backgroundColor = "#000000",
      alpha = 1,
      size = 24,
      mode = "ADD",
    } = options;

    // Validate duration
    duration =
      isFinite(Number(duration)) && Number(duration) >= 0
        ? Number(duration)
        : 0;
    // Validate alpha
    alpha = isFinite(Number(alpha))
      ? Math.min(Math.max(Number(alpha), 0), 1)
      : 0.7;
    // Validate size
    size = isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 16;

    if (!flock.scene) {
      console.error("Scene is not available.");
      return Promise.reject("Scene is not available.");
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
            console.error("Mesh is not defined.");
            reject("Mesh is not defined.");
          }
        });
      });
    }

    function handleMesh(targetMesh) {
      return new Promise((resolve) => {
        let plane;
        let background = "transparent";

        if (targetMesh.metadata && targetMesh.metadata.shape == "plane") {
          plane = targetMesh;
          background = plane.material.diffuseColor.toHexString();
          plane.material.needDepthPrePass = true;
        } else {
          plane = targetMesh
            .getDescendants()
            .find((child) => child.name === "textPlane");
        }

        if (!plane) {
          plane = flock.BABYLON.MeshBuilder.CreatePlane(
            "textPlane",
            { width: 4, height: 4 },
            flock.scene,
          );
          plane.name = "textPlane";
          plane.parent = targetMesh;
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
            plane.scaling.set(
              1 / parentScale.x,
              1 / parentScale.y,
              1 / parentScale.z,
            );
            plane.position.y =
              boundingInfo.boundingBox.maximum.y + 2.1 / parentScale.y;
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
          const textureWidth =
            baseResolution * (aspectRatio > 1 ? 1 : aspectRatio);
          const textureHeight =
            baseResolution * (aspectRatio > 1 ? 1 / aspectRatio : 1);

          advancedTexture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(
            plane,
            textureWidth,
            textureHeight,
          );
          advancedTexture.isTransparent = true;
          plane.advancedTexture = advancedTexture;

          if (targetMesh.metadata && targetMesh.metadata.shape == "plane") {
            let fullScreenRect = new flock.GUI.Rectangle();
            fullScreenRect.width = "100%";
            fullScreenRect.height = "100%";
            fullScreenRect.background = background;
            fullScreenRect.color = "transparent";
            advancedTexture.addControl(fullScreenRect);
          }

          const stackPanel = new flock.GUI.StackPanel("stackPanel");
          stackPanel.horizontalAlignment =
            flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
          stackPanel.verticalAlignment =
            flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
          stackPanel.isVertical = true;
          stackPanel.width = "100%";
          stackPanel.adaptHeightToChildren = true;
          stackPanel.resizeToFit = true;
          stackPanel.forceResizeWidth = true;
          stackPanel.forceResizeHeight = true;
          stackPanel.spacing = 4;
          advancedTexture.addControl(stackPanel);
        } else {
          advancedTexture = plane.advancedTexture;
        }

        const stackPanel = advancedTexture.getControlByName("stackPanel");
        if (mode === "REPLACE") {
          stackPanel.clearControls();
        }

        if (text) {
          const bg = new flock.GUI.Rectangle("textBackground");
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
          textBlock.textVerticalAlignment =
            flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
          textBlock.textHorizontalAlignment =
            flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
          bg.addControl(textBlock);

          if (duration > 0) {
            const timeoutId = setTimeout(() => {
              stackPanel.removeControl(bg);
              bg.dispose();
              textBlock.dispose();
              resolve();
            }, duration * 1000);

            flock.abortController.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timeoutId);
                bg.dispose();
                textBlock.dispose();
                resolve(new Error("Action aborted"));
              },
              { once: true },
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
  printText({ text, duration = 30, color = "white" } = {}) {
    console.log(text);

    if (!flock.scene || !flock.stackPanel) return;

    const safeDuration =
      isFinite(Number(duration)) && Number(duration) >= 0
        ? Number(duration)
        : 0;

    try {
      const bg = new flock.GUI.Rectangle("textBackground");
      bg.background = "rgba(255, 255, 255, 0.5)";
      bg.adaptWidthToChildren = true;
      bg.adaptHeightToChildren = true;
      bg.cornerRadius = 2;
      bg.thickness = 0;
      bg.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      bg.left = "5px";
      bg.top = "5px";

      const textBlock = new flock.GUI.TextBlock("textBlock", text);
      textBlock.color = color;
      textBlock.fontSize = "20";
      textBlock.fontFamily = fontFamily;
      textBlock.height = "25px";
      textBlock.paddingLeft = "10px";
      textBlock.paddingRight = "10px";
      textBlock.paddingTop = "2px";
      textBlock.paddingBottom = "2px";
      textBlock.textHorizontalAlignment =
        flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment =
        flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap;
      textBlock.resizeToFit = true;
      textBlock.forceResizeWidth = true;

      bg.addControl(textBlock);
      flock.stackPanel.addControl(bg);

      const fadeOut = () => {
        const anim = new BABYLON.Animation(
          "fadeOut",
          "alpha",
          30,
          BABYLON.Animation.ANIMATIONTYPE_FLOAT,
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
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

      const timeoutId = setTimeout(fadeOut, safeDuration * 1000);

      flock.abortController.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          if (flock.stackPanel) {
            flock.stackPanel.removeControl(bg);
            bg.dispose();
          }
        },
        { once: true },
      );
    } catch (error) {
      console.warn("Unable to print text:", error);
    }
  },
};
