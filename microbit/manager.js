// Device list, bindings, and event fan-out for micro:bits. One manager owns:
//  - variables registered by add_microbit blocks (name → radio channel),
//  - persistent bindings (board device id → variable name),
//  - one session per tethered (USB-connected) board with the state machine
//    disconnected → connecting → probing → needs-flash → flashing → connected,
//  - radio liveness (heartbeats relayed by tethered boards),
//  - subscriber fan-out for onMicrobitEvent plus an "any event" sink that
//    feeds the key-event pipeline so legacy/"any" blocks keep working.
//
// All environment access (transport, storage, navigator.usb, timers, dialogs,
// firmware fetch, Blockly variable lookup) is injected so the manager is fully
// unit-testable with fakes.
import {
  PROTOCOL_VERSION,
  RadioDeduper,
  parseLine,
  patchChannelSentinel,
  serialiseProbe,
  serialiseChannel,
  serialiseScrollText,
} from "./protocol.js";

export const BoardState = Object.freeze({
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  PROBING: "probing",
  NEEDS_FLASH: "needs-flash",
  FLASHING: "flashing",
  CONNECTED: "connected",
});

// Icon states surfaced to the add_microbit block.
export const VariableStatus = Object.freeze({
  UNBOUND: "unbound", // grey — no board bound (or bound board silent)
  BUSY: "busy", // amber — connecting or flashing
  TETHERED: "tethered", // green + plug — connected over USB and responding
  RADIO: "radio", // green + waves — untethered, heartbeats arriving
});

export const FIRMWARE_HEX_URL = "util/microbit-flockusb.hex";
export const FLASH_CONFIRM_MESSAGE =
  "This will replace the program on your micro:bit with the Flock program.";

// Opt-in diagnostics (raw serial lines and the connection library's status
// chatter): set `flock.microbitDebug = true` — like flock.memoryDebug — or
// `__microbitDebug = true` from the DevTools console. No reload needed.
let flockRef = null;

export function setFlockReference(ref) {
  flockRef = ref;
}

const debugLog = (...args) => {
  if (flockRef?.microbitDebug || globalThis.__microbitDebug) {
    console.debug("micro:bit:", ...args);
  }
};

const STORAGE_KEY = "flockMicrobitBindings";
const DEFAULT_CHANNEL = 1;
const PROBE_TIMEOUT_MS = 1000;
const PROBE_ATTEMPTS = 2; // initial probe + one retry
// A full flash ends in a board reset; reboot plus serial re-attach can take
// several seconds, so the post-flash probe is far more patient.
const POST_FLASH_PROBE_ATTEMPTS = 12;
const HEARTBEAT_TIMEOUT_MS = 5000;
// Backoff for reclaiming a board after the link drops (e.g. the library
// disconnects hidden tabs). Timers are throttled in background tabs, so in
// practice these fire shortly after the tab becomes visible again.
const RECONNECT_DELAYS_MS = [2000, 5000, 10000];

async function defaultCreateTransport({ silent = false } = {}) {
  // Imported lazily so environments without WebUSB (node test runners) never
  // load @microbit/microbit-connection.
  const { MicrobitUsbTransport } = await import("./usbTransport.js");
  const { createWebUSBConnection, DeviceSelectionMode } = await import(
    "@microbit/microbit-connection"
  );
  return new MicrobitUsbTransport({
    connection: createWebUSBConnection({
      deviceSelectionMode: silent
        ? DeviceSelectionMode.UseAnyAllowed
        : DeviceSelectionMode.AlwaysAsk,
      // The library logs status chatter to the console by default; route it
      // through the same opt-in gate as our own diagnostics. Failures still
      // surface through thrown errors (banner + console.warn).
      logging: {
        log: (value) => debugLog(value),
        event: (event) => debugLog(event),
        error: (error) => debugLog(error),
      },
    }),
  });
}

