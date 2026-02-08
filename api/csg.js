let flock;

export function setFlockReference(ref) {
        flock = ref;
}

/**
 * Prepares a mesh for CSG operations by ensuring it has valid geometry.
 * Handles 3D text and other composite meshes that may have children with geometry
 * but no geometry on the parent mesh itself.
 * @param {BABYLON.Mesh} mesh - The mesh to prepare
 * @returns {BABYLON.Mesh|null} - A mesh suitable for CSG operations, or null if no valid geometry found
 */
function prepareMeshForCSG(mesh) {
        if (!mesh) return null;

        // Check if mesh itself has valid geometry using multiple methods
        const hasVertices = mesh.getTotalVertices && mesh.getTotalVertices() > 0;
        const hasPositions =
                mesh.getVerticesData &&
                mesh.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
        const hasIndices = mesh.getIndices && mesh.getIndices();

        // If mesh has positions but no indices, it might need conversion
        if (hasPositions && !hasIndices) {
                // Try to create indices if mesh has non-indexed geometry
                try {
                        mesh.convertToUnIndexedMesh();
                        mesh.forceSharedVertices();
                } catch (e) {
                        // Ignore errors, continue with other approaches
                }
        }

        // Re-check after potential conversion
        const hasValidGeometry =
                mesh.getTotalVertices &&
                mesh.getTotalVertices() > 0 &&
                mesh.getIndices &&
                mesh.getIndices() &&
                mesh.getIndices().length > 0;

        if (hasValidGeometry) {
                return mesh;
        }

        // Mesh has no geometry, check for children with geometry
        const children = mesh.getChildMeshes ? mesh.getChildMeshes(false) : [];
        const meshesWithGeometry = children.filter((child) => {
                const childHasVertices =
                        child.getTotalVertices && child.getTotalVertices() > 0;
                const childHasIndices =
                        child.getIndices &&
                        child.getIndices() &&
                        child.getIndices().length > 0;
                return childHasVertices && childHasIndices;
        });

        // Also check for children that might have positions but need processing
        if (meshesWithGeometry.length === 0) {
                const childrenWithPositions = children.filter((child) => {
                        const positions =
                                child.getVerticesData &&
                                child.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
                        return positions && positions.length > 0;
                });

                if (childrenWithPositions.length > 0) {
                        // Try to use these children
                        childrenWithPositions.forEach((child) => {
                                try {
                                        if (!child.getIndices() || child.getIndices().length === 0) {
                                                child.forceSharedVertices();
                                        }
                                        if (
                                                child.getTotalVertices() > 0 &&
                                                child.getIndices() &&
                                                child.getIndices().length > 0
                                        ) {
                                                meshesWithGeometry.push(child);
                                        }
                                } catch (e) {
                                        // Ignore
                                }
                        });
                }
        }

        if (meshesWithGeometry.length === 0) {
                console.warn(
                        `[prepareMeshForCSG] No valid geometry found for mesh: ${mesh.name}`,
                );
                return null;
        }

        if (meshesWithGeometry.length === 1) {
                return meshesWithGeometry[0];
        }

        // Multiple children with geometry - merge them into one mesh
        // Clone and prepare each mesh for merging
        const clones = meshesWithGeometry.map((m, i) => {
                m.computeWorldMatrix(true);
                const worldMatrix = m.getWorldMatrix();
                const clone = m.clone(`${mesh.name}_part_${i}`);
                clone.setParent(null);
                clone.bakeTransformIntoVertices(worldMatrix);
                clone.position.set(0, 0, 0);
                clone.rotation.set(0, 0, 0);
                clone.rotationQuaternion = null;
                clone.scaling.set(1, 1, 1);
                return clone;
        });

        const merged = flock.BABYLON.Mesh.MergeMeshes(
                clones,
                true, // disposeSource
                true, // allow32BitsIndices
                undefined,
                false,
                true,
        );

        if (merged) {
                // Copy transform from original mesh
                mesh.computeWorldMatrix(true);
                merged.position.copyFrom(mesh.position);
                merged.rotation.copyFrom(mesh.rotation);
                if (mesh.rotationQuaternion) {
                        merged.rotationQuaternion = mesh.rotationQuaternion.clone();
                }
                merged.scaling.copyFrom(mesh.scaling);
                merged.computeWorldMatrix(true);
        }

        return merged;
}

/**
 * Collects all meshes with valid geometry for CSG operations.
 * Falls back to converting non-indexed meshes when possible.
 * @param {BABYLON.Mesh} mesh - The mesh to inspect
 * @returns {BABYLON.Mesh[]} - Meshes suitable for CSG operations
 */
