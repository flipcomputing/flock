import { expect } from "chai";

export function runMaterialsTests(flock) {
	describe("Effects methods", function () {
		const boxIds = [];
		const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];
		const alphas = [0.1, 0.5, 0.9];

		// Utility: Create a box with random color and position
		async function createBoxWithColorAndPosition(id) {
			const color = colors[Math.floor(Math.random() * colors.length)];
			const position = new flock.BABYLON.Vector3(
				Math.random() * 10,
				Math.random() * 10,
				Math.random() * 10,
			);

			await flock.createBox(id, {
				width: 1,
				height: 1,
				depth: 1,
				color,
				position,
			});

			return { id, color, position };
		}

		beforeEach(async function () {
			flock.scene ??= {};
		});

		afterEach(function () {
			boxIds.forEach((boxId) => {
				flock.dispose(boxId);
			});
			boxIds.length = 0;
		});

		it("should apply tint to a mesh", async function () {
			const { id, color } =
				await createBoxWithColorAndPosition("boxTint");
			boxIds.push(id);

			await flock.tint(id, { color });

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh.renderOverlay).to.equal(true);
			expect(mesh.overlayAlpha).to.be.closeTo(0.5, 0.01);
			expect(
				mesh.overlayColor.equals(
					flock.BABYLON.Color3.FromHexString(
						flock.getColorFromString(color),
					),
				),
			).to.be.true;
		});

		it("should apply glow to a mesh", async function () {
			const { id, color } =
				await createBoxWithColorAndPosition("boxGlow");
			boxIds.push(id);

			await flock.glow(id, { color });

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh.metadata.glow).to.be.true;

			const expectedColor = flock.BABYLON.Color3.FromHexString(
				flock.getColorFromString(color),
			);
			const actualColor = mesh.material?.emissiveColor;

			expect(actualColor).to.exist;
			expect(actualColor.equals(expectedColor)).to.be.true;
		});

		it("should apply highlight to a mesh", async function () {
			const { id, color } =
				await createBoxWithColorAndPosition("boxHighlight");
			boxIds.push(id);

			await flock.highlight(id, { color });

			const mesh = flock.scene.getMeshByName(id);
			expect(mesh.material).to.exist;
			expect(flock.highlighter.hasMesh(mesh)).to.be.true;
		});

		it("should set alpha value for a mesh and its children", async function () {
			const { id } = await createBoxWithColorAndPosition("boxAlpha");
			boxIds.push(id);
			const alpha = alphas[Math.floor(Math.random() * alphas.length)];

			await flock.setAlpha(id, { value: alpha });

			const mesh = flock.scene.getMeshByName(id);
			const allMeshes = [mesh, ...mesh.getChildMeshes()];

			allMeshes.forEach((m) => {
				expect(m.material.alpha).to.be.closeTo(alpha, 0.01);
				expect(m.material.transparencyMode).to.equal(
					flock.BABYLON.Material.MATERIAL_ALPHABLEND,
				);
			});
		});

		it("should clear effects from a mesh", async function () {
			const { id, color } =
				await createBoxWithColorAndPosition("boxClear");
			boxIds.push(id);

			// Apply effects first
			await flock.tint(id, { color });
			await flock.glow(id, { color });
			await flock.highlight(id, { color });

			// Clear effects
			await flock.clearEffects(id);

			const mesh = flock.scene.getMeshByName(id);
			const allMeshes = [mesh, ...mesh.getChildMeshes()];

			allMeshes.forEach((m) => {
				expect(m.renderOverlay).to.equal(false);
				expect(
					m.material.emissiveColor.equals(
						flock.BABYLON.Color3.Black(),
					),
				).to.be.true;
				if (flock.glowLayer) {
					expect(m.metadata.glow).to.be.false;
				}
			});
		});
	});

	describe("changeColor method", function () {
	  const boxIds = [];
	  const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];

	  // Utility: Create a box with a random position
	  async function createBoxWithRandomPosition(id) {
		const position = new flock.BABYLON.Vector3(
		  Math.random() * 10,
		  Math.random() * 10,
		  Math.random() * 10
		);

		await flock.createBox(id, {
		  width: 1,
		  height: 1,
		  depth: 1,
		  position,
		});

		return id;
	  }

	  beforeEach(async function () {
		flock.scene ??= {};
	  });

	  afterEach(function () {
		boxIds.forEach((boxId) => {
		  flock.dispose(boxId);
		});
		boxIds.length = 0;
	  });

	  it("should apply a single color to a mesh", async function () {
		const id = "boxChangeColorSingle";
		await createBoxWithRandomPosition(id);
		boxIds.push(id);

		const color = colors[Math.floor(Math.random() * colors.length)];
		await flock.changeColor(id, { color });

		const mesh = flock.scene.getMeshByName(id);
		expect(mesh).to.exist;

		const material = mesh.material;
		expect(material).to.exist;

		const expectedColor = flock.BABYLON.Color3.FromHexString(
		  flock.getColorFromString(color)
		);

		const actualColor = material.diffuseColor ?? material.albedoColor;

		expect(actualColor).to.exist;
		["r", "g", "b"].forEach((component) => {
		  expect(actualColor[component]).to.be.closeTo(
			expectedColor[component],
			0.01
		  );
		});
	  });

	  it("should apply multiple colors to different parts of a mesh", async function () {
		const id = "boxChangeColorMultiple";
		await createBoxWithRandomPosition(id);
		boxIds.push(id);

		const colorList = ["#FF0000", "#00FF00", "#0000FF"];
		await flock.changeColor(id, { color: colorList });

		const mesh = flock.scene.getMeshByName(id);
		expect(mesh).to.exist;

		const allMeshes = [mesh, ...mesh.getChildMeshes()];
		allMeshes.forEach((part) => {
		  expect(part.material).to.exist;

		  const partColor = part.material.diffuseColor ?? part.material.albedoColor;
		  expect(partColor).to.exist;
		  expect(part.metadata).to.exist;
		  expect(part.metadata.materialIndex).to.be.within(0, colorList.length - 1);
		});
	  });
	});
}
