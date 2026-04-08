import { expect } from "chai";

export function runMathTests(flock) {
  describe("Math API @math", function () {
    describe("createVector3", function () {
      it("should return a Vector3 with the given x, y, z values", function () {
        const v = flock.createVector3(1, 2, 3);
        expect(v.x).to.equal(1);
        expect(v.y).to.equal(2);
        expect(v.z).to.equal(3);
      });

      it("should return a Vector3 with negative values", function () {
        const v = flock.createVector3(-5, 0, 10.5);
        expect(v.x).to.equal(-5);
        expect(v.y).to.equal(0);
        expect(v.z).to.equal(10.5);
      });
    });

    describe("randomInteger", function () {
      it("should return an integer within the given range [a, b]", function () {
        for (let i = 0; i < 20; i++) {
          const result = flock.randomInteger(3, 7);
          expect(result).to.be.at.least(3);
          expect(result).to.be.at.most(7);
          expect(Number.isInteger(result)).to.be.true;
        }
      });

      it("should auto-swap when a > b and still return a value in the correct range", function () {
        for (let i = 0; i < 20; i++) {
          const result = flock.randomInteger(10, 5);
          expect(result).to.be.at.least(5);
          expect(result).to.be.at.most(10);
        }
      });

      it("should return the only possible value when a === b", function () {
        expect(flock.randomInteger(4, 4)).to.equal(4);
      });
    });

    describe("seededRandom", function () {
      it("should return the same value for the same seed", function () {
        const a = flock.seededRandom(1, 10, 42);
        const b = flock.seededRandom(1, 10, 42);
        expect(a).to.equal(b);
      });

      it("should return different values for different seeds", function () {
        const results = new Set();
        for (let seed = 1; seed <= 20; seed++) {
          results.add(flock.seededRandom(1, 100, seed));
        }
        expect(results.size).to.be.greaterThan(1);
      });

      it("should return a value within the given range [from, to]", function () {
        for (let seed = 1; seed <= 50; seed++) {
          const result = flock.seededRandom(5, 15, seed);
          expect(result).to.be.at.least(5);
          expect(result).to.be.at.most(15);
        }
      });
    });
  });
}
