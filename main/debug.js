import { flock } from "../flock.js";

window.flockDebug = {
	info() {
		console.log("=== FLOCK DEBUG INFO ===");

		const blocks = workspace.getAllBlocks();
		const allMeshes = flock.scene.meshes;
		const relevantMeshes = allMeshes.filter(
			(m) =>
				m.name !== "__root__" &&
				!m.name.includes("_primitive") &&
				!m.name.includes(".glb_first") &&
				!m.name.includes("Constraint_"),
		);

		console.log(
			`📦 Blocks: ${blocks.length}, 🎮 Meshes: ${relevantMeshes.length}, 🔗 Tracked: ${Object.keys(meshMap).length}`,
		);

		// Camera info
		const camera = flock.scene.activeCamera;
		if (camera) {
			const pos = camera.position;
			console.log(
				`📷 Camera at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
			);
		}

		let workingConnections = 0;
		let missingMeshes = 0;
		const trackedMeshNames = new Set();

		Object.entries(meshMap).forEach(([meshId, block]) => {
			trackedMeshNames.add(meshId);
			const meshExists = allMeshes.some((m) => m.name === meshId);

			if (meshExists) {
				workingConnections++;
				console.log(`  ✅ ${meshId} → ${block.type}`);
			} else {
				missingMeshes++;
				console.log(`  ❌ ${meshId} → ${block.type} (MISSING)`);
			}
		});

		// Find orphaned meshes
		const orphanedMeshes = relevantMeshes.filter(
			(mesh) =>
				!trackedMeshNames.has(mesh.name) &&
				!Array.from(trackedMeshNames).some((id) =>
					mesh.name.includes(id.split("__")[0]),
				),
		);

		console.log(
			`\n📊 SUMMARY: ✅ ${workingConnections} working, ❌ ${missingMeshes} missing, 🚨 ${orphanedMeshes.length} orphaned`,
		);

		if (orphanedMeshes.length > 0 && orphanedMeshes.length <= 10) {
			console.log("🚨 ORPHANED MESHES:");
			orphanedMeshes.forEach((mesh) => {
				const pos = mesh.position;
				console.log(
					`  - ${mesh.name} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
				);
			});
		} else if (orphanedMeshes.length > 10) {
			console.log(
				`🚨 ${orphanedMeshes.length} orphaned meshes (too many to list)`,
			);
		}
	},

	goTo(objectName) {
		const mesh = flock.scene.getMeshByName(objectName);
		if (!mesh) {
			console.log(`❌ Object "${objectName}" not found`);

			if (
				!this._cachedAvailable ||
				this._cacheTime < Date.now() - 5000
			) {
				this._cachedAvailable = flock.scene.meshes
					.filter(
						(m) =>
							m.name !== "__root__" &&
							!m.name.includes("_primitive") &&
							!m.name.includes(".glb_first"),
					)
					.map((m) => m.name);
				this._cacheTime = Date.now();
			}

			console.log(
				"Available objects:",
				this._cachedAvailable.slice(0, 10).join(", ") +
					(this._cachedAvailable.length > 10
						? `... and ${this._cachedAvailable.length - 10} more`
						: ""),
			);
			return;
		}

		const camera = flock.scene.activeCamera;
		if (camera) {
			const meshPos = mesh.position;
			const offset = new flock.BABYLON.Vector3(5, 5, 5);
			camera.position = meshPos.add(offset);
			camera.setTarget(meshPos);
			console.log(
				`📷 Moved to ${objectName} at (${meshPos.x.toFixed(1)}, ${meshPos.y.toFixed(1)}, ${meshPos.z.toFixed(1)})`,
			);
		}
	},

	health() {
		const blockCount = workspace.getAllBlocks().length;
		const meshCount = flock.scene.meshes.filter(
			(m) => m.name !== "__root__",
		).length;
		const trackedCount = Object.keys(meshMap).length;

		const workingCount = Object.keys(meshMap).filter((meshId) =>
			flock.scene.getMeshByName(meshId),
		).length;

		console.log("=== QUICK HEALTH CHECK ===");
		console.log(
			`📊 ${blockCount} blocks, ${meshCount} meshes, ${trackedCount} tracked`,
		);
		console.log(
			`${workingCount === trackedCount ? "✅" : "⚠️"} ${workingCount}/${trackedCount} connections working`,
		);

		if (workingCount === trackedCount && trackedCount > 0) {
			console.log("✅ System is healthy!");
		} else {
			console.log(
				"⚠️ Issues detected. Run flockDebug.info() for details",
			);
		}
	},
};

console.log("🛠️ Flock Debug loaded! Commands:");
console.log("  flockDebug.health() - Quick health check");
console.log("  flockDebug.info() - Detailed analysis");
console.log("  flockDebug.goTo('objectName') - Move camera to object");