async function defaultFetchFirmware() {
  let response;
  try {
    response = await fetch(FIRMWARE_HEX_URL);
  } catch (error) {
    throw new Error(
      `Could not load the Flock micro:bit firmware (${FIRMWARE_HEX_URL}): ${error.message}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Flock micro:bit firmware is missing (${FIRMWARE_HEX_URL}, HTTP ${response.status}).`,
    );
  }
  return response.text();
}

export class MicrobitManager {
  constructor({
    createTransport = defaultCreateTransport,
    storage = globalThis.localStorage,
    usb = globalThis.navigator?.usb,
    fetchFirmware = defaultFetchFirmware,
    confirmFlash = null,
    variableExists = null,
    now = Date.now,
    setTimeoutFn = (...args) => globalThis.setTimeout(...args),
    clearTimeoutFn = (id) => globalThis.clearTimeout(id),
    probeTimeoutMs = PROBE_TIMEOUT_MS,
    heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS,
    reconnectDelaysMs = RECONNECT_DELAYS_MS,
  } = {}) {
    this._createTransport = createTransport;
    this._storage = storage;
    this._usb = usb;
    this._fetchFirmware = fetchFirmware;
    this._now = now;
    this._setTimeout = setTimeoutFn;
    this._clearTimeout = clearTimeoutFn;
    this._probeTimeoutMs = probeTimeoutMs;
    this._heartbeatTimeoutMs = heartbeatTimeoutMs;
    this._reconnectDelaysMs = reconnectDelaysMs;

    // Overridable hooks, wired up by the app (Blockly dialog / workspace).
    this.confirmFlash =
      confirmFlash ??
      ((message) =>
        Promise.resolve(
          typeof globalThis.confirm === "function"
            ? globalThis.confirm(message)
            : false,
        ));
    this.variableExists = variableExists ?? (() => true);

    this._variables = new Map(); // name → { channel }
    this._bindings = new Map(); // deviceId → { variable, usbSerialNumber }
    this._sessions = new Set(); // tethered board sessions
    this._radioLastSeen = new Map(); // deviceId → timestamp of last relayed packet
    this._heartbeatTimers = new Map(); // deviceId → timer id (icon refresh on expiry)
    this._deduper = new RadioDeduper({ now });
    this._subscribers = new Map(); // variable name → Set(callback(char))
    this._anyListeners = new Set(); // callback(char) for every delivered event
    this._statusListeners = new Set();

    this._loadBindings();
  }

  // ---------------------------------------------------------------- bindings

