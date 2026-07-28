import { expect } from 'chai';

async function driveForward(flock, id, speed, durationMs, callIntervalMs) {
  const mesh = flock.scene.getMeshByName(id);
  const startX = mesh.position.x;
  const startZ = mesh.position.z;
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    flock.moveForward(id, speed);
    await new Promise((r) => setTimeout(r, callIntervalMs));
  }
  return { x: mesh.position.x - startX, z: mesh.position.z - startZ };
}

export function runMovementTests(flock) {
  describe('moveForward @movement', function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it('should do nothing when mesh does not exist', function () {
      expect(() => flock.moveForward('nonExistentMesh', 5)).to.not.throw();
    });

    it('should do nothing when speed is 0', async function () {
      const id = 'boxMoveForwardZeroSpeed';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.moveForward(id, 0)).to.not.throw();
    });

    it('should do nothing when physicsCapsule metadata is missing', async function () {
      const id = 'boxMoveForwardNoCapsule';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
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

    it('ground walking distance is independent of call rate @slow', async function () {
      this.timeout(5000);

      const groundId = 'boxGroundWalkGround';
      await flock.createBox(groundId, {
        width: 100,
        height: 0.5,
        depth: 100,
        position: [0, -0.25, 0],
      });
      await flock.setPhysics(groundId, 'STATIC');
      boxIds.push(groundId);

      const id = 'boxGroundWalkRate';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0.5, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.constraint = true; // skip stabiliser so velocity persists between physics steps
      mesh.metadata.physicsCapsule = {
        radius: 0.5,
        height: 0.9,
        localCenter: { x: 0, y: 0, z: 0 },
      };

      await new Promise((r) => setTimeout(r, 300));

      const B = flock.BABYLON;
      const speed = 5;
      const duration = 1000;
      const distances = [];

      for (const interval of [6, 16, 33]) {
        mesh.position.set(0, 0.5, 0);
        mesh._lastMoveForwardMs = undefined;
        mesh.physics.setLinearVelocity(new B.Vector3(0, 0, 0));
        mesh.physics.setAngularVelocity(new B.Vector3(0, 0, 0));
        await new Promise((r) => setTimeout(r, 150));

        const disp = await driveForward(flock, id, speed, duration, interval);
        distances.push(Math.sqrt(disp.x * disp.x + disp.z * disp.z));
      }

      const [d165, d60, d30] = distances;
      expect(d165).to.be.greaterThan(0);
      expect(d60 / d165).to.be.within(0.9, 1.1);
      expect(d30 / d165).to.be.within(0.9, 1.1);
    });

    it('airborne horizontal distance is independent of call rate @slow', async function () {
      this.timeout(5000);
      const id = 'boxAirborneRate';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 10, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.constraint = true; // skip stabiliser so velocity persists between physics steps
      mesh.metadata.physicsCapsule = {
        radius: 0.5,
        height: 0.9,
        localCenter: { x: 0, y: 0, z: 0 },
      };

      const B = flock.BABYLON;
      const speed = 5;
      const duration = 1000;
      const distances = [];

      const cam = flock.scene.activeCamera;
      const camForward = new B.Vector3();
      cam.getDirectionToRef(B.Vector3.Forward(), camForward);
      const hForward = new B.Vector3(camForward.x, 0, camForward.z).normalize();

      for (const interval of [6, 16, 33]) {
        mesh.position.set(0, 10, 0);
        mesh._lastGroundedAt = 0;
        mesh._lastMoveForwardMs = undefined;
        mesh.physics.setLinearVelocity(hForward.scale(speed));
        mesh.physics.setAngularVelocity(new B.Vector3(0, 0, 0));
        await new Promise((r) => setTimeout(r, 150));

        const disp = await driveForward(flock, id, speed, duration, interval);
        distances.push(Math.sqrt(disp.x * disp.x + disp.z * disp.z));
      }

      const [d165, d60, d30] = distances;
      expect(d165).to.be.greaterThan(0);
      expect(d60 / d165).to.be.within(0.85, 1.15);
      // 30 Hz holds velocity for ~2 physics steps per call vs ~0.37 steps at 165 Hz;
      // the left-Riemann-sum overshoot is ~10–20 % depending on physics step alignment,
      // so this tolerance is wider than the 60 Hz comparison.
      expect(d30 / d165).to.be.within(0.75, 1.25);
    });

    it('air drag decays horizontal velocity while airborne @slow', async function () {
      this.timeout(5000);
      const id = 'boxAirdragDecay';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 10, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.constraint = true; // skip stabiliser so velocity persists between physics steps
      mesh.metadata.physicsCapsule = {
        radius: 0.5,
        height: 0.9,
        localCenter: { x: 0, y: 0, z: 0 },
      };

      const B = flock.BABYLON;
      const speed = 5;

      const cam = flock.scene.activeCamera;
      const camForward = new B.Vector3();
      cam.getDirectionToRef(B.Vector3.Forward(), camForward);
      const hForward = new B.Vector3(camForward.x, 0, camForward.z).normalize();

      mesh._lastGroundedAt = 0;
      mesh._lastMoveForwardMs = undefined;
      mesh.physics.setLinearVelocity(hForward.scale(speed));
      await new Promise((r) => setTimeout(r, 150));

      let sample1 = null;
      let sample2 = null;
      const startTime = Date.now();

      while (Date.now() - startTime < 1000) {
        flock.moveForward(id, speed);
        const elapsed = Date.now() - startTime;
        const vel = mesh.physics.getLinearVelocity();
        const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (elapsed >= 200 && sample1 === null) sample1 = hSpeed;
        if (elapsed >= 400 && sample2 === null) sample2 = hSpeed;
        await new Promise((r) => setTimeout(r, 16));
      }

      expect(sample1).to.be.greaterThan(0);
      expect(sample2).to.be.lessThan(sample1);
    });

    it('a long single frame does not collapse airborne velocity to zero @slow', async function () {
      this.timeout(5000);
      const id = 'boxLongFrame';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 10, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      const mesh = flock.scene.getMeshByName(id);
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.constraint = true; // skip stabiliser so velocity persists between physics steps
      mesh.metadata.physicsCapsule = {
        radius: 0.5,
        height: 0.9,
        localCenter: { x: 0, y: 0, z: 0 },
      };

      const B = flock.BABYLON;
      const speed = 5;

      const cam = flock.scene.activeCamera;
      const camForward = new B.Vector3();
      cam.getDirectionToRef(B.Vector3.Forward(), camForward);
      const hForward = new B.Vector3(camForward.x, 0, camForward.z).normalize();

      mesh._lastGroundedAt = 0;
      mesh.physics.setLinearVelocity(hForward.scale(speed));
      await new Promise((r) => setTimeout(r, 150));

      // Simulate a 5 s gap since last call — should clamp to 1/15 s max drag
      mesh._lastMoveForwardMs =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - 5000;
      flock.moveForward(id, speed);

      const vel = mesh.physics.getLinearVelocity();
      const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      expect(hSpeed).to.be.greaterThan(0);
    });
  });

  describe('moveSideways @movement', function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it('should do nothing when mesh does not exist', function () {
      expect(() => flock.moveSideways('nonExistentMesh', 5)).to.not.throw();
    });

    it('should do nothing when speed is 0', async function () {
      const id = 'boxMoveSidewaysZeroSpeed';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.moveSideways(id, 0)).to.not.throw();
    });

    it('should set non-zero horizontal linear velocity when called with positive speed @slow', async function () {
      this.timeout(3000);
      const id = 'boxMoveSidewaysPositive';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      flock.moveSideways(id, 5);

      const mesh = flock.scene.getMeshByName(id);
      const vel = mesh.physics.getLinearVelocity();
      const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      expect(horizontalSpeed).to.be.greaterThan(0);
    });

    it('should preserve existing Y velocity when called @slow', async function () {
      this.timeout(3000);
      const id = 'boxMoveSidewaysPreserveY';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      const mesh = flock.scene.getMeshByName(id);
      const velBefore = mesh.physics.getLinearVelocity().y;
      flock.moveSideways(id, 5);

      const vel = mesh.physics.getLinearVelocity();
      expect(vel.y).to.be.closeTo(velBefore, 0.1);
    });
  });

  describe('strafe @movement', function () {
    const boxIds = [];

    afterEach(function () {
      boxIds.forEach((id) => flock.dispose(id));
      boxIds.length = 0;
    });

    it('should do nothing when mesh does not exist', function () {
      expect(() => flock.strafe('nonExistentMesh', 5)).to.not.throw();
    });

    it('should do nothing when speed is 0', async function () {
      const id = 'boxStrafeZeroSpeed';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
      boxIds.push(id);

      await new Promise((r) => setTimeout(r, 200));

      expect(() => flock.strafe(id, 0)).to.not.throw();
    });

    it('should set non-zero horizontal linear velocity when called with positive speed @slow', async function () {
      this.timeout(3000);
      const id = 'boxStrafePositive';
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.setPhysics(id, 'DYNAMIC');
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
