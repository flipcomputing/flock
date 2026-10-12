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

    it('trusts any flockxr.com subdomain', function () {
      expect(isTrustedProjectUrl(new URL('https://games.flockxr.com/x/demo.html'))).to.equal(true);
      expect(isTrustedProjectUrl(new URL('https://a.b.flockxr.com/demo.flock'))).to.equal(true);
    });

    it('rejects flockxr.com over http or on another port', function () {
      expect(isTrustedProjectUrl(new URL('http://flockxr.com/demo.flock'))).to.equal(false);
      expect(isTrustedProjectUrl(new URL('https://flockxr.com:8443/demo.flock'))).to.equal(false);
    });

    it('rejects hosts that only end with the same letters', function () {
      expect(isTrustedProjectUrl(new URL('https://evilflockxr.com/demo.flock'))).to.equal(false);
      expect(isTrustedProjectUrl(new URL('https://flockxr.com.evil.com/demo.flock'))).to.equal(
        false
      );
    });

    it('trusts raw files from the flockxr-projects repo', function () {
      expect(
        isTrustedProjectUrl(
          new URL(
            'https://raw.githubusercontent.com/flipcomputing/flockxr-projects/refs/heads/main/Fidget%20spinner.flock'
          )
        )
      ).to.equal(true);
    });

    it('rejects a sibling repo that only shares the name prefix', function () {
      expect(
        isTrustedProjectUrl(
          new URL('https://github.com/flipcomputing/flockxr-projects-evil/demo.flock')
        )
      ).to.equal(false);
      expect(
        isTrustedProjectUrl(
          new URL('https://raw.githubusercontent.com/flipcomputing/flockxr-projects-evil/x.flock')
        )
      ).to.equal(false);
    });

    it('rejects raw files from other repos', function () {
      expect(
        isTrustedProjectUrl(new URL('https://raw.githubusercontent.com/someone/projects/x.flock'))
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
