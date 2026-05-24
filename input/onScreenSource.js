import { normaliseKey } from "./normaliseKey.js";

export class OnScreenSource {
  #inputManager;

  constructor(inputManager) {
    this.#inputManager = inputManager;
  }

  press(key) {
    this.#inputManager._setKey(normaliseKey(key), true);
  }

  release(key) {
    this.#inputManager._setKey(normaliseKey(key), false);
  }
}
