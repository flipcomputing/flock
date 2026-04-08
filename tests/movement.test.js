import { expect } from "chai";

export function runMovementTests(flock) {
  describe("moveForward @movement", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it("should do nothing when mesh does not exist", function () {
      expect(() => flock.moveForward("nonExistentMesh", 5)).to.not.throw();
    });

    it("should do nothing when speed is 0", async function () {
      const id = "boxMoveForwardZeroSpeed";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.moveForward(id, 0)).to.not.throw();
    });

    it("should do nothing when physicsCapsule metadata is missing", async function () {
      const id = "boxMoveForwardNoCapsule";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh).to.exist;
      // Box has no physicsCapsule metadata — function returns early after that check
      const velBefore = mesh.physics.getLinearVelocity().clone();

      flock.moveForward(id, 5);

      const velAfter = mesh.physics.getLinearVelocity();
      expect(velAfter.x).to.be.closeTo(velBefore.x, 0.001);
      expect(velAfter.z).to.be.closeTo(velBefore.z, 0.001);
    });
  });

  describe("moveSideways @movement", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it("should do nothing when mesh does not exist", function () {
      expect(() => flock.moveSideways("nonExistentMesh", 5)).to.not.throw();
    });

    it("should do nothing when speed is 0", async function () {
      const id = "boxMoveSidewaysZeroSpeed";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.moveSideways(id, 0)).to.not.throw();
    });

    it("should set non-zero horizontal linear velocity when called with positive speed @slow", async function () {
      this.timeout(3000);
      const id = "boxMoveSidewaysPositive";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      flock.moveSideways(id, 5);

      const mesh = flock.scene.getMeshByName(id);
      const vel = mesh.physics.getLinearVelocity();
      const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      expect(horizontalSpeed).to.be.greaterThan(0);
    });

    it("should preserve existing Y velocity when called @slow", async function () {
      this.timeout(3000);
      const id = "boxMoveSidewaysPreserveY";
      // Place on the ground so Y velocity is 0 and stable — avoids flakiness from gravity between measurements
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      const mesh = flock.scene.getMeshByName(id);
      flock.moveSideways(id, 5);

      const vel = mesh.physics.getLinearVelocity();
      expect(vel.y).to.be.closeTo(0, 0.1);
    });
  });

  describe("strafe @movement", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it("should do nothing when mesh does not exist", function () {
      expect(() => flock.strafe("nonExistentMesh", 5)).to.not.throw();
    });

    it("should do nothing when speed is 0", async function () {
      const id = "boxStrafeZeroSpeed";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.strafe(id, 0)).to.not.throw();
    });

    it("should set non-zero horizontal linear velocity when called with positive speed @slow", async function () {
      this.timeout(3000);
      const id = "boxStrafePositive";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      flock.strafe(id, 5);

      const mesh = flock.scene.getMeshByName(id);
      const vel = mesh.physics.getLinearVelocity();
      const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      expect(horizontalSpeed).to.be.greaterThan(0);
    });
  });
}
