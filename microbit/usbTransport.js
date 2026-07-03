// Thin wrapper around @microbit/microbit-connection's MicrobitWebUSBConnection
// for one tethered board: device picker / silent reconnect, line-oriented DAP
// serial, flashing with progress, and the USB serial number used to recognise
// the board again in navigator.usb.getDevices(). All protocol knowledge lives
// in protocol.js / manager.js; this class only moves lines and hex files.
import {
  createWebUSBConnection,
  createUniversalHexFlashDataSource,
  ConnectionStatus,
} from "@microbit/microbit-connection";
import { LineSplitter } from "./protocol.js";

export class MicrobitUsbTransport {
  #connection;
  #splitter = new LineSplitter();
  #lineListeners = new Set();
  #disconnectListeners = new Set();
  #connected = false;

  constructor({ connection } = {}) {
    this.#connection = connection ?? createWebUSBConnection();

    this.#connection.addEventListener("serialdata", (event) => {
      for (const line of this.#splitter.push(event.data)) {
        for (const listener of this.#lineListeners) listener(line);
      }
    });
    this.#connection.addEventListener("status", (event) => {
      if (
        this.#connected &&
        (event.status === ConnectionStatus.DISCONNECTED ||
          event.status === ConnectionStatus.NO_AUTHORIZED_DEVICE)
      ) {
        this.#connected = false;
        for (const listener of this.#disconnectListeners) listener();
      }
    });
  }

  /**
   * Connect to a board. Shows the browser's device picker unless the
   * connection was created in a mode that can silently claim an already
   * authorised device. Must be called from a user gesture when picking.
   */
  async connect() {
    await this.#connection.initialize();
    const status = await this.#connection.connect();
    if (status !== ConnectionStatus.CONNECTED) {
      throw new Error(`micro:bit connection failed (${status})`);
    }
    this.#connected = true;
  }

  onLine(listener) {
    this.#lineListeners.add(listener);
    return () => this.#lineListeners.delete(listener);
  }

  onDisconnect(listener) {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  async writeLine(lineWithNewline) {
    await this.#connection.serialWrite(lineWithNewline);
  }

  /**
   * USB serial number of the DAPLink interface chip. This is NOT the board's
   * canonical device id (that comes from the HELLO line); it is stored only to
   * recognise the board in navigator.usb.getDevices() for silent reconnect.
   */
  get usbSerialNumber() {
    return this.#connection.getDevice()?.serialNumber;
  }

  /**
   * Flash a universal hex (V1+V2). Forces a full flash — the bundled firmware
   * shares nothing with whatever program is on the board.
   * @param {string} hexText
   * @param {(percentage: number | undefined) => void} [onProgress]
   */
  async flash(hexText, onProgress) {
    await this.#connection.flash(createUniversalHexFlashDataSource(hexText), {
      partial: false,
      progress: (percentage) => onProgress?.(percentage),
    });
  }

  #disposed = false;

  /**
   * Disconnect and dispose. Idempotent. Disposing matters even after the
   * link already dropped: the connection object keeps visibilitychange /
   * beforeunload / usb listeners that would otherwise auto-reconnect it
   * later and fight any newer connection for the DAPLink interface
   * (mismatched command/response errors).
   */
  async disconnect() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#connected = false;
    try {
      await this.#connection.disconnect();
    } finally {
      this.#connection.dispose();
    }
  }
}
