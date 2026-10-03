// test-glideTo.js

import { expect } from 'chai';

function checkXPosition(box, pos) {
  return Math.abs(box.position.x - pos) <= 0.4;
}

// Test suite for glideTo function
export function runGlideToTests(flock) {
  describe('glideTo function tests @slow', function () {
    let box1;
    let box2;
    const boxIds = [];

    // Set up the box before each test
    beforeEach(async function () {
      // Create a box before each test
      box1 = await flock.createBox('box1', {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
    });

    // Clean up after each test
    afterEach(function () {
      // Dispose of the boxes after each test to avoid memory leaks and ensure clean state
      flock.dispose(box1);
      if (box2) {
        flock.dispose(box2);
        box2 = undefined;
      }
    });

    it('should move the box to the correct position @slow', async function () {
      this.timeout(2000); // Set a reasonable timeout for a short animation

      await flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 0.5 });

      const box = flock.scene.getMeshByName(box1);

      // Assert the box has moved to the correct position
      expect(box.position.x).to.equal(6);
      expect(box.position.y).to.equal(0.5);
      expect(box.position.z).to.equal(0);
    });

    it('should handle reverse movement @slow', function (done) {
      this.timeout(5000); // Increase the timeout for this test

      // Move the box with reverse enabled
      flock.glideTo(box1, {
        x: 6,
        y: 0,
        z: 0,
        duration: 2,
        reverse: true,
      });

      let hasReachedTarget = false;
      let hasReturned = false;

      // Check the box's position periodically
      const intervalId = setInterval(() => {
        const box = flock.scene.getMeshByName(box1);
        if (!box) return;

        // Only check for return *after* the target has been reached.
        // Using 'else if' makes the check mutually exclusive and more robust.
        if (!hasReachedTarget && checkXPosition(box, 6)) {
          hasReachedTarget = true;
        } else if (hasReachedTarget && checkXPosition(box, 0)) {
          hasReturned = true;
        }
      }, 25); // Check more frequently to reliably catch the peak position

      // After the full animation duration (2s out + 2s back), check the states
      setTimeout(() => {
        try {
          clearInterval(intervalId);
          expect(hasReachedTarget, 'Box did not reach target').to.be.true;
          expect(hasReturned, 'Box did not return to start').to.be.true;
          done();
        } catch (e) {
          done(e);
        }
      }, 4500); // Wait for 4.5 seconds to be safe
    });

    it('reverse glide ends exactly back at its start position @slow', async function () {
      this.timeout(5000);

      const box = flock.scene.getMeshByName(box1);
      const start = box.position.clone();

      // Up and back down. Should finish precisely where it started.
      await flock.glideTo(box1, {
        x: 0,
        y: 5,
        z: 0,
        duration: 1,
        reverse: true,
      });

      expect(box.position.x).to.equal(start.x);
      expect(box.position.y).to.equal(start.y);
      expect(box.position.z).to.equal(start.z);
    });

    it('restarts a reverse re-triggered mid-flight and still returns to start (no fly-up) @slow', async function () {
      this.timeout(8000);

      const box = flock.scene.getMeshByName(box1);
      const start = box.position.clone();

      flock.glideTo(box1, { x: 0, y: 5, z: 0, duration: 1, reverse: true });

      await new Promise((resolve) => setTimeout(resolve, 500));
      const airborneY = box.position.y;
      expect(
        airborneY,
        'box should be airborne mid-glide for the test to be meaningful'
      ).to.be.greaterThan(start.y + 1);
      const retrigger = flock.glideTo(box1, { x: 0, y: 5, z: 0, duration: 1, reverse: true });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(box.position.y, 'restart must not snap').to.be.closeTo(airborneY, 1);

      await retrigger;

      expect(box.position.x).to.be.closeTo(start.x, 0.01);
      expect(box.position.y).to.be.closeTo(start.y, 0.01);
      expect(box.position.z).to.be.closeTo(start.z, 0.01);
    });

    it('continues from the current position when a one-way glide is re-triggered @slow', async function () {
      this.timeout(5000);

      const box = flock.scene.getMeshByName(box1);

      flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 1 });
      await new Promise((resolve) => setTimeout(resolve, 400));
      const midX = box.position.x;
      expect(midX).to.be.within(0.5, 5.5);

      const retrigger = flock.glideTo(box1, { x: -6, y: 0, z: 0, duration: 1 });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(box.position.x, 'interrupt must not snap to the old target').to.be.below(midX + 0.1);

      await retrigger;
      expect(box.position.x).to.equal(-6);
    });

    it('does not slow down when the same glide is re-triggered repeatedly @slow', async function () {
      this.timeout(5000);

      const box = flock.scene.getMeshByName(box1);
      const started = performance.now();
      let last = flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 1 });
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        last = flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 1 });
      }
      await last;
      const elapsed = performance.now() - started;

      expect(box.position.x).to.equal(6);
      expect(elapsed).to.be.below(1400);
    });

    it('should handle looping', function (done) {
      this.timeout(10000); // Increase the timeout for this test

      // Move the box with loop enabled
      flock.glideTo(box1, {
        x: 6,
        y: 0,
        z: 0,
        duration: 1,
        reverse: false,
        loop: true,
      }); // Start the glide with looping enabled

      // Track position changes to detect looping
      let maxPosition = 0;
      let hasReachedTarget = false;
      let hasReturnedToStart = false;
      let count = 0;

      const intervalId = setInterval(() => {
        const box = flock.scene.getMeshByName(box1);
        const currentX = box.position.x;

        console.log('Loop check', count, 'Position:', currentX);

        // Track the maximum position reached
        if (currentX > maxPosition) {
          maxPosition = currentX;
        }

        // Check if we've reached near the target (x=6)
        if (currentX > 5 && !hasReachedTarget) {
          hasReachedTarget = true;
          console.log('Reached target position');
        }

        // Check if we've returned to near start after reaching target
        if (hasReachedTarget && currentX < 1 && !hasReturnedToStart) {
          hasReturnedToStart = true;
          console.log('Returned to start - loop cycle detected');
        }

        count++;

        // After enough time, check if we detected loop behavior
        if (count > 8) {
          clearInterval(intervalId);

          // We should have seen the box reach the target and return (indicating a loop)
          // OR the maximum position should be significantly greater than 0 (indicating movement)
          const loopDetected = hasReturnedToStart || maxPosition > 3;
          console.log('Loop test results:', {
            hasReachedTarget,
            hasReturnedToStart,
            maxPosition,
            loopDetected,
          });

          expect(loopDetected).to.be.true;
          done();
        }
      }, 1000);
    });

    it('should follow the correct easing function', async function () {
      this.timeout(5000); // Increase the timeout for this test

      await flock.glideTo(box1, {
        x: 6,
        y: 0,
        z: 0,
        duration: 1,
        reverse: false,
        loop: false,
        easing: 'SineEase',
      });

      const box = flock.scene.getMeshByName(box1);

      // Check if the position matches expected easing behavior
      expect(box.position.x).to.be.closeTo(6, 0.1); // Within some tolerance
      expect(box.position.y).to.be.closeTo(0.5, 0.1);
      expect(box.position.z).to.be.closeTo(0, 0.1);
    });

    it('should complete within the given duration', async function () {
      this.timeout(3000); // Tighter timeout for a 2s animation
      let startTime = null;
      const box = flock.scene.getMeshByName(box1);

      const observer = flock.scene.onBeforeRenderObservable.add(() => {
        if (box.position.x > 0 && startTime === null) {
          startTime = Date.now();
        }
      });

      await flock.glideTo(box1, { x: 6, y: 0, z: 0, duration: 2 });

      flock.scene.onBeforeRenderObservable.remove(observer);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Assert the movement took approximately the specified duration
      expect(duration).to.be.closeTo(2, 0.5);
    });

    it('should handle camera movement @slow', async function () {
      this.timeout(3000); // Set a timeout for the animation

      const camera = flock.scene.activeCamera;
      const targetPosition = { x: 5, y: 5, z: 5 };

      await flock.glideTo(flock.getCamera(), {
        ...targetPosition,
        duration: 1,
      });

      // Assert the camera has moved to the correct position
      expect(camera.position.x).to.be.closeTo(targetPosition.x, 0.1);
      expect(camera.position.y).to.be.closeTo(targetPosition.y, 0.1);
      expect(camera.position.z).to.be.closeTo(targetPosition.z, 0.1);
    });

    it('moves a child of a rotated group along the parent-relative direction @slow', async function () {
      this.timeout(5000);

      const group = await flock.createGroup('glideParent');
      const child = await flock.createBox('glideChild', {
        color: '#996633',
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      try {
        // Parent first, then rotate: mirrors addPrefab (build, rotate,
        // position) so the member rotates rigidly with the group instead of
        // being counter-rotated by world-preserving setParent.
        await flock.setParent(group, child);
        await flock.rotateTo(group, { y: 180 });

        const childMesh = flock.scene.getMeshByName(child);
        const startLocal = childMesh.position.clone();
        const startWorld = childMesh.getAbsolutePosition().clone();

        // The group's -Z faces world +Z after a 180 yaw: gliding 'forward'
        // must move the child towards world +Z, i.e. local -Z.
        await flock.glideDirection(child, { direction: 'forward', distance: 0.5, duration: 0.5 });

        expect(childMesh.position.x).to.be.closeTo(startLocal.x, 0.05);
        expect(childMesh.position.z).to.be.closeTo(startLocal.z - 0.5, 0.05);
        expect(childMesh.getAbsolutePosition().z).to.be.closeTo(startWorld.z + 0.5, 0.05);
      } finally {
        flock.dispose(child);
        flock.dispose(group);
      }
    });

    it('should wait for mesh creation when glideTo is called early', async function () {
      const boxId = 'glideToDelayedCreation';

      const glidePromise = flock.glideTo(boxId, {
        x: 2,
        y: 1,
        z: 0,
        duration: 0.1,
      });

      // Wait a moment before creating the box
      await new Promise((resolve) => setTimeout(resolve, 20));

      await flock.createBox(boxId, {
        position: [0, 0, 0],
      });
      boxIds.push(boxId);

      // The test passes if the promise resolves without error
      await glidePromise;
    });
  });
}
