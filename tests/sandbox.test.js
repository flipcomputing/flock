import { expect } from 'chai';
import { translate } from '../main/translation.js';

export function runSandboxTests(flock) {
  describe('Sandbox boundary @sandbox', function () {
    this.timeout(20000);
    let printed;
    let originalPrintText;
    let originalPrepare;

    const run = (code) => flock.runCode(code, { focusCanvas: false });

    before(async function () {
      await flock.disposeOldScene();
    });

    // Hand-written code tests the boundary on its own, as if the code check had been bypassed.
    beforeEach(function () {
      printed = [];
      originalPrintText = flock.printText;
      flock.printText = ({ text }) => printed.push(text);
      originalPrepare = flock.prepareUserCode;
      flock.prepareUserCode = (code) => code;
    });

    afterEach(function () {
      flock.printText = originalPrintText;
      flock.prepareUserCode = originalPrepare;
    });

    describe('with the code check', function () {
      beforeEach(function () {
        flock.prepareUserCode = originalPrepare;
      });

      const refused = [
        ['a property outside the list', 'let x; x.constructor;'],
        ['a global outside the list', 'Object;'],
        ['a name only declared in another function', 'function f() { let fetch; } fetch;'],
        ['this', 'this;'],
        ['the index guard', '__flockIndex(1);'],
        ['an assignment to the index guard', '__flockIndex = 1;'],
        ['a getter', 'const o = { get a() { return 1; } };'],
        ['a __proto__ key', 'const o = { __proto__: null };'],
        ['a quoted __proto__ key', "const o = { '__proto__': null };"],
        ['a computed object key', "const o = { ['a']: 1 };"],
        ['a template literal', 'const s = `a`;'],
        ['a class', 'class A {}'],
        ['destructuring', 'const [a] = [1];'],
        ['a rest parameter', 'function f(...a) {}'],
        ['dynamic import', "import('x');"],
      ];

      for (const [label, code] of refused) {
        it(`should refuse ${label}`, function () {
          expect(() => flock.prepareUserCode(code)).to.throw(/^Flock sandbox: /);
        });
      }

      it('should route every computed key through the index guard', function () {
        expect(flock.prepareUserCode('let list, i, j;\nlist[i - 1] = list[j[0]];')).to.equal(
          'let list, i, j;\nlist[__flockIndex((i - 1))] = list[__flockIndex((j[__flockIndex((0))]))];'
        );
      });

      it('should allow a local that shares a global name', async function () {
        await run(`
          let name = 'local';
          function show(fetch) {
            printText({ text: name + '|' + fetch });
          }
          show(1);
        `);
        expect(printed).to.deep.equal(['local|1']);
      });

      it('should index lists with numbers and loop keys', async function () {
        await run(`
          const list = ['a', 'b'];
          let seen = '';
          for (var i in list) {
            seen = seen + list[i];
          }
          list[list.length] = 'c';
          printText({ text: seen + '|' + list[1] + '|' + list[list.length - 1] });
        `);
        expect(printed).to.deep.equal(['ab|b|c']);
      });

      it('should stop a computed key naming the constructor at run time', async function () {
        await run(`
          const k = 'con' + 'structor';
          let result;
          try {
            result = getObjectsWithTag('missing')[k];
          } catch (e) {
            result = 'blocked';
          }
          printText({ text: result });
        `);
        expect(printed).to.deep.equal(['blocked']);
      });

      it('should stop an object key that converts to the constructor', async function () {
        await run(`
          const key = { toString: function () { return 'constructor'; } };
          let result;
          try {
            result = [][key];
          } catch (e) {
            result = 'blocked';
          }
          printText({ text: result });
        `);
        expect(printed).to.deep.equal(['blocked']);
      });
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

    describe('when Flock setup fails', function () {
      const originalFetch = window.fetch;
      let originalTimeout;

      const runError = async (code) => {
        try {
          await run(code);
        } catch (error) {
          return error;
        }
        return null;
      };
      const banners = () => [...document.querySelectorAll('.flock-banner')];

      beforeEach(function () {
        originalTimeout = flock.userCodeTimeoutMs;
      });

      afterEach(function () {
        window.fetch = originalFetch;
        flock.userCodeTimeoutMs = originalTimeout;
        document.querySelectorAll('.flock-banner').forEach((banner) => banner.remove());
      });

      it('blames the connection when the sandbox script cannot load', async function () {
        window.fetch = (url, ...rest) =>
          `${url}`.includes('lockdown')
            ? Promise.reject(new TypeError('Failed to fetch'))
            : originalFetch(url, ...rest);
        const error = await runError('printText({ text: 1 });');
        expect(error?.flockReported).to.equal(true);
        expect(banners()).to.have.length(1);
        expect(banners()[0].textContent).to.contain(translate('error_chunk_load'));
      });

      it('reports a timeout as a setup failure, not a project crash', async function () {
        flock.userCodeTimeoutMs = 50;
        const error = await runError('await wait(1);');
        expect(error?.flockReported).to.equal(true);
        expect(banners()).to.have.length(1);
        expect(banners()[0].textContent).to.contain(translate('error_run_setup'));
      });

      it('shows no late timeout banner after a run that finished in time', async function () {
        flock.userCodeTimeoutMs = 50;
        await run('printText({ text: 1 });');
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(banners()).to.have.length(0);
      });

      it("leaves the project's own errors for the project-run banner", async function () {
        const error = await runError("throw new Error('mine');");
        expect(error?.message).to.equal('mine');
        expect(error?.flockReported).to.not.equal(true);
        expect(banners()).to.have.length(0);
      });
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

      const unreportableError = () => {
        const error = new Error('unreportable');
        Object.defineProperty(error, 'name', {
          get() {
            throw new Error('report failed');
          },
        });
        return error;
      };

      for (const [kind, call] of failingCalls) {
        it(`should give user code a sandbox stop signal when reporting a ${kind} failure throws`, async function () {
          flock.wait = async () => {
            throw unreportableError();
          };
          flock.meshExists = () => {
            throw unreportableError();
          };
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

    it('should return clone lists as sandbox arrays of names', async function () {
      await run(`
        const a = await createBox('sandboxCloneSrc', { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        const b = cloneMesh({ sourceMeshName: a, cloneId: 'sandboxCloneCopy' });
        await wait(0.1);
        const list = getClonesOf(a);
        const k = 'con' + 'structor';
        let escaped;
        try {
          escaped = list[k][k]('return typeof document')();
        } catch (e) {
          escaped = 'blocked';
        }
        printText({ text: (list instanceof Array) + '|' + list.join('+') + '|' + typeof list[0] + '|' + escaped });
        printText({ text: b });
      `);
      expect(printed).to.have.length(2);
      expect(printed[0]).to.equal(`true|${printed[1]}|string|blocked`);
    });

    describe('when user code passes objects with hooks to the API', function () {
      let originalGetProperty;
      let originalRunDo;
      let reported;
      const onRejection = (event) => {
        reported.push(event.reason);
        event.preventDefault();
      };
      const escapeCheck = `
        const k = 'con' + 'structor';
        let result = 'not called';
        const escape = (v) => {
          try {
            result = v[k][k]('return typeof document')() === 'object' ? 'escaped' : 'blocked';
          } catch {
            result = 'blocked';
          }
        };
      `;

      beforeEach(function () {
        reported = [];
        originalGetProperty = flock.getProperty;
        originalRunDo = flock.runDo;
        window.addEventListener('unhandledrejection', onRejection);
      });

      afterEach(function () {
        flock.getProperty = originalGetProperty;
        flock.runDo = originalRunDo;
        window.removeEventListener('unhandledrejection', onRejection);
      });

      const hookedValues = [
        [
          'a non-enumerable array method',
          (list) => list.map((x) => x),
          `const list = [1, 2];
           Object.defineProperty(list, 'map', { value: (fn) => escape(fn) });`,
        ],
        [
          'an inherited array method',
          (list) => list.map((x) => x),
          `const list = [1, 2];
           Object.setPrototypeOf(list, { map: (fn) => escape(fn), length: 2 });`,
        ],
        [
          'an inherited object method',
          (list) => list.forEach((x) => x),
          `const list = Object.create({ forEach: (fn) => escape(fn) });`,
        ],
        [
          'a setter',
          (list) => {
            list.mesh = flock.scene;
          },
          `const list = { set mesh(v) { escape(v); } };`,
        ],
        [
          'a deeply nested method',
          (list) => list.a.b.c.d.e(flock.scene),
          `const list = { a: { b: { c: { d: { e: (v) => escape(v) } } } } };`,
        ],
      ];

      for (const [label, host, setup] of hookedValues) {
        it(`should not hand host values to ${label}`, async function () {
          flock.getProperty = host;
          await run(`
            ${escapeCheck}
            ${setup}
            try {
              getProperty(list);
            } catch {}
            printText({ text: result });
          `);
          expect(printed[0]).to.not.equal('escaped');
        });
      }

      it('should not let the API hand host values back through a passed array', async function () {
        flock.getProperty = (list) => {
          list.push(flock.scene);
          return list;
        };
        await run(`
          ${escapeCheck}
          const list = ['a'];
          const back = getProperty(list);
          escape(list[1]);
          const first = result;
          escape(back[1]);
          printText({ text: first + '|' + result + '|' + list.length });
        `);
        expect(printed).to.deep.equal(['blocked|blocked|1']);
      });

      it('should not hand host resolvers to a thenable a callback returns', async function () {
        flock.runDo = async (callback) => {
          try {
            await callback();
          } catch {
            // the thenable cannot settle without the resolvers
          }
        };
        await run(`
          ${escapeCheck}
          await runDo(() => ({ then: (resolve) => { escape(resolve); resolve(); } }));
          printText({ text: result });
        `);
        expect(printed[0]).to.not.equal('escaped');
      });

      it('should not hand host resolvers to a promise with its own then', async function () {
        flock.runDo = (callback) => Promise.resolve(callback());
        await run(`
          ${escapeCheck}
          await runDo(() => {
            const p = Promise.resolve();
            Object.defineProperty(p, 'then', { value: (resolve) => { escape(resolve); resolve(); } });
            return p;
          });
          printText({ text: result });
        `);
        expect(printed[0]).to.not.equal('escaped');
      });

      it('should still accept plain data and resolve async callbacks', async function () {
        flock.getProperty = (options) =>
          `${options.list.join('+')}|${options.nested.deeper.value}|${Object.getPrototypeOf(options.vector)}`;
        flock.runDo = async (callback) => `${await callback()}`;
        await run(`
          const vector = createVector3(1, 2, 3);
          printText({
            text: getProperty({ list: [1, [2, 3]], nested: { deeper: { value: vector.y } }, vector }),
          });
          printText({ text: await runDo(async () => 'done') });
        `);
        expect(printed).to.deep.equal(['1+2,3|2|null', 'done']);
      });
    });

    describe('when a project promise rejects unhandled', function () {
      let previousOnBlockError;
      let reported;

      beforeEach(function () {
        reported = [];
        previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
      });

      afterEach(function () {
        flock.onBlockError = previousOnBlockError;
      });

      it('should report the thrown value as a plain error', async function () {
        await run(`
          (async () => {
            throw { name: 'Oops', get message() { return 'from a getter'; } };
          })();
          await wait(0.1);
        `);
        expect(reported.map(({ key, error }) => [key, error.name, error.message])).to.deep.equal([
          ['unhandled_rejection', 'Oops', 'from a getter'],
        ]);
      });

      it('should not report an abort', async function () {
        await run(`
          (async () => {
            const e = new Error('stopped');
            e.name = 'AbortError';
            throw e;
          })();
          await wait(0.1);
        `);
        expect(reported).to.deep.equal([]);
      });
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
