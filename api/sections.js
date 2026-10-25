let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockSections = {
  // Keyed by the section's own function, not its name, so state self-clears
  // via GC and never has to touch user-authored text.
  _sections: new WeakMap(),

  // Strong-reference Set (unlike _sections) so switchSection/unloadAllSections
  // can enumerate loaded sections. Reset per run in flock.js.
  _loadedSections: new Set(),

  // Serializes independent load/switch/unload calls - see loadSectionQueued.
  // Reset per run in flock.js.
  _loadQueueTail: Promise.resolve(),

  // No-op if already loaded, matching Unity's SceneManager. _currentSection
  // is only safe because loadSectionQueued keeps independent calls from
  // overlapping - see there.
  async loadSection(fn) {
    if (typeof fn !== 'function') return;

    let section = flock._sections.get(fn);
    if (!section) {
      section = { loaded: false, controller: null };
      flock._sections.set(fn, section);
    }
    if (section.loaded) return;

    const parentSignal = flock.abortController?.signal;
    if (parentSignal?.aborted) return;

    const controller = new AbortController();
    parentSignal?.addEventListener('abort', () => controller.abort(), { once: true });

    section.loaded = true;
    section.controller = controller;
    flock._loadedSections.add(fn);

    // Entity-creating APIs read this synchronously to stamp sectionOwner.
    // Save/restore rather than a stack, so a section loading another section
    // nests correctly.
    const previousSection = flock._currentSection;
    flock._currentSection = fn;
    try {
      await fn();
    } catch (err) {
      // unloadSection, not a manual reset, so anything fn() partially
      // created before throwing gets swept too.
      flock.unloadSection(fn);
      throw err;
    } finally {
      flock._currentSection = previousSection;
    }
  },

  // Abort signal for a section's background work (loops, subscriptions,
  // timers). Defaults to the currently-loading section; pass one explicitly
  // when registration completes asynchronously, after that section has
  // finished loading.
  sectionSignal(fn = flock._currentSection) {
    if (!fn) return null;
    return flock._sections.get(fn)?.controller?.signal ?? null;
  },

  // Runs `cleanup` once, on whichever comes first: the whole run stopping, or
  // that section unloading. Takes a signal, not a section fn - capture
  // sectionSignal() up front if registration completes after a real await, or
  // a late lookup by fn could miss an unload or land on a reload's signal.
  // Use onSectionStop instead for entities scene teardown already handles.
  onStop(cleanup, signal = flock.sectionSignal()) {
    let called = false;
    const masterSignal = flock.abortController?.signal;
    // Detach from both on whichever fires first, or the other keeps this
    // closure alive on the master signal for the rest of the run.
    const run = () => {
      if (called) return;
      called = true;
      masterSignal?.removeEventListener('abort', run);
      signal?.removeEventListener('abort', run);
      cleanup();
    };
    if (masterSignal?.aborted || signal?.aborted) {
      run();
      return;
    }
    masterSignal?.addEventListener('abort', run, { once: true });
    signal?.addEventListener('abort', run, { once: true });
  },

  // Like onStop, but section-only - for cleanup (e.g. onTrigger's actions)
  // that scene teardown already handles on a full stop.
  onSectionStop(cleanup, signal) {
    if (!signal) return;
    if (signal.aborted) {
      cleanup();
      return;
    }
    signal.addEventListener('abort', cleanup, { once: true });
  },

  // Meshes, animation groups, and GUI controls are swept here by sectionOwner;
  // everything else registered its own cleanup via sectionSignal()/onStop().
  unloadSection(fn) {
    const section = flock._sections.get(fn);
    if (!section || !section.loaded) return;

    // Left aborted, not nulled - a late cleanup registration that already
    // holds this signal (see onStop) still needs to read it as aborted.
    section.controller?.abort();
    section.loaded = false;
    flock._loadedSections.delete(fn);

    flock.scene?.meshes
      ?.slice()
      .filter((mesh) => mesh.metadata?.sectionOwner === fn)
      .forEach((mesh) => flock.disposeMesh(mesh));

    // Animation groups (createAnimation) live in their own collection,
    // independent of any mesh, so they need their own sweep.
    flock.scene?.animationGroups
      ?.slice()
      .filter((animationGroup) => animationGroup.sectionOwner === fn)
      .forEach((animationGroup) => {
        animationGroup.stop();
        animationGroup.dispose();
      });

    // GUI controls aren't in scene.meshes either. Disposing a container (e.g.
    // UIText's background rectangle) disposes its children too, so only
    // top-level controls need tagging.
    const uiTexture = flock.scene?.UITexture;
    const uiRoot = uiTexture?._rootContainer ?? uiTexture?.rootContainer;
    const getDescendants =
      uiTexture?.getDescendants?.bind(uiTexture) ?? uiRoot?.getDescendants?.bind(uiRoot);
    if (getDescendants) {
      getDescendants(false)
        .filter((control) => control.sectionOwner === fn)
        .forEach((control) => control.dispose());
    }
  },

  // Exclusive, Unity-style switch: unload every other loaded section, then load this one.
  async switchSection(fn) {
    if (typeof fn !== 'function') return;
    for (const other of Array.from(flock._loadedSections)) {
      if (other !== fn) flock.unloadSection(other);
    }
    await flock.loadSection(fn);
  },

  // What "switch" to no target reduces to: unload everything, load nothing.
  unloadAllSections() {
    for (const fn of Array.from(flock._loadedSections)) {
      flock.unloadSection(fn);
    }
  },

  // Runs `task` once whatever's ahead of it in the chain has settled (either
  // way), so only one independent load/switch/unload actually runs at a time.
  _runQueued(task) {
    const myTurn = flock._loadQueueTail.then(task, task);
    flock._loadQueueTail = myTurn.catch(() => {});
    return myTurn;
  },

  // For a load/switch/unload codegen determined is NOT nested directly
  // inside another section's own body - queued so it can't run while an
  // unrelated load is still mid-flight (an unqueued unload could mark a
  // still-loading section unloaded while its fn() keeps creating owned
  // resources no later unload would ever sweep). A direct child of a section
  // calls loadSection/switchSection/unloadSection instead, skipping the
  // queue - already sequential with its parent, and queueing would deadlock
  // against that same still-in-progress load.
  loadSectionQueued(fn) {
    return flock._runQueued(() => flock.loadSection(fn));
  },
  switchSectionQueued(fn) {
    return flock._runQueued(() => flock.switchSection(fn));
  },
  unloadSectionQueued(fn) {
    return flock._runQueued(() => flock.unloadSection(fn));
  },
  unloadAllSectionsQueued() {
    return flock._runQueued(() => flock.unloadAllSections());
  },
};
