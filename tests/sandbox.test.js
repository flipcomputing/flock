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

    it('should return API promises as sandbox promises', async function () {
      await run(`
        printText({ text: wait(0) instanceof Promise });
      `);
      expect(printed).to.deep.equal([true]);
    });

    it('should not reach the host Function through a returned promise', async function () {
      await run(`
        const k = 'con' + 'structor';
        let result;
        try {
          result = wait(0)[k][k]('return typeof document')();
        } catch (e) {
          result = 'blocked';
        }
        printText({ text: result });
      `);
      expect(printed).to.deep.equal(['blocked']);
    });

    it('should resolve awaited API arrays as sandbox arrays', async function () {
      const originalWait = flock.wait;
      flock.wait = async () => ['a', 'b'];
      try {
        await run(`
          const result = await wait(0);
          printText({ text: result instanceof Array && result.join('+') });
        `);
      } finally {
        flock.wait = originalWait;
      }
      expect(printed).to.deep.equal(['a+b']);
    });

    it('should resolve tagObject to nothing', async function () {
      await run(`
        const a = await createBox('sandboxBoxC', { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        const tag = createTag('sandboxAwaitTag');
        printText({ text: typeof (await tagObject([a], tag)) });
      `);
      expect(printed).to.deep.equal(['undefined']);
    });

    describe('when an API call fails', function () {
      let originalWait;
      let originalMeshExists;
      let reported;
      const onRejection = (event) => {
        reported.push(event.reason);
        event.preventDefault();
      };

      beforeEach(function () {
        reported = [];
        originalWait = flock.wait;
        originalMeshExists = flock.meshExists;
        flock.wait = async () => {
          throw new Error('async failure');
        };
        flock.meshExists = () => {
          throw new Error('sync failure');
        };
        window.addEventListener('unhandledrejection', onRejection);
      });

      afterEach(function () {
        flock.wait = originalWait;
        flock.meshExists = originalMeshExists;
        window.removeEventListener('unhandledrejection', onRejection);
      });

      const failingCalls = [
        ['async', 'await wait(1);', 'async failure'],
        ['sync', "meshExists('x');", 'sync failure'],
      ];

      it('should not report an aborted call to the host', async function () {
        flock.wait = () => Promise.reject(flock.makeAbortError());
        await run(`
          try {
            await wait(1);
          } catch {}
        `);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(reported).to.deep.equal([]);
      });

      for (const [kind, call, message] of failingCalls) {
        it(`should give user code a sandbox stop signal for a ${kind} failure`, async function () {
          await run(`
            const k = 'con' + 'structor';
            let result;
            try {
              ${call}
              result = 'no error';
            } catch (e) {
              let escaped;
              try {
                escaped = e[k][k]('return typeof document')();
              } catch {
                escaped = 'blocked';
              }
              result = (e instanceof Error) + '|' + e.name + '|' + escaped;
            }
            printText({ text: result });
          `);
          expect(printed).to.deep.equal(['true|AbortError|blocked']);
        });

        it(`should report a ${kind} failure to the host`, async function () {
          await run(`
            try {
              ${call}
            } catch {}
          `);
          await new Promise((resolve) => setTimeout(resolve, 0));
          expect(reported.map((error) => error?.message)).to.deep.equal([message]);
        });
      }
    });

    describe('when an API call returns a host object', function () {
      let originalGetProperty;

      beforeEach(function () {
        originalGetProperty = flock.getProperty;
      });

      afterEach(function () {
        flock.getProperty = originalGetProperty;
      });

      const hostValues = [
        ['an object', () => flock.scene],
        ['a function', () => flock.createBox],
        ['a promise of an object', () => Promise.resolve(flock.scene)],
        ['an array holding an object', () => ['a', flock.scene]],
      ];

      for (const [label, value] of hostValues) {
        it(`should drop ${label}`, async function () {
          flock.getProperty = value;
          await run(`
            const result = await getProperty();
            printText({ text: String(Array.isArray(result) ? result[1] : result) });
          `);
          expect(printed).to.deep.equal(['undefined']);
        });
      }
    });

    describe('when the API calls a user callback', function () {
      let originalRunDo;

      beforeEach(function () {
        originalRunDo = flock.runDo;
        flock.runDo = (callback, { nested }) =>
          Promise.all(
            [callback, ...nested].map((fn) =>
              fn(flock.scene, ['a', 'b'], 'name', flock.createVector3(1, 2, 3))
            )
          );
      });

      afterEach(function () {
        flock.runDo = originalRunDo;
      });

      it('should pass only safe arguments, including to nested callbacks', async function () {
        await run(`
          const describe = (scene, list, name, vector) =>
            [scene, list instanceof Array && list.join('+'), name, vector.x].join(',');
          await runDo(async (...args) => printText({ text: describe(...args) }), {
            nested: [async (...args) => printText({ text: describe(...args) })],
          });
        `);
        expect(printed).to.deep.equal([',a+b,name,1', ',a+b,name,1']);
      });
    });

    it('should not pass the scene to a start callback', async function () {
      await run(`
        await new Promise((resolve) =>
          start(async (...args) => {
            printText({ text: args.length });
            resolve();
          })
        );
      `);
      expect(printed).to.deep.equal([0]);
    });

    it('should pass only the data to an event handler', async function () {
      await run(`
        await new Promise((resolve) => {
          onEvent('sandboxPing', async (...args) => {
            printText({ text: args.length + '|' + (args[0] instanceof Array) + '|' + args[0].join('+') });
            resolve();
          });
          broadcastEvent('sandboxPing', ['x', 'y']);
        });
      `);
      expect(printed).to.deep.equal(['1|true|x+y']);
    });

    it('should keep a callback the same function across API calls', async function () {
      await run(`
        async function section() {}
        await loadSection(section);
        unloadSection(section);
      `);
      expect(flock._loadedSections.size).to.equal(0);
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
