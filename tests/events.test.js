import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import { defineEventsBlocks } from '../blocks/events.js';
import { defineTextBlocks } from '../blocks/text.js';

export function runEventsTests(flock) {
  describe('Events API @events', function () {
    const meshIds = [];

    afterEach(function () {
      // Clear any custom events registered during tests
      flock.events?.clear();
      // Dispose any meshes created during tests
      meshIds.forEach((id) => {
        try {
          flock.dispose(id);
        } catch (e) {
          console.warn(`Dispose failed for ${id}:`, e);
        }
      });
      meshIds.length = 0;
    });

    // -------------------------------------------------------------------------
    describe('event names', function () {
      const fires = (listenName, broadcastName = listenName) => {
        let called = false;
        flock.onEvent(listenName, () => {
          called = true;
        });
        flock.broadcastEvent(broadcastName);
        flock.events.clear();
        return called;
      };

      it('accepts names that used to be reserved or rejected', function () {
        const names = [
          'one',
          'only',
          'onSomething',
          'systemEvent',
          'flockReady',
          'babylonTick',
          '_hidden',
          'hello!',
          'say@world',
          '1up',
          'game-over',
          'new',
          'class',
          '🎉 party time',
          'a'.repeat(60),
        ];
        for (const name of names) {
          expect(fires(name), name).to.be.true;
        }
      });

      it('accepts names that are also object property names', function () {
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
          expect(fires(name), name).to.be.true;
        }
      });

      it('keeps spaces, so "game over" and "game_over" are different events', function () {
        expect(fires('game over', 'game over')).to.be.true;
        expect(fires('game over', 'game_over')).to.be.false;
      });

      it('ignores spaces at either end', function () {
        expect(fires('jump', '  jump ')).to.be.true;
      });

      it('matches a number and the same text', function () {
        expect(fires(3, '3')).to.be.true;
      });

      it('does nothing for a missing name', function () {
        let called = false;
        expect(() => flock.onEvent(undefined, () => (called = true))).to.not.throw();
        expect(() => flock.broadcastEvent(undefined)).to.not.throw();
        expect(called).to.be.false;
        expect(flock.events.size).to.equal(0);
      });

      it('ignores a name that is neither text nor a number, without converting it', function () {
        let converted = false;
        const name = {
          toString() {
            converted = true;
            return 'jump';
          },
        };
        let called = false;
        flock.onEvent('jump', () => (called = true));
        expect(() => flock.onEvent(name, () => {})).to.not.throw();
        expect(() => flock.broadcastEvent(name)).to.not.throw();
        expect(converted).to.be.false;
        expect(called).to.be.false;
        expect(flock.events.size).to.equal(1);
      });
    });

    // -------------------------------------------------------------------------
    describe('event blocks', function () {
      this.timeout(20000);
      let workspace;
      let originalPrintText;
      let printed;

      before(async function () {
        await flock.disposeOldScene();
        if (!Blockly.Blocks['on_event']) defineEventsBlocks();
        if (!Blockly.Blocks['print_text']) defineTextBlocks();
        if (!javascriptGenerator.forBlock['on_event']) defineGenerators();
      });

      beforeEach(function () {
        workspace = new Blockly.Workspace();
        printed = [];
        originalPrintText = flock.printText;
        flock.printText = ({ text }) => printed.push(text);
      });

      afterEach(function () {
        flock.printText = originalPrintText;
        workspace.dispose();
      });

      const text = (value) => ({ block: { type: 'text', fields: { TEXT: value } } });
      const variable = (id) => ({ block: { type: 'variables_get', fields: { VAR: { id } } } });
      const append = (state) => Blockly.serialization.blocks.append(state, workspace);
      const listener = (name, message) =>
        append({
          type: 'on_event',
          inputs: {
            EVENT_NAME: name,
            DO: { block: { type: 'print_text', inputs: { TEXT: text(message) } } },
          },
        });
      const generate = () => {
        javascriptGenerator.init(workspace);
        return javascriptGenerator.workspaceToCode(workspace);
      };
      const runUntilPrinted = async () => {
        await flock.runCode(generate(), { focusCanvas: false });
        for (let i = 0; i < 40 && printed.length === 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };

      it('passes a typed name through exactly, as a string literal', function () {
        const block = append({ type: 'broadcast_event', inputs: { EVENT_NAME: text(' 1up! ') } });
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(block)).to.equal('broadcastEvent("1up!");\n');
      });

      it('cannot be used to inject code through a typed name', function () {
        const payload = '"); alert(1); ("';
        const block = append({ type: 'broadcast_event', inputs: { EVENT_NAME: text(payload) } });
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(block)).to.equal(
          `broadcastEvent(${JSON.stringify(payload)});\n`
        );
      });

      it('runs a listener when the event is broadcast with a name held in a variable', async function () {
        const id = workspace.createVariable('which').getId();
        listener(text('go team!'), 'heard');
        append({
          type: 'start',
          inputs: {
            DO: {
              block: {
                type: 'variables_set',
                fields: { VAR: { id } },
                inputs: { VALUE: text('go team!') },
                next: { block: { type: 'broadcast_event', inputs: { EVENT_NAME: variable(id) } } },
              },
            },
          },
        });
        await runUntilPrinted();
        expect(printed).to.deep.equal(['heard']);
      });

      it("listens for a variable's value when the project starts", async function () {
        // Hats register at start, before any set block runs, so the variable still holds
        // its default: its own name.
        const id = workspace.createVariable('signal').getId();
        listener(variable(id), 'heard');
        append({
          type: 'start',
          inputs: {
            DO: { block: { type: 'broadcast_event', inputs: { EVENT_NAME: text('signal') } } },
          },
        });
        await runUntilPrinted();
        expect(printed).to.deep.equal(['heard']);
      });

      describe('when clicked then sections', function () {
        const say = (message) => ({
          block: { type: 'print_text', inputs: { TEXT: text(message) } },
        });
        const clicked = () =>
          append({
            type: 'when_clicked',
            fields: { MODEL_VAR: { name: 'door' }, TRIGGER: 'OnPickTrigger' },
            inputs: { DO: say('open') },
          });
        const inputNames = (block) => block.inputList.map((input) => input.name);
        const printedIn = (block, name) =>
          block.getInputTargetBlock(name)?.getInputTargetBlock('TEXT')?.getFieldValue('TEXT');
        const flushEvents = () =>
          new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

        for (const removed of ['OnLeftPickTrigger', 'OnDoublePickTrigger']) {
          it(`loads the removed ${removed} as clicked`, function () {
            const block = append({
              type: 'when_clicked',
              fields: { MODEL_VAR: { name: 'door' }, TRIGGER: removed },
            });
            expect(block.getFieldValue('TRIGGER')).to.equal('OnPickTrigger');
          });
        }

        it('adds then sections above the button row', function () {
          const block = clicked();
          block.addThen();
          block.addThen();
          expect(inputNames(block).slice(1)).to.deep.equal([
            'DO',
            'THEN_ROW0',
            'THEN0',
            'THEN_ROW1',
            'THEN1',
            'BUTTONS',
          ]);
        });

        it('keeps then sections and their blocks when saved and loaded', function () {
          const block = clicked();
          block.addThen();
          block.getInput('THEN0').connection.connect(append(say('close').block).previousConnection);

          const state = Blockly.serialization.blocks.save(block);
          block.dispose();
          const loaded = append(state);

          expect(loaded.thenCount_).to.equal(1);
          expect(printedIn(loaded, 'THEN0')).to.equal('close');
        });

        it('moves later sections up when one is removed, and undo puts them back', async function () {
          const block = clicked();
          block.addThen();
          block.addThen();
          block.getInput('THEN0').connection.connect(append(say('close').block).previousConnection);
          block.getInput('THEN1').connection.connect(append(say('lock').block).previousConnection);
          await flushEvents();

          block.removeThen(0);
          await flushEvents();

          expect(block.thenCount_).to.equal(1);
          expect(printedIn(block, 'THEN0')).to.equal('lock');
          const loose = workspace.getTopBlocks().filter((b) => b.type === 'print_text');
          expect(loose.map((b) => b.getInputTargetBlock('TEXT').getFieldValue('TEXT'))).to.deep.equal([
            'close',
          ]);

          workspace.undo(false);
          await flushEvents();

          expect(block.thenCount_).to.equal(2);
          expect(printedIn(block, 'THEN0')).to.equal('close');
          expect(printedIn(block, 'THEN1')).to.equal('lock');
        });

        it('keeps an empty then section as a step that does nothing', function () {
          const block = clicked();
          block.addThen();
          javascriptGenerator.init(workspace);
          const code = javascriptGenerator.blockToCode(block);
          expect(code.match(/async function\(/g)).to.have.length(2);
        });
      });
    });

    // -------------------------------------------------------------------------
    describe('onEvent and broadcastEvent', function () {
      it('calls handler when matching event is broadcast', function () {
        let called = false;
        flock.onEvent('pickup', () => {
          called = true;
        });
        flock.broadcastEvent('pickup');
        expect(called).to.be.true;
      });

      it('does not call handler when a different event is broadcast', function () {
        let called = false;
        flock.onEvent('pickup', () => {
          called = true;
        });
        flock.broadcastEvent('drop');
        expect(called).to.be.false;
      });

      it('calls all handlers when multiple are registered for the same event', function () {
        // Simulates several meshes each independently listening to the same event
        let countA = 0;
        let countB = 0;
        let countC = 0;
        flock.onEvent('collect', () => countA++);
        flock.onEvent('collect', () => countB++);
        flock.onEvent('collect', () => countC++);
        flock.broadcastEvent('collect');
        expect(countA).to.equal(1);
        expect(countB).to.equal(1);
        expect(countC).to.equal(1);
      });

      it('calls handler with data passed to broadcastEvent', function () {
        let received = null;
        flock.onEvent('score', (data) => {
          received = data;
        });
        flock.broadcastEvent('score', 42);
        expect(received).to.equal(42);
      });

      it('fires handler exactly once when once=true', function () {
        let count = 0;
        flock.onEvent(
          'ping',
          () => {
            count++;
          },
          true
        );
        flock.broadcastEvent('ping');
        flock.broadcastEvent('ping');
        flock.broadcastEvent('ping');
        expect(count).to.equal(1);
      });

      it('reports and does not throw when handler is not a function', function () {
        const reported = [];
        const previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
        try {
          expect(() => flock.onEvent('jump', 'notAFunction')).to.not.throw();
        } finally {
          flock.onBlockError = previousOnBlockError;
        }
        expect(reported.some((r) => r.key === 'invalid_callback')).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe('start', function () {
      it('calls action on the next render frame', async function () {
        let called = false;
        flock.start(() => {
          called = true;
        });
        await flock.wait(0.1);
        expect(called).to.be.true;
      });

      it('waits for resume when the project is paused', async function () {
        let called = false;
        try {
          flock.setPaused(true);
          flock.start(() => {
            called = true;
          });
          await new Promise((r) => setTimeout(r, 150));
          expect(called).to.be.false;
          flock.setPaused(false);
          expect(called).to.be.true;
        } finally {
          flock.setPaused(false);
        }
      });
    });

    // -------------------------------------------------------------------------
    describe('forever @slow', function () {
      this.timeout(10000);

      it('calls action at least 3 times across render frames', async function () {
        let count = 0;
        flock.forever(async () => {
          count++;
        });
        await flock.wait(0.5);
        expect(count).to.be.at.least(3);
      });

      it('does not run action concurrently when action takes time', async function () {
        let concurrent = false;
        let running = false;
        let count = 0;
        flock.forever(async () => {
          if (running) {
            concurrent = true;
          }
          running = true;
          count++;
          await flock.wait(0.05);
          running = false;
        });
        await flock.wait(0.5);
        expect(concurrent).to.be.false;
        expect(count).to.be.at.least(1);
      });

      it('does not tick while paused and carries on after resume', async function () {
        let count = 0;
        try {
          flock.forever(async () => {
            count++;
          });
          await flock.wait(0.2);
          flock.setPaused(true);
          // Let an in-flight tick settle before counting.
          await new Promise((r) => setTimeout(r, 50));
          const atPause = count;
          await new Promise((r) => setTimeout(r, 300));
          expect(count).to.equal(atPause);
          flock.setPaused(false);
          await flock.wait(0.2);
          expect(count).to.be.greaterThan(atPause);
        } finally {
          flock.setPaused(false);
        }
      });
    });

    // -------------------------------------------------------------------------
    describe('whenKeyEvent', function () {
      it('calls callback when matching KEYDOWN key fires', function () {
        let called = false;
        flock.whenKeyEvent('x', () => {
          called = true;
        });
        flock.inputManager.onKeyDownObservable.notifyObservers('x');
        expect(called).to.be.true;
      });

      it('does not call callback while paused', function () {
        let called = false;
        flock.whenKeyEvent('x', () => {
          called = true;
        });
        try {
          flock.setPaused(true);
          flock.inputManager.onKeyDownObservable.notifyObservers('x');
          expect(called).to.be.false;
        } finally {
          flock.setPaused(false);
        }
      });

      it('does not call callback for a different key', function () {
        let called = false;
        flock.whenKeyEvent('x', () => {
          called = true;
        });
        flock.inputManager.onKeyDownObservable.notifyObservers('z');
        expect(called).to.be.false;
      });

      it('fires on KEYUP when isReleased=true, not on KEYDOWN', function () {
        let downCalled = false;
        let upCalled = false;
        flock.whenKeyEvent(
          'm',
          () => {
            downCalled = true;
          },
          false
        );
        flock.whenKeyEvent(
          'm',
          () => {
            upCalled = true;
          },
          true
        );

        flock.inputManager.onKeyDownObservable.notifyObservers('m');
        expect(downCalled).to.be.true;
        expect(upCalled).to.be.false;

        flock.inputManager.onKeyUpObservable.notifyObservers('m');
        expect(upCalled).to.be.true;
      });

      it('reports and does not throw when callback is not a function', function () {
        const reported = [];
        const previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
        try {
          expect(() => flock.whenKeyEvent('k', 'notAFunction')).to.not.throw();
        } finally {
          flock.onBlockError = previousOnBlockError;
        }
        expect(reported.some((r) => r.key === 'invalid_callback')).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe('whenActionEvent', function () {
      afterEach(function () {
        flock.inputManager._clearAllKeys();
      });

      it("triggers callback when FORWARD action key 'w' is pressed", function () {
        let called = false;
        flock.whenActionEvent('FORWARD', () => {
          called = true;
        });
        flock.inputManager._setKey('w', true);
        expect(called).to.be.true;
      });

      it('reports and does not throw when callback is not a function', function () {
        const reported = [];
        const previousOnBlockError = flock.onBlockError;
        flock.onBlockError = (info) => reported.push(info);
        try {
          expect(() => flock.whenActionEvent('FORWARD', 'notAFunction')).to.not.throw();
        } finally {
          flock.onBlockError = previousOnBlockError;
        }
        expect(reported.some((r) => r.key === 'invalid_callback')).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe('_familyOf', function () {
      it('uses the reserved base for the first instance and collision suffixes', function () {
        const first = flock._reserveName('famof_tree_house');
        const second = flock._reserveName('famof_tree_house');

        expect(second).to.not.equal(first);
        expect(flock._familyOf(first)).to.equal('famof_tree_house');
        expect(flock._familyOf(second)).to.equal('famof_tree_house');
        flock._releaseName(first);
        flock._releaseName(second);
      });

      it('uses an explicit family when one is given', function () {
        const name = flock._reserveName('famof_src_abc', 'famof_src');
        expect(flock._familyOf(name)).to.equal('famof_src');
        flock._releaseName(name);
      });

      it('takes the family of a registered parent for a dotted child name', function () {
        const parent = flock._reserveName('famof_parent_1', 'famof_parent');
        expect(flock._familyOf(`${parent}.arm_left`)).to.equal('famof_parent');
        flock._releaseName(parent);
      });

      it('strips the block id from an unregistered generator id', function () {
        expect(flock._familyOf('famof_unreg__abc_123')).to.equal('famof_unreg');
      });

      it('does not split an unregistered name on a single underscore', function () {
        expect(flock._familyOf('famof_loose_name')).to.equal('famof_loose_name');
        expect(flock._familyOf('Button_xyz')).to.equal('Button_xyz');
        expect(flock._familyOf('Cylinder.001')).to.equal('Cylinder.001');
      });
    });

    // -------------------------------------------------------------------------
    describe('onTrigger with applyToGroup @physics', function () {
      // Generated code creates meshes from "variable__blockId" ids. Repeat
      // instances get collision suffixes ("coin", "coin_57") and share the
      // family "coin" recorded when the name was reserved.
      const box = (id, x = 0) =>
        flock.createBox(id, { width: 1, height: 1, depth: 1, position: [x, 0, 0] });
      const pick = (name) =>
        flock.scene
          .getMeshByName(name)
          ?.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);

      it('registers trigger on every instance of the same family', async function () {
        const name1 = await box('evtbox__b1');
        const name2 = await box('evtbox__b1', 2);
        meshIds.push(name1, name2);
        expect(name1).to.not.equal(name2);

        let count = 0;
        flock.onTrigger(name1, {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        pick(name1);
        pick(name2);

        expect(count).to.equal(2);
      });

      it('registers trigger only on named mesh when applyToGroup is false', async function () {
        const name1 = await box('solobox__b1');
        const name2 = await box('solobox__b1', 2);
        meshIds.push(name1, name2);

        let count = 0;
        flock.onTrigger(name1, {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: false,
        });

        pick(name2);

        expect(count).to.equal(0);
      });

      it('replays pending non-group trigger on the original target mesh only', async function () {
        let count = 0;
        flock.onTrigger('latepick', {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: false,
        });

        const target = await box('latepick__b1');
        const sibling = await box('latepick__b1', 2);
        meshIds.push(target, sibling);
        expect(target).to.equal('latepick');

        pick(sibling);
        pick(target);

        expect(count).to.equal(1);
      });

      it('replays pending group trigger across siblings when applyToGroup is true', async function () {
        let count = 0;
        flock.onTrigger('lategroup', {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        const first = await box('lategroup__b1');
        const second = await box('lategroup__b1', 2);
        meshIds.push(first, second);

        pick(first);
        pick(second);

        expect(count).to.equal(2);
      });

      it('keeps names that share an underscore prefix in separate families', async function () {
        const tree = await box('famtree__b1');
        const treeHouse = await box('famtree_house__b2', 2);
        const treeHouse2 = await box('famtree_house__b2', 4);
        meshIds.push(tree, treeHouse, treeHouse2);

        let treeCount = 0;
        let houseCount = 0;
        flock.onTrigger(tree, {
          trigger: 'OnPickTrigger',
          callback: () => treeCount++,
          applyToGroup: true,
        });
        flock.onTrigger(treeHouse, {
          trigger: 'OnPickTrigger',
          callback: () => houseCount++,
          applyToGroup: true,
        });

        pick(tree);
        pick(treeHouse);
        pick(treeHouse2);

        expect(treeCount).to.equal(1);
        expect(houseCount).to.equal(2);
      });

      it('does not treat a numbered variable name as another instance', async function () {
        const coin1 = await box('famcoin_1__b1');
        const coin2 = await box('famcoin_2__b2', 2);
        meshIds.push(coin1, coin2);

        let count = 0;
        flock.onTrigger(coin1, {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        pick(coin1);
        pick(coin2);

        expect(count).to.equal(1);
      });

      it('replays a pending group trigger only on its own underscore family', async function () {
        let count = 0;
        flock.onTrigger('lateunder_thing', {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        const other = await box('lateunder__b1');
        const first = await box('lateunder_thing__b2', 2);
        const second = await box('lateunder_thing__b2', 4);
        meshIds.push(other, first, second);

        pick(other);
        pick(first);
        pick(second);

        expect(count).to.equal(2);
      });

      it('passes the picked instance name to the callback', async function () {
        const name1 = await box('evtself__b1');
        const name2 = await box('evtself__b1', 2);
        meshIds.push(name1, name2);

        const picked = [];
        flock.onTrigger(name1, {
          trigger: 'OnPickTrigger',
          callback: (name) => picked.push(name),
          applyToGroup: true,
        });

        pick(name2);
        pick(name1);

        expect(picked).to.deep.equal([name2, name1]);
      });

      it('keeps GUI buttons with generated ids in separate families', function () {
        const buttonA = flock.UIButton({
          text: 'A',
          x: 0,
          y: 0,
          width: 'SMALL',
          buttonId: 'Button_famA',
        });
        const buttonB = flock.UIButton({
          text: 'B',
          x: 0,
          y: 50,
          width: 'SMALL',
          buttonId: 'Button_famB',
        });

        let count = 0;
        flock.onTrigger(buttonA, {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        const click = (name) =>
          flock.scene.UITexture.getControlByName(name).onPointerClickObservable.notifyObservers({});
        return new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
          click(buttonB);
          click(buttonA);
          expect(count).to.equal(1);
          flock.scene.UITexture.getControlByName(buttonA)?.dispose();
          flock.scene.UITexture.getControlByName(buttonB)?.dispose();
        });
      });

      it('registers a when-clicked handler on a GUI button created afterwards', async function () {
        const buttonId = 'latebutton__blockid';
        let count = 0;
        flock.onTrigger('latebutton', {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: true,
        });

        flock.UIButton({ text: 'Late', x: 0, y: 0, width: 'SMALL', buttonId });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const button = flock.scene.UITexture.getControlByName(buttonId);
        button.onPointerClickObservable.notifyObservers({});
        expect(count).to.equal(1);
        button.dispose();
      });

      it('registers a when-clicked handler on a clone created afterwards', async function () {
        const source = await flock.createBox('lateclonesrc__blk', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        meshIds.push(source);

        const picked = [];
        flock.onTrigger('lateclone', {
          trigger: 'OnPickTrigger',
          callback: (name) => picked.push(name),
          applyToGroup: true,
        });

        const cloneName = flock.cloneMesh({
          sourceMeshName: source,
          cloneId: 'lateclonesrc__1',
          cloneName: 'lateclone',
        });
        const clone = await flock.whenModelReady(cloneName);
        meshIds.push(clone.name);

        clone.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger, {
          source: clone,
          meshUnderPointer: clone,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(picked).to.deep.equal([clone.name]);
      });

      it('fires once when a clone is assigned to its source variable', async function () {
        const source = await flock.createBox('selfclone__blk', {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        meshIds.push(source);

        const picked = [];
        flock.onTrigger('selfclone', {
          trigger: 'OnPickTrigger',
          callback: (name) => picked.push(name),
          applyToGroup: true,
        });

        const cloneName = flock.cloneMesh({
          sourceMeshName: source,
          cloneId: 'selfclone__1',
          cloneName: 'selfclone',
        });
        const clone = await flock.whenModelReady(cloneName);
        meshIds.push(clone.name);

        clone.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger, {
          source: clone,
          meshUnderPointer: clone,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(picked).to.deep.equal([clone.name]);
      });
    });

    describe('onTrigger callback sequences @physics', function () {
      const box = (id, x = 0) =>
        flock.createBox(id, { width: 1, height: 1, depth: 1, position: [x, 0, 0] });
      const pick = (name) =>
        flock.scene
          .getMeshByName(name)
          .actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

      it('runs the next callback on each click, wrapping round', async function () {
        const door = await box('seqdoor__b1');
        meshIds.push(door);

        const ran = [];
        await flock.onTrigger(door, {
          trigger: 'OnPickTrigger',
          callback: [() => ran.push('open'), () => ran.push('close')],
        });

        for (let i = 0; i < 3; i++) {
          pick(door);
          await tick();
        }

        expect(ran).to.deep.equal(['open', 'close', 'open']);
      });

      it('ignores clicks until the current callback has finished', async function () {
        const door = await box('seqwait__b1');
        meshIds.push(door);

        const ran = [];
        let finishOpen;
        await flock.onTrigger(door, {
          trigger: 'OnPickTrigger',
          callback: [
            async () => {
              ran.push('open');
              await new Promise((resolve) => (finishOpen = resolve));
            },
            () => ran.push('close'),
          ],
        });

        pick(door);
        await tick();
        pick(door);
        await tick();
        expect(ran).to.deep.equal(['open']);

        finishOpen();
        await tick();
        pick(door);
        await tick();
        expect(ran).to.deep.equal(['open', 'close']);
      });

      it('keeps a separate place in the sequence for each member of a group', async function () {
        const first = await box('seqgroup__b1');
        const second = await box('seqgroup__b1', 2);
        meshIds.push(first, second);

        const ran = [];
        await flock.onTrigger(first, {
          trigger: 'OnPickTrigger',
          callback: [(name) => ran.push(`open ${name}`), (name) => ran.push(`close ${name}`)],
          applyToGroup: true,
        });
        await tick();

        pick(first);
        await tick();
        pick(second);
        await tick();
        pick(first);
        await tick();

        expect(ran).to.deep.equal([`open ${first}`, `open ${second}`, `close ${first}`]);
      });

      for (const removed of ['OnLeftPickTrigger', 'OnDoublePickTrigger', 'OnPointerUpTrigger']) {
        it(`does not register the unsupported ${removed}`, async function () {
          const door = await box(`sequnsupported${removed}__b1`);
          meshIds.push(door);

          await flock.onTrigger(door, { trigger: removed, callback: () => {} });

          expect(flock.scene.getMeshByName(door).actionManager?.actions ?? []).to.be.empty;
        });
      }

      it('moves on past a callback that throws', async function () {
        const door = await box('seqthrow__b1');
        meshIds.push(door);

        const ran = [];
        await flock.onTrigger(door, {
          trigger: 'OnPickTrigger',
          callback: [
            () => {
              throw new Error('broken step');
            },
            () => ran.push('close'),
          ],
        });

        pick(door);
        await tick();
        pick(door);
        await tick();

        expect(ran).to.deep.equal(['close']);
      });
    });

    describe('onTrigger hierarchy bubbling @physics', function () {
      const pickTrigger = () => flock.BABYLON.ActionManager.OnPickTrigger;
      const box = (id, x = 0) =>
        flock.createBox(id, { width: 1, height: 1, depth: 1, position: [x, 0, 0] });
      const fire = (mesh, evt) => mesh.actionManager.processTrigger(pickTrigger(), evt);
      const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

      async function makeGroup() {
        const groupName = await flock.createGroup('bubblegroup', {
          position: [0, 0, 0],
        });
        const childA = await box('bubblegroupA', 0);
        const childB = await box('bubblegroupB', 4);
        meshIds.push(groupName, childA, childB);
        const group = flock.scene.getMeshByName(groupName);
        flock.scene.getMeshByName(childA).setParent(group);
        flock.scene.getMeshByName(childB).setParent(group);
        flock.recomputeGroupGeometry(group);
        return {
          group,
          childA: flock.scene.getMeshByName(childA),
          childB: flock.scene.getMeshByName(childB),
        };
      }

      it('fires the group handler with the group name when a member without its own trigger is clicked', async function () {
        const { group, childA } = await makeGroup();
        const received = [];
        flock.onTrigger(group.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => received.push(name),
          applyToGroup: false,
        });
        await tick();
        fire(group, { source: childA, meshUnderPointer: childA });
        expect(received).to.deep.equal([group.name]);
      });

      it('fires the member handler (not the group) when the shell occludes a member with its own trigger', async function () {
        const { group, childA } = await makeGroup();
        const groupHits = [];
        const memberHits = [];
        flock.onTrigger(group.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => groupHits.push(name),
          applyToGroup: false,
        });
        flock.onTrigger(childA.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => memberHits.push(name),
          applyToGroup: false,
        });
        await tick();
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [{ pickedMesh: group }, { pickedMesh: childA }];
        try {
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
        expect(memberHits).to.deep.equal([childA.name]);
        expect(groupHits).to.deep.equal([]);
      });

      it('delegates to the nearest member even when multiPick lists a farther member first', async function () {
        const { group, childA, childB } = await makeGroup();
        const memberHits = [];
        flock.onTrigger(childA.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => memberHits.push(name),
          applyToGroup: false,
        });
        await tick();
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [
          { pickedMesh: group, distance: 1 },
          { pickedMesh: childB, distance: 9 },
          { pickedMesh: childA, distance: 3 },
        ];
        try {
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
        expect(memberHits).to.deep.equal([childA.name]);
      });

      it('fires the group handler when no member behind the shell has a trigger', async function () {
        const { group } = await makeGroup();
        const received = [];
        flock.onTrigger(group.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => received.push(name),
          applyToGroup: false,
        });
        await tick();
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [{ pickedMesh: group }];
        try {
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
        expect(received).to.deep.equal([group.name]);
      });

      it('ignores clicks on unrelated meshes (no sibling bleed)', async function () {
        const { group } = await makeGroup();
        const stranger = await box('bubblestranger', 9);
        let count = 0;
        flock.onTrigger(group.name, {
          trigger: 'OnPickTrigger',
          callback: () => count++,
          applyToGroup: false,
        });
        await tick();
        const other = flock.scene.getMeshByName(stranger);
        fire(group, { source: other, meshUnderPointer: other });
        expect(count).to.equal(0);
      });

      it('uses the pick result over a stale meshUnderPointer when the pointer has not moved', async function () {
        const target = await box('bubblestilltarget', 0);
        const stale = await box('bubblestillstale', 3);
        meshIds.push(target, stale);
        const received = [];
        flock.onTrigger(target, {
          trigger: 'OnPickTrigger',
          callback: (name) => received.push(name),
          applyToGroup: false,
        });
        await tick();
        const targetMesh = flock.scene.getMeshByName(target);
        fire(targetMesh, {
          source: targetMesh,
          meshUnderPointer: flock.scene.getMeshByName(stale),
          additionalData: { pickedMesh: targetMesh },
        });
        expect(received).to.deep.equal([target]);
      });

      it('bubbles a parentChild click to the parent handler', async function () {
        const parent = await box('bubbleparent', 0);
        const child = await box('bubblechild', 2);
        meshIds.push(parent, child);
        const parentMesh = flock.scene.getMeshByName(parent);
        flock.scene.getMeshByName(child).setParent(parentMesh);
        const received = [];
        flock.onTrigger(parent, {
          trigger: 'OnPickTrigger',
          callback: (name) => received.push(name),
          applyToGroup: false,
        });
        await tick();
        const childMesh = flock.scene.getMeshByName(child);
        fire(parentMesh, { source: childMesh, meshUnderPointer: childMesh });
        expect(received).to.deep.equal([parent]);
      });

      it('forwards a shell click to a member trigger when the group itself has none (door case)', async function () {
        const { group, childA } = await makeGroup();
        const memberHits = [];
        flock.onTrigger(childA.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => memberHits.push(name),
          applyToGroup: false,
        });
        await tick();
        expect(group.actionManager, 'shell carries the forwarder').to.exist;
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [{ pickedMesh: group }, { pickedMesh: childA }];
        try {
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
        expect(memberHits).to.deep.equal([childA.name]);
      });

      it('drops a shell click when neither the group nor any member has a trigger', async function () {
        const { group, childA } = await makeGroup();
        await tick();
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [{ pickedMesh: group }, { pickedMesh: childA }];
        try {
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
      });

      it('binds a fresh forwarder when a group is cloned', async function () {
        const { group, childA } = await makeGroup();
        const cloneId = flock.cloneMesh({ sourceMeshName: group.name, cloneId: 'bubbleclone' });
        meshIds.push(cloneId);
        const clone = await flock.whenModelReady(cloneId);
        const cloneMember = clone
          .getDescendants(false)
          .find((node) => node !== clone && node.getChildMeshes);
        expect(cloneMember, 'clone carries its member').to.exist;
        const cloneHits = [];
        flock.onTrigger(cloneMember.name, {
          trigger: 'OnPickTrigger',
          callback: (name) => cloneHits.push(name),
          applyToGroup: false,
        });
        await tick();
        const realMultiPick = flock.scene.multiPick.bind(flock.scene);
        flock.scene.multiPick = () => [{ pickedMesh: clone }, { pickedMesh: cloneMember }];
        try {
          fire(clone, {
            source: clone,
            meshUnderPointer: clone,
            pointerX: 5,
            pointerY: 5,
          });
        } finally {
          flock.scene.multiPick = realMultiPick;
        }
        expect(cloneHits).to.deep.equal([cloneMember.name]);
        expect(childA.actionManager, 'source member untouched').to.not.exist;
      });

      it('door case end to end: real pick hits the shell, real multiPick reveals the door', async function () {
        this.timeout(15000);
        const camera = flock.scene.activeCamera;
        const savedPos = camera.position.clone();
        const savedTarget = camera.getTarget?.().clone();
        try {
          const groupName = await flock.createGroup('doorcase', { position: [0, 0, 0] });
          const doorName = await flock.createBox('doorcaseDoor', {
            width: 0.075,
            height: 3.45,
            depth: 2.1,
            position: [0, 0.31, 0],
          });
          const innerName = await flock.createBox('doorcaseInner', {
            width: 0.075,
            height: 3.45,
            depth: 2.1,
            position: [0, 0.31, 0.5],
          });
          meshIds.push(groupName, doorName, innerName);
          const group = flock.scene.getMeshByName(groupName);
          const door = flock.scene.getMeshByName(doorName);
          const inner = flock.scene.getMeshByName(innerName);
          door.setParent(group);
          inner.setParent(door);
          flock.recomputeGroupGeometry(group);

          const doorCentre = door.getAbsolutePosition();
          camera.position.set(doorCentre.x, doorCentre.y, -6);
          camera.setTarget(doorCentre);
          camera.computeWorldMatrix?.(true);
          flock.scene.updateTransformMatrix(true);

          const engine = flock.scene.getEngine();
          const viewport = camera.viewport.toGlobal(
            engine.getRenderWidth(),
            engine.getRenderHeight()
          );
          const coords = flock.BABYLON.Vector3.Project(
            doorCentre,
            flock.BABYLON.Matrix.Identity(),
            flock.scene.getTransformMatrix(),
            viewport
          );

          const picked = flock.scene.pick(coords.x, coords.y);
          expect(picked.hit, 'click reaches the scene').to.be.true;
          expect(picked.pickedMesh, 'shell and door faces are coplanar').to.be.oneOf([group, door]);

          const hits = flock.scene.multiPick(
            coords.x,
            coords.y,
            (m) => m.isPickable && m.isVisible && m.isEnabled?.() !== false
          );
          expect(hits.map((h) => h.pickedMesh)).to.include(door);

          const doorHits = [];
          const innerHits = [];
          flock.onTrigger(doorName, {
            trigger: 'OnPickTrigger',
            callback: (name) => doorHits.push(name),
            applyToGroup: false,
          });
          flock.onTrigger(innerName, {
            trigger: 'OnPickTrigger',
            callback: (name) => innerHits.push(name),
            applyToGroup: false,
          });
          await tick();
          fire(group, {
            source: group,
            meshUnderPointer: group,
            pointerX: coords.x,
            pointerY: coords.y,
          });
          expect(doorHits, 'outer door fires').to.deep.equal([doorName]);
          expect(innerHits, 'inner door stays silent').to.deep.equal([]);
        } finally {
          camera.position.copyFrom(savedPos);
          if (savedTarget) camera.setTarget(savedTarget);
        }
      });
    });
  });
}
