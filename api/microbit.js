import { getMicrobitManager } from "../microbit/manager.js";

// Kept for consistency with the other api modules; addMicrobit itself only
// needs the manager.
let _flock;

export function setFlockReference(ref) {
  _flock = ref;
}

export const flockMicrobit = {
  /*
    Category: Sensing
  */

  /**
   * Register a micro:bit variable and its radio channel. Emitted by the
   * add_microbit block. Pushes the channel to the variable's board if it is
   * currently tethered; otherwise the channel is applied when the board next
   * tethers.
   */
  addMicrobit(variableName, channel = 1) {
    if (typeof variableName !== "string" || variableName === "") {
      console.warn("addMicrobit: variableName must be a non-empty string");
      return;
    }
    const channelValue =
      typeof channel === "string" ? Number(channel) : channel;
    if (
      typeof channelValue !== "number" ||
      !Number.isSafeInteger(channelValue) ||
      channelValue < 0 ||
      channelValue > 255
    ) {
      console.warn("addMicrobit: channel must be an integer between 0 and 255");
      return;
    }
    getMicrobitManager().setVariableChannel(variableName, channelValue, {
      forcePush: true,
    });
  },
};
