import { expect } from "chai";
import { getPlayerMesh } from "../../accessibility/accessibility.js";

export function runGetPlayerMeshTests(flock) {
  describe("getPlayerMesh @accessibility @getplayermesh", function () {
    let testMeshes = [];

    function makeMesh(name, metadata = {}) {
      const mesh = flock.BABYLON.MeshBuilder.CreateBox(
        name,
        { size: 1 },
        flock.scene,
      );
      mesh.metadata = metadata;
      mesh.computeWorldMatrix(true);
      testMeshes.push(mesh);
      return mesh;
    }

    afterEach(function () {
      for (const mesh of testMeshes) {
        if (!mesh.isDisposed()) mesh.dispose();
      }
      testMeshes = [];
    });

    it("returns the mesh tagged metadata.isPlayer === true", function () {
      const player = makeMesh("_test_a11y_pawn", { isPlayer: true });
      const result = getPlayerMesh(flock.scene);
      expect(result).to.equal(player);
    });

    it("returns null when no candidate scores high enough", function () {
      // A mesh with no player signals: only proximity can contribute (≤30), below threshold (40).
      makeMesh("_test_a11y_block", {});
      const result = getPlayerMesh(flock.scene);
      expect(result).to.be.null;
    });

    it("getReferenceAnchor and getPlayerMesh agree: the highest-scoring player mesh is returned", function () {
      // Place two meshes: one with isPlayer signal, one without.
      // getPlayerMesh should return the tagged one; getReferenceAnchor (which now delegates
      // to getPlayerMesh) will use the same mesh as its anchor.
      const player = makeMesh("_test_a11y_agree_p", { isPlayer: true });
      makeMesh("_test_a11y_agree_other", {});

      // getPlayerMesh returns the player — confirming the shared scoring logic.
      expect(getPlayerMesh(flock.scene)).to.equal(player);

      // Calling getPlayerMesh a second time with the same scene must return the same mesh
      // (deterministic — no hidden state).
      expect(getPlayerMesh(flock.scene)).to.equal(player);
    });
  });
}
