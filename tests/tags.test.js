import { expect } from 'chai';

export function runTagsTests(flock) {
  describe('Tags @tags', function () {
    const meshIds = [];

    const box = (id, x = 0) =>
      flock.createBox(id, { width: 1, height: 1, depth: 1, position: [x, 0, 0] });
    const pick = (name) => {
      const mesh = flock.scene.getMeshByName(name);
      mesh?.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnPickTrigger, {
        source: mesh,
        meshUnderPointer: mesh,
      });
    };
    const enter = (name, otherName) =>
      flock.scene
        .getMeshByName(name)
        ?.actionManager?.processTrigger(flock.BABYLON.ActionManager.OnIntersectionEnterTrigger, {
          mesh: flock.scene.getMeshByName(otherName),
        });
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    afterEach(async function () {
      for (const id of [...meshIds].reverse()) {
        await flock.dispose(id);
      }
      meshIds.length = 0;
    });

    it('works when handlers are registered before the tag is created', async function () {
      const ground = await box('tagearlyground__b1');
      const ring = await box('tagearlyring__b2', 10);
      const ball = await box('tagearlyball__b3', 20);
      meshIds.push(ground, ring, ball);

      const picked = [];
      const hits = [];
      flock.onTrigger('tagearly', {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
        applyToGroup: true,
      });
      flock.onIntersect('tagearly', ground, {
        trigger: 'OnIntersectionEnterTrigger',
        applyToGroupOther: true,
        callback: (self) => hits.push(self),
      });
      flock.onIntersect(ball, 'tagearly', {
        trigger: 'OnIntersectionEnterTrigger',
        applyToGroupOther: true,
        callback: (_self, other) => hits.push(other),
      });

      const tag = flock.createTag('tagearly');
      expect(tag).to.equal('tagearly');
      await flock.tagObject(ring, tag);
      await tick();

      pick(ring);
      enter(ring, ground);
      enter(ball, ring);
      await tick();

      expect(picked).to.deep.equal([ring]);
      expect(hits).to.deep.equal([ring, ring]);
    });

    it('returns the same tag when created twice', function () {
      const first = flock.createTag('tagsame');
      const second = flock.createTag('tagsame');
      expect(first).to.equal('tagsame');
      expect(second).to.equal(first);
    });

    it('keeps mesh names clear of tag names', async function () {
      const tag = flock.createTag('tagclash');
      const mesh = await box('tagclash__b1');
      meshIds.push(mesh);
      expect(mesh).to.not.equal(tag);
    });

    it('suffixes a tag whose name an object already uses and keeps them apart', async function () {
      const mesh = await box('tagtaken__b1');
      const other = await box('tagtakenother__b2', 2);
      meshIds.push(mesh, other);

      const tag = flock.createTag(mesh);
      expect(tag).to.not.equal(mesh);
      expect(flock.createTag(mesh)).to.equal(tag);
      await flock.tagObject(other, tag);

      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
      });

      pick(mesh);
      pick(other);
      await tick();

      expect(picked).to.deep.equal([other]);
    });

    it('does not treat an object named like an existing tag as tagged', async function () {
      const tag = flock.createTag('tagfamily');
      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
      });

      const untagged = await box('tagfamily__b1');
      const tagged = await box('tagfamilyt__b2', 2);
      meshIds.push(untagged, tagged);
      await flock.tagObject(tagged, tag);

      pick(untagged);
      pick(tagged);
      await tick();

      expect(picked).to.deep.equal([tagged]);
      expect(flock.getObjectsWithTag(tag)).to.deep.equal([tagged]);
    });

    it('lists tagged objects in creation order', async function () {
      const tag = flock.createTag('taglist');
      const a = await box('taglista__b1');
      const b = await box('taglistb__b2', 2);
      const c = await box('taglistc__b3', 4);
      meshIds.push(a, b, c);

      await flock.tagObject(c, tag);
      await flock.tagObject(a, tag);
      await flock.tagObject(a, tag);

      expect(flock.getObjectsWithTag(tag)).to.deep.equal([a, c]);
    });

    it('tags every object in a list', async function () {
      const tag = flock.createTag('tagmany');
      const a = await box('tagmanya__b1');
      const b = await box('tagmanyb__b2', 2);
      const c = await box('tagmanyc__b3', 4);
      meshIds.push(a, b, c);

      await flock.tagObject([a, c], tag);

      expect(flock.getObjectsWithTag(tag)).to.deep.equal([a, c]);
    });

    it('fires a click handler on objects tagged before and after it', async function () {
      const tag = flock.createTag('tagclick');
      const early = await box('tagclicke__b1');
      const late = await box('tagclickl__b2', 2);
      const untagged = await box('tagclicku__b3', 4);
      meshIds.push(early, late, untagged);

      await flock.tagObject(early, tag);
      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
        applyToGroup: true,
      });
      await flock.tagObject(late, tag);

      pick(early);
      pick(late);
      pick(untagged);
      await tick();

      expect(picked).to.have.members([early, late]);
    });

    it('fires a nested click handler on every tagged object', async function () {
      const tag = flock.createTag('tagnested');
      const a = await box('tagnesteda__b1');
      const b = await box('tagnestedb__b2', 2);
      meshIds.push(a, b);
      await flock.tagObject(a, tag);
      await flock.tagObject(b, tag);

      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
      });

      pick(a);
      pick(b);
      await tick();

      expect(picked).to.have.members([a, b]);
    });

    it('gives clones their own copy of the tags', async function () {
      const tag = flock.createTag('tagclone');
      const other = flock.createTag('tagcloneother');
      const source = await box('tagclonesrc__b1');
      meshIds.push(source);
      await flock.tagObject(source, tag);

      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
        applyToGroup: true,
      });

      const cloneName = flock.cloneMesh({ sourceMeshName: source, cloneId: 'tagclonecopy__1' });
      const clone = await flock.whenModelReady(cloneName);
      meshIds.push(clone.name);
      await flock.tagObject(clone.name, other);

      pick(clone.name);
      await tick();

      expect(picked).to.deep.equal([clone.name]);
      expect(flock.getObjectsWithTag(other)).to.deep.equal([clone.name]);
    });

    it('copies the tags of a cloned child and applies its handlers', async function () {
      const tag = flock.createTag('tagchild');
      const other = flock.createTag('tagchildother');
      const parent = await box('tagchildparent__b1');
      const child = await box('tagchildchild__b2', 2);
      meshIds.push(child, parent);
      await flock.parentChild(parent, child, 2, 0, 0);
      await flock.tagObject(child, tag);

      const picked = [];
      flock.onTrigger(tag, {
        trigger: 'OnPickTrigger',
        callback: (name) => picked.push(name),
      });

      const cloneName = flock.cloneMesh({ sourceMeshName: parent, cloneId: 'tagchildcopy__1' });
      const clone = await flock.whenModelReady(cloneName);
      meshIds.push(clone.name);
      const clonedChild = clone.getDescendants(false).find((node) => node.metadata?.tags);
      expect(clonedChild).to.exist;
      await flock.tagObject(clonedChild.name, other);

      pick(clonedChild.name);
      await tick();

      expect(picked).to.deep.equal([clonedChild.name]);
      expect(flock.getObjectsWithTag(other)).to.deep.equal([clonedChild.name]);
      expect(flock.getObjectsWithTag(tag)).to.have.members([child, clonedChild.name]);
    });

    it('does not tag the children of mirrored copies', async function () {
      const tag = flock.createTag('tagmirrorchild');
      const parent = await box('tagmirrorparent__b1');
      const child = await box('tagmirrorkid__b2', 2);
      meshIds.push(child, parent);
      await flock.parentChild(parent, child, 2, 0, 0);
      await flock.tagObject(child, tag);

      const mirrorName = flock.mirror(parent, { mirrorId: 'tagmirrorparentcopy__b3', axis: 'x' });
      const mirrored = await flock.whenModelReady(mirrorName);
      meshIds.push(mirrored.name);

      expect(flock.getObjectsWithTag(tag)).to.deep.equal([child]);
    });

    it('does not tag mirrored copies', async function () {
      const tag = flock.createTag('tagmirror');
      const source = await box('tagmirrorsrc__b1');
      meshIds.push(source);
      await flock.tagObject(source, tag);

      const mirrorName = flock.mirror(source, { mirrorId: 'tagmirrorcopy__b2', axis: 'x' });
      const mirrored = await flock.whenModelReady(mirrorName);
      meshIds.push(mirrored.name);

      expect(flock.getObjectsWithTag(tag)).to.deep.equal([source]);
    });

    it('fires a collision handler with a tag as the other object', async function () {
      const tag = flock.createTag('tagother');
      const ball = await box('tagotherball__b1');
      const a = await box('tagothera__b2', 10);
      const b = await box('tagotherb__b3', 20);
      meshIds.push(ball, a, b);
      await flock.tagObject(a, tag);

      const hits = [];
      await flock.onIntersect(ball, tag, {
        trigger: 'OnIntersectionEnterTrigger',
        callback: (_self, other) => hits.push(other),
      });
      await flock.tagObject(b, tag);

      enter(ball, a);
      enter(ball, b);

      expect(hits).to.have.members([a, b]);
    });

    it('fires a collision handler with a tag as the first object', async function () {
      const tag = flock.createTag('tagself');
      const ground = await box('tagselfground__b1');
      const a = await box('tagselfa__b2', 10);
      const b = await box('tagselfb__b3', 20);
      meshIds.push(ground, a, b);
      await flock.tagObject(a, tag);

      const hits = [];
      await flock.onIntersect(tag, ground, {
        trigger: 'OnIntersectionEnterTrigger',
        applyToGroupOther: true,
        callback: (self) => hits.push(self),
      });
      await flock.tagObject(b, tag);

      enter(a, ground);
      enter(b, ground);

      expect(hits).to.have.members([a, b]);
    });

    it('fires a collision handler between objects with the same tag', async function () {
      const tag = flock.createTag('tagpair');
      const a = await box('tagpaira__b1');
      const b = await box('tagpairb__b2', 10);
      const untagged = await box('tagpairu__b3', 20);
      meshIds.push(a, b, untagged);
      await flock.tagObject(a, tag);

      let count = 0;
      await flock.onIntersect(tag, tag, {
        trigger: 'OnIntersectionEnterTrigger',
        applyToGroupSelf: true,
        callback: () => count++,
      });
      await flock.tagObject(b, tag);

      enter(a, b);
      enter(b, a);
      enter(a, untagged);

      expect(count).to.equal(1);
    });
  });
}
