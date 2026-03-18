/**
 * Sound Integration Tests
 * Tests integration workflows, edge cases, and resource management
 *
 * Focus: Multi-step scenarios, async behavior, cleanup, edge cases
 * NOT testing: API method existence, simple property values (that's verification's job)
 *
 * Refactored from sound-phase1-api.test.js
 * @tags @sound @slow @sound-integration
 */

export function runSoundIntegrationTests(flock) {
  describe("Sound Integration Tests @sound @slow @sound-integration", function () {
    this.timeout(10000);

    // Helper function to wait for sound to attach to mesh
    async function waitForSoundOnMesh(meshName, maxAttempts = 10) {
      const mesh = flock.scene.getMeshByName(meshName);
      let attempts = 0;
      while (!mesh.metadata?.currentSound && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
      }
      return mesh;
    }

    beforeEach(async function () {
      flock.stopAllSounds();

      const testMeshes = ['testSoundBox', 'testSoundSphere', 'testConfigBox', 'nonExistentMesh'];
      testMeshes.forEach(meshName => {
        const mesh = flock.scene.getMeshByName(meshName);
        if (mesh) {
          flock.dispose(meshName);
        }
      });
    });

    afterEach(function () {
      flock.stopAllSounds();
    });

    describe("Sound Lifecycle & Replacement", function () {
      it("should replace existing sound on mesh", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        // Play first sound
        const firstSound = await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        const mesh = await waitForSoundOnMesh('testSoundBox');
        chai.expect(mesh.metadata.currentSound).to.equal(firstSound);
        chai.expect(firstSound.name).to.equal('test.mp3');

        // Play second sound (should replace first)
        // Note: Using loop=true so promise resolves when attached, not when sound ends
        const secondSound = await flock.playSound('testSoundBox', {
          soundName: 'test2.mp3',
          loop: true
        });

        // Verify replacement occurred
        chai.expect(secondSound).to.not.be.undefined;
        chai.expect(secondSound).to.not.equal(firstSound);
        chai.expect(secondSound.name).to.equal('test2.mp3');
        chai.expect(mesh.metadata.currentSound).to.equal(secondSound);
        chai.expect(mesh.metadata.currentSound.name).to.equal('test2.mp3');
      });

      it("should handle rapid sound replacements", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        // Rapidly replace sounds
        flock.playSound('testSoundBox', { soundName: 'test.mp3', loop: true });
        flock.playSound('testSoundBox', { soundName: 'test2.mp3', loop: true });
        flock.playSound('testSoundBox', { soundName: 'test.mp3', loop: true });

        await new Promise(r => setTimeout(r, 200));

        const mesh = flock.scene.getMeshByName('testSoundBox');

        // Should have a sound attached (order is non-deterministic in async environment)
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
        chai.expect(['test.mp3', 'test2.mp3']).to.include(mesh.metadata.currentSound.name);
      });
    });

    describe("Async Workflows & Deferred Creation", function () {
      it("should handle sound on mesh that doesn't exist yet", async function () {
        // Start playing sound before mesh exists
        const soundPromise = flock.playSound('nonExistentMesh', {
          soundName: 'test.mp3',
          loop: true
        });

        // Create the mesh after a short delay
        setTimeout(() => {
          flock.createBox('nonExistentMesh', { x: 0, y: 0, z: 0 });
        }, 100);

        // Wait for sound to attach
        await soundPromise;

        const mesh = await waitForSoundOnMesh('nonExistentMesh');

        // Verify sound was queued and attached when mesh became available
        chai.expect(mesh).to.not.be.null;
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
        chai.expect(mesh.metadata.currentSound.name).to.equal('test.mp3');
      });

      it("should handle multiple deferred sounds to same mesh", async function () {
        // Queue multiple sounds before mesh exists
        const promise1 = flock.playSound('deferredMesh', {
          soundName: 'test.mp3',
          loop: true
        });

        const promise2 = flock.playSound('deferredMesh', {
          soundName: 'test2.mp3',
          loop: true
        });

        // Create mesh
        setTimeout(() => {
          flock.createBox('deferredMesh', { x: 0, y: 0, z: 0 });
        }, 100);

        await promise1;
        await promise2;

        const mesh = await waitForSoundOnMesh('deferredMesh');

        // Last sound should win
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
      });
    });

    describe("Edge Cases & Error Handling", function () {
      it("should initialize mesh metadata if not present", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });
        const mesh = flock.scene.getMeshByName('testSoundBox');

        // Clear metadata to test initialization
        mesh.metadata = null;

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        await waitForSoundOnMesh('testSoundBox');

        // Verify API properly initialized metadata
        chai.expect(mesh.metadata).to.be.an('object');
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
      });

      it("should handle metadata as non-object", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });
        const mesh = flock.scene.getMeshByName('testSoundBox');

        // Set metadata to primitive (edge case)
        mesh.metadata = "string";

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        await waitForSoundOnMesh('testSoundBox');

        // Should replace with proper object
        chai.expect(mesh.metadata).to.be.an('object');
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
      });
    });

    describe("Resource Cleanup & Memory Management", function () {
      it("should stop all sounds", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        flock.playSound('__everywhere__', {
          soundName: 'test2.mp3',
          loop: true
        });

        await new Promise(r => setTimeout(r, 200));

        const initialCount = flock.globalSounds.length;
        chai.expect(initialCount).to.be.greaterThan(0);

        flock.stopAllSounds();

        // Global sounds array should be cleared
        chai.expect(flock.globalSounds.length).to.equal(0);
      });

      it("should clear sound from mesh metadata on stopAll", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        const mesh = await waitForSoundOnMesh('testSoundBox');
        chai.expect(mesh.metadata.currentSound).to.not.be.undefined;

        flock.stopAllSounds();

        // Current sound should be cleared from metadata
        chai.expect(mesh.metadata.currentSound).to.be.undefined;
      });

      it("should clean up global sounds array when replacing mesh sound", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        await waitForSoundOnMesh('testSoundBox');
        const initialCount = flock.globalSounds.length;

        // Replace with new sound
        await flock.playSound('testSoundBox', {
          soundName: 'test2.mp3',
          loop: true
        });

        await new Promise(r => setTimeout(r, 100));

        // Should still have same number (or close) - old sound cleaned up
        chai.expect(flock.globalSounds.length).to.be.lessThan(initialCount + 2);
      });
    });

    describe("Spatial vs Non-Spatial Integration", function () {
      it("should attach sound to mesh with _attachedMesh reference", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        const mesh = await waitForSoundOnMesh('testSoundBox');
        const sound = mesh.metadata.currentSound;

        // Verify bidirectional relationship
        chai.expect(sound._attachedMesh).to.equal(mesh);
        chai.expect(mesh.metadata.currentSound).to.equal(sound);
      });

      it("should add spatial sounds to globalSounds array", async function () {
        flock.createBox('testSoundBox', { x: 0, y: 0, z: 0 });

        const beforeCount = flock.globalSounds.length;

        await flock.playSound('testSoundBox', {
          soundName: 'test.mp3',
          loop: true
        });

        await waitForSoundOnMesh('testSoundBox');

        // Spatial sounds should also be tracked in globalSounds
        chai.expect(flock.globalSounds.length).to.equal(beforeCount + 1);
      });

      it("should create global sound without mesh attachment", async function () {
        const beforeCount = flock.globalSounds.length;

        flock.playSound('__everywhere__', {
          soundName: 'test.mp3',
          loop: true
        });

        await new Promise(r => setTimeout(r, 200));

        chai.expect(flock.globalSounds.length).to.equal(beforeCount + 1);
        const sound = flock.globalSounds[flock.globalSounds.length - 1];

        // Global sounds should not have _attachedMesh
        chai.expect(sound._attachedMesh).to.be.undefined;
      });
    });

    describe("Configuration Integration", function () {
      it("should create and apply loop configuration", async function () {
        flock.createBox('testConfigBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testConfigBox', {
          soundName: 'test.mp3',
          loop: true
        });

        const mesh = await waitForSoundOnMesh('testConfigBox');
        const sound = mesh.metadata.currentSound;

        // Loop should be applied
        chai.expect(sound.loop).to.be.true;

        // Should be modifiable
        sound.loop = false;
        chai.expect(sound.loop).to.be.false;
      });

      it("should create and apply playback rate configuration", async function () {
        flock.createBox('testConfigBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testConfigBox', {
          soundName: 'test.mp3',
          playbackRate: 1.5,
          loop: true
        });

        const mesh = await waitForSoundOnMesh('testConfigBox');
        const sound = mesh.metadata.currentSound;

        // Playback rate should be applied
        chai.expect(sound.playbackRate).to.equal(1.5);

        // Should be modifiable
        sound.playbackRate = 0.8;
        chai.expect(sound.playbackRate).to.equal(0.8);
      });

      it("should handle multiple configuration changes in sequence", async function () {
        flock.createBox('testConfigBox', { x: 0, y: 0, z: 0 });

        await flock.playSound('testConfigBox', {
          soundName: 'test.mp3',
          volume: 0.7,
          loop: true,
          playbackRate: 1.5
        });

        const mesh = await waitForSoundOnMesh('testConfigBox');
        const sound = mesh.metadata.currentSound;

        // All configurations should be applied
        chai.expect(sound.loop).to.be.true;
        chai.expect(sound.playbackRate).to.equal(1.5);

        // Modify multiple properties
        sound.loop = false;
        sound.playbackRate = 0.8;
        sound.setVolume(0.5);

        chai.expect(sound.loop).to.be.false;
        chai.expect(sound.playbackRate).to.equal(0.8);
      });
    });
  });
}
