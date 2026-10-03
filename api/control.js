let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockControl = {
  /* 
		  Category: Control
  */

  wait(duration) {
    const ms =
      Number.isFinite(Number(duration)) && Number(duration) >= 0
        ? Math.min(Number(duration) * 1000, 2147483647)
        : 0;
    const signal = flock.abortController?.signal;
    const doc = typeof document !== 'undefined' ? document : null;
    return new Promise((resolve, reject) => {
      // Reject (not resolve) on abort so cooperative loops stop on Stop.
      if (signal?.aborted) {
        reject(flock.makeAbortError());
        return;
      }

      let remaining = ms;
      let startedAt = 0;
      let running = false;
      let timeoutId = null;

      const cleanup = () => {
        running = false;
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        doc?.removeEventListener('visibilitychange', onVisibility);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        reject(flock.makeAbortError());
      };
      const arm = () => {
        startedAt = performance.now();
        running = true;
        timeoutId = setTimeout(finish, remaining);
      };
      // Pause the countdown while the tab is hidden and resume with the
      // time that was left, so background time is not spent waiting.
      const onVisibility = () => {
        if (doc.hidden) {
          if (!running) return;
          running = false;
          clearTimeout(timeoutId);
          remaining = Math.max(0, remaining - (performance.now() - startedAt));
        } else if (!running) {
          arm();
        }
      };

      signal?.addEventListener('abort', onAbort);
      doc?.addEventListener('visibilitychange', onVisibility);
      if (!doc?.hidden) arm();
    });
  },
  makeAbortError() {
    const err = new Error('Run stopped');
    err.name = 'AbortError';
    return err;
  },
  waitUntil(conditionFunc) {
    if (typeof conditionFunc !== 'function') {
      console.warn('waitUntil: conditionFunc must be a function');
      return Promise.resolve();
    }
    const signal = flock.abortController?.signal;
    return new Promise((resolve, reject) => {
      // Reject on abort (like wait) so a condition-wait loop stops on Stop.
      if (signal?.aborted) {
        reject(flock.makeAbortError());
        return;
      }

      const checkCondition = () => {
        if (signal?.aborted) {
          flock.scene?.onBeforeRenderObservable?.remove(observer);
          reject(flock.makeAbortError());
          return;
        }
        try {
          if (conditionFunc()) {
            flock.scene.onBeforeRenderObservable.remove(observer);
            resolve();
          }
        } catch (error) {
          flock.scene.onBeforeRenderObservable.remove(observer);
          reject(error);
        }
      };
      const observer = flock.scene.onBeforeRenderObservable.add(checkCondition);

      signal?.addEventListener(
        'abort',
        () => {
          flock.scene?.onBeforeRenderObservable?.remove(observer);
          reject(flock.makeAbortError());
        },
        { once: true }
      );
    });
  },
  createTag(tagName) {
    if (typeof tagName !== 'string' || !tagName) {
      console.warn('createTag: tagName must be a non-empty string');
      return null;
    }
    for (const [name, rec] of flock._nameRegistry) {
      if (rec.tag && rec.tagName === tagName) return name;
    }
    const families = new Set([
      ...[...flock._nameRegistry.values()].map((rec) => rec.family),
      ...(flock.scene?.meshes ?? []).map((mesh) => flock._familyOf(mesh.name)),
    ]);
    const used = (name) =>
      flock._nameRegistry.has(name) || !!flock.scene?.getMeshByName(name) || families.has(name);
    let tag = tagName;
    while (used(tag)) {
      tag = `${tagName}_${flock.scene.getUniqueId()}`;
    }
    flock._nameRegistry.set(tag, { pending: false, exists: true, family: tag, tag: true, tagName });
    return tag;
  },
  tagObject(meshNames, tag) {
    if (!flock._isTag(tag)) {
      flock.reportBlockError({ key: 'tag_not_found', api: 'tagObject', values: { tag } });
      return Promise.resolve();
    }
    const names = [meshNames].flat(Infinity).filter((name) => name != null);
    return Promise.all(
      names.map((meshName) =>
        flock.whenModelReady(meshName, (mesh) => {
          if (!flock.requireMesh(mesh, { api: 'tagObject', name: meshName })) return;
          mesh.metadata ??= {};
          mesh.metadata.tags ??= [];
          if (mesh.metadata.tags.includes(tag)) return;
          mesh.metadata.tags.push(tag);
          flock._applyGroupHandlers(mesh.name, tag);
        })
      )
    );
  },
  getObjectsWithTag(tag) {
    return (flock.scene?.meshes ?? [])
      .filter((mesh) => !mesh.isDisposed() && mesh.metadata?.tags?.includes(tag))
      .map((mesh) => mesh.name);
  },
};
