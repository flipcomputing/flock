import { expect } from 'chai';
import { renderAuthoredContent } from '../../ui/authoredContent.js';

const pages = import.meta.glob(['../../src/how-tos/*/*.html', '../../docs/help/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function runAuthoredContentTests() {
  describe('Authored content @security', function () {
    let warnings;
    let originalWarn;

    beforeEach(function () {
      warnings = [];
      originalWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(' '));
    });

    afterEach(function () {
      console.warn = originalWarn;
    });

    it('should render every how-to and help page without dropping anything', function () {
      expect(Object.keys(pages)).to.not.be.empty;
      for (const [path, html] of Object.entries(pages)) {
        renderAuthoredContent(document.createElement('div'), html, path);
      }
      expect(warnings).to.deep.equal([]);
    });

    it('should drop scripts, handlers, styles, unknown tags and non-web links', function () {
      const container = document.createElement('div');
      renderAuthoredContent(
        container,
        '<p onclick="bad()" style="color: red">text<script>bad()</script><img src="x" onerror="bad()">' +
          '<a href="javascript:bad()">one</a><a href="https://flockxr.com">two</a></p>'
      );
      const p = container.querySelector('p');
      expect(p.attributes.length).to.equal(0);
      expect(container.querySelector('script, img')).to.equal(null);
      const [unsafe, safe] = container.querySelectorAll('a');
      expect(unsafe.hasAttribute('href')).to.equal(false);
      expect(safe.getAttribute('href')).to.equal('https://flockxr.com');
      expect(p.textContent).to.equal('textonetwo');
    });

    it('should drop tags named after Object.prototype properties', function () {
      const container = document.createElement('div');
      renderAuthoredContent(container, '<p>a<constructor>b</constructor><constructor id="x">c</constructor>d</p>');
      expect(container.querySelector('constructor')).to.equal(null);
      expect(container.textContent).to.equal('ad');
    });
  });
}
