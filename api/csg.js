let flock;

export function setFlockReference(ref) {
	flock = ref;
}

export const flockCSG = {
	mergeCompositeMesh(meshes) {
		if (!meshes || meshes.length === 0) return null;

		// Merge all parts into one single mesh
		const merged = BABYLON.Mesh.MergeMeshes(
			meshes,
			true, // disposeSource
			true, // allow32BitsIndices
			null, // meshSubclass
			false, // subdivideWithSubMeshes (Set to false for CSG)
			true, // multiMultiMaterials
		);

		return merged;
	},
	mergeMeshes(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Create the base CSG from the first mesh, respecting its world matrix

					let firstMesh = validMeshes[0];
					// If metadata exists, use the mesh with material.
					if (firstMesh.metadata?.modelName) {
						const meshWithMaterial =
							flock._findFirstDescendantWithMaterial(firstMesh);
						if (meshWithMaterial) {
							firstMesh = meshWithMaterial;
							firstMesh.refreshBoundingInfo();
							firstMesh.flipFaces();
						}
					}
					let baseCSG = flock.BABYLON.CSG2.FromMesh(firstMesh, false);

					// Merge subsequent meshes
					validMeshes.slice(1).forEach((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock._findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								mesh = meshWithMaterial;
								mesh.refreshBoundingInfo();
								mesh.flipFaces();
							}
						}
						const meshCSG = flock.BABYLON.CSG2.FromMesh(
							mesh,
							false,
						);
						baseCSG = baseCSG.add(meshCSG);
					});

					const mergedMesh1 = baseCSG.toMesh(
						"mergedMesh",
						validMeshes[0].getScene(),
						{
							centerMesh: false, // Keep the original combined position
							rebuildNormals: true, // Ensure normals are rebuilt for proper shading
						},
					);

					mergedMesh1.refreshBoundingInfo(); // Ensure bounding info is up-to-date
					const boundingInfo = mergedMesh1.getBoundingInfo();
					const worldCenter =
						boundingInfo.boundingBox.centerWorld.clone();

					const mergedMesh = baseCSG.toMesh(
						"mergedMesh",
						validMeshes[0].getScene(),
						{
							centerMesh: true, // Keep the original combined position
							rebuildNormals: true, // Ensure normals are rebuilt for proper shading
						},
					);

					mergedMesh.position = worldCenter;

					mergedMesh1.metadata = mergedMesh1.metadata || {};
					mergedMesh1.metadata.sharedMaterial = false;

					flock.applyResultMeshProperties(
						mergedMesh,
						firstMesh,
						modelId,
						blockId,
					);

					mergedMesh1.dispose();
					validMeshes.forEach((mesh) => mesh.dispose());

					return modelId; // Return the modelId as per original functionality
				} else {
					console.warn("No valid meshes to merge.");
					return null;
				}
			});
	},
	subtractMeshes(modelId, baseMeshName, meshNames) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();
		const debug = true;

		// HELPER: Recursively finds all meshes with materials (fixes the Star primitives)
		const collectMaterialMeshesDeep = (root) => {
			const out = [];
			const stack = [root];
			while (stack.length) {
				const node = stack.pop();
				if (!node) continue;
				if (node.getTotalVertices && node.getTotalVertices() > 0 && node.material) {
					out.push(node);
				}
				const kids = node.getChildren ? node.getChildren() : [];
				for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
			}
			return out;
		};

		// HELPER: Bakes transforms to World Space to fix alignment offsets
		const cloneForCSG = (src, name) => {
			src.computeWorldMatrix(true);
			const worldMatrix = src.getWorldMatrix();

			const dup = src.clone(name);
			dup.setParent(null);

			// This ensures the cylinder/star is exactly where you see it on screen
			dup.bakeTransformIntoVertices(worldMatrix);

			dup.position.set(0, 0, 0);
			dup.rotation.set(0, 0, 0);
			dup.rotationQuaternion = null;
			dup.scaling.set(1, 1, 1);
			dup.computeWorldMatrix(true);

			// Strip attributes to prevent property mismatch crashes
			if (dup.isVerticesDataPresent(flock.BABYLON.VertexBuffer.UVKind)) dup.removeVerticesData(flock.BABYLON.VertexBuffer.UVKind);
			if (dup.isVerticesDataPresent(flock.BABYLON.VertexBuffer.ColorKind)) dup.removeVerticesData(flock.BABYLON.VertexBuffer.ColorKind);
			if (dup.isVerticesDataPresent(flock.BABYLON.VertexBuffer.TangentKind)) dup.removeVerticesData(flock.BABYLON.VertexBuffer.TangentKind);

			return dup;
		};

		const tryCSG = (label, fn) => {
			try { return fn(); } catch (e) {
				console.log(`[subtractMeshes] CSG error in ${label}`, e);
				return null;
			}
		};

		return new Promise((resolve) => {
			flock.whenModelReady(baseMeshName, (baseMesh) => {
				if (!baseMesh) return resolve(null);

				let actualBase = baseMesh;
				if (baseMesh.metadata?.modelName) {
					const meshWithMaterial = flock._findFirstDescendantWithMaterial(baseMesh);
					if (meshWithMaterial) actualBase = meshWithMaterial;
				}

				flock.prepareMeshes(modelId, meshNames, blockId).then((validMeshes) => {
					const scene = baseMesh.getScene();

					// 1. Prepare Base
					const baseDuplicate = cloneForCSG(actualBase, "baseDuplicate");
					let outerCSG = tryCSG("FromMesh(baseDuplicate)", () =>
						flock.BABYLON.CSG2.FromMesh(baseDuplicate, false)
					);

					if (!outerCSG) {
						baseDuplicate.dispose();
						validMeshes.forEach(m => m.dispose());
						return resolve(null);
					}

					const subtractDuplicates = [];

					// 2. Prepare Tools (Cylinders, Stars, etc.)
					validMeshes.forEach((mesh, meshIndex) => {
						const parts = collectMaterialMeshesDeep(mesh);
						if (parts.length > 0) {
							const partClones = parts.map((p, i) => cloneForCSG(p, `temp_${meshIndex}_${i}`));

							let unified;
							if (partClones.length > 1) {
								// Merge multiple primitives (like the Star) into one solid
								unified = flock.BABYLON.Mesh.MergeMeshes(partClones, true, true, undefined, false, true);
							} else {
								unified = partClones[0];
							}

							if (unified) {
								unified.forceSharedVertices();
								// Flip faces only for complex models to ensure they cut inward
								if (mesh.metadata?.modelName && typeof unified.flipFaces === "function") {
									unified.flipFaces();
								}
								subtractDuplicates.push(unified);
							}
						}
					});

					// 3. Subtract
					subtractDuplicates.forEach((m, idx) => {
						const meshCSG = tryCSG(`FromMesh(tool[${idx}])`, () => flock.BABYLON.CSG2.FromMesh(m, false));
						if (!meshCSG) return;
						const next = tryCSG(`subtract tool[${idx}]`, () => outerCSG.subtract(meshCSG));
						if (next) outerCSG = next;
					});

					// 4. Final Output
					const resultMesh = outerCSG.toMesh("resultMesh", scene, { centerMesh: false });

					// Keep the result at (0,0,0) because the vertices are already in world space
					resultMesh.position.set(0, 0, 0);
					resultMesh.rotation.set(0, 0, 0);
					resultMesh.scaling.set(1, 1, 1);
					resultMesh.computeWorldMatrix(true);

					flock.applyResultMeshProperties(resultMesh, actualBase, modelId, blockId);

					// Cleanup
					baseDuplicate.dispose();
					subtractDuplicates.forEach(m => m.dispose());
					baseMesh.dispose();
					validMeshes.forEach(m => m.dispose());

					if (debug) console.log("[subtractMeshes] Pendant process complete");
					resolve(modelId);
				});
			});
		});
	},
	intersectMeshes(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Calculate the combined bounding box centre
					let min = new flock.BABYLON.Vector3(
						Number.MAX_VALUE,
						Number.MAX_VALUE,
						Number.MAX_VALUE,
					);
					let max = new flock.BABYLON.Vector3(
						Number.MIN_VALUE,
						Number.MIN_VALUE,
						Number.MIN_VALUE,
					);

					validMeshes.forEach((mesh) => {
						const boundingInfo = mesh.getBoundingInfo();
						const meshMin = boundingInfo.boundingBox.minimumWorld;
						const meshMax = boundingInfo.boundingBox.maximumWorld;

						min = flock.BABYLON.Vector3.Minimize(min, meshMin);
						max = flock.BABYLON.Vector3.Maximize(max, meshMax);
					});

					const combinedCentre = min.add(max).scale(0.5);

					let firstMesh = validMeshes[0];
					// If metadata exists, use the mesh with material.
					if (firstMesh.metadata?.modelName) {
						const meshWithMaterial =
							flock._findFirstDescendantWithMaterial(firstMesh);
						if (meshWithMaterial) {
							firstMesh = meshWithMaterial;
							firstMesh.refreshBoundingInfo();
							firstMesh.flipFaces();
						}
					}
					// Create the base CSG
					let baseCSG = flock.BABYLON.CSG2.FromMesh(firstMesh, false);

					// Intersect each subsequent mesh
					validMeshes.slice(1).forEach((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock._findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								mesh = meshWithMaterial;
								mesh.refreshBoundingInfo();
								mesh.flipFaces();
							}
						}
						const meshCSG = flock.BABYLON.CSG2.FromMesh(
							mesh,
							false,
						);
						baseCSG = baseCSG.intersect(meshCSG);
					});

					// Generate the resulting intersected mesh
					const intersectedMesh = baseCSG.toMesh(
						"intersectedMesh",
						validMeshes[0].getScene(),
					);

					// Align the resulting mesh to the combined centre
					intersectedMesh.position = combinedCentre;

					// Apply properties to the resulting mesh
					flock.applyResultMeshProperties(
						intersectedMesh,
						firstMesh,
						modelId,
						blockId,
					);

					validMeshes.forEach((mesh) => mesh.dispose());

					return modelId; // Return the modelId as per original functionality
				} else {
					console.warn("No valid meshes to intersect.");
					return null;
				}
			});
	},
	createHull(modelId, meshList) {
		const blockId = modelId;
		modelId += "_" + flock.scene.getUniqueId();

		return flock
			.prepareMeshes(modelId, meshList, blockId)
			.then((validMeshes) => {
				if (validMeshes.length) {
					// Calculate the combined bounding box centre
					let min = validMeshes[0]
						.getBoundingInfo()
						.boundingBox.minimumWorld.clone();
					let max = validMeshes[0]
						.getBoundingInfo()
						.boundingBox.maximumWorld.clone();

					validMeshes.forEach((mesh) => {
						const boundingInfo = mesh.getBoundingInfo();
						const meshMin = boundingInfo.boundingBox.minimumWorld;
						const meshMax = boundingInfo.boundingBox.maximumWorld;

						min = flock.BABYLON.Vector3.Minimize(min, meshMin);
						max = flock.BABYLON.Vector3.Maximize(max, meshMax);
					});

					const combinedCentre = min.add(max).scale(0.5);

					// Merge the valid meshes into a single mesh
					const updatedValidMeshes = validMeshes.map((mesh) => {
						if (mesh.metadata?.modelName) {
							const meshWithMaterial =
								flock._findFirstDescendantWithMaterial(mesh);
							if (meshWithMaterial) {
								meshWithMaterial.refreshBoundingInfo();
								meshWithMaterial.flipFaces();
								return meshWithMaterial;
							}
						}
						return mesh;
					});

					const mergedMesh = flock.BABYLON.Mesh.MergeMeshes(
						updatedValidMeshes,
						true,
					);

					if (!mergedMesh) {
						console.warn(
							"Failed to merge meshes for hull creation.",
						);
						return null;
					}

					// Offset the merged mesh to be locally centred
					mergedMesh.bakeTransformIntoVertices(
						flock.BABYLON.Matrix.Translation(
							-combinedCentre.x,
							-combinedCentre.y,
							-combinedCentre.z,
						),
					);

					// Apply the material of the first mesh to the merged mesh
					mergedMesh.material = updatedValidMeshes[0].material;

					// Create the convex hull physics aggregate
					const hullAggregate = new flock.BABYLON.PhysicsAggregate(
						mergedMesh,
						flock.BABYLON.PhysicsShapeType.CONVEX_HULL,
						{ mass: 0 }, // Adjust mass based on use case
						flock.scene,
					);

					// Create a debug mesh to visualize the convex hull
					const hullMesh = flock.hullMeshFromBody(hullAggregate.body);

					// Offset the debug mesh to the original world position
					hullMesh.position = combinedCentre;

					hullMesh.material = updatedValidMeshes[0].material;

					// Apply properties to the resulting mesh
					flock.applyResultMeshProperties(
						hullMesh,
						updatedValidMeshes[0],
						modelId,
						blockId,
					);
					// Dispose of original meshes after creating the hull
					validMeshes.forEach((mesh) => mesh.dispose());
					mergedMesh.dispose();

					return modelId; // Return the debug mesh for further use
				} else {
					console.warn("No valid meshes to create a hull.");
					return null;
				}
			});
	},
	hullMeshFromBody(body) {
		const bodyInfoGeom = flock.hk.getBodyGeometry(body);
		const { positions, indices } = bodyInfoGeom;

		const hullMesh = new flock.BABYLON.Mesh("custom", flock.scene);
		indices.reverse();

		const vertexData = new flock.BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;

		vertexData.applyToMesh(hullMesh);

		return hullMesh;
	},
	prepareMeshes(modelId, meshNames, blockId) {
		return Promise.all(
			meshNames.map((meshName) => {
				return new Promise((resolve) => {
					flock.whenModelReady(meshName, (mesh) => {
						if (mesh) {
							mesh.name = modelId;
							mesh.metadata = mesh.metadata || {};
							mesh.metadata.blockKey = blockId;
							resolve(mesh);
						} else {
							console.warn(
								`Could not resolve mesh for ${meshName}`,
							);
							resolve(null);
						}
					});
				});
			}),
		).then((meshes) => meshes.filter((mesh) => mesh !== null));
	},
	applyResultMeshProperties(resultMesh, referenceMesh, modelId, blockId) {
		// Copy transformation properties
		referenceMesh.material.backFaceCulling = false;
		if (referenceMesh.rotationQuaternion) {
			resultMesh.rotationQuaternion =
				referenceMesh.rotationQuaternion.clone();
		} else {
			resultMesh.rotation.copyFrom(referenceMesh.rotation);
		}
		resultMesh.scaling.copyFrom(referenceMesh.scaling);
		resultMesh.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
		resultMesh.name = modelId;
		resultMesh.metadata = resultMesh.metadata || {};
		resultMesh.metadata.blockKey = blockId;

		// Apply physics
		flock.applyPhysics(
			resultMesh,
			new flock.BABYLON.PhysicsShapeMesh(resultMesh, flock.scene),
		);

		// Log and replace default materials
		const isDefaultMaterial = (material) => {
			return (
				material instanceof flock.BABYLON.StandardMaterial &&
				material.name === "default material"
			);
		};

		const replaceMaterial = () => {
			return referenceMesh.material.clone("clonedMaterial");
		};

		if (resultMesh.material) {
			if (resultMesh.material instanceof flock.BABYLON.MultiMaterial) {
				resultMesh.material.subMaterials =
					resultMesh.material.subMaterials.map((subMaterial) => {
						if (subMaterial && isDefaultMaterial(subMaterial)) {
							return replaceMaterial();
						}
						return subMaterial;
					});
			} else if (isDefaultMaterial(resultMesh.material)) {
				resultMesh.material = replaceMaterial();
				resultMesh.material.backFaceCulling = false;
			}
		}
	},
};
