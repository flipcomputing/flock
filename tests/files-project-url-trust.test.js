import { expect } from 'chai';
import { isTrustedProjectUrl } from '../main/files.js';

export function runFilesProjectUrlTrustTests() {
  describe('main/files project URL trust list', function () {
    it('trusts the current origin', function () {
      const url = new URL('examples/starter.flock', window.location.href);
      expect(isTrustedProjectUrl(url)).to.equal(true);
    });

    it('trusts the flockxr-projects GitHub repo and its subpaths', function () {
      expect(
        isTrustedProjectUrl(new URL('https://github.com/flipcomputing/flockxr-projects'))
      ).to.equal(true);
      expect(
        isTrustedProjectUrl(
          new URL('https://github.com/flipcomputing/flockxr-projects/blob/main/demo.flock')
        )
      ).to.equal(true);
    });

    it('trusts app.flockxr.com and flockxr.com', function () {
      expect(isTrustedProjectUrl(new URL('https://app.flockxr.com/demo.flock'))).to.equal(true);
      expect(isTrustedProjectUrl(new URL('https://flockxr.com/demo.flock'))).to.equal(true);
    });

    it('rejects a sibling repo that only shares the name prefix', function () {
      expect(
        isTrustedProjectUrl(
          new URL('https://github.com/flipcomputing/flockxr-projects-evil/demo.flock')
        )
      ).to.equal(false);
    });

    it('rejects a lookalike host', function () {
      expect(isTrustedProjectUrl(new URL('https://flockxr.com.evil.com/demo.flock'))).to.equal(
        false
      );
    });

    it('rejects an untrusted third-party host', function () {
      expect(isTrustedProjectUrl(new URL('https://example.com/demo.flock'))).to.equal(false);
    });
  });
}
