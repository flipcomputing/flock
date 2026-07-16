import { expect } from "chai";
import { showStatus, clearStatus } from "../ui/status.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function runStatusTests() {
  describe("ui/status editor status line", function () {
    let element;

    beforeEach(function () {
      element = document.createElement("p");
      element.id = "gizmoStatus";
      document.body.appendChild(element);
    });

    afterEach(function () {
      clearStatus();
      element.remove();
    });

    it("shows a plain message", function () {
      showStatus("Click an object to delete it.");
      expect(element.textContent).to.equal("Click an object to delete it.");
    });

    it("replaces the previous message instead of stacking", function () {
      showStatus("First");
      showStatus("Second");
      expect(element.textContent).to.equal("Second");
      expect(element.childNodes.length).to.equal(1);
    });

    it("clearStatus empties the line", function () {
      showStatus("Transient");
      clearStatus();
      expect(element.textContent).to.equal("");
    });

    it("does not auto-hide a message with duration 0", async function () {
      showStatus("Sticky prompt");
      await wait(60);
      expect(element.textContent).to.equal("Sticky prompt");
    });

    it("hides a message once its duration elapses", async function () {
      showStatus("Fades away", { duration: 0.05 });
      expect(element.textContent).to.equal("Fades away");
      await wait(120);
      expect(element.textContent).to.equal("");
    });

    it("does not let a replaced message's timer clear its successor", async function () {
      showStatus("Old", { duration: 0.05 });
      showStatus("New");
      await wait(120);
      expect(element.textContent).to.equal("New");
    });

    it("leaves another owner's message alone", function () {
      showStatus("Delete prompt", { owner: "scene-pick" });
      clearStatus("placement");
      expect(element.textContent).to.equal("Delete prompt");
    });

    it("clears its own owner's message", function () {
      showStatus("Delete prompt", { owner: "scene-pick" });
      clearStatus("scene-pick");
      expect(element.textContent).to.equal("");
    });

    it("clears any message when no owner is given", function () {
      showStatus("Delete prompt", { owner: "scene-pick" });
      clearStatus();
      expect(element.textContent).to.equal("");
    });

    it("does not clear an unowned message by owner", function () {
      showStatus("Unowned");
      clearStatus("scene-pick");
      expect(element.textContent).to.equal("Unowned");
    });

    it("releases the owner when a message is replaced", function () {
      showStatus("First", { owner: "scene-pick" });
      showStatus("Second", { owner: "axis" });
      clearStatus("scene-pick");
      expect(element.textContent).to.equal("Second");
    });

    it("releases the owner once the message auto-hides", async function () {
      showStatus("Timed", { owner: "axis", duration: 0.05 });
      await wait(120);
      showStatus("Later", { owner: "scene-pick" });
      clearStatus("axis");
      expect(element.textContent).to.equal("Later");
    });

    it("applies the axis and pill classes and the inline border colour", function () {
      showStatus([
        { text: "Position: " },
        { text: "x", bold: true },
        { text: ": " },
        { text: "-5.3", borderColor: "#0072B2" },
      ]);
      expect(element.textContent).to.equal("Position: x: -5.3");

      const axis = element.querySelector(".gizmo-status__axis");
      expect(axis).to.exist;
      expect(axis.textContent).to.equal("x");

      const pill = element.querySelector(".gizmo-status__pill");
      expect(pill).to.exist;
      expect(pill.textContent).to.equal("-5.3");

      // Compare against a probe so the assertion survives the browser
      // normalising the hex to rgb().
      const probe = document.createElement("span");
      probe.style.borderColor = "#0072B2";
      expect(pill.style.borderColor).to.equal(probe.style.borderColor);
    });

    it("leaves plain segments as text nodes", function () {
      showStatus([{ text: "just text" }]);
      expect(element.querySelectorAll("span").length).to.equal(0);
      expect(element.textContent).to.equal("just text");
    });

    it("replaces segment content rather than appending to it", function () {
      showStatus([{ text: "x", bold: true }]);
      showStatus([{ text: "y", bold: true }]);
      expect(element.textContent).to.equal("y");
      expect(element.querySelectorAll(".gizmo-status__axis").length).to.equal(1);
    });

    it("treats message text as text, never as markup", function () {
      showStatus("<b>not bold</b>");
      expect(element.querySelector("b")).to.not.exist;
      expect(element.textContent).to.equal("<b>not bold</b>");

      showStatus([{ text: "<img src=x onerror=oops>", bold: true }]);
      expect(element.querySelector("img")).to.not.exist;
      expect(element.textContent).to.equal("<img src=x onerror=oops>");
    });

    it("does nothing when the status element is absent", function () {
      element.remove();
      expect(() => showStatus("No element")).to.not.throw();
      expect(() => clearStatus()).to.not.throw();
    });
  });
}
