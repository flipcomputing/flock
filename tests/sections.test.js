import { expect } from 'chai';

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
  });
}
