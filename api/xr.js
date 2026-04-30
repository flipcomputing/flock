import { translate } from "../main/translation.js";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockXR = {
  /* 
          Category: Scene>XR
  */

  setCameraBackground(cameraType) {
    if (!flock.scene) {
      console.error(
        "Scene not available. Ensure the scene is initialised before setting the camera background.",
      );
      return;
    }

    const videoLayer = new flock.BABYLON.Layer(
      "videoLayer",
      null,
      flock.scene,
      true,
    );

    flock.BABYLON.VideoTexture.CreateFromWebCam(
      flock.scene,
      (videoTexture) => {
        videoTexture._invertY = false; // Correct orientation
        videoTexture.uScale = -1; // Flip horizontally for mirror effect
        videoLayer.texture = videoTexture; // Assign the video feed to the layer
      },
      {
        facingMode: cameraType, // "user" for front, "environment" for back
        minWidth: 640,
        minHeight: 480,
        maxWidth: 1920,
        maxHeight: 1080,
        deviceId: "",
      },
    );
  },
  async setXRMode(mode) {
    await flock.initializeXR(mode);
    flock.printText({
      text: translate("xr_mode_message"),
      duration: 5,
      color: "white",
    });
  },
  async setControllerLedColor(controllerIndex, color) {
    console.log("[setControllerLedColor] called", { controllerIndex, color });
    const index = Math.max(0, Math.trunc(Number(controllerIndex)));
    const xrGamepads =
      flock.xrHelper?.baseExperience?.input?.inputSources
        ?.map((inputSource) => inputSource?.gamepad)
        ?.filter(Boolean) ?? [];
    const browserGamepads = Array.from(navigator?.getGamepads?.() ?? []).filter(
      Boolean,
    );
    console.log("[setControllerLedColor] gamepad pools", {
      index,
      xrGamepadCount: xrGamepads.length,
      browserGamepadCount: browserGamepads.length,
      xrGamepads: xrGamepads.map((gp) => ({
        id: gp?.id,
        mapping: gp?.mapping,
      })),
      browserGamepads: browserGamepads.map((gp) => ({
        id: gp?.id,
        mapping: gp?.mapping,
      })),
    });

    const gamepad = xrGamepads[index] ?? browserGamepads[index];
    console.log("[setControllerLedColor] selected gamepad", {
      index,
      selectedFrom: xrGamepads[index] ? "xrGamepads" : "browserGamepads",
      gamepadId: gamepad?.id,
      hasLightIndicator: typeof gamepad?.lightIndicator?.setColor === "function",
      hasLedsArray: Array.isArray(gamepad?.leds),
      hasFirstLedSetter: typeof gamepad?.leds?.[0]?.setColor === "function",
    });

    if (!gamepad) {
      console.log("[setControllerLedColor] no gamepad found for index", index);
      return;
    }

    const hexToRgb = (hex) => {
      const trimmed = String(hex).trim();
      const match = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
      if (!match) return null;
      const value = match[1];
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    };

    const rgb = hexToRgb(color);
    if (!rgb) {
      console.log("[setControllerLedColor] invalid color format", { color });
      return;
    }
    console.log("[setControllerLedColor] parsed color", { color, rgb });

    try {
      if (typeof gamepad.lightIndicator?.setColor === "function") {
        gamepad.lightIndicator.setColor(rgb.r, rgb.g, rgb.b);
        console.log("[setControllerLedColor] used lightIndicator.setColor");
        return;
      }

      if (typeof gamepad.leds?.[0]?.setColor === "function") {
        gamepad.leds[0].setColor(rgb.r, rgb.g, rgb.b);
        console.log("[setControllerLedColor] used leds[0].setColor");
        return;
      }
      console.log(
        "[setControllerLedColor] no supported LED API on selected gamepad",
      );

      const hidResult = await this.setPlayStationControllerLedViaHid?.(
        gamepad,
        rgb,
      );
      if (hidResult) {
        console.log("[setControllerLedColor] used WebHID fallback");
      } else {
        console.log("[setControllerLedColor] WebHID fallback unavailable/failed");
      }
    } catch {
      console.log("[setControllerLedColor] LED set failed");
      // silent by design
    }
  },
  async setPlayStationControllerLedViaHid(gamepad, rgb) {
    try {
      if (!navigator?.hid) return false;
      const id = String(gamepad?.id ?? "");
      const vendorMatch = id.match(/Vendor:\s*([0-9a-fA-F]{4})/);
      const productMatch = id.match(/Product:\s*([0-9a-fA-F]{4})/);
      const vendorId = vendorMatch ? parseInt(vendorMatch[1], 16) : null;
      const productId = productMatch ? parseInt(productMatch[1], 16) : null;
      if (vendorId !== 0x054c || !productId) return false;

      const paired = navigator.hid
        .getDevices()
        .then((devices) =>
          devices.find(
            (d) => d.vendorId === vendorId && d.productId === productId,
          ),
        );
      let device = await paired;
      if (!device) {
        const requested = await navigator.hid.requestDevice({
          filters: [{ vendorId, productId, usagePage: 0x01, usage: 0x05 }],
        });
        device = requested?.[0];
      }
      if (!device) return false;
      if (!device.opened) await device.open();

      if (productId === 0x09cc || productId === 0x0ce6) {
        const usbData = new Uint8Array(47);
        usbData[0] = 0x03; // valid flag 1 (lightbar + player leds)
        usbData[1] = 0x00; // motor right
        usbData[2] = 0x00; // motor left
        usbData[43] = rgb.r;
        usbData[44] = rgb.g;
        usbData[45] = rgb.b;

        const btData = new Uint8Array(77);
        btData[0] = 0x03; // valid flag 1
        btData[1] = 0x00; // valid flag 2
        btData[2] = 0x00; // motor right
        btData[3] = 0x00; // motor left
        btData[44] = rgb.r;
        btData[45] = rgb.g;
        btData[46] = rgb.b;

        const outputReportIds = new Set(
          device.collections.flatMap((collection) =>
            (collection.outputReports || []).map((report) => report.reportId),
          ),
        );
        console.log("[setControllerLedColor] DualSense output report IDs", [
          ...outputReportIds,
        ]);

        const attempts = [
          { reportId: 0x02, data: usbData, label: "dualsense-usb-0x02" },
          { reportId: 0x31, data: btData, label: "dualsense-bt-0x31" },
        ];

        for (const attempt of attempts) {
          try {
            await device.sendReport(attempt.reportId, attempt.data);
            console.log(
              "[setControllerLedColor] WebHID sendReport success",
              attempt.label,
            );
            return true;
          } catch (error) {
            console.log(
              "[setControllerLedColor] WebHID sendReport failed",
              attempt.label,
              error,
            );
          }
        }
        return false;
      }

      const ds4ReportId = 0x05;
      const ds4Data = new Uint8Array(31);
      ds4Data[0] = 0xff;
      ds4Data[1] = 0x00;
      ds4Data[2] = 0x00;
      ds4Data[5] = rgb.r;
      ds4Data[6] = rgb.g;
      ds4Data[7] = rgb.b;
      await device.sendReport(ds4ReportId, ds4Data);
      return true;
    } catch (error) {
      console.log("[setControllerLedColor] WebHID fallback error", error);
      return false;
    }
  },
  exportMesh(meshName, format) {
    //meshName = "scene";

    if (meshName === "scene" && format === "GLB") {
      const scene = flock.scene;

      const cls = (n) => n?.getClassName?.();
      const isEnabledDeep = (n) =>
        typeof n.isEnabled === "function" ? n.isEnabled(true) : true;

      // Treat ALL mesh subclasses as geometry; we'll still skip LinesMesh explicitly
      const isAbstractMesh = (n) =>
        typeof flock.BABYLON !== "undefined" &&
        n instanceof flock.BABYLON.AbstractMesh;
      const isLines = (n) => cls(n) === "LinesMesh";

      // --- Ghost: top-level + enabled + AbstractMesh + no material (not lines)
      const targets = scene.meshes.filter(
        (m) =>
          !m.parent &&
          isEnabledDeep(m) &&
          isAbstractMesh(m) &&
          !isLines(m) &&
          !m.material,
      );

      // Shared transparent PBR material (GLTF-friendly)
      const ghostMat = new flock.BABYLON.PBRMaterial("_tmpExportGhost", scene);
      ghostMat.alpha = 0;
      ghostMat.alphaMode = flock.BABYLON.Engine.ALPHA_BLEND;
      ghostMat.transparencyMode =
        flock.BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
      ghostMat.disableLighting = true;
      ghostMat.metallic = 0;
      ghostMat.roughness = 1;
      ghostMat.albedoColor = new flock.BABYLON.Color4(1, 1, 1, 0);

      const patches = targets.map((mesh) => ({
        mesh,
        prev: mesh.material ?? null,
      }));
      for (const { mesh } of patches) mesh.material = ghostMat;

      // Optional: name allowlist for safety (keeps ground even if disabled, if you want)
      const alwaysKeepNames = new Set(["ground", "Ground"]);

      const shouldExportNode = (node) => {
        const c = cls(node);
        if (!c) return false;

        // Always keep ground (by name) before any other checks
        if (node.name && alwaysKeepNames.has(node.name)) return true;

        // Respect enabled state (includes ancestors)
        if (!isEnabledDeep(node)) return false;

        // Never export cameras/lights
        if (c === "Camera" || c === "Light") return false;

        // Skip line helpers entirely
        if (c === "LinesMesh") return false;

        // Keep all transform containers
        if (c === "TransformNode") return true;

        // Keep ALL mesh subclasses (e.g., Mesh, InstancedMesh, GroundMesh, etc.)
        if (isAbstractMesh(node)) return true;

        return false;
      };

      flock.EXPORT.GLTF2Export.GLBAsync(scene, "scene.glb", {
        exportMaterials: true,
        exportTextures: true,
        shouldExportNode,
      })
        .then((glb) => glb.downloadFiles())
        .finally(() => {
          // Restore originals
          for (const { mesh, prev } of patches) mesh.material = prev;
          ghostMat.dispose();
        });

      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        const anchorMesh = mesh;
        const rootChild = anchorMesh
          .getChildMeshes()
          .find((child) => child.name === "__root__");

        const exportAnchors = [anchorMesh];
        if (rootChild) {
          exportAnchors.push(rootChild);
        }

        const allowedNodes = new Set();
        for (const anchor of exportAnchors) {
          allowedNodes.add(anchor);
          anchor
            .getChildMeshes(false)
            .forEach((childMesh) => allowedNodes.add(childMesh));
        }

        const hasDirectRootChild = (node) =>
          typeof node?.getChildMeshes === "function" &&
          node.getChildMeshes(true).some((child) => child.name === "__root__");
        const wrapperNodes = [...allowedNodes].filter(
          (node) => node.name !== "__root__" && hasDirectRootChild(node),
        );

        const childMeshes = mesh.getChildMeshes(false);
        const meshList = [mesh, ...childMeshes];
        if (format === "STL") {
          flock.EXPORT.STLExport.CreateSTL(
            meshList,
            true,
            mesh.name,
            false,
            false,
          );
        } else if (format === "OBJ") {
          flock.EXPORT.OBJExport.OBJ(mesh);
        } else if (format === "GLB") {
          const ghostMat = new flock.BABYLON.PBRMaterial(
            "_tmpExportWrapperGhost",
            flock.scene,
          );
          ghostMat.alpha = 0;
          ghostMat.alphaMode = flock.BABYLON.Engine.ALPHA_BLEND;
          ghostMat.transparencyMode =
            flock.BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
          ghostMat.disableLighting = true;
          ghostMat.metallic = 0;
          ghostMat.roughness = 1;
          ghostMat.albedoColor = new flock.BABYLON.Color4(1, 1, 1, 0);

          const wrapperPatches = wrapperNodes.map((wrapperMesh) => ({
            wrapperMesh,
            prevMaterial: wrapperMesh.material ?? null,
          }));
          for (const { wrapperMesh } of wrapperPatches) {
            wrapperMesh.material = ghostMat;
          }

          mesh.flipFaces();
          try {
            await flock.EXPORT.GLTF2Export.GLBAsync(
              flock.scene,
              mesh.name + ".glb",
              {
                shouldExportNode: (node) => allowedNodes.has(node),
              },
            ).then((glb) => {
              glb.downloadFiles();
            });
          } finally {
            mesh.flipFaces();
            for (const { wrapperMesh, prevMaterial } of wrapperPatches) {
              wrapperMesh.material = prevMaterial;
            }
            ghostMat.dispose();
          }
        }
        resolve();
      });
    });
  },
};
