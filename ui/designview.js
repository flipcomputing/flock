import * as Blockly from "blockly";
import {
	meshMap,
	meshBlockIdMap,
	generateUniqueId,
} from "../generators";
import { flock } from "../flock.js";

export function updateOrCreateMeshFromBlock(block) {
	if (!window.loadingCode) {
		const mesh = getMeshFromBlock(block);

		if (mesh) {
			updateMeshFromBlock(mesh, block);
		} else {
			createMeshOnCanvas(block);
		}
	}
}

export function getMeshFromBlock(block) {
	const blockKey = Object.keys(meshMap).find((key) => meshMap[key] === block);

	return flock.scene?.meshes?.find((mesh) => mesh.blockKey === blockKey);
}

export function updateMeshFromBlock(mesh, block) {
	const shapeType = block.type;
	mesh.physics.disablePreStep = true;

	const color = block
		.getInput("COLOR")
		.connection.targetBlock()
		.getFieldValue("COLOR");

	// Retrieve the position values (X, Y, Z) from the connected blocks
	const position = {
		x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
		y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
		z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
	};

	// Use flock API to change the color and position of the mesh
	if (color) flock.changeColour(mesh.name, color);

	flock.positionAt(mesh.name, position.x, position.y, position.z);

	// Shape-specific updates based on the block type
	switch (shapeType) {
		case "create_box":
			// Retrieve width, height, and depth from connected blocks
			const width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const depth = block
				.getInput("DEPTH")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the box (not scaling)
			setAbsoluteSize(mesh, width, height, depth);
			break;

		case "create_sphere":
			// Retrieve diameter values for X, Y, Z from connected blocks
			const diameterX = block
				.getInput("DIAMETER_X")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterY = block
				.getInput("DIAMETER_Y")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterZ = block
				.getInput("DIAMETER_Z")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the sphere based on diameters
			setAbsoluteSize(mesh, diameterX, diameterY, diameterZ);
			break;

		case "create_cylinder":
			// Retrieve height, diameterTop, and diameterBottom from connected blocks
			const cylinderHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterTop = block
				.getInput("DIAMETER_TOP")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const diameterBottom = block
				.getInput("DIAMETER_BOTTOM")
				.connection.targetBlock()
				.getFieldValue("NUM");

			updateCylinderGeometry(
				mesh,
				diameterTop,
				diameterBottom,
				cylinderHeight,
			);
			break;

		case "create_capsule":
			// Retrieve radius and height from connected blocks
			const radius = block
				.getInput("RADIUS")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const capsuleHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the capsule
			setAbsoluteSize(mesh, radius * 2, capsuleHeight, radius * 2);
			break;

		case "create_plane":
			// Retrieve width and height from connected blocks
			const planeWidth = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			const planeHeight = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");

			// Set the absolute size of the plane
			setAbsoluteSize(mesh, planeWidth, planeHeight, 1); // Planes are usually flat in the Z dimension
			break;

		default:
			console.warn(`Unknown shape type: ${shapeType}`);
	}
}

