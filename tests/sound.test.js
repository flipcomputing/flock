import { expect } from "chai";

export function runSoundTests(flock) {
	describe("Sound playback", function () {
		this.timeout(10000); // Allow time for async sound to start/stop

		let boxId;

		beforeEach(() => {
			// Create a box to attach spatial sound to
			boxId = "soundBox";
			flock.createBox(boxId, "#FF0000", 1, 1, 1, [0, 0, 0]);
		});

		afterEach(() => {
			flock.stopAllSounds(); // Stop any sounds still playing
			flock.dispose(boxId); // Clean up box
		});

		it("should play and stop a spatial sound", async () => {
			const result = await flock.playSound(boxId, "test.mp3");

			const box = flock.scene.getMeshByName(boxId);
			expect(box).to.exist;

			// Wait up to 500ms for sound to attach
			let attempts = 0;
			while (!box.metadata.currentSound && attempts < 10) {
				await new Promise((r) => setTimeout(r, 50));
				attempts++;
			}

			expect(box.metadata.currentSound).to.exist;
			expect(box.metadata.currentSound.name).to.equal("test.mp3");

			flock.stopAllSounds();

			expect(box.metadata.currentSound).to.not.exist;
		});


		it("should play and stop a global (everywhere) sound", async () => {
			let ended = false;

			const result = await flock.playSound("__everywhere__", "test.wav", {
				volume: 0.5,
			});

			// We only get a promise when playing "__everywhere__"
			if (result instanceof Promise) {
				await result.then(() => {
					ended = true;
				});
			}

			expect(ended).to.be.true;
		});
	});
}
