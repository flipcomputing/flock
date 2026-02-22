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
        const hasVertices =
                mesh.getTotalVertices && mesh.getTotalVertices() > 0;
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
                                child.getVerticesData(
                                        flock.BABYLON.VertexBuffer.PositionKind,
                                );
                        return positions && positions.length > 0;
                });

                if (childrenWithPositions.length > 0) {
                        // Try to use these children
                        childrenWithPositions.forEach((child) => {
                                try {
                                        if (
                                                !child.getIndices() ||
                                                child.getIndices().length === 0
                                        ) {
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
                        merged.rotationQuaternion =
                                mesh.rotationQuaternion.clone();
                }
                merged.scaling.copyFrom(mesh.scaling);
                merged.computeWorldMatrix(true);
        }

        return merged;
}

function getMeshAttributeKinds(mesh) {
        if (!mesh || !mesh.getVerticesDataKinds) return [];
        return mesh.getVerticesDataKinds() || [];
}

function getMeshKindsSummary(meshes) {
        return meshes.map((mesh) => ({
                name: mesh?.name,
                kinds: getMeshAttributeKinds(mesh),
        }));
}

function recenterMeshLocalOrigin(mesh) {
        if (!mesh) return;

        mesh.computeWorldMatrix?.(true);
        mesh.refreshBoundingInfo?.();

        const boundingInfo = mesh.getBoundingInfo
                ? mesh.getBoundingInfo()
                : null;
        const worldCenter = boundingInfo?.boundingBox?.centerWorld;
        if (!worldCenter) return;

        mesh.bakeTransformIntoVertices(
                flock.BABYLON.Matrix.Translation(
                        -worldCenter.x,
                        -worldCenter.y,
                        -worldCenter.z,
                ),
        );
        mesh.position.copyFrom(worldCenter);
        mesh.computeWorldMatrix?.(true);
        mesh.refreshBoundingInfo?.();
}

function normalizeMeshAttributesForMerge(meshes) {
        if (!meshes || meshes.length < 2) return;

        const kindUnion = new Set();
        meshes.forEach((mesh) => {
                getMeshAttributeKinds(mesh).forEach((kind) =>
                        kindUnion.add(kind),
                );
        });

        let normalizationRequired = false;
        meshes.forEach((mesh) => {
                const meshKinds = new Set(getMeshAttributeKinds(mesh));
                for (const kind of kindUnion) {
                        if (!meshKinds.has(kind)) {
                                normalizationRequired = true;
                                break;
                        }
                }
        });

        if (!normalizationRequired) return;

        console.warn(
                "[mergeMeshes] Normalizing vertex attributes before fallback merge",
                {
                        meshes: getMeshKindsSummary(meshes),
                        requiredKinds: Array.from(kindUnion),
                },
        );

        const vertexBuffer = flock.BABYLON.VertexBuffer;

        const strideByKind = new Map([
                [vertexBuffer.UVKind, 2],
                [vertexBuffer.UV2Kind, 2],
                [vertexBuffer.UV3Kind, 2],
                [vertexBuffer.UV4Kind, 2],
                [vertexBuffer.UV5Kind, 2],
                [vertexBuffer.UV6Kind, 2],
                [vertexBuffer.ColorKind, 4],
                [vertexBuffer.MatricesIndicesKind, 4],
                [vertexBuffer.MatricesWeightsKind, 4],
                [vertexBuffer.MatricesIndicesExtraKind, 4],
                [vertexBuffer.MatricesWeightsExtraKind, 4],
        ]);

        meshes.forEach((mesh) => {
                const vertexCount = mesh.getTotalVertices
                        ? mesh.getTotalVertices()
                        : 0;
                if (!vertexCount) return;

                const existingKinds = new Set(getMeshAttributeKinds(mesh));

                for (const kind of kindUnion) {
                        if (existingKinds.has(kind)) continue;

                        if (kind === vertexBuffer.NormalKind) {
                                const positions = mesh.getVerticesData(
                                        vertexBuffer.PositionKind,
                                );
                                const indices = mesh.getIndices();
                                if (positions && indices && indices.length) {
                                        const normals = [];
                                        flock.BABYLON.VertexData.ComputeNormals(
                                                positions,
                                                indices,
                                                normals,
                                        );
                                        mesh.setVerticesData(
                                                vertexBuffer.NormalKind,
                                                normals,
                                                true,
                                        );
                                }
                                continue;
                        }

                        const stride = strideByKind.get(kind);
                        if (!stride) continue;

                        const buffer = new Float32Array(vertexCount * stride);
                        if (kind === vertexBuffer.ColorKind) {
                                for (let i = 3; i < buffer.length; i += 4) {
                                        buffer[i] = 1;
                                }
                        }

                        mesh.setVerticesData(kind, buffer, true);
                }

                mesh.refreshBoundingInfo?.();
                mesh.computeWorldMatrix?.(true);
        });
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
                                        const meshesToMerge = [];
                                        let referenceMesh = validMeshes[0];

                                        validMeshes.forEach((mesh) => {
                                                let targetMesh = mesh;

                                                if (mesh.metadata?.modelName) {
                                                        const meshWithMaterial =
                                                                flock._findFirstDescendantWithMaterial(
                                                                        mesh,
                                                                );
                                                        if (meshWithMaterial) {
                                                                targetMesh =
                                                                        meshWithMaterial;
                                                                targetMesh.refreshBoundingInfo();
                                                        }
                                                }

                                                targetMesh =
                                                        prepareMeshForCSG(
                                                                targetMesh,
                                                        );
                                                if (!targetMesh) return;

                                                targetMesh.computeWorldMatrix(
                                                        true,
                                                );

                                                if (
                                                        targetMesh.getTotalVertices() >
                                                        0
                                                ) {
                                                        meshesToMerge.push(
                                                                targetMesh,
                                                        );
                                                }
                                        });

                                        if (meshesToMerge.length === 0)
                                                return null;

                                        if (meshesToMerge.length === 1) {
                                                const singleMesh =
                                                        meshesToMerge[0];
                                                let mergedMesh =
                                                        singleMesh.clone(
                                                                modelId,
                                                        );
                                                if (!mergedMesh)
                                                        mergedMesh = singleMesh;

                                                mergedMesh.name = modelId;
                                                mergedMesh.metadata =
                                                        mergedMesh.metadata ||
                                                        {};
                                                mergedMesh.metadata.blockKey =
                                                        blockId;
                                                mergedMesh.metadata.sharedMaterial = false;

                                                return mergedMesh;
                                        }

                                        const originalMaterial =
                                                referenceMesh.material;
                                        let mergedMesh = null;
                                        let csgSucceeded = false;

                                        try {
                                                let baseCSG =
                                                        flock.BABYLON.CSG2.FromMesh(
                                                                meshesToMerge[0],
                                                                false,
                                                        );

                                                for (
                                                        let i = 1;
                                                        i <
                                                        meshesToMerge.length;
                                                        i++
                                                ) {
                                                        let meshCSG =
                                                                flock.BABYLON.CSG2.FromMesh(
                                                                        meshesToMerge[
                                                                                i
                                                                        ],
                                                                        false,
                                                                );
                                                        baseCSG =
                                                                baseCSG.add(
                                                                        meshCSG,
                                                                );
                                                }

                                                mergedMesh = baseCSG.toMesh(
                                                        modelId,
                                                        meshesToMerge[0].getScene(),
                                                        {
                                                                centerMesh: false,
                                                                rebuildNormals: true,
                                                        },
                                                );

                                                if (
                                                        mergedMesh &&
                                                        mergedMesh.getTotalVertices() >
                                                                0
                                                ) {
                                                        csgSucceeded = true;
                                                } else {
                                                        if (mergedMesh)
                                                                mergedMesh.dispose();
                                                        mergedMesh = null;
                                                }
                                        } catch (e) {
                                                const emptyMeshes =
                                                        flock.scene.meshes.filter(
                                                                (m) =>
                                                                        m.name ===
                                                                                modelId &&
                                                                        m.getTotalVertices() ===
                                                                                0,
                                                        );
                                                emptyMeshes.forEach((m) =>
                                                        m.dispose(),
                                                );
                                                csgSucceeded = false;
                                        }

                                        if (!csgSucceeded) {
                                                try {
                                                        normalizeMeshAttributesForMerge(
                                                                meshesToMerge,
                                                        );
                                                        mergedMesh =
                                                                flock.BABYLON.Mesh.MergeMeshes(
                                                                        meshesToMerge,
                                                                        false,
                                                                        true,
                                                                        undefined,
                                                                        true,
                                                                        true,
                                                                );
                                                } catch (mergeError) {
                                                        return null;
                                                }
                                        }

                                        if (!mergedMesh) return null;

                                        recenterMeshLocalOrigin(mergedMesh);

                                        mergedMesh.name = modelId;
                                        mergedMesh.metadata =
                                                mergedMesh.metadata || {};
                                        mergedMesh.metadata.blockKey = blockId;
                                        mergedMesh.metadata.sharedMaterial = false;

                                        const isDefaultMaterial = (
                                                material,
                                        ) => {
                                                return (
                                                        material instanceof
                                                                flock.BABYLON
                                                                        .StandardMaterial &&
                                                        material.name ===
                                                                "default material"
                                                );
                                        };

                                        if (mergedMesh.material) {
                                                if (
                                                        mergedMesh.material instanceof
                                                        flock.BABYLON
                                                                .MultiMaterial
                                                ) {
                                                        mergedMesh.material.subMaterials =
                                                                mergedMesh.material.subMaterials.map(
                                                                        (
                                                                                subMaterial,
                                                                        ) => {
                                                                                if (
                                                                                        subMaterial &&
                                                                                        isDefaultMaterial(
                                                                                                subMaterial,
                                                                                        ) &&
                                                                                        originalMaterial
                                                                                ) {
                                                                                        const replacement =
                                                                                                originalMaterial.clone(
                                                                                                        modelId +
                                                                                                                "_material",
                                                                                                );
                                                                                        replacement.backFaceCulling = false;
                                                                                        return replacement;
                                                                                }
                                                                                return subMaterial;
                                                                        },
                                                                );
                                                } else if (
                                                        isDefaultMaterial(
                                                                mergedMesh.material,
                                                        ) &&
                                                        originalMaterial
                                                ) {
                                                        const newMat =
                                                                originalMaterial.clone(
                                                                        modelId +
                                                                                "_material",
                                                                );
                                                        newMat.backFaceCulling = false;
                                                        mergedMesh.material =
                                                                newMat;
                                                }
                                        } else if (originalMaterial) {
                                                const newMat =
                                                        originalMaterial.clone(
                                                                modelId +
                                                                        "_material",
                                                        );
                                                newMat.backFaceCulling = false;
                                                mergedMesh.material = newMat;
                                        }

                                        mergedMesh.createNormals(true);

                                        try {
                                                const physicsShape =
                                                        new flock.BABYLON.PhysicsShapeMesh(
                                                                mergedMesh,
                                                                flock.scene,
                                                        );
                                                flock.applyPhysics(
                                                        mergedMesh,
                                                        physicsShape,
                                                );
                                        } catch (e) {}

                                        validMeshes.forEach((mesh) =>
                                                mesh.dispose(),
                                        );

                                        return modelId;
                                } else {
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
                                verts: isMesh
                                        ? n.getTotalVertices()
                                        : undefined,
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
                                const kids = node.getChildren
                                        ? node.getChildren()
                                        : [];
                                for (let i = kids.length - 1; i >= 0; i--)
                                        stack.push(kids[i]);
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
                        if (
                                dup.isVerticesDataPresent(
                                        flock.BABYLON.VertexBuffer.UVKind,
                                )
                        )
                                dup.removeVerticesData(
                                        flock.BABYLON.VertexBuffer.UVKind,
                                );
                        if (
                                dup.isVerticesDataPresent(
                                        flock.BABYLON.VertexBuffer.ColorKind,
                                )
                        )
                                dup.removeVerticesData(
                                        flock.BABYLON.VertexBuffer.ColorKind,
                                );
                        if (
                                dup.isVerticesDataPresent(
                                        flock.BABYLON.VertexBuffer.TangentKind,
                                )
                        )
                                dup.removeVerticesData(
                                        flock.BABYLON.VertexBuffer.TangentKind,
                                );

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

                                let actualBase = baseMesh;
                                if (baseMesh.metadata?.modelName) {
                                        const meshWithMaterial =
                                                flock._findFirstDescendantWithMaterial(
                                                        baseMesh,
                                                );
                                        if (meshWithMaterial)
                                                actualBase = meshWithMaterial;
                                }

                                // Ensure base mesh has valid geometry for CSG
                                actualBase = prepareMeshForCSG(actualBase);
                                if (!actualBase) {
                                        console.warn(
                                                "[subtractMeshes] Base mesh has no valid geometry for CSG.",
                                        );
                                        return resolve(null);
                                }

                                flock.prepareMeshes(
                                        modelId,
                                        meshNames,
                                        blockId,
                                ).then((validMeshes) => {
                                        const scene = baseMesh.getScene();

                                        // Prepare Base
                                        const baseDuplicate = cloneForCSG(
                                                actualBase,
                                                "baseDuplicate",
                                        );

                                        let outerCSG = tryCSG(
                                                "FromMesh(baseDuplicate)",
                                                () =>
                                                        flock.BABYLON.CSG2.FromMesh(
                                                                baseDuplicate,
                                                                false,
                                                        ),
                                        );

                                        if (!outerCSG) {
                                                console.warn(
                                                        "[subtractMeshes] Failed to create CSG from base mesh",
                                                );
                                                baseDuplicate.dispose();
                                                validMeshes.forEach((m) =>
                                                        m.dispose(),
                                                );
                                                return resolve(null);
                                        }

                                        const subtractDuplicates = [];

                                        validMeshes.forEach(
                                                (mesh, meshIndex) => {
                                                        // Complex GLBs (Star/Donut)
                                                        if (
                                                                mesh.metadata
                                                                        ?.modelName ||
                                                                mesh.getChildren()
                                                                        .length >
                                                                        0
                                                        ) {
                                                                const parts =
                                                                        collectMaterialMeshesDeep(
                                                                                mesh,
                                                                        );
                                                                if (
                                                                        parts.length >
                                                                        0
                                                                ) {
                                                                        const partClones =
                                                                                parts.map(
                                                                                        (
                                                                                                p,
                                                                                                i,
                                                                                        ) =>
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

                                                                        if (
                                                                                unified
                                                                        ) {
                                                                                unified.forceSharedVertices(); // WELD: Close gaps in the model
                                                                                // flipFaces ensures the tool is a "solid" cutter and not a "void"
                                                                                if (
                                                                                        typeof unified.flipFaces ===
                                                                                        "function"
                                                                                )
                                                                                        unified.flipFaces();
                                                                                subtractDuplicates.push(
                                                                                        unified,
                                                                                );
                                                                        }
                                                                }
                                                        }
                                                        // Simple geometries or meshes that need preparation
                                                        else {
                                                                // Use prepareMeshForCSG to handle meshes with or without direct geometry
                                                                const preparedMesh =
                                                                        prepareMeshForCSG(
                                                                                mesh,
                                                                        );
                                                                if (
                                                                        preparedMesh &&
                                                                        preparedMesh.geometry
                                                                ) {
                                                                        subtractDuplicates.push(
                                                                                cloneForCSG(
                                                                                        preparedMesh,
                                                                                        `simple_tool_${meshIndex}`,
                                                                                ),
                                                                        );
                                                                }
                                                        }
                                                },
                                        );

                                        // EXECUTE SUBTRACTION
                                        subtractDuplicates.forEach((m, idx) => {
                                                const meshCSG = tryCSG(
                                                        `FromMesh(tool[${idx}])`,
                                                        () =>
                                                                flock.BABYLON.CSG2.FromMesh(
                                                                        m,
                                                                        false,
                                                                ),
                                                );
                                                if (!meshCSG) {
                                                        console.warn(
                                                                `[subtractMeshes] Failed to create CSG from tool[${idx}]`,
                                                        );
                                                        return;
                                                }

                                                const next = tryCSG(
                                                        `subtract tool[${idx}]`,
                                                        () =>
                                                                outerCSG.subtract(
                                                                        meshCSG,
                                                                ),
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
                                                if (
                                                        !resultMesh ||
                                                        resultMesh.getTotalVertices() ===
                                                                0
                                                ) {
                                                        throw new Error(
                                                                "CSG produced empty mesh",
                                                        );
                                                }
                                        } catch (e) {
                                                console.warn(
                                                        "[subtractMeshes] CSG subtract failed:",
                                                        e.message,
                                                );
                                                console.warn(
                                                        "[subtractMeshes] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.",
                                                );

                                                // Clean up any empty meshes created by CSG2
                                                flock.scene.meshes
                                                        .filter(
                                                                (m) =>
                                                                        m.name ===
                                                                                "resultMesh" &&
                                                                        m.getTotalVertices() ===
                                                                                0,
                                                        )
                                                        .forEach((m) =>
                                                                m.dispose(),
                                                        );

                                                // Cleanup
                                                baseDuplicate.dispose();
                                                subtractDuplicates.forEach(
                                                        (m) => m.dispose(),
                                                );
                                                // Don't dispose original meshes so user can still use them

                                                return resolve(null);
                                        }

                                        // Normalize geometry anchor instead of compensating transform position.
                                        flock.offsetGeometryToAnchor(resultMesh, {
                                                x: "CENTER",
                                                y: "MIN",
                                                z: "CENTER",
                                        });
                                        resultMesh.computeWorldMatrix(true);

                                        flock.applyResultMeshProperties(
                                                resultMesh,
                                                actualBase,
                                                modelId,
                                                blockId,
                                        );

                                        // CLEANUP
                                        baseDuplicate.dispose();
                                        subtractDuplicates.forEach((m) =>
                                                m.dispose(),
                                        );
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
                                const kids = node.getChildren
                                        ? node.getChildren()
                                        : [];
                                for (let i = kids.length - 1; i >= 0; i--)
                                        stack.push(kids[i]);
                        }
                        return out;
                };

                const cloneForCSG = (src, name) => {
                        src.computeWorldMatrix(true);
                        const worldMatrix = src.getWorldMatrix();
                        const dup = src.clone(name);
                        dup.setParent(null);
                        dup.makeGeometryUnique();
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
                                if (dup.isVerticesDataPresent(k))
                                        dup.removeVerticesData(k);
                        });
                        return dup;
                };

                return new Promise((resolve) => {
                        flock.whenModelReady(baseMeshName, (baseMesh) => {
                                if (!baseMesh) return resolve(null);
                                let actualBase = baseMesh.metadata?.modelName
                                        ? flock._findFirstDescendantWithMaterial(
                                                  baseMesh,
                                          ) || baseMesh
                                        : baseMesh;

                                // Ensure base mesh has valid geometry for CSG
                                actualBase = prepareMeshForCSG(actualBase);
                                if (!actualBase) {
                                        console.warn(
                                                "[subtractMeshesMerge] Base mesh has no valid geometry for CSG.",
                                        );
                                        return resolve(null);
                                }

                                flock.prepareMeshes(
                                        modelId,
                                        meshNames,
                                        blockId,
                                ).then((validMeshes) => {
                                        const scene = baseMesh.getScene();
                                        const baseDuplicate = cloneForCSG(
                                                actualBase,
                                                "baseDuplicate",
                                        );
                                        let outerCSG =
                                                flock.BABYLON.CSG2.FromMesh(
                                                        baseDuplicate,
                                                        false,
                                                );
                                        const subtractDuplicates = [];

                                        validMeshes.forEach(
                                                (mesh, meshIndex) => {
                                                        const parts =
                                                                collectMaterialMeshesDeep(
                                                                        mesh,
                                                                );

                                                        // Check if mesh itself has valid geometry (e.g., manifold text meshes)
                                                        const meshHasGeometry =
                                                                mesh.getTotalVertices &&
                                                                mesh.getTotalVertices() >
                                                                        0;

                                                        if (parts.length > 0) {
                                                                const partClones =
                                                                        parts.map(
                                                                                (
                                                                                        p,
                                                                                        i,
                                                                                ) =>
                                                                                        cloneForCSG(
                                                                                                p,
                                                                                                `temp_${meshIndex}_${i}`,
                                                                                        ),
                                                                        );
                                                                const isDonut =
                                                                        mesh.name
                                                                                .toLowerCase()
                                                                                .includes(
                                                                                        "donut",
                                                                                ) ||
                                                                        mesh.metadata?.modelName
                                                                                ?.toLowerCase()
                                                                                .includes(
                                                                                        "donut",
                                                                                );

                                                                if (isDonut) {
                                                                        partClones.forEach(
                                                                                (
                                                                                        pc,
                                                                                ) =>
                                                                                        subtractDuplicates.push(
                                                                                                pc,
                                                                                        ),
                                                                        );
                                                                } else {
                                                                        let unified =
                                                                                partClones.length >
                                                                                1
                                                                                        ? flock.BABYLON.Mesh.MergeMeshes(
                                                                                                  partClones,
                                                                                                  true,
                                                                                                  true,
                                                                                                  undefined,
                                                                                                  false,
                                                                                                  true,
                                                                                          )
                                                                                        : partClones[0];
                                                                        if (
                                                                                unified
                                                                        ) {
                                                                                unified.forceSharedVertices();
                                                                                if (
                                                                                        mesh
                                                                                                .metadata
                                                                                                ?.modelName &&
                                                                                        typeof unified.flipFaces ===
                                                                                                "function"
                                                                                )
                                                                                        unified.flipFaces();
                                                                                subtractDuplicates.push(
                                                                                        unified,
                                                                                );
                                                                        }
                                                                }
                                                        } else if (
                                                                meshHasGeometry
                                                        ) {
                                                                // Direct mesh without children (e.g., manifold text mesh)
                                                                const clone =
                                                                        cloneForCSG(
                                                                                mesh,
                                                                                `direct_tool_${meshIndex}`,
                                                                        );
                                                                subtractDuplicates.push(
                                                                        clone,
                                                                );
                                                        }
                                                },
                                        );

                                        subtractDuplicates.forEach((m, idx) => {
                                                try {
                                                        const meshCSG =
                                                                flock.BABYLON.CSG2.FromMesh(
                                                                        m,
                                                                        false,
                                                                );
                                                        outerCSG =
                                                                outerCSG.subtract(
                                                                        meshCSG,
                                                                );
                                                } catch (e) {
                                                        console.warn(
                                                                `[subtractMeshesMerge] Subtraction ${idx} failed:`,
                                                                e.message,
                                                        );
                                                }
                                        });

                                        let resultMesh;
                                        try {
                                                resultMesh = outerCSG.toMesh(
                                                        "resultMesh",
                                                        scene,
                                                        { centerMesh: false },
                                                );

                                                if (
                                                        !resultMesh ||
                                                        resultMesh.getTotalVertices() ===
                                                                0
                                                ) {
                                                        throw new Error(
                                                                "CSG produced empty mesh",
                                                        );
                                                }
                                        } catch (e) {
                                                console.warn(
                                                        "[subtractMeshesMerge] CSG subtract failed:",
                                                        e.message,
                                                );
                                                console.warn(
                                                        "[subtractMeshesMerge] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.",
                                                );

                                                // Clean up any empty meshes
                                                flock.scene.meshes
                                                        .filter(
                                                                (m) =>
                                                                        m.name ===
                                                                                "resultMesh" &&
                                                                        m.getTotalVertices() ===
                                                                                0,
                                                        )
                                                        .forEach((m) =>
                                                                m.dispose(),
                                                        );

                                                baseDuplicate.dispose();
                                                subtractDuplicates.forEach(
                                                        (m) => m.dispose(),
                                                );
                                                return resolve(null);
                                        }

                                        resultMesh.position.set(0, 0, 0);
                                        resultMesh.rotation.set(0, 0, 0);
                                        resultMesh.scaling.set(1, 1, 1);
                                        resultMesh.computeWorldMatrix(true);
                                        flock.applyResultMeshProperties(
                                                resultMesh,
                                                actualBase,
                                                modelId,
                                                blockId,
                                        );

                                        baseDuplicate.dispose();
                                        subtractDuplicates.forEach((m) =>
                                                m.dispose(),
                                        );
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
                                const kids = node.getChildren
                                        ? node.getChildren()
                                        : [];
                                for (let i = kids.length - 1; i >= 0; i--)
                                        stack.push(kids[i]);
                        }
                        return out;
                };

                return new Promise((resolve) => {
                        flock.whenModelReady(baseMeshName, (baseMesh) => {
                                if (!baseMesh) return resolve(null);
                                let actualBase = baseMesh;
                                if (baseMesh.metadata?.modelName) {
                                        const meshWithMaterial =
                                                flock._findFirstDescendantWithMaterial(
                                                        baseMesh,
                                                );
                                        if (meshWithMaterial)
                                                actualBase = meshWithMaterial;
                                }

                                // Ensure base mesh has valid geometry for CSG
                                actualBase = prepareMeshForCSG(actualBase);
                                if (!actualBase) {
                                        console.warn(
                                                "[subtractMeshesIndividual] Base mesh has no valid geometry for CSG.",
                                        );
                                        return resolve(null);
                                }

                                flock.prepareMeshes(
                                        modelId,
                                        meshNames,
                                        blockId,
                                ).then((validMeshes) => {
                                        const scene = baseMesh.getScene();
                                        const baseDuplicate =
                                                actualBase.clone(
                                                        "baseDuplicate",
                                                );
                                        baseDuplicate.setParent(null);
                                        baseDuplicate.position = actualBase
                                                .getAbsolutePosition()
                                                .clone();
                                        baseDuplicate.rotationQuaternion = null;
                                        baseDuplicate.rotation =
                                                actualBase.absoluteRotationQuaternion
                                                        ? actualBase.absoluteRotationQuaternion.toEulerAngles()
                                                        : actualBase.rotation.clone();
                                        baseDuplicate.computeWorldMatrix(true);

                                        let outerCSG =
                                                flock.BABYLON.CSG2.FromMesh(
                                                        baseDuplicate,
                                                        false,
                                                );
                                        const allToolParts = [];
                                        validMeshes.forEach((mesh) => {
                                                const parts =
                                                        collectMaterialMeshesDeep(
                                                                mesh,
                                                        );
                                                parts.forEach((p) => {
                                                        const dup = p.clone(
                                                                "partDup",
                                                                null,
                                                                true,
                                                        );
                                                        dup.computeWorldMatrix(
                                                                true,
                                                        );
                                                        if (
                                                                typeof dup.flipFaces ===
                                                                "function"
                                                        )
                                                                dup.flipFaces();
                                                        allToolParts.push(dup);
                                                });
                                        });

                                        allToolParts.forEach((part) => {
                                                try {
                                                        const partCSG =
                                                                flock.BABYLON.CSG2.FromMesh(
                                                                        part,
                                                                        false,
                                                                );
                                                        outerCSG =
                                                                outerCSG.subtract(
                                                                        partCSG,
                                                                );
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

                                                if (
                                                        !resultMesh ||
                                                        resultMesh.getTotalVertices() ===
                                                                0
                                                ) {
                                                        throw new Error(
                                                                "CSG produced empty mesh",
                                                        );
                                                }
                                        } catch (e) {
                                                console.warn(
                                                        "[subtractMeshesIndividual] CSG subtract failed:",
                                                        e.message,
                                                );
                                                console.warn(
                                                        "[subtractMeshesIndividual] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.",
                                                );

                                                // Clean up any empty meshes
                                                flock.scene.meshes
                                                        .filter(
                                                                (m) =>
                                                                        m.name ===
                                                                                "resultMesh" &&
                                                                        m.getTotalVertices() ===
                                                                                0,
                                                        )
                                                        .forEach((m) =>
                                                                m.dispose(),
                                                        );

                                                baseDuplicate.dispose();
                                                allToolParts.forEach((t) =>
                                                        t.dispose(),
                                                );
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
                                        resultMesh.position.subtractInPlace(
                                                localCenter,
                                        );
                                        resultMesh.computeWorldMatrix(true);
                                        flock.applyResultMeshProperties(
                                                resultMesh,
                                                actualBase,
                                                modelId,
                                                blockId,
                                        );

                                        baseDuplicate.dispose();
                                        allToolParts.forEach((t) =>
                                                t.dispose(),
                                        );
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
                        return this.subtractMeshesMerge(
                                modelId,
                                baseMeshName,
                                meshNames,
                        );
                }
        },
        intersectMeshes(modelId, meshList) {
                const blockId = modelId;
                modelId += "_" + flock.scene.getUniqueId();

                return flock
                        .prepareMeshes(modelId, meshList, blockId)
                        .then((validMeshes) => {
                                if (validMeshes.length) {
                                        let firstMesh = validMeshes[0];
                                        // If metadata exists, use the mesh with material.
                                        if (firstMesh.metadata?.modelName) {
                                                const meshWithMaterial =
                                                        flock._findFirstDescendantWithMaterial(
                                                                firstMesh,
                                                        );
                                                if (meshWithMaterial) {
                                                        firstMesh =
                                                                meshWithMaterial;
                                                        firstMesh.refreshBoundingInfo();
                                                        firstMesh.flipFaces();
                                                }
                                        }

                                        // Ensure mesh has valid geometry for CSG
                                        firstMesh =
                                                prepareMeshForCSG(firstMesh);
                                        if (!firstMesh) {
                                                console.warn(
                                                        "First mesh has no valid geometry for CSG intersect.",
                                                );
                                                return null;
                                        }

                                        // Create the base CSG
                                        let baseCSG;
                                        try {
                                                baseCSG =
                                                        flock.BABYLON.CSG2.FromMesh(
                                                                firstMesh,
                                                                false,
                                                        );
                                        } catch (e) {
                                                console.warn(
                                                        "[intersectMeshes] CSG2.FromMesh failed on first mesh:",
                                                        e.message,
                                                );
                                                console.warn(
                                                        "[intersectMeshes] Note: CSG operations require watertight (manifold) geometry. 3D text and merged meshes are typically non-manifold.",
                                                );
                                                return null;
                                        }

                                        // Intersect each subsequent mesh
                                        let csgFailed = false;
                                        validMeshes.slice(1).forEach((mesh) => {
                                                if (csgFailed) return;

                                                if (mesh.metadata?.modelName) {
                                                        const meshWithMaterial =
                                                                flock._findFirstDescendantWithMaterial(
                                                                        mesh,
                                                                );
                                                        if (meshWithMaterial) {
                                                                mesh =
                                                                        meshWithMaterial;
                                                                mesh.refreshBoundingInfo();
                                                                mesh.flipFaces();
                                                        }
                                                }

                                                // Ensure mesh has valid geometry for CSG
                                                mesh = prepareMeshForCSG(mesh);
                                                if (!mesh) {
                                                        console.warn(
                                                                "Skipping mesh with no valid geometry for CSG intersect.",
                                                        );
                                                        return;
                                                }

                                                try {
                                                        const meshCSG =
                                                                flock.BABYLON.CSG2.FromMesh(
                                                                        mesh,
                                                                        false,
                                                                );
                                                        baseCSG =
                                                                baseCSG.intersect(
                                                                        meshCSG,
                                                                );
                                                } catch (e) {
                                                        console.warn(
                                                                "[intersectMeshes] CSG intersect failed:",
                                                                e.message,
                                                        );
                                                        csgFailed = true;
                                                }
                                        });

                                        if (csgFailed) {
                                                console.warn(
                                                        "[intersectMeshes] Note: CSG operations require watertight (manifold) geometry.",
                                                );
                                                return null;
                                        }

                                        // Generate the resulting intersected mesh
                                        let intersectedMesh;
                                        try {
                                                intersectedMesh =
                                                        baseCSG.toMesh(
                                                                "intersectedMesh",
                                                                validMeshes[0].getScene(),
                                                                {
                                                                        centerMesh: false,
                                                                        rebuildNormals: true,
                                                                },
                                                        );

                                                if (
                                                        !intersectedMesh ||
                                                        intersectedMesh.getTotalVertices() ===
                                                                0
                                                ) {
                                                        throw new Error(
                                                                "CSG produced empty mesh",
                                                        );
                                                }
                                        } catch (e) {
                                                console.warn(
                                                        "[intersectMeshes] CSG toMesh failed:",
                                                        e.message,
                                                );
                                                console.warn(
                                                        "[intersectMeshes] Note: CSG operations require watertight (manifold) geometry.",
                                                );

                                                // Clean up any empty meshes
                                                flock.scene.meshes
                                                        .filter(
                                                                (m) =>
                                                                        m.name ===
                                                                                "intersectedMesh" &&
                                                                        m.getTotalVertices() ===
                                                                                0,
                                                        )
                                                        .forEach((m) =>
                                                                m.dispose(),
                                                        );

                                                return null;
                                        }

                                        // Keep local origin aligned with mesh bounds while preserving world placement.
                                        recenterMeshLocalOrigin(
                                                intersectedMesh,
                                        );

                                        // Apply properties to the resulting mesh
                                        flock.applyResultMeshProperties(
                                                intersectedMesh,
                                                firstMesh,
                                                modelId,
                                                blockId,
                                        );

                                        validMeshes.forEach((mesh) =>
                                                mesh.dispose(),
                                        );

                                        return modelId; // Return the modelId as per original functionality
                                } else {
                                        console.warn(
                                                "No valid meshes to intersect.",
                                        );
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
                                                const boundingInfo =
                                                        mesh.getBoundingInfo();
                                                const meshMin =
                                                        boundingInfo.boundingBox
                                                                .minimumWorld;
                                                const meshMax =
                                                        boundingInfo.boundingBox
                                                                .maximumWorld;

                                                min =
                                                        flock.BABYLON.Vector3.Minimize(
                                                                min,
                                                                meshMin,
                                                        );
                                                max =
                                                        flock.BABYLON.Vector3.Maximize(
                                                                max,
                                                                meshMax,
                                                        );
                                        });

                                        const combinedCentre = min
                                                .add(max)
                                                .scale(0.5);

                                        // Merge the valid meshes into a single mesh
                                        const updatedValidMeshes =
                                                validMeshes.map((mesh) => {
                                                        if (
                                                                mesh.metadata
                                                                        ?.modelName
                                                        ) {
                                                                const meshWithMaterial =
                                                                        flock._findFirstDescendantWithMaterial(
                                                                                mesh,
                                                                        );
                                                                if (
                                                                        meshWithMaterial
                                                                ) {
                                                                        meshWithMaterial.refreshBoundingInfo();
                                                                        meshWithMaterial.flipFaces();
                                                                        return meshWithMaterial;
                                                                }
                                                        }
                                                        return mesh;
                                                });

                                        const mergedMesh =
                                                flock.BABYLON.Mesh.MergeMeshes(
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
                                        mergedMesh.material =
                                                updatedValidMeshes[0].material;

                                        // Create the convex hull physics aggregate
                                        const hullAggregate =
                                                new flock.BABYLON.PhysicsAggregate(
                                                        mergedMesh,
                                                        flock.BABYLON.PhysicsShapeType.CONVEX_HULL,
                                                        { mass: 0 }, // Adjust mass based on use case
                                                        flock.scene,
                                                );

                                        // Create a debug mesh to visualize the convex hull
                                        const hullMesh = flock.hullMeshFromBody(
                                                hullAggregate.body,
                                        );

                                        // Offset the debug mesh to the original world position
                                        hullMesh.position = combinedCentre;

                                        hullMesh.material =
                                                updatedValidMeshes[0].material;

                                        // Apply properties to the resulting mesh
                                        flock.applyResultMeshProperties(
                                                hullMesh,
                                                updatedValidMeshes[0],
                                                modelId,
                                                blockId,
                                        );
                                        // Dispose of original meshes after creating the hull
                                        validMeshes.forEach((mesh) =>
                                                mesh.dispose(),
                                        );
                                        mergedMesh.dispose();

                                        return modelId; // Return the debug mesh for further use
                                } else {
                                        console.warn(
                                                "No valid meshes to create a hull.",
                                        );
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
                                        flock.whenModelReady(
                                                meshName,
                                                (mesh) => {
                                                        if (mesh) {
                                                                mesh.name =
                                                                        modelId;
                                                                mesh.metadata =
                                                                        mesh.metadata ||
                                                                        {};
                                                                mesh.metadata.blockKey =
                                                                        blockId;
                                                                resolve(mesh);
                                                        } else {
                                                                console.warn(
                                                                        `Could not resolve mesh for ${meshName}`,
                                                                );
                                                                resolve(null);
                                                        }
                                                },
                                        );
                                });
                        }),
                ).then((meshes) => meshes.filter((mesh) => mesh !== null));
        },
        applyResultMeshProperties(resultMesh, referenceMesh, modelId, blockId) {
                // Copy transformation properties
                referenceMesh.material.backFaceCulling = false;

                resultMesh.scaling.copyFrom(referenceMesh.scaling);

                resultMesh.name = modelId;
                resultMesh.metadata = resultMesh.metadata || {};
                resultMesh.metadata.blockKey = blockId;

                // Apply physics
                flock.applyPhysics(
                        resultMesh,
                        new flock.BABYLON.PhysicsShapeMesh(
                                resultMesh,
                                flock.scene,
                        ),
                );

                // Log and replace default materials
                const isDefaultMaterial = (material) => {
                        return (
                                material instanceof
                                        flock.BABYLON.StandardMaterial &&
                                material.name === "default material"
                        );
                };

                const replaceMaterial = () => {
                        return referenceMesh.material.clone("clonedMaterial");
                };

                if (resultMesh.material) {
                        if (
                                resultMesh.material instanceof
                                flock.BABYLON.MultiMaterial
                        ) {
                                resultMesh.material.subMaterials =
                                        resultMesh.material.subMaterials.map(
                                                (subMaterial) => {
                                                        if (
                                                                subMaterial &&
                                                                isDefaultMaterial(
                                                                        subMaterial,
                                                                )
                                                        ) {
                                                                return replaceMaterial();
                                                        }
                                                        return subMaterial;
                                                },
                                        );
                        } else if (isDefaultMaterial(resultMesh.material)) {
                                resultMesh.material = replaceMaterial();
                                resultMesh.material.backFaceCulling = false;
                        }
                } else {
                        // No material assigned by CSG - copy from reference mesh
                        resultMesh.material =
                                referenceMesh.material.clone(
                                        "csgResultMaterial",
                                );
                        resultMesh.material.backFaceCulling = false;
                }
        },
};
