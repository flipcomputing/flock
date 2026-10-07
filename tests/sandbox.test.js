import { expect } from 'chai';

export function runSandboxTests(flock) {
  describe('Sandbox boundary @sandbox', function () {
    this.timeout(20000);
    let printed;
    let originalPrintText;

    const run = (code) => flock.runCode(code, { focusCanvas: false });

    before(async function () {
      await flock.disposeOldScene();
    });

    beforeEach(function () {
      printed = [];
      originalPrintText = flock.printText;
      flock.printText = ({ text }) => printed.push(text);
    });

    afterEach(function () {
      flock.printText = originalPrintText;
    });

    it('should return API arrays as sandbox arrays', async function () {
      await run(`
        const list = getObjectsWithTag('missing');
        printText({ text: Array.isArray(list) && list instanceof Array });
      `);
      expect(printed).to.deep.equal([true]);
    });

    it('should not reach the host Function through a returned array', async function () {
      await run(`
        const k = 'con' + 'structor';
        let result;
        try {
          result = getObjectsWithTag('missing')[k][k]('return typeof document')();
        } catch (e) {
          result = 'blocked';
        }
        printText({ text: result });
      `);
      expect(printed).to.deep.equal(['blocked']);
    });

    it('should let a tag list be looped over and used as a list', async function () {
      await run(`
        const a = await createBox('sandboxBoxA', { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        const b = await createBox('sandboxBoxB', { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
        const tag = createTag('sandboxTag');
        await tagObject([a, b], tag);
        const list = getObjectsWithTag(tag);
        const seen = [];
        for (var i in list) {
          seen.push(list[i]);
        }
        list.push('extra');
        printText({ text: seen.length + '|' + (list.indexOf(b) >= 0) + '|' + list.length });
      `);
      expect(printed).to.deep.equal(['2|true|3']);
    });
  });
}
