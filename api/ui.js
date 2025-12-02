let flock;
//let fontFamily = "Asap";
let fontFamily = "Atkinson Hyperlegible Next";

export function setFlockReference(ref) {
  flock = ref;
}

export const flockUI = {
  
  UIText({ text, x, y, fontSize, color, duration, id = null } = {}) {
    if (!flock.scene || !flock.GUI) {
      return;
    }

    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    const textBlockId =
      id || `textBlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const maxWidth = flock.scene.getEngine().getRenderWidth();
    const maxHeight = flock.scene.getEngine().getRenderHeight();
    const adjustedX = x < 0 ? maxWidth + x : x;
    const adjustedY = y < 0 ? maxHeight + y : y;

    let textBlock = flock.scene.UITexture.getControlByName(textBlockId);
    if (!textBlock) {
      textBlock = new flock.GUI.TextBlock(textBlockId);
      textBlock.name = textBlockId;
      flock.scene.UITexture.addControl(textBlock);

      // Anchor control at screen top-left; don't block input.
      textBlock.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.verticalAlignment   = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      textBlock.textWrapping = false;
      textBlock.isPointerBlocker = false;
      // Keep text centered inside its line box.
      textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment   = flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    }

    // Update text + style
    textBlock.text  = text;
    textBlock.color = color || "white";

    // Font & line box
    const px = Number(fontSize || 24);
    textBlock.fontSize   = px;
    const linePx = Math.max(1, Math.round(px * 1.2)); // 1.2× prevents ascender clipping
    textBlock.lineHeight = `${linePx}px`;
    textBlock.height     = `${Math.max(linePx, px + 4)}px`;

    // Position
    textBlock.left = adjustedX;
    textBlock.top  = adjustedY;

    // WEB FONT STABILIZER: avoid the “first update jump”
    if (document.fonts && document.fonts.status !== "loaded") {
      // Hide until fonts are ready, then force a clean measure.
      const prevAlpha = textBlock.alpha;
      textBlock.alpha = 0;
      document.fonts.ready.then(() => {
        textBlock._markAsDirty();             // re-measure with real font
        textBlock.alpha = prevAlpha ?? 1;
      });
    } else {
      // If fonts are already ready, still nudge a re-measure on update.
      // This helps when the first call happened before the font loaded.
      setTimeout(() => textBlock._markAsDirty(), 0);
    }

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        const ctl = flock.scene.UITexture.getControlByName(textBlockId);
        if (ctl) ctl.isVisible = false;
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
    // Ensure flock.scene and flock.GUI are initialized
    if (!flock.scene || !flock.GUI) {
      throw new Error("flock.scene or flock.GUI is not initialized.");
    }

    // Ensure UITexture exists
    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Validate buttonId
    if (!buttonId || typeof buttonId !== "string") {
      throw new Error("buttonId must be a valid non-empty string.");
    }

    // Create a Babylon.js GUI button
    const button = flock.GUI.Button.CreateSimpleButton(buttonId, text);

    // Preset button sizes for consistency
    const buttonSizes = {
      SMALL: { width: "100px", height: "40px" },
      MEDIUM: { width: "150px", height: "50px" },
      LARGE: { width: "200px", height: "60px" },
    };

    // Validate and apply the selected size
    if (typeof width !== "string") {
      throw new Error(
        "Invalid button size. Please provide a valid size: 'SMALL', 'MEDIUM', or 'LARGE'.",
      );
    }

    const size = buttonSizes[width.toUpperCase()] || buttonSizes["SMALL"];
    button.width = size.width;
    button.height = size.height;

    // Configure text block settings
    if (button.textBlock) {
      button.textBlock.textWrapping = true;
      button.textBlock.resizeToFit = true;
      button.textBlock.fontSize = textSize ? `${textSize}px` : "16px"; // Default font size
    } else {
      console.warn(
        "No textBlock found for the button. Text-related settings will not be applied.",
      );
    }

    // Set button text color and background color
    button.color = textColor || "white";
    button.background = backgroundColor || "blue";

    // Validate x and y positions
    if (typeof x !== "number" || typeof y !== "number") {
      throw new Error("x and y must be numbers.");
    }

    // Set button alignment
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

    // Add the button to the UI
    flock.scene.UITexture.addControl(button);

    // Return the buttonId for future reference
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
    flock.scene.UITexture.controls ??= [];

    const inputId =
      id || `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    const buttonHeight = resolvedSize.height;
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
    const button = flock.GUI.Button.CreateSimpleButton(
      `submit_${inputId}`,
      "✓",
    );
    button.width = buttonWidth;
    button.height = buttonHeight;
    button.color = backgroundColor || "gray";
    button.background = textColor || "white";
    button.fontSize = fontSize || 24;

    button.left = `${x + parseInt(inputWidth) + spacing}px`;
    button.top = `${y}px`;
    button.horizontalAlignment = input.horizontalAlignment;
    button.verticalAlignment = input.verticalAlignment;

    flock.scene.UITexture.addControl(input);
    flock.scene.UITexture.addControl(button);
    flock.scene.UITexture.controls.push(input, button);

    if (mode === "START") {
      // Start mode: return the ID immediately (no internal listener)
      return inputId;
    }

    // Await mode: return a Promise that resolves once
    return new Promise((resolve) => {
      const submit = () => {
        const value = input.text;
        input.isVisible = false;
        button.isVisible = false;
        resolve(value);
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

    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    const sliderSizes = {
      SMALL: { width: "100px", height: "20px" },
      MEDIUM: { width: "200px", height: "30px" },
      LARGE: { width: "300px", height: "40px" },
    };

    const resolvedSize =
      sliderSizes[(size || "MEDIUM").toUpperCase()] || sliderSizes.MEDIUM;

    const slider = new flock.GUI.Slider();
    slider.name = id;
    slider.minimum = min;
    slider.maximum = max;
    slider.value = value;
    slider.color = textColor || "#000000";
    slider.background = backgroundColor || "#ffffff";
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

    flock.scene.UITexture.addControl(slider);
    return slider;
  },
  createSmallButton(text, keys, color) {
    if (!flock.controlsTexture) return;

    const keyList = Array.isArray(keys) ? keys : [keys];

    const button = flock.GUI.Button.CreateSimpleButton(
      `but_${keyList.join("_")}`,
      text,
    );
    button.width = `${70 * flock.displayScale}px`; // Scale size
    button.height = `${70 * flock.displayScale}px`;
    button.color = color;
    button.background = "transparent";
    button.fontSize = `${40 * flock.displayScale}px`; // Scale font size

    button.fontFamily = fontFamily;
    button.onPointerDownObservable.add(() => {
      keyList.forEach((key) => {
        flock.canvas.pressedButtons.add(key);
        flock.gridKeyPressObservable.notifyObservers(key);
      });
    });

    button.onPointerUpObservable.add(() => {
      keyList.forEach((key) => {
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
    const upButton = flock.createSmallButton("△", "w", color);
    const downButton = flock.createSmallButton("▽", "s", color);
    const leftButton = flock.createSmallButton("◁", "a", color);
    const rightButton = flock.createSmallButton("▷", "d", color);
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
    const button1 = flock.createSmallButton("①", ["e", "1"], color);
    const button2 = flock.createSmallButton("②", ["r", "2"], color);
    const button3 = flock.createSmallButton("③", ["f", "3"], color);
    const button4 = flock.createSmallButton("④", [" ", "SPACE", "4"], color);

    // Add buttons to the right grid in a 2x2 layout
    rightGrid.addControl(button1, 0, 0); // Row 0, Column 0
    rightGrid.addControl(button2, 0, 1); // Row 0, Column 1
    rightGrid.addControl(button3, 1, 0); // Row 1, Column 0
    rightGrid.addControl(button4, 1, 1); // Row 1, Column 1
  },
  buttonControls(control, enabled, color) {
    if (flock.controlsTexture) {
      flock.controlsTexture.dispose();
    }

    flock.controlsTexture =
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Set all controls to be non-interactive if disabled
    flock.controlsTexture.rootContainer.isEnabled = enabled;

    // Only create/update controls if they don't exist yet
    if (enabled) {
      if (control == "ARROWS" || control == "BOTH")
        flock.createArrowControls(color);
      if (control == "ACTIONS" || control == "BOTH")
        flock.createButtonControls(color);
    }
  },
  canvasControls(setting) {
    if (setting) {
      flock.scene.activeCamera.attachControl(flock.canvas, false);
    } else {
      flock.scene.activeCamera.detachControl();
    }
  },
  say(meshName, options = {}) {
    const {
      text,
      duration,
      textColor = "white",
      backgroundColor = "#000000",
      alpha = 0.7,
      size = 16,
      mode = "APPEND",
    } = options;

    if (!flock.scene) {
      console.error("Scene is not available.");
      return Promise.reject("Scene is not available.");
    }

    const mesh = flock.scene.getMeshByName(meshName);

    if (mesh) {
      // Mesh is available immediately — always return the Promise!
      return handleMesh(mesh);
    } else {
      // Mesh not ready: wait for it, and only resolve after text has been removed
      return new Promise((resolve, reject) => {
        flock.whenModelReady(meshName, function (mesh) {
          if (mesh) {
            handleMesh(mesh).then(resolve).catch(reject);
          } else {
            console.error("Mesh is not defined.");
            reject("Mesh is not defined.");
          }
        });
      });
    }

    function handleMesh(mesh) {
      return new Promise((resolve) => {
        const targetMesh = mesh;
        let plane;
        let background = "transparent";
        if (targetMesh.metadata && targetMesh.metadata.shape == "plane") {
          plane = targetMesh;
          background = plane.material.diffuseColor.toHexString();
          plane.material.needDepthPrePass = true;
        } else {
          plane = mesh
            .getDescendants()
            .find((child) => child.name === "textPlane");
        }
        let advancedTexture;
        if (!plane) {
          plane = flock.BABYLON.MeshBuilder.CreatePlane(
            "textPlane",
            { width: 4, height: 4 },
            flock.scene,
          );
          plane.name = "textPlane";
          plane.parent = targetMesh;
          plane.alpha = 1;
          plane.checkCollisions = false;
          plane.isPickable = false;

          // Get initial bounding info.
          let boundingInfo = targetMesh.getBoundingInfo();
          plane.position.y =
            boundingInfo.boundingBox.maximum.y + 2.5 / targetMesh.scaling.y;
          plane.billboardMode = flock.BABYLON.Mesh.BILLBOARDMODE_ALL;

          flock.scene.onBeforeRenderObservable.add(() => {
            boundingInfo = targetMesh.getBoundingInfo();
            const parentScale = targetMesh.scaling;
            plane.scaling.x = 1 / parentScale.x;
            plane.scaling.y = 1 / parentScale.y;
            plane.scaling.z = 1 / parentScale.z;
            plane.position.y =
              boundingInfo.boundingBox.maximum.y + 2.1 / parentScale.y;
          });
        }

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
          const stackPanel = new flock.GUI.StackPanel();
          stackPanel.name = "stackPanel";
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
          textBlock.alpha = 1;
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
            const timeoutId = setTimeout(function () {
              stackPanel.removeControl(bg);
              bg.dispose();
              textBlock.dispose();
              resolve();
            }, duration * 1000);

            flock.abortController.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              bg.dispose();
              textBlock.dispose();
              resolve(new Error("Action aborted"));
            });
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    }
  },
  printText({
    text,
    duration = 30,
    color = "white"
  } = {}) {
    if (!flock.scene || !flock.stackPanel) return;

    console.log(text);
    try {
      // Create a rectangle container for the text
      const bg = new flock.GUI.Rectangle("textBackground");
      bg.background = "rgba(255, 255, 255, 0.5)";
      bg.adaptWidthToChildren = true; // Adjust width to fit the text
      bg.adaptHeightToChildren = true; // Adjust height to fit the text
      bg.cornerRadius = 2; // Match the original corner rounding
      bg.thickness = 0; // No border
      bg.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align the container to the left
      bg.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align to the top
      bg.left = "5px"; // Preserve original spacing
      bg.top = "5px";

      // Create the text block inside the rectangle
      const textBlock = new flock.GUI.TextBlock("textBlock", text);
      textBlock.color = color;
      textBlock.fontSize = "20"; // Match the original font size
      textBlock.fontFamily = fontFamily; // Retain original font
      textBlock.height = "25px"; // Match the original height
      textBlock.paddingLeft = "10px"; // Padding for left alignment
      textBlock.paddingRight = "10px";
      textBlock.paddingTop = "2px";
      textBlock.paddingBottom = "2px";
      textBlock.textHorizontalAlignment =
        flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Left align the text
      textBlock.textVerticalAlignment =
        flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER; // Center vertically within the rectangle
      textBlock.textWrapping = flock.GUI.TextWrapping.WordWrap; // Enable word wrap
      textBlock.resizeToFit = true; // Allow resizing
      textBlock.forceResizeWidth = true;

      // Add the text block to the rectangle
      bg.addControl(textBlock);

      // Add the rectangle to the stack panel
      flock.stackPanel.addControl(bg);

      // Remove the text after the specified duration
      const timeoutId = setTimeout(() => {
        if (flock.scene) {
          // Ensure the scene is still valid
          flock.stackPanel.removeControl(bg);
        }
      }, duration * 1000);

      // Handle cleanup in case of scene disposal
      flock.abortController.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
      });
    } catch (error) {
      console.warn("Unable to print text:", error);
    }
  },
};
