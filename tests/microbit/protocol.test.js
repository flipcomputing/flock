import { expect } from "chai";
import {
  PROTOCOL_VERSION,
  HEARTBEAT_CODE,
  EVENT_CODE_TO_CHAR,
  LineSplitter,
  RadioDeduper,
  parseLine,
  patchChannelSentinel,
  serialiseProbe,
  serialiseChannel,
  serialiseScrollText,
  serialiseImageRows,
  normaliseImagePattern,
  MAX_SCROLL_TEXT_LENGTH,
  MICROBIT_IMAGE_LENGTH,
} from "../../microbit/protocol.js";

// Build a valid Intel-hex record from bytes (test-side, so the patcher's
// checksum math is verified against an independent implementation).
function makeRecord(address, recordType, bytes) {
  const fields = [bytes.length, (address >> 8) & 0xff, address & 0xff];
  const all = [...fields, parseInt(recordType, 16), ...bytes];
  const sum = all.reduce((a, b) => a + b, 0);
  const checksum = -sum & 0xff;
  const hex = (n) => n.toString(16).toUpperCase().padStart(2, "0");
  return (
    ":" +
    hex(bytes.length) +
    hex((address >> 8) & 0xff) +
    hex(address & 0xff) +
    recordType +
    bytes.map(hex).join("") +
    hex(checksum)
  );
}

function recordChecksumIsValid(line) {
  let sum = 0;
  for (let i = 1; i < line.length; i += 2) {
    sum += parseInt(line.slice(i, i + 2), 16);
  }
  return (sum & 0xff) === 0;
}

function decodeAscii(lines) {
  let text = "";
  for (const line of lines) {
    if (!line.startsWith(":")) continue;
    const type = line.slice(7, 9);
    if (type !== "00" && type !== "0D") continue;
    const count = parseInt(line.slice(1, 3), 16);
    for (let i = 0; i < count; i++) {
      text += String.fromCharCode(parseInt(line.slice(9 + i * 2, 11 + i * 2), 16));
    }
  }
  return text;
}

