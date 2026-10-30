import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import { defineBlocks } from '../blocks/blocks.js';
import { generateWorkspaceCode } from '../blocks/sectionContainment.js';

export function runSectionsTests(flock) {
  describe('Sections @sections', function () {
    const boxIds = [];

    beforeEach(function () {
      flock.scene ??= {};
    });

    afterEach(function () {
      flock.stopAllSounds();
      boxIds.forEach((boxId) => {
        flock.scene.getMeshByName?.(boxId)?.dispose();
      });
      boxIds.length = 0;
    });

    it('tags meshes created while loading, and unload disposes them', async function () {
      const boxId = 'sectionTestBox1';
      boxIds.push(boxId);

      async function section() {
        await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }

      await flock.loadSection(section);

      const mesh = flock.scene.getMeshByName(boxId);
      expect(mesh).to.exist;
      expect(mesh.metadata?.sectionOwner).to.equal(section);

      flock.unloadSection(section);

      expect(flock.meshExists(boxId)).to.be.false;
    });

    it('does not dispose meshes owned by a different section', async function () {
      const boxIdA = 'sectionTestBoxA';
      const boxIdB = 'sectionTestBoxB';
      boxIds.push(boxIdA, boxIdB);

      async function sectionA() {
        await flock.createBox(boxIdA, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }
      async function sectionB() {
        await flock.createBox(boxIdB, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }

      await flock.loadSection(sectionA);
      await flock.loadSection(sectionB);

      flock.unloadSection(sectionA);

      expect(flock.meshExists(boxIdA)).to.be.false;
      expect(flock.meshExists(boxIdB)).to.be.true;
    });

    it('loading an already-loaded section is a no-op', async function () {
      let runs = 0;
      async function section() {
        runs++;
      }

      await flock.loadSection(section);
      await flock.loadSection(section);

      expect(runs).to.equal(1);
    });

    it('unloading then loading again re-runs the section', async function () {
      // Name reservations aren't released on disposal, so a reload gets a
      // suffixed name - count owned meshes instead of asserting on a name.
      const ownedMeshCount = () =>
        flock.scene.meshes.filter((m) => m.metadata?.sectionOwner === section).length;
      let runs = 0;

      async function section() {
        runs++;
        const name = await flock.createBox(`sectionTestBoxReload_${runs}`, {
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        boxIds.push(name);
      }

      await flock.loadSection(section);
      expect(ownedMeshCount()).to.equal(1);

      flock.unloadSection(section);
      expect(ownedMeshCount()).to.equal(0);

      await flock.loadSection(section);
      expect(runs).to.equal(2);
      expect(ownedMeshCount()).to.equal(1);
    });

    it('unloading a section that is not loaded is a no-op', function () {
      async function section() {}
      expect(() => flock.unloadSection(section)).to.not.throw();
    });

    it('rolls back loaded state when a section throws, so it can be retried', async function () {
      const boxId = 'sectionTestFailThenRetry';
      boxIds.push(boxId);
      let attempts = 0;

      async function section() {
        attempts++;
        if (attempts === 1) throw new Error('boom');
        await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }

      let caught = null;
      try {
        await flock.loadSection(section);
      } catch (err) {
        caught = err;
      }
      expect(caught?.message).to.equal('boom');

      await flock.loadSection(section);

      expect(attempts).to.equal(2);
      expect(flock.meshExists(boxId)).to.be.true;
    });

    it('sweeps resources a section created before it threw, not just its bookkeeping', async function () {
      const boxId = 'sectionTestFailPartial';
      boxIds.push(boxId);

      async function section() {
        await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        throw new Error('boom');
      }

      let caught = null;
      try {
        await flock.loadSection(section);
      } catch (err) {
        caught = err;
      }
      expect(caught?.message).to.equal('boom');

      // The box it created before throwing must not be left behind as an orphan.
      expect(flock.meshExists(boxId)).to.be.false;
    });

    it('onStop removes its master-signal listener once the section signal fires first', function () {
      function makeFakeSignal() {
        const listeners = new Set();
        return {
          aborted: false,
          addEventListener(_type, fn) {
            listeners.add(fn);
          },
          removeEventListener(_type, fn) {
            listeners.delete(fn);
          },
          fire() {
            this.aborted = true;
            Array.from(listeners).forEach((fn) => fn());
          },
          get listenerCount() {
            return listeners.size;
          },
        };
      }

      const fakeMasterSignal = makeFakeSignal();
      const fakeSectionSignal = makeFakeSignal();
      const originalAbortController = flock.abortController;
      flock.abortController = { signal: fakeMasterSignal };

      try {
        let cleanupCalls = 0;
        flock.onStop(() => cleanupCalls++, fakeSectionSignal);

        expect(fakeMasterSignal.listenerCount).to.equal(1);
        expect(fakeSectionSignal.listenerCount).to.equal(1);

        fakeSectionSignal.fire();

        expect(cleanupCalls).to.equal(1);
        // Not just guarded against a second call - actually detached, so it
        // can't keep this closure (and whatever cleanup captures) alive.
        expect(fakeMasterSignal.listenerCount).to.equal(0);
        expect(fakeSectionSignal.listenerCount).to.equal(0);
      } finally {
        flock.abortController = originalAbortController;
      }
    });

    it('loadSectionQueued serializes overlapping loads instead of running them concurrently', async function () {
      const order = [];
      let resolveA;

      async function sectionA() {
        order.push('A-start');
        await new Promise((resolve) => {
          resolveA = resolve;
        });
        order.push('A-end');
      }
      async function sectionB() {
        order.push('B-start');
        order.push('B-end');
      }

      const pA = flock.loadSectionQueued(sectionA);
      const pB = flock.loadSectionQueued(sectionB);

      // Give microtasks a chance to run - B must not have started yet.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(order).to.deep.equal(['A-start']);

      resolveA();
      await pA;
      await pB;

      expect(order).to.deep.equal(['A-start', 'A-end', 'B-start', 'B-end']);
    });

    it('nesting inside a queued load still works, without deadlocking against the queue', async function () {
      const boxIdOuter = 'sectionTestNestedOuter';
      const boxIdInner = 'sectionTestNestedInner';
      boxIds.push(boxIdOuter, boxIdInner);
      let resolveQueued;

      async function queuedHog() {
        await new Promise((resolve) => {
          resolveQueued = resolve;
        });
      }
      async function inner() {
        await flock.createBox(boxIdInner, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }
      async function outer() {
        await flock.createBox(boxIdOuter, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        // Direct (unqueued) nested call, exactly as codegen emits for a
        // section_control block that's a direct child of another section.
        await flock.loadSection(inner);
      }

      // queuedHog occupies the queue first, so outer must wait for it rather
      // than racing it as two independent roots.
      const pHog = flock.loadSectionQueued(queuedHog);
      const pOuter = flock.loadSectionQueued(outer);

      // Let queuedHog's own microtask actually start running before releasing it.
      await Promise.resolve();
      await Promise.resolve();
      resolveQueued();
      await pHog;
      await pOuter;

      expect(flock.meshExists(boxIdOuter)).to.be.true;
      expect(flock.meshExists(boxIdInner)).to.be.true;
    });

    it('unloadSectionQueued waits for an in-flight queued load, so it never misses what fn() goes on to create', async function () {
      const boxId = 'sectionTestUnloadQueued';
      boxIds.push(boxId);
      let resolveLoad;

      async function slowSection() {
        await new Promise((resolve) => {
          resolveLoad = resolve;
        });
        await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }

      const pLoad = flock.loadSectionQueued(slowSection);
      // Let the queued load actually start and reach its own internal await.
      await Promise.resolve();
      await Promise.resolve();

      // Queued too, so it waits for slowSection's fn() - box included - to
      // fully finish before it can mark the section unloaded.
      const pUnload = flock.unloadSectionQueued(slowSection);

      resolveLoad();
      await pLoad;
      await pUnload;

      expect(flock.meshExists(boxId)).to.be.false;
    });

    it('switchSection unloads every other loaded section and loads the chosen one', async function () {
      const boxIdA = 'sectionTestSwitchA';
      const boxIdB = 'sectionTestSwitchB';
      const boxIdC = 'sectionTestSwitchC';
      boxIds.push(boxIdA, boxIdB, boxIdC);

      async function sectionA() {
        await flock.createBox(boxIdA, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }
      async function sectionB() {
        await flock.createBox(boxIdB, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }
      async function sectionC() {
        await flock.createBox(boxIdC, { width: 1, height: 1, depth: 1, position: [4, 0, 0] });
      }

      await flock.loadSection(sectionA);
      await flock.loadSection(sectionB);

      await flock.switchSection(sectionC);

      expect(flock.meshExists(boxIdA)).to.be.false;
      expect(flock.meshExists(boxIdB)).to.be.false;
      expect(flock.meshExists(boxIdC)).to.be.true;
    });

    it('switching to an already-loaded section leaves it running and still unloads the others', async function () {
      const boxIdA = 'sectionTestSwitchAlreadyA';
      const boxIdB = 'sectionTestSwitchAlreadyB';
      boxIds.push(boxIdA, boxIdB);
      let runsA = 0;

      async function sectionA() {
        runsA++;
        await flock.createBox(boxIdA, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }
      async function sectionB() {
        await flock.createBox(boxIdB, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }

      await flock.loadSection(sectionA);
      await flock.loadSection(sectionB);

      await flock.switchSection(sectionA);

      expect(runsA).to.equal(1);
      expect(flock.meshExists(boxIdA)).to.be.true;
      expect(flock.meshExists(boxIdB)).to.be.false;
    });

    it('unloadAllSections unloads every currently-loaded section', async function () {
      const boxIdA = 'sectionTestUnloadAllA';
      const boxIdB = 'sectionTestUnloadAllB';
      boxIds.push(boxIdA, boxIdB);

      async function sectionA() {
        await flock.createBox(boxIdA, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }
      async function sectionB() {
        await flock.createBox(boxIdB, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }

      await flock.loadSection(sectionA);
      await flock.loadSection(sectionB);

      flock.unloadAllSections();

      expect(flock.meshExists(boxIdA)).to.be.false;
      expect(flock.meshExists(boxIdB)).to.be.false;
    });

    it('stops a forever loop started inside the section when it unloads', async function () {
      let ticks = 0;

      async function section() {
        flock.forever(() => {
          ticks++;
        });
      }

      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 200));
      const ticksBeforeUnload = ticks;
      expect(ticksBeforeUnload).to.be.above(0);

      flock.unloadSection(section);
      await new Promise((r) => setTimeout(r, 200));

      expect(ticks).to.equal(ticksBeforeUnload);
    });

    it('stops a forever started by a section-owned click handler when the section unloads', async function () {
      const boxId = 'sectionTestBoxForeverClick';
      boxIds.push(boxId);
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      let ticks = 0;
      async function section() {
        flock.onTrigger(boxId, {
          trigger: 'OnPickTrigger',
          callback: () => {
            flock.forever(() => {
              ticks++;
            });
          },
        });
      }

      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 50));
      flock.scene
        .getMeshByName(boxId)
        .actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      await new Promise((r) => setTimeout(r, 200));
      const ticksBeforeUnload = ticks;
      expect(ticksBeforeUnload).to.be.above(0);

      flock.unloadSection(section);
      await new Promise((r) => setTimeout(r, 200));

      expect(ticks).to.equal(ticksBeforeUnload);
    });

    it('does not tie a forever to a loading section when an outside handler starts it', async function () {
      let ticks = 0;
      let stopped = false;
      flock.onEvent('sectionTestOutsideEvent', () => {
        flock.forever(() => {
          if (!stopped) ticks++;
        });
      });

      async function section() {
        await new Promise((r) => setTimeout(r, 300));
      }

      setTimeout(() => flock.broadcastEvent('sectionTestOutsideEvent'), 100);
      await flock.loadSection(section);
      flock.unloadSection(section);

      const ticksAtUnload = ticks;
      await new Promise((r) => setTimeout(r, 200));
      stopped = true;

      expect(ticks).to.be.above(ticksAtUnload);
    });

    it('stops a when-clicked (onTrigger) handler started inside the section when it unloads', async function () {
      const boxId = 'sectionTestBoxClick';
      boxIds.push(boxId);
      // Mesh created outside the section, isolating that unload removes the
      // handler itself, not just the mesh.
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      let clicks = 0;
      async function section() {
        flock.onTrigger(boxId, {
          trigger: 'OnPickTrigger',
          callback: () => {
            clicks++;
          },
        });
      }

      await flock.loadSection(section);
      // onTrigger resolves via whenModelReady, asynchronously.
      await new Promise((r) => setTimeout(r, 50));

      const mesh = flock.scene.getMeshByName(boxId);
      mesh.actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      expect(clicks).to.equal(1);

      flock.unloadSection(section);
      await new Promise((r) => setTimeout(r, 50));

      mesh.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      expect(clicks).to.equal(1);
    });

    it('never attaches an onTrigger handler whose section unloaded before the mesh became ready', async function () {
      const boxId = 'sectionTestLateTriggerBox';
      boxIds.push(boxId);

      let clicks = 0;
      async function section() {
        // Mesh doesn't exist yet, so this registers as a pending trigger.
        flock.onTrigger(boxId, {
          trigger: 'OnPickTrigger',
          callback: () => {
            clicks++;
          },
        });
      }

      await flock.loadSection(section);
      flock.unloadSection(section);

      // Creating the mesh now replays the pending trigger, late, against an
      // already-aborted section signal - it should never actually attach.
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await new Promise((r) => setTimeout(r, 50));

      const mesh = flock.scene.getMeshByName(boxId);
      mesh.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      expect(clicks).to.equal(0);
    });

    it('stops an onEvent subscription started inside the section when it unloads', async function () {
      let count = 0;
      async function section() {
        flock.onEvent('sectionTestCustomEvent', () => {
          count++;
        });
      }

      await flock.loadSection(section);
      flock.broadcastEvent('sectionTestCustomEvent');
      expect(count).to.equal(1);

      flock.unloadSection(section);
      flock.broadcastEvent('sectionTestCustomEvent');
      expect(count).to.equal(1);
    });

    // No automated test for stopping an ambient sound or note sequence on
    // unload: it triggers flock.ensureAudio()'s pre-existing unawaited-promise
    // race, destabilising later suites (e.g. xr.test.js). Same flock.onStop
    // mechanism as the onEvent/forever/onTrigger tests above.

    it('disposes a UIButton owned by the section when it unloads, leaving others', async function () {
      const insideId = 'sectionTestButtonInside';
      const outsideId = 'sectionTestButtonOutside';

      flock.UIButton({ text: 'Outside', x: 0, y: 0, width: 'SMALL', buttonId: outsideId });

      async function section() {
        flock.UIButton({ text: 'Inside', x: 0, y: 40, width: 'SMALL', buttonId: insideId });
      }
      await flock.loadSection(section);

      expect(flock.scene.UITexture.getControlByName(insideId)).to.exist;
      expect(flock.scene.UITexture.getControlByName(outsideId)).to.exist;

      flock.unloadSection(section);

      expect(flock.scene.UITexture.getControlByName(insideId)).to.not.exist;
      expect(flock.scene.UITexture.getControlByName(outsideId)).to.exist;

      flock.scene.UITexture.getControlByName(outsideId)?.dispose();
    });

    it('stops a looping animation group started inside the section, on a mesh it does not own', async function () {
      const boxId = 'sectionTestAnimBox';
      boxIds.push(boxId);
      // Mesh created outside the section, isolating that unload stops the
      // group itself, not just the mesh.
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      async function section() {
        await flock.createAnimation('sectionTestAnimGroup', boxId, {
          property: 'rotation.y',
          keyframes: [
            { duration: 0, value: 0 },
            { duration: 1, value: 360 },
          ],
          loop: true,
          mode: 'START',
        });
      }

      await flock.loadSection(section);

      const animGroup = flock.scene.getAnimationGroupByName('sectionTestAnimGroup');
      expect(animGroup).to.exist;
      expect(animGroup.isPlaying).to.be.true;

      flock.unloadSection(section);

      expect(flock.scene.getAnimationGroupByName('sectionTestAnimGroup')).to.not.exist;
      expect(flock.meshExists(boxId)).to.be.true;
    });

    it('meshes created outside any section are unaffected by an unload', async function () {
      const boxIdOutside = 'sectionTestBoxOutside';
      const boxIdInside = 'sectionTestBoxInside';
      boxIds.push(boxIdOutside, boxIdInside);

      await flock.createBox(boxIdOutside, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      async function section() {
        await flock.createBox(boxIdInside, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }
      await flock.loadSection(section);
      flock.unloadSection(section);

      expect(flock.meshExists(boxIdOutside)).to.be.true;
      expect(flock.meshExists(boxIdInside)).to.be.false;
    });

    it('unloading a section also unloads a section it loaded during its own load', async function () {
      const outerBox = 'sectionTestOuterBox';
      const innerBox = 'sectionTestInnerBox';
      boxIds.push(outerBox, innerBox);

      async function inner() {
        await flock.createBox(innerBox, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      }
      async function outer() {
        await flock.createBox(outerBox, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
        await flock.loadSection(inner);
      }

      await flock.loadSection(outer);
      expect(flock.meshExists(innerBox)).to.be.true;

      flock.unloadSection(outer);

      expect(flock.meshExists(outerBox)).to.be.false;
      expect(flock.meshExists(innerBox)).to.be.false;
      expect(flock._loadedSections.has(inner)).to.be.false;
    });

    it('a switch from a section-owned click handler still loads the target section', async function () {
      const boxId = 'sectionTestSwitchButton';
      const targetBox = 'sectionTestSwitchTarget';
      boxIds.push(boxId, targetBox);
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      async function level2() {
        await new Promise((r) => setTimeout(r, 20));
        await flock.createBox(targetBox, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
      }
      let switched;
      async function level1() {
        flock.onTrigger(boxId, {
          trigger: 'OnPickTrigger',
          callback: () => {
            switched = flock.switchSection(level2);
          },
        });
      }

      await flock.loadSection(level1);
      await new Promise((r) => setTimeout(r, 50));
      flock.scene
        .getMeshByName(boxId)
        .actionManager.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger);
      await switched;

      expect(flock._loadedSections.has(level1)).to.be.false;
      expect(flock.meshExists(targetBox)).to.be.true;
      expect(flock._currentSection).to.equal(null);

      flock.unloadSection(level2);
      expect(flock.meshExists(targetBox)).to.be.false;
    });

    it('removes a collision (onIntersect) handler registered inside the section when it unloads', async function () {
      const boxA = 'sectionTestIntersectA';
      const boxB = 'sectionTestIntersectB';
      boxIds.push(boxA, boxB);
      await flock.createBox(boxA, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
      await flock.createBox(boxB, { width: 1, height: 1, depth: 1, position: [10, 0, 0] });

      const enter = flock.BABYLON.ActionManager.OnIntersectionEnterTrigger;
      const intersectActions = () =>
        (flock.scene.getMeshByName(boxA).actionManager?.actions ?? []).filter(
          (action) => action.trigger === enter
        ).length;

      async function section() {
        await flock.onIntersect(boxA, boxB, {
          trigger: 'OnIntersectionEnterTrigger',
          callback: () => {},
        });
      }

      await flock.loadSection(section);
      expect(intersectActions()).to.equal(1);

      flock.unloadSection(section);
      expect(intersectActions()).to.equal(0);
    });

    it('disposes a particle effect started inside the section on a mesh it does not own', async function () {
      const boxId = 'sectionTestEmitter';
      boxIds.push(boxId);
      await flock.createBox(boxId, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });

      const options = {
        emitterMesh: boxId,
        emitRate: 10,
        colors: { start: '#FFFFFF', end: '#000000' },
        alphas: { start: 1, end: 1 },
        sizes: { start: 0.1, end: 1 },
        lifetime: { min: 1, max: 5 },
        shape: 'Point',
        gravity: false,
        direction: { x: 0, y: 0, z: 0 },
        rotation: {
          angularSpeed: { min: 0, max: 0 },
          initialRotation: { min: 0, max: 0 },
        },
      };
      async function section() {
        flock.createParticleEffect('sectionTestSparks', options);
      }

      await flock.loadSection(section);
      const system = await flock.modelReadyPromises.get(
        [...flock.modelReadyPromises.keys()].find((key) => key.startsWith('sectionTestSparks'))
      );
      expect(system).to.exist;
      expect(flock.scene.particleSystems).to.include(system);

      flock.unloadSection(section);

      expect(flock.scene.particleSystems).to.not.include(system);
      expect(flock.meshExists(boxId)).to.be.true;
    });
  });

  describe('Section-started motion @sections', function () {
    const boxIds = [];
    const makeBox = async (id, x = 0) => {
      boxIds.push(id);
      await flock.createBox(id, { width: 1, height: 1, depth: 1, position: [x, 0, 0] });
      return flock.scene.getMeshByName(id);
    };

    afterEach(function () {
      boxIds.forEach((id) => flock.scene.getMeshByName?.(id)?.dispose());
      boxIds.length = 0;
    });

    it('stops a follow started inside the section on meshes it does not own', async function () {
      const lead = await makeBox('sectionTestLead');
      const tail = await makeBox('sectionTestTail', 5);

      async function section() {
        await flock.makeFollow('sectionTestTail', 'sectionTestLead', 'at');
      }
      await flock.loadSection(section);
      expect(tail._followObserver).to.exist;

      flock.unloadSection(section);
      expect(tail._followObserver).to.not.exist;

      lead.position.x = 20;
      await new Promise((r) => setTimeout(r, 100));
      expect(tail.position.x).to.be.below(10);
    });

    it('leaves a follow started outside any section running when a section unloads', async function () {
      await makeBox('sectionTestLeadOutside');
      const tail = await makeBox('sectionTestTailOutside', 5);
      await flock.makeFollow('sectionTestTailOutside', 'sectionTestLeadOutside', 'at');

      async function section() {}
      await flock.loadSection(section);
      flock.unloadSection(section);

      expect(tail._followObserver).to.exist;
      await flock.stopFollow('sectionTestTailOutside');
    });

    it('returns to the default camera when a section that attached the camera unloads', async function () {
      const player = await makeBox('sectionTestCameraPlayer');

      let cameraName;
      async function section() {
        cameraName = await flock.attachCamera('sectionTestCameraPlayer', { name: 'sectionTestCam' });
      }
      await flock.loadSection(section);
      const attached = flock.scene.getCameraByName(cameraName);
      expect(attached?.metadata?.following).to.equal(player);
      expect(flock.scene.activeCamera).to.equal(attached);

      flock.unloadSection(section);

      expect(attached.isDisposed()).to.be.true;
      expect(flock.scene.activeCamera).to.equal(flock.defaultCamera);
      expect(flock.mainCamera).to.equal(flock.defaultCamera);
    });

    it('stops a glide started inside the section, leaving the mesh where it is', async function () {
      const mesh = await makeBox('sectionTestGlider');

      async function section() {
        flock.glideTo('sectionTestGlider', { x: 10, y: 0, z: 0, duration: 2 });
      }
      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 300));
      expect(mesh.metadata._activeGlide).to.exist;

      flock.unloadSection(section);
      const stoppedAt = mesh.position.x;
      await new Promise((r) => setTimeout(r, 200));

      expect(mesh.metadata._activeGlide).to.not.exist;
      expect(mesh.position.x).to.be.closeTo(stoppedAt, 1e-6);
      expect(stoppedAt).to.be.below(10);
    });

    it('stops a glide to an object started inside the section', async function () {
      const mesh = await makeBox('sectionTestGliderToObject');
      await makeBox('sectionTestGlideGoal', 10);

      async function section() {
        flock.glideToObject('sectionTestGliderToObject', 'sectionTestGlideGoal', { duration: 2 });
      }
      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 300));
      expect(mesh.metadata._activeGlide).to.exist;

      flock.unloadSection(section);
      expect(mesh.metadata._activeGlide).to.not.exist;
    });

    it('stops a rotation started inside the section', async function () {
      const mesh = await makeBox('sectionTestRotator');

      async function section() {
        flock.rotateAnim('sectionTestRotator', { y: 90, duration: 2 });
      }
      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 300));
      expect(mesh.metadata._activeRotate).to.exist;

      flock.unloadSection(section);
      expect(mesh.metadata._activeRotate).to.not.exist;
    });

    it('stops a looping keyframe animation started inside the section', async function () {
      const mesh = await makeBox('sectionTestKeyframes');

      async function section() {
        flock.animateKeyFrames('sectionTestKeyframes', {
          property: 'position',
          loop: true,
          keyframes: [
            { value: { x: 0, y: 0, z: 0 }, duration: 1 },
            { value: { x: 5, y: 0, z: 0 }, duration: 1 },
          ],
        });
      }
      await flock.loadSection(section);
      await new Promise((r) => setTimeout(r, 200));
      expect(mesh.metadata._activeAnim_position).to.exist;

      flock.unloadSection(section);
      expect(mesh.metadata._activeAnim_position).to.not.exist;
    });
  });

  describe('Section generators @sections', function () {
    before(function () {
      if (!Blockly.Blocks['section']) defineBlocks();
      if (!javascriptGenerator.forBlock['section']) defineGenerators();
    });

    it('loads a nested autostart section directly, not through the queue', function () {
      const workspace = new Blockly.Workspace();
      try {
        const append = (state) => Blockly.serialization.blocks.append(state, workspace);
        append({ type: 'section', id: 'inner', fields: { NAME: 'inner', START: 'TRUE' } });
        append({
          type: 'section',
          id: 'outer',
          fields: { NAME: 'outer', START: 'TRUE' },
          extraState: { contains: ['inner'] },
        });

        const code = generateWorkspaceCode(workspace, javascriptGenerator);

        expect(code).to.include('await loadSection(inner);');
        expect(code).to.include('await loadSectionQueued(outer);');
        expect(code).to.not.include('loadSectionQueued(inner)');
      } finally {
        workspace.dispose();
      }
    });
  });
}
