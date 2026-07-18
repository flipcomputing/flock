import { expect } from "chai";

export function runSoundTests(flock) {
  describe("Sound playback @sound @slow", function () {
    this.timeout(10000); // Allow time for async sound to start/stop

    let boxId;

    beforeEach(() => {
      // Create a box to attach spatial sound to. createBox returns the actual
      // (possibly suffixed) id; later playSound calls must use that, not the
      // requested name, since dispose does not free the reserved name.
      boxId = flock.createBox("soundBox", {
        color: "#FF0000",
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
    });

    afterEach(() => {
      flock.stopAllSounds(); // Stop any sounds still playing
      flock.dispose(boxId); // Clean up box
    });

    it("should allow replacing a sound", async function () {
      this.timeout(5000);

      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;

      // Play first sound
      await flock.playSound(boxId, {
        soundName: "test.mp3",
        loop: true,
      });
      expect(box.metadata?.currentSound?.name).to.equal("test.mp3");

      // Replace with a second sound
      await flock.playSound(boxId, {
        soundName: "test2.mp3",
        loop: true,
      });
      expect(box.metadata?.currentSound?.name).to.equal("test2.mp3");
    });

    it("should allow replacing the sound on a mesh", async function () {
      this.timeout(5000);

      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;

      await flock.playSound(boxId, {
        soundName: "test.mp3",
        loop: false,
      });
      expect(box.metadata.currentSound).to.not.exist;

      expect(box).to.exist;

      await flock.playSound(boxId, {
        soundName: "test2.mp3",
        loop: false,
      });
      expect(box.metadata.currentSound).to.not.exist;
    });

    it("should play and stop a spatial sound", async () => {
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;

      await flock.playSound(boxId, {
        soundName: "test.mp3",
        loop: false,
      });

      expect(box.metadata?.currentSound).to.not.exist;
      expect(flock.globalSounds.includes("test.mp3")).to.be.false;
    });

    function promiseWithTimeout(promise, timeout = 2000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Sound did not finish in time")),
          timeout,
        );
        promise.then((value) => {
          clearTimeout(timer);
          resolve(value);
        }, reject);
      });
    }

    it("should play and stop a global (everywhere) sound", async () => {
      let ended = false;

      const result = flock.playSound("__everywhere__", {
        soundName: "test.mp3",
        volume: 0.5,
      });

      await promiseWithTimeout(result, 2000).then(() => {
        ended = true;
      });

      expect(ended).to.be.true;
    });

    it("should loop a sound until manually stopped", async () => {
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;

      await flock.playSound(boxId, { soundName: "test.mp3", loop: true });

      let attempts = 0;
      while (!box.metadata.currentSound && attempts < 10) {
        await new Promise((r) => setTimeout(r, 50));
        attempts++;
      }

      const initialSound = box.metadata.currentSound;
      expect(initialSound).to.exist;

      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(box.metadata.currentSound).to.equal(initialSound);

      flock.stopAllSounds();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(box.metadata.currentSound).to.not.exist;
    });

    it("should loop a sound at least once", async function () {
      this.timeout(10000);

      const localBoxId = flock.createBox("soundBox", {
        color: "#FF0000",
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });

      await flock.playSound(localBoxId, { soundName: "test.mp3", loop: true });

      let attempts = 0;
      while (
        !flock.scene.getMeshByName(localBoxId)?.metadata?.currentSound &&
        attempts < 10
      ) {
        await new Promise((r) => setTimeout(r, 50));
        attempts++;
      }

      const sound = flock.scene.getMeshByName(localBoxId)?.metadata?.currentSound;
      expect(sound).to.exist;

      // After more than one play-through, the looping sound should still be the
      // same attached sound (native Web Audio sounds expose no currentTime).
      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(
        flock.scene.getMeshByName(localBoxId)?.metadata?.currentSound,
      ).to.equal(sound);

      flock.stopAllSounds();
      flock.dispose(localBoxId);
    });

    it("should wait for sound to finish if using await", async function () {
      this.timeout(5000);

      const start = performance.now();
      await flock.playSound("__everywhere__", {
        soundName: "test.mp3",
        loop: false,
        volume: 1,
      });
      const elapsed = performance.now() - start;

      expect(elapsed).to.be.greaterThan(1000);
    });

    it("should return a Promise immediately if not using await", async function () {
      this.timeout(5000);

      const start = performance.now();
      const promise = flock.playSound("__everywhere__", {
        soundName: "test.mp3",
        loop: false,
        volume: 1,
      });
      const elapsed = performance.now() - start;

      expect(elapsed).to.be.lessThan(50);
      expect(promise).to.have.property("then");

      await promise;
    });
  });

  describe("Play notes @sound @slow", function () {
    this.timeout(10000); // Allow time for async sound to start/stop
    let boxId;
    beforeEach(() => {
      // Create a box to attach spatial sound to. createBox returns the actual
      // (possibly suffixed) id; later playSound calls must use that, not the
      // requested name, since dispose does not free the reserved name.
      boxId = flock.createBox("soundBox", {
        color: "#FF0000",
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
    });
    afterEach(() => {
      flock.stopAllSounds(); // Stop any sounds still playing
      flock.dispose(boxId); // Clean up box
    });
    it("should play notes with default parameters", async function () {
      this.timeout(3000);
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      expect(() => {
        flock.playNotes(boxId, {});
      }).to.not.throw();
    });
    it("should play notes with specified notes and durations", async function () {
      this.timeout(3000);
      const start = performance.now();
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      const notes = [60, 62, 64]; // C4, D4, E4 as MIDI numbers
      const durations = [0.2, 0.2, 0.2]; // Total duration 0.6s
      const bpm = 120; // 2 beats per second, so 0.6s / 2 = 0.3s per beat

      await flock.playNotes(boxId, { notes, durations, bpm });
      const elapsed = (performance.now() - start) / 1000;

      // The total time is the sum of all but the last duration (which is the start time of the last note),
      // plus the duration of the last note itself. All converted from beats to seconds.
      const secondsPerBeat = 60 / bpm;
      const expectedDuration =
        durations.reduce((a, b) => a + b, 0) * secondsPerBeat;

      expect(elapsed).to.be.greaterThan(expectedDuration - 0.1);
    });
    it("should play notes with custom instrument", async function () {
      this.timeout(3000);
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      const notes = [57, 59]; // A3, B3 as MIDI numbers
      const durations = [0.25, 0.25];
      const instrument = flock.createInstrument("sawtooth", {
        frequency: 220,
        attack: 0.2,
        decay: 0.4,
        sustain: 0.6,
        release: 0.8,
      });
      await flock.playNotes(boxId, { notes, durations, instrument });
    });
    it("should handle empty notes array", async function () {
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      expect(() => {
        flock.playNotes(boxId, { notes: [], durations: [] });
      }).to.not.throw();
    });
    it("should handle mismatched notes and durations arrays", async function () {
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      const notes = [60, 62, 64]; // C4, D4, E4
      const durations = [0.5, 0.5]; // One less duration than notes
      expect(() => {
        flock.playNotes(boxId, { notes, durations });
      }).to.not.throw();
    });

    it("should not log errors for missing durations", async function () {
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      const notes = [60, 62];
      const durations = []; // missing durations

      const capturedErrors = [];
      const origConsoleError = console.error;
      console.error = (...args) => {
        capturedErrors.push(args.join(" "));
      };
      try {
        flock.playNotes(boxId, { notes, durations });
        await new Promise((r) => setTimeout(r, 100)); // wait for potential async errors
        expect(
          capturedErrors.some((msg) =>
            /linearRampToValueAtTime|non-finite/i.test(msg),
          ),
        ).to.be.false;
      } finally {
        console.error = origConsoleError;
      }
    });

    describe("should handle invalid numeric inputs without logging errors", () => {
      const testCases = [
        { name: "NaN duration", durations: [NaN, 0.5] },
        { name: "Infinity duration", durations: [Infinity, 0.5] },
        { name: "negative duration", durations: [-1, 0.5] },
        { name: "invalid bpm", durations: [0.5], bpm: NaN },
      ];

      testCases.forEach(({ name, durations, bpm }) => {
        it(`when given ${name}`, async () => {
          const capturedErrors = [];
          const origConsoleError = console.error;
          console.error = (...args) => capturedErrors.push(args.join(" "));
          try {
            await flock.playNotes(boxId, { notes: [60, 62], durations, bpm });
            await new Promise((r) => setTimeout(r, 100));
            const hasError = capturedErrors.some((msg) =>
              /linearRampToValueAtTime|non-finite/i.test(msg),
            );
            expect(hasError).to.be.false;
          } finally {
            console.error = origConsoleError;
          }
        });
      });
    });
    it("should work with await syntax", async function () {
      this.timeout(3000);
      const box = flock.scene.getMeshByName(boxId);
      expect(box).to.exist;
      const notes = [67, 69]; // G4, A4 as MIDI numbers
      const durations = [0.3, 0.3];
      // Should support async/await pattern
      await flock.playNotes(boxId, { notes, durations });
    });
    it("should handle invalid mesh name gracefully", function () {
      expect(() => {
        flock.playNotes("nonexistentMesh", {
          notes: [60],
          durations: [0.5],
        });
      }).to.not.throw(); // Should handle gracefully
    });
  });

  describe("Audio visibility suspend/resume @sound @slow", function () {
    this.timeout(10000);

    function setVisibility(state) {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });
    }

    afterEach(() => {
      // Remove the own-property override so the prototype getter takes over again
      delete document.visibilityState;
      flock._audioSuspendedByVisibility = false;
    });

    function dispatchVisibility(state) {
      setVisibility(state);
      document.dispatchEvent(new Event("visibilitychange"));
    }

    async function waitForState(context, state, timeout = 2000) {
      const start = Date.now();
      while (context.state !== state && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return context.state;
    }

    async function getRunningContext() {
      await flock.ensureAudio();
      const context = flock.audioEngine?._audioContext ?? flock.audioContext;
      if (!context) return null;
      if (context.state !== "running") {
        await context.resume().catch(() => {});
      }
      return context.state === "running" ? context : null; // null: autoplay blocked
    }

    it("pauses audio when hidden and resumes when visible", async function () {
      const context = await getRunningContext();
      if (!context) this.skip();
      expect(flock._audioVisibilityListenerAdded).to.be.true;

      dispatchVisibility("hidden");
      expect(await waitForState(context, "suspended")).to.equal("suspended");
      expect(flock._audioSuspendedByVisibility).to.be.true;

      // Babylon's resumeOnPause watchdog fires on a 1s interval; wait past it
      // to prove pauseAsync stood it down and the suspension sticks.
      if (flock.audioEngine) {
        await new Promise((r) => setTimeout(r, 1500));
        expect(context.state).to.equal("suspended");
      }

      dispatchVisibility("visible");
      expect(await waitForState(context, "running")).to.equal("running");
      expect(flock._audioSuspendedByVisibility).to.be.false;
    });

    it("keeps playing when the window loses focus but stays visible", async function () {
      const context = await getRunningContext();
      if (!context) this.skip();

      window.dispatchEvent(new Event("blur"));
      await new Promise((r) => setTimeout(r, 300));
      expect(context.state).to.equal("running");
      expect(flock._audioSuspendedByVisibility).to.be.false;
    });

    // Chromium never produces 'interrupted', so stub the engine.
    it("records intent when hidden while already interrupted", async function () {
      const realEngine = flock.audioEngine;
      const calls = [];
      flock.audioEngine = {
        state: "interrupted",
        pauseAsync: async () => calls.push("pause"),
        resumeAsync: async () => calls.push("resume"),
      };
      try {
        dispatchVisibility("hidden");
        await new Promise((r) => setTimeout(r, 100));
        // Nothing to suspend, but the return trip must still resume it.
        expect(calls).to.not.include("pause");
        expect(flock._audioSuspendedByVisibility).to.be.true;

        dispatchVisibility("visible");
        await new Promise((r) => setTimeout(r, 100));
        expect(calls).to.include("resume");
        expect(flock._audioSuspendedByVisibility).to.be.false;
      } finally {
        flock.audioEngine = realEngine;
      }
    });

    it("does not resume a context it did not suspend", async function () {
      await flock.ensureAudio();
      const context = flock.audioEngine?._audioContext ?? flock.audioContext;
      if (!context || context.state === "closed") this.skip();

      const engine = flock.audioEngine;
      if (engine) {
        await engine.pauseAsync().catch(() => {});
      } else {
        await context.suspend().catch(() => {});
      }
      expect(context.state).to.equal("suspended");

      dispatchVisibility("visible");
      await new Promise((r) => setTimeout(r, 300));
      expect(context.state).to.equal("suspended");

      // Restore for subsequent suites
      if (engine) {
        await engine.resumeAsync().catch(() => {});
      } else {
        await context.resume().catch(() => {});
      }
    });
  });

  describe("Audio lifecycle @sound @slow", function () {
    this.timeout(10000);

    // audioTimer defers cleanup while a context is parked on this premise; if a
    // platform kept the clock running, that deferral would become a hang.
    it("audio time does not advance while the context is suspended", async function () {
      // Mirror getOrCreateContext's constructor so WebKit is covered too.
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) this.skip();
      const ctx = new AudioContextCtor();
      try {
        await ctx.resume().catch(() => {});
        if (ctx.state !== "running") this.skip(); // autoplay blocked
        await ctx.suspend();
        // After the suspension takes effect, or suspend latency skews the delta.
        const before = ctx.currentTime;
        await new Promise((r) => setTimeout(r, 300));
        expect(ctx.currentTime - before).to.be.lessThan(0.05);
      } finally {
        await ctx.close().catch(() => {});
      }
    });

    // A stop during speak()'s awaits must prevent queueing, not just cancel.
    it("does not speak when a stop lands before the utterance is queued", async function () {
      const synth = window.speechSynthesis;
      if (!synth) this.skip();
      const boxId = flock.createBox("speakStopBox", {
        color: "#FF0000",
        width: 1,
        height: 1,
        depth: 1,
        position: [0, 0, 0],
      });
      const original = synth.speak;
      let spoken = 0;
      synth.speak = function (...args) {
        spoken++;
        return original.apply(synth, args);
      };
      try {
        const pending = flock.speak(boxId, "hello", { mode: "await" });
        flock.stopAllSounds(); // synchronous — lands while speak() is awaiting
        await pending;
        expect(spoken).to.equal(0);
      } finally {
        synth.speak = original;
        flock.dispose(boxId);
      }
    });

    const speechBanners = () =>
      Array.from(document.querySelectorAll(".flock-banner")).filter((el) =>
        /speech is not available/i.test(el.textContent),
      );

    // Mock the error rather than reading getVoices(): the list can populate
    // later via voiceschanged, so an empty one is not proof of no speech.
    async function speakWithError(error) {
      const synth = window.speechSynthesis;
      const realSpeak = synth.speak;
      synth.speak = (utterance) => utterance.onerror?.({ error });
      try {
        speechBanners().forEach((el) => el.remove());
        await flock.speak("__everywhere__", "hello", { mode: "await" });
        return speechBanners().length;
      } finally {
        synth.speak = realSpeak;
        speechBanners().forEach((el) => el.remove());
      }
    }

    it("banners when speech cannot be produced", async function () {
      if (!window.speechSynthesis) this.skip();
      expect(await speakWithError("synthesis-failed")).to.equal(1);
    });

    it("does not banner when speech is merely cancelled", async function () {
      if (!window.speechSynthesis) this.skip();
      expect(await speakWithError("canceled")).to.equal(0);
    });

    // A suspension that starts and ends mid-wait advances the wall clock only.
    it("playNotes waits on audio time, not wall clock", async function () {
      const ctx = flock.audioEngine?._audioContext ?? flock.audioContext;
      if (!ctx || ctx.state !== "running") this.skip();
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const play = () =>
        flock.playNotes("__everywhere__", { notes: [60], durations: [0.5] });

      const t0 = performance.now();
      await play();
      const baseline = performance.now() - t0;

      let elapsed;
      try {
        const t1 = performance.now();
        const pending = play();
        await wait(150);
        await ctx.suspend();
        await wait(700);
        await ctx.resume();
        await pending;
        elapsed = performance.now() - t1;
      } finally {
        if (ctx.state !== "running") await ctx.resume().catch(() => {});
      }

      // Without the audio-time deadline the 700 ms is absorbed.
      expect(elapsed).to.be.greaterThan(baseline + 400);
    });

    it("stopAllSounds cancels speech", function () {
      const synth = window.speechSynthesis;
      if (!synth) this.skip();
      const original = synth.cancel;
      let calls = 0;
      synth.cancel = function (...args) {
        calls++;
        return original.apply(synth, args);
      };
      try {
        flock.stopAllSounds();
        expect(calls).to.be.greaterThan(0);
      } finally {
        synth.cancel = original;
      }
    });
  });
}
