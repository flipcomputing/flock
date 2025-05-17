let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockUI = {
  UIText(text, x, y, fontSize, color, duration, id = null) {
    // Ensure flock.scene and flock.GUI are initialized
    if (!flock.scene || !flock.GUI) {
      throw new Error("flock.scene or flock.GUI is not initialized.");
    }

    // Ensure UITexture and controls exist
    flock.scene.UITexture ??=
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    flock.scene.UITexture.controls ??= [];
    flock.abortController ??= new AbortController();

    // Generate a unique ID if none is provided
    const textBlockId =
      id ||
      `textBlock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get canvas dimensions
    const maxWidth = flock.scene.getEngine().getRenderWidth();
    const maxHeight = flock.scene.getEngine().getRenderHeight();

    // Adjust negative coordinates
    const adjustedX = x < 0 ? maxWidth + x : x;
    const adjustedY = y < 0 ? maxHeight + y : y;

    // Check if a TextBlock with the given ID already exists
    let textBlock = flock.scene.UITexture.getControlByName(textBlockId);

    if (textBlock) {
      // Reuse the existing TextBlock and update its properties
      textBlock.text = text;
      textBlock.color = color || "white"; // Default color
      textBlock.fontSize = fontSize || 24; // Default font size
      textBlock.left = adjustedX;
      textBlock.top = adjustedY;
      textBlock.isVisible = true; // Ensure the text block is visible
    } else {
      textBlock = new flock.GUI.TextBlock(textBlockId); // Assign the ID as the name
      flock.scene.UITexture.addControl(textBlock);
      flock.scene.UITexture.controls.push(textBlock);

      // Set initial text properties
      textBlock.text = text;
      textBlock.color = color || "white"; // Default color
      textBlock.fontSize = fontSize || 24; // Default font size
      textBlock.textHorizontalAlignment =
        flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      textBlock.textVerticalAlignment =
        flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      textBlock.left = adjustedX;
      textBlock.top = adjustedY;
    }

    // Ensure the text disappears after the duration
    if (duration > 0) {
      setTimeout(() => {
        if (flock.scene.UITexture.controls.includes(textBlock)) {
          textBlock.isVisible = false; // Hide the text block
        } else {
          console.warn(
            `TextBlock "${textBlockId}" not found in controls array.`,
          );
        }
      }, duration * 1000);
    }

    // Return the ID for future reference
    return textBlockId;
  },
  UIButton(
    text,
    x,
    y,
    width,
    textSize,
    textColor,
    backgroundColor,
    buttonId,
  ) {
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
  createSmallButton(text, key, color) {
    if (!flock.controlsTexture) return;

    const button = flock.GUI.Button.CreateSimpleButton("but", text);
    button.width = `${70 * flock.displayScale}px`; // Scale size
    button.height = `${70 * flock.displayScale}px`;
    button.color = color;
    button.background = "transparent";
    button.fontSize = `${40 * flock.displayScale}px`; // Scale font size

    button.fontFamily = "Asap";
    button.onPointerDownObservable.add(() => {
      flock.canvas.pressedButtons.add(key);
      flock.gridKeyPressObservable.notifyObservers(key);
    });

    button.onPointerUpObservable.add(() => {
      flock.canvas.pressedButtons.delete(key);
      flock.gridKeyReleaseObservable.notifyObservers(key);
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
    rightGrid.verticalAlignment =
      flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rightGrid.addRowDefinition(1);
    rightGrid.addRowDefinition(1);
    rightGrid.addColumnDefinition(1);
    rightGrid.addColumnDefinition(1);
    flock.controlsTexture.addControl(rightGrid);

    // Create buttons for the right grid
    const button1 = flock.createSmallButton("■", "q", color);
    const button2 = flock.createSmallButton("✿", "e", color);
    const button3 = flock.createSmallButton("✱", "f", color);
    const button4 = flock.createSmallButton("∞", " ", color);

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
}