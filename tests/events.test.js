import { expect } from "chai";

export function runEventsTests(flock) {
  describe("Events API @events", function () {
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
          // ignore
        }
      });
      meshIds.length = 0;
    });

    // -------------------------------------------------------------------------
    describe("isAllowedEventName", function () {
      it("returns false for empty string", function () {
        expect(flock.isAllowedEventName("")).to.be.false;
      });

      it("returns false for non-string input", function () {
        expect(flock.isAllowedEventName(null)).to.be.false;
        expect(flock.isAllowedEventName(42)).to.be.false;
      });

      it("returns false for name longer than 30 characters", function () {
        expect(flock.isAllowedEventName("a".repeat(31))).to.be.false;
      });

      it("returns false for reserved prefixes", function () {
        expect(flock.isAllowedEventName("onSomething")).to.be.false;
        expect(flock.isAllowedEventName("systemEvent")).to.be.false;
        expect(flock.isAllowedEventName("internalMsg")).to.be.false;
        expect(flock.isAllowedEventName("babylonTick")).to.be.false;
        expect(flock.isAllowedEventName("flockReady")).to.be.false;
        expect(flock.isAllowedEventName("_hidden")).to.be.false;
      });

      it("returns false for disallowed characters", function () {
        expect(flock.isAllowedEventName("hello!")).to.be.false;
        expect(flock.isAllowedEventName("say@world")).to.be.false;
      });

      it("returns true for a valid plain name", function () {
        expect(flock.isAllowedEventName("jump")).to.be.true;
        expect(flock.isAllowedEventName("collect coin")).to.be.true;
      });

      it("returns true for a name with emoji", function () {
        expect(flock.isAllowedEventName("🎉party")).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe("sanitizeEventName", function () {
      it("removes disallowed characters", function () {
        expect(flock.sanitizeEventName("hello!")).to.equal("hello");
        expect(flock.sanitizeEventName("say@world")).to.equal("sayworld");
      });

      it("truncates to 50 characters", function () {
        const long = "a".repeat(60);
        expect(flock.sanitizeEventName(long)).to.have.lengthOf(50);
      });

      it("returns empty string for non-string input", function () {
        expect(flock.sanitizeEventName(null)).to.equal("");
        expect(flock.sanitizeEventName(123)).to.equal("");
      });

      it("preserves emoji and spaces", function () {
        expect(flock.sanitizeEventName("🎉 party time")).to.equal(
          "🎉 party time",
        );
      });
    });

    // -------------------------------------------------------------------------
    describe("onEvent and broadcastEvent", function () {
      it("calls handler when matching event is broadcast", function () {
        let called = false;
        flock.onEvent("pickup", () => {
          called = true;
        });
        flock.broadcastEvent("pickup");
        expect(called).to.be.true;
      });

      it("does not call handler when a different event is broadcast", function () {
        let called = false;
        flock.onEvent("pickup", () => {
          called = true;
        });
        flock.broadcastEvent("drop");
        expect(called).to.be.false;
      });

      it("calls all handlers when multiple are registered for the same event", function () {
        // Simulates several meshes each independently listening to the same event
        let countA = 0;
        let countB = 0;
        let countC = 0;
        flock.onEvent("collect", () => countA++);
        flock.onEvent("collect", () => countB++);
        flock.onEvent("collect", () => countC++);
        flock.broadcastEvent("collect");
        expect(countA).to.equal(1);
        expect(countB).to.equal(1);
        expect(countC).to.equal(1);
      });

      it("calls handler with data passed to broadcastEvent", function () {
        let received = null;
        flock.onEvent("score", (data) => {
          received = data;
        });
        flock.broadcastEvent("score", 42);
        expect(received).to.equal(42);
      });

      it("fires handler exactly once when once=true", function () {
        let count = 0;
        flock.onEvent(
          "ping",
          () => {
            count++;
          },
          true,
        );
        flock.broadcastEvent("ping");
        flock.broadcastEvent("ping");
        flock.broadcastEvent("ping");
        expect(count).to.equal(1);
      });

      it("silently rejects broadcastEvent with reserved event name", function () {
        let called = false;
        // Cannot register on reserved name, so just verify broadcast doesn't throw
        expect(() => flock.broadcastEvent("onSomething")).to.not.throw();
        expect(called).to.be.false;
      });

      it("warns and does not throw when handler is not a function", function () {
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(" "));
        try {
          expect(() => flock.onEvent("jump", "notAFunction")).to.not.throw();
        } finally {
          console.warn = originalWarn;
        }
        expect(warnings.some((w) => w.includes("handler must be a function"))).to
          .be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe("start", function () {
      it("calls action on the next render frame", async function () {
        let called = false;
        flock.start(() => {
          called = true;
        });
        await flock.wait(0.1);
        expect(called).to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe("forever @slow", function () {
      this.timeout(10000);

      it("calls action at least 3 times across render frames", async function () {
        let count = 0;
        flock.forever(async () => {
          count++;
        });
        await flock.wait(0.5);
        expect(count).to.be.at.least(3);
      });

      it("does not run action concurrently when action takes time", async function () {
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
    describe("whenKeyEvent", function () {
      it("calls callback when matching KEYDOWN key fires", function () {
        let called = false;
        flock.whenKeyEvent("x", () => {
          called = true;
        });
        flock.scene.onKeyboardObservable.notifyObservers({
          type: flock.BABYLON.KeyboardEventTypes.KEYDOWN,
          event: { key: "x" },
        });
        expect(called).to.be.true;
      });

      it("does not call callback for a different key", function () {
        let called = false;
        flock.whenKeyEvent("x", () => {
          called = true;
        });
        flock.scene.onKeyboardObservable.notifyObservers({
          type: flock.BABYLON.KeyboardEventTypes.KEYDOWN,
          event: { key: "z" },
        });
        expect(called).to.be.false;
      });

      it("fires on KEYUP when isReleased=true, not on KEYDOWN", function () {
        let downCalled = false;
        let upCalled = false;
        flock.whenKeyEvent(
          "m",
          () => {
            downCalled = true;
          },
          false,
        );
        flock.whenKeyEvent(
          "m",
          () => {
            upCalled = true;
          },
          true,
        );

        flock.scene.onKeyboardObservable.notifyObservers({
          type: flock.BABYLON.KeyboardEventTypes.KEYDOWN,
          event: { key: "m" },
        });
        expect(downCalled).to.be.true;
        expect(upCalled).to.be.false;

        flock.scene.onKeyboardObservable.notifyObservers({
          type: flock.BABYLON.KeyboardEventTypes.KEYUP,
          event: { key: "m" },
        });
        expect(upCalled).to.be.true;
      });

      it("warns and does not throw when callback is not a function", function () {
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(" "));
        try {
          expect(() => flock.whenKeyEvent("k", "notAFunction")).to.not.throw();
        } finally {
          console.warn = originalWarn;
        }
        expect(warnings.some((w) => w.includes("callback must be a function")))
          .to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe("whenActionEvent", function () {
      it("triggers callback when FORWARD action key 'w' is pressed", function () {
        let called = false;
        flock.whenActionEvent("FORWARD", () => {
          called = true;
        });
        flock.scene.onKeyboardObservable.notifyObservers({
          type: flock.BABYLON.KeyboardEventTypes.KEYDOWN,
          event: { key: "w" },
        });
        expect(called).to.be.true;
      });

      it("warns and does not throw when callback is not a function", function () {
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(" "));
        try {
          expect(() =>
            flock.whenActionEvent("FORWARD", "notAFunction"),
          ).to.not.throw();
        } finally {
          console.warn = originalWarn;
        }
        expect(warnings.some((w) => w.includes("callback must be a function")))
          .to.be.true;
      });
    });

    // -------------------------------------------------------------------------
    describe("onTrigger with applyToGroup @physics", function () {
      // Note: createBox("name__N") strips the __N suffix, creating a mesh
      // named "name". For separate meshes that share a group root, use single
      // underscore: "evtbox_1" and "evtbox_2" both have group root "evtbox"
      // (via getGroupRoot which splits on "_" when "__" is absent).

      it("registers trigger on all meshes sharing the same name prefix", async function () {
        const id1 = "evtbox_1";
        const id2 = "evtbox_2";
        await flock.createBox(id1, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        await flock.createBox(id2, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
        meshIds.push(id1, id2);

        const mesh1 = flock.scene.getMeshByName(id1);
        const mesh2 = flock.scene.getMeshByName(id2);
        expect(mesh1).to.exist;
        expect(mesh2).to.exist;

        let count = 0;
        flock.onTrigger(id1, {
          trigger: "OnPickTrigger",
          callback: () => count++,
          applyToGroup: true,
        });

        mesh1.actionManager.processTrigger(
          flock.BABYLON.ActionManager.OnPickTrigger,
        );
        mesh2.actionManager.processTrigger(
          flock.BABYLON.ActionManager.OnPickTrigger,
        );

        expect(count).to.equal(2);
      });

      it("registers trigger only on named mesh when applyToGroup is false", async function () {
        const id1 = "solobox_1";
        const id2 = "solobox_2";
        await flock.createBox(id1, { width: 1, height: 1, depth: 1, position: [0, 0, 0] });
        await flock.createBox(id2, { width: 1, height: 1, depth: 1, position: [2, 0, 0] });
        meshIds.push(id1, id2);

        const mesh1 = flock.scene.getMeshByName(id1);
        const mesh2 = flock.scene.getMeshByName(id2);
        expect(mesh1).to.exist;
        expect(mesh2).to.exist;

        let count = 0;
        flock.onTrigger(id1, {
          trigger: "OnPickTrigger",
          callback: () => count++,
          applyToGroup: false,
        });

        // Trigger the second mesh — should not fire since only id1 was registered
        mesh2.actionManager?.processTrigger(
          flock.BABYLON.ActionManager.OnPickTrigger,
        );

        expect(count).to.equal(0);
      });
    });
  });
}
