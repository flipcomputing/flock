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
  exportMesh(meshName, format) {
    //meshName = "scene";

    if (meshName === "scene" && format === "GLB") {
      const scene = flock.scene;

      const cls = (n) => n?.getClassName?.();
      const isEnabledDeep = (n) =>
        typeof n.isEnabled === "function" ? n.isEnabled(true) : true;

      // Treat ALL mesh subclasses as geometry; we'll still skip LinesMesh explicitly
      const isAbstractMesh = (n) =>
        typeof BABYLON !== "undefined" && n instanceof BABYLON.AbstractMesh;
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
      const ghostMat = new BABYLON.PBRMaterial("_tmpExportGhost", scene);
      ghostMat.alpha = 0;
      ghostMat.alphaMode = BABYLON.Engine.ALPHA_BLEND;
      ghostMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
      ghostMat.disableLighting = true;
      ghostMat.metallic = 0;
      ghostMat.roughness = 1;
      ghostMat.albedoColor = new BABYLON.Color4(1, 1, 1, 0);

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
        const rootChild = mesh
          .getChildMeshes()
          .find((child) => child.name === "__root__");
        if (rootChild) {
          mesh = rootChild;
        }
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
          mesh.flipFaces();
          await flock.EXPORT.GLTF2Export.GLBAsync(flock.scene, mesh.name + ".glb", {
            shouldExportNode: (node) =>
              node === mesh || mesh.getChildMeshes().includes(node),
          }).then((glb) => {
            mesh.flipFaces();
            glb.downloadFiles();
          });
        }
        resolve();
      });
    });
  },
};
