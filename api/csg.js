let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockCSG = {

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
						flock.findFirstDescendantWithMaterial(firstMesh);
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
							flock.findFirstDescendantWithMaterial(mesh);
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
		return new Promise((resolve) => {
			flock.whenModelReady(baseMeshName, (baseMesh) => {
				if (!baseMesh) {
					resolve(null);
					return;
				}

				let actualMesh = baseMesh;
				if (baseMesh.metadata?.modelName) {
					const meshWithMaterial =
						flock.findFirstDescendantWithMaterial(baseMesh);
					if (meshWithMaterial) {
						actualMesh = meshWithMaterial;
						//actualMesh.parent = null;
					}
				}

				// Ensure world matrices are computed.
				baseMesh.computeWorldMatrix(true);
				actualMesh.computeWorldMatrix(true);

				// Prepare the subtracting meshes.
				flock
					.prepareMeshes(modelId, meshNames, blockId)
					.then((validMeshes) => {
						if (validMeshes.length) {
							const scene = baseMesh.getScene();

							// Duplicate the base mesh for CSG.
							const baseDuplicate =
								actualMesh.clone("baseDuplicate");
							baseDuplicate.setParent(null);
							baseDuplicate.position = actualMesh
								.getAbsolutePosition()
								.clone();
							baseDuplicate.rotationQuaternion = null;
							baseDuplicate.rotation =
								actualMesh.absoluteRotationQuaternion
									? actualMesh.absoluteRotationQuaternion.toEulerAngles()
									: actualMesh.rotation.clone();
							baseDuplicate.computeWorldMatrix(true);

							// Duplicate the meshes to subtract.
							const meshDuplicates = validMeshes.map((mesh) => {
								// If metadata exists, use the mesh with material.
								if (mesh.metadata?.modelName) {
									const meshWithMaterial =
										flock.findFirstDescendantWithMaterial(
											mesh,
										);
									if (meshWithMaterial) {
										mesh = meshWithMaterial;
										mesh.refreshBoundingInfo();
										mesh.flipFaces();
									}
								}

								const duplicate = mesh.clone(
									"meshDuplicate",
									null,
									true,
								);
								duplicate.computeWorldMatrix(true);
								duplicate.refreshBoundingInfo();

								return duplicate;
							});
							baseDuplicate.refreshBoundingInfo();
							let outerCSG = flock.BABYLON.CSG2.FromMesh(
								baseDuplicate,
								false,
							);

							meshDuplicates.forEach((mesh) => {
								const meshCSG = flock.BABYLON.CSG2.FromMesh(
									mesh,
									false,
								);

								try {
									outerCSG = outerCSG.subtract(meshCSG);
								} catch (e) {
									console.log("CSG error", e);
								}
							});

							// Create the result mesh.
							const resultMesh = outerCSG.toMesh(
								"resultMesh",
								scene,
								{ centerMesh: false },
							);
							const localCenter = resultMesh
								.getBoundingInfo()
								.boundingBox.center.clone();

							resultMesh.setPivotMatrix(
								BABYLON.Matrix.Translation(
									localCenter.x,
									localCenter.y,
									localCenter.z,
								),
								false,
							);

							resultMesh.position.subtractInPlace(localCenter);
							//resultMesh.setParent(null);
							resultMesh.computeWorldMatrix(true);
							resultMesh.refreshBoundingInfo();

							resultMesh.computeWorldMatrix(true);

							flock.applyResultMeshProperties(
								resultMesh,
								actualMesh,
								modelId,
								blockId,
							);

							// Clean up duplicates.
							baseDuplicate.dispose();
							meshDuplicates.forEach((mesh) => mesh.dispose());

							// Clean up the original meshes used in the CSG operation.
							baseMesh.dispose();
							validMeshes.forEach((mesh) => mesh.dispose());

							resolve(modelId);
						} else {
							console.warn(
								"No valid meshes to subtract from the base mesh.",
							);
							resolve(null);
						}
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
						flock.findFirstDescendantWithMaterial(firstMesh);
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
							flock.findFirstDescendantWithMaterial(mesh);
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
							flock.findFirstDescendantWithMaterial(mesh);
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