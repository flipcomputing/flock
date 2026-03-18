import { expect } from "chai";

export function runEffectsTests(flock) {
  describe("Effects API", function () {
	const createdEffects = [];
	const createdMeshes = [];

	afterEach(function () {
	  // Clean up particle systems
	  createdEffects.forEach(effectName => {
		const system = flock.scene.particleSystems.find(s => s.name === effectName);
		if (system) {
		  system.dispose();
		}
	  });
	  createdEffects.length = 0;

	  // Clean up meshes
	  createdMeshes.forEach(meshId => {
		flock.dispose(meshId);
	  });
	  createdMeshes.length = 0;

	  // Reset fog
	  flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_NONE;
	  flock.scene.fogColor = null;
	  flock.scene.fogDensity = 0;
	  flock.scene.fogStart = 0;
	  flock.scene.fogEnd = 1000;

	  // Reset light intensity
	  if (flock.mainLight) {
		flock.mainLight.intensity = 1;
	  }
	});

	it("should set light intensity", function () {
	  const light = { intensity: 0 };
	  flock.mainLight = light;
	  flock.lightIntensity(0.75);
	  expect(light.intensity).to.equal(0.75);
	});

	it("should create a particle system and return its name", function (done) {
	  this.timeout(5000);
	  const emitterId = flock.createBox("emitterBox", {
		color: "#FF0000",
		width: 1,
		height: 1,
		depth: 1,
		position: [0, 0, 0],
	  });
	  createdMeshes.push(emitterId);

	  const effectName = flock.createParticleEffect("test", {
		emitterMesh: emitterId,
		emitRate: 10,
		colors: { start: "#ffffff", end: "#ffffff" },
		alphas: { start: 1, end: 0 },
		sizes: { start: 1, end: 1 },
		lifetime: { min: 0.1, max: 0.2 },
		shape: "flare.png",
	  });
	  createdEffects.push(effectName);

	  expect(effectName).to.be.a("string");

	  setTimeout(() => {
		const system = flock.scene.particleSystems.find(
		  (s) => s.name === effectName,
		);
		expect(system).to.exist;
		done();
	  }, 50);
	});

        it("should set fog parameters", function () {
          flock.scene.fogMode = null;
          flock.scene.fogColor = null;
          flock.scene.fogDensity = null;
          flock.scene.fogStart = null;
	  flock.scene.fogEnd = null;

	  flock.setFog({ fogColorHex: "#9932cc", fogMode: "EXP", fogDensity: 0.2 });

	  expect(flock.scene.fogMode).to.equal(flock.BABYLON.Scene.FOGMODE_EXP);
          expect(flock.scene.fogDensity).to.equal(0.2);
          expect(flock.scene.fogStart).to.equal(50);
          expect(flock.scene.fogEnd).to.equal(100);
        });

        it("should allow custom fog start and end", function () {
          flock.scene.fogStart = null;
          flock.scene.fogEnd = null;

          flock.setFog({
            fogColorHex: "#9932cc",
            fogMode: "LINEAR",
            fogDensity: 0.05,
            fogStart: 25,
            fogEnd: 75,
          });

          expect(flock.scene.fogStart).to.equal(25);
          expect(flock.scene.fogEnd).to.equal(75);
        });
  });
}
