let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockSensing = {
  /* 
                  Category: Sensing
  */

  getProperty(modelName, propertyName) {
    const mesh =
      modelName === "__active_camera__"
        ? flock.scene.activeCamera
        : modelName === "__main_light__"
          ? flock.mainLight
          : flock.scene.getMeshByName(modelName);

    if (!mesh) return null;

    const position =
      modelName === "__active_camera__"
        ? mesh.globalPosition
        : mesh.getAbsolutePosition();

    let propertyValue = null;
    let colors = null;

    mesh.computeWorldMatrix(true);

    const rotation =
      modelName === "__active_camera__"
        ? mesh.absoluteRotation.toEulerAngles()
        : mesh.absoluteRotationQuaternion.toEulerAngles();

    let allMeshes, materialNode, materialNodes;
    switch (propertyName) {
      case "POSITION_X":
        propertyValue = parseFloat(position.x.toFixed(2));
        break;
      case "POSITION_Y":
        propertyValue = parseFloat(position.y.toFixed(2));
        break;
      case "POSITION_Z":
        propertyValue = parseFloat(position.z.toFixed(2));
        break;
      case "ROTATION_X":
        propertyValue = parseFloat(
          flock.BABYLON.Tools.ToDegrees(rotation.x).toFixed(2),
        );
        break;
      case "ROTATION_Y":
        parseFloat(
          (propertyValue = flock.BABYLON.Tools.ToDegrees(rotation.y).toFixed(
            2,
          )),
        );
        break;
      case "ROTATION_Z":
        propertyValue = parseFloat(
          flock.BABYLON.Tools.ToDegrees(rotation.z).toFixed(2),
        );
        break;
      case "SCALE_X":
        propertyValue = parseFloat(mesh.scaling.x.toFixed(2));
        break;
      case "SCALE_Y":
        propertyValue = parseFloat(mesh.scaling.y.toFixed(2));
        break;
      case "SCALE_Z":
        propertyValue = parseFloat(mesh.scaling.z.toFixed(2));
        break;
      case "SIZE_X": {
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.x - bi.boundingBox.minimumWorld.x
          ).toFixed(2),
        );
        break;
      }
      case "SIZE_Y": {
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.y - bi.boundingBox.minimumWorld.y
          ).toFixed(2),
        );
        break;
      }
      case "SIZE_Z": {
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.z - bi.boundingBox.minimumWorld.z
          ).toFixed(2),
        );
        break;
      }
      case "MIN_X":
        if (mesh.metadata?.origin?.xOrigin === "LEFT") {
          // Adjust based on LEFT origin
          propertyValue = mesh.getBoundingInfo().boundingBox.minimumWorld.x;
        } else if (mesh.metadata?.origin?.xOrigin === "RIGHT") {
          // Adjust based on RIGHT origin
          const diffX =
            (mesh.getBoundingInfo().boundingBox.maximum.x -
              mesh.getBoundingInfo().boundingBox.minimum.x) *
            (1 - mesh.scaling.x);
          propertyValue =
            mesh.getBoundingInfo().boundingBox.maximumWorld.x - diffX;
        } else {
          // Default CENTER origin
          propertyValue =
            mesh.getBoundingInfo().boundingBox.minimum.x * mesh.scaling.x;
        }
        break;

      case "MAX_X":
        if (mesh.metadata?.origin?.xOrigin === "RIGHT") {
          propertyValue = mesh.getBoundingInfo().boundingBox.maximumWorld.x;
        } else if (mesh.metadata?.origin?.xOrigin === "LEFT") {
          const diffX =
            (mesh.getBoundingInfo().boundingBox.maximum.x -
              mesh.getBoundingInfo().boundingBox.minimum.x) *
            mesh.scaling.x;
          propertyValue =
            mesh.getBoundingInfo().boundingBox.minimumWorld.x + diffX;
        } else {
          propertyValue =
            mesh.getBoundingInfo().boundingBox.maximum.x * mesh.scaling.x;
        }
        break;

      case "MIN_Y":
        if (mesh.metadata?.origin?.yOrigin === "BASE") {
          propertyValue = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
        } else if (mesh.metadata?.origin?.yOrigin === "TOP") {
          const diffY =
            (mesh.getBoundingInfo().boundingBox.maximum.y -
              mesh.getBoundingInfo().boundingBox.minimum.y) *
            (1 - mesh.scaling.y);
          propertyValue =
            mesh.getBoundingInfo().boundingBox.maximumWorld.y - diffY;
        } else {
          propertyValue = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
          //mesh.getBoundingInfo().boundingBox.minimum.y *
          //                                              mesh.scaling.y;
        }

        break;

      case "MAX_Y":
        if (mesh.metadata?.origin?.yOrigin === "TOP") {
          propertyValue = mesh.getBoundingInfo().boundingBox.maximumWorld.y;
        } else if (mesh.metadata?.origin?.yOrigin === "BASE") {
          const diffY =
            (mesh.getBoundingInfo().boundingBox.maximum.y -
              mesh.getBoundingInfo().boundingBox.minimum.y) *
            mesh.scaling.y;
          propertyValue =
            mesh.getBoundingInfo().boundingBox.minimumWorld.y + diffY;
        } else {
          propertyValue = propertyValue =
            mesh.getBoundingInfo().boundingBox.maximumWorld.y;
          //mesh.getBoundingInfo().boundingBox.maximum.y *
          //                                              mesh.scaling.y;
        }
        break;

      case "MIN_Z":
        if (mesh.metadata?.origin?.zOrigin === "FRONT") {
          propertyValue = mesh.getBoundingInfo().boundingBox.minimumWorld.z;
        } else if (mesh.metadata?.origin?.zOrigin === "BACK") {
          const diffZ =
            (mesh.getBoundingInfo().boundingBox.maximum.z -
              mesh.getBoundingInfo().boundingBox.minimum.z) *
            (1 - mesh.scaling.z);
          propertyValue =
            mesh.getBoundingInfo().boundingBox.maximumWorld.z - diffZ;
        } else {
          propertyValue =
            mesh.getBoundingInfo().boundingBox.minimum.z * mesh.scaling.z;
        }
        break;

      case "MAX_Z":
        if (mesh.metadata?.origin?.zOrigin === "BACK") {
          propertyValue = mesh.getBoundingInfo().boundingBox.maximumWorld.z;
        } else if (mesh.metadata?.origin?.zOrigin === "FRONT") {
          const diffZ =
            (mesh.getBoundingInfo().boundingBox.maximum.z -
              mesh.getBoundingInfo().boundingBox.minimum.z) *
            mesh.scaling.z;
          propertyValue =
            mesh.getBoundingInfo().boundingBox.minimumWorld.z + diffZ;
        } else {
          propertyValue =
            mesh.getBoundingInfo().boundingBox.maximum.z * mesh.scaling.z;
        }
        break;
      case "VISIBLE":
        propertyValue = mesh.isVisible;
        break;
      case "ALPHA":
        allMeshes = [mesh].concat(mesh.getDescendants());
        materialNode = allMeshes.find((node) => node.material);

        if (materialNode) {
          propertyValue = materialNode.material.alpha;
        }
        break;
      case "COLOUR":
        allMeshes = [mesh].concat(mesh.getDescendants());
        materialNodes = allMeshes.filter((node) => node.material);

        // Map to get the diffuseColor or albedoColor of each material as a hex string
        colors = materialNodes
          .map((node) => {
            if (node.material.diffuseColor) {
              return node.material.diffuseColor.toHexString();
            } else if (node.material.albedoColor) {
              return node.material.albedoColor.toHexString();
            }
            return null;
          })
          .filter((color) => color !== null);
        if (colors.length === 1) {
          propertyValue = colors[0];
        } else if (colors.length > 1) {
          propertyValue = colors.join(", ");
        }

        break;
      default:
        console.log("Property not recognized.");
    }
    return propertyValue;
  },
  keyPressed(key) {
    // Combine all input sources: keys, buttons, and controllers
    const pressedKeys = flock.canvas.pressedKeys;
    const pressedButtons = flock.canvas.pressedButtons;

    // Check VR controller inputs
    const normalizedKey = key.toUpperCase();

    const vrPressed = flock.xrHelper?.baseExperience?.input?.inputSources.some(
      (inputSource) => {
        if (inputSource.gamepad) {
          const gamepad = inputSource.gamepad;

          // Thumbstick movement
          if (normalizedKey === "W" && gamepad.axes[1] < -0.5) return true; // Forward
          if (normalizedKey === "S" && gamepad.axes[1] > 0.5) return true; // Backward
          if (normalizedKey === "A" && gamepad.axes[0] < -0.5) return true; // Left
          if (normalizedKey === "D" && gamepad.axes[0] > 0.5) return true; // Right

          // Button mappings
          if (
            (normalizedKey === "SPACE" || key === " ") &&
            gamepad.buttons[0]?.pressed
          )
            return true; // A button for jump
          if (normalizedKey === "E" && gamepad.buttons[1]?.pressed) return true; // B button maps to E
          if (normalizedKey === "F" && gamepad.buttons[2]?.pressed) return true; // X button maps to F
          if (normalizedKey === "R" && gamepad.buttons[3]?.pressed) return true; // Y button maps to R

          // General button check
          if (
            normalizedKey === "ANY" &&
            gamepad.buttons.some((button) => button.pressed)
          )
            return true;
        }
        return false;
      },
    );

    const gamepadPressed = (() => {
      if (!navigator.getGamepads) {
        return false;
      }

      const gamepads = navigator.getGamepads() || [];

      return Array.from(gamepads).some((gamepad) => {
        if (!gamepad) {
          return false;
        }

        const { axes = [], buttons = [] } = gamepad;

        switch (normalizedKey) {
          case "W":
            return axes[1] < -0.5 || buttons[12]?.pressed;
          case "S":
            return axes[1] > 0.5 || buttons[13]?.pressed;
          case "A":
            return axes[0] < -0.5 || buttons[14]?.pressed;
          case "Q":
            return (
              axes[0] < -0.5 || buttons[14]?.pressed || buttons[1]?.pressed
            );
          case "D":
            return axes[0] > 0.5 || buttons[15]?.pressed;
          case "SPACE":
            return buttons[0]?.pressed;
          case "E":
            return buttons[1]?.pressed;
          case "F":
            return buttons[2]?.pressed;
          case "R":
            return (
              buttons[3]?.pressed || buttons[6]?.pressed || buttons[7]?.pressed
            );
          case "ANY":
            return (
              axes.some((axis) => Math.abs(axis) > 0.5) ||
              buttons.some((button) => button?.pressed)
            );
          default:
            return false;
        }
      });
    })();

    const normalizedButtonPressed =
      pressedButtons.has(key) ||
      pressedButtons.has(key.toLowerCase()) ||
      pressedButtons.has(key.toUpperCase());

    // Combine all sources
    if (key === "ANY") {
      return (
        pressedKeys.size > 0 ||
        pressedButtons.size > 0 ||
        vrPressed ||
        gamepadPressed
      );
    } else if (key === "NONE") {
      return (
        pressedKeys.size === 0 &&
        pressedButtons.size === 0 &&
        !vrPressed &&
        !gamepadPressed
      );
    } else {
      return (
        pressedKeys.has(key) ||
        pressedKeys.has(key.toLowerCase()) ||
        pressedKeys.has(key.toUpperCase()) ||
        normalizedButtonPressed ||
        vrPressed ||
        gamepadPressed
      );
    }
  },
  actionPressed(action) {
    const actionMap = {
      FORWARD: ["W", "Z"],
      BACKWARD: ["S"],
      LEFT: ["A", "Q"],
      RIGHT: ["D"],
      BUTTON1: ["E", "1"],
      BUTTON2: ["R", "2"],
      BUTTON3: ["F", "3"],
      BUTTON4: ["SPACE", " ", "4"],
    };

    const actionKeys = actionMap[action];

    if (!actionKeys) {
      return false;
    }

    return actionKeys.some((key) => this.keyPressed(key));
  },
  getTime(unit) {
    const now = Date.now();
    switch (unit) {
      case "milliseconds":
        return now;
      case "minutes":
        return Math.floor(now / 60000);
      case "seconds":
      default:
        return Math.floor(now / 1000);
    }
  },
};
