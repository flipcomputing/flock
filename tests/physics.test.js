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

      await flock.onIntersect(box1, box2, {
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

    it("should register intersections for all matching right-hand group meshes", async function () {
      const source = "colliderSource_1";
      const groupA = "groupTarget_1";
      const groupB = "groupTarget_2";

      await flock.createBox(source, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(groupA, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(groupB, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(source, groupA, groupB);

      let count = 0;
      await flock.onIntersect(source, groupA, {
        trigger: "OnIntersectionEnterTrigger",
        applyToGroupOther: true,
        callback: () => {
          count++;
        },
      });

      const sourceMesh = flock.scene.getMeshByName(source);
      const otherA = flock.scene.getMeshByName(groupA);
      const otherB = flock.scene.getMeshByName(groupB);
      expect(sourceMesh).to.exist;
      expect(otherA).to.exist;
      expect(otherB).to.exist;

      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherA },
      );
      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherB },
      );

      expect(count).to.equal(2);
    });

    it("should skip self-pair when expanding right-hand collision group", async function () {
      const source = "selfPair_1";
      const other = "selfPair_2";

      await flock.createBox(source, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(other, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(source, other);

      let count = 0;
      await flock.onIntersect(source, source, {
        trigger: "OnIntersectionEnterTrigger",
        applyToGroupOther: true,
        callback: () => {
          count++;
        },
      });

      const sourceMesh = flock.scene.getMeshByName(source);
      const otherMesh = flock.scene.getMeshByName(other);
      expect(sourceMesh).to.exist;
      expect(otherMesh).to.exist;

      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherMesh },
      );

      expect(count).to.equal(1);
    });

    it("should apply right-hand group intersections when targets are created later", async function () {
      const source = "lateSource_1";
      const futureGroupSeed = "lateTarget_1";
      const futureGroupOther = "lateTarget_2";

      await flock.createBox(source, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(source);

      let count = 0;
      await flock.onIntersect(source, futureGroupSeed, {
        trigger: "OnIntersectionEnterTrigger",
        applyToGroupOther: true,
        callback: () => {
          count++;
        },
      });

      await flock.createBox(futureGroupSeed, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      await flock.createBox(futureGroupOther, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(futureGroupSeed, futureGroupOther);

      const sourceMesh = flock.scene.getMeshByName(source);
      const otherA = flock.scene.getMeshByName(futureGroupSeed);
      const otherB = flock.scene.getMeshByName(futureGroupOther);
      expect(sourceMesh).to.exist;
      expect(otherA).to.exist;
      expect(otherB).to.exist;

      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherA },
      );
      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: otherB },
      );

      expect(count).to.equal(2);
    });

    it("should canonicalize unsanitized RHS names for pending group registration", async function () {
      const source = "canonSource_1";
      const unsanitizedAlias = "canon target !@#";
      const normalizedAlias = "canontarget";
      const createdTarget = "canontarget_1";

      await flock.createBox(source, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(source);

      // Mirror whenModelReady alias support: unsanitized id resolves through
      // the normalized key present in modelReadyPromises.
      flock.modelReadyPromises.set(normalizedAlias, Promise.resolve(null));

      let count = 0;
      await flock.onIntersect(source, unsanitizedAlias, {
        trigger: "OnIntersectionEnterTrigger",
        applyToGroupOther: true,
        callback: () => {
          count++;
        },
      });

      await flock.createBox(createdTarget, {
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      boxIds.push(createdTarget);

      const sourceMesh = flock.scene.getMeshByName(source);
      const targetMesh = flock.scene.getMeshByName(createdTarget);
      expect(sourceMesh).to.exist;
      expect(targetMesh).to.exist;

      sourceMesh.actionManager.processTrigger(
        flock.BABYLON.ActionManager.OnIntersectionEnterTrigger,
        { mesh: targetMesh },
      );

      expect(count).to.equal(1);
      flock.modelReadyPromises.delete(normalizedAlias);
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

      // Read the velocity the impulse imparts immediately. Physics no longer
      // runs in lockstep (Havok steps by the real frame delta for better
      // mobile performance), so waiting wall-clock time before sampling makes
      // the result nondeterministic: under load a single oversized step lets
      // gravity and ground-contact resolution corrupt the x/z components.
      // The impulse itself is what this test verifies, so sample it directly.
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

  describe("setSpeed method @physics", function () {
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

    // Create a static ground plus a dynamic box resting on it, ready to drive.
    async function makeGroundAndBox(groundId, boxId) {
      await flock.createBox(groundId, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(groundId, "STATIC");
      boxIds.push(groundId);
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(boxId, "DYNAMIC");
      boxIds.push(boxId);
      // Let it settle so the ground check sees it as grounded.
      await new Promise((r) => setTimeout(r, 200));
      return flock.scene.getMeshByName(boxId);
    }

    it("drives along the object's local direction when grounded", async function () {
      this.timeout(8000);
      const mesh = await makeGroundAndBox("velGndA", "boxSetVelocity");
      // Unrotated box: local "forward" is -Z (the glide-direction convention).
      flock.setSpeed("boxSetVelocity", "forward", 5);
      await new Promise((r) => setTimeout(r, 200));

      const v = mesh.physics.getLinearVelocity();
      expect(v.x).to.be.closeTo(0, 0.3);
      expect(v.z).to.be.closeTo(-5, 0.5);
    });

    it("combines forward and sideways into one heading", async function () {
      this.timeout(8000);
      const mesh = await makeGroundAndBox("velGndB", "boxSetVelocityCombine");
      // forward -> -Z, sideways -> -X for an unrotated box.
      flock.setSpeed("boxSetVelocityCombine", "forward", 5);
      flock.setSpeed("boxSetVelocityCombine", "sideways", 3);
      await new Promise((r) => setTimeout(r, 200));

      const v = mesh.physics.getLinearVelocity();
      expect(v.x).to.be.closeTo(-3, 0.5);
      expect(v.z).to.be.closeTo(-5, 0.5);
    });

    it("moves the object across the ground", async function () {
      this.timeout(8000);
      const mesh = await makeGroundAndBox("velGndC", "boxSetVelocityMoves");
      const start = mesh.position.clone();

      flock.setSpeed("boxSetVelocityMoves", "forward", 8);
      await new Promise((r) => setTimeout(r, 400));

      expect(flock.BABYLON.Vector3.Distance(mesh.position, start)).to.be.greaterThan(1);
    });

    it("maintains the speed on a ground instead of friction stopping it", async function () {
      this.timeout(10000);
      const ground = "velGround";
      await flock.createBox(ground, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(ground, "STATIC");
      boxIds.push(ground);

      const id = "velDriver";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      flock.setSpeed(id, "forward", 5);

      // After well over a second on the ground, a one-shot would have stopped.
      // The maintained speed should still be moving at ~5 (forward = -Z).
      await new Promise((r) => setTimeout(r, 1500));
      expect(mesh.physics.getLinearVelocity().z).to.be.closeTo(-5, 0.5);

      // Setting it to 0 stops it.
      flock.setSpeed(id, "forward", 0);
      await new Promise((r) => setTimeout(r, 600));
      expect(mesh.physics.getLinearVelocity().z).to.be.closeTo(0, 0.5);
    });

    it("maintains a world axis (x) on a ground", async function () {
      this.timeout(10000);
      const ground = "velGroundX";
      await flock.createBox(ground, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(ground, "STATIC");
      boxIds.push(ground);

      const id = "velDriverX";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      flock.setSpeed(id, "x_coordinate", 5); // world +X

      await new Promise((r) => setTimeout(r, 1500));
      expect(mesh.physics.getLinearVelocity().x).to.be.closeTo(5, 0.5);
    });

    it("keeps a driven object upright (like move forward)", async function () {
      this.timeout(10000);
      const ground = "velGroundUp";
      await flock.createBox(ground, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(ground, "STATIC");
      boxIds.push(ground);

      const id = "velUpright";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      const B = flock.BABYLON;
      flock.setSpeed(id, "forward", 5);

      // Try to tip it over (pitch + roll, plus a tumbling spin).
      mesh.rotationQuaternion = B.Quaternion.RotationAxis(B.Axis.X, 0.9);
      mesh.physics.setAngularVelocity(new B.Vector3(6, 0, 6));

      await new Promise((r) => setTimeout(r, 800));

      // The drive should have snapped it back upright (no pitch/roll).
      const q = mesh.rotationQuaternion;
      expect(Math.abs(q.x)).to.be.lessThan(0.05);
      expect(Math.abs(q.z)).to.be.lessThan(0.05);
    });

    it("clamps vertical speed so a slope can't launch it", async function () {
      this.timeout(10000);
      const ground = "velGroundClamp";
      await flock.createBox(ground, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(ground, "STATIC");
      boxIds.push(ground);

      const id = "velClamp";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      flock.setSpeed(id, "forward", 5); // horizontal drive, no vertical set

      // Simulate a ramp kicking it sharply upward.
      mesh.physics.setLinearVelocity(new flock.BABYLON.Vector3(0, 12, -5));
      await new Promise((r) => setTimeout(r, 300));

      // The drive should have capped the upward speed (~3), not let it launch.
      expect(mesh.physics.getLinearVelocity().y).to.be.at.most(3.1);
    });

    it("does not clamp an explicit vertical (up) drive", async function () {
      this.timeout(8000);
      const id = "velUpDrive";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      flock.setSpeed(id, "up", 10); // explicit vertical drive

      await new Promise((r) => setTimeout(r, 300));
      // Explicitly driven vertical is respected, not capped at 3.
      expect(mesh.physics.getLinearVelocity().y).to.be.greaterThan(8);
    });

    it("assigns a physics capsule like move forward", async function () {
      const id = "velCapsule";
      // 2 x 4 x 6 box: capsule radius = min(2,6)/2 = 1, height = 4 - 0.01.
      await flock.createBox(id, { width: 2, height: 4, depth: 6, position: [0, 2, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.metadata.physicsCapsule).to.be.undefined; // none yet

      flock.setSpeed(id, "forward", 5);

      const cap = mesh.metadata.physicsCapsule;
      expect(cap).to.exist;
      expect(cap.radius).to.be.closeTo(1, 0.01);
      expect(cap.height).to.be.closeTo(3.99, 0.01);
      expect(cap.localCenter).to.exist;
    });

    it("'all' to 0 is a full stop that lets physics resume", async function () {
      this.timeout(8000);
      const ground = "velGroundAll";
      await flock.createBox(ground, { width: 100, height: 1, depth: 100, position: [0, -0.5, 0] });
      await flock.setPhysics(ground, "STATIC");
      boxIds.push(ground);

      const id = "boxSetVelocityAll";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      flock.setSpeed(id, "forward", 6);

      // 'all' to 0 stops it; resting on the ground it then stays put.
      flock.setSpeed(id, "all", 0);
      const start = mesh.position.clone();
      await new Promise((r) => setTimeout(r, 500));

      expect(flock.BABYLON.Vector3.Distance(mesh.position, start)).to.be.lessThan(0.3);
      // The maintained drive is cleared, so the body is free again.
      expect(mesh.metadata.velocityDrive).to.be.undefined;
    });

    it("should handle missing physics gracefully", async function () {
      const id = "boxSetVelocityNoPhysics";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.physics.dispose();
      mesh.physics = null;

      let errorLogged = false;
      const originalConsoleError = console.error;
      console.error = () => { errorLogged = true; };

      flock.setSpeed(id, "forward", 1);

      console.error = originalConsoleError;
      expect(errorLogged).to.be.true;
    });
  });

  describe("setBounciness method @physics", function () {
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

    it("sets restitution on the body's shape material", async function () {
      const id = "boxBounciness";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      flock.setBounciness(id, 0.9);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.shape.material.restitution).to.be.closeTo(0.9, 1e-6);
      expect(mesh.metadata.bounciness).to.be.closeTo(0.9, 1e-6);
    });

    it("forces MAXIMUM restitution combine so the bounciest surface wins", async function () {
      const id = "boxBouncinessCombine";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      flock.setBounciness(id, 0.5);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.shape.material.restitutionCombine).to.equal(
        flock.BABYLON.PhysicsMaterialCombineMode.MAXIMUM,
      );
    });

    it("preserves the existing friction when changing bounciness", async function () {
      const id = "boxBouncinessFriction";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.physics.shape.material = { ...mesh.physics.shape.material, friction: 0.42 };

      flock.setBounciness(id, 0.3);

      expect(mesh.physics.shape.material.restitution).to.be.closeTo(0.3, 1e-6);
      expect(mesh.physics.shape.material.friction).to.be.closeTo(0.42, 1e-6);
    });

    it("clamps the value to the 0..1 range", async function () {
      const id = "boxBouncinessClamp";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);

      flock.setBounciness(id, 5);
      expect(mesh.physics.shape.material.restitution).to.equal(1);

      flock.setBounciness(id, -2);
      expect(mesh.physics.shape.material.restitution).to.equal(0);
    });

    it("defaults a fresh body to no bounce (restitution 0)", async function () {
      const id = "boxBouncinessDefault";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.shape.material.restitution).to.equal(0);
    });

    it("keeps bounciness through a physics shape (capsule) swap", async function () {
      const id = "boxBouncinessCapsule";
      await flock.createBox(id, { width: 1, height: 2, depth: 1, position: [0, 1, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      flock.setBounciness(id, 0.6);
      await flock.setPhysicsShape(id, "CAPSULE");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.metadata.physicsShapeType).to.equal("CAPSULE");
      expect(mesh.physics.shape.material.restitution).to.be.closeTo(0.6, 1e-6);
    });

    it("re-applies the stored bounciness after a physics rebuild", async function () {
      const id = "boxBouncinessRebuild";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, "DYNAMIC");
      boxIds.push(id);

      flock.setBounciness(id, 0.8);

      // Drop physics and re-add it — the new shape starts with the default
      // material, so without re-application the bounciness would be lost.
      await flock.setPhysics(id, "NONE");
      await flock.setPhysics(id, "DYNAMIC");

      const mesh = flock.scene.getMeshByName(id);
      expect(mesh.physics.shape.material.restitution).to.be.closeTo(0.8, 1e-6);
    });

    it("should handle missing physics gracefully", async function () {
      const id = "boxBouncinessNoPhysics";
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.physics.dispose();
      mesh.physics = null;

      let errorLogged = false;
      const originalConsoleError = console.error;
      console.error = () => { errorLogged = true; };

      flock.setBounciness(id, 0.5);

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
