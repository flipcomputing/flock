import { expect } from "chai";

function waitForModel(flock, meshName) {
  return new Promise((resolve) => {
    flock.whenModelReady(meshName, (mesh) => resolve(mesh));
  });
}

export function runXRExportTests(flock) {
  describe("XR exportMesh GLB tests @new", function () {
    this.timeout(20000);

    it("preserves attached children when exporting a wrapper model", async function () {
      const hutId = flock.createObject({
        modelName: "hut.glb",
        modelId: `hut.glb__export_parent_${Date.now()}`,
        position: { x: 0, y: 0, z: 0 },
      });
      const treeId = flock.createObject({
        modelName: "tree.glb",
        modelId: `tree.glb__export_child_${Date.now()}`,
        position: { x: 2, y: 0, z: 0 },
      });

      const [hutMesh, treeMesh] = await Promise.all([
        waitForModel(flock, hutId),
        waitForModel(flock, treeId),
      ]);
      await flock.setParent(hutId, treeId);

      const rootChild = hutMesh
        .getChildMeshes()
        .find((child) => child.name === "__root__");

      const originalGLBAsync = flock.EXPORT.GLTF2Export.GLBAsync;
      let shouldExportNode;
      flock.EXPORT.GLTF2Export.GLBAsync = async (
        _scene,
        _filename,
        options,
      ) => {
        shouldExportNode = options?.shouldExportNode;
        return { downloadFiles() {} };
      };

      try {
        await flock.exportMesh(hutId, "GLB");
      } finally {
        flock.EXPORT.GLTF2Export.GLBAsync = originalGLBAsync;
      }

      expect(shouldExportNode).to.be.a("function");
      expect(shouldExportNode(hutMesh)).to.equal(true);
      expect(shouldExportNode(treeMesh)).to.equal(true);
      if (rootChild) {
        expect(shouldExportNode(rootChild)).to.equal(true);
      }
    });

    it("keeps regular single-model export coverage", async function () {
      const treeId = flock.createObject({
        modelName: "tree.glb",
        modelId: `tree.glb__single_export_${Date.now()}`,
        position: { x: -2, y: 0, z: 0 },
      });
      const treeMesh = await waitForModel(flock, treeId);

      const originalGLBAsync = flock.EXPORT.GLTF2Export.GLBAsync;
      let shouldExportNode;
      flock.EXPORT.GLTF2Export.GLBAsync = async (
        _scene,
        _filename,
        options,
      ) => {
        shouldExportNode = options?.shouldExportNode;
        return { downloadFiles() {} };
      };

      try {
        await flock.exportMesh(treeId, "GLB");
      } finally {
        flock.EXPORT.GLTF2Export.GLBAsync = originalGLBAsync;
      }

      expect(shouldExportNode).to.be.a("function");
      expect(shouldExportNode(treeMesh)).to.equal(true);

      const exportedDescendants = treeMesh
        .getChildMeshes(false)
        .filter((mesh) => shouldExportNode(mesh));
      expect(exportedDescendants.length).to.be.greaterThan(0);
    });
  });
}
