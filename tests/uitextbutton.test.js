import { expect } from "chai";

// Test suite for UI controls
export function runUITests(flock) {
  describe("UIText, UIButton, UIInput, and UISlider function tests", function () {
	// Set up the scene before each test
	beforeEach(async function () {
	  flock.scene ??= {};
	  flock.GUI ??= {};
	  flock.scene.UITexture ??= flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
	  flock.scene.UITexture.controls ??= [];
	  flock.abortController ??= new AbortController();
	});

	afterEach(function () {
	  if (flock.scene.UITexture && flock.scene.UITexture.controls) {
		flock.scene.UITexture.controls.forEach(control => control.dispose());
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
		  id: "myText"
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
		  id: "myText"
		});

		flock.UIText({
		  text: "Updated Text!",
		  x: 200,
		  y: 200,
		  fontSize: 30,
		  color: "blue",
		  duration: 0,
		  id: "myText"
		});
		const textBlock = flock.scene.UITexture.getControlByName("myText");

		expect(textBlock.text).to.equal("Updated Text!");
		expect(textBlock.color).to.equal("blue");
		expect(textBlock.fontSize).to.equal("30px");
		expect(textBlock.left).to.equal("200px");
		expect(textBlock.top).to.equal("200px");
		expect(textBlock.isVisible).to.be.true;
	  });

	  it("should hide the text block after the specified duration", function (done) {
		this.timeout(5000);

		flock.UIText({
		  text: "Hello, World!",
		  x: 100,
		  y: 100,
		  fontSize: 24,
		  color: "red",
		  duration: 2,
		  id: "myText"
		});

		setTimeout(() => {
		  const textBlock = flock.scene.UITexture.getControlByName("myText");
		  expect(textBlock.isVisible).to.be.false;
		  done();
		}, 2500);
	  });

	  it("should show the text block again using the show function", function (done) {
		this.timeout(5000);

		flock.UIText({
		  text: "Hello, World!",
		  x: 100,
		  y: 100,
		  fontSize: 24,
		  color: "red",
		  duration: 2,
		  id: "myText"
		});

		setTimeout(() => {
		  flock.show("myText");
		  const textBlock = flock.scene.UITexture.getControlByName("myText");
		  expect(textBlock.isVisible).to.be.true;
		  done();
		}, 2500);
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
		  const newColor = ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)];

		  flock.UIText({
			text: newText,
			x: newX,
			y: newY,
			fontSize: newFontSize,
			color: newColor,
			duration: 0,
			id: textId
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
		  buttonId: "myButton"
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
		  buttonId: "myButton"
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
		  buttonId: "myButton"
		});

		flock.hide("myButton");
		flock.show("myButton");

		const button = flock.scene.UITexture.getControlByName("myButton");
		expect(button.isVisible).to.be.true;
	  });
	});

  });
}
