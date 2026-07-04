import { expect } from "chai";
import {
  MicrobitManager,
  VariableStatus,
  BoardState,
  setMicrobitManagerForTests,
} from "../../microbit/manager.js";
import { PROTOCOL_VERSION } from '../../microbit/protocol.js';
import { flockMicrobit } from "../../api/microbit.js";

// A fake usbTransport.js: the test drives serial lines in and records lines
// out. `onWrite` lets a test script the board's replies (e.g. answer the
// probe with HELLO).
class FakeTransport {
  constructor({ onWrite = null, connectImpl = null, usbSerialNumber } = {}) {
    this.written = [];
    this.flashed = [];
    this.disconnected = false;
    this.onWrite = onWrite;
    this.connectImpl = connectImpl;
    this.usbSerialNumber = usbSerialNumber;
    this._lineListeners = new Set();
    this._disconnectListeners = new Set();
  }

  async connect() {
    if (this.connectImpl) await this.connectImpl();
  }

  onLine(listener) {
    this._lineListeners.add(listener);
    return () => this._lineListeners.delete(listener);
  }

  onDisconnect(listener) {
    this._disconnectListeners.add(listener);
    return () => this._disconnectListeners.delete(listener);
  }

  async writeLine(line) {
    this.written.push(line);
    this.onWrite?.(line, this);
  }

  async flash(hexText, onProgress) {
    this.flashed.push(hexText);
    onProgress?.(50);
    onProgress?.(100);
  }

  async disconnect() {
    this.disconnected = true;
  }

  emitLine(line) {
    for (const listener of [...this._lineListeners]) listener(line);
  }

  emitDisconnect() {
    for (const listener of [...this._disconnectListeners]) listener();
  }
}

class FakeStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
}

