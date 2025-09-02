import { expect } from "chai";

export function runMaterialsTests(flock) {
	describe("Effects methods @materials", function () {
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

	describe("changeColor method @materials", function () {
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

	describe("createMaterial method @materials", function () {
	  const boxIds = [];

	  async function createTestBox(id) {
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

	  it("should create a standard material with color and alpha", async function () {
		const id = "boxCreateMaterialColor";
		await createTestBox(id);
		boxIds.push(id);

		const color = "#FF00FF";
		const material = flock.createMaterial({
		  color,
		  materialName: "testMaterial",
		  alpha: 0.5,
		});

		expect(material).to.exist;
		expect(material.diffuseColor).to.exist;
		expect(material.diffuseColor.equals(flock.BABYLON.Color3.FromHexString(flock.getColorFromString(color)))).to.be.true;
		expect(material.alpha).to.be.closeTo(0.5, 0.01);
	  });

	  it("should create a material with a texture", async function () {
		const id = "boxCreateMaterialTexture";
		await createTestBox(id);
		boxIds.push(id);

		const material = flock.createMaterial({
		  color: "#FFFFFF",
		  materialName: "test.png",
		  alpha: 1,
		});

		expect(material).to.exist;
		expect(material.diffuseTexture).to.exist;
		expect(material.diffuseTexture.name).to.include("test.png");
	  });

	  it("should create a gradient material when color is an array", async function () {
		const id = "boxCreateMaterialGradient";
		await createTestBox(id);
		boxIds.push(id);

		const gradientColors = ["#FF0000", "#00FF00"];
		const material = flock.createMaterial({
		  color: gradientColors,
		  materialName: "none.png",
		  alpha: 1,
		});

		expect(material).to.exist;
		expect(material.getClassName()).to.equal("GradientMaterial");
		expect(material.bottomColor).to.exist;
		expect(material.topColor).to.exist;
	  });
	});
  
	describe("setting a material scenarios @materials", function () {
	  const boxIds = [];

	  async function createTestBox(id) {
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

    async function createTestTree(id) {
      await flock.createObject({
  			modelName: 'tree.glb',
  			modelId: id,
  			color: ["#66cdaa", "#cd853f"],
  			scale: 1,
  			position: { x: 0, y: 0, z: 0 }
  		});
    }

	  beforeEach(async function () {
		flock.scene ??= {};
	  });

	  afterEach(function () {
		boxIds.forEach((boxId) => {
		  flock.dispose(boxId);
      flock.scene.materials = [];
		});
		boxIds.length = 0;
	  });

	  it("should create one new material for a box", async function () {
		const id = "boxCreateMaterialTexture";
		await createTestBox(id);
		boxIds.push(id);

    const materialsBefore = flock.scene.materials.length;

		const color = "#FF00FF";
		const material = flock.createMaterial({
		  color,
		  materialName: "testMaterial",
		  alpha: 0.5,
		});
  
		expect(flock.scene.materials.length).to.equal(materialsBefore + 1);
	  });

	  it("should delete the old material for a box", async function () {
		const id = "boxCreateMaterialTexture";
		await createTestBox(id);
		boxIds.push(id);

    const materialsBefore = flock.scene.materials.length;

		const color = "#FF00FF";
		const material = flock.createMaterial({
		  color,
		  materialName: "testMaterial",
		  alpha: 0.5,
		});

    flock.setMaterial(id, [material]);

		expect(flock.scene.materials.length).to.equal(materialsBefore);
	  });

	  it("should create two new materials for a tree", async function () {
		const id = "boxCreateMaterialTexture";
		await createTestTree(id);
		boxIds.push(id);

    const materialsBefore = flock.scene.materials.length;

    const material_temp = [flock.createMaterial({ color: "#00ffff", materialName: "leaves.png", alpha: 1 }), flock.createMaterial({ color: "#ff6600", materialName: "marble.png", alpha: 1 })];

		expect(flock.scene.materials.length).to.equal(materialsBefore + 2);
	  });

	  it("should delete the old materials for a tree", async function () {
		const id = "boxCreateMaterialTexture";
		await createTestTree(id);
    flock.whenModelReady(id, mesh => {
		boxIds.push(id);

    const materialsBefore = flock.scene.materials.length;

    const materials = [{ color: "#00ffff", materialName: "leaves.png", alpha: 1 }, { color: "#ff6600", materialName: "marble.png", alpha: 1 }]

    flock.setMaterial(id, materials);

		expect(flock.scene.materials.length).to.equal(materialsBefore);
    });
	  });
	});

	describe("combine blocks dispose of old materials @materials", function () {
	  const boxIds = [];

	  beforeEach(async function () {
		flock.scene ??= {};
	  });

	  afterEach(function () {
		boxIds.forEach((boxId) => {
		  flock.dispose(boxId);
      flock.scene.materials = [];
		});
		boxIds.length = 0;
	  });

	  it("should remove old ojects' materials when merging them", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          const materialsBefore = flock.scene.materials.length;
          flock.mergeMeshes("merged", [box1, box2]);
          boxIds.push("merged");
          flock.whenModelReady("merged", mesh => {
            expect(flock.scene.materials.length).to.equal(materialsBefore - 1);
          });
        });
      });
	  });
	  it("should remove old ojects' materials when subtracting them", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          const materialsBefore = flock.scene.materials.length;
          flock.subtractMeshes("subtracted", box1, [box2]);
          boxIds.push("subtracted");
          flock.whenModelReady("subtracted", mesh => {
            expect(flock.scene.materials.length).to.equal(materialsBefore - 1);
          });
        });
      });
    });
	  it("should remove old ojects' materials when intersecting them", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          const materialsBefore = flock.scene.materials.length;
          flock.intersectMeshes("intersected", [box1, box2]);
          boxIds.push("intersected");
          flock.whenModelReady("intersected", mesh => {
            expect(flock.scene.materials.length).to.equal(materialsBefore - 1);
          });
        });
      });
	  });
	  it("should remove old ojects' materials when creating their hull", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          const materialsBefore = flock.scene.materials.length;
          flock.createHull("hull", [box1, box2]);
          boxIds.push("hull");
          flock.whenModelReady("hull", mesh => {
            expect(flock.scene.materials.length).to.equal(materialsBefore - 1);
          });
        });
      });
	  });
	  it("should mark resultant material as internal when merging", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          flock.mergeMeshes("merged", [box1, box2]);
          boxIds.push("merged");
          flock.whenModelReady("merged", mesh => {
            expect(mesh.material.metadata.internal).to.equal(true);
          });
        });
      });
	  });
	  it("should mark resultant material as internal when subtracting", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          flock.subtractMeshes("subtracted", box1, [box2]);
          boxIds.push("subtracted");
          flock.whenModelReady("subtracted", mesh => {
            expect(mesh.material.metadata.internal).to.equal(true);
          });
        });
      });
    });
	  it("should mark resultant material as internal when intersecting", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          flock.intersectMeshes("intersected", [box1, box2]);
          boxIds.push("intersected");
          flock.whenModelReady("intersected", mesh => {
            expect(mesh.material.metadata.internal).to.equal(true);
          });
        });
      });
	  });
	  it("should mark resultant material as internal when creating a hull", async function () {
      await flock.createBox("box1", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox("box2", { color: "#9932cc", width: 1, height: 1, depth: 1, position: [0.5, 0.5, 0] });
      boxIds.push("box1");
      boxIds.push("box2");
      
      flock.whenModelReady("box1", box1 => {
        flock.whenModelReady("box2", box2 => {
          flock.createHull("hull", [box1, box2]);
          boxIds.push("hull");
          flock.whenModelReady("hull", mesh => {
            expect(mesh.material.metadata.internal).to.equal(true);
          });
        });
      });
	  });
	});
}
