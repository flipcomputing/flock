import { expect } from 'chai';
import { isDebugModeEnabled } from '../main/debugMode.js';

export function runDebugModeTests(_flock) {
  describe('main/debugMode @debugmode', function () {
    it('defaults to enabled on localhost with no debug param', function () {
      expect(isDebugModeEnabled({ hostname: 'localhost', search: '' })).to.be.true;
    });

    it('debug=0 disables even on localhost', function () {
      expect(isDebugModeEnabled({ hostname: 'localhost', search: '?debug=0' })).to.be.false;
    });

    it('defaults to disabled off localhost with no debug param', function () {
      expect(isDebugModeEnabled({ hostname: 'example.com', search: '' })).to.be.false;
    });

    it('debug=1 enables off localhost', function () {
      expect(isDebugModeEnabled({ hostname: 'example.com', search: '?debug=1' })).to.be.true;
    });

    it('a non-"1" debug value does not enable off localhost', function () {
      expect(isDebugModeEnabled({ hostname: 'example.com', search: '?debug=true' })).to.be.false;
    });
  });
}
