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

    // Ensure world transforms are current.
    mesh.computeWorldMatrix(true);

    // Use a consistent world position call (works for meshes and cameras).
    const position =
      typeof mesh.getAbsolutePosition === "function"
        ? mesh.getAbsolutePosition()
        : (mesh.globalPosition ?? mesh.position);

    // Robust rotation: prefer quaternion if present, else fall back to Euler.
    const rotEuler = mesh.absoluteRotationQuaternion
      ? mesh.absoluteRotationQuaternion.toEulerAngles()
      : mesh.rotationQuaternion
        ? mesh.rotationQuaternion.toEulerAngles()
        : (mesh.rotation ?? new flock.BABYLON.Vector3(0, 0, 0));

    let propertyValue = null;
    let colors = null;

    let allMeshes, materialNode, materialNodes;

    switch (propertyName) {
      case "POSITION_X":
        propertyValue = position ? parseFloat(position.x.toFixed(2)) : null;
        break;
      case "POSITION_Y":
        propertyValue = position ? parseFloat(position.y.toFixed(2)) : null;
        break;
      case "POSITION_Z":
        propertyValue = position ? parseFloat(position.z.toFixed(2)) : null;
        break;

      case "ROTATION_X":
        propertyValue = parseFloat(
          flock.BABYLON.Tools.ToDegrees(rotEuler.x).toFixed(2),
        );
        break;
      case "ROTATION_Y":
        propertyValue = parseFloat(
          flock.BABYLON.Tools.ToDegrees(rotEuler.y).toFixed(2),
        );
        break;
      case "ROTATION_Z":
        propertyValue = parseFloat(
          flock.BABYLON.Tools.ToDegrees(rotEuler.z).toFixed(2),
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
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.x - bi.boundingBox.minimumWorld.x
          ).toFixed(2),
        );
        break;
      }
      case "SIZE_Y": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.y - bi.boundingBox.minimumWorld.y
          ).toFixed(2),
        );
        break;
      }
      case "SIZE_Z": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = parseFloat(
          (
            bi.boundingBox.maximumWorld.z - bi.boundingBox.minimumWorld.z
          ).toFixed(2),
        );
        break;
      }

      // MIN/MAX: return consistent world AABB extents.
      // (Origin-specific adjustments previously mixed local/world spaces and manual scaling.)
      case "MIN_X": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.minimumWorld.x;
        break;
      }
      case "MAX_X": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.maximumWorld.x;
        break;
      }
      case "MIN_Y": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.minimumWorld.y;
        break;
      }
      case "MAX_Y": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.maximumWorld.y;
        break;
      }
      case "MIN_Z": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.minimumWorld.z;
        break;
      }
      case "MAX_Z": {
        if (typeof mesh.refreshBoundingInfo === "function") {
          mesh.refreshBoundingInfo(true);
        }
        const bi = mesh.getBoundingInfo();
        propertyValue = bi.boundingBox.maximumWorld.z;
        break;
      }

      case "VISIBLE":
          propertyValue = mesh.isEnabled() && mesh.isVisible;
        break;

      // Leaving colour-related logic as-is for now, per your request.
      case "ALPHA":
        allMeshes = [mesh].concat(mesh.getDescendants?.() ?? []);
        materialNode = allMeshes.find((node) => node.material);

        if (materialNode) {
          propertyValue = materialNode.material.alpha;
        }
        break;

      case "COLOUR":
        allMeshes = [mesh].concat(mesh.getDescendants?.() ?? []);
        materialNodes = allMeshes.filter((node) => node.material);

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
