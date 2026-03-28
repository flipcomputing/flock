import { expect } from "chai";

export function runSensingTests(flock) {
  describe("Sensing API @sensing", function () {
    describe("keyPressed", function () {
      afterEach(function () {
        flock.canvas.pressedKeys.clear();
      });

      it("should return false for a specific key when nothing is pressed", function () {
        flock.canvas.pressedKeys.clear();
        expect(flock.keyPressed("W")).to.be.false;
      });

      it("should return true for NONE when no keys are pressed", function () {
        flock.canvas.pressedKeys.clear();
        expect(flock.keyPressed("NONE")).to.be.true;
      });

      it("should return false for NONE when a key is pressed", function () {
        flock.canvas.pressedKeys.add("w");
        expect(flock.keyPressed("NONE")).to.be.false;
      });

      it("should return true for a key that is in pressedKeys", function () {
        flock.canvas.pressedKeys.add("w");
        expect(flock.keyPressed("W")).to.be.true;
      });
    });

    describe("setActionKey and actionPressed", function () {
      afterEach(function () {
        flock.canvas.pressedKeys.clear();
        if (flock._actionMapOverrides) {
          delete flock._actionMapOverrides["FORWARD"];
        }
      });

      it("actionPressed should return false for an action when no key is pressed", function () {
        flock.canvas.pressedKeys.clear();
        expect(flock.actionPressed("FORWARD")).to.be.false;
      });

      it("setActionKey should remap an action to a new key", function () {
        flock.setActionKey("FORWARD", "X");
        flock.canvas.pressedKeys.add("x");
        expect(flock.actionPressed("FORWARD")).to.be.true;
      });

      it("after remapping, the old default key should no longer trigger the action", function () {
        flock.setActionKey("FORWARD", "X");
        flock.canvas.pressedKeys.add("w");
        expect(flock.actionPressed("FORWARD")).to.be.false;
      });
    });

    describe("getTime", function () {
      it("should return a positive number of milliseconds", function () {
        const t = flock.getTime("milliseconds");
        expect(t).to.be.a("number");
        expect(t).to.be.greaterThan(0);
      });

      it("should return a positive number of seconds", function () {
        const t = flock.getTime("seconds");
        expect(t).to.be.a("number");
        expect(t).to.be.greaterThan(0);
      });

      it("should return a positive number of minutes", function () {
        const t = flock.getTime("minutes");
        expect(t).to.be.a("number");
        expect(t).to.be.greaterThan(0);
      });

      it("milliseconds should be larger than seconds", function () {
        const ms = flock.getTime("milliseconds");
        const s = flock.getTime("seconds");
        expect(ms).to.be.greaterThan(s);
      });
    });
  });
}