export function runMicrobitProtocolTests() {
  describe("micro:bit protocol @microbit", function () {
    describe("LineSplitter", function () {
      it("splits complete lines and keeps the remainder buffered", function () {
        const splitter = new LineSplitter();
        expect(splitter.push("E:SH\nE:")).to.deep.equal(["E:SH"]);
        expect(splitter.push("TL\n")).to.deep.equal(["E:TL"]);
      });

      it("reassembles lines split across chunk boundaries", function () {
        const splitter = new LineSplitter();
        expect(splitter.push("HELLO fl")).to.deep.equal([]);
        expect(splitter.push("ock 1 123")).to.deep.equal([]);
        expect(splitter.push("45\nE:A\n")).to.deep.equal([
          "HELLO flock 1 12345",
          "E:A",
        ]);
      });

      it("strips trailing carriage returns", function () {
        const splitter = new LineSplitter();
        expect(splitter.push("E:AB\r\nE:P0\r\n")).to.deep.equal([
          "E:AB",
          "E:P0",
        ]);
      });

      it("trims MakeCode's space padding from lines", function () {
        // serial.writeLine pads lines with spaces to a 32-byte multiple.
        const splitter = new LineSplitter();
        expect(
          splitter.push("E:SH                          \n  E:SU\n"),
        ).to.deep.equal(["E:SH", "E:SU"]);
      });

      it("yields several lines from one chunk", function () {
        const splitter = new LineSplitter();
        expect(splitter.push("E:SU\nE:SD\nE:FF\n")).to.deep.equal([
          "E:SU",
          "E:SD",
          "E:FF",
        ]);
      });
    });

    describe("parseLine", function () {
      it("parses HELLO", function () {
        expect(parseLine("HELLO flock 1 987654321")).to.deep.equal({
          type: "hello",
          version: 1,
          deviceId: "987654321",
          channel: null,
        });
        expect(PROTOCOL_VERSION).to.equal(3);
      });

      it("parses HELLO with the board's channel appended", function () {
        // The firmware sends "HELLO flock 1 <deviceId> <channel>".
        expect(parseLine("HELLO flock 1 987654321 7")).to.deep.equal({
          type: "hello",
          version: 1,
          deviceId: "987654321",
          channel: 7,
        });
      });

      it("parses HELLO with a negative device id", function () {
        // control.deviceSerialNumber() is a signed integer on the micro:bit.
        expect(parseLine("HELLO flock 1 -12345")).to.deep.equal({
          type: "hello",
          version: 1,
          deviceId: "-12345",
          channel: null,
        });
      });

      it("maps every event code to its block event char", function () {
        const expected = {
          A: " ",
          B: "q",
          AB: "r",
          P0: "0",
          P1: "1",
          P2: "2",
          LT: "j",
          LP: "h",
          LR: "k",
          LL: "l",
          SH: "i",
          TL: "a",
          TR: "d",
          SU: "y",
          SD: "g",
          LU: "o",
          LD: "p",
          FF: "t",
        };
        expect(EVENT_CODE_TO_CHAR).to.deep.equal(expected);
        for (const [code, char] of Object.entries(expected)) {
          expect(parseLine(`E:${code}`)).to.deep.equal({
            type: "event",
            char,
          });
        }
      });

      it("parses relayed radio events", function () {
        expect(parseLine("R:12345:7:SH")).to.deep.equal({
          type: "relay",
          deviceId: "12345",
          seq: 7,
          heartbeat: false,
          char: "i",
        });
      });

      it("parses relayed heartbeats", function () {
        expect(parseLine(`R:12345:8:${HEARTBEAT_CODE}`)).to.deep.equal({
          type: "relay",
          deviceId: "12345",
          seq: 8,
          heartbeat: true,
          char: null,
        });
      });

      it("tolerates unknown lines and malformed input", function () {
        expect(parseLine("")).to.equal(null);
        expect(parseLine("garbage")).to.equal(null);
        expect(parseLine("E:ZZ")).to.equal(null); // unknown event code
        expect(parseLine("E:")).to.equal(null);
        expect(parseLine("E:toString")).to.equal(null); // inherited object keys are not valid event codes
        expect(parseLine("HELLO flock x 123")).to.equal(null);
        expect(parseLine("HELLO other 1 123")).to.equal(null);
        expect(parseLine("R:123:notanumber:SH")).to.equal(null);
        expect(parseLine("R::7:SH")).to.equal(null);
        expect(parseLine("R:123:7")).to.equal(null);
        expect(parseLine("R:123:7:ZZ")).to.equal(null);
      });
    });

    describe("serialise", function () {
      it("serialises the probe", function () {
        expect(serialiseProbe()).to.equal("P\n");
      });

      it("serialises and clamps the channel", function () {
        expect(serialiseChannel(1)).to.equal("G:1\n");
        expect(serialiseChannel(0)).to.equal("G:0\n");
        expect(serialiseChannel(255)).to.equal("G:255\n");
        expect(serialiseChannel(300)).to.equal("G:255\n");
        expect(serialiseChannel(-4)).to.equal("G:0\n");
        expect(serialiseChannel("7")).to.equal("G:7\n");
        expect(serialiseChannel("junk")).to.equal("G:0\n");
      });

      it("serialises scroll text, ASCII-only and truncated", function () {
        expect(serialiseScrollText("microbit1")).to.equal("S:microbit1\n");
        expect(
          serialiseScrollText("a".repeat(MAX_SCROLL_TEXT_LENGTH + 10)),
        ).to.equal(`S:${"a".repeat(MAX_SCROLL_TEXT_LENGTH)}\n`);
        expect(serialiseScrollText("héllo\nworld")).to.equal("S:hlloworld\n");
      });

      it("serialises an image as five short row lines", function () {
        const pattern = "9090909990999990999090909";
        expect(pattern.length).to.equal(MICROBIT_IMAGE_LENGTH);
        expect(serialiseImageRows(pattern)).to.deep.equal([
          "I:090909\n",
          "I:109990\n",
          "I:299999\n",
          "I:309990\n",
          "I:490909\n",
        ]);
        // Every line must fit the firmware's <20-byte receive buffer.
        for (const line of serialiseImageRows(pattern)) {
          expect(line.length).to.be.at.most(19);
        }
      });

      it("normalises image patterns: pad, truncate, non-digits, non-strings", function () {
        expect(normaliseImagePattern("999")).to.equal(
          "999" + "0".repeat(MICROBIT_IMAGE_LENGTH - 3),
        );
        expect(normaliseImagePattern("9".repeat(30))).to.equal(
          "9".repeat(MICROBIT_IMAGE_LENGTH),
        );
        expect(normaliseImagePattern("9x9.9-9 9")).to.equal(
          "909090909" + "0".repeat(MICROBIT_IMAGE_LENGTH - 9),
        );
        expect(normaliseImagePattern(null)).to.equal(
          "0".repeat(MICROBIT_IMAGE_LENGTH),
        );
        expect(normaliseImagePattern(undefined)).to.equal(
          "0".repeat(MICROBIT_IMAGE_LENGTH),
        );
        expect(normaliseImagePattern(42)).to.equal(
          "42" + "0".repeat(MICROBIT_IMAGE_LENGTH - 2),
        );
        expect(serialiseImageRows("abc")).to.deep.equal([
          "I:000000\n",
          "I:100000\n",
          "I:200000\n",
          "I:300000\n",
          "I:400000\n",
        ]);
      });
    });

    describe("patchChannelSentinel", function () {
      const toBytes = (s) => [...s].map((c) => c.charCodeAt(0));

      it("patches the sentinel digits and fixes the checksum", function () {
        const hex = [
          makeRecord(0, "00", toBytes("xxFLKCH:001;yzab")),
          ":00000001FF",
        ].join("\n");
        const patched = patchChannelSentinel(hex, 42);
        const lines = patched.split("\n");
        expect(decodeAscii(lines)).to.include("FLKCH:042;");
        expect(recordChecksumIsValid(lines[0])).to.equal(true);
      });

      it("handles the sentinel spanning record boundaries", function () {
        const part1 = "dataFLKC";
        const part2 = "H:001;more";
        const hex = [
          makeRecord(0, "00", toBytes(part1)),
          makeRecord(8, "00", toBytes(part2)),
          ":00000001FF",
        ].join("\n");
        const patched = patchChannelSentinel(hex, 255);
        const lines = patched.split("\n");
        expect(decodeAscii(lines)).to.include("FLKCH:255;");
        expect(recordChecksumIsValid(lines[0])).to.equal(true);
        expect(recordChecksumIsValid(lines[1])).to.equal(true);
      });

      it("patches every occurrence (V1 data and V2 0D records)", function () {
        const hex = [
          makeRecord(0, "00", toBytes("FLKCH:001;")),
          makeRecord(0, "0D", toBytes("FLKCH:001;")),
          ":00000001FF",
        ].join("\n");
        const lines = patchChannelSentinel(hex, 9).split("\n");
        expect(decodeAscii([lines[0]])).to.equal("FLKCH:009;");
        expect(decodeAscii([lines[1]])).to.equal("FLKCH:009;");
        expect(recordChecksumIsValid(lines[0])).to.equal(true);
        expect(recordChecksumIsValid(lines[1])).to.equal(true);
      });

      it("returns the hex unchanged when there is no sentinel", function () {
        const hex = [makeRecord(0, "00", toBytes("no marker here")), ":00000001FF"].join(
          "\n",
        );
        expect(patchChannelSentinel(hex, 42)).to.equal(hex);
      });

      it("leaves the hex untouched when the channel already matches", function () {
        const hex = [makeRecord(0, "00", toBytes("FLKCH:042;")), ":00000001FF"].join(
          "\n",
        );
        expect(patchChannelSentinel(hex, 42)).to.equal(hex);
      });
    });

    describe("RadioDeduper", function () {
      it("passes the first copy and drops repeats of (deviceId, seq)", function () {
        const deduper = new RadioDeduper();
        expect(deduper.isNew("123", 1)).to.equal(true);
        expect(deduper.isNew("123", 1)).to.equal(false);
        expect(deduper.isNew("123", 2)).to.equal(true);
        expect(deduper.isNew("456", 1)).to.equal(true); // other board, same seq
      });

      it("expires entries so a wrapping seq counter can reuse values", function () {
        let time = 0;
        const deduper = new RadioDeduper({ windowMs: 100, now: () => time });
        expect(deduper.isNew("123", 5)).to.equal(true);
        time = 50;
        expect(deduper.isNew("123", 5)).to.equal(false);
        time = 200;
        expect(deduper.isNew("123", 5)).to.equal(true);
      });
    });
  });
}
