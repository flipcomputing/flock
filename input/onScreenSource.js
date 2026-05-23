import { normaliseKey } from "./normaliseKey.js";

export class OnScreenSource {
  #inputManager;
  #pressObservable;
  #releaseObservable;

  constructor(inputManager, { pressObservable, releaseObservable }) {
    this.#inputManager = inputManager;
    this.#pressObservable = pressObservable;
    this.#releaseObservable = releaseObservable;
  }

  press(key) {
    const canonical = normaliseKey(key);
    this.#inputManager._setKey(canonical, true);
    this.#pressObservable.notifyObservers(canonical);
  }

  release(key) {
    const canonical = normaliseKey(key);
    this.#inputManager._setKey(canonical, false);
    this.#releaseObservable.notifyObservers(canonical);
  }
}
