import { expect } from "chai";

export function runXRTests(flock) {
  describe("XR API @xr", function () {
    describe("setCameraBackground", function () {
      it("should not throw when called with 'user'", function () {
        expect(() => flock.setCameraBackground("user")).to.not.throw();
      });

      it("should not throw when called with 'environment'", function () {
        expect(() => flock.setCameraBackground("environment")).to.not.throw();
      });
    });

    describe("setXRMode", function () {
      let originalInitializeXR;
      let originalPrintText;

      beforeEach(function () {
        // WebXR and i18n are unavailable in headless — stub all three
        originalInitializeXR = flock.initializeXR;
        flock.initializeXR = async () => {};
        originalPrintText = flock.printText;
        flock.printText = () => {};
        window.translate = (key) => key;
      });

      afterEach(function () {
        flock.initializeXR = originalInitializeXR;
        flock.printText = originalPrintText;
        delete window.translate;
      });

      it("should not throw for VR mode", async function () {
        await flock.setXRMode("VR");
      });

      it("should not throw for AR mode", async function () {
        await flock.setXRMode("AR");
      });
    });
  });
}