function prepareMeshesForCSG(mesh) {
        if (!mesh) return [];

        const meshes = [];
        const queue = [mesh];

        while (queue.length) {
                const current = queue.pop();
                if (!current) continue;

                const hasVertices =
                        current.getTotalVertices && current.getTotalVertices() > 0;
                const hasPositions =
                        current.getVerticesData &&
                        current.getVerticesData(flock.BABYLON.VertexBuffer.PositionKind);
                const hasIndices = current.getIndices && current.getIndices();

                if (hasPositions && !hasIndices) {
                        try {
                                current.convertToUnIndexedMesh();
                                current.forceSharedVertices();
                        } catch (e) {
                                // Ignore errors, continue with other approaches
                        }
                }

                const hasValidGeometry =
                        current.getTotalVertices &&
                        current.getTotalVertices() > 0 &&
                        current.getIndices &&
                        current.getIndices() &&
                        current.getIndices().length > 0;

                if (hasValidGeometry) {
                        meshes.push(current);
                }

                const children = current.getChildMeshes
                        ? current.getChildMeshes(true)
                        : [];
                children.forEach((child) => queue.push(child));
        }

        return meshes;
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
                                        // Prepare meshes for merging
                                        const meshesToMerge = [];
                                        let referenceMesh = validMeshes[0];

                                        validMeshes.forEach((mesh) => {
                                                let targetMesh = mesh;
                                                
                                                // If metadata exists, use the mesh with material.
                                                if (mesh.metadata?.modelName) {
                                                        const meshWithMaterial =
                                                                flock._findFirstDescendantWithMaterial(mesh);
                                                        if (meshWithMaterial) {
                                                                targetMesh = meshWithMaterial;
                                                                targetMesh.refreshBoundingInfo();
                                                        }
                                                }

                                                // Ensure world matrix is updated for correct positioning
                                                targetMesh.computeWorldMatrix(true);
                                                
                                                // Check if mesh has valid geometry
                                                if (targetMesh.getTotalVertices() > 0) {
                                                        meshesToMerge.push(targetMesh);
                                                } else {
                                                        console.warn(`Skipping mesh with no vertices: ${mesh.name}`);
                                                }
                                        });

                                        if (meshesToMerge.length === 0) {
                                                console.warn("No valid meshes to merge.");
                                                return null;
                                        }

                                        // Clone the first mesh's material for the merged result
                                        const originalMaterial = referenceMesh.material;

                                        // Try CSG2 first, fall back to simple merge if it fails
                                        let mergedMesh = null;
                                        let csgSucceeded = false;

                                        try {
                                                // Attempt CSG2 merge for proper boolean union
                                                let baseCSG = flock.BABYLON.CSG2.FromMesh(meshesToMerge[0], false);
                                                
                                                for (let i = 1; i < meshesToMerge.length; i++) {
                                                        const meshCSG = flock.BABYLON.CSG2.FromMesh(meshesToMerge[i], false);
                                                        baseCSG = baseCSG.add(meshCSG);
                                                }

                                                mergedMesh = baseCSG.toMesh(
                                                        modelId,
                                                        meshesToMerge[0].getScene(),
                                                        { centerMesh: false, rebuildNormals: true }
                                                );
                                                
                                                if (mergedMesh && mergedMesh.getTotalVertices() > 0) {
                                                        csgSucceeded = true;
                                                } else {
                                                        if (mergedMesh) mergedMesh.dispose();
                                                        mergedMesh = null;
                                                }
                                        } catch (e) {
                                                // CSG2.toMesh may have created an empty mesh before failing - clean it up
                                                const emptyMeshes = flock.scene.meshes.filter(m => 
                                                        m.name === modelId && m.getTotalVertices() === 0
                                                );
                                                emptyMeshes.forEach(m => {
                                                        m.dispose();
                                                });
                                        }

                                        // Fallback to simple Mesh.MergeMeshes if CSG2 failed
                                        if (!csgSucceeded) {
                                                mergedMesh = flock.BABYLON.Mesh.MergeMeshes(
                                                        meshesToMerge,
                                                        false,
                                                        true,
                                                        undefined,
                                                        false,
                                                        false
                                                );
                                        }

                                        if (!mergedMesh) {
                                                console.warn("Merge failed");
                                                return null;
                                        }

                                        // Apply result properties
                                        mergedMesh.name = modelId;
                                        mergedMesh.metadata = mergedMesh.metadata || {};
                                        mergedMesh.metadata.blockKey = blockId;
                                        mergedMesh.metadata.sharedMaterial = false;

                                        // Apply the original material
                                        if (originalMaterial) {
                                                const newMat = originalMaterial.clone(modelId + "_material");
                                                newMat.backFaceCulling = false;
                                                mergedMesh.material = newMat;
                                        }

                                        // Rebuild normals for proper lighting
                                        mergedMesh.createNormals(true);

                                        // Create physics shape for the merged mesh
                                        try {
                                                const physicsShape = new flock.BABYLON.PhysicsShapeMesh(
                                                        mergedMesh,
                                                        flock.scene
                                                );
                                                flock.applyPhysics(mergedMesh, physicsShape);
                                        } catch (e) {
                                                console.warn("Could not apply physics to merged mesh:", e);
                                        }

                                        // Dispose original meshes
                                        validMeshes.forEach((mesh) => mesh.dispose());

                                        return modelId;
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

                const nodeInfo = (n, depth = undefined) => {
                        if (!n) return null;
                        const isMesh = typeof n.getTotalVertices === "function";
                        return {
                                depth,
                                name: n.name,
                                uniqueId: n.uniqueId,
                                className:
                                        typeof n.getClassName === "function"
                                                ? n.getClassName()
                                                : undefined,
                                isMesh,
                                verts: isMesh ? n.getTotalVertices() : undefined,
                        };
                };

                const collectMaterialMeshesDeep = (root) => {
                        const out = [];
                        const stack = [root];
                        while (stack.length) {
                                const node = stack.pop();
                                if (!node) continue;
                                if (
                                        node.getTotalVertices &&
                                        node.getTotalVertices() > 0 &&
                                        node.material
                                ) {
                                        out.push(node);
                                }
                                const kids = node.getChildren ? node.getChildren() : [];
                                for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
                        }
                        return out;
                };

                /**
                 * Captures absolute world position and strips non-essential attributes.
                 */
                const cloneForCSG = (src, name) => {
                        src.computeWorldMatrix(true);
                        const worldMatrix = src.getWorldMatrix();

                        const dup = src.clone(name);
                        dup.setParent(null);

                        // BAKE: This moves vertex data to world coordinates and resets position/scale to 1.
                        // This ensures the Tool and Base are actually touching in the CSG engine.
                        dup.bakeTransformIntoVertices(worldMatrix);

                        dup.position.set(0, 0, 0);
                        dup.rotation.set(0, 0, 0);
                        dup.rotationQuaternion = null;
                        dup.scaling.set(1, 1, 1);
                        dup.computeWorldMatrix(true);

                        // NORMALIZE: CSG2 fails if one mesh has UVs/Colors and the other doesn't.
                        if (dup.isVerticesDataPresent(flock.BABYLON.VertexBuffer.UVKind))
                                dup.removeVerticesData(flock.BABYLON.VertexBuffer.UVKind);
                        if (dup.isVerticesDataPresent(flock.BABYLON.VertexBuffer.ColorKind))
                                dup.removeVerticesData(flock.BABYLON.VertexBuffer.ColorKind);
                        if (
                                dup.isVerticesDataPresent(
                                        flock.BABYLON.VertexBuffer.TangentKind,
                                )
                        )
                                dup.removeVerticesData(flock.BABYLON.VertexBuffer.TangentKind);

                        return dup;
                };

                const tryCSG = (label, fn) => {
                        try {
                                return fn();
                        } catch (e) {
                                return null;
                        }
                };

                return new Promise((resolve) => {
                        flock.whenModelReady(baseMeshName, (baseMesh) => {
                                if (!baseMesh) return resolve(null);

                                const referenceMesh = baseMesh.metadata?.modelName
                                        ? flock._findFirstDescendantWithMaterial(baseMesh) || baseMesh
                                        : baseMesh;
                                let actualBase = baseMesh;

                                // Ensure base mesh has valid geometry for CSG
                                const baseMeshes = prepareMeshesForCSG(actualBase);
                                console.debug(
                                        `[subtractMeshes] Base mesh candidates: ${baseMeshes.length}`,
                                );
                                if (!baseMeshes.length) {
                                        console.warn("[subtractMeshes] Base mesh has no valid geometry for CSG.");
                                        return resolve(null);
                                }

                                flock
                                        .prepareMeshes(modelId, meshNames, blockId)
                                        .then((validMeshes) => {
                                                const scene = baseMesh.getScene();

                                                // Prepare Base
                                                const baseDuplicates = baseMeshes.map((base, index) =>
                                                        cloneForCSG(base, `baseDuplicate_${index}`),
                                                );
                                                console.debug(
                                                        `[subtractMeshes] Base duplicates created: ${baseDuplicates.length}`,
                                                );

                                                let outerCSG = null;
                                                baseDuplicates.forEach((dup, index) => {
                                                        const baseCSG = tryCSG(
                                                                `FromMesh(baseDuplicate_${index})`,
                                                                () => flock.BABYLON.CSG2.FromMesh(dup, false),
                                                        );
                                                        if (!baseCSG) {
                                                                console.warn(
                                                                        `[subtractMeshes] Skipping non-manifold base part ${index}`,
                                                                );
                                                                return;
                                                        }
                                                        if (!outerCSG) {
                                                                outerCSG = baseCSG;
                                                                return;
                                                        }
                                                        const combined = tryCSG(
                                                                `add baseDuplicate_${index}`,
                                                                () => outerCSG.add(baseCSG),
                                                        );
                                                        if (combined) {
                                                                outerCSG = combined;
                                                        }
                                                });

                                                if (!outerCSG) {
                                                        console.warn(
                                                                "[subtractMeshes] Failed to create CSG from base mesh",
                                                        );
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        validMeshes.forEach((m) => m.dispose());
                                                        return resolve(null);
                                                }

                                                const subtractDuplicates = [];

                                                validMeshes.forEach((mesh, meshIndex) => {
                                                        // Complex GLBs (Star/Donut)
                                                        if (
                                                                mesh.metadata?.modelName ||
                                                                mesh.getChildren().length > 0
                                                        ) {
                                                                const parts = collectMaterialMeshesDeep(mesh);
                                                                if (parts.length > 0) {
                                                                        const partClones = parts.map((p, i) =>
                                                                                cloneForCSG(
                                                                                        p,
                                                                                        `temp_${meshIndex}_${i}`,
                                                                                ),
                                                                        );

                                                                        // MERGE: Star_primitive0,1,2 -> One Mesh
                                                                        const unified =
                                                                                flock.BABYLON.Mesh.MergeMeshes(
                                                                                        partClones,
                                                                                        true,
                                                                                        true,
                                                                                        undefined,
                                                                                        false,
                                                                                        true,
                                                                                );

                                                                        if (unified) {
                                                                                unified.forceSharedVertices(); // WELD: Close gaps in the model
                                                                                // flipFaces ensures the tool is a "solid" cutter and not a "void"
                                                                                if (
                                                                                        typeof unified.flipFaces ===
                                                                                        "function"
                                                                                )
                                                                                        unified.flipFaces();
                                                                                subtractDuplicates.push(unified);
                                                                        }
                                                                }
                                                        }
                                                        // Simple geometries or meshes that need preparation
                                                        else {
                                                                // Use prepareMeshForCSG to handle meshes with or without direct geometry
                                                                const preparedMesh = prepareMeshForCSG(mesh);
                                                                if (preparedMesh && preparedMesh.geometry) {
                                                                        subtractDuplicates.push(
                                                                                cloneForCSG(
                                                                                        preparedMesh,
                                                                                        `simple_tool_${meshIndex}`,
                                                                                ),
                                                                        );
                                                                }
                                                        }
                                                });

                                                // EXECUTE SUBTRACTION
                                                subtractDuplicates.forEach((m, idx) => {
                                                        const meshCSG = tryCSG(
                                                                `FromMesh(tool[${idx}])`,
                                                                () => flock.BABYLON.CSG2.FromMesh(m, false),
                                                        );
                                                        if (!meshCSG) {
                                                                console.warn(`[subtractMeshes] Failed to create CSG from tool[${idx}]`);
                                                                return;
                                                        }

                                                        const next = tryCSG(`subtract tool[${idx}]`, () =>
                                                                outerCSG.subtract(meshCSG),
                                                        );
                                                        if (next) {
                                                                outerCSG = next;
                                                        }
                                                });

                                                // GENERATE RESULT
                                                let resultMesh;
                                                try {
                                                        resultMesh = outerCSG.toMesh(
                                                                "resultMesh",
                                                                scene,
                                                                { centerMesh: false },
                                                        );
                                                        
                                                        // Check if mesh has valid geometry
                                                        if (!resultMesh || resultMesh.getTotalVertices() === 0) {
                                                                throw new Error("CSG produced empty mesh");
                                                        }
                                                } catch (e) {
                                                        console.warn("[subtractMeshes] CSG subtract failed:", e.message);
                                                        console.warn("[subtractMeshes] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.");
                                                        
                                                        // Clean up any empty meshes created by CSG2
                                                        flock.scene.meshes.filter(m => 
                                                                m.name === "resultMesh" && m.getTotalVertices() === 0
                                                        ).forEach(m => m.dispose());
                                                        
                                                        // Cleanup
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        subtractDuplicates.forEach((m) => m.dispose());
                                                        // Don't dispose original meshes so user can still use them
                                                        
                                                        return resolve(null);
                                                }

                                                // Align pivot and position (Maintain your original behavior)
                                                const localCenter = resultMesh
                                                        .getBoundingInfo()
                                                        .boundingBox.center.clone();
                                                resultMesh.setPivotMatrix(
                                                        flock.BABYLON.Matrix.Translation(
                                                                localCenter.x,
                                                                localCenter.y,
                                                                localCenter.z,
                                                        ),
                                                        false,
                                                );
                                                resultMesh.position.subtractInPlace(localCenter);
                                                resultMesh.computeWorldMatrix(true);

                                                flock.applyResultMeshProperties(
                                                        resultMesh,
                                                        referenceMesh,
                                                        modelId,
                                                        blockId,
                                                );

                                                // CLEANUP
                                                baseDuplicates.forEach((dup) => dup.dispose());
                                                subtractDuplicates.forEach((m) => m.dispose());
                                                baseMesh.dispose();
                                                validMeshes.forEach((m) => m.dispose());

                                                resolve(modelId);
                                        });
                        });
                });
        },
        subtractMeshesMerge(modelId, baseMeshName, meshNames) {
                const blockId = modelId;
                modelId += "_" + flock.scene.getUniqueId();

                const collectMaterialMeshesDeep = (root) => {
                        const out = [];
                        const stack = [root];
                        while (stack.length) {
                                const node = stack.pop();
                                if (!node) continue;
                                if (
                                        node.getTotalVertices &&
                                        node.getTotalVertices() > 0 &&
                                        node.material
                                )
                                        out.push(node);
                                const kids = node.getChildren ? node.getChildren() : [];
                                for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
                        }
                        return out;
                };

                const cloneForCSG = (src, name) => {
                        src.computeWorldMatrix(true);
                        const worldMatrix = src.getWorldMatrix();
                        const dup = src.clone(name);
                        dup.setParent(null);
                        dup.bakeTransformIntoVertices(worldMatrix);
                        dup.position.set(0, 0, 0);
                        dup.rotation.set(0, 0, 0);
                        dup.rotationQuaternion = null;
                        dup.scaling.set(1, 1, 1);
                        dup.computeWorldMatrix(true);
                        const kinds = [
                                flock.BABYLON.VertexBuffer.UVKind,
                                flock.BABYLON.VertexBuffer.ColorKind,
                                flock.BABYLON.VertexBuffer.TangentKind,
                        ];
                        kinds.forEach((k) => {
                                if (dup.isVerticesDataPresent(k)) dup.removeVerticesData(k);
                        });
                        return dup;
                };

                return new Promise((resolve) => {
                        flock.whenModelReady(baseMeshName, (baseMesh) => {
                                if (!baseMesh) return resolve(null);
                                const referenceMesh = baseMesh.metadata?.modelName
                                        ? flock._findFirstDescendantWithMaterial(baseMesh) ||
                                                baseMesh
                                        : baseMesh;
                                let actualBase = baseMesh;

                                // Ensure base mesh has valid geometry for CSG
                                const baseMeshes = prepareMeshesForCSG(actualBase);
                                console.debug(
                                        `[subtractMeshesMerge] Base mesh candidates: ${baseMeshes.length}`,
                                );
                                if (!baseMeshes.length) {
                                        console.warn("[subtractMeshesMerge] Base mesh has no valid geometry for CSG.");
                                        return resolve(null);
                                }

                                flock
                                        .prepareMeshes(modelId, meshNames, blockId)
                                        .then((validMeshes) => {
                                                const scene = baseMesh.getScene();
                                                const baseDuplicates = baseMeshes.map((base, index) =>
                                                        cloneForCSG(base, `baseDuplicate_${index}`),
                                                );
                                                console.debug(
                                                        `[subtractMeshesMerge] Base duplicates created: ${baseDuplicates.length}`,
                                                );
                                                let outerCSG = null;
                                                baseDuplicates.forEach((dup, index) => {
                                                        try {
                                                                const baseCSG =
                                                                        flock.BABYLON.CSG2.FromMesh(
                                                                                dup,
                                                                                false,
                                                                        );
                                                                if (!outerCSG) {
                                                                        outerCSG = baseCSG;
                                                                        return;
                                                                }
                                                                outerCSG = outerCSG.add(baseCSG);
                                                        } catch (e) {
                                                                console.warn(
                                                                        `[subtractMeshesMerge] Skipping non-manifold base part ${index}:`,
                                                                        e.message,
                                                                );
                                                        }
                                                });
                                                if (!outerCSG) {
                                                        console.warn(
                                                                "[subtractMeshesMerge] Failed to create CSG from base mesh",
                                                        );
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        validMeshes.forEach((m) => m.dispose());
                                                        return resolve(null);
                                                }
                                                const subtractDuplicates = [];

                                                validMeshes.forEach((mesh, meshIndex) => {
                                                        const parts = collectMaterialMeshesDeep(mesh);
                                                        
                                                        // Check if mesh itself has valid geometry (e.g., manifold text meshes)
                                                        const meshHasGeometry = mesh.getTotalVertices && mesh.getTotalVertices() > 0;
                                                        
                                                        if (parts.length > 0) {
                                                                const partClones = parts.map((p, i) =>
                                                                        cloneForCSG(p, `temp_${meshIndex}_${i}`),
                                                                );
                                                                const isDonut =
                                                                        mesh.name.toLowerCase().includes("donut") ||
                                                                        mesh.metadata?.modelName
                                                                                ?.toLowerCase()
                                                                                .includes("donut");

                                                                if (isDonut) {
                                                                        partClones.forEach((pc) =>
                                                                                subtractDuplicates.push(pc),
                                                                        );
                                                                } else {
                                                                        let unified =
                                                                                partClones.length > 1
                                                                                        ? flock.BABYLON.Mesh.MergeMeshes(
                                                                                                        partClones,
                                                                                                        true,
                                                                                                        true,
                                                                                                        undefined,
                                                                                                        false,
                                                                                                        true,
                                                                                                )
                                                                                        : partClones[0];
                                                                        if (unified) {
                                                                                unified.forceSharedVertices();
                                                                                if (
                                                                                        mesh.metadata?.modelName &&
                                                                                        typeof unified.flipFaces ===
                                                                                                "function"
                                                                                )
                                                                                        unified.flipFaces();
                                                                                subtractDuplicates.push(unified);
                                                                        }
                                                                }
                                                        } else if (meshHasGeometry) {
                                                                // Direct mesh without children (e.g., manifold text mesh)
                                                                const clone = cloneForCSG(mesh, `direct_tool_${meshIndex}`);
                                                                subtractDuplicates.push(clone);
                                                        }
                                                });

                                                subtractDuplicates.forEach((m, idx) => {
                                                        try {
                                                                const meshCSG = flock.BABYLON.CSG2.FromMesh(
                                                                        m,
                                                                        false,
                                                                );
                                                                outerCSG = outerCSG.subtract(meshCSG);
                                                        } catch (e) {
                                                                console.warn(`[subtractMeshesMerge] Subtraction ${idx} failed:`, e.message);
                                                        }
                                                });

                                                let resultMesh;
                                                try {
                                                        resultMesh = outerCSG.toMesh(
                                                                "resultMesh",
                                                                scene,
                                                                { centerMesh: false },
                                                        );
                                                        
                                                        if (!resultMesh || resultMesh.getTotalVertices() === 0) {
                                                                throw new Error("CSG produced empty mesh");
                                                        }
                                                } catch (e) {
                                                        console.warn("[subtractMeshesMerge] CSG subtract failed:", e.message);
                                                        console.warn("[subtractMeshesMerge] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.");
                                                        
                                                        // Clean up any empty meshes
                                                        flock.scene.meshes.filter(m => 
                                                                m.name === "resultMesh" && m.getTotalVertices() === 0
                                                        ).forEach(m => m.dispose());
                                                        
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        subtractDuplicates.forEach((m) => m.dispose());
                                                        return resolve(null);
                                                }
                                                
                                                resultMesh.position.set(0, 0, 0);
                                                resultMesh.rotation.set(0, 0, 0);
                                                resultMesh.scaling.set(1, 1, 1);
                                                resultMesh.computeWorldMatrix(true);
                                                flock.applyResultMeshProperties(
                                                        resultMesh,
                                                        referenceMesh,
                                                        modelId,
                                                        blockId,
                                                );

                                                baseDuplicates.forEach((dup) => dup.dispose());
                                                subtractDuplicates.forEach((m) => m.dispose());
                                                baseMesh.dispose();
                                                validMeshes.forEach((m) => m.dispose());
                                                resolve(modelId);
                                        });
                        });
                });
        },
        subtractMeshesIndividual(modelId, baseMeshName, meshNames) {
                const blockId = modelId;
                modelId += "_" + flock.scene.getUniqueId();

                const collectMaterialMeshesDeep = (root) => {
                        const out = [];
                        const stack = [root];
                        while (stack.length) {
                                const node = stack.pop();
                                if (!node) continue;
                                if (
                                        node.getTotalVertices &&
                                        node.getTotalVertices() > 0 &&
                                        node.material
                                )
                                        out.push(node);
                                const kids = node.getChildren ? node.getChildren() : [];
                                for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
                        }
                        return out;
                };

                return new Promise((resolve) => {
                        flock.whenModelReady(baseMeshName, (baseMesh) => {
                                if (!baseMesh) return resolve(null);
                                const referenceMesh = baseMesh.metadata?.modelName
                                        ? flock._findFirstDescendantWithMaterial(baseMesh) || baseMesh
                                        : baseMesh;
                                let actualBase = baseMesh;

                                // Ensure base mesh has valid geometry for CSG
                                const baseMeshes = prepareMeshesForCSG(actualBase);
                                console.debug(
                                        `[subtractMeshesIndividual] Base mesh candidates: ${baseMeshes.length}`,
                                );
                                if (!baseMeshes.length) {
                                        console.warn("[subtractMeshesIndividual] Base mesh has no valid geometry for CSG.");
                                        return resolve(null);
                                }

                                flock
                                        .prepareMeshes(modelId, meshNames, blockId)
                                        .then((validMeshes) => {
                                                const scene = baseMesh.getScene();
                                                const baseDuplicates = baseMeshes.map((base, index) => {
                                                        const dup = base.clone(`baseDuplicate_${index}`);
                                                        dup.setParent(null);
                                                        dup.position = base.getAbsolutePosition().clone();
                                                        dup.rotationQuaternion = null;
                                                        dup.rotation = base.absoluteRotationQuaternion
                                                                ? base.absoluteRotationQuaternion.toEulerAngles()
                                                                : base.rotation.clone();
                                                        dup.computeWorldMatrix(true);
                                                        return dup;
                                                });
                                                console.debug(
                                                        `[subtractMeshesIndividual] Base duplicates created: ${baseDuplicates.length}`,
                                                );

                                                let outerCSG = null;
                                                baseDuplicates.forEach((dup, index) => {
                                                        try {
                                                                const baseCSG =
                                                                        flock.BABYLON.CSG2.FromMesh(
                                                                                dup,
                                                                                false,
                                                                        );
                                                                if (!outerCSG) {
                                                                        outerCSG = baseCSG;
                                                                        return;
                                                                }
                                                                outerCSG = outerCSG.add(baseCSG);
                                                        } catch (e) {
                                                                console.warn(
                                                                        `[subtractMeshesIndividual] Skipping non-manifold base part ${index}:`,
                                                                        e.message,
                                                                );
                                                        }
                                                });
                                                if (!outerCSG) {
                                                        console.warn(
                                                                "[subtractMeshesIndividual] Failed to create CSG from base mesh",
                                                        );
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        validMeshes.forEach((m) => m.dispose());
                                                        return resolve(null);
                                                }
                                                const allToolParts = [];
                                                validMeshes.forEach((mesh) => {
                                                        const parts = collectMaterialMeshesDeep(mesh);
                                                        parts.forEach((p) => {
                                                                const dup = p.clone("partDup", null, true);
                                                                dup.computeWorldMatrix(true);
                                                                if (typeof dup.flipFaces === "function")
                                                                        dup.flipFaces();
                                                                allToolParts.push(dup);
                                                        });
                                                });

                                                allToolParts.forEach((part) => {
                                                        try {
                                                                const partCSG = flock.BABYLON.CSG2.FromMesh(
                                                                        part,
                                                                        false,
                                                                );
                                                                outerCSG = outerCSG.subtract(partCSG);
                                                        } catch (e) {
                                                                console.warn(e);
                                                        }
                                                });

                                                let resultMesh;
                                                try {
                                                        resultMesh = outerCSG.toMesh(
                                                                "resultMesh",
                                                                scene,
                                                                { centerMesh: false },
                                                        );
                                                        
                                                        if (!resultMesh || resultMesh.getTotalVertices() === 0) {
                                                                throw new Error("CSG produced empty mesh");
                                                        }
                                                } catch (e) {
                                                        console.warn("[subtractMeshesIndividual] CSG subtract failed:", e.message);
                                                        console.warn("[subtractMeshesIndividual] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.");
                                                        
                                                        // Clean up any empty meshes
                                                        flock.scene.meshes.filter(m => 
                                                                m.name === "resultMesh" && m.getTotalVertices() === 0
                                                        ).forEach(m => m.dispose());
                                                        
                                                        baseDuplicates.forEach((dup) => dup.dispose());
                                                        allToolParts.forEach((t) => t.dispose());
                                                        return resolve(null);
                                                }
                                                
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
                                                resultMesh.computeWorldMatrix(true);
                                                flock.applyResultMeshProperties(
                                                        resultMesh,
                                                        referenceMesh,
                                                        modelId,
                                                        blockId,
                                                );

                                                baseDuplicates.forEach((dup) => dup.dispose());
                                                allToolParts.forEach((t) => t.dispose());
                                                baseMesh.dispose();
                                                validMeshes.forEach((m) => m.dispose());
                                                resolve(modelId);
                                        });
                        });
                });
        },
        subtractMeshes(modelId, baseMeshName, meshNames, approach = "merge") {
                if (approach === "individual") {
                        return this.subtractMeshesIndividual(
                                modelId,
                                baseMeshName,
                                meshNames,
                        );
                } else {
                        return this.subtractMeshesMerge(modelId, baseMeshName, meshNames);
                }
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

                                        // Ensure mesh has valid geometry for CSG
                                        firstMesh = prepareMeshForCSG(firstMesh);
                                        if (!firstMesh) {
                                                console.warn("First mesh has no valid geometry for CSG intersect.");
                                                return null;
                                        }

                                        // Create the base CSG
                                        let baseCSG;
                                        try {
                                                baseCSG = flock.BABYLON.CSG2.FromMesh(firstMesh, false);
                                        } catch (e) {
                                                console.warn("[intersectMeshes] CSG2.FromMesh failed on first mesh:", e.message);
                                                console.warn("[intersectMeshes] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.");
                                                return null;
                                        }

                                        // Intersect each subsequent mesh
                                        let csgFailed = false;
                                        validMeshes.slice(1).forEach((mesh) => {
                                                if (csgFailed) return;
                                                
                                                if (mesh.metadata?.modelName) {
                                                        const meshWithMaterial =
                                                                flock._findFirstDescendantWithMaterial(mesh);
                                                        if (meshWithMaterial) {
                                                                mesh = meshWithMaterial;
                                                                mesh.refreshBoundingInfo();
                                                                mesh.flipFaces();
                                                        }
                                                }

                                                // Ensure mesh has valid geometry for CSG
                                                mesh = prepareMeshForCSG(mesh);
                                                if (!mesh) {
                                                        console.warn("Skipping mesh with no valid geometry for CSG intersect.");
                                                        return;
                                                }

                                                try {
                                                        const meshCSG = flock.BABYLON.CSG2.FromMesh(
                                                                mesh,
                                                                false,
                                                        );
                                                        baseCSG = baseCSG.intersect(meshCSG);
                                                } catch (e) {
                                                        console.warn("[intersectMeshes] CSG intersect failed:", e.message);
                                                        csgFailed = true;
                                                }
                                        });

                                        if (csgFailed) {
                                                console.warn("[intersectMeshes] Note: CSG operations require watertight (manifold) geometry.");
                                                return null;
                                        }

                                        // Generate the resulting intersected mesh
                                        let intersectedMesh;
                                        try {
                                                intersectedMesh = baseCSG.toMesh(
                                                        "intersectedMesh",
                                                        validMeshes[0].getScene(),
                                                );
                                                
                                                if (!intersectedMesh || intersectedMesh.getTotalVertices() === 0) {
                                                        throw new Error("CSG produced empty mesh");
                                                }
                                        } catch (e) {
                                                console.warn("[intersectMeshes] CSG toMesh failed:", e.message);
                                                console.warn("[intersectMeshes] Note: CSG operations require watertight (manifold) geometry.");
                                                
                                                // Clean up any empty meshes
                                                flock.scene.meshes.filter(m => 
                                                        m.name === "intersectedMesh" && m.getTotalVertices() === 0
                                                ).forEach(m => m.dispose());
                                                
                                                return null;
                                        }

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
                } else {
                        // No material assigned by CSG - copy from reference mesh
                        resultMesh.material = referenceMesh.material.clone("csgResultMaterial");
                        resultMesh.material.backFaceCulling = false;
                }
        },
};
