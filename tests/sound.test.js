import { expect } from "chai";

export function runSoundTests(flock) {
	describe("Sound playback @sound @slow", function () {
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

			const boxId = "soundBox";
			flock.createBox(boxId, "#FF0000", 1, 1, 1, [0, 0, 0]);

			await flock.playSound(boxId, { soundName: "test.mp3", loop: true });

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
			expect(sound.currentTime).to.be.greaterThan(2);

			flock.stopAllSounds();
			flock.dispose(boxId);
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
			// Create a box to attach spatial sound to
			boxId = "soundBox";
			flock.createBox(boxId, "#FF0000", 1, 1, 1, [0, 0, 0]);
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
			const expectedDuration = durations.reduce((a, b) => a + b, 0) * secondsPerBeat;

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
						await new Promise(r => setTimeout(r, 100));
						const hasError = capturedErrors.some(msg => /linearRampToValueAtTime|non-finite/i.test(msg));
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
}