  _loadBindings() {
    try {
      const raw = this._storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [deviceId, entry] of Object.entries(data)) {
        if (entry && typeof entry.variable === "string") {
          this._bindings.set(deviceId, {
            variable: entry.variable,
            usbSerialNumber: entry.usbSerialNumber,
          });
        }
      }
    } catch {
      // Corrupt or unavailable storage — start with no bindings.
    }
  }

  _saveBindings() {
    try {
      this._storage?.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(this._bindings)),
      );
    } catch {
      // Storage full/unavailable — bindings just won't survive a reload.
    }
  }

  /** Device id bound to a variable, or null. Bindings whose variable does not
   * exist in the open project are ignored (not deleted). */
  boundDeviceId(variableName) {
    if (!this.variableExists(variableName)) return null;
    for (const [deviceId, binding] of this._bindings) {
      if (binding.variable === variableName) return deviceId;
    }
    return null;
  }

  // --------------------------------------------------------------- variables

  getVariableChannel(variableName) {
    return this._variables.get(variableName)?.channel ?? DEFAULT_CHANNEL;
  }

  /**
   * Register/refresh a variable's channel. addMicrobit (runtime) and the
   * add_microbit block (editor) both land here. `forcePush` pushes to the
   * bound tethered board even when the value is unchanged (addMicrobit runs).
   */
  setVariableChannel(variableName, channel, { forcePush = false } = {}) {
    const next = Math.min(255, Math.max(0, Math.round(Number(channel) || 0)));
    const previous = this._variables.get(variableName)?.channel;
    this._variables.set(variableName, { channel: next });
    if (forcePush || previous !== next) {
      const session = this._tetheredSessionFor(variableName);
      if (session) {
        session.transport
          .writeLine(serialiseChannel(next))
          .catch(() => this._dropSession(session));
      }
    }
    if (previous !== next) this._notifyStatus();
  }

  // ------------------------------------------------------------ subscription

  /** Fan-out for onMicrobitEvent. Registering against an unbound variable is
   * valid and silent. Returns an unsubscribe function. */
  subscribe(variableName, callback) {
    let set = this._subscribers.get(variableName);
    if (!set) {
      set = new Set();
      this._subscribers.set(variableName, set);
    }
    set.add(callback);
    return () => set.delete(callback);
  }

  /** Called with the event char of every delivered event, whichever board it
   * came from. Feeds the key-event pipeline for "any"/legacy blocks. */
  onAnyEvent(callback) {
    this._anyListeners.add(callback);
    return () => this._anyListeners.delete(callback);
  }

  onStatusChange(callback) {
    this._statusListeners.add(callback);
    return () => this._statusListeners.delete(callback);
  }

  _notifyStatus() {
    for (const listener of this._statusListeners) {
      try {
        listener();
      } catch (error) {
        console.warn("micro:bit status listener failed:", error);
      }
    }
  }

  _deliver(variableName, char) {
    for (const listener of this._anyListeners) {
      try {
        listener(char);
      } catch (error) {
        console.warn("micro:bit event listener failed:", error);
      }
    }
    if (!variableName || !this.variableExists(variableName)) return;
    const set = this._subscribers.get(variableName);
    if (!set) return;
    for (const callback of [...set]) {
      try {
        callback(char);
      } catch (error) {
        console.warn("micro:bit event handler failed:", error);
      }
    }
  }

  // ------------------------------------------------------------------ status

  _sessionVariable(session) {
    // Once the device id is known the binding is authoritative; before that
    // (mid-connect from the picker) the session carries its target variable.
    if (session.deviceId) {
      return this._bindings.get(session.deviceId)?.variable ?? null;
    }
    return session.variable;
  }

  _tetheredSessionFor(variableName) {
    for (const session of this._sessions) {
      if (
        session.state === BoardState.CONNECTED &&
        this._sessionVariable(session) === variableName
      ) {
        return session;
      }
    }
    return null;
  }

  getStatusForVariable(variableName) {
    for (const session of this._sessions) {
      if (this._sessionVariable(session) !== variableName) continue;
      if (session.state === BoardState.CONNECTED) {
        return { state: VariableStatus.TETHERED };
      }
      return {
        state: VariableStatus.BUSY,
        boardState: session.state,
        flashProgress: session.flashProgress,
      };
    }
    const deviceId = this.boundDeviceId(variableName);
    if (deviceId !== null) {
      const lastSeen = this._radioLastSeen.get(deviceId);
      if (
        lastSeen !== undefined &&
        this._now() - lastSeen < this._heartbeatTimeoutMs
      ) {
        return { state: VariableStatus.RADIO };
      }
    }
    return { state: VariableStatus.UNBOUND };
  }

  /** True if any tethered board is listening (relaying) on this channel. */
  hasTetheredOnChannel(channel) {
    for (const session of this._sessions) {
      if (session.state !== BoardState.CONNECTED) continue;
      const variable = this._sessionVariable(session);
      if (variable === null) continue;
      if (this.getVariableChannel(variable) === Number(channel)) return true;
    }
    return false;
  }

  /** True if the variable's bound board is not currently tethered — the case
   * where it depends on some tethered board relaying its channel. */
  isVariableOnRadio(variableName) {
    const deviceId = this.boundDeviceId(variableName);
    if (deviceId === null) return false;
    for (const session of this._sessions) {
      if (session.deviceId === deviceId) return false;
    }
    return true;
  }

  // ------------------------------------------------------------- connect flow

  /**
   * Grey-icon click: open the device picker and bind the chosen board to the
   * variable. Must be called from a user gesture (requestDevice). Flashing is
   * offered when the probe fails or the protocol version is stale, and only
   * happens after explicit confirmation.
   */
  async bindFromPicker(variableName) {
    // One in-flight connect per variable; further clicks are ignored.
    for (const session of this._sessions) {
      if (this._sessionVariable(session) === variableName) return;
    }

    const session = {
      transport: null,
      state: BoardState.CONNECTING,
      variable: variableName,
      deviceId: null,
      usbSerialNumber: undefined,
      flashProgress: undefined,
      helloWaiters: [],
      lastHello: null,
    };
    this._sessions.add(session);
    this._notifyStatus();

    try {
      session.transport = await this._createTransport({ silent: false });
      this._wireTransport(session);
      await session.transport.connect();
      session.usbSerialNumber = session.transport.usbSerialNumber;

      session.state = BoardState.PROBING;
      this._notifyStatus();
      let hello = await this._probe(session);

      if (!hello || hello.version !== PROTOCOL_VERSION) {
        session.state = BoardState.NEEDS_FLASH;
        this._notifyStatus();
        const confirmed = await this.confirmFlash(FLASH_CONFIRM_MESSAGE);
        if (!confirmed) {
          await this._dropSession(session, { disconnect: true });
          return;
        }
        hello = await this._flashAndReprobe(session);
        if (!hello) {
          await this._dropSession(session, { disconnect: true });
          throw new Error("micro:bit did not respond after flashing");
        }
      }

      this._finishTethered(session, hello, { bindTo: variableName });
    } catch (error) {
      await this._dropSession(session, { disconnect: true });
      throw error;
    }
  }

  async _flashAndReprobe(session) {
    session.state = BoardState.FLASHING;
    session.flashProgress = 0;
    this._notifyStatus();
    // The firmware reads its boot radio channel from a sentinel in the hex,
    // so a remote power-cycled onto battery comes back up on its channel.
    const channel = this.getVariableChannel(this._sessionVariable(session));
    const hexText = patchChannelSentinel(await this._fetchFirmware(), channel);
    const flashStartedAt = this._now();
    let lastNotified = -1;
    await session.transport.flash(hexText, (percentage) => {
      session.flashProgress = percentage;
      const step = Math.floor((percentage ?? 0) / 5);
      if (step !== lastNotified) {
        lastNotified = step;
        this._notifyStatus();
      }
    });
    session.flashProgress = undefined;
    session.state = BoardState.PROBING;
    this._notifyStatus();
    // The board resets after flashing and announces itself with HELLO on
    // boot. That can arrive before any probe (or race the serial restart),
    // and a reboot can take several seconds — accept a spontaneous HELLO
    // from after the flash began, and keep probing while we wait.
    return this._probe(session, {
      attempts: POST_FLASH_PROBE_ATTEMPTS,
      helloSince: flashStartedAt,
    });
  }

  /** App start / USB connect: silently reconnect known boards, re-bind by
   * device id. Never shows a picker and never offers to flash. */
  async init() {
    const usb = this._usb;
    if (!usb) return;
    usb.addEventListener?.("connect", (event) => {
      this._maybeSilentReconnect(event.device);
    });
    let devices = [];
    try {
      devices = await usb.getDevices();
    } catch {
      return;
    }
    for (const device of devices) this._maybeSilentReconnect(device);
  }

  _maybeSilentReconnect(device) {
    const serialNumber = device?.serialNumber;
    if (!serialNumber) return;
    let known = false;
    for (const binding of this._bindings.values()) {
      if (binding.usbSerialNumber === serialNumber) known = true;
    }
    if (!known) return;
    for (const session of this._sessions) {
      if (session.usbSerialNumber === serialNumber) return; // already handled
    }
    this._silentConnect(serialNumber).catch(() => {});
  }

  async _silentConnect(expectedSerialNumber) {
    const session = {
      transport: null,
      state: BoardState.CONNECTING,
      variable: null,
      deviceId: null,
      usbSerialNumber: expectedSerialNumber,
      flashProgress: undefined,
      helloWaiters: [],
      lastHello: null,
    };
    this._sessions.add(session);
    try {
      session.transport = await this._createTransport({ silent: true });
      this._wireTransport(session);
      await session.transport.connect();
      session.usbSerialNumber =
        session.transport.usbSerialNumber ?? expectedSerialNumber;
      // The silent connection mode claims "any allowed device": if it grabbed
      // a board another session already owns, back off.
      for (const other of this._sessions) {
        if (
          other !== session &&
          other.usbSerialNumber === session.usbSerialNumber
        ) {
          await this._dropSession(session, { disconnect: true });
          return;
        }
      }
      session.state = BoardState.PROBING;
      this._notifyStatus();
      const hello = await this._probe(session);
      if (!hello || hello.version !== PROTOCOL_VERSION) {
        await this._dropSession(session, { disconnect: true });
        return;
      }
      this._finishTethered(session, hello, { bindTo: null });
    } catch {
      await this._dropSession(session, { disconnect: true });
    }
  }

  _wireTransport(session) {
    session.transport.onLine((line) => this._handleLine(session, line));
    session.transport.onDisconnect(() => {
      // Dispose even though the link already dropped — the stale connection
      // object would otherwise auto-reconnect on tab focus and fight the
      // next connection for the DAPLink interface.
      this._dropSession(session, { disconnect: true });
      // Losing the link is routine (the library disconnects hidden tabs);
      // win the board back without user action when it's still plugged in.
      this._scheduleReconnect(session.usbSerialNumber);
    });
  }

  _scheduleReconnect(serialNumber, attempt = 0) {
    if (!serialNumber || !this._usb) return;
    if (attempt >= this._reconnectDelaysMs.length) return;
    this._setTimeout(async () => {
      for (const session of this._sessions) {
        if (session.usbSerialNumber === serialNumber) return; // already back
      }
      let devices = [];
      try {
        devices = await this._usb.getDevices();
      } catch {
        return;
      }
      if (!devices.some((device) => device?.serialNumber === serialNumber)) {
        return; // unplugged — the usb "connect" event covers replugging
      }
      await this._silentConnect(serialNumber);
      for (const session of this._sessions) {
        if (session.usbSerialNumber === serialNumber) return;
      }
      this._scheduleReconnect(serialNumber, attempt + 1);
    }, this._reconnectDelaysMs[attempt]);
  }

  async _probe(session, { attempts = PROBE_ATTEMPTS, helloSince = null } = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      // A spontaneous HELLO (the board announces itself on boot) counts as a
      // probe response when it arrived after `helloSince`.
      if (
        helloSince !== null &&
        session.lastHello &&
        session.lastHello.at >= helloSince
      ) {
        return session.lastHello.hello;
      }
      // Register the waiter before writing so a reply can't slip between the
      // write completing and the wait starting.
      const helloPromise = this._waitForHello(session, this._probeTimeoutMs);
      try {
        await session.transport.writeLine(serialiseProbe());
      } catch {
        return null;
      }
      const hello = await helloPromise;
      if (hello) return hello;
    }
    return null;
  }

  _waitForHello(session, timeoutMs) {
    return new Promise((resolve) => {
      const timer = this._setTimeout(() => {
        const index = session.helloWaiters.indexOf(waiter);
        if (index !== -1) session.helloWaiters.splice(index, 1);
        resolve(null);
      }, timeoutMs);
      const waiter = (hello) => {
        this._clearTimeout(timer);
        resolve(hello);
      };
      session.helloWaiters.push(waiter);
    });
  }

  _finishTethered(session, hello, { bindTo }) {
    session.deviceId = hello.deviceId;

    // A physical board can only have one live session; drop any stale one.
    for (const other of [...this._sessions]) {
      if (other !== session && other.deviceId === hello.deviceId) {
        this._dropSession(other, { disconnect: true });
      }
    }

    if (bindTo) {
      // One board per variable: any other board bound to this variable is
      // released. The chosen board moves here even if bound elsewhere — the
      // other variable simply goes grey.
      for (const [deviceId, binding] of [...this._bindings]) {
        if (binding.variable === bindTo && deviceId !== hello.deviceId) {
          this._bindings.delete(deviceId);
        }
      }
      this._bindings.set(hello.deviceId, {
        variable: bindTo,
        usbSerialNumber: session.usbSerialNumber,
      });
      this._saveBindings();
    } else {
      const binding = this._bindings.get(hello.deviceId);
      if (binding && binding.usbSerialNumber !== session.usbSerialNumber) {
        binding.usbSerialNumber = session.usbSerialNumber;
        this._saveBindings();
      }
    }

    session.state = BoardState.CONNECTED;

    const variable = this._sessionVariable(session);
    if (variable !== null && this.variableExists(variable)) {
      session.transport
        .writeLine(serialiseChannel(this.getVariableChannel(variable)))
        .catch(() => {});
      if (bindTo) {
        // The board scrolls its variable name so learners can tell boards apart.
        session.transport
          .writeLine(serialiseScrollText(variable))
          .catch(() => {});
      }
    }
    this._notifyStatus();
  }

  async _dropSession(session, { disconnect = false } = {}) {
    if (!this._sessions.has(session)) return;
    this._sessions.delete(session);
    for (const waiter of session.helloWaiters.splice(0)) waiter(null);
    if (disconnect && session.transport) {
      try {
        await session.transport.disconnect();
      } catch {
        // Best effort — the device may already be gone.
      }
    }
    this._notifyStatus();
  }

  // ------------------------------------------------------------------- lines

  _handleLine(session, line) {
    debugLog("line:", line);
    const message = parseLine(line);
    if (!message) return; // unknown lines are ignored

    if (message.type === "hello") {
      // Kept even when nobody is waiting: the post-flash probe accepts the
      // spontaneous boot-time HELLO via session.lastHello.
      session.lastHello = { hello: message, at: this._now() };
      for (const waiter of session.helloWaiters.splice(0)) waiter(message);
      return;
    }

    if (session.state !== BoardState.CONNECTED) return;

    if (message.type === "event") {
      this._deliver(this._sessionVariable(session), message.char);
      return;
    }

    // Relayed radio packet. Any packet (heartbeat or event) proves the remote
    // board is alive; multiple tethered relays are deduplicated on
    // (deviceId, seq).
    if (message.type === "relay") {
      if (!this._deduper.isNew(message.deviceId, message.seq)) return;
      this._markRadioSeen(message.deviceId);
      if (message.heartbeat) return;
      const variable = this._bindings.get(message.deviceId)?.variable ?? null;
      this._deliver(variable, message.char);
    }
  }

  _markRadioSeen(deviceId) {
    const wasLive =
      this._radioLastSeen.get(deviceId) !== undefined &&
      this._now() - this._radioLastSeen.get(deviceId) <
        this._heartbeatTimeoutMs;
    this._radioLastSeen.set(deviceId, this._now());
    const existing = this._heartbeatTimers.get(deviceId);
    if (existing !== undefined) this._clearTimeout(existing);
    // Refresh icons when the heartbeats stop (green waves → grey).
    this._heartbeatTimers.set(
      deviceId,
      this._setTimeout(() => {
        this._heartbeatTimers.delete(deviceId);
        this._notifyStatus();
      }, this._heartbeatTimeoutMs),
    );
    if (!wasLive) this._notifyStatus();
  }

  // ----------------------------------------------------------------- cleanup

  async dispose() {
    for (const timer of this._heartbeatTimers.values()) {
      this._clearTimeout(timer);
    }
    this._heartbeatTimers.clear();
    for (const session of [...this._sessions]) {
      await this._dropSession(session, { disconnect: true });
    }
    this._subscribers.clear();
    this._anyListeners.clear();
    this._statusListeners.clear();
  }
}

let managerInstance = null;

export function getMicrobitManager() {
  if (!managerInstance) {
    managerInstance = new MicrobitManager();
    // Debug handle (like window.mainWorkspace): lets the console and field
    // diagnostics reach the live singleton.
    globalThis.__microbitManager = managerInstance;
  }
  return managerInstance;
}

export function setMicrobitManagerForTests(manager) {
  managerInstance = manager;
}
