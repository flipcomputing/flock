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

		
		it("should allow replacing a sound", async function () {
			this.timeout(5000);

			const box = flock.scene.getMeshByName(boxId);
			expect(box).to.exist;

			// Play first sound and ignore any late errors
			flock.playSound(boxId, "test.mp3", { loop: true }).catch(() => {});

			await new Promise((r) => setTimeout(r, 500));
			expect(box.metadata?.currentSound?.name).to.equal("test.mp3");

			// Replace with a second sound (also fire-and-forget)
			flock.playSound(boxId, "test2.mp3", { loop: true }).catch(() => {});

			await new Promise((r) => setTimeout(r, 500));
			expect(box.metadata?.currentSound?.name).to.equal("test2.mp3");
		});

		it("should allow replacing the sound on a mesh", async function () {
			this.timeout(5000);

			const box = flock.scene.getMeshByName(boxId);
			expect(box).to.exist;

			await flock.playSound(boxId, "test.mp3", { loop: false });
			expect(box.metadata.currentSound).to.not.exist;

			expect(box).to.exist;

			await flock.playSound(boxId, "test2.mp3", { loop: false });
			expect(box.metadata.currentSound).to.not.exist;
		});

		it("should play and stop a spatial sound", async () => {
			const box = flock.scene.getMeshByName(boxId);
			expect(box).to.exist;

			// Play a short sound and wait for it to end
			await flock.playSound(boxId, "test.mp3", { loop: false });

			// After await, the sound has ended and metadata should be cleared
			expect(box.metadata?.currentSound).to.not.exist;

			// Just in case any global tracking is left
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

			const result = flock.playSound("__everywhere__", "test.mp3", {
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

			await flock.playSound(boxId, "test.mp3", { loop: true });

			// Wait up to 500ms for sound to attach
			let attempts = 0;
			while (!box.metadata.currentSound && attempts < 10) {
				await new Promise((r) => setTimeout(r, 50));
				attempts++;
			}

			const initialSound = box.metadata.currentSound;
			expect(initialSound).to.exist;

			// Wait past the duration of the sound to check if it's still playing (looped)
			await new Promise((resolve) => setTimeout(resolve, 2500));

			// If the sound had not looped, it would have been removed
			expect(box.metadata.currentSound).to.equal(initialSound);

			// Stop and confirm it's gone
			flock.stopAllSounds();
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(box.metadata.currentSound).to.not.exist;
		});

		it("should loop a sound at least once", async function () {
			this.timeout(10000);

			const boxId = "soundBox";
			flock.createBox(boxId, "#FF0000", 1, 1, 1, [0, 0, 0]);

			await flock.playSound(boxId, "test.mp3", { loop: true });

			let attempts = 0;
			while (
				!flock.scene.getMeshByName(boxId)?.metadata?.currentSound &&
				attempts < 10
			) {
				await new Promise((r) => setTimeout(r, 50));
				attempts++;
			}

			const sound =
				flock.scene.getMeshByName(boxId)?.metadata?.currentSound;
			expect(sound).to.exist;

			await new Promise((resolve) => setTimeout(resolve, 2500));

			expect(sound.currentTime).to.be.a("number");
			expect(sound.currentTime).to.be.greaterThan(2); // Confirm looping occurred

			flock.stopAllSounds();
			flock.dispose(boxId);
		});

		it("should wait for sound to finish if using await", async function () {
			this.timeout(5000);

			const start = performance.now();
			await flock.playSound("__everywhere__", "test.mp3", {
				loop: false,
				volume: 1,
			});
			const elapsed = performance.now() - start;

			// Should take around the duration of the sound (>=1s)
			expect(elapsed).to.be.greaterThan(1000);
		});

		it("should return a Promise immediately if not using await", async function () {
			this.timeout(5000);

			const start = performance.now();

			// Trigger sound playback but don't await yet
			const promise = flock.playSound("__everywhere__", "test.mp3", {
				loop: false,
				volume: 1,
			});

			const elapsed = performance.now() - start;

			// The function call itself should be fast — not blocked by sound ending
			expect(elapsed).to.be.lessThan(50);

			// Confirm the returned value is a Promise
			expect(promise).to.have.property("then");

			// Await it to ensure it resolves after sound finishes
			await promise;
		});
	});
}
