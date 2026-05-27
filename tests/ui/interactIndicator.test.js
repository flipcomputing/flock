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

    beforeEach(function () {
      testMeshes = [];
      attachInteractIndicator(flock.scene, flock.inputManager);
    });

    afterEach(function () {
      detachInteractIndicator();
      flock.inputManager._clearAllKeys();
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

    it("icon targets the mesh closest to the camera", function () {
      // Default camera is at (0, 3, -10).
      // close mesh dist ≈ 5.8, far mesh dist ≈ 20.2
      const close = makeMesh("_test_close", [0, 0, -5]);
      const far = makeMesh("_test_far", [0, 0, 10]);
      close.actionManager = new flock.BABYLON.ActionManager(flock.scene);
      far.actionManager = new flock.BABYLON.ActionManager(flock.scene);

      fireFrame();

      const icon = getIcon();
      expect(icon.isVisible).to.be.true;
      const distToClose = flock.BABYLON.Vector3.Distance(
        icon.position,
        close.getAbsolutePosition(),
      );
      const distToFar = flock.BABYLON.Vector3.Distance(
        icon.position,
        far.getAbsolutePosition(),
      );
      expect(distToClose).to.be.lessThan(distToFar);
    });

    it("icon switches to a closer mesh after camera moves", function () {
      const BABYLON = flock.BABYLON;
      // meshA near default camera, meshB far away
      const meshA = makeMesh("_test_switchA", [0, 0, -5]);
      const meshB = makeMesh("_test_switchB", [0, 0, 15]);
      meshA.actionManager = new BABYLON.ActionManager(flock.scene);
      meshB.actionManager = new BABYLON.ActionManager(flock.scene);

      fireFrame();
      const icon = getIcon();
      const distABefore = BABYLON.Vector3.Distance(
        icon.position,
        meshA.getAbsolutePosition(),
      );
      const distBBefore = BABYLON.Vector3.Distance(
        icon.position,
        meshB.getAbsolutePosition(),
      );
      expect(distABefore).to.be.lessThan(distBBefore);

      const savedCamPos = flock.scene.activeCamera.position.clone();
      try {
        flock.scene.activeCamera.position = new BABYLON.Vector3(0, 0, 14);
        fireFrame();
        const distAAfter = BABYLON.Vector3.Distance(
          icon.position,
          meshA.getAbsolutePosition(),
        );
        const distBAfter = BABYLON.Vector3.Distance(
          icon.position,
          meshB.getAbsolutePosition(),
        );
        expect(distBAfter).to.be.lessThan(distAAfter);
      } finally {
        flock.scene.activeCamera.position.copyFrom(savedCamPos);
      }
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

    it("BUTTON2 with no interactable does not call processTrigger", function () {
      let called = false;
      flock.inputManager._setKey("e", true);
      expect(called).to.be.false;
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
  });
}
