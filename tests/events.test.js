import { expect } from 'chai';

export function runEventsTests(flock) {
  describe('Events API @events', function () {
    const meshIds = [];

    afterEach(function () {
      // Clear any custom events registered during tests
      if (flock.events) {
        Object.keys(flock.events).forEach((key) => delete flock.events[key]);
      }
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
    describe('isAllowedEventName', function () {
      it('returns false for empty string', function () {
        expect(flock.isAllowedEventName('')).to.be.false;
      });

      it('returns false for non-string input', function () {
        expect(flock.isAllowedEventName(null)).to.be.false;
        expect(flock.isAllowedEventName(42)).to.be.false;
      });

      it('returns false for name longer than 30 characters', function () {
        expect(flock.isAllowedEventName('a'.repeat(31))).to.be.false;
      });

      it('returns false for reserved prefixes', function () {
        expect(flock.isAllowedEventName('onSomething')).to.be.false;
        expect(flock.isAllowedEventName('systemEvent')).to.be.false;
        expect(flock.isAllowedEventName('internalMsg')).to.be.false;
        expect(flock.isAllowedEventName('babylonTick')).to.be.false;
        expect(flock.isAllowedEventName('flockReady')).to.be.false;
        expect(flock.isAllowedEventName('_hidden')).to.be.false;
      });

      it('returns false for disallowed characters', function () {
        expect(flock.isAllowedEventName('hello!')).to.be.false;
        expect(flock.isAllowedEventName('say@world')).to.be.false;
      });

      it('returns true for a valid plain name', function () {
        expect(flock.isAllowedEventName('jump')).to.be.true;
        expect(flock.isAllowedEventName('collect coin')).to.be.true;
      });

      it('returns true for a name with emoji', function () {
        expect(flock.isAllowedEventName('🎉party')).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe('sanitizeEventName', function () {
      it('removes disallowed characters', function () {
        expect(flock.sanitizeEventName('hello!')).to.equal('hello');
        expect(flock.sanitizeEventName('say@world')).to.equal('sayworld');
      });

      it('truncates to 50 characters', function () {
        const long = 'a'.repeat(60);
        expect(flock.sanitizeEventName(long)).to.have.lengthOf(50);
      });

      it('returns empty string for non-string input', function () {
        expect(flock.sanitizeEventName(null)).to.equal('');
        expect(flock.sanitizeEventName(123)).to.equal('');
      });

      it('preserves emoji and spaces', function () {
        expect(flock.sanitizeEventName('🎉 party time')).to.equal('🎉 party time');
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

      it('silently rejects broadcastEvent with reserved event name', function () {
        let called = false;
        // Cannot register on reserved name, so just verify broadcast doesn't throw
        expect(() => flock.broadcastEvent('onSomething')).to.not.throw();
        expect(called).to.be.false;
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
        return { group, childA: flock.scene.getMeshByName(childA) };
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

          camera.position.set(0, 0.31, -6);
          camera.setTarget(new flock.BABYLON.Vector3(0, 0.31, 0));
          camera.computeWorldMatrix?.(true);

          const engine = flock.scene.getEngine();
          const viewport = camera.viewport.toGlobal(
            engine.getRenderWidth(),
            engine.getRenderHeight()
          );
          const coords = flock.BABYLON.Vector3.Project(
            door.getAbsolutePosition(),
            flock.BABYLON.Matrix.Identity(),
            flock.scene.getTransformMatrix(),
            viewport
          );

          const picked = flock.scene.pick(coords.x, coords.y);
          expect(picked.hit, 'click reaches the scene').to.be.true;
          expect(picked.pickedMesh, 'shell occludes the door').to.equal(group);

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
