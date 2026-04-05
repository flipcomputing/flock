import { expect } from "chai";

export function runEffectsTests(flock) {
  describe("Effects API", function () {
    const createdEffects = [];
    const createdMeshes = [];

    afterEach(function () {
      // Clean up particle systems
      createdEffects.forEach((effectName) => {
        const system = flock.scene.particleSystems.find(
          (s) => s.name === effectName,
        );
        if (system) {
          system.dispose();
        }
      });
      createdEffects.length = 0;

      // Clean up meshes
      createdMeshes.forEach((meshId) => {
        flock.dispose(meshId);
      });
      createdMeshes.length = 0;

      // Reset fog
      flock.scene.fogMode = flock.BABYLON.Scene.FOGMODE_NONE;
      flock.scene.fogColor = null;
      flock.scene.fogDensity = 0;
      flock.scene.fogStart = 0;
      flock.scene.fogEnd = 1000;
      if (flock._fogAwareShaderMaterials) {
        flock._fogAwareShaderMaterials.clear();
      }

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

    it("should avoid collisions for repeated particle effect names", function (done) {
      this.timeout(5000);

      const emitterId = flock.createBox("effectReserveEmitter", {
        color: "#FF0000",
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      createdMeshes.push(emitterId);

      const firstEffectName = flock.createParticleEffect("reserveEffect", {
        emitterMesh: emitterId,
        emitRate: 10,
        colors: { start: "#ffffff", end: "#ffffff" },
        alphas: { start: 1, end: 0 },
        sizes: { start: 1, end: 1 },
        lifetime: { min: 0.1, max: 0.2 },
        shape: "flare.png",
      });
      const secondEffectName = flock.createParticleEffect("reserveEffect", {
        emitterMesh: emitterId,
        emitRate: 10,
        colors: { start: "#ffffff", end: "#ffffff" },
        alphas: { start: 1, end: 0 },
        sizes: { start: 1, end: 1 },
        lifetime: { min: 0.1, max: 0.2 },
        shape: "flare.png",
      });
      createdEffects.push(firstEffectName, secondEffectName);

      setTimeout(() => {
        try {
          expect(firstEffectName).to.not.equal(secondEffectName);
          done();
        } catch (error) {
          done(error);
        }
      }, 100);
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

    it("single-color material path should still support scene fog", function () {
      const material = flock.createMaterial({
        color: "#00ff00",
        materialName: "test.png",
        alpha: 0.8,
      });

      flock.setFog({
        fogColorHex: "#778899",
        fogMode: "LINEAR",
        fogStart: 10,
        fogEnd: 100,
      });

      expect(material.getClassName()).to.equal("StandardMaterial");
      expect(material.fogEnabled).to.not.equal(false);
      expect(material.alpha).to.equal(0.8);
      expect(material.diffuseTexture.uScale).to.equal(1);
      expect(material.diffuseTexture.vScale).to.equal(1);
      material.dispose();
    });

    it("two-color shader path should receive fog uniforms", function () {
      const material = flock.createMaterial({
        color: ["#00ff00", "#0000ff"],
        materialName: "test.png",
        alpha: 0.4,
      });

      flock.setFog({
        fogColorHex: "#123456",
        fogMode: "EXP2",
        fogDensity: 0.33,
        fogStart: 12,
        fogEnd: 88,
      });

      expect(material.getClassName()).to.equal("ShaderMaterial");
      expect(flock._fogAwareShaderMaterials?.has(material)).to.be.true;
      expect(material._floats.fogDensity).to.equal(0.33);
      expect(material._floats.fogStart).to.equal(12);
      expect(material._floats.fogEnd).to.equal(88);
      expect(material._ints.fogMode).to.equal(flock.BABYLON.Scene.FOGMODE_EXP2);
      expect(material._floats.uScale).to.equal(1);
      expect(material._floats.vScale).to.equal(1);
      expect(material._floats.alpha).to.equal(0.4);
      material.dispose();
    });

    it("identical two-color input should match single-color fog behavior", function () {
      const singleColorMaterial = flock.createMaterial({
        color: "#00ff00",
        materialName: "test.png",
        alpha: 0.7,
      });
      const identicalPairMaterial = flock.createMaterial({
        color: ["#00ff00", "#00ff00"],
        materialName: "test.png",
        alpha: 0.7,
      });

      flock.setFog({
        fogColorHex: "#abcdef",
        fogMode: "EXP",
        fogDensity: 0.15,
      });

      expect(singleColorMaterial.getClassName()).to.equal("StandardMaterial");
      expect(identicalPairMaterial.getClassName()).to.equal("StandardMaterial");
      expect(flock._fogAwareShaderMaterials?.has(identicalPairMaterial)).to.not.be
        .true;
      expect(identicalPairMaterial.fogEnabled).to.equal(
        singleColorMaterial.fogEnabled,
      );
      expect(identicalPairMaterial.alpha).to.equal(singleColorMaterial.alpha);
      identicalPairMaterial.dispose();
      singleColorMaterial.dispose();
    });

    it("getMainLight should return '__main_light__'", function () {
      expect(flock.getMainLight()).to.equal("__main_light__");
    });

    it("lightColor should set diffuse and ground color on the main light", function () {
      const originalMainLight = flock.mainLight;
      const light = { intensity: 1, diffuse: null, groundColor: null };
      flock.mainLight = light;
      flock.lightColor("#ff0000", "#0000ff");
      expect(light.diffuse.r).to.be.closeTo(1, 0.01);
      expect(light.diffuse.g).to.be.closeTo(0, 0.01);
      expect(light.diffuse.b).to.be.closeTo(0, 0.01);
      expect(light.groundColor.r).to.be.closeTo(0, 0.01);
      expect(light.groundColor.g).to.be.closeTo(0, 0.01);
      expect(light.groundColor.b).to.be.closeTo(1, 0.01);
      flock.mainLight = originalMainLight;
    });

    it("startParticleSystem should start a stopped particle system", function () {
      const ps = new flock.BABYLON.ParticleSystem(
        "startTestPS",
        100,
        flock.scene,
      );
      ps.emitter = flock.BABYLON.Vector3.Zero();
      createdEffects.push("startTestPS");

      ps.stop();
      expect(ps.isStarted()).to.be.false;

      flock.startParticleSystem("startTestPS");
      expect(ps.isStarted()).to.be.true;
    });

    it("stopParticleSystem should mark the particle system as stopped", function () {
      const ps = new flock.BABYLON.ParticleSystem(
        "stopTestPS",
        100,
        flock.scene,
      );
      ps.emitter = flock.BABYLON.Vector3.Zero();
      createdEffects.push("stopTestPS");

      ps.start();
      expect(ps._stopped).to.be.false;

      flock.stopParticleSystem("stopTestPS");
      expect(ps._stopped).to.be.true;
    });

    it("resetParticleSystem should clear all particles", function () {
      const ps = new flock.BABYLON.ParticleSystem(
        "resetTestPS",
        100,
        flock.scene,
      );
      ps.emitter = flock.BABYLON.Vector3.Zero();
      createdEffects.push("resetTestPS");

      flock.resetParticleSystem("resetTestPS");
      expect(ps._particles).to.have.lengthOf(0);
      expect(ps._stockParticles).to.have.lengthOf(0);
    });
  });
}
