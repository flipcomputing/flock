import { expect } from "chai";

export function runButtonControlsTests(flock) {
  describe("buttonControls function tests", function () {
    beforeEach(function () {
      flock.canvas ??= {};
      flock.canvas.pressedButtons ??= new Set();
      flock.displayScale ??= 1;
      flock.gridKeyPressObservable ??= new flock.BABYLON.Observable();
      flock.gridKeyReleaseObservable ??= new flock.BABYLON.Observable();
    });

    afterEach(function () {
      if (flock.controlsTexture) {
        flock.controlsTexture.dispose();
        flock.controlsTexture = null;
      }
      flock.canvas.pressedButtons.clear();
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

      it("should add key to pressedButtons on pointer down", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.true;
      });

      it("should remove key from pressedButtons on pointer up", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerUpObservable.notifyObservers({});
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.false;
      });

      it("should remove key from pressedButtons on pointer out", function () {
        const button = flock.createSmallButton("△", "ArrowUp", "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerOutObservable.notifyObservers({});
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.false;
      });

      it("should add all keys when an array is provided", function () {
        const button = flock.createSmallButton("△", ["w", "ArrowUp"], "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        expect(flock.canvas.pressedButtons.has("w")).to.be.true;
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.true;
      });

      it("should remove all keys on release when an array is provided", function () {
        const button = flock.createSmallButton("△", ["w", "ArrowUp"], "#ffffff");
        button.onPointerDownObservable.notifyObservers({});
        button.onPointerUpObservable.notifyObservers({});
        expect(flock.canvas.pressedButtons.has("w")).to.be.false;
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.false;
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

      it("should create an up arrow button that maps ArrowUp", function () {
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
        expect(flock.canvas.pressedButtons.has("ArrowUp")).to.be.true;
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

      it("should create a ① button that maps the e key", function () {
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
        expect(flock.canvas.pressedButtons.has("e")).to.be.true;
      });
    });
  });
}
