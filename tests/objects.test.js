import { expect } from "chai";

export function runCreateObjectTests(flock) {
	describe("createObject tests", function () {
		it("should create one object then create another", function (done) {
			// Create the first tree object.
			const tree1 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__1",
				color: ["#cd853f", "#66cdaa"],
				position: { x: 0, y: 0, z: -10.8 }
			});
			expect(tree1).to.be.a("string");

			// Create a second tree object.
			const tree2 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__2",
				color: ["#66cdaa", "#cd853f"],
				scale: 1,
				position: { x: -3, y: 0, z: 10.8 }
			});
			expect(tree2).to.be.a("string");
			done();
		});

		it("should hide and then show an object", async function () {
			// Create a tree object.
			const tree = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__3",
				color: ["#66cdaa", "#cd853f"],
				scale: 1,
				position: { x: -4, y: 0, z: 10.8 }
			});
			expect(tree).to.be.a("string");

			// Hide the object.
			await flock.hide(tree);
			// Wait for a short period.
			await flock.wait(1000);
			// Show the object.
			await flock.show(tree);
		});

		it("should handle multiple objects with show and hide", async function () {
			// Create several tree objects.
			const tree1 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__4",
				color: ["#66cdaa", "#cd853f"],
				position: { x: 6, y: 0, z: 10.8 }
			});
			const tree2 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__5",
				color: ["#ff00ff", "#00ff00"],
				scale: 1,
				position: { x: 4, y: 0, z: 10.8 }
			});
			const tree3 = flock.createObject({
				modelName: "tree.glb",
				modelId: "tree.glb__6",
				color: ["#ffff00", "#0000ff"],
				scale: 1,
				position: { x: -4, y: 0, z: 5 }
			});
			expect(tree1).to.be.a("string");
			expect(tree2).to.be.a("string");
			expect(tree3).to.be.a("string");

			// Hide all the objects.
			await flock.hide(tree1);
			await flock.hide(tree2);
			await flock.hide(tree3);

			// Wait for a short period.
			await flock.wait(1000);

			// Show all the objects.
			await flock.show(tree1);
			await flock.show(tree2);
			await flock.show(tree3);
		});
	});
}