// Board that answers the probe as a healthy Flock board.
function respondingTransport(deviceId, options = {}) {
  return new FakeTransport({
    ...options,
    onWrite: (line, transport) => {
      if (line === 'P\n') transport.emitLine(`HELLO flock ${PROTOCOL_VERSION} ${deviceId}`);
    },
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function runMicrobitManagerTests() {
  describe("micro:bit manager @microbit", function () {
    this.timeout(5000);

    function makeManager({ transports = [], storage, usb, ...rest } = {}) {
      let call = 0;
      const createCalls = [];
      const manager = new MicrobitManager({
        createTransport: async (options) => {
          createCalls.push(options);
          const transport = transports[call++];
          if (!transport) throw new Error("no more fake transports");
          return transport;
        },
        storage: storage ?? new FakeStorage(),
        usb: usb ?? null,
        fetchFirmware: async () => ":FAKEHEX",
        probeTimeoutMs: 20,
        heartbeatTimeoutMs: 60,
        ...rest,
      });
      manager.confirmFlash = () => Promise.resolve(false);
      manager._createCalls = createCalls;
      return manager;
    }

    describe("addMicrobit", function () {
      it("rejects invalid channels before updating the manager", function () {
        const manager = makeManager({ transports: [] });
        setMicrobitManagerForTests(manager);
        let warned = "";
        const originalWarn = console.warn;
        console.warn = (message) => {
          warned = message;
        };

        try {
          flockMicrobit.addMicrobit("microbit1", 9999);
          expect(manager.getVariableChannel("microbit1")).to.equal(1);
          expect(warned).to.equal(
            "addMicrobit: channel must be an integer between 0 and 255",
          );
        } finally {
          console.warn = originalWarn;
        }
      });
    });

    describe("connect flow", function () {
      it("binds a responding board: probe, channel, name scroll, persist", async function () {
        const storage = new FakeStorage();
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport], storage });
        const seenStates = [];
        manager.onStatusChange(() =>
          seenStates.push(manager.getStatusForVariable("microbit1").state),
        );

        await manager.bindFromPicker("microbit1");

        expect(manager.getStatusForVariable("microbit1")).to.deep.equal({
          state: VariableStatus.TETHERED,
        });
        expect(seenStates).to.include(VariableStatus.BUSY);
        expect(transport.written).to.deep.equal([
          "P\n",
          "G:1\n",
          "S:microbit1\n",
        ]);
        const stored = JSON.parse(storage.getItem("flockMicrobitBindings"));
        expect(stored["111"].variable).to.equal("microbit1");
        expect(manager._createCalls[0]).to.deep.equal({ silent: false });
      });

      it("reports connecting/probing as busy with the board state", async function () {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        const boardStates = [];
        manager.onStatusChange(() => {
          const status = manager.getStatusForVariable("microbit1");
          if (status.state === VariableStatus.BUSY) {
            boardStates.push(status.boardState);
          }
        });
        await manager.bindFromPicker("microbit1");
        expect(boardStates).to.include(BoardState.CONNECTING);
        expect(boardStates).to.include(BoardState.PROBING);
      });

      it("times out the probe, retries once, then asks before flashing; cancel disconnects", async function () {
        const transport = new FakeTransport(); // never answers
        const manager = makeManager({ transports: [transport] });
        let confirmations = 0;
        manager.confirmFlash = () => {
          confirmations++;
          return Promise.resolve(false);
        };

        await manager.bindFromPicker("microbit1");

        // Initial probe + one retry, nothing else.
        expect(transport.written).to.deep.equal(["P\n", "P\n"]);
        expect(confirmations).to.equal(1);
        expect(transport.flashed).to.deep.equal([]);
        expect(transport.disconnected).to.equal(true);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );
      });

      it("flashes after confirmation, reprobes, and binds", async function () {
        // Silent until flashed, then behaves like a Flock board.
        const transport = new FakeTransport({
          onWrite: (line, t) => {
            if (line === "P\n" && t.flashed.length > 0) {
              t.emitLine(`HELLO flock ${PROTOCOL_VERSION} 222`);
            }
          },
        });
        const manager = makeManager({ transports: [transport] });
        manager.confirmFlash = () => Promise.resolve(true);

        await manager.bindFromPicker("microbit1");

        expect(transport.flashed).to.deep.equal([":FAKEHEX"]);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
        expect(transport.written).to.include("S:microbit1\n");
      });

      it("binds via the spontaneous boot HELLO after flashing", async function () {
        // Never answers probes after the flash, but announces itself on
        // reboot — as the real board does. The boot HELLO arrives before the
        // post-flash probing starts.
        const transport = new FakeTransport();
        transport.flash = async function (hexText, onProgress) {
          this.flashed.push(hexText);
          onProgress?.(100);
          this.emitLine(`HELLO flock ${PROTOCOL_VERSION} 222`); // boot announcement
        };
        const manager = makeManager({ transports: [transport] });
        manager.confirmFlash = () => Promise.resolve(true);

        await manager.bindFromPicker("microbit1");

        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
        expect(manager.boundDeviceId("microbit1")).to.equal("222");
      });

      it("keeps probing while the board reboots after flashing", async function () {
        // Ignores probes until ~2.5 probe-timeouts after the flash — longer
        // than the pre-flash retry budget, shorter than the post-flash one.
        let bootedAt = null;
        const transport = new FakeTransport({
          onWrite: (line, t) => {
            if (line !== "P\n" || bootedAt === null) return;
            if (Date.now() >= bootedAt) t.emitLine(`HELLO flock ${PROTOCOL_VERSION} 222`);
          },
        });
        transport.flash = async function (hexText) {
          this.flashed.push(hexText);
          bootedAt = Date.now() + 50; // probeTimeoutMs is 20 in these tests
        };
        const manager = makeManager({ transports: [transport] });
        manager.confirmFlash = () => Promise.resolve(true);

        await manager.bindFromPicker("microbit1");

        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
      });

      it("patches the channel sentinel into the hex it flashes", async function () {
        // One valid record containing "FLKCH:001;"; channel 5 rewrites the
        // digits to 005 and fixes the checksum.
        const sentinelHex = ":0A000000464C4B43483A3030313B88";
        const patchedHex = ":0A000000464C4B43483A3030353B84";
        const transport = new FakeTransport({
          onWrite: (line, t) => {
            if (line === "P\n" && t.flashed.length > 0) {
              t.emitLine(`HELLO flock ${PROTOCOL_VERSION} 222`);
            }
          },
        });
        const manager = makeManager({
          transports: [transport],
          fetchFirmware: async () => sentinelHex,
        });
        manager.confirmFlash = () => Promise.resolve(true);
        manager.setVariableChannel("microbit1", 5);

        await manager.bindFromPicker("microbit1");

        expect(transport.flashed).to.deep.equal([patchedHex]);
      });

      it("treats a stale protocol version as needs-flash", async function () {
        const transport = new FakeTransport({
          onWrite: (line, t) => {
            if (line !== "P\n") return;
            t.emitLine(
              t.flashed.length > 0
                ? `HELLO flock ${PROTOCOL_VERSION} 222`
                : `HELLO flock ${PROTOCOL_VERSION - 1} 222`
            );
          },
        });
        const manager = makeManager({ transports: [transport] });
        manager.confirmFlash = () => Promise.resolve(true);

        await manager.bindFromPicker("microbit1");

        expect(transport.flashed.length).to.equal(1);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
      });

      it("propagates connect failures and cleans up", async function () {
        const transport = new FakeTransport({
          connectImpl: async () => {
            throw new Error("no device selected");
          },
        });
        const manager = makeManager({ transports: [transport] });
        let error = null;
        try {
          await manager.bindFromPicker("microbit1");
        } catch (e) {
          error = e;
        }
        expect(error).to.be.an("error");
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );
      });

      it("moves a board picked for another variable; the old variable goes grey", async function () {
        const manager = makeManager({
          transports: [respondingTransport("111"), respondingTransport("111")],
        });
        await manager.bindFromPicker("microbit1");
        await manager.bindFromPicker("microbit2");

        expect(manager.getStatusForVariable("microbit2").state).to.equal(
          VariableStatus.TETHERED,
        );
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );
        expect(manager.boundDeviceId("microbit2")).to.equal("111");
        expect(manager.boundDeviceId("microbit1")).to.equal(null);
      });

      it("goes grey and disposes the transport when the board unplugs", async function () {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker("microbit1");
        transport.emitDisconnect();
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );
        // The stale connection must be torn down, or it auto-reconnects on
        // tab focus and fights the next connection for the DAPLink interface.
        expect(transport.disconnected).to.equal(true);
      });

      it("silently reclaims a still-present board after the link drops", async function () {
        // e.g. the library disconnects the tab while it is hidden.
        const first = respondingTransport("111", { usbSerialNumber: "USB1" });
        const second = respondingTransport("111", { usbSerialNumber: "USB1" });
        const usb = {
          addEventListener() {},
          async getDevices() {
            return [{ serialNumber: "USB1" }];
          },
        };
        const manager = makeManager({
          transports: [first, second],
          usb,
          reconnectDelaysMs: [10, 20],
        });
        await manager.bindFromPicker("microbit1");
        first.emitDisconnect();
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );

        await sleep(40);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
        expect(manager._createCalls[1]).to.deep.equal({ silent: true });
      });

      it("does not try to reconnect a board that was unplugged", async function () {
        const transport = respondingTransport("111", {
          usbSerialNumber: "USB1",
        });
        const usb = {
          addEventListener() {},
          async getDevices() {
            return []; // gone — replugging fires the usb "connect" event
          },
        };
        const manager = makeManager({
          transports: [transport],
          usb,
          reconnectDelaysMs: [10],
        });
        await manager.bindFromPicker("microbit1");
        transport.emitDisconnect();
        await sleep(40);
        expect(manager._createCalls.length).to.equal(1);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.UNBOUND,
        );
      });
    });

    describe("bindings", function () {
      it("ignores (but keeps) bindings whose variable is missing from the project", async function () {
        const storage = new FakeStorage({
          flockMicrobitBindings: JSON.stringify({
            111: { variable: "microbit1", usbSerialNumber: "USB1" },
          }),
        });
        const manager = makeManager({ storage });
        manager.variableExists = () => false;
        expect(manager.boundDeviceId("microbit1")).to.equal(null);

        // Binding is not deleted: it is honoured again once the variable exists.
        manager.variableExists = () => true;
        expect(manager.boundDeviceId("microbit1")).to.equal("111");
        expect(
          JSON.parse(storage.getItem("flockMicrobitBindings"))["111"].variable,
        ).to.equal("microbit1");
      });
    });

    describe("silent reconnect", function () {
      function makeUsb(devices) {
        return {
          listeners: {},
          addEventListener(type, listener) {
            this.listeners[type] = listener;
          },
          async getDevices() {
            return devices;
          },
        };
      }

      it("reconnects known boards from getDevices without scrolling the name", async function () {
        const storage = new FakeStorage({
          flockMicrobitBindings: JSON.stringify({
            111: { variable: "microbit1", usbSerialNumber: "USB1" },
          }),
        });
        const transport = respondingTransport("111", {
          usbSerialNumber: "USB1",
        });
        const usb = makeUsb([{ serialNumber: "USB1" }]);
        const manager = makeManager({ transports: [transport], storage, usb });

        await manager.init();
        await sleep(10); // reconnect runs fire-and-forget

        expect(manager._createCalls[0]).to.deep.equal({ silent: true });
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
        expect(transport.written).to.include("G:1\n");
        expect(transport.written.join("")).to.not.include("S:");
      });

      it("ignores unknown devices on getDevices and connect events", async function () {
        const usb = makeUsb([{ serialNumber: "STRANGER" }]);
        const manager = makeManager({ transports: [], usb });
        await manager.init();
        usb.listeners.connect({ device: { serialNumber: "STRANGER2" } });
        await sleep(10);
        expect(manager._createCalls).to.deep.equal([]);
      });

      it("reconnects when a known board is replugged", async function () {
        const storage = new FakeStorage({
          flockMicrobitBindings: JSON.stringify({
            111: { variable: "microbit1", usbSerialNumber: "USB1" },
          }),
        });
        const transport = respondingTransport("111", {
          usbSerialNumber: "USB1",
        });
        const usb = makeUsb([]);
        const manager = makeManager({ transports: [transport], storage, usb });
        await manager.init();
        usb.listeners.connect({ device: { serialNumber: "USB1" } });
        await sleep(10);
        expect(manager.getStatusForVariable("microbit1").state).to.equal(
          VariableStatus.TETHERED,
        );
      });
    });

    describe("channel", function () {
      it("pushes on change, not on repeat; addMicrobit forces a push", async function () {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker("microbit1");
        transport.written.length = 0;

        manager.setVariableChannel("microbit1", 5);
        expect(transport.written).to.deep.equal(["G:5\n"]);

        manager.setVariableChannel("microbit1", 5);
        expect(transport.written).to.deep.equal(["G:5\n"]);

        manager.setVariableChannel("microbit1", 5, { forcePush: true });
        expect(transport.written).to.deep.equal(["G:5\n", "G:5\n"]);
      });

      it("binds with the pre-registered channel", async function () {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        manager.setVariableChannel("microbit1", 7);
        await manager.bindFromPicker("microbit1");
        expect(transport.written).to.include("G:7\n");
      });

      it("knows which channels have a tethered listener", async function () {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        manager.setVariableChannel("microbit1", 7);
        expect(manager.hasTetheredOnChannel(7)).to.equal(false);
        await manager.bindFromPicker("microbit1");
        expect(manager.hasTetheredOnChannel(7)).to.equal(true);
        expect(manager.hasTetheredOnChannel(8)).to.equal(false);
      });
    });

    describe('showImage', function () {
      const SUN = '9090909990999990999090909';
      // One short line per LED row — a single 25-digit line overflows the
      // firmware's <20-byte serial receive buffer.
      const SUN_LINES = [
        'I:090909\n',
        'I:109990\n',
        'I:299999\n',
        'I:309990\n',
        'I:490909\n',
      ];

      it("writes the five row lines to the named variable's tethered session", async function () {
        const transport = respondingTransport('111');
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker('microbit1');
        transport.written.length = 0;

        manager.showImage('microbit1', SUN);
        await sleep(0); // rows are written sequentially (awaited)
        expect(transport.written).to.deep.equal(SUN_LINES);
      });

      it('logs each outgoing row line when microbitDebug is enabled', async function () {
        const transport = respondingTransport('111');
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker('microbit1');
        transport.written.length = 0;

        const debugCalls = [];
        const originalDebug = console.debug;
        globalThis.__microbitDebug = true;
        console.debug = (...args) => debugCalls.push(args);
        try {
          manager.showImage('microbit1', SUN);
          await sleep(0);
          expect(transport.written).to.deep.equal(SUN_LINES);
          for (const line of SUN_LINES) {
            expect(debugCalls).to.deep.include([
              'micro:bit:',
              'write:',
              line.trimEnd(),
            ]);
          }
        } finally {
          console.debug = originalDebug;
          delete globalThis.__microbitDebug;
        }
      });

      it('"any" fans out to every tethered board', async function () {
        const t1 = respondingTransport('111');
        const t2 = respondingTransport('333');
        const manager = makeManager({ transports: [t1, t2] });
        await manager.bindFromPicker('microbit1');
        await manager.bindFromPicker('microbit2');
        t1.written.length = 0;
        t2.written.length = 0;

        manager.showImage(null, SUN);
        await sleep(0);
        expect(t1.written).to.deep.equal(SUN_LINES);
        expect(t2.written).to.deep.equal(SUN_LINES);
      });

      it('is a silent no-op for an untethered device', async function () {
        const transport = respondingTransport('111');
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker('microbit1');
        transport.written.length = 0;

        manager.showImage('microbit9', SUN); // no such tethered variable
        manager.showImage('microbit1', SUN);
        await sleep(0);
        expect(transport.written).to.deep.equal(SUN_LINES);
      });

      it('drops the session and stops writing when a row write fails', async function () {
        const transport = respondingTransport('111');
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker('microbit1');
        let writes = 0;
        transport.writeLine = async () => {
          writes++;
          throw new Error('gone');
        };

        manager.showImage('microbit1', SUN);
        await sleep(0); // the drop happens in the write's rejection handler
        expect(writes).to.equal(1); // remaining rows are not attempted
        expect(manager.getStatusForVariable('microbit1').state).to.equal(VariableStatus.UNBOUND);
      });

      it('microbitShowImage validates its arguments', async function () {
        const transport = respondingTransport('111');
        const manager = makeManager({ transports: [transport] });
        setMicrobitManagerForTests(manager);
        await manager.bindFromPicker('microbit1');
        transport.written.length = 0;

        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (message) => warnings.push(message);
        try {
          flockMicrobit.microbitShowImage(42, SUN);
          flockMicrobit.microbitShowImage('microbit1', 42);
          await sleep(0);
          expect(transport.written).to.deep.equal([]);
          expect(warnings).to.deep.equal([
            'microbitShowImage: deviceName must be a string',
            'microbitShowImage: pattern must be a string',
          ]);

          flockMicrobit.microbitShowImage('', SUN); // "" = any
          await sleep(0);
          expect(transport.written).to.deep.equal(SUN_LINES);
        } finally {
          console.warn = originalWarn;
        }
      });
    });

    describe("events and radio", function () {
      async function tetheredManager() {
        const transport = respondingTransport("111");
        const manager = makeManager({ transports: [transport] });
        await manager.bindFromPicker("microbit1");
        return { manager, transport };
      }

      it("fans out the tethered board's own events to its variable", async function () {
        const { manager, transport } = await tetheredManager();
        const received = [];
        manager.subscribe("microbit1", (char) => received.push(char));
        transport.emitLine("E:SH");
        transport.emitLine("E:A");
        transport.emitLine("garbage line");
        expect(received).to.deep.equal(["i", " "]);
      });

      it("delivers relayed events to the bound variable and dedups on (deviceId, seq)", async function () {
        const manager = makeManager({
          transports: [respondingTransport("111"), respondingTransport("333")],
        });
        await manager.bindFromPicker("microbit1");
        await manager.bindFromPicker("microbit2");
        // Radio board 222 is bound to microbit3 from an earlier tether.
        manager._bindings.set("222", { variable: "microbit3" });

        const received = [];
        manager.subscribe("microbit3", (char) => received.push(char));
        const anyChars = [];
        manager.onAnyEvent((char) => anyChars.push(char));

        const sessions = [...manager._sessions];
        const t1 = sessions[0].transport;
        const t2 = sessions[1].transport;
        // Both tethered boards relay the same packet; only one delivery.
        t1.emitLine("R:222:5:TL");
        t2.emitLine("R:222:5:TL");
        t1.emitLine("R:222:6:TR");

        expect(received).to.deep.equal(["a", "d"]);
        expect(anyChars).to.deep.equal(["a", "d"]);
      });

      it("feeds every event to the any-event sink, even from unbound boards", async function () {
        const { manager, transport } = await tetheredManager();
        const anyChars = [];
        manager.onAnyEvent((char) => anyChars.push(char));
        transport.emitLine("R:999:1:FF"); // unknown board
        expect(anyChars).to.deep.equal(["t"]);
      });

      it("subscribing to an unbound variable is valid and silent", async function () {
        const { manager, transport } = await tetheredManager();
        const received = [];
        manager.subscribe("microbit9", (char) => received.push(char));
        transport.emitLine("E:SH");
        expect(received).to.deep.equal([]);
      });

      it("shows green waves while heartbeats arrive, grey after they stop", async function () {
        const { manager, transport } = await tetheredManager();
        manager._bindings.set("222", { variable: "microbit2" });

        expect(manager.getStatusForVariable("microbit2").state).to.equal(
          VariableStatus.UNBOUND,
        );
        transport.emitLine("R:222:1:HB");
        expect(manager.getStatusForVariable("microbit2").state).to.equal(
          VariableStatus.RADIO,
        );
        expect(manager.isVariableOnRadio("microbit2")).to.equal(true);

        // heartbeatTimeoutMs is 60 in these tests.
        await sleep(90);
        expect(manager.getStatusForVariable("microbit2").state).to.equal(
          VariableStatus.UNBOUND,
        );
        await manager.dispose();
      });

      it("does not deliver to variables missing from the project", async function () {
        const { manager, transport } = await tetheredManager();
        const received = [];
        manager.subscribe("microbit1", (char) => received.push(char));
        manager.variableExists = (name) => name !== "microbit1";
        transport.emitLine("E:SH");
        expect(received).to.deep.equal([]);
      });
    });
  });
}
