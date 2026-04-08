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

      const hutRootChild = hutMesh
        .getChildMeshes()
        .find((child) => child.name === "__root__");
      const treeRootChild = treeMesh
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
      if (hutRootChild) {
        expect(shouldExportNode(hutMesh)).to.equal(true);
        expect(shouldExportNode(hutRootChild)).to.equal(true);
      } else {
        expect(shouldExportNode(hutMesh)).to.equal(true);
      }
      if (treeRootChild) {
        expect(shouldExportNode(treeMesh)).to.equal(true);
        expect(shouldExportNode(treeRootChild)).to.equal(true);
      } else {
        expect(shouldExportNode(treeMesh)).to.equal(true);
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
      const treeRootChild = treeMesh
        .getChildMeshes()
        .find((child) => child.name === "__root__");
      if (treeRootChild) {
        expect(shouldExportNode(treeMesh)).to.equal(true);
        expect(shouldExportNode(treeRootChild)).to.equal(true);
      } else {
        expect(shouldExportNode(treeMesh)).to.equal(true);
      }

      const exportedDescendants = treeMesh
        .getChildMeshes(false)
        .filter((mesh) => shouldExportNode(mesh));
      expect(exportedDescendants.length).to.be.greaterThan(0);
    });
  });
}
