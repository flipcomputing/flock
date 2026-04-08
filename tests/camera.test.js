import { expect } from "chai";

export function runCameraTests(flock) {
  describe("Camera API @camera", function () {
    describe("cameraControl", function () {
      afterEach(function () {
        delete flock._cameraControlBindings;
      });

      it("should store the binding in _cameraControlBindings", function () {
        flock.cameraControl("W", "moveUp");
        expect(flock._cameraControlBindings).to.be.an("array");
        const binding = flock._cameraControlBindings.find(
          (b) => b.action === "moveUp",
        );
        expect(binding).to.exist;
        expect(binding.normalizedKey).to.equal("W".toUpperCase().charCodeAt(0));
      });

      it("should replace an existing binding for the same action", function () {
        flock.cameraControl("W", "moveUp");
        flock.cameraControl("I", "moveUp");
        const bindings = flock._cameraControlBindings.filter(
          (b) => b.action === "moveUp",
        );
        expect(bindings).to.have.length(1);
        expect(bindings[0].normalizedKey).to.equal(
          "I".toUpperCase().charCodeAt(0),
        );
      });

      it("should warn and not store a binding for an unsupported key", function () {
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(" "));
        flock.cameraControl("@@@", "moveUp");
        console.warn = original;
        expect(warnings.length).to.be.greaterThan(0);
        const binding = (flock._cameraControlBindings || []).find(
          (b) => b.action === "moveUp",
        );
        expect(binding).to.not.exist;
      });
    });

    describe("attachCamera", function () {
      const boxIds = [];
      let savedCamera;

      beforeEach(function () {
        savedCamera = flock.scene.activeCamera;
      });

      afterEach(function () {
        boxIds.forEach((id) => {
          try {
            flock.dispose(id);
          } catch (e) {
            console.warn(`Failed to dispose ${id}:`, e);
          }
        });
        boxIds.length = 0;
        flock.scene.activeCamera = savedCamera;
      });

      it("should set scene.activeCamera to an ArcRotateCamera following the mesh", async function () {
        const id = "cameraAttachBox";
        await flock.createBox(id, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        boxIds.push(id);

        await flock.attachCamera(id);

        expect(flock.scene.activeCamera).to.exist;
        expect(flock.scene.activeCamera.metadata.following).to.exist;
        expect(flock.scene.activeCamera.metadata.following.name).to.equal(id);
      });
    });

    describe("canvasControls", function () {
      it("should not throw when called with false", function () {
        expect(() => flock.canvasControls(false)).to.not.throw();
      });

      it("should not throw when called with true", function () {
        expect(() => flock.canvasControls(true)).to.not.throw();
      });
    });
  });
}
