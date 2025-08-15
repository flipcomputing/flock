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
		  if (!baseMesh) { resolve(null); return; }

		  let actualMesh = baseMesh;
		  if (baseMesh.metadata?.modelName) {
			const withMat = flock.findFirstDescendantWithMaterial(baseMesh);
			if (withMat) actualMesh = withMat;
		  }

		  baseMesh.computeWorldMatrix(true);
		  actualMesh.computeWorldMatrix(true);

		  flock.prepareMeshes(modelId, meshNames, blockId).then((validMeshes) => {
			if (!validMeshes.length) { resolve(null); return; }

			const BAB = flock.BABYLON;
			const scene = baseMesh.getScene();

			// helper: clone -> set world TRS -> bake -> identity
			const toWorldBaked = (src, name) => {
			  const dup = src.clone(name, null, /*cloneChildren*/ true);
			  dup.setParent(null);
			  const S = new BAB.Vector3(), Q = new BAB.Quaternion(), P = new BAB.Vector3();
			  src.getWorldMatrix().decompose(S, Q, P);
			  dup.position = P; dup.rotationQuaternion = Q; dup.scaling = S;
			  dup.computeWorldMatrix(true);
			  dup.bakeCurrentTransformIntoVertices();           // 🔑 vertices now in world coords
			  dup.setPivotMatrix(BAB.Matrix.Identity(), false); // clean local
			  dup.position.set(0,0,0);
			  dup.rotationQuaternion = BAB.Quaternion.Identity();
			  dup.scaling.set(1,1,1);
			  dup.computeWorldMatrix(true);
			  dup.refreshBoundingInfo(true);
			  dup.physicsBody?.dispose?.(); // belt & braces: ensure no physics
			  return dup;
			};

			// world-baked base and cutters
			const baseDup = toWorldBaked(actualMesh, "csg_base");
			const cutters = validMeshes.map((m0) => {
			  let m = m0;
			  if (m.metadata?.modelName) {
				const withMat = flock.findFirstDescendantWithMaterial(m);
				if (withMat) m = withMat;
			  }
			  return toWorldBaked(m, "csg_cutter");
			});

			// build CSG in world coordinates
			let csg = BAB.CSG2.FromMesh(baseDup, false);
			for (const d of cutters) {
			  try { csg = csg.subtract(BAB.CSG2.FromMesh(d, false)); }
			  catch (e) { console.warn("CSG subtract error:", e); }
			}

			// result geometry is already in world space — don’t recenter/pivot/bake here
			const resultMesh = csg.toMesh("resultMesh", scene, { centerMesh: false });
			resultMesh.computeWorldMatrix(true);
			resultMesh.refreshBoundingInfo(true);

			// absolutely NO parenting or pivot changes here yet
			resultMesh.physicsBody?.dispose?.();

			// quick diagnostics
			console.log("[csg] hasBody?", !!resultMesh.physicsBody);
			console.log("[csg] abs pos", resultMesh.getAbsolutePosition().toString());
			console.log("[csg] aabb minY/maxY",
			  resultMesh.getBoundingInfo().boundingBox.minimumWorld.y,
			  resultMesh.getBoundingInfo().boundingBox.maximumWorld.y
			);

			flock.applyResultMeshProperties?.(resultMesh, actualMesh, modelId, blockId, { skipPhysics: true });

			// cleanup
			baseDup.dispose();
			cutters.forEach((m) => m.dispose());
			baseMesh.dispose();
			validMeshes.forEach((m) => m.dispose());

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
						mesh.blockKey = blockId;
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
	resultMesh.blockKey = blockId;

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