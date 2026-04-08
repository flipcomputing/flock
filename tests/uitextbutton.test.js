import { expect } from "chai";

// Test suite for UI controls
export function runUITests(flock) {
  describe("UIText, UIButton, UIInput, and UISlider function tests", function () {
    // Set up the scene before each test
    beforeEach(async function () {
      flock.scene ??= {};
      flock.GUI ??= {};
      flock.scene.UITexture ??=
        flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
      flock.scene.UITexture.controls ??= [];
      flock.abortController ??= new AbortController();
    });

    afterEach(function () {
      if (flock.scene.UITexture && flock.scene.UITexture.controls) {
        flock.scene.UITexture.controls.forEach((control) => control.dispose());
        flock.scene.UITexture.controls = [];
      }
    });

    // UIText Tests
    describe("UIText function tests", function () {
      it("should create a new text block with the correct properties", function () {
        const textId = flock.UIText({
          text: "Hello, World!",
          x: 100,
          y: 100,
          fontSize: 24,
          color: "red",
          duration: 0,
          id: "myText",
        });
        const textBlock = flock.scene.UITexture.getControlByName(textId);

        expect(textBlock).to.exist;
        expect(textBlock.text).to.equal("Hello, World!");
        expect(textBlock.color).to.equal("red");
        expect(textBlock.fontSize).to.equal("24px");
        expect(textBlock.left).to.equal("100px");
        expect(textBlock.top).to.equal("100px");
        expect(textBlock.isVisible).to.be.true;
      });

      it("should reuse and update an existing text block", function () {
        flock.UIText({
          text: "Hello, World!",
          x: 100,
          y: 100,
          fontSize: 24,
          color: "red",
          duration: 0,
          id: "myText",
        });

        flock.UIText({
          text: "Updated Text!",
          x: 200,
          y: 200,
          fontSize: 30,
          color: "blue",
          duration: 0,
          id: "myText",
        });
        const textBlock = flock.scene.UITexture.getControlByName("myText");

        expect(textBlock.text).to.equal("Updated Text!");
        expect(textBlock.color).to.equal("blue");
        expect(textBlock.fontSize).to.equal("30px");
        expect(textBlock.left).to.equal("200px");
        expect(textBlock.top).to.equal("200px");
        expect(textBlock.isVisible).to.be.true;
      });

      it("should dispose the text block after the specified duration @slow", function (done) {
        this.timeout(5000);

        flock.UIText({
          text: "Hello, World!",
          x: 100,
          y: 100,
          duration: 2,
          id: "myText",
        });

        setTimeout(() => {
          const textBlock = flock.scene.UITexture.getControlByName("myText");
          // The control should be disposed (null) after the duration expires.
          expect(textBlock).to.be.null;
          done();
        }, 2500);
      });

      it("should hide and then show a text block", function () {
        flock.UIText({
          text: "Hello, World!",
          x: 100,
          y: 100,
          duration: 0, // No duration, so it persists
          id: "myText",
        });

        // Hide the control
        flock.hide("myText");
        let textBlock = flock.scene.UITexture.getControlByName("myText");
        expect(textBlock.isVisible).to.be.false;

        // Show the control again
        flock.show("myText");
        textBlock = flock.scene.UITexture.getControlByName("myText");
        expect(textBlock.isVisible).to.be.true;
      });

      it("should handle frequent updates without errors", function () {
        this.timeout(10000);

        const textId = "stressTestText";
        const iterations = 100;
        let lastText = "";
        let lastX = 0;
        let lastY = 0;
        let lastFontSize = 0;
        let lastColor = "";

        for (let i = 0; i < iterations; i++) {
          const newText = `Update ${i + 1}`;
          const newX = Math.floor(Math.random() * 800);
          const newY = Math.floor(Math.random() * 600);
          const newFontSize = 10 + Math.floor(Math.random() * 20);
          const newColor = ["red", "blue", "green", "yellow"][
            Math.floor(Math.random() * 4)
          ];

          flock.UIText({
            text: newText,
            x: newX,
            y: newY,
            fontSize: newFontSize,
            color: newColor,
            duration: 0,
            id: textId,
          });

          lastText = newText;
          lastX = newX;
          lastY = newY;
          lastFontSize = newFontSize;
          lastColor = newColor;
        }

        const textBlock = flock.scene.UITexture.getControlByName(textId);

        expect(textBlock).to.exist;
        expect(textBlock.text).to.equal(lastText);
        expect(textBlock.color).to.equal(lastColor);
        expect(textBlock.fontSize).to.equal(`${lastFontSize}px`);
        expect(textBlock.left).to.equal(`${lastX}px`);
        expect(textBlock.top).to.equal(`${lastY}px`);
        expect(textBlock.isVisible).to.be.true;
      });
    });

    // UIButton Tests
    describe("UIButton function tests", function () {
      it("should create a new button with the correct properties", function () {
        const buttonId = flock.UIButton({
          text: "Click Me",
          x: 100,
          y: 100,
          width: "MEDIUM",
          textSize: 20,
          textColor: "black",
          backgroundColor: "yellow",
          buttonId: "myButton",
        });
        const button = flock.scene.UITexture.getControlByName(buttonId);

        expect(button).to.exist;
        expect(button.name).to.equal("myButton");
        expect(button.width).to.equal("150px"); // MEDIUM size
        expect(button.height).to.equal("50px"); // MEDIUM size
        expect(button.color).to.equal("black");
        expect(button.background).to.equal("yellow");
        expect(button.left).to.equal("100px");
        expect(button.top).to.equal("100px");
        expect(button.isVisible).to.be.true;
      });

      it("should hide the button using the hide function", function () {
        flock.UIButton({
          text: "Click Me",
          x: 100,
          y: 100,
          width: "MEDIUM",
          textSize: 20,
          textColor: "black",
          backgroundColor: "yellow",
          buttonId: "myButton",
        });

        flock.hide("myButton");

        const button = flock.scene.UITexture.getControlByName("myButton");
        expect(button.isVisible).to.be.false;
      });

      it("should show the button again using the show function", function () {
        flock.UIButton({
          text: "Click Me",
          x: 100,
          y: 100,
          width: "MEDIUM",
          textSize: 20,
          textColor: "black",
          backgroundColor: "yellow",
          buttonId: "myButton",
        });

        flock.hide("myButton");
        flock.show("myButton");

        const button = flock.scene.UITexture.getControlByName("myButton");
        expect(button.isVisible).to.be.true;
      });
    });

    // UISlider Tests
    describe("UISlider function tests", function () {
      it("should create a slider with the correct min, max, and value", function () {
        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 100,
          value: 50,
          x: 100,
          y: 100,
        });

        expect(slider).to.exist;
        expect(slider.minimum).to.equal(0);
        expect(slider.maximum).to.equal(100);
        expect(slider.value).to.equal(50);
      });

      it("should use MEDIUM dimensions by default", function () {
        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 10,
          value: 5,
          x: 100,
          y: 100,
        });

        expect(slider.width).to.equal("200px");
        expect(slider.height).to.equal("30px");
      });

      it("should use SMALL dimensions when specified", function () {
        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 10,
          value: 5,
          x: 100,
          y: 100,
          size: "SMALL",
        });

        expect(slider.width).to.equal("100px");
        expect(slider.height).to.equal("20px");
      });

      it("should apply the specified colors", function () {
        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 10,
          value: 5,
          x: 100,
          y: 100,
          textColor: "blue",
          backgroundColor: "lightgray",
        });

        expect(slider.color).to.equal("blue");
        expect(slider.background).to.equal("lightgray");
      });

      it("should use right alignment for negative x", function () {
        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 10,
          value: 5,
          x: -100,
          y: 100,
        });

        expect(slider.horizontalAlignment).to.equal(
          flock.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT,
        );
      });

      it("should reuse and update an existing slider", function () {
        flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 10,
          value: 5,
          x: 100,
          y: 100,
        });

        const slider = flock.UISlider({
          id: "mySlider",
          min: 0,
          max: 20,
          value: 15,
          x: 100,
          y: 100,
        });

        expect(slider.minimum).to.equal(0);
        expect(slider.maximum).to.equal(20);
        expect(slider.value).to.equal(15);
        // Only one slider with this id should exist
        expect(
          flock.scene.UITexture.getControlByName("mySlider"),
        ).to.equal(slider);
      });
    });

    // UIInput Tests
    describe("UIInput function tests", function () {
      it("should create an input and submit button in START mode", async function () {
        const inputId = await flock.UIInput({
          text: "Enter name",
          x: 100,
          y: 100,
          id: "myInput",
          mode: "START",
        });

        const input = flock.scene.UITexture.getControlByName(inputId);
        const button = flock.scene.UITexture.getControlByName(
          `submit_${inputId}`,
        );

        expect(input).to.exist;
        expect(button).to.exist;
      });

      it("should set the placeholder text on the input", async function () {
        await flock.UIInput({
          text: "Enter name",
          x: 100,
          y: 100,
          id: "myInput",
          mode: "START",
        });

        const input = flock.scene.UITexture.getControlByName("myInput");
        expect(input.placeholderText).to.equal("Enter name");
      });

      it("should apply colors and font size to the input", async function () {
        await flock.UIInput({
          text: "placeholder",
          x: 100,
          y: 100,
          id: "myInput",
          fontSize: 18,
          textColor: "red",
          backgroundColor: "lightyellow",
          mode: "START",
        });

        const input = flock.scene.UITexture.getControlByName("myInput");
        expect(input.color).to.equal("red");
        expect(input.background).to.equal("lightyellow");
        expect(input.fontSize).to.equal("18px");
      });

      it("should use MEDIUM dimensions by default", async function () {
        await flock.UIInput({
          text: "placeholder",
          x: 100,
          y: 100,
          id: "myInput",
          mode: "START",
        });

        const input = flock.scene.UITexture.getControlByName("myInput");
        expect(input.width).to.equal("300px");
        expect(input.height).to.equal("50px");
      });

      it("should position the submit button to the right of the input", async function () {
        await flock.UIInput({
          text: "placeholder",
          x: 100,
          y: 100,
          id: "myInput",
          mode: "START",
        });

        const button = flock.scene.UITexture.getControlByName("submit_myInput");
        // MEDIUM input width (300) + spacing (10) + x (100) = 410
        expect(button.left).to.equal("410px");
        expect(button.top).to.equal("100px");
      });

      it("should resolve with the input text when submit button is clicked", async function () {
        const promise = flock.UIInput({
          text: "placeholder",
          x: 100,
          y: 100,
          id: "myInput",
        });

        const input = flock.scene.UITexture.getControlByName("myInput");
        const button = flock.scene.UITexture.getControlByName("submit_myInput");

        input.text = "hello";
        button.onPointerUpObservable.notifyObservers(null);

        const result = await promise;
        expect(result).to.equal("hello");
      });

      it("should resolve with the input text when Enter is pressed", async function () {
        const promise = flock.UIInput({
          text: "placeholder",
          x: 100,
          y: 100,
          id: "myInput",
        });

        const input = flock.scene.UITexture.getControlByName("myInput");

        input.text = "world";
        input.onKeyboardEventProcessedObservable.notifyObservers({
          type: "keydown",
          key: "Enter",
        });

        const result = await promise;
        expect(result).to.equal("world");
      });
    });
  });
}
