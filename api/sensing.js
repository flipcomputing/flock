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

    // Use a consistent world position call (works for meshes, lights, and cameras).
    const absolutePosition =
      typeof mesh.getAbsolutePosition === "function"
        ? mesh.getAbsolutePosition()
        : (mesh.globalPosition ?? mesh.position);

    const usesAbsolutePosition =
      modelName === "__active_camera__" || modelName === "__main_light__";

    const hasNumericXYZ = (value) =>
      value &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      Number.isFinite(value.z);

    const position = (() => {
      if (usesAbsolutePosition) {
        return absolutePosition;
      }

      const anchor =
        typeof flock._getAnchor === "function" ? flock._getAnchor(mesh) : null;
      if (hasNumericXYZ(anchor)) {
        return anchor;
      }

      const blockPosition =
        typeof flock.getBlockPositionFromMesh === "function"
          ? flock.getBlockPositionFromMesh(mesh)
          : null;
      if (hasNumericXYZ(blockPosition)) {
        return blockPosition;
      }

      return absolutePosition;
    })();

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

      // Speed per world axis, and overall speed. 0 with no live physics body.
      case "SPEED_X":
      case "SPEED_Y":
      case "SPEED_Z":
      case "SPEED": {
        const body = mesh.physics;
        const v =
          body && body._pluginData?.hpBodyId
            ? body.getLinearVelocity()
            : null;
        if (!v) {
          propertyValue = 0;
        } else if (propertyName === "SPEED_X") {
          propertyValue = parseFloat(v.x.toFixed(2));
        } else if (propertyName === "SPEED_Y") {
          propertyValue = parseFloat(v.y.toFixed(2));
        } else if (propertyName === "SPEED_Z") {
          propertyValue = parseFloat(v.z.toFixed(2));
        } else {
          propertyValue = parseFloat(v.length().toFixed(2));
        }
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
              return node.material.diffuseColor.toHexString().toLowerCase();
            } else if (node.material.albedoColor) {
              return node.material.albedoColor.toHexString().toLowerCase();
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

      case "DESCRIPTION": {
        const root = mesh.metadata?.boundingBox ?? mesh;
        propertyValue = root.metadata?.displayName ?? null;
        if (
          propertyValue === null &&
          typeof root.getChildMeshes === "function"
        ) {
          for (const child of root.getChildMeshes(false)) {
            if (child.metadata?.displayName != null) {
              propertyValue = child.metadata.displayName;
              break;
            }
          }
        }
        break;
      }

      default:
        console.log("Property not recognized.");
    }

    return propertyValue;
  },
  keyPressed(key) {
    if (key === "ANY") return flock.inputManager.heldKeyCount() > 0;
    if (key === "NONE") return flock.inputManager.heldKeyCount() === 0;
    return flock.inputManager.isKeyDown(key);
  },
  setActionKey(action, key) {
    flock.inputManager.setActionKey(action, key);
  },
  actionPressed(action) {
    return flock.inputManager.isActionDown(action);
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
