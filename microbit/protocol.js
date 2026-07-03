// Serial/radio protocol for the Flock micro:bit firmware. Pure functions and
// small state holders only — no WebUSB, no Blockly, no timers — so everything
// here is unit-testable in isolation.
//
// Serial protocol (115200 baud, newline-terminated ASCII; unknown lines are
// ignored in both directions):
//   → board    P               probe; board replies HELLO and becomes tethered
//   → board    G:<n>           set radio channel (persisted on the board)
//   → board    S:<text>        scroll text on the LEDs (≤ 20 ASCII chars)
//   → browser  HELLO flock 1 <deviceId>   on boot and on probe
//   → browser  E:<code>        the tethered board's own event
//   → browser  R:<deviceId>:<seq>:<code>  relayed radio event (HB = heartbeat)
//
// Event codes are short mnemonics; the browser maps them to the single-char
// event ids the microbit_input block has always used, so block XML and
// generated code are unchanged.

export const PROTOCOL_VERSION = 1;
export const HEARTBEAT_CODE = "HB";
export const MAX_SCROLL_TEXT_LENGTH = 20;

// Wire code → microbit_input event char.
export const EVENT_CODE_TO_CHAR = Object.freeze({
  A: " ", // Button A pressed
  B: "q", // Button B pressed
  AB: "r", // Buttons A+B pressed
  P0: "0", // Pin P0 released
  P1: "1", // Pin P1 released
  P2: "2", // Pin P2 released
  LT: "j", // Logo touched
  LP: "h", // Logo pressed
  LR: "k", // Logo released
  LL: "l", // Logo long pressed
  SH: "i", // Gesture: shake
  TL: "a", // Gesture: tilt left
  TR: "d", // Gesture: tilt right
  SU: "y", // Gesture: screen up
  SD: "g", // Gesture: screen down
  LU: "o", // Gesture: logo up
  LD: "p", // Gesture: logo down
  FF: "t", // Gesture: free fall
});

// (deviceId, seq) pairs older than this are forgotten, so a wrapping seq
// counter can legitimately reuse a value later without being swallowed.
export const DEDUP_WINDOW_MS = 1500;

/**
 * Accumulates serial chunks and yields complete newline-terminated lines.
 * Each line is trimmed: MakeCode's serial.writeLine pads lines with spaces
 * (to a 32-byte multiple, working around a DAPLink serial issue), and no
 * field in this protocol has significant leading/trailing whitespace.
 */
export class LineSplitter {
  #buffer = "";

  /** @returns {string[]} complete lines contained in the buffer so far */
  push(chunk) {
    this.#buffer += chunk;
    const parts = this.#buffer.split("\n");
    this.#buffer = parts.pop();
    return parts.map((line) => line.trim());
  }
}

/**
 * Parse one board→browser line. Event codes are translated to the block
 * event chars via EVENT_CODE_TO_CHAR.
 * @returns one of
 *   { type: "hello", version: number, deviceId: string }
 *   { type: "event", char: string }
 *   { type: "relay", deviceId: string, seq: number,
 *     heartbeat: boolean, char: string | null }
 * or null for anything unrecognised (unknown lines are tolerated).
 */
export function parseLine(line) {
  if (typeof line !== "string" || line.length === 0) return null;

  if (line.startsWith("HELLO ")) {
    // HELLO flock <version> <deviceId> [<channel>] — the channel (the
    // board's current radio group) and any later additions are optional so
    // firmware can extend the line without breaking older browsers.
    const parts = line.split(/\s+/);
    if (parts.length < 4 || parts[1] !== "flock") return null;
    const version = Number(parts[2]);
    if (!Number.isInteger(version) || parts[3] === "") return null;
    const channel = Number(parts[4]);
    return {
      type: "hello",
      version,
      deviceId: parts[3],
      channel: Number.isInteger(channel) ? channel : null,
    };
  }

  if (line.startsWith("E:")) {
    const code = line.slice(2);
    const char = Object.prototype.hasOwnProperty.call(EVENT_CODE_TO_CHAR, code)
      ? EVENT_CODE_TO_CHAR[code]
      : undefined;
    if (char === undefined) return null;
    return { type: "event", char };
  }

  if (line.startsWith("R:")) {
    const parts = line.slice(2).split(":");
    if (parts.length !== 3) return null;
    const [deviceId, seqText, code] = parts;
    const seq = Number(seqText);
    if (deviceId === "" || !Number.isInteger(seq)) return null;
    const heartbeat = code === HEARTBEAT_CODE;
    const char = heartbeat
      ? null
      : Object.prototype.hasOwnProperty.call(EVENT_CODE_TO_CHAR, code)
        ? EVENT_CODE_TO_CHAR[code]
        : undefined;
    if (!heartbeat && char === undefined) return null;
    return { type: "relay", deviceId, seq, heartbeat, char };
  }

  return null;
}

