import { expect } from "chai";

export function runPhysicsTests(flock) {
  describe("onTrigger @physics", function () {
    const boxIds = [];

    beforeEach(async function () {
      flock.scene ??= {};
    });

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should call callback on trigger", async function () {
      const boxId = "boxTriggerTest";
      await flock.createBox(boxId, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(boxId);

      let triggered = false;

      flock.onTrigger(boxId, {
        trigger: "OnPickTrigger",
        callback: () => {
          triggered = true;
        },
      });

      // Simulate trigger
      const mesh = flock.scene.getMeshByName(boxId);
      expect(mesh).to.exist;
      mesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnPickTrigger,
      );

      expect(triggered).to.be.true;
    });

    it("should only call callback once when mode is 'once'", async function () {
      const boxId = "boxTriggerOnce";
      await flock.createBox(boxId, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(boxId);

      let count = 0;

      flock.onTrigger(boxId, {
        trigger: "OnPickTrigger",
        callback: () => {
          count++;
        },
        mode: "once",
      });

      const mesh = flock.scene.getMeshByName(boxId);
      expect(mesh).to.exist;

      mesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnPickTrigger,
      );
      mesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnPickTrigger,
      );

      expect(count).to.equal(1);
    });
  });

  describe("onIntersect @physics", function () {
    const boxIds = [];

    beforeEach(async function () {
      flock.scene ??= {};
    });

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should call callback on intersection", async function () {
      const box1 = "boxIntersect1";
      const box2 = "boxIntersect2";

      await flock.createBox(box1, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(box2, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(box1, box2);

      let intersected = false;

      flock.onIntersect(box1, box2, {
        trigger: "OnIntersectionEnterTrigger",
        callback: () => {
          intersected = true;
        },
      });

      const mesh = flock.scene.getMeshByName(box1);
      const otherMesh = flock.scene.getMeshByName(box2);
      expect(mesh).to.exist;
      expect(otherMesh).to.exist;

      mesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherMesh },
      );

      expect(intersected).to.be.true;
    });
  });

  describe("applyForce method @physics", function () {
    const boxIds = [];

    beforeEach(async function () {
      flock.scene ??= {};
    });

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should apply force to a mesh with default values (no movement) @slow", async function () {
      const id = "boxApplyForceDefault";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh).to.exist;

      const initialVelocity = mesh.physics.getLinearVelocity().clone();

      await flock.applyForce(id, {});

      await new Promise((r) => setTimeout(r, 200));

      const finalVelocity = mesh.physics.getLinearVelocity();

      expect(finalVelocity.x).to.be.closeTo(initialVelocity.x, 0.01);
      expect(finalVelocity.y).to.be.closeTo(initialVelocity.y, 0.01);
      expect(finalVelocity.z).to.be.closeTo(initialVelocity.z, 0.01);
    });

    it("should apply specific forces to a mesh", async function () {
      const id = "boxApplyForce";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.setPhysics(id, "DYNAMIC");

      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh).to.exist;

      await flock.applyForce(id, { forceX: 10, forceY: 5, forceZ: -3 });

      // Allow time for physics engine to update
      await new Promise((r) => setTimeout(r, 200));

      const velocity = mesh.physics.getLinearVelocity();
      expect(velocity.x).to.be.greaterThan(0);
      expect(velocity.y).to.be.greaterThan(0);
      expect(velocity.z).to.be.lessThan(0);
    });

    it("should handle missing physics gracefully", async function () {
      const id = "boxNoPhysics";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh).to.exist;

      // Remove physics to simulate missing physics
      mesh.physics.dispose();
      mesh.physics = null;

      let errorLogged = false;
      const originalConsoleError = console.error;
      console.error = (...args) => {
        errorLogged = true;
        originalConsoleError(...args);
      };

      await flock.applyForce(id, { forceX: 1, forceY: 1, forceZ: 1 });

      console.error = originalConsoleError;

      expect(errorLogged).to.be.true;
    });
  });

  describe("meshExists @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should return true for an existing mesh", async function () {
      const id = "boxMeshExists";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      expect(flock.meshExists(id)).to.be.true;
    });

    it("should return false for a non-existent mesh", function () {
      expect(flock.meshExists("doesNotExist")).to.be.false;
    });
  });

  describe("checkMeshesTouching @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should return true when two meshes overlap", async function () {
      const id1 = "boxTouching1";
      const id2 = "boxTouching2";
      await flock.createBox(id1, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(id2, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id1, id2);

      expect(flock.checkMeshesTouching(id1, id2)).to.be.true;
    });

    it("should return false when meshes do not overlap", async function () {
      const id1 = "boxNotTouching1";
      const id2 = "boxNotTouching2";
      await flock.createBox(id1, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(id2, {
        width: 1,
        height: 1,
        depth: 1,
        position: [100, 0, 0],
      });
      boxIds.push(id1, id2);

      expect(flock.checkMeshesTouching(id1, id2)).to.be.false;
    });
  });

  describe("up method @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should apply upward impulse to a dynamic mesh @slow", async function () {
      const id = "boxUp";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh).to.exist;

      flock.up(id, 10);

      await new Promise((r) => setTimeout(r, 200));

      const velocity = mesh.physics.getLinearVelocity();
      expect(velocity.y).to.be.greaterThan(0);
    });

    it("should log when mesh not found", function () {
      let logged = false;
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        logged = true;
        originalConsoleLog(...args);
      };

      flock.up("nonExistentMesh", 5);

      console.log = originalConsoleLog;

      expect(logged).to.be.true;
    });
  });

  describe("setPhysics @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should set motion type to STATIC", async function () {
      const id = "boxSetPhysicsStatic";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      await flock.setPhysics(id, "STATIC");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.getMotionType()).to.equal(
        flock.BABYLON.PhysicsMotionType.STATIC,
      );
    });

    it("should set motion type to DYNAMIC", async function () {
      const id = "boxSetPhysicsDynamic";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      await flock.setPhysics(id, "DYNAMIC");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.getMotionType()).to.equal(
        flock.BABYLON.PhysicsMotionType.DYNAMIC,
      );
    });

    it("should dispose physics body when set to NONE", async function () {
      const id = "boxSetPhysicsNone";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(id);

      await flock.setPhysics(id, "NONE");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics).to.be.null;
    });
  });

  describe("isTouchingSurface @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((boxId) => {
        flock.dispose(boxId);
      });
      boxIds.length = 0;
    });

    it("should return false when mesh is in the air", async function () {
      const id = "boxInAir";
      await flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 10, 0],
      });
      boxIds.push(id);

      expect(flock.isTouchingSurface(id)).to.be.false;
    });

    it("should return false and log when mesh does not exist", function () {
      let logged = false;
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        logged = true;
        originalConsoleLog(...args);
      };

      const result = flock.isTouchingSurface("nonExistentMesh");

      console.log = originalConsoleLog;

      expect(result).to.be.false;
      expect(logged).to.be.true;
    });
  });

  describe("setPhysicsShape @physics", function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => {
        try {
          flock.dispose(id);
        } catch (e) {
          console.warn(`Failed to dispose ${id}:`, e);
        }
      });
      boxIds.length = 0;
    });

    it("should set physicsShapeType to CAPSULE on the mesh metadata", async function () {
      const id = "physicsShapeBox1";
      flock.createBox(id, {
        width: 1,
        height: 2,
        depth: 1,
        position: [0, 1, 0],
      });
      boxIds.push(id);

      await flock.setPhysicsShape(id, "CAPSULE");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.metadata.physicsShapeType).to.equal("CAPSULE");
    });

    it("should set physicsShapeType to MESH on the mesh metadata", async function () {
      const id = "physicsShapeBox2";
      flock.createBox(id, {
        width: 1,
        height: 1,
        depth: 1,
        position: [3, 0, 0],
      });
      boxIds.push(id);

      await flock.setPhysicsShape(id, "MESH");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.metadata.physicsShapeType).to.equal("MESH");
    });
  });

  describe("showPhysics @physics", function () {
    it("should not throw when called", function () {
      expect(() => flock.showPhysics()).to.not.throw();
    });

    it("should not throw when called with false", function () {
      expect(() => flock.showPhysics(false)).to.not.throw();
    });
  });
}
