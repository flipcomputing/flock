/**
 * Sound API Investigation Test
 * This test explores what methods and properties are available on BabylonJS Sound objects
 * @tags @sound @slow @investigation
 */

export function runSoundAPIInvestigation(flock) {
  describe("Sound API Investigation @sound @slow @investigation", function () {
    this.timeout(10000);

    afterEach(function () {
      flock.stopAllSounds();
    });

    it("should inspect Sound object methods and properties", async function () {
      flock.createBox('investigateBox', { x: 0, y: 0, z: 0 });

      await flock.playSound('investigateBox', {
        soundName: 'test.mp3',
        loop: true,
        volume: 0.5
      });

      // Wait for sound to attach
      const mesh = flock.scene.getMeshByName('investigateBox');
      let attempts = 0;
      while (!mesh.metadata?.currentSound && attempts < 10) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
      }

      const sound = mesh.metadata.currentSound;

      console.log("\n=== Sound Object Properties ===");
      console.log("Object keys:", Object.keys(sound));
      console.log("\n=== Methods ===");
      console.log("getVolume:", typeof sound.getVolume);
      console.log("setVolume:", typeof sound.setVolume);
      console.log("getPlaybackRate:", typeof sound.getPlaybackRate);
      console.log("setPlaybackRate:", typeof sound.setPlaybackRate);
      console.log("play:", typeof sound.play);
      console.log("pause:", typeof sound.pause);
      console.log("stop:", typeof sound.stop);
      console.log("isReady:", typeof sound.isReady);

      console.log("\n=== Properties ===");
      console.log("name:", sound.name);
      console.log("loop:", sound.loop);
      console.log("playbackRate:", sound.playbackRate);
      console.log("_spatial:", sound._spatial);
      console.log("_state:", sound._state);
      console.log("_audioContext:", typeof sound._audioContext);
      console.log("_buffer:", typeof sound._buffer);
      console.log("_attachedMesh:", sound._attachedMesh?.name);

      console.log("\n=== Attempting Method Calls ===");
      if (typeof sound.getVolume === 'function') {
        try {
          const vol = sound.getVolume();
          console.log("getVolume() returned:", vol);
        } catch (e) {
          console.log("getVolume() error:", e.message);
        }
      }

      if (typeof sound.setVolume === 'function') {
        try {
          sound.setVolume(0.7);
          console.log("setVolume(0.7) succeeded");
          if (typeof sound.getVolume === 'function') {
            console.log("New volume:", sound.getVolume());
          }
        } catch (e) {
          console.log("setVolume() error:", e.message);
        }
      }

      chai.expect(sound).to.not.be.undefined;
    });

    it("should inspect global sound properties", async function () {
      await flock.playSound('__everywhere__', {
        soundName: 'test.mp3',
        loop: true,
        volume: 0.5
      });

      await new Promise(r => setTimeout(r, 200));

      const sound = flock.globalSounds[flock.globalSounds.length - 1];

      console.log("\n=== Global Sound Properties ===");
      console.log("_spatial:", sound._spatial);
      console.log("name:", sound.name);
      console.log("loop:", sound.loop);
      console.log("playbackRate:", sound.playbackRate);
      console.log("All properties:", Object.keys(sound).slice(0, 20));

      chai.expect(sound).to.not.be.undefined;
    });
  });
}
