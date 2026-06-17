import { expect } from "chai";
import {
  attachInteractIndicator,
  detachInteractIndicator,
  setInteractIndicatorEnabled,
} from "../../ui/interactIndicator.js";

const ICON_MESH_NAME = "__flock_interact_indicator";

export function runInteractIndicatorTests(flock) {
  describe("interact indicator @interact-indicator", function () {
    let testMeshes = [];

    function getIcon() {
      return flock.scene.getMeshByName(ICON_MESH_NAME);
    }

    function fireFrame() {
      flock.scene.onBeforeRenderObservable.notifyObservers(flock.scene);
    }

    function makeMesh(name, position) {
      const mesh = flock.BABYLON.MeshBuilder.CreateBox(
        name,
        { size: 1 },
        flock.scene,
      );
      mesh.position.copyFromFloats(...position);
      mesh.computeWorldMatrix(true);
      testMeshes.push(mesh);
      return mesh;
    }

    // Moves camera to (0,0,-3) looking along +Z, returns a restore function.
    function aimCameraAtOrigin() {
      const cam = flock.scene.activeCamera;
      const savedPos = cam.position.clone();
      const savedRot = cam.rotation.clone();
      cam.position.copyFromFloats(0, 0, -3);
      cam.setTarget(new flock.BABYLON.Vector3(0, 0, 0));
      return () => {
        cam.position.copyFrom(savedPos);
        cam.rotation.copyFrom(savedRot);
      };
    }

    beforeEach(function () {
      testMeshes = [];
      attachInteractIndicator(flock.scene, flock.inputManager);
    });

    afterEach(function () {
      detachInteractIndicator();
      flock.inputManager._clearAllKeys();
      flock.inputManager.resetActionKeys();
      for (const mesh of testMeshes) {
        if (mesh.actionManager) mesh.actionManager.dispose();
        if (!mesh.isDisposed()) mesh.dispose();
      }
      testMeshes = [];
      // Clear any camera following state set by tests.
      const cam = flock.scene.activeCamera;
      if (cam?.metadata) cam.metadata.following = null;
    });

    it("icon is not visible when no meshes have an actionManager", function () {
      fireFrame();
      expect(getIcon().isVisible).to.be.false;
    });

    it("icon mesh is removed from the scene after detach", function () {
      expect(getIcon()).to.exist;
      detachInteractIndicator();
      expect(flock.scene.getMeshByName(ICON_MESH_NAME)).to.be.null;
    });

    it("repeated attach and detach does not leak meshes", function () {
      detachInteractIndicator();
      const baseline = flock.scene.meshes.length;

      for (let i = 0; i < 3; i++) {
        attachInteractIndicator(flock.scene, flock.inputManager);
        detachInteractIndicator();
      }

      expect(flock.scene.meshes.length).to.equal(baseline);
    });

    it("BUTTON2 with no interactable does not call processTrigger", function () {
      const mesh = makeMesh("_test_no_target", [0, 0, 0]);

      // Frame fires with no interactables → _currentTarget stays null
      fireFrame();

      // Attach actionManager and spy after the frame, so the mesh was not the target
      mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);
      const triggered = [];
      const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
      mesh.actionManager.processTrigger = (trigger, evt) => {
        triggered.push(trigger);
        orig(trigger, evt);
      };

      flock.inputManager._setKey("e", true);

      expect(triggered).to.be.empty;
    });

    // Tests that require the camera at (0,0,-3) aimed along +Z at the origin.
    describe("with camera aimed along +Z", function () {
      let restoreCamera;

      beforeEach(function () {
        restoreCamera = aimCameraAtOrigin();
      });

      afterEach(function () {
        restoreCamera();
      });

      it("icon is visible and near the only interactable mesh", function () {
        const mesh = makeMesh("_test_single", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        const icon = getIcon();
        expect(icon.isVisible).to.be.true;
        const dist = flock.BABYLON.Vector3.Distance(
          icon.position,
          mesh.getAbsolutePosition(),
        );
        expect(dist).to.be.lessThan(2);
      });

      it("ray hits an interactable: that mesh becomes the target", function () {
        // Mesh at origin, camera at (0,0,-3) looking along +Z — ray hits mesh.
        const mesh = makeMesh("_test_ray_hit", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.true;
        // Icon should be near the mesh, not some other location.
        const dist = flock.BABYLON.Vector3.Distance(
          getIcon().position,
          mesh.getAbsolutePosition(),
        );
        expect(dist).to.be.lessThan(2);
      });

      it("ray hits nothing, fallback selects interactable within forward cone and range", function () {
        // Mesh slightly off-center but within 10° of camera forward (+Z) and within 4 units.
        // Camera at (0,0,-3): a mesh at (0.05, 0, 0) is off the ray but within a small angle.
        // Angle ≈ atan(0.05/3) ≈ 0.95° — well inside 10°.
        const mesh = makeMesh("_test_fallback", [0.05, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        // Icon should be visible — fallback should have picked the mesh.
        expect(getIcon().isVisible).to.be.true;
        const dist = flock.BABYLON.Vector3.Distance(
          getIcon().position,
          mesh.getAbsolutePosition(),
        );
        expect(dist).to.be.lessThan(2);
      });

      it("ray hits nothing, no interactable in forward cone: target is null and icon hidden", function () {
        // Mesh far to the side — beyond 45° of camera forward.
        // Camera at (0,0,-3), mesh at (4, 0, 0). Angle from +Z ≈ atan(4/3) ≈ 53°.
        const mesh = makeMesh("_test_wide", [4, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("target outside 4-unit range from player: target is null and icon hidden", function () {
        // Player at origin, interactable at (0,0,5): 5 units from player → out of range.
        const player = makeMesh("_test_range_player", [0, 0, 0]);
        flock.scene.activeCamera.metadata = { following: player };

        const mesh = makeMesh("_test_far", [0, 0, 5]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("player mesh with actionManager is never targeted", function () {
        const player = makeMesh("_test_pawn", [0, 0, 0]);
        flock.scene.activeCamera.metadata = { following: player };
        player.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        // No other interactable — should have no target.
        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("descendant of player mesh with actionManager is never targeted", function () {
        const player = makeMesh("_test_pawn2", [0, 0, 0]);
        flock.scene.activeCamera.metadata = { following: player };

        const child = makeMesh("_test_child", [0, 0, 0]);
        child.parent = player;
        child.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("player mesh under aim ray does not block interactable behind it", function () {
        // Player at (0,0,-1), interactable at (0,0,0). Both along +Z ray from (0,0,-3).
        // Ray predicate excludes player → interactable is picked.
        const player = makeMesh("_test_pawn3", [0, 0, -1]);
        flock.scene.activeCamera.metadata = { following: player };

        const interactable = makeMesh("_test_behind", [0, 0, 0]);
        interactable.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.true;
        const dist = flock.BABYLON.Vector3.Distance(
          getIcon().position,
          interactable.getAbsolutePosition(),
        );
        expect(dist).to.be.lessThan(2);
      });

      it("with a player mesh, range anchor is the player position", function () {
        // Camera at (0,0,-3). Interactable at (0,0,20): 23 units from camera,
        // beyond the 12-unit free-camera cap. Player at (0,0,18): 2 units from
        // the interactable, within the 4-unit player range.
        // Without player: out of camera range → icon hidden.
        // With player: within player range → icon visible (range anchors on the player).
        const interactable = makeMesh("_test_range_i", [0, 0, 20]);
        interactable.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        // First verify: no player → out of camera range, icon hidden.
        fireFrame();
        expect(getIcon().isVisible).to.be.false;

        // Add player near the interactable.
        const player = makeMesh("_test_range_p", [0, 0, 18]);
        flock.scene.activeCamera.metadata = { following: player };

        fireFrame();
        // Interactable is 2 units from player anchor → within 4-unit range → icon visible.
        expect(getIcon().isVisible).to.be.true;
      });

      it("without a player mesh, an aimed-at interactable beyond the free-camera range is hidden", function () {
        // No player: the range filter anchors at the camera with the 12-unit
        // free-camera cap. A mesh aimed straight at but ~23 units away is out of
        // range, so the icon stays hidden. (Within-range free-camera targeting
        // is covered by the single-mesh tests above.)
        const mesh = makeMesh("_test_cam_anchor", [0, 0, 20]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("BUTTON2 fires OnPickTrigger on the target mesh", function () {
        const mesh = makeMesh("_test_btn2_pick", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        fireFrame();
        flock.inputManager._setKey("e", true);

        expect(triggered).to.include(flock.BABYLON.ActionManager.OnPickTrigger);
      });

      it("BUTTON2 fires OnLeftPickTrigger on the target mesh", function () {
        const mesh = makeMesh("_test_btn2_leftpick", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        fireFrame();
        flock.inputManager._setKey("e", true);

        expect(triggered).to.include(flock.BABYLON.ActionManager.OnLeftPickTrigger);
      });

      it("when_clicked handler on target mesh runs when BUTTON2 fires", function () {
        const mesh = makeMesh("_test_btn2_handler", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        let clicked = 0;
        mesh.actionManager.registerAction(
          new flock.BABYLON.ExecuteCodeAction(
            flock.BABYLON.ActionManager.OnPickTrigger,
            () => { clicked++; },
          ),
        );

        fireFrame();
        flock.inputManager._setKey("e", true);

        expect(clicked).to.equal(1);
      });

      it("after detachInteractIndicator BUTTON2 does not trigger the mesh", function () {
        const mesh = makeMesh("_test_btn2_detach", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        fireFrame();
        detachInteractIndicator();
        flock.inputManager._setKey("e", true);

        expect(triggered).to.be.empty;
      });

      it("after setActionKey on BUTTON2, icon is hidden and bound key does not invoke processTrigger", function () {
        const mesh = makeMesh("_test_override", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        flock.inputManager.setActionKey("BUTTON2", "q");

        fireFrame();
        expect(getIcon().isVisible).to.be.false;

        flock.inputManager._setKey("q", true);
        expect(triggered).to.be.empty;
      });

      it("after resetActionKeys, icon reappears and BUTTON2 fires the click", function () {
        const mesh = makeMesh("_test_reset", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        flock.inputManager.setActionKey("BUTTON2", "q");
        fireFrame();
        expect(getIcon().isVisible).to.be.false;

        flock.inputManager.resetActionKeys();
        fireFrame();
        expect(getIcon().isVisible).to.be.true;

        flock.inputManager._setKey("e", true);
        expect(triggered).to.include(flock.BABYLON.ActionManager.OnPickTrigger);
      });

      it("when disabled, the icon stays hidden for an aimed-at interactable", function () {
        const mesh = makeMesh("_test_disabled", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        // Enabled by default → visible.
        fireFrame();
        expect(getIcon().isVisible).to.be.true;

        // Disable → hidden immediately and stays hidden across frames.
        setInteractIndicatorEnabled(false);
        expect(getIcon().isVisible).to.be.false;
        fireFrame();
        expect(getIcon().isVisible).to.be.false;
      });

      it("re-enabling restores the icon for an aimed-at interactable", function () {
        const mesh = makeMesh("_test_reenable", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        setInteractIndicatorEnabled(false);
        fireFrame();
        expect(getIcon().isVisible).to.be.false;

        setInteractIndicatorEnabled(true);
        fireFrame();
        expect(getIcon().isVisible).to.be.true;
      });

      it("when disabled, BUTTON2 does not trigger the mesh", function () {
        const mesh = makeMesh("_test_disabled_btn2", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        const triggered = [];
        const orig = mesh.actionManager.processTrigger.bind(mesh.actionManager);
        mesh.actionManager.processTrigger = (trigger, evt) => {
          triggered.push(trigger);
          orig(trigger, evt);
        };

        setInteractIndicatorEnabled(false);
        fireFrame();
        flock.inputManager._setKey("e", true);

        expect(triggered).to.be.empty;
      });

      it("attach resets the enabled state to on", function () {
        setInteractIndicatorEnabled(false);
        // Re-attach (as a fresh scene would) and confirm the indicator is back on.
        detachInteractIndicator();
        attachInteractIndicator(flock.scene, flock.inputManager);

        const mesh = makeMesh("_test_attach_reset", [0, 0, 0]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();
        expect(getIcon().isVisible).to.be.true;
      });
    });
  });
}
