import { expect } from 'chai';
import * as acorn from 'acorn';
import { compileFlockProject } from '../flockCompiler.js';
import { extractEmbeddedProjectJson } from '../main/files.js';

const FIXTURES = [
  'alien_planet',
  'collect_the_gems',
  'candy_dash',
  'flockenspiel',
  'beetle',
  'microbit_monkey',
];

async function loadProject(name) {
  const res = await fetch(`/examples/${name}.flock`);
  if (!res.ok) throw new Error(`fixture ${name}.flock: HTTP ${res.status}`);
  return res.json();
}

export function runFlockCompilerTests() {
  describe('flockCompiler @flockcompiler', function () {
    this.timeout(20000);

    it('compiles the same project deterministically', async function () {
      const json = await loadProject('alien_planet');
      const a = compileFlockProject(structuredClone(json));
      const b = compileFlockProject(structuredClone(json));
      expect(a).to.equal(b);
    });

    it('produces the Flock header and the expected API calls', async function () {
      const code = compileFlockProject(await loadProject('alien_planet'));
      expect(code).to.include('// Made with Flock XR');
      expect(code).to.include('createCharacter(');
      expect(code).to.include('forever(');
      expect(code).to.include('setSky(');
    });

    FIXTURES.forEach((name) => {
      it(`compiles ${name}.flock to parseable JavaScript`, async function () {
        const code = compileFlockProject(await loadProject(name));
        expect(code, 'non-empty output').to.have.length.greaterThan(20);
        expect(() =>
          acorn.parse(`(async () => {\n${code}\n})()`, { ecmaVersion: 'latest' })
        ).to.not.throw();
      });
    });

    it('rejects malformed project JSON rather than hanging', function () {
      expect(() => compileFlockProject({ blocks: { blocks: 'not-an-array' } })).to.throw();
    });

    describe('extractEmbeddedProjectJson (Open in Flock round-trip)', function () {
      it('pulls the project out of a standalone HTML page and compiles it', async function () {
        const project = await loadProject('alien_planet');
        const embedded = JSON.stringify(project).replace(/</g, '\\u003c');
        const html = `<!doctype html><html><body>
          <script id="flock" type="application/flock+json">\n${embedded}\n</script>
          <script type="module">import '/flock.js';</script>
        </body></html>`;

        const jsonText = extractEmbeddedProjectJson(html);
        expect(JSON.parse(jsonText)).to.deep.equal(project);
        expect(compileFlockProject(JSON.parse(jsonText))).to.include('// Made with Flock XR');
      });

      it('accepts the vnd.flock+json type and single quotes', function () {
        const html = `<script type='application/vnd.flock+json'>{"ok":1}</script>`;
        expect(JSON.parse(extractEmbeddedProjectJson(html))).to.deep.equal({ ok: 1 });
      });

      it('throws when no embedded project is present', function () {
        expect(() => extractEmbeddedProjectJson('<html><body>nothing</body></html>')).to.throw(
          /No embedded Flock project/
        );
      });
    });
  });
}
