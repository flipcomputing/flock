import { expect } from "chai";
import {
  attachInteractIndicator,
  detachInteractIndicator,
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
        player.metadata = { isPlayer: true };

        const mesh = makeMesh("_test_far", [0, 0, 5]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("player mesh with actionManager is never targeted", function () {
        const player = makeMesh("_test_pawn", [0, 0, 0]);
        player.metadata = { isPlayer: true };
        player.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        // No other interactable — should have no target.
        fireFrame();

        expect(getIcon().isVisible).to.be.false;
      });

      it("descendant of player mesh with actionManager is never targeted", function () {
        const player = makeMesh("_test_pawn2", [0, 0, 0]);
        player.metadata = { isPlayer: true };

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
        player.metadata = { isPlayer: true };

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
        // Camera at (0,0,-3). Interactable at (0,0,5): 8 units from camera (out of range).
        // Player at (0,0,4): 1 unit from interactable (in range).
        // Without player: icon hidden. With player: icon visible.
        const interactable = makeMesh("_test_range_i", [0, 0, 5]);
        interactable.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        // First verify: no player → out of range, icon hidden.
        fireFrame();
        expect(getIcon().isVisible).to.be.false;

        // Add player near the interactable.
        const player = makeMesh("_test_range_p", [0, 0, 4]);
        player.metadata = { isPlayer: true };

        fireFrame();
        // Interactable is 1 unit from player anchor → within 4-unit range → icon visible.
        expect(getIcon().isVisible).to.be.true;
      });

      it("without a player mesh, any aimed-at interactable is shown regardless of distance", function () {
        // No player: range filter does not apply. Mesh is in front but far from camera.
        const mesh = makeMesh("_test_cam_anchor", [0, 0, 20]);
        mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);

        fireFrame();

        expect(getIcon().isVisible).to.be.true;
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
    });
  });
}
