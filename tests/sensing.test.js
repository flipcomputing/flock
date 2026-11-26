import { expect } from 'chai';

export function runSensingTests(flock) {
  describe('Sensing API @sensing', function () {
    describe('keyPressed', function () {
      afterEach(function () {
        flock.inputManager._clearAllKeys();
      });

      it('should return false for a specific key when nothing is pressed', function () {
        flock.inputManager._clearAllKeys();
        expect(flock.keyPressed('W')).to.be.false;
      });

      it('should return true for NONE when no keys are pressed', function () {
        flock.inputManager._clearAllKeys();
        expect(flock.keyPressed('NONE')).to.be.true;
      });

      it('should return false for NONE when a key is pressed', function () {
        flock.inputManager._setKey('w', true);
        expect(flock.keyPressed('NONE')).to.be.false;
      });

      it('should return true for a key that is pressed', function () {
        flock.inputManager._setKey('w', true);
        expect(flock.keyPressed('W')).to.be.true;
      });
    });

    describe('setActionKey and actionPressed', function () {
      afterEach(function () {
        flock.inputManager._clearAllKeys();
        flock.inputManager.resetActionKeys();
      });

      it('actionPressed should return false for an action when no key is pressed', function () {
        flock.inputManager._clearAllKeys();
        expect(flock.actionPressed('FORWARD')).to.be.false;
      });

      it('setActionKey should remap an action to a new key', function () {
        flock.setActionKey('FORWARD', 'x');
        flock.inputManager._setKey('x', true);
        expect(flock.actionPressed('FORWARD')).to.be.true;
      });

      it('after remapping, the old default key should no longer trigger the action', function () {
        flock.setActionKey('FORWARD', 'x');
        flock.inputManager._setKey('w', true);
        expect(flock.actionPressed('FORWARD')).to.be.false;
      });
    });

    describe('currentDateTime and datePart', function () {
      let RealDate, errors, realReport;

      beforeEach(function () {
        RealDate = globalThis.Date;
        errors = [];
        realReport = flock.reportBlockError;
        flock.reportBlockError = (details) => errors.push(details);
      });

      afterEach(function () {
        globalThis.Date = RealDate;
        flock.reportBlockError = realReport;
      });

      it('gives the local date and time with seconds', function () {
        const fixed = new RealDate(2026, 0, 5, 7, 3, 9);
        globalThis.Date = class extends RealDate {
          constructor(...args) {
            super(...(args.length ? args : [fixed.getTime()]));
          }
        };
        expect(flock.currentDateTime()).to.equal('2026-01-05 07:03:09');
      });

      it('reads each part of a date and time', function () {
        const value = '2026-11-22 14:30:05';
        const parts = ['year', 'month', 'day', 'day_of_week', 'hour', 'minute', 'second'];
        expect(parts.map((part) => flock.datePart(part, value))).to.deep.equal([
          2026, 11, 22, 7, 14, 30, 5,
        ]);
      });

      it('numbers days of the week from Monday as 1', function () {
        expect(flock.datePart('day_of_week', '2026-11-23')).to.equal(1);
        expect(flock.datePart('day_of_week', '2026-11-28')).to.equal(6);
      });

      it('reads dates, times and table-style values', function () {
        expect(flock.datePart('month', '2026-02-01')).to.equal(2);
        expect(flock.datePart('hour', '2026-02-01')).to.equal(0);
        expect(flock.datePart('minute', '09:45')).to.equal(45);
        expect(flock.datePart('second', '2026-11-22T14:30')).to.equal(0);
        expect(flock.datePart('hour', flock.currentDateTime())).to.equal(new RealDate().getHours());
        expect(errors).to.be.empty;
      });

      it('reports values that are not dates or times and returns 0', function () {
        expect(flock.datePart('year', 'banana')).to.equal(0);
        expect(flock.datePart('hour', 42)).to.equal(0);
        expect(flock.datePart('day', '2026-02-30')).to.equal(0);
        expect(errors.map((e) => e.key)).to.deep.equal([
          'date_part_not_date',
          'date_part_not_date',
          'date_part_not_date',
        ]);
      });

      it('reports asking a time for a date part', function () {
        expect(flock.datePart('year', '14:30')).to.equal(0);
        expect(errors.map((e) => e.key)).to.deep.equal(['date_part_no_date']);
      });
    });

    describe('getTime', function () {
      it('should return a positive number of milliseconds', function () {
        const t = flock.getTime('milliseconds');
        expect(t).to.be.a('number');
        expect(t).to.be.greaterThan(0);
      });

      it('should return a positive number of seconds', function () {
        const t = flock.getTime('seconds');
        expect(t).to.be.a('number');
        expect(t).to.be.greaterThan(0);
      });

      it('should return a positive number of minutes', function () {
        const t = flock.getTime('minutes');
        expect(t).to.be.a('number');
        expect(t).to.be.greaterThan(0);
      });

      it('milliseconds should be larger than seconds', function () {
        const ms = flock.getTime('milliseconds');
        const s = flock.getTime('seconds');
        expect(ms).to.be.greaterThan(s);
      });

      describe('hidden-tab pausing', function () {
        let savedAccum, savedHiddenAt;

        beforeEach(function () {
          savedAccum = flock._frozenAccumMs;
          savedHiddenAt = flock._frozenAt;
        });

        afterEach(function () {
          flock._frozenAccumMs = savedAccum;
          flock._frozenAt = savedHiddenAt;
        });

        it('should not advance while the tab is hidden', async function () {
          flock._frozenAccumMs = 0;
          flock._frozenAt = Date.now();
          const before = flock.getTime('milliseconds');
          await new Promise((resolve) => setTimeout(resolve, 30));
          expect(flock.getTime('milliseconds')).to.equal(before);
        });

        it('should not advance while the project is paused', async function () {
          try {
            flock.setPaused(true);
            const before = flock.getTime('milliseconds');
            await new Promise((resolve) => setTimeout(resolve, 200));
            expect(flock.getTime('milliseconds')).to.equal(before);
            flock.setPaused(false);
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(flock.getTime('milliseconds') - before).to.be.lessThan(150);
          } finally {
            flock.setPaused(false);
          }
        });

        it('should exclude accumulated hidden time', function () {
          const realNow = Date.now;
          Date.now = () => 1_000_000_000_000;
          try {
            flock._frozenAt = null;
            flock._frozenAccumMs = 0;
            const unpaused = flock.getTime('milliseconds');
            flock._frozenAccumMs = 5000;
            const paused = flock.getTime('milliseconds');
            expect(unpaused - paused).to.equal(5000);
          } finally {
            Date.now = realNow;
          }
        });
      });
    });
  });
}
