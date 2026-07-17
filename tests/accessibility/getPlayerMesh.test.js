import { expect } from "chai";
import { getPlayerMesh } from "../../accessibility/accessibility.js";

export function runGetPlayerMeshTests(flock) {
  describe("getPlayerMesh @accessibility @getplayermesh", function () {
    let testMeshes = [];
    let originalLockedTarget;
    let originalParent;
    let originalFollowing;

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

    beforeEach(function () {
      const camera = flock.scene.activeCamera;
      originalLockedTarget = camera?.lockedTarget ?? undefined;
      originalParent = camera?.parent ?? undefined;
      originalFollowing = camera?.metadata?.following ?? undefined;
    });

    afterEach(function () {
      const camera = flock.scene.activeCamera;
      if (camera) {
        if (originalLockedTarget !== undefined) {
          camera.lockedTarget = originalLockedTarget;
        } else if ("lockedTarget" in camera) {
          camera.lockedTarget = null;
        }
        camera.parent = originalParent ?? null;
        if (camera.metadata) {
          camera.metadata.following = originalFollowing ?? undefined;
        }
      }

      for (const mesh of testMeshes) {
        if (!mesh.isDisposed()) mesh.dispose();
      }
      testMeshes = [];
    });

    it("returns the mesh set as camera.lockedTarget", function () {
      const camera = flock.scene.activeCamera;
      const player = makeMesh("_test_a11y_locked");
      camera.lockedTarget = player;
      expect(getPlayerMesh(flock.scene)).to.equal(player);
    });

    it("returns the mesh set as camera.parent", function () {
      const camera = flock.scene.activeCamera;
      const player = makeMesh("_test_a11y_parent");
      camera.parent = player;
      expect(getPlayerMesh(flock.scene)).to.equal(player);
    });

    it("returns the mesh set in camera.metadata.following", function () {
      const camera = flock.scene.activeCamera;
      const player = makeMesh("_test_a11y_following");
      camera.metadata = camera.metadata || {};
      camera.metadata.following = player;
      expect(getPlayerMesh(flock.scene)).to.equal(player);
    });

    it("returns null when no camera attachment and no high-scoring mesh", function () {
      const camera = flock.scene.activeCamera;
      if ("lockedTarget" in camera) camera.lockedTarget = null;
      camera.parent = null;
      if (camera.metadata) camera.metadata.following = undefined;
      makeMesh("_test_a11y_block", {}); // no player signals, scores below threshold
      expect(getPlayerMesh(flock.scene)).to.be.null;
    });

    it("falls back to heuristic when camera has no attached mesh", function () {
      const camera = flock.scene.activeCamera;
      if ("lockedTarget" in camera) camera.lockedTarget = null;
      camera.parent = null;
      if (camera.metadata) camera.metadata.following = undefined;
      const player = makeMesh("_test_a11y_heuristic", { isPlayer: true });
      expect(getPlayerMesh(flock.scene)).to.equal(player);
    });

    it("prefers camera attachment over heuristic match", function () {
      const camera = flock.scene.activeCamera;
      const attached = makeMesh("_test_a11y_attached");
      makeMesh("_test_a11y_heuristic2", { isPlayer: true });
      camera.lockedTarget = attached;
      expect(getPlayerMesh(flock.scene)).to.equal(attached);
    });

    it("prefers lockedTarget over metadata.following", function () {
      const camera = flock.scene.activeCamera;
      const locked = makeMesh("_test_a11y_locked2");
      const following = makeMesh("_test_a11y_following2");
      camera.lockedTarget = locked;
      camera.metadata = camera.metadata || {};
      camera.metadata.following = following;
      expect(getPlayerMesh(flock.scene)).to.equal(locked);
    });
  });
}