/** Browser→board probe line. */
export function serialiseProbe() {
  return "P\n";
}

/** Browser→board channel line. Channel is clamped to the radio's 0–255. */
export function serialiseChannel(channel) {
  const n = Math.min(255, Math.max(0, Math.round(Number(channel) || 0)));
  return `G:${n}\n`;
}

/**
 * Browser→board scroll-text line. Non-ASCII characters are dropped and the
 * text is truncated to MAX_SCROLL_TEXT_LENGTH so it always fits the firmware's
 * receive buffer.
 */
export function serialiseScrollText(text) {
  const ascii = String(text)
    // Printable ASCII only; newlines would terminate the line early.
    .replace(/[^\x20-\x7e]/g, "")
    .slice(0, MAX_SCROLL_TEXT_LENGTH);
  return `S:${ascii}\n`;
}

// The firmware embeds "FLKCH:<3 digits>;" and reads its boot radio channel
// from the digits, so a freshly power-cycled remote comes up on the channel it
// was bound with. The browser patches those digits into the hex at flash time.
const CHANNEL_SENTINEL_PREFIX = "FLKCH:";

/**
 * Patch the channel sentinel digits in an Intel/universal hex. Handles the
 * sentinel string spanning record boundaries and both standard (0x00) and
 * universal-hex (0x0D) data records, and fixes the checksums of the lines it
 * touches. A universal hex contains the firmware twice (V1 + V2), so every
 * occurrence is patched. Returns the hex unchanged if no sentinel is found.
 */
export function patchChannelSentinel(hexText, channel) {
  const clamped = Math.min(255, Math.max(0, Math.round(Number(channel) || 0)));
  const digits = String(clamped).padStart(3, "0");
  const lines = hexText.split(/\r?\n/);

  // Decode every data byte in file order, remembering where it came from.
  const stream = []; // { byte, line, offset } — offset = index into data field
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.startsWith(":")) continue;
    const recordType = line.slice(7, 9);
    if (recordType !== "00" && recordType !== "0D") continue;
    const count = parseInt(line.slice(1, 3), 16);
    for (let i = 0; i < count; i++) {
      stream.push({
        byte: parseInt(line.slice(9 + i * 2, 11 + i * 2), 16),
        line: lineIndex,
        offset: i,
      });
    }
  }

  const prefixBytes = [...CHANNEL_SENTINEL_PREFIX].map((c) =>
    c.charCodeAt(0),
  );
  const dirtyLines = new Set();
  for (let i = 0; i + prefixBytes.length + 3 <= stream.length; i++) {
    if (!prefixBytes.every((b, j) => stream[i + j].byte === b)) continue;
    for (let d = 0; d < 3; d++) {
      const target = stream[i + prefixBytes.length + d];
      const newByte = digits.charCodeAt(d);
      if (target.byte === newByte) continue;
      const line = lines[target.line];
      const at = 9 + target.offset * 2;
      lines[target.line] =
        line.slice(0, at) +
        newByte.toString(16).toUpperCase().padStart(2, "0") +
        line.slice(at + 2);
      target.byte = newByte;
      dirtyLines.add(target.line);
    }
  }

  for (const lineIndex of dirtyLines) {
    const line = lines[lineIndex];
    let sum = 0;
    for (let i = 1; i < line.length - 2; i += 2) {
      sum += parseInt(line.slice(i, i + 2), 16);
    }
    const checksum = (-sum & 0xff).toString(16).toUpperCase().padStart(2, "0");
    lines[lineIndex] = line.slice(0, -2) + checksum;
  }

  return lines.join("\n");
}

/**
 * Deduplicates relayed radio packets on (deviceId, seq). Multiple tethered
 * boards listening on one channel each relay the same packet, so the first
 * copy wins and copies arriving within DEDUP_WINDOW_MS are dropped. Entries
 * expire so the wrapping seq counter can reuse values.
 */
export class RadioDeduper {
  #seen = new Map(); // "deviceId:seq" → timestamp
  #windowMs;
  #now;

  constructor({ windowMs = DEDUP_WINDOW_MS, now = Date.now } = {}) {
    this.#windowMs = windowMs;
    this.#now = now;
  }

  /** @returns {boolean} true if this (deviceId, seq) has not been seen recently */
  isNew(deviceId, seq) {
    const now = this.#now();
    // Drop expired entries so the map cannot grow unboundedly.
    for (const [key, ts] of this.#seen) {
      if (now - ts >= this.#windowMs) this.#seen.delete(key);
    }
    const key = `${deviceId}:${seq}`;
    if (this.#seen.has(key)) return false;
    this.#seen.set(key, now);
    return true;
  }
}
