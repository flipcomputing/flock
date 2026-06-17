import { expect } from "chai";
import {
  showBanner,
  dismissBanner,
  handleError,
  isBenignAbort,
} from "../ui/notifications.js";

export function runNotificationTests() {
  describe("error notification banners", function () {
    afterEach(function () {
      document
        .querySelectorAll(".flock-banner")
        .forEach((banner) => banner.remove());
    });

    it("shows a banner with the given message and alert role", function () {
      showBanner("test-show", { message: "Something went wrong" });
      const banner = document.querySelector(".flock-banner");
      expect(banner).to.exist;
      expect(banner.textContent).to.contain("Something went wrong");
      expect(banner.getAttribute("role")).to.equal("alert");
    });

    it("reuses one banner per id instead of stacking duplicates", function () {
      showBanner("test-dedupe", { message: "First" });
      showBanner("test-dedupe", { message: "Second" });
      const banners = document.querySelectorAll(".flock-banner");
      expect(banners.length).to.equal(1);
      expect(banners[0].textContent).to.contain("Second");
    });

    it("dismissBanner removes the banner", function () {
      showBanner("test-dismiss", { message: "Dismiss me" });
      dismissBanner("test-dismiss");
      expect(document.querySelector(".flock-banner")).to.not.exist;
    });

    it("renders a working action button when an action is supplied", function () {
      let clicked = false;
      showBanner("test-action", {
        message: "With action",
        action: { label: "Do it", onClick: () => (clicked = true) },
      });
      const actionButton = document.querySelector(".flock-banner__action");
      expect(actionButton).to.exist;
      expect(actionButton.textContent).to.equal("Do it");
      actionButton.click();
      expect(clicked).to.equal(true);
    });

    it("handleError shows a fatal banner with a reload action", function () {
      handleError(new Error("boom"), { source: "startup", fatal: true });
      expect(document.querySelector(".flock-banner")).to.exist;
      expect(document.querySelector(".flock-banner__action")).to.exist;
    });

    it("handleError shows a non-fatal banner with no reload action", function () {
      handleError(new Error("boom"), {
        source: "project-run",
        fatal: false,
      });
      expect(document.querySelector(".flock-banner")).to.exist;
      expect(document.querySelector(".flock-banner__action")).to.not.exist;
    });

    it("never leaks the raw error detail to the banner", function () {
      handleError(new Error("SECRET_STACK_DETAIL"), {
        source: "project-run",
        fatal: false,
      });
      const banner = document.querySelector(".flock-banner");
      expect(banner.textContent).to.not.contain("SECRET_STACK_DETAIL");
    });

    it("treats AbortError and plain aborts as benign", function () {
      expect(isBenignAbort(new DOMException("Aborted", "AbortError"))).to.equal(
        true,
      );
      expect(isBenignAbort(new Error("The operation was aborted"))).to.equal(
        true,
      );
    });

    it("does not treat a physics WASM out-of-memory abort as benign", function () {
      const wasmError = new WebAssembly.RuntimeError("abort: out of memory");
      expect(isBenignAbort(wasmError)).to.equal(false);
    });

    it("does not treat ordinary errors as benign", function () {
      expect(isBenignAbort(new Error("something else broke"))).to.equal(false);
    });
  });
}
