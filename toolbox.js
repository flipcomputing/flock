import * as Blockly from "blockly";
import "@blockly/toolbox-search";
import { translate } from "./main/translation.js";

export const categoryColours = {
        Events: 5,
        Scene: 85,
        Transform: 65,
        Animate: 45,
        Materials: 280,
        Sound: 25,
        Sensing: 180,
        Snippets: 200,
        Control: "%{BKY_LOOPS_HUE}",
        Logic: "%{BKY_LOGIC_HUE}",
        Variables: "%{BKY_VARIABLES_HUE}",
        Text: "%{BKY_TEXTS_HUE}",
        Lists: "%{BKY_LISTS_HUE}",
        Math: "%{BKY_MATH_HUE}",
        Procedures: "%{BKY_PROCEDURES_HUE}",
};

const toolboxSearch = {
        kind: "search",
        name: "Search",
        contents: [],
};

const toolboxSceneMeshes = {
        kind: "category",
        name: "%{BKY_CATEGORY_MESHES}",
        icon: "./images/meshes.svg",
        //colour: categoryColours["Scene"],
        categorystyle: "scene_category",
        contents: [
                {
                        kind: "block",
                        type: "load_model",
                        keyword: "model",
                        inputs: {
                                SCALE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "load_character",
                        keyword: "character",
                        inputs: {
                                SCALE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                HAIR_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000000",
                                                },
                                        },
                                },
                                SKIN_COLOR: {
                                        shadow: {
                                                type: "skin_colour",
                                                fields: {
                                                        COLOR: "A15C33",
                                                },
                                        },
                                },
                                EYES_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000000",
                                                },
                                        },
                                },
                                SLEEVES_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#008B8B",
                                                },
                                        },
                                },
                                SHORTS_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "00008B",
                                                },
                                        },
                                },
                                TSHIRT_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FF8F60",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "load_object",
                        keyword: "object",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour", // Correct type for color field
                                                fields: {
                                                        COLOR: "#FFD700", // Gold
                                                },
                                        },
                                },
                                SCALE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "load_multi_object",
                        keyword: "object",
                        inputs: {
                                SCALE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                COLORS: {
                                        shadow: {
                                                type: "lists_create_with",
                                                extraState: { itemCount: 2 },
                                                inline: true,
                                                inputs: {
                                                        ADD0: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#66CDAA",
                                                                        },
                                                                },
                                                        },
                                                        ADD1: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#CD853F",
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_box",
                        keyword: "box",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#6666cc",
                                                },
                                        },
                                },
                                WIDTH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                HEIGHT: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DEPTH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_sphere",
                        keyword: "sphere",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ff6666",
                                                },
                                        },
                                },
                                DIAMETER_X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DIAMETER_Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DIAMETER_Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_cylinder",
                        keyword: "cylinder",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ffcc00",
                                                },
                                        },
                                },
                                HEIGHT: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DIAMETER_TOP: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DIAMETER_BOTTOM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                TESSELLATIONS: {
                                        // Add the tessellations input
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 24, // Default tessellation value
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0.5,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_capsule",
                        keyword: "capsule",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#339999",
                                                },
                                        },
                                },
                                DIAMETER: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                HEIGHT: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 2,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_plane",
                        keyword: "plane",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#cc33cc",
                                                },
                                        },
                                },
                                WIDTH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 2,
                                                },
                                        },
                                },
                                HEIGHT: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 2,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "clone_mesh",
                        keyword: "clone",
                },
        ],
};

const toolboxSceneXR = {
        kind: "category",
        name: "%{BKY_CATEGORY_XR}",
        icon: "./images/xr.svg",
        //colour: categoryColours["Scene"],
        categorystyle: "scene_category",
        contents: [
                {
                        kind: "block",
                        type: "device_camera_background",
                        keyword: "devcam",
                },
                {
                        kind: "block",
                        type: "set_xr_mode",
                        keyword: "xr",
                },
                {
                        kind: "block",
                        type: "export_mesh",
                        keyword: "export",
                },
        ],
};

const toolboxSceneLights = {
        kind: "category",
        name: "%{BKY_CATEGORY_EFFECTS}",
        icon: "./images/lights.svg",
        //colour: categoryColours["Scene"],
        categorystyle: "scene_category",
        contents: [
                {
                        kind: "block",
                        type: "main_light",
                        keyword: "intensity",
                        inputs: {
                                INTENSITY: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DIFFUSE: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFFFFF",
                                                },
                                        },
                                },
                                GROUND_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#808080",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "get_light",
                        keyword: "light",
                },
                {
                        kind: "block",
                        type: "create_particle_effect",
                        keyword: "particle",
                        inputs: {
                                RATE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 20,
                                                },
                                        },
                                },
                                MIN_SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0.1,
                                                },
                                        },
                                },
                                MAX_SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                START_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFFFFF",
                                                },
                                        },
                                },
                                END_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#00ffff",
                                                },
                                        },
                                },
                                START_ALPHA: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                END_ALPHA: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },

                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 2,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                MIN_LIFETIME: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                MAX_LIFETIME: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 3,
                                                },
                                        },
                                },
                                MIN_ANGULAR_SPEED: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                MAX_ANGULAR_SPEED: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                MIN_INITIAL_ROTATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                MAX_INITIAL_ROTATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "control_particle_system",
                        keyword: "cps",
                        inputsInline: true,
                },
                {
                        kind: "block",
                        type: "set_fog",
                        keyword: "fog",
                        inputs: {
                                FOG_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ffffff",
                                                },
                                        },
                                },
                                DENSITY: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0.1,
                                                },
                                        },
                                },
                                START: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                END: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxSceneCamera = {
        kind: "category",
        name: "%{BKY_CATEGORY_CAMERA}",
        icon: "./images/camera.svg",
        //colour: categoryColours["Scene"],
        categorystyle: "scene_category",
        contents: [
                {
                        kind: "block",
                        type: "get_camera",
                        keyword: "cam",
                },
                {
                        kind: "block",
                        type: "camera_follow",
                        keyword: "follow",
                        inputs: {
                                RADIUS: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 7,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "camera_control",
                        keyword: "cc",
                },
        ],
};

const toolboxScene = {
        kind: "category",
        name: "%{BKY_CATEGORY_SCENE}",
        icon: "./images/scene.svg",
        //colour: categoryColours["Scene"],
        categorystyle: "scene_category",
        contents: [
                {
                        kind: "block",
                        type: "set_sky_color",
                        keyword: "sky",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#6495ED",
                                                },
                                        },
                                },
                        },
                },
                /*{
                        kind: "block",
                        type: "create_ground",
                        keyword: "ground",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#71BC78",
                                                },
                                        },
                                },
                        },
                },*/
                {
                        kind: "block",
                        type: "create_map",
                        keyword: "map",
                        inputs: {
                                MATERIAL: {
                                        shadow: {
                                                type: "material",
                                                inputs: {
                                                        BASE_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#71BC78",
                                                                        },
                                                                },
                                                        },

                                                        ALPHA: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1.0, // Default alpha value: 1 (fully opaque)
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "set_background_color",
                        keyword: "background",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#6495ED",
                                                },
                                        },
                                },
                        },
                },
                /*{
                        kind: "block",
                        type: "create_map",
                        keyword: "map",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#71BC78",
                                                },
                                        },
                                },
                        },
                },*/
                {
                        kind: "block",
                        type: "show",
                        keyword: "show",
                },
                {
                        kind: "block",
                        type: "hide",
                        keyword: "hide",
                },
                {
                        kind: "block",
                        type: "dispose",
                        keyword: "dispose",
                },
                toolboxSceneMeshes,
                toolboxSceneLights,
                toolboxSceneCamera,
                toolboxSceneXR,
        ],
};

