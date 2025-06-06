import { expect } from "chai";

export function runEffectsTests(flock) {
  describe("Effects API", function () {
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

	  const effectName = flock.createParticleEffect("test", {
		emitterMesh: emitterId,
		emitRate: 10,
		colors: { start: "#ffffff", end: "#ffffff" },
		alphas: { start: 1, end: 0 },
		sizes: { start: 1, end: 1 },
		lifetime: { min: 0.1, max: 0.2 },
		shape: "flare.png",
	  });

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
  });
}
