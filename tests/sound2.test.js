import { expect } from "chai";

export function runSound2Tests(flock) {
  describe("Sound API (BPM and speech) @sound2", function () {
    describe("setBPM", function () {
      afterEach(function () {
        if (flock.scene.metadata) {
          delete flock.scene.metadata.bpm;
        }
      });

      it("should set bpm on scene metadata when meshName is '__everywhere__'", function () {
        flock.setBPM("__everywhere__", 120);
        expect(flock.scene.metadata.bpm).to.equal(120);
      });

      it("should clamp invalid bpm to 60", function () {
        flock.setBPM("__everywhere__", -5);
        expect(flock.scene.metadata.bpm).to.equal(60);
      });

      it("should set bpm on mesh metadata for a named mesh", async function () {
        const id = "bpmTestBox";
        flock.createBox(id, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });

        await flock.setBPM(id, 90);

        const mesh = flock.scene.getMeshByName(id);
        expect(mesh.metadata.bpm).to.equal(90);
        flock.dispose(id);
      });
    });

    describe("speak", function () {
      // speak waits for speechSynthesis voices which never load in headless;
      // race against a short timeout — if no error is thrown before the
      // timeout, the test passes.
      function speakWithTimeout(fn, ms = 500) {
        return Promise.race([
          fn().catch((e) => {
            throw new Error(`speak threw unexpectedly: ${e.message}`);
          }),
          new Promise((resolve) => setTimeout(resolve, ms)),
        ]);
      }

      it("should not throw when called with a mesh name and text", async function () {
        const id = "speakTestBox";
        flock.createBox(id, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });

        try {
          await speakWithTimeout(() => flock.speak(id, "hello"));
        } finally {
          flock.dispose(id);
        }
      });

      it("should not throw when called with '__everywhere__'", async function () {
        await speakWithTimeout(() => flock.speak("__everywhere__", "hi"));
      });
    });
  });
}
