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
