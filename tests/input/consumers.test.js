import { expect } from "chai";
import { InputManager } from "../../input/inputManager.js";
import { OnScreenSource } from "../../input/onScreenSource.js";
import {
  flockSensing,
  setFlockReference as setFlockSensing,
} from "../../api/sensing.js";
import {
  flockEvents,
  setFlockReference as setFlockEvents,
} from "../../api/events.js";

function makeFlock() {
  const inputManager = new InputManager();
  const flock = {
    inputManager,
    abortController: new AbortController(),
    ...flockSensing,
    ...flockEvents,
  };
  setFlockSensing(flock);
  setFlockEvents(flock);
  return flock;
}

export function runConsumerTests() {
  describe("Consumer APIs @consumers @input", function () {
    let flock, inputManager;

    beforeEach(function () {
      flock = makeFlock();
      inputManager = flock.inputManager;
    });

    describe("keyPressed", function () {
      it("keyPressed('w') reflects _setKey('w', true)", function () {
        inputManager._setKey("w", true);
        expect(flock.keyPressed("w")).to.be.true;
      });

      it("keyPressed('W') is true when lowercase 'w' is held (case-insensitive)", function () {
        inputManager._setKey("w", true);
        expect(flock.keyPressed("W")).to.be.true;
      });

      it("keyPressed('ANY') true with any held key", function () {
        inputManager._setKey("x", true);
        expect(flock.keyPressed("ANY")).to.be.true;
      });

      it("keyPressed('ANY') false when no keys held", function () {
        expect(flock.keyPressed("ANY")).to.be.false;
      });

      it("keyPressed('NONE') true when no keys held", function () {
        expect(flock.keyPressed("NONE")).to.be.true;
      });

      it("keyPressed('NONE') false when a key is held", function () {
        inputManager._setKey("w", true);
        expect(flock.keyPressed("NONE")).to.be.false;
      });
    });

    describe("actionPressed", function () {
      it("actionPressed('FORWARD') true when a default bound key is held", function () {
        inputManager._setKey("w", true);
        expect(flock.actionPressed("FORWARD")).to.be.true;
      });

      it("actionPressed('FORWARD') false when no bound key is held", function () {
        expect(flock.actionPressed("FORWARD")).to.be.false;
      });
    });

    describe("setActionKey", function () {
      it("setActionKey('FORWARD', 'x') → actionPressed('FORWARD') true when 'x' held", function () {
        flock.setActionKey("FORWARD", "x");
        inputManager._setKey("x", true);
        expect(flock.actionPressed("FORWARD")).to.be.true;
      });

      it("setActionKey('FORWARD', 'x') → default key 'w' no longer triggers FORWARD", function () {
        flock.setActionKey("FORWARD", "x");
        inputManager._setKey("w", true);
        expect(flock.actionPressed("FORWARD")).to.be.false;
      });

      it("setActionKey('FORWARD', 'x') → pressing old key 'w' does not fire whenActionEvent", function () {
        flock.setActionKey("FORWARD", "x");
        let count = 0;
        flock.whenActionEvent("FORWARD", () => count++);
        inputManager._setKey("w", true);
        expect(count).to.equal(0);
      });

      it("setActionKey('FORWARD', 'x') → pressing new key 'x' fires whenActionEvent", function () {
        flock.setActionKey("FORWARD", "x");
        let count = 0;
        flock.whenActionEvent("FORWARD", () => count++);
        inputManager._setKey("x", true);
        expect(count).to.equal(1);
      });
    });

    describe("whenKeyEvent", function () {
      it("fires when key pressed via inputManager (keyboard path)", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++);
        inputManager._setKey("w", true);
        expect(count).to.equal(1);
      });

      it("fires exactly once per press transition (refcounted, no double-fire)", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++);
        inputManager._setKey("w", true);
        inputManager._setKey("w", true);
        expect(count).to.equal(1);
      });

      it("fires when key pressed via OnScreenSource", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++);
        const source = new OnScreenSource(inputManager);
        source.press("w");
        expect(count).to.equal(1);
      });

      it("on-screen press fires exactly once (no double-fire from removed grid path)", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++);
        const source = new OnScreenSource(inputManager);
        source.press("w");
        source.release("w");
        source.press("w");
        expect(count).to.equal(2);
      });

      it("callback does not fire after abort", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++);
        flock.abortController.abort();
        inputManager._setKey("w", true);
        expect(count).to.equal(0);
      });

      it("isReleased=true fires on key up", function () {
        let count = 0;
        flock.whenKeyEvent("w", () => count++, true);
        inputManager._setKey("w", true);
        expect(count).to.equal(0);
        inputManager._setKey("w", false);
        expect(count).to.equal(1);
      });
    });

    describe("whenActionEvent", function () {
      it("fires once per transition regardless of which bound key is pressed", function () {
        let count = 0;
        flock.whenActionEvent("FORWARD", () => count++);
        inputManager._setKey("w", true);
        expect(count).to.equal(1);
      });

      it("fires exactly once when multiple bound keys pressed (already active guard)", function () {
        let count = 0;
        flock.whenActionEvent("FORWARD", () => count++);
        inputManager._setKey("w", true);
        inputManager._setKey("z", true);
        expect(count).to.equal(1);
      });

      it("callback does not fire after abort", function () {
        let count = 0;
        flock.whenActionEvent("FORWARD", () => count++);
        flock.abortController.abort();
        inputManager._setKey("w", true);
        expect(count).to.equal(0);
      });
    });
  });
}
