import { expect } from "chai";

// Test suite for UIText and UIButton functions
export function runUITests(flock) {
	describe("UIText and UIButton function tests", function () {
		// Set up the scene before each test
		beforeEach(async function () {
			// Ensure the scene and GUI are initialized
			flock.scene ??= {};
			flock.GUI ??= {};
			flock.scene.UITexture ??= flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
			flock.scene.UITexture.controls ??= [];
			flock.abortController ??= new AbortController();
		});

		// Clean up after each test
		afterEach(function () {
			// Dispose of all controls in the UI texture
			if (flock.scene.UITexture && flock.scene.UITexture.controls) {
				flock.scene.UITexture.controls.forEach(control => control.dispose());
				flock.scene.UITexture.controls = [];
			}
		});

		// UIText Tests
		describe("UIText function tests", function () {
			it("should create a new text block with the correct properties", function () {
				const textId = flock.UIText("Hello, World!", 100, 100, 24, "red", 0, "myText");
				const textBlock = flock.scene.UITexture.getControlByName(textId);

				// Assert the text block exists and has the correct properties
				expect(textBlock).to.exist;
				expect(textBlock.text).to.equal("Hello, World!");
				expect(textBlock.color).to.equal("red");
				expect(textBlock.fontSize).to.equal("24px");
				expect(textBlock.left).to.equal("100px");
				expect(textBlock.top).to.equal("100px");
				expect(textBlock.isVisible).to.be.true;
			});

			it("should reuse and update an existing text block", function () {
				// Create the first text block
				flock.UIText("Hello, World!", 100, 100, 24, "red", 0, "myText");

				// Update the text block with new properties
				flock.UIText("Updated Text!", 200, 200, 30, "blue", 0, "myText");
				const textBlock = flock.scene.UITexture.getControlByName("myText");

				// Assert the text block was updated
				expect(textBlock.text).to.equal("Updated Text!");
				expect(textBlock.color).to.equal("blue");
				expect(textBlock.fontSize).to.equal("30px");
				expect(textBlock.left).to.equal("200px");
				expect(textBlock.top).to.equal("200px");
				expect(textBlock.isVisible).to.be.true;
			});

			it("should hide the text block after the specified duration", function (done) {
				this.timeout(5000); // Increase the timeout for this test

				// Create a text block with a duration
				flock.UIText("Hello, World!", 100, 100, 24, "red", 2, "myText");

				// Wait for the duration to expire
				setTimeout(() => {
					const textBlock = flock.scene.UITexture.getControlByName("myText");
					expect(textBlock.isVisible).to.be.false; // Assert the text block is hidden
					done();
				}, 2500); // Wait slightly longer than the duration
			});

			it("should show the text block again using the show function", function (done) {
				this.timeout(5000); // Increase the timeout for this test

				// Create a text block with a duration
				flock.UIText("Hello, World!", 100, 100, 24, "red", 2, "myText");

				// Wait for the duration to expire
				setTimeout(() => {
					// Show the text block again
					flock.show("myText");

					const textBlock = flock.scene.UITexture.getControlByName("myText");
					expect(textBlock.isVisible).to.be.true; // Assert the text block is visible
					done();
				}, 2500); // Wait slightly longer than the duration
			});

			it("should handle frequent updates without errors", function () {
				this.timeout(10000); // Increase the timeout for this test

				const textId = "stressTestText";
				const iterations = 100; // Number of updates
				let lastText = "";
				let lastX = 0;
				let lastY = 0;
				let lastFontSize = 0;
				let lastColor = "";

				// Perform frequent updates
				for (let i = 0; i < iterations; i++) {
					const newText = `Update ${i + 1}`;
					const newX = Math.floor(Math.random() * 800); // Random x position
					const newY = Math.floor(Math.random() * 600); // Random y position
					const newFontSize = 10 + Math.floor(Math.random() * 20); // Random font size
					const newColor = ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)]; // Random color

					// Update the text block
					flock.UIText(newText, newX, newY, newFontSize, newColor, 0, textId);

					// Track the last update
					lastText = newText;
					lastX = newX;
					lastY = newY;
					lastFontSize = newFontSize;
					lastColor = newColor;
				}

				// Retrieve the text block after all updates
				const textBlock = flock.scene.UITexture.getControlByName(textId);

				// Assert the text block reflects the final update
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
				const buttonId = flock.UIButton("Click Me", 100, 100, "MEDIUM", 20, "black", "yellow", "myButton");
				const button = flock.scene.UITexture.getControlByName(buttonId);

				// Assert the button exists and has the correct properties
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
				// Create a button
				flock.UIButton("Click Me", 100, 100, "MEDIUM", 20, "black", "yellow", "myButton");

				// Hide the button
				flock.hide("myButton");

				const button = flock.scene.UITexture.getControlByName("myButton");
				expect(button.isVisible).to.be.false; // Assert the button is hidden
			});

			it("should show the button again using the show function", function () {
				// Create a button
				flock.UIButton("Click Me", 100, 100, "MEDIUM", 20, "black", "yellow", "myButton");

				// Hide the button
				flock.hide("myButton");

				// Show the button again
				flock.show("myButton");

				const button = flock.scene.UITexture.getControlByName("myButton");
				expect(button.isVisible).to.be.true; // Assert the button is visible
			});
		});
	});
}