const toolboxEvents = {
        kind: "category",
        name: "%{BKY_CATEGORY_EVENTS}",
        icon: "./images/events.svg",
        //colour: categoryColours["Events"],
        categorystyle: "events_category",
        contents: [
                {
                        kind: "block",
                        type: "start",
                        keyword: "start",
                },
                {
                        kind: "block",
                        type: "forever",
                        keyword: "ever",
                },
                {
                        kind: "block",
                        type: "when_clicked",
                        keyword: "click",
                },
                {
                        kind: "block",
                        type: "on_collision",
                        keyword: "collision",
                },
                /*{
                        kind: "block",
                        type: "when_key_event",
                        keyword: "press",
                },*/
                {
                        kind: "block",
                        type: "when_action_event",
                        keyword: "action",
                },
                {
                        kind: "block",
                        type: "broadcast_event",
                        keyword: "broadcast",
                        inputs: {
                                EVENT_NAME: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "go",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "on_event",
                        keyword: "on",
                        inputs: {
                                EVENT_NAME: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "go",
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxTransformPhysics = {
        kind: "category",
        name: "%{BKY_CATEGORY_PHYSICS}",
        icon: "./images/physics.svg",
        //colour: categoryColours["Transform"],
        categorystyle: "transform_category",
        contents: [
                {
                        kind: "block",
                        type: "add_physics",
                        keyword: "physics",
                },
                {
                        kind: "block",
                        type: "add_physics_shape",
                        keyword: "collider",
                },
                {
                        kind: "block",
                        type: "apply_force",
                        keyword: "push",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 2,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "show_physics",
                        keyword: "colliders",
                },
                {
                        kind: "block",
                        type: "move_forward",
                        keyword: "forward",
                        inputs: {
                                SPEED: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 3,
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxTransformConnect = {
        kind: "category",
        name: "%{BKY_CATEGORY_CONNECT}",
        icon: "./images/connect.svg",
        //colour: categoryColours["Transform"],
        categorystyle: "transform_category",
        contents: [
                {
                        kind: "block",
                        type: "parent",
                        keyword: "parent",
                },
                {
                        kind: "block",
                        type: "parent_child",
                        keyword: "parch",
                        inputs: {
                                X_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "remove_parent",
                        keyword: "noparent",
                },
                {
                        kind: "block",
                        type: "follow",
                        keyword: "follow",
                        inputs: {
                                X_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "stop_follow",
                        keyword: "fstop",
                },
                /*{
                        kind: "block",
                        type: "hold",
                        keyword: "hold",
                        inputs: {
                                X_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },*/
                {
                        kind: "block",
                        type: "attach",
                        keyword: "hold",
                        inputs: {
                                X_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z_OFFSET: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "drop",
                        keyword: "drop",
                },
        ],
};

const toolboxTransformCombine = {
        kind: "category",
        name: "%{BKY_CATEGORY_COMBINE}",
        icon: "./images/combine.svg",
        //colour: categoryColours["Transform"],
        categorystyle: "transform_category",
        contents: [
                {
                        kind: "block",
                        type: "merge_meshes",
                        inputsInline: true,
                        inputs: {
                                MESH_LIST: {
                                        block: {
                                                type: "lists_create_with",
                                                inline: true,
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "variables_get",
                                                                        fields: {
                                                                                VAR: "mesh1", // Default variable for a mesh
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "subtract_meshes",
                        inputsInline: true,
                        inputs: {
                                MESH_LIST: {
                                        block: {
                                                type: "lists_create_with",
                                                inline: true,
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "variables_get",
                                                                        fields: {
                                                                                VAR: "object2", // Default variable for a mesh to subtract
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "intersection_meshes",
                        inputsInline: true,
                        inputs: {
                                MESH_LIST: {
                                        block: {
                                                type: "lists_create_with",
                                                inline: true,
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "variables_get",
                                                                        fields: {
                                                                                VAR: "mesh1", // Default variable for a mesh
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "hull_meshes",
                        inputsInline: true,
                        inputs: {
                                MESH_LIST: {
                                        block: {
                                                type: "lists_create_with",
                                                inline: true,
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "variables_get",
                                                                        fields: {
                                                                                VAR: "mesh1", // Default variable for a mesh
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxTransform = {
        kind: "category",
        name: "%{BKY_CATEGORY_TRANSFORM}",
        icon: "./images/motion.svg",
        //colour: categoryColours["Transform"],
        categorystyle: "transform_category",
        contents: [
                {
                        kind: "block",
                        type: "move_by_xyz",
                        keyword: "move",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "move_by_xyz_single",
                        keyword: "move",
                        inputs: {
                                VALUE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "move_to_xyz",
                        keyword: "pos",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "move_to_xyz_single",
                        keyword: "pos",
                        inputs: {
                                VALUE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "move_to",
                        keyword: "goto",
                },
                {
                        kind: "block",
                        type: "rotate_model_xyz",
                        keyword: "rotate",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 45,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "rotate_to",
                        keyword: "rxyz",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "look_at",
                        keyword: "look",
                },
                {
                        kind: "block",
                        type: "scale",
                        keyword: "scale",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "resize",
                        keyword: "resize",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                /*{
                        kind: "block",
                        type: "xyz", // Use the block's actual type name defined when you created it
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },*/
                {
                        kind: "block",
                        type: "set_pivot",
                        inputs: {
                                X_PIVOT: {
                                        shadow: {
                                                type: "min_centre_max",
                                                fields: {
                                                        PIVOT_OPTION: "CENTER",
                                                },
                                        },
                                },
                                Y_PIVOT: {
                                        shadow: {
                                                type: "min_centre_max",
                                                fields: {
                                                        PIVOT_OPTION: "CENTER",
                                                },
                                        },
                                },
                                Z_PIVOT: {
                                        shadow: {
                                                type: "min_centre_max",
                                                fields: {
                                                        PIVOT_OPTION: "CENTER",
                                                },
                                        },
                                },
                        },
                },
                toolboxTransformPhysics,
                toolboxTransformConnect,
                toolboxTransformCombine,
        ],
};

const toolboxAnimateKeyframe = {
        kind: "category",
        name: "%{BKY_CATEGORY_KEYFRAME}",
        icon: "./images/keyframe.svg",
        //colour: categoryColours["Animate"],
        categorystyle: "animate_category",
        contents: [
                {
                        kind: "block",
                        type: "animation",
                        keyword: "animation",
                        inputsInline: true, // Set lists to be inline
                        inputs: {
                                KEYFRAMES: {
                                        block: {
                                                type: "lists_create_with",
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "colour_keyframe", // Reusing your `colour_keyframe` block
                                                                        inputs: {
                                                                                VALUE: {
                                                                                        shadow: {
                                                                                                type: "colour",
                                                                                                fields: {
                                                                                                        COLOR: "#ff0000", // Default colour: Red
                                                                                                },
                                                                                        },
                                                                                },
                                                                                DURATION: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 1, // Default duration: 1 second
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "animate_keyframes",
                        keyword: "animate_keyframes",
                        inputsInline: true, // Set lists to be inline
                        inputs: {
                                KEYFRAMES: {
                                        block: {
                                                type: "lists_create_with",
                                                extraState: {
                                                        itemCount: 1,
                                                },
                                                inputs: {
                                                        ADD0: {
                                                                block: {
                                                                        type: "colour_keyframe",
                                                                        inputs: {
                                                                                VALUE: {
                                                                                        shadow: {
                                                                                                type: "colour",
                                                                                                fields: {
                                                                                                        COLOR: "#ff0000", // Default colour: Red
                                                                                                },
                                                                                        },
                                                                                },
                                                                                DURATION: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 1, // Default duration: 1 second
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "control_animation_group",
                        keyword: "group",
                        inputsInline: true,
                },
                {
                        kind: "block",
                        type: "animate_from",
                        inputs: {
                                TIME: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1.0, // Default time in seconds
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "colour_keyframe",
                        inputs: {
                                VALUE: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000080",
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 5,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "number_keyframe",
                        inputs: {
                                VALUE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "xyz_keyframe",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                /*{
                                kind: "block",
                                type: "animate_property",
                                keyword: "anp",
                        },*/
        ],
};

const toolboxAnimate = {
        kind: "category",
        name: "%{BKY_CATEGORY_ANIMATE}",
        icon: "./images/animate.svg",
        //colour: categoryColours["Animate"],
        categorystyle: "animate_category",
        contents: [
                {
                        kind: "block",
                        type: "switch_animation",
                        keyword: "switch",
                        inputs: {
                                ANIMATION_NAME: {
                                        shadow: {
                                                type: "animation_name",
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "play_animation",
                        keyword: "play",
                        inputs: {
                                ANIMATION_NAME: {
                                        shadow: {
                                                type: "animation_name",
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "animation_name",
                },
                {
                        kind: "block",
                        type: "glide_to_seconds",
                        keyword: "glide",
                        inputs: {
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "glide_to_object",
                        keyword: "glide",
                        inputs: {
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "rotate_anim_seconds",
                        keyword: "rotate",
                        inputs: {
                                ROT_X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0, // Default rotation for X-axis
                                                },
                                        },
                                },
                                ROT_Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0, // Default rotation for Y-axis
                                                },
                                        },
                                },
                                ROT_Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0, // Default rotation for Z-axis
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "stop_animations",
                        keyword: "anistop",
                },
                toolboxAnimateKeyframe,
        ],
};

const toolboxControl = {
        kind: "category",
        name: "%{BKY_CATEGORY_CONTROL}",
        icon: "./images/control.svg",
        //colour: categoryColours["Control"],
        categorystyle: "control_category",
        contents: [
                {
                        kind: "block",
                        type: "wait_seconds",
                        keyword: "waits",
                        inputs: {
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "wait_until",
                        keyword: "until",
                },
                {
                        kind: "block",
                        type: "controls_repeat_ext",
                        keyword: "repeat",
                        inputs: {
                                TIMES: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 10,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "controls_whileUntil",
                        keyword: "while",
                },
                {
                        kind: "block",
                        type: "controls_for",
                        keyword: "for",
                        inputs: {
                                FROM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                TO: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 9,
                                                },
                                        },
                                },
                                BY: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },

                /*{
                        kind: "block",
                        type: "for_loop",
                        keyword: "for",
                        inputs: {
                                FROM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0
                                                }
                                        }
                                },
                                TO: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 9
                                                }
                                        }
                                },
                                BY: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1
                                                }
                                        }
                                }
                        }
                },*/
                {
                        kind: "block",
                        type: "controls_forEach",
                        keyword: "each",
                },
                {
                        kind: "block",
                        type: "controls_flow_statements",
                        keyword: "break",
                },
                {
                        kind: "block",
                        type: "local_variable",
                        keyword: "local",
                },
                {
                        kind: "block",
                        type: "wait",
                        keyword: "wait",
                        inputs: {
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1000,
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxCondition = {
        kind: "category",
        name: "%{BKY_CATEGORY_CONDITION}",
        icon: "./images/conditions.svg",
        //colour: categoryColours["Logic"],
        categorystyle: "logic_category",
        contents: [
                // {
                //         kind: "block",
                //         type: "controls_if",
                //         keyword: "if",
                // },
                {
                        kind: "block",
                        type: "if_clause",
                        keyword: "if",
                },
                {
                        kind: "block",
                        type: "logic_compare",
                        keyword: "compare",
                        inputs: {
                                B: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: "0",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "logic_operation",
                        keyword: "op",
                },
                {
                        kind: "block",
                        type: "logic_negate",
                        keyword: "not",
                },
                {
                        kind: "block",
                        type: "logic_boolean",
                        keyword: "bool",
                },
                {
                        kind: "block",
                        type: "logic_null",
                        keyword: "null",
                },
                {
                        kind: "block",
                        type: "logic_ternary",
                        keyword: "ternary",
                },
        ],
};

const toolboxSensing = {
        kind: "category",
        name: "%{BKY_CATEGORY_SENSING}",
        icon: "./images/sensing.svg",
        //colour: categoryColours["Sensing"],
        categorystyle: "sensing_category",
        contents: [
                /*{
                        kind: "block",
                        type: "key_pressed",
                        keyword: "ispressed",
                },*/
                {
                        kind: "block",
                        type: "action_pressed",
                        keyword: "action",
                },
                {
                        kind: "block",
                        type: "mesh_exists",
                        keyword: "exists",
                },
                {
                        kind: "block",
                        type: "touching_surface",
                        keyword: "surface",
                },
                {
                        kind: "block",
                        type: "meshes_touching",
                        keyword: "istouching",
                },
                {
                        kind: "block",
                        type: "get_property",
                        keyword: "get",
                },
                {
                        kind: "block",
                        type: "distance_to",
                        keyword: "dist",
                },
                {
                        kind: "block",
                        type: "ground_level",
                        keyword: "ground",
                },
                {
                        kind: "block",
                        type: "time",
                        keyword: "time",
                },
                {
                        kind: "block",
                        type: "canvas_controls",
                        keyword: "canvas",
                },
                {
                        kind: "block",
                        type: "button_controls",
                        keyword: "button",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFFFFF",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "microbit_input",
                        keyword: "microbit",
                },
        ],
};

const toolboxText = {
        kind: "category",
        name: "%{BKY_CATEGORY_TEXT}",
        icon: "./images/text.svg",
        //colour: categoryColours["Text"],
        categorystyle: "text_category",
        contents: [
                {
                        kind: "block",
                        type: "print_text",
                        keyword: "print",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "🌈 Hello",
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 30,
                                                },
                                        },
                                },
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000080",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "say",
                        keyword: "say",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "Hello",
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 3,
                                                },
                                        },
                                },
                                ALPHA: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 20,
                                                },
                                        },
                                },
                                TEXT_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000000",
                                                },
                                        },
                                },
                                BACKGROUND_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ffffff",
                                                },
                                        },
                                },
                        },
                        fields: {
                                MODE: "ADD",
                        },
                },
                {
                        kind: "block",
                        type: "ui_text",
                        keyword: "ui",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "Info",
                                                },
                                        },
                                },
                                DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000080",
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                FONT_SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 24,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "ui_button",
                        keyword: "ui",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "Click Me",
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                TEXT_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFFFFF", // Using "COLOR" to match your example
                                                },
                                        },
                                },
                                BACKGROUND_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#007ACC", // Using "COLOR" to match your example
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "ui_input",
                        keyword: "ui",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "What's your name?",
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                TEXT_SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 24,
                                                },
                                        },
                                },
                                TEXT_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ffffff",
                                                },
                                        },
                                },
                                BACKGROUND_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000080",
                                                },
                                        },
                                },
                        },
                        fields: {
                                SIZE: "MEDIUM",
                        },
                },
                {
                        kind: "block",
                        type: "ui_slider",
                        keyword: "ui",
                        inputs: {
                                MIN: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                MAX: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                VALUE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 50,
                                                },
                                        },
                                },
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#ffffff",
                                                },
                                        },
                                },
                                BACKGROUND: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#000080",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "text",
                        keyword: "text",
                },
                {
                        kind: "block",
                        type: "comment",
                        keyword: "//",
                        inputs: {
                                COMMENT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "comment",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "create_3d_text",
                        keyword: "text",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "Hello World",
                                                },
                                        },
                                },
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFFFFF",
                                                },
                                        },
                                },
                                SIZE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                DEPTH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1.0,
                                                },
                                        },
                                },
                                X: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Y: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                                Z: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "category",
                        name: "%{BKY_CATEGORY_STRINGS}",
                        icon: "./images/text.svg",
                        //colour: categoryColours["Text"],
                        categorystyle: "text_category",
                        contents: [
                                {
                                        kind: "block",
                                        type: "text_join",
                                        keyword: "text",
                                },
                                {
                                        kind: "block",
                                        type: "text_append",
                                        keyword: "join",
                                        inputs: {
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_length",
                                        keyword: "length",
                                        inputs: {
                                                VALUE: {
                                                        shadow: {
                                                                type: "text",
                                                                fields: {
                                                                        TEXT: "abc",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_isEmpty",
                                        keyword: "isempty",
                                        inputs: {
                                                VALUE: {
                                                        shadow: {
                                                                type: "text",
                                                                fields: {
                                                                        TEXT: "",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_indexOf",
                                        keyword: "index",
                                        inputs: {
                                                VALUE: {
                                                        block: {
                                                                type: "variables_get",
                                                                fields: {
                                                                        VAR: "text",
                                                                },
                                                        },
                                                },
                                                FIND: {
                                                        shadow: {
                                                                type: "text",
                                                                fields: {
                                                                        TEXT: "abc",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_charAt",
                                        keyword: "charat",
                                        inputs: {
                                                VALUE: {
                                                        block: {
                                                                type: "variables_get",
                                                                fields: {
                                                                        VAR: "text",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_getSubstring",
                                        keyword: "substring",
                                        inputs: {
                                                STRING: {
                                                        block: {
                                                                type: "variables_get",
                                                                fields: {
                                                                        VAR: "text",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_changeCase",
                                        keyword: "case",
                                        inputs: {
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                                fields: {
                                                                        TEXT: "abc",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_trim",
                                        keyword: "trim",
                                        inputs: {
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                                fields: {
                                                                        TEXT: "abc",
                                                                },
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_count",
                                        keyword: "count",
                                        inputs: {
                                                SUB: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_replace",
                                        keyword: "replace",
                                        inputs: {
                                                FROM: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                                TO: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                        },
                                },
                                {
                                        kind: "block",
                                        type: "text_reverse",
                                        keyword: "reverse",
                                        inputs: {
                                                TEXT: {
                                                        shadow: {
                                                                type: "text",
                                                        },
                                                },
                                        },
                                },
                                /*{
                                kind: "label",
                                text: "Input/Output:",
                                "web-class": "ioLabel",
                        },*/
                        ],
                },
        ],
};

const toolboxMaterials = {
        kind: "category",
        name: "%{BKY_CATEGORY_MATERIALS}",
        icon: "./images/looks.svg",
        //colour: categoryColours["Materials"],
        categorystyle: "materials_category",
        contents: [
                {
                        kind: "block",
                        type: "change_color",
                        keyword: "colour",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#008080",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "set_alpha",
                        keyword: "alpha",
                        inputs: {
                                ALPHA: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 0.5,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "tint",
                        keyword: "tint",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#AA336A",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "highlight",
                        keyword: "highlight",
                        inputs: {
                                COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FFD700",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "glow",
                        keyword: "glow",
                },
                {
                        kind: "block",
                        type: "clear_effects",
                        keyword: "clear",
                },
                {
                        kind: "block",
                        type: "colour",
                        keyword: "setcol",
                },
                {
                        kind: "block",
                        type: "lists_create_with",
                        extraState: { itemCount: 2 },
                        inline: true,
                        inputs: {
                                ADD0: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FF5733",
                                                },
                                        },
                                },
                                ADD1: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#FDFD96",
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "random_colour",
                        keyword: "randcol",
                },
                {
                        kind: "block",
                        type: "colour_from_string",
                        keyword: "colstr",
                },
                {
                        kind: "block",
                        type: "set_material",
                        inputs: {
                                MATERIAL: {
                                        shadow: {
                                                type: "material",
                                                inputs: {
                                                        BASE_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#FF7F50",
                                                                        },
                                                                },
                                                        },

                                                        ALPHA: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1.0, // Default alpha value: 1 (fully opaque)
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "material",
                        fields: {
                                TEXTURE_SET: "grass.png", // Use the named material
                        },
                        inputs: {
                                BASE_COLOR: {
                                        shadow: {
                                                type: "colour",
                                                fields: {
                                                        COLOR: "#00AA00", // Default to a green colour
                                                },
                                        },
                                },
                                ALPHA: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1, // Default alpha value: 1 (fully opaque)
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxSound = {
        kind: "category",
        name: "%{BKY_CATEGORY_SOUND}",
        icon: "./images/sound.svg",
        //colour: categoryColours["Sound"],
        categorystyle: "sound_category",
        contents: [
                {
                        kind: "block",
                        type: "play_sound",
                        keyword: "sound",
                        inputs: {
                                SPEED: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                VOLUME: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "stop_all_sounds",
                },
                {
                        kind: "block",
                        type: "midi_note",
                        fields: {
                                NOTE: 60,
                        },
                },
                {
                        kind: "block",
                        type: "rest",
                },
                {
                        kind: "block",
                        type: "play_notes",
                        inputsInline: true,
                        inputs: {
                                NOTES: {
                                        shadow: {
                                                type: "lists_create_with",
                                                extraState: { itemCount: 1 },
                                                inputs: {
                                                        ADD0: {
                                                                shadow: {
                                                                        type: "midi_note",
                                                                        fields: {
                                                                                NOTE: 60,
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                                DURATIONS: {
                                        shadow: {
                                                type: "lists_create_with",
                                                extraState: { itemCount: 1 },
                                                inputs: {
                                                        ADD0: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                                INSTRUMENT: {
                                        block: {
                                                // Real block initially
                                                type: "instrument",
                                                fields: {
                                                        INSTRUMENT_TYPE:
                                                                "default",
                                                },
                                        },
                                },
                        },
                },
                /*{
                        kind: "block",
                        type: "set_mesh_bpm",
                        inputs: {
                                BPM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 60,
                                                },
                                        },
                                },
                        },
                },*/
                {
                        kind: "block",
                        type: "instrument",
                },
                {
                        kind: "block",
                        type: "create_instrument",
                },
                {
                        kind: "block",
                        type: "speak",
                        keyword: "speak",
                        inputs: {
                                TEXT: {
                                        shadow: {
                                                type: "text",
                                                fields: {
                                                        TEXT: "Hello",
                                                },
                                        },
                                },
                                RATE: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                PITCH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                VOLUME: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxLists = {
        kind: "category",
        name: "%{BKY_CATEGORY_LISTS}",
        icon: "./images/lists.svg",
        //colour: categoryColours["Lists"],
        categorystyle: "variables_category",
        contents: [
                {
                        kind: "block",
                        type: "lists_create_empty",
                        keyword: "list",
                },
                {
                        kind: "block",
                        type: "lists_create_with",
                        inline: true,
                        inputs: {},
                        keyword: "these",
                },
                {
                        kind: "block",
                        type: "lists_repeat",
                        keyword: "item*",
                },
                {
                        kind: "block",
                        type: "lists_length",
                        keyword: "items",
                },
                {
                        kind: "block",
                        type: "lists_isEmpty",
                        keyword: "noitems",
                },
                {
                        kind: "block",
                        type: "lists_indexOf",
                        keyword: "find",
                },
                {
                        kind: "block",
                        type: "lists_getIndex",
                        keyword: "lget",
                },
                {
                        kind: "block",
                        type: "lists_setIndex",
                        keyword: "lset",
                },
                {
                        kind: "block",
                        type: "lists_getSublist",
                        keyword: "sublist",
                },
                {
                        kind: "block",
                        type: "lists_split",
                        keyword: "split",
                },
                {
                        kind: "block",
                        type: "lists_sort",
                        keyword: "sort",
                },
        ],
};

const toolboxVariables = {
        kind: "category",
        name: "%{BKY_CATEGORY_VARIABLES_SUBCATEGORY}",
        icon: "./images/variables.svg",
        categorystyle: "variables_category",
        contents: [],
        custom: "VARIABLE",
};

const toolboxData = {
        kind: "category",
        name: "%{BKY_CATEGORY_VARIABLES}",
        icon: "./images/data.svg",
        categorystyle: "variables_category",
        contents: [toolboxVariables, toolboxLists],
};

const toolboxMath = {
        kind: "category",
        name: "%{BKY_CATEGORY_MATH}",
        icon: "./images/math.svg",
        //colour: categoryColours["Math"],
        categorystyle: "math_category",
        contents: [
                {
                        kind: "block",
                        type: "math_arithmetic",
                        keyword: "math",
                        fields: {
                                OP: "ADD",
                        },
                        inputs: {
                                A: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                B: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "math_random_int",
                        keyword: "randint",
                        inputs: {
                                FROM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                TO: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "random_seeded_int",
                        inputs: {
                                FROM: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                TO: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                SEED: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 123456, // Default seed value
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "math_number",
                        keyword: "num",
                        fields: {
                                NUM: 0,
                        },
                },
                {
                        kind: "block",
                        type: "to_number",
                        keyword: "ton",
                },
                {
                        kind: "block",
                        type: "math_constant",
                        keyword: "pi",
                },
                {
                        kind: "block",
                        type: "math_number_property",
                        keyword: "even",
                },
                {
                        kind: "block",
                        type: "math_round",
                        keyword: "round",
                },
                {
                        kind: "block",
                        type: "math_single",
                        keyword: "abs",
                        fields: {
                                OP: "ABS",
                        },
                },
                {
                        kind: "block",
                        type: "math_trig",
                        keyword: "trig",
                },
                {
                        kind: "block",
                        type: "math_on_list",
                        keyword: "lmath",
                },
                {
                        kind: "block",
                        type: "math_modulo",
                        keyword: "mod",
                },
                {
                        kind: "block",
                        type: "math_constrain",
                        keyword: "constrain",
                        inputs: {
                                LOW: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                HIGH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "math_random_float",
                        keyword: "randf",
                },
        ],
};

const toolboxSnippetsPhysics = {
        kind: "category",
        icon: "./images/physics.svg",
        //colour: categoryColours["Snippets"],
        categorystyle: "snippets_category",
        name: "%{BKY_CATEGORY_PHYSICS}",
        contents: [
                {
                        kind: "block",
                        type: "start",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "create_box",
                                                extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="false"></mutation>',
                                                fields: {
                                                        ID_VAR: {
                                                                name: "box",
                                                        },
                                                },
                                                inputs: {
                                                        COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#6633ff",
                                                                        },
                                                                },
                                                        },
                                                        WIDTH: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        HEIGHT: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        DEPTH: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "add_physics",
                                                                fields: {
                                                                        MODEL_VAR: {
                                                                                name: "box",
                                                                        },
                                                                        PHYSICS_TYPE:
                                                                                "DYNAMIC",
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "when_clicked",
                        extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" inline="false"></mutation>',
                        fields: {
                                MODEL_VAR: {
                                        name: "box",
                                },
                                TRIGGER: "OnPickTrigger",
                        },
                        inputs: {
                                DO: {
                                        block: {
                                                type: "apply_force",
                                                fields: {
                                                        MESH_VAR: {
                                                                name: "box",
                                                        },
                                                },
                                                inputs: {
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 2,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "start",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "create_sphere",
                                                ID_VAR: {
                                                        name: "sphere",
                                                        type: "",
                                                },
                                                inputs: {
                                                        COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#9932cc",
                                                                        },
                                                                },
                                                        },
                                                        DIAMETER_X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        DIAMETER_Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        DIAMETER_Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "add_physics",
                                                                fields: {
                                                                        MODEL_VAR: {
                                                                                name: "sphere",
                                                                                type: "",
                                                                        },
                                                                        PHYSICS_TYPE:
                                                                                "DYNAMIC",
                                                                },
                                                                next: {
                                                                        block: {
                                                                                type: "apply_force",
                                                                                fields: {
                                                                                        MESH_VAR: {
                                                                                                name: "sphere",
                                                                                                type: "",
                                                                                        },
                                                                                },
                                                                                inputs: {
                                                                                        X: {
                                                                                                shadow: {
                                                                                                        type: "math_number",
                                                                                                        fields: {
                                                                                                                NUM: 1,
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                        Y: {
                                                                                                shadow: {
                                                                                                        type: "math_number",
                                                                                                        fields: {
                                                                                                                NUM: 2,
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                        Z: {
                                                                                                shadow: {
                                                                                                        type: "math_number",
                                                                                                        fields: {
                                                                                                                NUM: 1,
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "start",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "load_object",
                                                extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="false"></mutation>',
                                                fields: {
                                                        ID_VAR: {
                                                                name: "star",
                                                                type: "",
                                                        },
                                                        MODELS: "Star.glb",
                                                },
                                                inputs: {
                                                        COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#ffd700",
                                                                        },
                                                                },
                                                        },
                                                        SCALE: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 50,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "add_physics",
                                                                fields: {
                                                                        MODEL_VAR: {
                                                                                name: "star",
                                                                        },
                                                                        PHYSICS_TYPE:
                                                                                "DYNAMIC",
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "start",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "load_object",
                                                extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="true"></mutation>',
                                                fields: {
                                                        ID_VAR: {
                                                                name: "heart",
                                                                type: "",
                                                        },
                                                        MODELS: "Heart.glb",
                                                },
                                                inputs: {
                                                        COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#cc0000",
                                                                        },
                                                                },
                                                        },
                                                        SCALE: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 50,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        DO: {
                                                                block: {
                                                                        type: "rotate_to",
                                                                        fields: {
                                                                                MODEL: {
                                                                                        name: "heart",
                                                                                },
                                                                        },
                                                                        inputs: {
                                                                                X: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 0,
                                                                                                },
                                                                                        },
                                                                                },
                                                                                Y: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 0,
                                                                                                },
                                                                                        },
                                                                                },
                                                                                Z: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: -40,
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "add_physics",
                                                                fields: {
                                                                        MODEL_VAR: {
                                                                                name: "heart",
                                                                        },
                                                                        PHYSICS_TYPE:
                                                                                "DYNAMIC",
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxSnippetsMovement = {
        kind: "category",
        icon: "./images/arrows.svg",
        categorystyle: "snippets_category",
        name: "%{BKY_CATEGORY_MOVEMENT}",
        contents: [
                {
                        kind: "block",
                        type: "forever",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "if_clause",
                                                extraState: {
                                                        mode: "IF",
                                                        stashedCondState: null,
                                                },
                                                fields: {
                                                        MODE: "IF",
                                                },
                                                inputs: {
                                                        COND: {
                                                                block: {
                                                                        type: "action_pressed",
                                                                        fields: {
                                                                                ACTION: "FORWARD",
                                                                        },
                                                                },
                                                        },
                                                        DO: {
                                                                block: {
                                                                        type: "move_forward",
                                                                        fields: {
                                                                                MODEL: {
                                                                                        name: "player",
                                                                                },
                                                                                DIRECTION: "forward",
                                                                        },
                                                                        inputs: {
                                                                                SPEED: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 3,
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                        next: {
                                                                                block: {
                                                                                        type: "switch_animation",
                                                                                        fields: {
                                                                                                MODEL: {
                                                                                                        name: "player",
                                                                                                },
                                                                                        },
                                                                                        inputs: {
                                                                                                ANIMATION_NAME: {
                                                                                                        shadow: {
                                                                                                                type: "animation_name",
                                                                                                                fields: {
                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "if_clause",
                                                                extraState: {
                                                                        mode: "ELSEIF",
                                                                        stashedCondState: null,
                                                                },
                                                                fields: {
                                                                        MODE: "ELSEIF",
                                                                },
                                                                inputs: {
                                                                        COND: {
                                                                                block: {
                                                                                        type: "action_pressed",
                                                                                        fields: {
                                                                                                ACTION: "BACKWARD",
                                                                                        },
                                                                                },
                                                                        },
                                                                        DO: {
                                                                                block: {
                                                                                        type: "move_forward",
                                                                                        fields: {
                                                                                                MODEL: {
                                                                                                        name: "player",
                                                                                                },
                                                                                                DIRECTION: "forward",
                                                                                        },
                                                                                        inputs: {
                                                                                                SPEED: {
                                                                                                        shadow: {
                                                                                                                type: "math_number",
                                                                                                                fields: {
                                                                                                                        NUM: -3,
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                        next: {
                                                                                                block: {
                                                                                                        type: "switch_animation",
                                                                                                        fields: {
                                                                                                                MODEL: {
                                                                                                                        name: "player",
                                                                                                                },
                                                                                                        },
                                                                                                        inputs: {
                                                                                                                ANIMATION_NAME: {
                                                                                                                        shadow: {
                                                                                                                                type: "animation_name",
                                                                                                                                fields: {
                                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                                next: {
                                                                        block: {
                                                                                type: "if_clause",
                                                                                extraState: {
                                                                                        mode: "ELSE",
                                                                                        stashedCondState: null,
                                                                                },
                                                                                fields: {
                                                                                        MODE: "ELSE",
                                                                                },
                                                                                inputs: {
                                                                                        DO: {
                                                                                                block: {
                                                                                                        type: "switch_animation",
                                                                                                        fields: {
                                                                                                                MODEL: {
                                                                                                                        name: "player",
                                                                                                                },
                                                                                                        },
                                                                                                        inputs: {
                                                                                                                ANIMATION_NAME: {
                                                                                                                        shadow: {
                                                                                                                                type: "animation_name",
                                                                                                                                fields: {
                                                                                                                                        ANIMATION_NAME: "Idle",
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "forever",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "if_clause",
                                                extraState: {
                                                        mode: "IF",
                                                        stashedCondState: null,
                                                },
                                                fields: {
                                                        MODE: "IF",
                                                },
                                                inputs: {
                                                        COND: {
                                                                block: {
                                                                        type: "action_pressed",
                                                                        fields: {
                                                                                ACTION: "FORWARD",
                                                                        },
                                                                },
                                                        },
                                                        DO: {
                                                                block: {
                                                                        type: "move_forward",
                                                                        fields: {
                                                                                MODEL: {
                                                                                        name: "player",
                                                                                },
                                                                                DIRECTION: "forward",
                                                                        },
                                                                        inputs: {
                                                                                SPEED: {
                                                                                        shadow: {
                                                                                                type: "math_number",
                                                                                                fields: {
                                                                                                        NUM: 3,
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                        next: {
                                                                                block: {
                                                                                        type: "switch_animation",
                                                                                        fields: {
                                                                                                MODEL: {
                                                                                                        name: "player",
                                                                                                },
                                                                                        },
                                                                                        inputs: {
                                                                                                ANIMATION_NAME: {
                                                                                                        shadow: {
                                                                                                                type: "animation_name",
                                                                                                                fields: {
                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "if_clause",
                                                                extraState: {
                                                                        mode: "ELSEIF",
                                                                        stashedCondState: null,
                                                                },
                                                                fields: {
                                                                        MODE: "ELSEIF",
                                                                },
                                                                inputs: {
                                                                        COND: {
                                                                                block: {
                                                                                        type: "action_pressed",
                                                                                        fields: {
                                                                                                ACTION: "BACKWARD",
                                                                                        },
                                                                                },
                                                                        },
                                                                        DO: {
                                                                                block: {
                                                                                        type: "move_forward",
                                                                                        fields: {
                                                                                                MODEL: {
                                                                                                        name: "player",
                                                                                                },
                                                                                                DIRECTION: "forward",
                                                                                        },
                                                                                        inputs: {
                                                                                                SPEED: {
                                                                                                        shadow: {
                                                                                                                type: "math_number",
                                                                                                                fields: {
                                                                                                                        NUM: -3,
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                        next: {
                                                                                                block: {
                                                                                                        type: "switch_animation",
                                                                                                        fields: {
                                                                                                                MODEL: {
                                                                                                                        name: "player",
                                                                                                                },
                                                                                                        },
                                                                                                        inputs: {
                                                                                                                ANIMATION_NAME: {
                                                                                                                        shadow: {
                                                                                                                                type: "animation_name",
                                                                                                                                fields: {
                                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                                next:  {
                                                                        block: {
                                                                                type: "if_clause",
                                                                                extraState: {
                                                                                        mode: "ELSEIF",
                                                                                        stashedCondState: null,
                                                                                },
                                                                                fields: {
                                                                                        MODE: "ELSEIF",
                                                                                },
                                                                                inputs: {
                                                                                        COND: {
                                                                                                block: {
                                                                                                        type: "action_pressed",
                                                                                                        fields: {
                                                                                                                ACTION: "LEFT",
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                        DO: {
                                                                                                block: {
                                                                                                        type: "move_forward",
                                                                                                        fields: {
                                                                                                                MODEL: {
                                                                                                                        name: "player",
                                                                                                                },
                                                                                                                DIRECTION: "sideways",
                                                                                                        },
                                                                                                        inputs: {
                                                                                                                SPEED: {
                                                                                                                        shadow: {
                                                                                                                                type: "math_number",
                                                                                                                                fields: {
                                                                                                                                        NUM: -3,
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                        next: {
                                                                                                                block: {
                                                                                                                        type: "switch_animation",
                                                                                                                        fields: {
                                                                                                                                MODEL: {
                                                                                                                                        name: "player",
                                                                                                                                },
                                                                                                                        },
                                                                                                                        inputs: {
                                                                                                                                ANIMATION_NAME: {
                                                                                                                                        shadow: {
                                                                                                                                                type: "animation_name",
                                                                                                                                                fields: {
                                                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                                next: {
                                                                                        block: {
                                                                                                type: "if_clause",
                                                                                                extraState: {
                                                                                                        mode: "ELSEIF",
                                                                                                        stashedCondState: null,
                                                                                                },
                                                                                                fields: {
                                                                                                        MODE: "ELSEIF",
                                                                                                },
                                                                                                inputs: {
                                                                                                        COND: {
                                                                                                                block: {
                                                                                                                        type: "action_pressed",
                                                                                                                        fields: {
                                                                                                                                ACTION: "RIGHT",
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                        DO: {
                                                                                                                block: {
                                                                                                                        type: "move_forward",
                                                                                                                        fields: {
                                                                                                                                MODEL: {
                                                                                                                                        name: "player",
                                                                                                                                },
                                                                                                                                DIRECTION: "sideways",
                                                                                                                        },
                                                                                                                        inputs: {
                                                                                                                                SPEED: {
                                                                                                                                        shadow: {
                                                                                                                                                type: "math_number",
                                                                                                                                                fields: {
                                                                                                                                                        NUM: 3,
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                },
                                                                                                                        },
                                                                                                                        next: {
                                                                                                                                block: {
                                                                                                                                        type: "switch_animation",
                                                                                                                                        fields: {
                                                                                                                                                MODEL: {
                                                                                                                                                        name: "player",
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                        inputs: {
                                                                                                                                                ANIMATION_NAME: {
                                                                                                                                                        shadow: {
                                                                                                                                                                type: "animation_name",
                                                                                                                                                                fields: {
                                                                                                                                                                        ANIMATION_NAME: "Walk",
                                                                                                                                                                },
                                                                                                                                                        },
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                                next: {
                                                                                                        block: {
                                                                                                                type: "if_clause",
                                                                                                                extraState: {
                                                                                                                        mode: "ELSE",
                                                                                                                        stashedCondState: null,
                                                                                                                },
                                                                                                                fields: {
                                                                                                                        MODE: "ELSE",
                                                                                                                },
                                                                                                                inputs: {
                                                                                                                        DO: {
                                                                                                                                block: {
                                                                                                                                        type: "switch_animation",
                                                                                                                                        fields: {
                                                                                                                                                MODEL: {
                                                                                                                                                        name: "player",
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                        inputs: {
                                                                                                                                                ANIMATION_NAME: {
                                                                                                                                                        shadow: {
                                                                                                                                                                type: "animation_name",
                                                                                                                                                                fields: {
                                                                                                                                                                        ANIMATION_NAME: "Idle",
                                                                                                                                                                },
                                                                                                                                                        },
                                                                                                                                                },
                                                                                                                                        },
                                                                                                                                },
                                                                                                                        },
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
        ],
};

const toolboxSnippets = {
        kind: "category",
        icon: "./images/snippets.svg",
        //colour: categoryColours["Snippets"],
        categorystyle: "snippets_category",
        name: "%{BKY_CATEGORY_SNIPPETS}",
        contents: [
                {
                        type: "start",
                        kind: "block",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "set_sky_color",
                                                inputs: {
                                                        COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#6495ed",
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        /*block: {
                                        type: "create_ground",
                                        inputs: {
                                          COLOR: {
                                                shadow: {
                                                  type: "colour",
                                                  fields: {
                                                        COLOR: "#71bc78"
                                                  }
                                                }
                                          }
                                        }
                                  }*/
                                                        block: {
                                                                type: "create_map",
                                                                fields: {
                                                                        MAP_NAME: "NONE",
                                                                },
                                                                inputs: {
                                                                        MATERIAL: {
                                                                                shadow: {
                                                                                        type: "material",

                                                                                        fields: {
                                                                                                TEXTURE_SET:
                                                                                                        "none.png",
                                                                                        },
                                                                                        inputs: {
                                                                                                BASE_COLOR: {
                                                                                                        shadow: {
                                                                                                                type: "colour",

                                                                                                                fields: {
                                                                                                                        COLOR: "#71bc78",
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                                ALPHA: {
                                                                                                        shadow: {
                                                                                                                type: "math_number",

                                                                                                                fields: {
                                                                                                                        NUM: 1,
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "start",
                        inputs: {
                                DO: {
                                        block: {
                                                type: "load_character",
                                                fields: {
                                                        MODELS: "Block3.glb",
                                                        ID_VAR: {
                                                                name: "player",
                                                                type: "",
                                                        },
                                                },
                                                inputs: {
                                                        SCALE: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 1,
                                                                        },
                                                                },
                                                        },
                                                        X: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Y: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        Z: {
                                                                shadow: {
                                                                        type: "math_number",
                                                                        fields: {
                                                                                NUM: 0,
                                                                        },
                                                                },
                                                        },
                                                        HAIR_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#000000",
                                                                        },
                                                                },
                                                        },
                                                        SKIN_COLOR: {
                                                                shadow: {
                                                                        type: "skin_colour",
                                                                        fields: {
                                                                                COLOR: "#a15c33",
                                                                        },
                                                                },
                                                        },
                                                        EYES_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#000000",
                                                                        },
                                                                },
                                                        },
                                                        SLEEVES_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#008b8b",
                                                                        },
                                                                },
                                                        },
                                                        SHORTS_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#00008b",
                                                                        },
                                                                },
                                                        },
                                                        TSHIRT_COLOR: {
                                                                shadow: {
                                                                        type: "colour",
                                                                        fields: {
                                                                                COLOR: "#ff8f60",
                                                                        },
                                                                },
                                                        },
                                                },
                                                next: {
                                                        block: {
                                                                type: "add_physics",
                                                                fields: {
                                                                        MODEL_VAR: {
                                                                                name: "player",
                                                                                type: "",
                                                                        },
                                                                        PHYSICS_TYPE:
                                                                                "DYNAMIC",
                                                                },
                                                                next: {
                                                                        block: {
                                                                                type: "camera_follow",
                                                                                fields: {
                                                                                        MESH_VAR: {
                                                                                                name: "player",
                                                                                                type: "",
                                                                                        },
                                                                                },
                                                                                inputs: {
                                                                                        RADIUS: {
                                                                                                block: {
                                                                                                        type: "math_number",
                                                                                                        fields: {
                                                                                                                NUM: 7,
                                                                                                        },
                                                                                                },
                                                                                        },
                                                                                },
                                                                        },
                                                                },
                                                        },
                                                },
                                        },
                                },
                        },
                },
                toolboxSnippetsMovement,
                toolboxSnippetsPhysics,
        ],
};

const toolboxFunctions = {
        kind: "category",
        name: "%{BKY_CATEGORY_FUNCTIONS}",
        icon: "./images/functions.svg",
        custom: "PROCEDURE",
        categorystyle: "procedures_category",
};

export const toolbox = {
        kind: "categoryToolbox",
        contents: [
                toolboxSearch,
                toolboxScene,
                toolboxEvents,
                toolboxTransform,
                toolboxAnimate,
                toolboxControl,
                toolboxCondition,
                toolboxSensing,
                toolboxText,
                toolboxMaterials,
                toolboxSound,
                toolboxData,
                toolboxMath,
                toolboxFunctions,
                toolboxSnippets,
        ],
};

class IconCategory extends Blockly.ToolboxCategory {
        constructor(categoryDef, toolbox, opt_parent) {
                super(categoryDef, toolbox, opt_parent);
        }

        addColourBorder_() {
                // Do nothing to prevent the colored block from being added
        }

        /** @override */
        createIconDom_() {
                const img = document.createElement("img");
                img.src = this.toolboxItemDef_.icon || "./default_icon.svg"; // Use a default icon if none provided
                img.alt = this.toolboxItemDef_.name + " icon";
                img.width = "24"; // Adjust as needed
                img.height = "24"; // Adjust as needed
                img.classList.add("customToolboxIcon");
                return img;
        }

        /** @override */
        createDom_() {
                super.createDom_();

                // Use the stored colour_ property for the tab colour
                const tabColour = this.colour_;

                // Apply custom class to the rowDiv_
                this.rowDiv_.classList.add("custom-category");

                // Set the background color of the category to match the tab colour
                if (tabColour) {
                        this.rowDiv_.style.setProperty(
                                "background-color",
                                tabColour,
                                "important",
                        );
                }

                return this.htmlDiv_;
        }

        /** @override */
        setSelected(isSelected) {
                super.setSelected(isSelected);

                // Get the category color
                const categoryColour = this.colour_;

                // Change background color when selected/deselected
                if (isSelected) {
                } else {
                        this.rowDiv_.style.setProperty(
                                "background-color",
                                categoryColour,
                                "important",
                        );
                }
        }
}

// Register the custom category
Blockly.registry.register(
        Blockly.registry.Type.TOOLBOX_ITEM,
        Blockly.ToolboxCategory.registrationName,
        IconCategory,
        true,
);

class CustomCollapsibleToolboxCategory extends Blockly.CollapsibleToolboxCategory {
        constructor(categoryDef, toolbox, opt_parent) {
                super(categoryDef, toolbox, opt_parent);
                // Store the original icon and color
                this.originalIcon = categoryDef.icon || "./default_icon.svg";
                this.originalColor = categoryDef.colour || "#000000";
                this.preventNextPointerClickToggle_ = false;
        }

        toolboxHasFocus_() {
                const toolboxDiv =
                        this.parentToolbox_?.HtmlDiv ||
                        this.parentToolbox_?.getHtmlDiv?.();
                const active = document.activeElement;
                if (
                        toolboxDiv &&
                        active &&
                        (active === toolboxDiv || toolboxDiv.contains(active))
                ) {
                        return true;
                }

                const focusedTree = Blockly.getFocusManager?.()?.getFocusedTree?.();
                return focusedTree === this.parentToolbox_;
        }

        categoryHasFocus_() {
                const active = document.activeElement;
                if (this.htmlDiv_ && active && this.htmlDiv_.contains(active)) {
                        return true;
                }

                const selectedItem = this.parentToolbox_?.getSelectedItem?.();
                return this.toolboxHasFocus_() && selectedItem === this;
        }

        ensurePointerFocusedSelection_() {
                this.parentToolbox_?.setSelectedItem?.(this);
                this.setSelected(true);
                this.setExpanded(true);

                const flyout = this.parentToolbox_?.getFlyout?.();
                if (flyout && !flyout.isVisible?.()) {
                        const contents = this.getContents?.();
                        if (contents) flyout.show?.(contents);
                }

                this.parentToolbox_?.getHtmlDiv?.()?.focus?.();
                this.htmlDiv_?.focus?.();
        }

        // Preserve the original icon
        createIconDom_() {
                const img = document.createElement("img");
                img.src = this.originalIcon;
                img.alt = this.toolboxItemDef_.name + " icon";
                img.width = "24";
                img.height = "24";
                img.classList.add("customToolboxIcon");
                return img;
        }

        setSelected(isSelected) {
                super.setSelected(isSelected);

                // Get the category color
                const categoryColour = this.colour_;

                // Change background color when selected/deselected
                if (isSelected) {
                } else {
                        this.rowDiv_.style.setProperty(
                                "background-color",
                                categoryColour,
                                "important",
                        );
                }
        }

        /** @override */
        createDom_() {
                super.createDom_();

                // Use the stored colour_ property for the tab colour
                const tabColour = this.colour_;

                // Apply custom class to the rowDiv_
                this.rowDiv_.classList.add("custom-category");

                // Set the background color of the category to match the tab colour
                if (tabColour) {
                        this.rowDiv_.style.setProperty(
                                "background-color",
                                tabColour,
                                "important",
                        );
                }

                this.rowDiv_.addEventListener(
                        "pointerdown",
                        (e) => {
                                this.preventNextPointerClickToggle_ =
                                        !this.categoryHasFocus_();

                                if (!this.preventNextPointerClickToggle_) return;

                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();

                                this.ensurePointerFocusedSelection_();
                        },
                        { capture: true },
                );

                this.rowDiv_.addEventListener(
                        "click",
                        (e) => {
                                if (!this.preventNextPointerClickToggle_) return;

                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();

                                this.ensurePointerFocusedSelection_();

                                this.preventNextPointerClickToggle_ = false;
                        },
                        { capture: true },
                );

                return this.htmlDiv_;
        }
}

// Register the custom collapsible category
Blockly.registry.register(
        Blockly.registry.Type.TOOLBOX_ITEM,
        Blockly.CollapsibleToolboxCategory.registrationName,
        CustomCollapsibleToolboxCategory,
        true,
);