function createMeshOnCanvas(block) {
	Blockly.Events.setGroup(true);

	let shapeType = block.type;
	let color,
		width,
		height,
		depth,
		diameterX,
		diameterY,
		diameterZ,
		radius,
		diameterTop,
		diameterBottom,
		position;

	// Retrieve values from the block's fields
	switch (shapeType) {
		case "create_box":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			depth = block
				.getInput("DEPTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_sphere":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			diameterX = block
				.getInput("DIAMETER_X")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterY = block
				.getInput("DIAMETER_Y")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterZ = block
				.getInput("DIAMETER_Z")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_cylinder":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterTop = block
				.getInput("DIAMETER_TOP")
				.connection.targetBlock()
				.getFieldValue("NUM");
			diameterBottom = block
				.getInput("DIAMETER_BOTTOM")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_capsule":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			radius = block
				.getInput("RADIUS")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		case "create_plane":
			color = block
				.getInput("COLOR")
				.connection.targetBlock()
				.getFieldValue("COLOR");
			width = block
				.getInput("WIDTH")
				.connection.targetBlock()
				.getFieldValue("NUM");
			height = block
				.getInput("HEIGHT")
				.connection.targetBlock()
				.getFieldValue("NUM");
			break;

		default:
			Blockly.Events.setGroup(false);
			return;
	}

	// Get position values from the block
	position = {
		x: block.getInput("X").connection.targetBlock().getFieldValue("NUM"),
		y: block.getInput("Y").connection.targetBlock().getFieldValue("NUM"),
		z: block.getInput("Z").connection.targetBlock().getFieldValue("NUM"),
	};

	// Create the appropriate mesh based on shapeType
	let newMesh;
	switch (shapeType) {
		case "create_box":
			newMesh = flock.newBox(
				color,
				width,
				height,
				depth,
				position.x,
				position.y,
				position.z,
				"box_" + generateUniqueId(),
			);
			break;

		case "create_sphere":
			newMesh = flock.newSphere(
				color,
				diameterX,
				diameterY,
				diameterZ,
				position.x,
				position.y + diameterY / 2,
				position.z,
				"sphere_" + generateUniqueId(),
			);
			break;

		case "create_cylinder":
			newMesh = flock.newCylinder(
				color,
				height,
				diameterTop,
				diameterBottom,
				position.x,
				position.y + height / 2,
				position.z,
				"cylinder_" + generateUniqueId(),
			);
			break;

		case "create_capsule":
			newMesh = flock.newCapsule(
				color,
				radius,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"capsule_" + generateUniqueId(),
			);
			break;

		case "create_plane":
			newMesh = flock.newPlane(
				color,
				width,
				height,
				position.x,
				position.y + height / 2,
				position.z,
				"plane_" + generateUniqueId(),
			);
			break;
	}

	// Store the mesh in the meshMap
	if (newMesh) {
		const blockKey = flock.scene.getMeshByName(newMesh).blockKey;
		meshMap[blockKey] = block;
		meshBlockIdMap[blockKey] = block.id;
	}

	Blockly.Events.setGroup(false);
}

function setAbsoluteSize(mesh, width, height, depth) {
	const boundingInfo = mesh.getBoundingInfo();
	const originalSize = boundingInfo.boundingBox.extendSize;

	mesh.scaling.x = width / (originalSize.x * 2);
	mesh.scaling.y = height / (originalSize.y * 2);
	mesh.scaling.z = depth / (originalSize.z * 2);

	let shapeType = null;

	if (mesh.metadata) shapeType = mesh.metadata.shapeType;

	if (mesh.physics && shapeType) {
		const shape = mesh.physics.shape;
		let newShape;

		// Create the new physics shape based on the type
		switch (shapeType) {
			case "Box":
				newShape = new BABYLON.PhysicsShapeBox(
					new BABYLON.Vector3(0, 0, 0),
					new BABYLON.Quaternion(0, 0, 0, 1),
					new BABYLON.Vector3(width, height, depth),
					mesh.getScene(),
				);
				break;

			case "Cylinder":
				const diameterBottom = Math.min(width, depth);
				const startPoint = new flock.BABYLON.Vector3(0, -height / 2, 0);
				const endPoint = new flock.BABYLON.Vector3(0, height / 2, 0);

				newShape = new flock.BABYLON.PhysicsShapeCylinder(
					startPoint,
					endPoint,
					diameterBottom / 2,
					mesh.getScene(),
				);
				break;

			case "Sphere":
				newShape = new flock.BABYLON.PhysicsShapeSphere(
					new flock.BABYLON.Vector3(0, 0, 0),
					Math.max(width, depth, height) / 2,
					mesh.getScene(),
				);
				break;

			case "Capsule":
				const radius = Math.min(width, depth) / 2;
				newShape = new flock.BABYLON.PhysicsShapeCapsule(
					new flock.BABYLON.Vector3(0, 0, 0),
					radius, // Radius of the spherical ends
					height / 2, // Half the height of the cylindrical part
					mesh.getScene(),
				);
				break;

			default:
				console.log(
					"Unknown or unsupported physics shape type: " + shapeType,
				);
				break;
		}

		if (newShape) {
			shape.dispose();
			const physicsBody = mesh.physics;
			physicsBody.shape = newShape;
			mesh.physics.disablePreStep;
			mesh.computeWorldMatrix(true);
		}
	}
}