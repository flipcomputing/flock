import { expect } from 'chai';

export function runMathTests(flock) {
  describe('Math API @math', function () {
    describe('createVector3', function () {
      it('should return a Vector3 with the given x, y, z values', function () {
        const v = flock.createVector3(1, 2, 3);
        expect(v.x).to.equal(1);
        expect(v.y).to.equal(2);
        expect(v.z).to.equal(3);
      });

      it('should return a Vector3 with negative values', function () {
        const v = flock.createVector3(-5, 0, 10.5);
        expect(v.x).to.equal(-5);
        expect(v.y).to.equal(0);
        expect(v.z).to.equal(10.5);
      });

      it('should return a frozen vector with no prototype chain to escape through', function () {
        const v = flock.createVector3(1, 2, 3);
        expect(Object.getPrototypeOf(v)).to.equal(null);
        expect(v['con' + 'structor']).to.equal(undefined);
        expect(Object.isFrozen(v)).to.equal(true);
      });
    });

    describe('randomInteger', function () {
      it('should return an integer within the given range [a, b]', function () {
        for (let i = 0; i < 20; i++) {
          const result = flock.randomInteger(3, 7);
          expect(result).to.be.at.least(3);
          expect(result).to.be.at.most(7);
          expect(Number.isInteger(result)).to.be.true;
        }
      });

      it('should auto-swap when a > b and still return a value in the correct range', function () {
        for (let i = 0; i < 20; i++) {
          const result = flock.randomInteger(10, 5);
          expect(result).to.be.at.least(5);
          expect(result).to.be.at.most(10);
        }
      });

      it('should return the only possible value when a === b', function () {
        expect(flock.randomInteger(4, 4)).to.equal(4);
      });
    });

    describe('seededRandom', function () {
      it('should return the same value for the same seed', function () {
        const a = flock.seededRandom(1, 10, 42);
        const b = flock.seededRandom(1, 10, 42);
        expect(a).to.equal(b);
      });

      it('should return different values for different seeds', function () {
        const results = new Set();
        for (let seed = 1; seed <= 20; seed++) {
          results.add(flock.seededRandom(1, 100, seed));
        }
        expect(results.size).to.be.greaterThan(1);
      });

      it('should return a value within the given range [from, to]', function () {
        for (let seed = 1; seed <= 50; seed++) {
          const result = flock.seededRandom(5, 15, seed);
          expect(result).to.be.at.least(5);
          expect(result).to.be.at.most(15);
        }
      });
    });

    describe('toNumber', function () {
      it('should convert text to an integer or decimal', function () {
        expect(flock.toNumber('42', 'INT')).to.equal(42);
        expect(flock.toNumber('3.7', 'INT')).to.equal(3);
        expect(flock.toNumber('3.7', 'FLOAT')).to.equal(3.7);
      });

      it('should give blank for empty input', function () {
        expect(flock.toNumber('', 'INT')).to.equal('');
        expect(flock.toNumber('   ', 'FLOAT')).to.equal('');
        expect(flock.toNumber(null, 'FLOAT')).to.equal('');
        expect(flock.toNumber(undefined, 'INT')).to.equal('');
      });

      it('should give blank for text that is not a number', function () {
        expect(flock.toNumber('abc', 'INT')).to.equal('');
        expect(flock.toNumber('12px', 'FLOAT')).to.equal('');
      });

      it('should ignore commas and spaces like table number cells', function () {
        expect(flock.toNumber('1,234', 'INT')).to.equal(1234);
        expect(flock.toNumber('1,234.5', 'FLOAT')).to.equal(1234.5);
        expect(flock.toNumber(' 1 000 ', 'INT')).to.equal(1000);
      });

      it('should convert whole numbers to binary and uppercase hexadecimal text', function () {
        expect(flock.toNumber(10, 'BINARY')).to.equal('1010');
        expect(flock.toNumber('255', 'HEX')).to.equal('FF');
        expect(flock.toNumber(-5, 'BINARY')).to.equal('-101');
        expect(flock.toNumber(2.5, 'BINARY')).to.equal('');
        expect(flock.toNumber('abc', 'HEX')).to.equal('');
      });

      it('should read prefixed binary and hexadecimal text', function () {
        expect(flock.toNumber('0b1010', 'INT')).to.equal(10);
        expect(flock.toNumber('0xFF', 'INT')).to.equal(255);
      });

      it('should convert true and false to 1 and 0', function () {
        expect(flock.toNumber(true, 'INT')).to.equal(1);
        expect(flock.toNumber(false, 'FLOAT')).to.equal(0);
        expect(flock.toNumber(true, 'BINARY')).to.equal('1');
        expect(flock.toNumber(false, 'HEX')).to.equal('0');
      });

      it('should convert only true/false text and numbers to true or false', function () {
        expect(flock.toNumber('true', 'BOOLEAN')).to.equal(true);
        expect(flock.toNumber(' FALSE ', 'BOOLEAN')).to.equal(false);
        expect(flock.toNumber(0, 'BOOLEAN')).to.equal(false);
        expect(flock.toNumber('2', 'BOOLEAN')).to.equal(true);
        expect(flock.toNumber(false, 'BOOLEAN')).to.equal(false);
        expect(flock.toNumber('yes', 'BOOLEAN')).to.equal('');
        expect(flock.toNumber('', 'BOOLEAN')).to.equal('');
      });

      it('should convert to table column types the way table cells do', function () {
        expect(flock.toNumber('$12.499', 'MONEY')).to.equal(12.5);
        expect(flock.toNumber('2026-1-5', 'DATE')).to.equal('2026-01-05');
        expect(flock.toNumber('2026-02-30', 'DATE')).to.equal('');
        expect(flock.toNumber('2:30 pm', 'TIME')).to.equal('14:30');
        expect(flock.toNumber('2026-11-28 9:05', 'DATETIME')).to.equal('2026-11-28 09:05');
        expect(flock.toNumber('red', 'COLOUR')).to.equal('red');
        expect(flock.toNumber('#FF0000', 'COLOUR')).to.equal('#ff0000');
        expect(flock.toNumber('not a colour', 'COLOUR')).to.equal('');
      });

      it('should accept numbers and convert to text', function () {
        expect(flock.toNumber(3.7, 'INT')).to.equal(3);
        expect(flock.toNumber(-3.7, 'INT')).to.equal(-3);
        expect(flock.toNumber(12, 'TEXT')).to.equal('12');
        expect(flock.toNumber('', 'TEXT')).to.equal('');
        expect(flock.toNumber(flock.createVector3(1, 2, 3), 'TEXT')).to.equal('(1, 2, 3)');
        expect(flock.toNumber(flock.createVector3(1, 2, 3), 'INT')).to.equal('');
        expect(flock.toNumber([1, flock.createVector3(1, 2, 3)], 'TEXT')).to.equal('1,(1, 2, 3)');
        expect(flock.toNumber(Object.create(null), 'TEXT')).to.equal('');
      });
    });

    describe('convertUsing', function () {
      const pairs = [
        ['fast', 'green'],
        ['OK', 'yellow'],
      ];

      it('gives the right side of the first matching pair', function () {
        expect(flock.convertUsing('fast', pairs, 'orange')).to.equal('green');
        expect(flock.convertUsing('OK', pairs, 'orange')).to.equal('yellow');
      });

      it('gives the otherwise value when nothing matches', function () {
        expect(flock.convertUsing('slow', pairs, 'orange')).to.equal('orange');
        expect(flock.convertUsing('', pairs, 'orange')).to.equal('orange');
        expect(flock.convertUsing('fast', [], 'orange')).to.equal('orange');
      });

      it('matches text ignoring capitals and spaces, and numbers by value', function () {
        expect(flock.convertUsing(' FAST ', pairs, 'orange')).to.equal('green');
        expect(flock.convertUsing(5, [['5.0', 'five']], 'none')).to.equal('five');
        expect(flock.convertUsing('1,000', [[1000, 'thousand']], 'none')).to.equal('thousand');
        expect(flock.convertUsing(true, [['true', 'yes']], 'no')).to.equal('yes');
      });

      it('gives the first pair the value is less than with <', function () {
        const bands = [
          [0.3, 'fast'],
          [0.45, 'OK'],
        ];
        expect(flock.convertUsing(0.29, bands, 'slow', 'LT')).to.equal('fast');
        expect(flock.convertUsing(0.3, bands, 'slow', 'LT')).to.equal('OK');
        expect(flock.convertUsing('0.44', bands, 'slow', 'LT')).to.equal('OK');
        expect(flock.convertUsing(0.45, bands, 'slow', 'LT')).to.equal('slow');
        expect(flock.convertUsing(0.3, bands, 'slow', 'LTE')).to.equal('fast');
      });

      it('counts down from the top with > and >=', function () {
        const grades = [
          [90, 'A'],
          [80, 'B'],
        ];
        expect(flock.convertUsing(95, grades, 'C', 'GT')).to.equal('A');
        expect(flock.convertUsing(90, grades, 'C', 'GT')).to.equal('B');
        expect(flock.convertUsing(90, grades, 'C', 'GTE')).to.equal('A');
        expect(flock.convertUsing(70, grades, 'C', 'GTE')).to.equal('C');
      });

      it('gives the first pair that does not match with not equal', function () {
        expect(
          flock.convertUsing(
            'cat',
            [
              ['cat', 'same'],
              ['dog', 'other'],
            ],
            'none',
            'NEQ'
          )
        ).to.equal('other');
      });

      it('orders text alphabetically and never compares text with numbers', function () {
        expect(flock.convertUsing('apple', [['m', 'first half']], 'second half', 'LT')).to.equal(
          'first half'
        );
        expect(flock.convertUsing('fast', [[0.3, 'fast']], 'none', 'LT')).to.equal('none');
        expect(flock.convertUsing('', [[0.3, 'fast']], 'none', 'LT')).to.equal('none');
        expect(flock.convertUsing(true, [[2, 'small']], 'none', 'LT')).to.equal('none');
      });
    });

    describe('convertRange', function () {
      it('should spread numbers evenly from one range to another', function () {
        expect(flock.convertRange(50, 0, 100, 0, 10)).to.equal(5);
        expect(flock.convertRange(100, 0, 100, 32, 212)).to.equal(212);
        expect(flock.convertRange(0, 0, 100, 32, 212)).to.equal(32);
      });

      it('should not clamp numbers outside the first range', function () {
        expect(flock.convertRange(150, 0, 100, 0, 10)).to.equal(15);
        expect(flock.convertRange(-50, 0, 100, 0, 10)).to.equal(-5);
      });

      it('should handle reversed ranges', function () {
        expect(flock.convertRange(25, 0, 100, 100, 0)).to.equal(75);
        expect(flock.convertRange(75, 100, 0, 0, 10)).to.equal(2.5);
      });

      it('should give the second low when the first range has no width', function () {
        expect(flock.convertRange(7, 5, 5, 1, 9)).to.equal(1);
      });

      it('should accept number text such as table cells', function () {
        expect(flock.convertRange('50', '0', '100', '0', '10')).to.equal(5);
      });
    });
  });
}
