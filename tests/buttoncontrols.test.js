import { expect } from "chai";

export function runButtonControlsTests(flock) {
  describe("buttonControls function tests", function () {
    beforeEach(function () {
      flock.displayScale = 1;
    });

    afterEach(function () {
      if (flock.controlsTexture) {
        flock.controlsTexture.dispose();
        flock.controlsTexture = null;
      }
      flock.inputManager._clearAllKeys();
    });

    // buttonControls tests
    describe("buttonControls function tests", function () {
      it('should create controlsTexture when mode is "ENABLED"', function () {
        flock.buttonControls("BOTH", "ENABLED");
        expect(flock.controlsTexture).to.exist;
      });

      it('should not create controlsTexture when mode is "DISABLED"', function () {
        flock.buttonControls("BOTH", "DISABLED");
        expect(flock.controlsTexture).to.be.null;
      });

      it('should dispose an existing controlsTexture when mode is "DISABLED"', function () {
        flock.buttonControls("BOTH", "ENABLED");
        const first = flock.controlsTexture;
        expect(first).to.exist;
        flock.buttonControls("BOTH", "DISABLED");
        expect(flock.controlsTexture).to.be.null;
      });

      it('should add arrow controls when control is "ARROWS"', function () {
        flock.buttonControls("ARROWS", "ENABLED");
        expect(flock.controlsTexture).to.exist;
        expect(flock.controlsTexture.getDescendants().length).to.be.greaterThan(
          0,
        );
      });

      it('should add action controls when control is "ACTIONS"', function () {
        flock.buttonControls("ACTIONS", "ENABLED");
        expect(flock.controlsTexture).to.exist;
        expect(flock.controlsTexture.getDescendants().length).to.be.greaterThan(
          0,
        );
      });

      it("should replace the previous texture when called twice", function () {
        flock.buttonControls("BOTH", "ENABLED");
        const first = flock.controlsTexture;
        flock.buttonControls("BOTH", "ENABLED");
        expect(flock.controlsTexture).to.exist;
        expect(flock.controlsTexture).to.not.equal(first);
      });
    });

    // createSmallButton tests
    describe("createSmallButton function tests", function () {
      beforeEach(function () {
        flock.controlsTexture =
          flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "TestControls",
            true,
            flock.scene,
          );
      });

      it("should return undefined when controlsTexture is missing", function () {
        flock.controlsTexture.dispose();
        flock.controlsTexture = null;
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        expect(button).to.be.undefined;
      });

      it("should return a button with the correct text", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        expect(button).to.exist;
        expect(button.textBlock.text).to.equal("△");
      });

      it("should set width and height to 70px at default displayScale", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        expect(button.width).to.equal("70px");
        expect(button.height).to.equal("70px");
      });

      it("should set font size to 40px at default displayScale", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        expect(button.fontSize).to.equal("40px");
      });

      it("should apply the specified color", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "red");
        expect(button.color).to.equal("red");
      });

      it("should register key in inputManager on pointer down", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.true;
      });

      it("should clear key from inputManager on pointer up", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerUpObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.false;
      });

      it("should clear key from inputManager on pointer out", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerOutObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.false;
      });

      it("should register all keys in inputManager when an array is provided", function () {
        const button = flock.createSmallButton("△", ["w", "ArrowUp"], "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("w")).to.be.true;
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.true;
      });

      it("should clear all keys from inputManager on release when an array is provided", function () {
        const button = flock.createSmallButton("△", ["w", "ArrowUp"], "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerUpObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("w")).to.be.false;
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.false;
      });
    });

    // createArrowControls tests
    describe("createArrowControls function tests", function () {
      it("should return early without error when controlsTexture is missing", function () {
        expect(() => flock.createArrowControls("#ffffff")).to.not.throw();
      });

      it("should add controls to controlsTexture", function () {
        flock.controlsTexture =
          flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "TestControls",
            true,
            flock.scene,
          );
        flock.createArrowControls("#ffffff");
        expect(flock.controlsTexture.getDescendants().length).to.be.greaterThan(
          0,
        );
      });

      it("should create an up arrow button that registers ArrowUp in inputManager", function () {
        flock.controlsTexture =
          flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "TestControls",
            true,
            flock.scene,
          );
        flock.createArrowControls("#ffffff");
        const upBtn = flock.controlsTexture
          .getDescendants()
          .find((c) => c.textBlock?.text === "△");
        expect(upBtn).to.exist;
        upBtn.onPointerDownObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("ArrowUp")).to.be.true;
      });
    });

    // createButtonControls tests
    describe("createButtonControls function tests", function () {
      it("should return early without error when controlsTexture is missing", function () {
        expect(() => flock.createButtonControls("#ffffff")).to.not.throw();
      });

      it("should add controls to controlsTexture", function () {
        flock.controlsTexture =
          flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "TestControls",
            true,
            flock.scene,
          );
        flock.createButtonControls("#ffffff");
        expect(flock.controlsTexture.getDescendants().length).to.be.greaterThan(
          0,
        );
      });

      it("should create a ① button that registers the e key in inputManager", function () {
        flock.controlsTexture =
          flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "TestControls",
            true,
            flock.scene,
          );
        flock.createButtonControls("#ffffff");
        const btn1 = flock.controlsTexture
          .getDescendants()
          .find((c) => c.textBlock?.text === "①");
        expect(btn1).to.exist;
        btn1.onPointerDownObservable.notifyObservers({});
        expect(flock.inputManager.isKeyDown("e")).to.be.true;
      });
    });
  });
}
