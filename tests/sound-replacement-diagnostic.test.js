/**
 * Diagnostic test to investigate sound replacement behavior
 * @tags @sound @slow @diagnostic
 */

export function runSoundReplacementDiagnostic(flock) {
  describe("Sound Replacement Diagnostic @sound @slow @diagnostic", function () {
    this.timeout(10000);

    beforeEach(async function () {
      flock.stopAllSounds();
      const mesh = flock.scene.getMeshByName('diagnosticBox');
      if (mesh) {
        flock.dispose('diagnosticBox');
      }
    });

    afterEach(function () {
      flock.stopAllSounds();
    });

    it("should investigate sound replacement timing with loop=false", async function () {
      flock.createBox('diagnosticBox', { x: 0, y: 0, z: 0 });

      console.log("\n=== Test 1: Playing first sound (loop=true) ===");
      const promise1 = flock.playSound('diagnosticBox', {
        soundName: 'test.mp3',
        loop: true
      });

      console.log("Promise1 created, type:", typeof promise1, promise1.constructor.name);
      const sound1 = await promise1;
      console.log("Promise1 resolved, returned:", typeof sound1, sound1?.name);

      const mesh = flock.scene.getMeshByName('diagnosticBox');
      console.log("mesh.metadata.currentSound:", mesh.metadata?.currentSound?.name);
      console.log("sound1 === mesh.metadata.currentSound:", sound1 === mesh.metadata.currentSound);

      console.log("\n=== Test 2: Playing second sound (loop=false) ===");
      console.log("Before second playSound, currentSound:", mesh.metadata?.currentSound?.name);

      const promise2 = flock.playSound('diagnosticBox', {
        soundName: 'test2.mp3',
        loop: false
      });

      console.log("Promise2 created, type:", typeof promise2, promise2.constructor.name);
      console.log("Immediately after playSound call, currentSound:", mesh.metadata?.currentSound?.name);

      // Wait a bit WITHOUT awaiting the promise
      await new Promise(r => setTimeout(r, 50));
      console.log("After 50ms (promise not awaited), currentSound:", mesh.metadata?.currentSound?.name);

      await new Promise(r => setTimeout(r, 100));
      console.log("After 150ms total (promise not awaited), currentSound:", mesh.metadata?.currentSound?.name);

      await new Promise(r => setTimeout(r, 200));
      console.log("After 350ms total (promise not awaited), currentSound:", mesh.metadata?.currentSound?.name);

      console.log("\n=== Now awaiting the promise2 ===");
      console.log("Note: This will wait for the sound to FINISH playing");
      // Note: This promise resolves when sound ends, not when it attaches!
      await promise2;
      console.log("Promise2 resolved (sound finished playing)");
      console.log("After promise2 resolved, currentSound:", mesh.metadata?.currentSound?.name);

      chai.expect(true).to.be.true;
    });

    it("should investigate sound replacement timing with loop=true", async function () {
      flock.createBox('diagnosticBox', { x: 0, y: 0, z: 0 });

      console.log("\n=== Test 3: Both sounds with loop=true ===");
      const sound1 = await flock.playSound('diagnosticBox', {
        soundName: 'test.mp3',
        loop: true
      });

      const mesh = flock.scene.getMeshByName('diagnosticBox');
      console.log("After first sound (loop=true), currentSound:", mesh.metadata?.currentSound?.name);

      const sound2 = await flock.playSound('diagnosticBox', {
        soundName: 'test2.mp3',
        loop: true
      });

      console.log("After second sound (loop=true), currentSound:", mesh.metadata?.currentSound?.name);
      console.log("sound2:", typeof sound2, sound2?.name);
      console.log("sound2 === mesh.metadata.currentSound:", sound2 === mesh.metadata.currentSound);

      chai.expect(mesh.metadata.currentSound).to.not.be.undefined;
      chai.expect(mesh.metadata.currentSound.name).to.equal('test2.mp3');
      chai.expect(sound2).to.equal(mesh.metadata.currentSound);
    });

    it("should check if playSound deletes currentSound before creating new one", async function () {
      flock.createBox('diagnosticBox', { x: 0, y: 0, z: 0 });

      console.log("\n=== Test 4: Checking deletion timing ===");
      await flock.playSound('diagnosticBox', {
        soundName: 'test.mp3',
        loop: true
      });

      const mesh = flock.scene.getMeshByName('diagnosticBox');
      console.log("Initial currentSound:", mesh.metadata?.currentSound?.name);

      // Start second sound but don't await
      const promise = flock.playSound('diagnosticBox', {
        soundName: 'test2.mp3',
        loop: true
      });

      console.log("Synchronously after playSound call:", mesh.metadata?.currentSound?.name);

      await new Promise(r => setTimeout(r, 10));
      console.log("After 10ms:", mesh.metadata?.currentSound?.name);

      await new Promise(r => setTimeout(r, 40));
      console.log("After 50ms:", mesh.metadata?.currentSound?.name);

      await promise;
      console.log("After awaiting promise:", mesh.metadata?.currentSound?.name);

      chai.expect(true).to.be.true;
    });
  });
}
