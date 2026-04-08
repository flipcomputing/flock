import { expect } from "chai";

export function runPrintTextTests(flock) {
  describe("printText function tests", function () {
    let advancedTexture;

    beforeEach(function () {
      advancedTexture =
        flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("PrintTextUI");
      flock.stackPanel = new flock.GUI.StackPanel();
      flock.stackPanel.isVertical = true;
      advancedTexture.addControl(flock.stackPanel);
      flock.abortController = new AbortController();
    });

    afterEach(function () {
      // Null the panel first so the abort handler's guard skips removeControl
      flock.stackPanel = null;
      flock.abortController.abort();
      if (advancedTexture) {
        advancedTexture.dispose();
        advancedTexture = null;
      }
    });

    it("should return early without error when stackPanel is missing", function () {
      const savedPanel = flock.stackPanel;
      flock.stackPanel = null;
      expect(() => flock.printText({ text: "test" })).to.not.throw();
      flock.stackPanel = savedPanel;
    });

    it("should add a background control to the stackPanel", function () {
      flock.printText({ text: "Hello", duration: 9999 });
      const bg = advancedTexture.getControlByName("textBackground");
      expect(bg).to.exist;
    });

    it("should display the correct text", function () {
      flock.printText({ text: "Hello World", duration: 9999 });
      const textBlock = advancedTexture.getControlByName("textBlock");
      expect(textBlock.text).to.equal("Hello World");
    });

    it("should use white as the default text color", function () {
      flock.printText({ text: "Default color", duration: 9999 });
      const textBlock = advancedTexture.getControlByName("textBlock");
      expect(textBlock.color).to.equal("white");
    });

    it("should use the specified text color", function () {
      flock.printText({ text: "Colored text", color: "red", duration: 9999 });
      const textBlock = advancedTexture.getControlByName("textBlock");
      expect(textBlock.color).to.equal("red");
    });

    it("should remove the control after the duration expires @slow", function (done) {
      this.timeout(5000);
      flock.printText({ text: "Fade out", duration: 1 });
      // Duration (1s) + fade animation (~1s for 30 frames at 30fps) + buffer
      setTimeout(() => {
        const bg = advancedTexture.getControlByName("textBackground");
        expect(bg).to.be.null;
        done();
      }, 3000);
    });
  });
}
