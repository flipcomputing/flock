import * as Blockly from 'blockly';
import '@blockly/toolbox-search';
import { buildColorsListShadowSpec } from './ui/blocklyshadowutil.js';

export const categoryColours = {
  Events: 5,
  Scene: 85,
  Transform: 65,
  Animate: 45,
  Materials: 280,
  Sound: 25,
  Sensing: 180,
  Snippets: 200,
  Control: '%{BKY_LOOPS_HUE}',
  Logic: '%{BKY_LOGIC_HUE}',
  Variables: '%{BKY_VARIABLES_HUE}',
  Text: '%{BKY_TEXTS_HUE}',
  Lists: '%{BKY_LISTS_HUE}',
  Math: '%{BKY_MATH_HUE}',
  Procedures: '%{BKY_PROCEDURES_HUE}',
};

function vectorBlockSpec(x, y, z) {
  const num = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });
  return { type: 'vector', inputs: { X: num(x), Y: num(y), Z: num(z) } };
}

const toolboxSearch = {
  kind: 'search',
  name: 'Search',
  contents: [],
};

const toolboxSceneMeshes = {
  kind: 'category',
  name: '%{BKY_CATEGORY_MESHES}',
  icon: './images/meshes.svg',
  //colour: categoryColours["Scene"],
  categorystyle: 'scene_category',
  contents: [
    {
      kind: 'block',
      type: 'load_model',
      keyword: 'model',
      inputs: {
        SCALE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        COLORS: {
          shadow: buildColorsListShadowSpec('Flock.glb'),
        },
      },
    },
    {
      kind: 'block',
      type: 'load_character',
      keyword: 'character',
      inputs: {
        SCALE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        HAIR_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000000',
            },
          },
        },
        SKIN_COLOR: {
          shadow: {
            type: 'skin_colour',
            fields: {
              COLOR: 'A15C33',
            },
          },
        },
        EYES_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000000',
            },
          },
        },
        SLEEVES_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#008B8B',
            },
          },
        },
        SHORTS_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '00008B',
            },
          },
        },
        TSHIRT_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FF8F60',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'load_object',
      keyword: 'object',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour', // Correct type for color field
            fields: {
              COLOR: '#FFD700', // Gold
            },
          },
        },
        SCALE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'load_multi_object',
      keyword: 'multi',
      inputs: {
        SCALE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        COLORS: {
          shadow: {
            type: 'lists_create_with',
            extraState: { itemCount: 2 },
            inline: true,
            inputs: {
              ADD0: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#66CDAA',
                  },
                },
              },
              ADD1: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#CD853F',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_box',
      keyword: 'box',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#6666cc',
            },
          },
        },
        WIDTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DEPTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_sphere',
      keyword: 'sphere',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ff6666',
            },
          },
        },
        DIAMETER_X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DIAMETER_Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DIAMETER_Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_cylinder',
      keyword: 'cylinder',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffcc00',
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DIAMETER_TOP: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DIAMETER_BOTTOM: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        TESSELLATIONS: {
          // Add the tessellations input
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 24, // Default tessellation value
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_capsule',
      keyword: 'capsule',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#339999',
            },
          },
        },
        DIAMETER: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_wedge',
      keyword: 'wedge',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#996633',
            },
          },
        },
        WIDTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DEPTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        PEAK: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_donut',
      keyword: 'donut',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ff99cc',
            },
          },
        },
        DIAMETER: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1.5,
            },
          },
        },
        INNER_DIAMETER: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        THICKNESS: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        SIDES: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 24,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_ring',
      keyword: 'ring',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#66ccff',
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        DIAMETER: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        INNER_DIAMETER: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1.5,
            },
          },
        },
        THICKNESS: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.25,
            },
          },
        },
        SIDES: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 24,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_plane',
      keyword: 'plane',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#cc33cc',
            },
          },
        },
        WIDTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_freeform',
      keyword: 'freeform',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#66cc99',
            },
          },
        },
        VERTICES: {
          block: {
            type: 'lists_create_with',
            extraState: { itemCount: 8 },
            inline: false,
            inputs: Object.fromEntries(
              [
                [-0.5, -0.5, -0.5],
                [0.5, -0.5, -0.5],
                [0.5, -0.5, 0.5],
                [-0.5, -0.5, 0.5],
                [-0.5, 0.5, -0.5],
                [0.5, 0.5, -0.5],
                [0.5, 0.5, 0.5],
                [-0.5, 0.5, 0.5],
              ].map((point, i) => [`ADD${i}`, { block: vectorBlockSpec(...point) }])
            ),
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'clone_mesh',
      keyword: 'clone',
    },
  ],
};

const toolboxSceneXR = {
  kind: 'category',
  name: '%{BKY_CATEGORY_XR}',
  icon: './images/xr.svg',
  //colour: categoryColours["Scene"],
  categorystyle: 'scene_category',
  contents: [
    {
      kind: 'block',
      type: 'device_camera_background',
      keyword: 'devcam',
    },
    {
      kind: 'block',
      type: 'set_xr_mode',
      keyword: 'xr',
    },
    {
      kind: 'block',
      type: 'set_xr_view_mode',
      keyword: 'vrview',
    },
    {
      kind: 'block',
      type: 'set_ar_scene_size',
      keyword: 'diorama',
      inputs: {
        SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 80,
            },
          },
        },
        DISTANCE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 30,
            },
          },
        },
        HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_vr_comfort',
      keyword: 'comfort',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000000',
            },
          },
        },
        ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        REST_FRAME_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ccd9ff',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_xr_ui_placement',
      keyword: 'vrui',
    },
    {
      kind: 'block',
      type: 'add_teleport_target',
      keyword: 'teleport',
    },
    {
      kind: 'block',
      type: 'remove_teleport_target',
      keyword: 'unteleport',
    },
    {
      kind: 'block',
      type: 'export_mesh',
      keyword: 'export',
    },
    {
      kind: 'block',
      type: 'add_microbit',
      keyword: 'microbit',
      inputs: {
        CHANNEL: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'microbit_show_image',
      keyword: 'leds',
    },
    {
      kind: 'block',
      type: 'microbit_scroll_text',
      keyword: 'scroll',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Hello',
            },
          },
        },
      },
    },
    /*{
                        kind: "block",
                        type: "play_rumble_pattern",
                        keyword: "rumble preset",
                },
                {
                        kind: "block",
                        type: "controller_rumble",
                        keyword: "rumble",
                        inputs: {
                                STRENGTH: {
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
                                                        NUM: 500,
                                                },
                                        },
                                },
                        },
                },
                {
                        kind: "block",
                        type: "controller_rumble_pattern",
                        keyword: "rumble pattern",
                        inputs: {
                                STRENGTH: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 1,
                                                },
                                        },
                                },
                                ON_DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 200,
                                                },
                                        },
                                },
                                OFF_DURATION: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 100,
                                                },
                                        },
                                },
                                REPEATS: {
                                        shadow: {
                                                type: "math_number",
                                                fields: {
                                                        NUM: 3,
                                                },
                                        },
                                },
                        },
                },*/
  ],
};

const toolboxSceneLights = {
  kind: 'category',
  name: '%{BKY_CATEGORY_EFFECTS}',
  icon: './images/lights.svg',
  //colour: categoryColours["Scene"],
  categorystyle: 'scene_category',
  contents: [
    {
      kind: 'block',
      type: 'main_light',
      keyword: 'intensity',
      inputs: {
        INTENSITY: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DIFFUSE: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FFFFFF',
            },
          },
        },
        GROUND_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#808080',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'get_light',
      keyword: 'light',
    },
    {
      kind: 'block',
      type: 'enable_shadows',
      keyword: 'shadows',
    },
    {
      kind: 'block',
      type: 'set_shadow',
      keyword: 'shadow',
    },
    {
      kind: 'block',
      type: 'create_particle_effect',
      keyword: 'particle',
      inputs: {
        RATE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 20,
            },
          },
        },
        MIN_SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.1,
            },
          },
        },
        MAX_SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        START_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FFFFFF',
            },
          },
        },
        END_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#00ffff',
            },
          },
        },
        START_ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        END_ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },

        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        MIN_LIFETIME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        MAX_LIFETIME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 3,
            },
          },
        },
        MIN_ANGULAR_SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        MAX_ANGULAR_SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        MIN_INITIAL_ROTATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        MAX_INITIAL_ROTATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'control_particle_system',
      keyword: 'cps',
      inputsInline: true,
    },
    {
      kind: 'block',
      type: 'set_fog',
      keyword: 'fog',
      inputs: {
        FOG_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffffff',
            },
          },
        },
        DENSITY: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.1,
            },
          },
        },
        START: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        END: {
          shadow: {
            type: 'math_number',
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
  kind: 'category',
  name: '%{BKY_CATEGORY_CAMERA}',
  icon: './images/camera.svg',
  //colour: categoryColours["Scene"],
  categorystyle: 'scene_category',
  contents: [
    {
      kind: 'block',
      type: 'switch_camera',
      keyword: 'switchcam',
    },
    {
      kind: 'block',
      type: 'get_camera',
      keyword: 'cam',
    },
    {
      kind: 'block',
      type: 'camera_follow',
      keyword: 'camfollow',
      inputs: {
        RADIUS: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 7,
            },
          },
        },
        ANGLE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 90,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'camera_control',
      keyword: 'cc',
    },
    {
      kind: 'block',
      type: 'create_fly_camera',
      keyword: 'flycam',
      inputs: {
        X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        Y: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
        Z: { shadow: { type: 'math_number', fields: { NUM: -8 } } },
      },
    },
    {
      kind: 'block',
      type: 'create_follow_camera',
      keyword: 'followcam',
      inputs: {
        DISTANCE: { shadow: { type: 'math_number', fields: { NUM: 7 } } },
        UP: { shadow: { type: 'math_number', fields: { NUM: 30 } } },
        AROUND: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      },
    },
    {
      kind: 'block',
      type: 'create_orbit_camera',
      keyword: 'orbitcam',
      inputs: {
        DISTANCE: { shadow: { type: 'math_number', fields: { NUM: 7 } } },
        UP: { shadow: { type: 'math_number', fields: { NUM: 30 } } },
        AROUND: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      },
    },
  ],
};

const toolboxScene = {
  kind: 'category',
  name: '%{BKY_CATEGORY_SCENE}',
  icon: './images/scene.svg',
  //colour: categoryColours["Scene"],
  categorystyle: 'scene_category',
  contents: [
    {
      kind: 'block',
      type: 'set_sky_color',
      keyword: 'sky',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#6495ED',
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
      kind: 'block',
      type: 'create_map',
      keyword: 'map',
      inputs: {
        MATERIAL: {
          shadow: {
            type: 'material',
            inputs: {
              BASE_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#71BC78',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_background_color',
      keyword: 'background',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#6495ED',
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
      kind: 'block',
      type: 'show',
      keyword: 'show',
    },
    {
      kind: 'block',
      type: 'hide',
      keyword: 'hide',
    },
    {
      kind: 'block',
      type: 'dispose',
      keyword: 'dispose',
    },
    toolboxSceneMeshes,
    toolboxSceneLights,
    toolboxSceneCamera,
    toolboxSceneXR,
  ],
};

const toolboxEvents = {
  kind: 'category',
  name: '%{BKY_CATEGORY_EVENTS}',
  icon: './images/events.svg',
  //colour: categoryColours["Events"],
  categorystyle: 'events_category',
  contents: [
    {
      kind: 'block',
      type: 'start',
      keyword: 'start',
    },
    {
      kind: 'block',
      type: 'forever',
      keyword: 'ever',
    },
    {
      kind: 'block',
      type: 'when_clicked',
      keyword: 'click',
    },
    {
      kind: 'block',
      type: 'on_collision',
      keyword: 'collision',
    },
    /*{
                        kind: "block",
                        type: "when_key_event",
                        keyword: "press",
                },*/
    {
      kind: 'block',
      type: 'when_action_event',
      keyword: 'whenpressed',
    },
    {
      kind: 'block',
      type: 'broadcast_event',
      keyword: 'broadcast',
      inputs: {
        EVENT_NAME: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'go',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'on_event',
      keyword: 'on',
      inputs: {
        EVENT_NAME: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'go',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'restart',
      keyword: 'restart',
    },
  ],
};

const toolboxTransformPhysics = {
  kind: 'category',
  name: '%{BKY_CATEGORY_PHYSICS}',
  icon: './images/physics.svg',
  //colour: categoryColours["Transform"],
  categorystyle: 'transform_category',
  contents: [
    {
      kind: 'block',
      type: 'add_physics',
      keyword: 'physics',
    },
    {
      kind: 'block',
      type: 'add_physics_shape',
      keyword: 'collider',
    },
    {
      kind: 'block',
      type: 'apply_force',
      keyword: 'push',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'jump',
      keyword: 'jump',
      inputs: {
        JUMP_HEIGHT: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1.5,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_speed',
      keyword: 'speed',
      inputs: {
        SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 5,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_bounciness',
      keyword: 'bouncy',
      inputs: {
        BOUNCINESS: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.7,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'show_physics',
      keyword: 'colliders',
    },
    {
      kind: 'block',
      type: 'move_forward',
      keyword: 'forward',
      inputs: {
        SPEED: {
          shadow: {
            type: 'math_number',
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
  kind: 'category',
  name: '%{BKY_CATEGORY_CONNECT}',
  icon: './images/connect.svg',
  //colour: categoryColours["Transform"],
  categorystyle: 'transform_category',
  contents: [
    {
      kind: 'block',
      type: 'create_group',
      keyword: 'group',
    },
    {
      kind: 'block',
      type: 'parent_children',
      keyword: 'parent',
      inputs: {
        MESH_LIST: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'object',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'parent_child',
      keyword: 'parch',
      inputs: {
        X_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'remove_parent',
      keyword: 'noparent',
    },
    {
      kind: 'block',
      type: 'follow',
      keyword: 'follow',
      inputs: {
        X_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'stop_follow',
      keyword: 'fstop',
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
      kind: 'block',
      type: 'attach',
      keyword: 'hold',
      inputs: {
        X_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z_OFFSET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'drop',
      keyword: 'drop',
    },
  ],
};

const toolboxTransformModify = {
  kind: 'category',
  name: '%{BKY_CATEGORY_MODIFY}',
  icon: './images/combine.svg',
  //colour: categoryColours["Transform"],
  categorystyle: 'transform_category',
  contents: [
    {
      kind: 'block',
      type: 'merge_meshes',
      keyword: 'merge',
      inputsInline: true,
      inputs: {
        MESH_LIST: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'mesh1', // Default variable for a mesh
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'subtract_meshes',
      keyword: 'subtract',
      inputsInline: true,
      inputs: {
        MESH_LIST: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'object2', // Default variable for a mesh to subtract
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'intersection_meshes',
      keyword: 'intersect',
      inputsInline: true,
      inputs: {
        MESH_LIST: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'mesh1', // Default variable for a mesh
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'hull_meshes',
      keyword: 'hull',
      inputsInline: true,
      inputs: {
        MESH_LIST: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'mesh1', // Default variable for a mesh
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'flip',
      keyword: 'flip',
    },
    {
      kind: 'block',
      type: 'mirror_mesh',
      keyword: 'mirror',
    },
  ],
};

const toolboxTransform = {
  kind: 'category',
  name: '%{BKY_CATEGORY_TRANSFORM}',
  icon: './images/motion.svg',
  //colour: categoryColours["Transform"],
  categorystyle: 'transform_category',
  contents: [
    {
      kind: 'block',
      type: 'move_by_xyz',
      keyword: 'movexyz',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'move_by_xyz_single',
      keyword: 'move',
      inputs: {
        VALUE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'move_to_xyz',
      keyword: 'posxyz',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'move_to_xyz_single',
      keyword: 'pos',
      inputs: {
        VALUE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'move_to',
      keyword: 'goto',
    },
    {
      kind: 'block',
      type: 'rotate_model_xyz',
      keyword: 'rotatexyz',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 45,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'rotate_to',
      keyword: 'rxyz',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'look_at',
      keyword: 'look',
    },
    {
      kind: 'block',
      type: 'scale',
      keyword: 'scale',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'resize',
      keyword: 'resize',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
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
      kind: 'block',
      type: 'set_pivot',
      keyword: 'pivot',
      inputs: {
        X_PIVOT: {
          shadow: {
            type: 'min_centre_max',
            fields: {
              PIVOT_OPTION: 'CENTER',
            },
          },
        },
        Y_PIVOT: {
          shadow: {
            type: 'min_centre_max',
            fields: {
              PIVOT_OPTION: 'CENTER',
            },
          },
        },
        Z_PIVOT: {
          shadow: {
            type: 'min_centre_max',
            fields: {
              PIVOT_OPTION: 'CENTER',
            },
          },
        },
      },
    },
    toolboxTransformPhysics,
    toolboxTransformConnect,
    toolboxTransformModify,
  ],
};

const toolboxAnimateKeyframe = {
  kind: 'category',
  name: '%{BKY_CATEGORY_KEYFRAME}',
  icon: './images/keyframe.svg',
  //colour: categoryColours["Animate"],
  categorystyle: 'animate_category',
  contents: [
    {
      kind: 'block',
      type: 'animation',
      keyword: 'animation',
      inputsInline: true, // Set lists to be inline
      inputs: {
        KEYFRAMES: {
          block: {
            type: 'lists_create_with',
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'colour_keyframe', // Reusing your `colour_keyframe` block
                  inputs: {
                    VALUE: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#ff0000', // Default colour: Red
                        },
                      },
                    },
                    DURATION: {
                      shadow: {
                        type: 'math_number',
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
      kind: 'block',
      type: 'control_animation_group',
      keyword: 'group',
      inputsInline: true,
    },
    {
      kind: 'block',
      type: 'animate_from',
      keyword: 'animfrom',
      inputs: {
        TIME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1.0, // Default time in seconds
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'colour_keyframe',
      keyword: 'colkey',
      inputs: {
        VALUE: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000080',
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 5,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'number_keyframe',
      keyword: 'numkey',
      inputs: {
        VALUE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'xyz_keyframe',
      keyword: 'xyzkey',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
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
  kind: 'category',
  name: '%{BKY_CATEGORY_ANIMATE}',
  icon: './images/animate.svg',
  //colour: categoryColours["Animate"],
  categorystyle: 'animate_category',
  contents: [
    {
      kind: 'block',
      type: 'switch_animation',
      keyword: 'switch',
      inputs: {
        ANIMATION_NAME: {
          shadow: {
            type: 'animation_name',
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'play_animation',
      keyword: 'play',
      inputs: {
        ANIMATION_NAME: {
          shadow: {
            type: 'animation_name',
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'animation_name',
      keyword: 'clip',
    },
    {
      kind: 'block',
      type: 'glide_to_seconds',
      keyword: 'glide',
      inputs: {
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'glide_to_object',
      keyword: 'glideto',
      inputs: {
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'glide_to_axis',
      keyword: 'glideaxis',
      inputs: {
        TARGET: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'rotate_anim_seconds',
      keyword: 'spin',
      inputs: {
        ROT_X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0, // Default rotation for X-axis
            },
          },
        },
        ROT_Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0, // Default rotation for Y-axis
            },
          },
        },
        ROT_Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0, // Default rotation for Z-axis
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'rotate_to_object',
      keyword: 'rotateto',
      inputs: {
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'stop_animations',
      keyword: 'anistop',
    },
    toolboxAnimateKeyframe,
  ],
};

const toolboxControl = {
  kind: 'category',
  name: '%{BKY_CATEGORY_CONTROL}',
  icon: './images/control.svg',
  //colour: categoryColours["Control"],
  categorystyle: 'control_category',
  contents: [
    {
      kind: 'block',
      type: 'wait_seconds',
      keyword: 'waits',
      inputs: {
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'wait_until',
      keyword: 'until',
    },
    {
      kind: 'block',
      type: 'controls_repeat_ext',
      keyword: 'repeat',
      inputs: {
        TIMES: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 10,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'controls_whileUntil',
      keyword: 'while',
    },
    {
      kind: 'block',
      type: 'controls_for',
      keyword: 'for',
      inputs: {
        FROM: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        TO: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 9,
            },
          },
        },
        BY: {
          shadow: {
            type: 'math_number',
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
      kind: 'block',
      type: 'controls_forEach',
      keyword: 'each',
    },
    {
      kind: 'block',
      type: 'controls_flow_statements',
      keyword: 'break',
    },
    {
      kind: 'block',
      type: 'tag_object',
      keyword: 'tag',
      inputsInline: true,
      inputs: {
        OBJECTS: {
          block: {
            type: 'lists_create_with',
            inline: true,
            extraState: {
              itemCount: 1,
            },
            inputs: {
              ADD0: {
                block: {
                  type: 'variables_get',
                  fields: {
                    VAR: 'mesh1',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'wait',
      keyword: 'wait',
      inputs: {
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1000,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'section',
      keyword: 'section',
    },
    {
      kind: 'block',
      type: 'section_control',
      keyword: 'load section',
    },
  ],
};

const toolboxCondition = {
  kind: 'category',
  name: '%{BKY_CATEGORY_CONDITION}',
  icon: './images/conditions.svg',
  //colour: categoryColours["Logic"],
  categorystyle: 'logic_category',
  contents: [
    // {
    //         kind: "block",
    //         type: "controls_if",
    //         keyword: "if",
    // },
    {
      kind: 'block',
      type: 'if_clause',
      keyword: 'if',
    },
    {
      kind: 'block',
      type: 'logic_compare',
      keyword: 'compare',
      inputs: {
        B: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: '0',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'logic_operation',
      keyword: 'op',
    },
    {
      kind: 'block',
      type: 'logic_negate',
      keyword: 'not',
    },
    {
      kind: 'block',
      type: 'logic_boolean',
      keyword: 'bool',
    },
    {
      kind: 'block',
      type: 'logic_null',
      keyword: 'null',
    },
    {
      kind: 'block',
      type: 'logic_ternary',
      keyword: 'ternary',
    },
  ],
};

const toolboxSensing = {
  kind: 'category',
  name: '%{BKY_CATEGORY_SENSING}',
  icon: './images/sensing.svg',
  //colour: categoryColours["Sensing"],
  categorystyle: 'sensing_category',
  contents: [
    /*{
                        kind: "block",
                        type: "key_pressed",
                        keyword: "ispressed",
                },*/
    {
      kind: 'block',
      type: 'action_pressed',
      keyword: 'pressed',
    },
    {
      kind: 'block',
      type: 'set_action_key',
      keyword: 'setactionkey',
    },
    {
      kind: 'block',
      type: 'mesh_exists',
      keyword: 'exists',
    },
    {
      kind: 'block',
      type: 'touching_surface',
      keyword: 'surface',
    },
    {
      kind: 'block',
      type: 'meshes_touching',
      keyword: 'istouching',
    },
    {
      kind: 'block',
      type: 'get_property',
      keyword: 'get',
    },
    {
      kind: 'block',
      type: 'distance_to',
      keyword: 'dist',
    },
    {
      kind: 'block',
      type: 'ground_level',
      keyword: 'ground',
    },
    {
      kind: 'block',
      type: 'time',
      keyword: 'time',
    },
    {
      kind: 'block',
      type: 'canvas_controls',
      keyword: 'canvas',
    },
    {
      kind: 'block',
      type: 'interact_indicator',
      keyword: 'indicator',
    },
    {
      kind: 'block',
      type: 'on_screen_controls',
      keyword: 'onscreen',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FFFFFF',
            },
          },
        },
        BACKGROUND: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000000',
            },
          },
        },
        ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      // Keyword lookup is exact-match, first-wins, so this must not reuse
      // add_microbit's "microbit".
      kind: 'block',
      type: 'microbit_input',
      keyword: 'microbitinput',
    },
  ],
};

const toolboxText = {
  kind: 'category',
  name: '%{BKY_CATEGORY_TEXT}',
  icon: './images/text.svg',
  //colour: categoryColours["Text"],
  categorystyle: 'text_category',
  contents: [
    {
      kind: 'block',
      type: 'say',
      keyword: 'say',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Hello',
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 3,
            },
          },
        },
        ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 20,
            },
          },
        },
        TEXT_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000000',
            },
          },
        },
        BACKGROUND_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffffff',
            },
          },
        },
      },
      fields: {
        MODE: 'ADD',
      },
    },
    {
      kind: 'block',
      type: 'comment',
      keyword: '//',
      inputs: {
        COMMENT: {
          shadow: {
            type: 'text_multiline',
            fields: {
              TEXT: 'comment',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'print_text',
      keyword: 'print',
      inputs: {
        TEXT: {
             shadow: {
            type: 'text_join',
            extraState: { itemCount: 1 },
            inline: true,
            inputs: {
              ADD0: {
                shadow: {
                  type: 'text',
                  fields: {
                    TEXT: 'Hello 🌈',
                  },
                },
              },
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 30,
            },
          },
        },
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000080',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'subtitle',
      keyword: 'subtitle',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Hello',
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'ui_text',
      keyword: 'uitext',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Info',
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000080',
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        FONT_SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 24,
            },
          },
        },
        BACKGROUND_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffffff',
            },
          },
        },
        ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'ui_button',
      keyword: 'uibutton',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Click Me',
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        TEXT_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FFFFFF', // Using "COLOR" to match your example
            },
          },
        },
        BACKGROUND_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#007ACC', // Using "COLOR" to match your example
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'ui_input',
      keyword: 'uiinput',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: "What's your name?",
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        TEXT_SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 24,
            },
          },
        },
        TEXT_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffffff',
            },
          },
        },
        BACKGROUND_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000080',
            },
          },
        },
      },
      fields: {
        SIZE: 'MEDIUM',
      },
    },
    {
      kind: 'block',
      type: 'ui_slider',
      keyword: 'uislider',
      inputs: {
        MIN: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        MAX: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        VALUE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 50,
            },
          },
        },
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#ffffff',
            },
          },
        },
        BACKGROUND: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#000080',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'text',
      keyword: 'text',
    },
    {
      kind: 'block',
      type: 'describe',
      keyword: 'describe',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'My Object',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'create_3d_text',
      keyword: 'text3d',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Hello World',
            },
          },
        },
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#511d91',
            },
          },
          block: {
            type: 'lists_create_with',
            extraState: { itemCount: 1 },
            inline: true,
            inputs: {
              ADD0: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#511d91',
                  },
                },
              },
            },
          },
        },
        SIZE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        DEPTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.3,
            },
          },
        },
        SPACING: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        X: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Y: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
        Z: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    {
      kind: 'category',
      name: '%{BKY_CATEGORY_STRINGS}',
      icon: './images/text.svg',
      //colour: categoryColours["Text"],
      categorystyle: 'text_category',
      contents: [
        {
          kind: 'block',
          type: 'text_join',
          keyword: 'jointext',
          extraState: { itemCount: 2 },
          inline: true,
          inputs: {
            ADD0: { shadow: { type: 'text' } },
            ADD1: { shadow: { type: 'text' } },
          },
        },
        {
          kind: 'block',
          type: 'text_append',
          keyword: 'join',
          inputs: {
            TEXT: {
              shadow: {
                type: 'text',
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_length',
          keyword: 'length',
          inputs: {
            VALUE: {
              shadow: {
                type: 'text',
                fields: {
                  TEXT: 'abc',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_isEmpty',
          keyword: 'isempty',
          inputs: {
            VALUE: {
              shadow: {
                type: 'text',
                fields: {
                  TEXT: '',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_indexOf',
          keyword: 'index',
          inputs: {
            VALUE: {
              block: {
                type: 'variables_get',
                fields: {
                  VAR: 'text',
                },
              },
            },
            FIND: {
              shadow: {
                type: 'text',
                fields: {
                  TEXT: 'abc',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_charAt',
          keyword: 'charat',
          inputs: {
            VALUE: {
              block: {
                type: 'variables_get',
                fields: {
                  VAR: 'text',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_getSubstring',
          keyword: 'substring',
          inputs: {
            STRING: {
              block: {
                type: 'variables_get',
                fields: {
                  VAR: 'text',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_changeCase',
          keyword: 'case',
          inputs: {
            TEXT: {
              shadow: {
                type: 'text',
                fields: {
                  TEXT: 'abc',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_trim',
          keyword: 'trim',
          inputs: {
            TEXT: {
              shadow: {
                type: 'text',
                fields: {
                  TEXT: 'abc',
                },
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_count',
          keyword: 'count',
          inputs: {
            SUB: {
              shadow: {
                type: 'text',
              },
            },
            TEXT: {
              shadow: {
                type: 'text',
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_replace',
          keyword: 'replace',
          inputs: {
            FROM: {
              shadow: {
                type: 'text',
              },
            },
            TO: {
              shadow: {
                type: 'text',
              },
            },
            TEXT: {
              shadow: {
                type: 'text',
              },
            },
          },
        },
        {
          kind: 'block',
          type: 'text_reverse',
          keyword: 'reverse',
          inputs: {
            TEXT: {
              shadow: {
                type: 'text',
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
  kind: 'category',
  name: '%{BKY_CATEGORY_MATERIALS}',
  icon: './images/looks.svg',
  //colour: categoryColours["Materials"],
  categorystyle: 'materials_category',
  contents: [
    {
      kind: 'block',
      type: 'change_color',
      keyword: 'colour',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#008080',
            },
          },
          block: {
            type: 'lists_create_with',
            extraState: { itemCount: 1 },
            inline: true,
            inputs: {
              ADD0: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#008080',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'set_alpha',
      keyword: 'alpha',
      inputs: {
        ALPHA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'tint',
      keyword: 'tint',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#AA336A',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'highlight',
      keyword: 'highlight',
      inputs: {
        COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FFD700',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'glow',
      keyword: 'glow',
    },
    {
      kind: 'block',
      type: 'clear_effects',
      keyword: 'clear',
    },
    {
      kind: 'block',
      type: 'colour',
      keyword: 'setcol',
    },
    {
      kind: 'block',
      type: 'skin_colour',
      keyword: 'skincol',
      fields: {
        COLOR: '#A15C33',
      },
    },
    {
      kind: 'block',
      type: 'lists_create_with',
      keyword: 'colourlist',
      extraState: { itemCount: 2 },
      inline: true,
      inputs: {
        ADD0: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FF5733',
            },
          },
        },
        ADD1: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#FDFD96',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'random_colour',
      keyword: 'randcol',
    },
    {
      kind: 'block',
      type: 'colour_from_string',
      keyword: 'colstr',
    },
    {
      kind: 'block',
      type: 'set_material',
      keyword: 'setmat',
      inputs: {
        MATERIAL: {
          shadow: {
            type: 'material',
            inputs: {
              BASE_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#FF7F50',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'material',
      keyword: 'material',
      fields: {
        TEXTURE_SET: 'grass.png', // Use the named material
      },
      inputs: {
        BASE_COLOR: {
          shadow: {
            type: 'colour',
            fields: {
              COLOR: '#00AA00', // Default to a green colour
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'lists_create_with',
      keyword: 'materiallist',
      extraState: { itemCount: 1 },
      inline: true,
      inputs: {
        ADD0: {
          block: {
            type: 'material',
            fields: {
              TEXTURE_SET: 'bricks.png',
            },
            inputs: {
              BASE_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#B5523B',
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

const toolboxSound = {
  kind: 'category',
  name: '%{BKY_CATEGORY_SOUND}',
  icon: './images/sound.svg',
  //colour: categoryColours["Sound"],
  categorystyle: 'sound_category',
  contents: [
    {
      kind: 'block',
      type: 'play_theme',
      keyword: 'theme',
      inputs: {
        SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        VOLUME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'play_sound',
      keyword: 'sound',
      inputs: {
        SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        VOLUME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'stop_all_sounds',
      keyword: 'stopsound',
    },
    {
      kind: 'block',
      type: 'set_music_speed',
      keyword: 'musicspeed',
      inputs: {
        SPEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'play_tune_notes',
      keyword: 'playtunenotes',
      inputs: {
        NOTES: {
          block: {
            type: 'lists_create_with',
            extraState: { itemCount: 1 },
            inputs: {
              ADD0: {
                block: {
                  type: 'lists_create_with',
                  extraState: { itemCount: 4 },
                  inline: true,
                  inputs: {
                    ADD0: {
                      block: {
                        type: 'note',
                        inputs: {
                          PITCH: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 60 },
                            },
                          },
                          DURATION: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 0.5 },
                            },
                          },
                        },
                      },
                    },
                    ADD1: {
                      block: {
                        type: 'note',
                        inputs: {
                          PITCH: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 64 },
                            },
                          },
                          DURATION: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 0.5 },
                            },
                          },
                        },
                      },
                    },
                    ADD2: {
                      block: {
                        type: 'note',
                        inputs: {
                          PITCH: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 67 },
                            },
                          },
                          DURATION: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 0.5 },
                            },
                          },
                        },
                      },
                    },
                    ADD3: {
                      block: {
                        type: 'note',
                        inputs: {
                          PITCH: {
                            block: {
                              type: 'rest',
                            },
                          },
                          DURATION: {
                            shadow: {
                              type: 'math_number',
                              fields: { NUM: 0.5 },
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
        INSTRUMENT: {
          block: {
            type: 'instrument',
            fields: {
              INSTRUMENT_TYPE: 'default',
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'note',
      keyword: 'note',
      inputs: {
        PITCH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 60,
            },
          },
        },
        DURATION: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'rest',
      keyword: 'rest',
    },
    {
      kind: 'block',
      type: 'play_tune',
      keyword: 'playtune',
    },
    {
      kind: 'block',
      type: 'instrument',
      keyword: 'instrument',
    },
    {
      kind: 'block',
      type: 'create_instrument',
      keyword: 'makeinstr',
      inputs: {
        VOLUME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        EFFECT_RATE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 5,
            },
          },
        },
        EFFECT_DEPTH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        ATTACK: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.1,
            },
          },
        },
        DECAY: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.5,
            },
          },
        },
        SUSTAIN: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0.7,
            },
          },
        },
        RELEASE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'speak',
      keyword: 'speak',
      inputs: {
        TEXT: {
          shadow: {
            type: 'text',
            fields: {
              TEXT: 'Hello',
            },
          },
        },
        RATE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        PITCH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        VOLUME: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'enable_subtitles',
      keyword: 'subtitles',
    },
  ],
};

const toolboxLists = {
  kind: 'category',
  name: '%{BKY_CATEGORY_LISTS}',
  icon: './images/lists.svg',
  //colour: categoryColours["Lists"],
  categorystyle: 'lists_category',
  custom: 'LIST',
  contents: [
    {
      kind: 'block',
      type: 'lists_add_item',
      keyword: 'add',
    },
    {
      kind: 'block',
      type: 'lists_delete_nth',
      keyword: 'delete',
    },
    {
      kind: 'block',
      type: 'lists_create_empty',
      keyword: 'list',
    },
    {
      kind: 'block',
      type: 'lists_create_with',
      inline: true,
      inputs: {},
      keyword: 'these',
    },
    {
      kind: 'block',
      type: 'all_with_tag',
      keyword: 'tagged',
    },
    {
      kind: 'block',
      type: 'lists_repeat',
      keyword: 'item*',
    },
    {
      kind: 'block',
      type: 'lists_length',
      keyword: 'items',
    },
    {
      kind: 'block',
      type: 'lists_isEmpty',
      keyword: 'noitems',
    },
    {
      kind: 'block',
      type: 'lists_indexOf',
      keyword: 'find',
    },
    {
      kind: 'block',
      type: 'lists_getIndex',
      keyword: 'lget',
    },
    {
      kind: 'block',
      type: 'lists_setIndex',
      keyword: 'lset',
    },
    {
      kind: 'block',
      type: 'lists_getSublist',
      keyword: 'sublist',
    },
    {
      kind: 'block',
      type: 'lists_split',
      keyword: 'split',
    },
    {
      kind: 'block',
      type: 'lists_sort',
      keyword: 'sort',
    },
  ],
};

// `custom` supplies the flyout, so these contents are never rendered; they are
// here so the variable blocks reach the block search index, which is built from
// the toolbox definition.
export const localVariableBlock = {
  kind: 'block',
  type: 'local_variable',
  keyword: 'local',
  inputs: {
    VALUE: {
      shadow: {
        type: 'math_number',
        fields: { NUM: 0 },
      },
    },
  },
};

const toolboxVariables = {
  kind: 'category',
  name: '%{BKY_CATEGORY_VARIABLES_SUBCATEGORY}',
  icon: './images/variables.svg',
  categorystyle: 'variables_category',
  contents: [
    {
      kind: 'block',
      type: 'variables_set',
      keyword: 'set',
      inputs: {
        VALUE: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 0,
            },
          },
        },
      },
    },
    localVariableBlock,
    {
      kind: 'block',
      type: 'math_change',
      keyword: 'change',
      inputs: {
        DELTA: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'variables_get',
      keyword: 'variable',
    },
  ],
  custom: 'VARIABLE',
};

const toolboxData = {
  kind: 'category',
  name: '%{BKY_CATEGORY_VARIABLES}',
  icon: './images/data.svg',
  categorystyle: 'variables_category',
  contents: [toolboxVariables, toolboxLists],
};

const toolboxMath = {
  kind: 'category',
  name: '%{BKY_CATEGORY_MATH}',
  icon: './images/math.svg',
  //colour: categoryColours["Math"],
  categorystyle: 'math_category',
  contents: [
    {
      kind: 'block',
      type: 'math_arithmetic',
      keyword: 'math',
      fields: {
        OP: 'ADD',
      },
      inputs: {
        A: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        B: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'math_random_int',
      keyword: 'randint',
      inputs: {
        FROM: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        TO: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'random_seeded_int',
      keyword: 'seedrand',
      inputs: {
        FROM: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        TO: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
        SEED: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 123456, // Default seed value
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'math_number',
      keyword: 'num',
      fields: {
        NUM: 0,
      },
    },
    {
      kind: 'block',
      type: 'lists_create_with',
      keyword: 'numlist',
      extraState: { itemCount: 3 },
      inline: true,
      inputs: {
        ADD0: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        ADD1: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 2,
            },
          },
        },
        ADD2: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 3,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'vector',
      keyword: 'vec',
      ...vectorBlockSpec(0, 0, 0),
    },
    {
      kind: 'block',
      type: 'to_number',
      keyword: 'ton',
    },
    {
      kind: 'block',
      type: 'math_constant',
      keyword: 'pi',
    },
    {
      kind: 'block',
      type: 'math_number_property',
      keyword: 'even',
    },
    {
      kind: 'block',
      type: 'math_round',
      keyword: 'round',
    },
    {
      kind: 'block',
      type: 'math_single',
      keyword: 'abs',
      fields: {
        OP: 'ABS',
      },
    },
    {
      kind: 'block',
      type: 'math_trig',
      keyword: 'trig',
    },
    {
      kind: 'block',
      type: 'math_on_list',
      keyword: 'lmath',
    },
    {
      kind: 'block',
      type: 'math_modulo',
      keyword: 'mod',
    },
    {
      kind: 'block',
      type: 'math_constrain',
      keyword: 'constrain',
      inputs: {
        LOW: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 1,
            },
          },
        },
        HIGH: {
          shadow: {
            type: 'math_number',
            fields: {
              NUM: 100,
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'math_random_float',
      keyword: 'randf',
    },
  ],
};

const toolboxSnippetsPhysics = {
  kind: 'category',
  icon: './images/physics.svg',
  //colour: categoryColours["Snippets"],
  categorystyle: 'snippets_category',
  name: '%{BKY_CATEGORY_PHYSICS}',
  contents: [
    {
      kind: 'block',
      type: 'start',
      keyword: 'playerstart',
      hint: 'snippet_playerstart_hint',
      inputs: {
        DO: {
          block: {
            type: 'create_box',
            extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="false"></mutation>',
            fields: {
              ID_VAR: {
                name: 'box',
              },
            },
            inputs: {
              COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#6633ff',
                  },
                },
              },
              WIDTH: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              HEIGHT: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              DEPTH: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
            },
            next: {
              block: {
                type: 'add_physics',
                fields: {
                  MODEL_VAR: {
                    name: 'box',
                  },
                  PHYSICS_TYPE: 'DYNAMIC',
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'when_clicked',
      keyword: 'clickbox',
      hint: 'snippet_clickbox_hint',
      extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" inline="false"></mutation>',
      fields: {
        MODEL_VAR: {
          name: 'box',
        },
        TRIGGER: 'OnPickTrigger',
      },
      inputs: {
        DO: {
          block: {
            type: 'apply_force',
            fields: {
              MESH_VAR: {
                name: 'box',
              },
            },
            inputs: {
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 2,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
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
      kind: 'block',
      type: 'start',
      hint: 'snippet_bouncy_sphere_hint',
      inputs: {
        DO: {
          block: {
            type: 'create_sphere',
            ID_VAR: {
              name: 'sphere',
              type: '',
            },
            inputs: {
              COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#9932cc',
                  },
                },
              },
              DIAMETER_X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              DIAMETER_Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              DIAMETER_Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
            },
            next: {
              block: {
                type: 'add_physics',
                fields: {
                  MODEL_VAR: {
                    name: 'sphere',
                    type: '',
                  },
                  PHYSICS_TYPE: 'DYNAMIC',
                },
                next: {
                  block: {
                    type: 'apply_force',
                    fields: {
                      MESH_VAR: {
                        name: 'sphere',
                        type: '',
                      },
                    },
                    inputs: {
                      X: {
                        shadow: {
                          type: 'math_number',
                          fields: {
                            NUM: 1,
                          },
                        },
                      },
                      Y: {
                        shadow: {
                          type: 'math_number',
                          fields: {
                            NUM: 2,
                          },
                        },
                      },
                      Z: {
                        shadow: {
                          type: 'math_number',
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
      kind: 'block',
      type: 'start',
      hint: 'snippet_falling_star_hint',
      inputs: {
        DO: {
          block: {
            type: 'load_object',
            extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="false"></mutation>',
            fields: {
              ID_VAR: {
                name: 'star',
                type: '',
              },
              MODELS: 'Star.glb',
            },
            inputs: {
              COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#ffd700',
                  },
                },
              },
              SCALE: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 50,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
            },
            next: {
              block: {
                type: 'add_physics',
                fields: {
                  MODEL_VAR: {
                    name: 'star',
                  },
                  PHYSICS_TYPE: 'DYNAMIC',
                },
              },
            },
          },
        },
      },
    },
    {
      kind: 'block',
      type: 'start',
      hint: 'snippet_falling_heart_hint',
      inputs: {
        DO: {
          block: {
            type: 'load_object',
            extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="true"></mutation>',
            fields: {
              ID_VAR: {
                name: 'heart',
                type: '',
              },
              MODELS: 'Heart.glb',
            },
            inputs: {
              COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#cc0000',
                  },
                },
              },
              SCALE: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 50,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              DO: {
                block: {
                  type: 'rotate_to',
                  fields: {
                    MODEL: {
                      name: 'heart',
                    },
                  },
                  inputs: {
                    X: {
                      shadow: {
                        type: 'math_number',
                        fields: {
                          NUM: 0,
                        },
                      },
                    },
                    Y: {
                      shadow: {
                        type: 'math_number',
                        fields: {
                          NUM: 0,
                        },
                      },
                    },
                    Z: {
                      shadow: {
                        type: 'math_number',
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
                type: 'add_physics',
                fields: {
                  MODEL_VAR: {
                    name: 'heart',
                  },
                  PHYSICS_TYPE: 'DYNAMIC',
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
  kind: 'category',
  icon: './images/arrows.svg',
  categorystyle: 'snippets_category',
  name: '%{BKY_CATEGORY_MOVEMENT}',
  contents: [
    {
      kind: 'block',
      type: 'forever',
      keyword: 'move8',
      hint: 'snippet_move8_hint',
      inputs: {
        DO: {
          block: {
            type: 'if_clause',
            extraState: {
              mode: 'IF',
              stashedCondState: null,
            },
            fields: {
              MODE: 'IF',
            },
            inputs: {
              COND: {
                block: {
                  type: 'action_pressed',
                  fields: {
                    ACTION: 'FORWARD',
                  },
                },
              },
              DO: {
                block: {
                  type: 'move_forward',
                  fields: {
                    MODEL: {
                      name: 'player',
                    },
                    DIRECTION: 'forward',
                  },
                  inputs: {
                    SPEED: {
                      shadow: {
                        type: 'math_number',
                        fields: {
                          NUM: 3,
                        },
                      },
                    },
                  },
                  next: {
                    block: {
                      type: 'switch_animation',
                      fields: {
                        MODEL: {
                          name: 'player',
                        },
                      },
                      inputs: {
                        ANIMATION_NAME: {
                          shadow: {
                            type: 'animation_name',
                            fields: {
                              ANIMATION_NAME: 'Walk',
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
                type: 'if_clause',
                extraState: {
                  mode: 'ELSEIF',
                  stashedCondState: null,
                },
                fields: {
                  MODE: 'ELSEIF',
                },
                inputs: {
                  COND: {
                    block: {
                      type: 'action_pressed',
                      fields: {
                        ACTION: 'BACKWARD',
                      },
                    },
                  },
                  DO: {
                    block: {
                      type: 'move_forward',
                      fields: {
                        MODEL: {
                          name: 'player',
                        },
                        DIRECTION: 'forward',
                      },
                      inputs: {
                        SPEED: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: -3,
                            },
                          },
                        },
                      },
                      next: {
                        block: {
                          type: 'switch_animation',
                          fields: {
                            MODEL: {
                              name: 'player',
                            },
                          },
                          inputs: {
                            ANIMATION_NAME: {
                              shadow: {
                                type: 'animation_name',
                                fields: {
                                  ANIMATION_NAME: 'Walk',
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
                    type: 'if_clause',
                    extraState: {
                      mode: 'ELSE',
                      stashedCondState: null,
                    },
                    fields: {
                      MODE: 'ELSE',
                    },
                    inputs: {
                      DO: {
                        block: {
                          type: 'switch_animation',
                          fields: {
                            MODEL: {
                              name: 'player',
                            },
                          },
                          inputs: {
                            ANIMATION_NAME: {
                              shadow: {
                                type: 'animation_name',
                                fields: {
                                  ANIMATION_NAME: 'Idle',
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
      kind: 'block',
      type: 'forever',
      hint: 'snippet_move4_hint',
      inputs: {
        DO: {
          block: {
            type: 'if_clause',
            extraState: {
              mode: 'IF',
              stashedCondState: null,
            },
            fields: {
              MODE: 'IF',
            },
            inputs: {
              COND: {
                block: {
                  type: 'action_pressed',
                  fields: {
                    ACTION: 'FORWARD',
                  },
                },
              },
              DO: {
                block: {
                  type: 'move_forward',
                  fields: {
                    MODEL: {
                      name: 'player',
                    },
                    DIRECTION: 'forward',
                  },
                  inputs: {
                    SPEED: {
                      shadow: {
                        type: 'math_number',
                        fields: {
                          NUM: 3,
                        },
                      },
                    },
                  },
                  next: {
                    block: {
                      type: 'switch_animation',
                      fields: {
                        MODEL: {
                          name: 'player',
                        },
                      },
                      inputs: {
                        ANIMATION_NAME: {
                          shadow: {
                            type: 'animation_name',
                            fields: {
                              ANIMATION_NAME: 'Walk',
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
                type: 'if_clause',
                extraState: {
                  mode: 'ELSEIF',
                  stashedCondState: null,
                },
                fields: {
                  MODE: 'ELSEIF',
                },
                inputs: {
                  COND: {
                    block: {
                      type: 'action_pressed',
                      fields: {
                        ACTION: 'BACKWARD',
                      },
                    },
                  },
                  DO: {
                    block: {
                      type: 'move_forward',
                      fields: {
                        MODEL: {
                          name: 'player',
                        },
                        DIRECTION: 'forward',
                      },
                      inputs: {
                        SPEED: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: -3,
                            },
                          },
                        },
                      },
                      next: {
                        block: {
                          type: 'switch_animation',
                          fields: {
                            MODEL: {
                              name: 'player',
                            },
                          },
                          inputs: {
                            ANIMATION_NAME: {
                              shadow: {
                                type: 'animation_name',
                                fields: {
                                  ANIMATION_NAME: 'Walk',
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
                    type: 'if_clause',
                    extraState: {
                      mode: 'ELSEIF',
                      stashedCondState: null,
                    },
                    fields: {
                      MODE: 'ELSEIF',
                    },
                    inputs: {
                      COND: {
                        block: {
                          type: 'action_pressed',
                          fields: {
                            ACTION: 'LEFT',
                          },
                        },
                      },
                      DO: {
                        block: {
                          type: 'move_forward',
                          fields: {
                            MODEL: {
                              name: 'player',
                            },
                            DIRECTION: 'sideways',
                          },
                          inputs: {
                            SPEED: {
                              shadow: {
                                type: 'math_number',
                                fields: {
                                  NUM: -3,
                                },
                              },
                            },
                          },
                          next: {
                            block: {
                              type: 'switch_animation',
                              fields: {
                                MODEL: {
                                  name: 'player',
                                },
                              },
                              inputs: {
                                ANIMATION_NAME: {
                                  shadow: {
                                    type: 'animation_name',
                                    fields: {
                                      ANIMATION_NAME: 'Walk',
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
                        type: 'if_clause',
                        extraState: {
                          mode: 'ELSEIF',
                          stashedCondState: null,
                        },
                        fields: {
                          MODE: 'ELSEIF',
                        },
                        inputs: {
                          COND: {
                            block: {
                              type: 'action_pressed',
                              fields: {
                                ACTION: 'RIGHT',
                              },
                            },
                          },
                          DO: {
                            block: {
                              type: 'move_forward',
                              fields: {
                                MODEL: {
                                  name: 'player',
                                },
                                DIRECTION: 'sideways',
                              },
                              inputs: {
                                SPEED: {
                                  shadow: {
                                    type: 'math_number',
                                    fields: {
                                      NUM: 3,
                                    },
                                  },
                                },
                              },
                              next: {
                                block: {
                                  type: 'switch_animation',
                                  fields: {
                                    MODEL: {
                                      name: 'player',
                                    },
                                  },
                                  inputs: {
                                    ANIMATION_NAME: {
                                      shadow: {
                                        type: 'animation_name',
                                        fields: {
                                          ANIMATION_NAME: 'Walk',
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
                            type: 'if_clause',
                            extraState: {
                              mode: 'ELSE',
                              stashedCondState: null,
                            },
                            fields: {
                              MODE: 'ELSE',
                            },
                            inputs: {
                              DO: {
                                block: {
                                  type: 'switch_animation',
                                  fields: {
                                    MODEL: {
                                      name: 'player',
                                    },
                                  },
                                  inputs: {
                                    ANIMATION_NAME: {
                                      shadow: {
                                        type: 'animation_name',
                                        fields: {
                                          ANIMATION_NAME: 'Idle',
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
    {
      kind: 'block',
      type: 'start',
      keyword: 'movejump',
      hint: 'snippet_movejump_hint',
      collapsed: true,
      inputs: {
        DO: {
          block: {
            type: 'comment',
            inputs: {
              COMMENT: {
                shadow: {
                  type: 'text_multiline',
                  fields: {
                    TEXT: 'Move and jump',
                  },
                },
              },
            },
            next: {
              block: {
                type: 'variables_set',
                fields: {
                  VAR: {
                    name: 'jumping',
                  },
                },
                inputs: {
                  VALUE: {
                    shadow: {
                      type: 'math_number',
                      fields: {
                        NUM: 0,
                      },
                    },
                    block: {
                      type: 'logic_boolean',
                      fields: {
                        BOOL: 'FALSE',
                      },
                    },
                  },
                },
                next: {
                  block: {
                    type: 'forever',
                    extraState:
                      '<mutation xmlns="http://www.w3.org/1999/xhtml" inline="true"></mutation>',
                    inputs: {
                      DO: {
                        block: {
                          type: 'comment',
                          inputs: {
                            COMMENT: {
                              shadow: {
                                type: 'text_multiline',
                                fields: {
                                  TEXT: 'Jumping',
                                },
                              },
                            },
                          },
                          next: {
                            block: {
                              type: 'if_clause',
                              collapsed: true,
                              extraState: {
                                mode: 'IF',
                                stashedCondState: null,
                              },
                              fields: {
                                MODE: 'IF',
                              },
                              inputs: {
                                COND: {
                                  block: {
                                    type: 'logic_operation',
                                    fields: {
                                      OP: 'AND',
                                    },
                                    inputs: {
                                      A: {
                                        block: {
                                          type: 'action_pressed',
                                          fields: {
                                            ACTION: 'BUTTON4',
                                          },
                                        },
                                      },
                                      B: {
                                        block: {
                                          type: 'logic_negate',
                                          inputs: {
                                            BOOL: {
                                              block: {
                                                type: 'variables_get',
                                                fields: {
                                                  VAR: {
                                                    name: 'jumping',
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
                                DO: {
                                  block: {
                                    type: 'variables_set',
                                    fields: {
                                      VAR: {
                                        name: 'jumping',
                                      },
                                    },
                                    inputs: {
                                      VALUE: {
                                        shadow: {
                                          type: 'math_number',
                                          fields: {
                                            NUM: 0,
                                          },
                                        },
                                        block: {
                                          type: 'logic_boolean',
                                          fields: {
                                            BOOL: 'TRUE',
                                          },
                                        },
                                      },
                                    },
                                    next: {
                                      block: {
                                        type: 'jump',
                                        fields: {
                                          MODEL_VAR: {
                                            name: 'player',
                                          },
                                        },
                                        inputs: {
                                          JUMP_HEIGHT: {
                                            shadow: {
                                              type: 'math_number',
                                              fields: {
                                                NUM: 1.5,
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
                                  type: 'comment',
                                  inputs: {
                                    COMMENT: {
                                      shadow: {
                                        type: 'text_multiline',
                                        fields: {
                                          TEXT: 'Landing',
                                        },
                                      },
                                    },
                                  },
                                  next: {
                                    block: {
                                      type: 'if_clause',
                                      collapsed: true,
                                      extraState: {
                                        mode: 'IF',
                                        stashedCondState: null,
                                      },
                                      fields: {
                                        MODE: 'IF',
                                      },
                                      inputs: {
                                        COND: {
                                          block: {
                                            type: 'logic_operation',
                                            fields: {
                                              OP: 'AND',
                                            },
                                            inputs: {
                                              A: {
                                                block: {
                                                  type: 'variables_get',
                                                  fields: {
                                                    VAR: {
                                                      name: 'jumping',
                                                    },
                                                  },
                                                },
                                              },
                                              B: {
                                                block: {
                                                  type: 'touching_surface',
                                                  fields: {
                                                    MODEL_VAR: {
                                                      name: 'player',
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                        DO: {
                                          block: {
                                            type: 'variables_set',
                                            fields: {
                                              VAR: {
                                                name: 'jumping',
                                              },
                                            },
                                            inputs: {
                                              VALUE: {
                                                shadow: {
                                                  type: 'math_number',
                                                  fields: {
                                                    NUM: 0,
                                                  },
                                                },
                                                block: {
                                                  type: 'logic_boolean',
                                                  fields: {
                                                    BOOL: 'FALSE',
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                      next: {
                                        block: {
                                          type: 'comment',
                                          inputs: {
                                            COMMENT: {
                                              shadow: {
                                                type: 'text_multiline',
                                                fields: {
                                                  TEXT: 'Walking',
                                                },
                                              },
                                            },
                                          },
                                          next: {
                                            block: {
                                              type: 'if_clause',
                                              extraState: {
                                                mode: 'IF',
                                                stashedCondState: null,
                                              },
                                              fields: {
                                                MODE: 'IF',
                                              },
                                              inputs: {
                                                COND: {
                                                  block: {
                                                    type: 'action_pressed',
                                                    fields: {
                                                      ACTION: 'FORWARD',
                                                    },
                                                  },
                                                },
                                                DO: {
                                                  block: {
                                                    type: 'move_forward',
                                                    fields: {
                                                      MODEL: {
                                                        name: 'player',
                                                      },
                                                      DIRECTION: 'forward',
                                                    },
                                                    inputs: {
                                                      SPEED: {
                                                        shadow: {
                                                          type: 'math_number',
                                                          fields: {
                                                            NUM: 9,
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                              next: {
                                                block: {
                                                  type: 'if_clause',
                                                  extraState: {
                                                    mode: 'ELSEIF',
                                                    stashedCondState: null,
                                                  },
                                                  fields: {
                                                    MODE: 'ELSEIF',
                                                  },
                                                  inputs: {
                                                    COND: {
                                                      block: {
                                                        type: 'action_pressed',
                                                        fields: {
                                                          ACTION: 'BACKWARD',
                                                        },
                                                      },
                                                    },
                                                    DO: {
                                                      block: {
                                                        type: 'move_forward',
                                                        fields: {
                                                          MODEL: {
                                                            name: 'player',
                                                          },
                                                          DIRECTION: 'forward',
                                                        },
                                                        inputs: {
                                                          SPEED: {
                                                            shadow: {
                                                              type: 'math_number',
                                                              fields: {
                                                                NUM: -9,
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  next: {
                                                    block: {
                                                      type: 'if_clause',
                                                      extraState: {
                                                        mode: 'ELSEIF',
                                                        stashedCondState: null,
                                                      },
                                                      fields: {
                                                        MODE: 'ELSEIF',
                                                      },
                                                      inputs: {
                                                        COND: {
                                                          block: {
                                                            type: 'action_pressed',
                                                            fields: {
                                                              ACTION: 'LEFT',
                                                            },
                                                          },
                                                        },
                                                        DO: {
                                                          block: {
                                                            type: 'move_forward',
                                                            fields: {
                                                              MODEL: {
                                                                name: 'player',
                                                              },
                                                              DIRECTION: 'sideways',
                                                            },
                                                            inputs: {
                                                              SPEED: {
                                                                shadow: {
                                                                  type: 'math_number',
                                                                  fields: {
                                                                    NUM: -5,
                                                                  },
                                                                },
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                      next: {
                                                        block: {
                                                          type: 'if_clause',
                                                          extraState: {
                                                            mode: 'ELSEIF',
                                                            stashedCondState: null,
                                                          },
                                                          fields: {
                                                            MODE: 'ELSEIF',
                                                          },
                                                          inputs: {
                                                            COND: {
                                                              block: {
                                                                type: 'action_pressed',
                                                                fields: {
                                                                  ACTION: 'RIGHT',
                                                                },
                                                              },
                                                            },
                                                            DO: {
                                                              block: {
                                                                type: 'move_forward',
                                                                fields: {
                                                                  MODEL: {
                                                                    name: 'player',
                                                                  },
                                                                  DIRECTION: 'sideways',
                                                                },
                                                                inputs: {
                                                                  SPEED: {
                                                                    shadow: {
                                                                      type: 'math_number',
                                                                      fields: {
                                                                        NUM: 5,
                                                                      },
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                            },
                                                          },
                                                          next: {
                                                            block: {
                                                              type: 'comment',
                                                              inputs: {
                                                                COMMENT: {
                                                                  shadow: {
                                                                    type: 'text_multiline',
                                                                    fields: {
                                                                      TEXT: 'Animation',
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                              next: {
                                                                block: {
                                                                  type: 'if_clause',
                                                                  extraState: {
                                                                    mode: 'IF',
                                                                    stashedCondState: null,
                                                                  },
                                                                  fields: {
                                                                    MODE: 'IF',
                                                                  },
                                                                  inputs: {
                                                                    COND: {
                                                                      block: {
                                                                        type: 'logic_compare',
                                                                        fields: {
                                                                          OP: 'EQ',
                                                                        },
                                                                        inputs: {
                                                                          A: {
                                                                            block: {
                                                                              type: 'variables_get',
                                                                              fields: {
                                                                                VAR: {
                                                                                  name: 'jumping',
                                                                                },
                                                                              },
                                                                            },
                                                                          },
                                                                          B: {
                                                                            shadow: {
                                                                              type: 'math_number',
                                                                              fields: {
                                                                                NUM: 0,
                                                                              },
                                                                            },
                                                                            block: {
                                                                              type: 'logic_boolean',
                                                                              fields: {
                                                                                BOOL: 'TRUE',
                                                                              },
                                                                            },
                                                                          },
                                                                        },
                                                                      },
                                                                    },
                                                                    DO: {
                                                                      block: {
                                                                        type: 'switch_animation',
                                                                        fields: {
                                                                          MODEL: {
                                                                            name: 'player',
                                                                          },
                                                                        },
                                                                        inputs: {
                                                                          ANIMATION_NAME: {
                                                                            shadow: {
                                                                              type: 'animation_name',
                                                                              fields: {
                                                                                ANIMATION_NAME:
                                                                                  'JumpIdle',
                                                                              },
                                                                            },
                                                                          },
                                                                        },
                                                                      },
                                                                    },
                                                                  },
                                                                  next: {
                                                                    block: {
                                                                      type: 'if_clause',
                                                                      extraState: {
                                                                        mode: 'ELSE',
                                                                        stashedCondState: null,
                                                                      },
                                                                      fields: {
                                                                        MODE: 'ELSE',
                                                                      },
                                                                      inputs: {
                                                                        DO: {
                                                                          block: {
                                                                            type: 'if_clause',
                                                                            extraState: {
                                                                              mode: 'IF',
                                                                              stashedCondState: null,
                                                                            },
                                                                            fields: {
                                                                              MODE: 'IF',
                                                                            },
                                                                            inputs: {
                                                                              COND: {
                                                                                block: {
                                                                                  type: 'logic_operation',
                                                                                  fields: {
                                                                                    OP: 'OR',
                                                                                  },
                                                                                  inputs: {
                                                                                    A: {
                                                                                      block: {
                                                                                        type: 'logic_operation',
                                                                                        fields: {
                                                                                          OP: 'OR',
                                                                                        },
                                                                                        inputs: {
                                                                                          A: {
                                                                                            block: {
                                                                                              type: 'action_pressed',
                                                                                              fields: {
                                                                                                ACTION:
                                                                                                  'FORWARD',
                                                                                              },
                                                                                            },
                                                                                          },
                                                                                          B: {
                                                                                            block: {
                                                                                              type: 'action_pressed',
                                                                                              fields: {
                                                                                                ACTION:
                                                                                                  'BACKWARD',
                                                                                              },
                                                                                            },
                                                                                          },
                                                                                        },
                                                                                      },
                                                                                    },
                                                                                    B: {
                                                                                      block: {
                                                                                        type: 'logic_operation',
                                                                                        fields: {
                                                                                          OP: 'OR',
                                                                                        },
                                                                                        inputs: {
                                                                                          A: {
                                                                                            block: {
                                                                                              type: 'action_pressed',
                                                                                              fields: {
                                                                                                ACTION:
                                                                                                  'LEFT',
                                                                                              },
                                                                                            },
                                                                                          },
                                                                                          B: {
                                                                                            block: {
                                                                                              type: 'action_pressed',
                                                                                              fields: {
                                                                                                ACTION:
                                                                                                  'RIGHT',
                                                                                              },
                                                                                            },
                                                                                          },
                                                                                        },
                                                                                      },
                                                                                    },
                                                                                  },
                                                                                },
                                                                              },
                                                                              DO: {
                                                                                block: {
                                                                                  type: 'switch_animation',
                                                                                  fields: {
                                                                                    MODEL: {
                                                                                      name: 'player',
                                                                                    },
                                                                                  },
                                                                                  inputs: {
                                                                                    ANIMATION_NAME: {
                                                                                      shadow: {
                                                                                        type: 'animation_name',
                                                                                        fields: {
                                                                                          ANIMATION_NAME:
                                                                                            'Run',
                                                                                        },
                                                                                      },
                                                                                    },
                                                                                  },
                                                                                },
                                                                              },
                                                                            },
                                                                            next: {
                                                                              block: {
                                                                                type: 'if_clause',
                                                                                extraState: {
                                                                                  mode: 'ELSE',
                                                                                  stashedCondState: {
                                                                                    type: 'touching_surface',
                                                                                    fields: {
                                                                                      MODEL_VAR: {
                                                                                        name: 'player',
                                                                                      },
                                                                                    },
                                                                                  },
                                                                                },
                                                                                fields: {
                                                                                  MODE: 'ELSE',
                                                                                },
                                                                                inputs: {
                                                                                  DO: {
                                                                                    block: {
                                                                                      type: 'switch_animation',
                                                                                      fields: {
                                                                                        MODEL: {
                                                                                          name: 'player',
                                                                                        },
                                                                                      },
                                                                                      inputs: {
                                                                                        ANIMATION_NAME:
                                                                                          {
                                                                                            shadow: {
                                                                                              type: 'animation_name',
                                                                                              fields: {
                                                                                                ANIMATION_NAME:
                                                                                                  'Idle',
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
                },
              },
            },
          },
        },
      },
    },
  ],
};

const snippetNum = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });
const snippetVar = (name) => ({ block: { type: 'variables_get', fields: { VAR: { name } } } });
const snippetMath = (OP, A, B) => ({
  block: { type: 'math_arithmetic', fields: { OP }, inputs: { A, B } },
});
const snippetChain = (...items) =>
  items.reduceRight((next, item) => ({ block: { ...item.block, next } }));
const snippetPrefabGroup = (groupName, commentText, body) =>
  snippetChain(
    {
      block: {
        type: 'comment',
        inputs: {
          COMMENT: { shadow: { type: 'text_multiline', fields: { TEXT: commentText } } },
        },
      },
    },
    {
      block: {
        type: 'create_group',
        collapsed: true,
        fields: { ID_VAR: { name: groupName }, ACTIVE: true },
        inputs: { DO: body },
      },
    }
  );
const snippetBookcasePart = (name, WIDTH, HEIGHT, DEPTH, X, Y, Z, COLOR = snippetVar('material')) => ({
  block: {
    type: 'create_box',
    fields: { ID_VAR: { name } },
    inputs: { COLOR, WIDTH, HEIGHT, DEPTH, X, Y, Z },
  },
});
const snippetWood = (COLOR) => ({
  shadow: {
    type: 'material',
    fields: { TEXTURE_SET: 'wood.png' },
    inputs: {
      BASE_COLOR: { shadow: { type: 'colour', fields: { COLOR } } },
    },
  },
});
const snippetNone = (COLOR) => ({
  shadow: {
    type: 'material',
    fields: { TEXTURE_SET: 'none.png' },
    inputs: {
      BASE_COLOR: { shadow: { type: 'colour', fields: { COLOR } } },
    },
  },
});
const bookcaseParams = ['width', 'height', 'depth', 'shelves', 'shelf material', 'material'];
const bookcaseDefaults = {
  width: snippetNum(2),
  height: snippetNum(3),
  depth: snippetNum(0.6),
  shelves: snippetNum(4),
  'shelf material': snippetWood('#a0522d'),
  material: snippetWood('#deb887'),
};
const bookcasePlacement = {
  X: snippetNum(3),
  Y: snippetNum(0),
  Z: snippetNum(0),
  ROTATE_Y: snippetNum(0),
};
const snippetBookcaseHalf = (size) =>
  snippetMath('MINUS', snippetMath('DIVIDE', snippetVar(size), snippetNum(2)), snippetNum(0.05));

const snippetBookcaseBody = snippetChain(
  snippetBookcasePart(
    'left side',
    snippetNum(0.1),
    snippetVar('height'),
    snippetVar('depth'),
    snippetMath('MINUS', snippetNum(0), snippetBookcaseHalf('width')),
    snippetNum(0),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'right side',
    snippetNum(0.1),
    snippetVar('height'),
    snippetVar('depth'),
    snippetBookcaseHalf('width'),
    snippetNum(0),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'bottom',
    snippetVar('width'),
    snippetNum(0.1),
    snippetVar('depth'),
    snippetNum(0),
    snippetNum(0),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'top',
    snippetVar('width'),
    snippetNum(0.1),
    snippetVar('depth'),
    snippetNum(0),
    snippetMath('MINUS', snippetVar('height'), snippetNum(0.1)),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'back',
    snippetVar('width'),
    snippetVar('height'),
    snippetNum(0.1),
    snippetNum(0),
    snippetNum(0),
    snippetBookcaseHalf('depth')
  ),
  {
    block: {
      type: 'controls_for',
      fields: { VAR: { name: 'shelf number' } },
      inputs: {
        FROM: snippetNum(1),
        TO: snippetVar('shelves'),
        BY: snippetNum(1),
        DO: snippetBookcasePart(
          'shelf',
          snippetMath('MINUS', snippetVar('width'), snippetNum(0.2)),
          snippetNum(0.1),
          snippetMath('MINUS', snippetVar('depth'), snippetNum(0.1)),
          snippetNum(0),
          snippetMath(
            'DIVIDE',
            snippetMath(
              'MULTIPLY',
              snippetMath('MINUS', snippetVar('height'), snippetNum(0.1)),
              snippetVar('shelf number')
            ),
            snippetMath('ADD', snippetVar('shelves'), snippetNum(1))
          ),
          snippetNum(-0.05),
          snippetVar('shelf material')
        ),
      },
    },
  }
);

const deskParams = ['width', 'height', 'depth', 'drawer material', 'material'];
const deskDefaults = {
  width: snippetNum(3),
  height: snippetNum(1.35),
  depth: snippetNum(1.5),
  'drawer material': snippetNone('#a0522d'),
  material: snippetNone('#deb887'),
};
const deskPlacement = {
  X: snippetNum(-3),
  Y: snippetNum(0),
  Z: snippetNum(0),
  ROTATE_Y: snippetNum(0),
};
const snippetDeskDrawerClick = (name) => ({
  block: {
    type: 'when_clicked',
    extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" inline="true"></mutation>',
    fields: { MODEL_VAR: { name }, TRIGGER: 'OnPickTrigger' },
    inputs: {
      DO: snippetChain(
        {
          block: {
            type: 'glide_to_axis',
            fields: {
              MESH_VAR: { name },
              AXIS: 'forward',
              MODE: 'AWAIT',
              REVERSE: false,
              LOOP: false,
              EASING: 'SineEase',
            },
            inputs: { TARGET: snippetNum(1), DURATION: snippetNum(0.6) },
          },
        },
        { block: { type: 'wait_seconds', inputs: { DURATION: snippetNum(4) } } },
        {
          block: {
            type: 'glide_to_axis',
            fields: {
              MESH_VAR: { name },
              AXIS: 'forward',
              MODE: 'AWAIT',
              REVERSE: false,
              LOOP: false,
              EASING: 'SineEase',
            },
            inputs: { TARGET: snippetNum(-1), DURATION: snippetNum(0.6) },
          },
        }
      ),
    },
  },
});
const snippetDeskBox = (name, WIDTH, HEIGHT, DEPTH, X, Y, Z, DO) => ({
  block: {
    type: 'create_box',
    ...(DO
      ? { extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="true"></mutation>' }
      : {}),
    fields: { ID_VAR: { name } },
    inputs: {
      COLOR: snippetVar('drawer material'),
      WIDTH,
      HEIGHT,
      DEPTH,
      X,
      Y,
      Z,
      ...(DO ? { DO } : {}),
    },
  },
});
const snippetDeskDrawer = () => {
  const front = 'drawer front';
  const bottom = 'drawer bottom';
  const back = 'drawer back';
  const leftWall = 'drawer left wall';
  const rightWall = 'drawer right wall';
  const half = snippetMath('DIVIDE', snippetVar('width'), snippetNum(2));
  const quarter = snippetMath('DIVIDE', snippetVar('width'), snippetNum(4));
  const centerX = snippetMath('MINUS', quarter, snippetNum(0.05));
  const drawerWidth = snippetMath('MINUS', half, snippetNum(0.1));
  const bottomDepth = snippetMath('MINUS', snippetVar('depth'), snippetNum(0.05));
  const wallDepth = snippetMath('MINUS', snippetVar('depth'), snippetNum(0.1));
  const frontZ = snippetMath('MINUS', snippetNum(0.025), snippetMath('DIVIDE', snippetVar('depth'), snippetNum(2)));
  const backZ = snippetMath('MINUS', snippetMath('DIVIDE', snippetVar('depth'), snippetNum(2)), snippetNum(0.025));
  const baseY = snippetMath('MINUS', snippetVar('height'), snippetNum(0.45));
  const rimY = snippetMath('MINUS', snippetVar('height'), snippetNum(0.4));
  return [
    snippetDeskBox(
      front,
      drawerWidth,
      snippetNum(0.35),
      snippetNum(0.05),
      centerX,
      baseY,
      frontZ,
      snippetDeskDrawerClick(front)
    ),
    snippetDeskBox(
      bottom,
      drawerWidth,
      snippetNum(0.05),
      bottomDepth,
      centerX,
      baseY,
      snippetNum(0.025)
    ),
    snippetDeskBox(
      leftWall,
      snippetNum(0.05),
      snippetNum(0.3),
      wallDepth,
      snippetNum(0.025),
      rimY,
      snippetNum(0)
    ),
    snippetDeskBox(
      rightWall,
      snippetNum(0.05),
      snippetNum(0.3),
      wallDepth,
      snippetMath('MINUS', half, snippetNum(0.125)),
      rimY,
      snippetNum(0)
    ),
    snippetDeskBox(
      back,
      drawerWidth,
      snippetNum(0.3),
      snippetNum(0.05),
      centerX,
      rimY,
      backZ
    ),
    {
      block: {
        type: 'parent_children',
        fields: { PARENT_MESH: { name: front } },
        inputs: {
          MESH_LIST: {
            block: {
              type: 'lists_create_with',
              inline: true,
              extraState: { itemCount: 4 },
              inputs: {
                ADD0: { block: { type: 'variables_get', fields: { VAR: { name: bottom } } } },
                ADD1: {
                  block: {
                    type: 'variables_get',
                    fields: { VAR: { name: leftWall } },
                  },
                },
                ADD2: {
                  block: {
                    type: 'variables_get',
                    fields: { VAR: { name: rightWall } },
                  },
                },
                ADD3: { block: { type: 'variables_get', fields: { VAR: { name: back } } } },
              },
            },
          },
        },
      },
    },
  ];
};

const snippetDeskBody = snippetChain(
  snippetBookcasePart(
    'left side',
    snippetNum(0.1),
    snippetMath('MINUS', snippetVar('height'), snippetNum(0.1)),
    snippetVar('depth'),
    snippetMath('MINUS', snippetNum(0), snippetBookcaseHalf('width')),
    snippetNum(0),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'right side',
    snippetNum(0.1),
    snippetMath('MINUS', snippetVar('height'), snippetNum(0.1)),
    snippetVar('depth'),
    snippetBookcaseHalf('width'),
    snippetNum(0),
    snippetNum(0)
  ),
  snippetBookcasePart(
    'top',
    snippetVar('width'),
    snippetNum(0.1),
    snippetVar('depth'),
    snippetNum(0),
    snippetMath('MINUS', snippetVar('height'), snippetNum(0.1)),
    snippetNum(0)
  ),
  ...snippetDeskDrawer()
);

const toolboxSnippetsBuilding = {
  kind: 'category',
  icon: './images/house.svg',
  categorystyle: 'snippets_category',
  name: '%{BKY_CATEGORY_BUILDING}',
  contents: [
    {
      kind: 'block',
      type: 'procedures_defprefab',
      keyword: 'bookcase',
      hint: 'snippet_bookcase_hint',
      extraState: {
        params: bookcaseParams.map((name) => ({
          name,
          argId: name === 'material' ? 'MATERIAL' : name,
        })),
      },
      fields: { NAME: 'bookcase' },
      inputs: {
        ...Object.fromEntries(
          bookcaseParams.map((name) => [name === 'material' ? 'MATERIAL' : name, bookcaseDefaults[name]])
        ),
        ...bookcasePlacement,
        STACK: snippetPrefabGroup(
          'bookcase group',
          'Adds a function for creating a bookcase.',
          snippetBookcaseBody
        ),
      },
    },
    {
      kind: 'block',
      type: 'procedures_defprefab',
      keyword: 'desk',
      hint: 'snippet_desk_hint',
      extraState: {
        params: deskParams.map((name) => ({
          name,
          argId: name === 'material' ? 'MATERIAL' : name,
        })),
      },
      fields: { NAME: 'desk' },
      inputs: {
        ...Object.fromEntries(
          deskParams.map((name) => [name === 'material' ? 'MATERIAL' : name, deskDefaults[name]])
        ),
        ...deskPlacement,
        STACK: snippetPrefabGroup('desk group', 'Adds a function for creating a desk.', snippetDeskBody),
      },
    },
    {
      kind: 'block',
      type: 'start',
      keyword: 'hingeddoor',
      hint: 'snippet_hinged_door_hint',
      inputs: {
        DO: {
          block: {
            type: 'load_multi_object',
            fields: {
              ID_VAR: {
                name: 'room',
              },
              MODELS: 'window_door.glb',
            },
            inputs: {
              SCALE: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: -10,
                  },
                },
              },
              COLORS: {
                shadow: {
                  type: 'lists_create_with',
                  extraState: {
                    itemCount: 3,
                  },
                  inline: true,
                  inputs: {
                    ADD0: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#E7A988',
                        },
                      },
                    },
                    ADD1: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#E74E5F',
                        },
                      },
                    },
                    ADD2: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#E7E7E7',
                        },
                      },
                    },
                  },
                },
              },
              DO: {
                block: {
                  type: 'add_physics_shape',
                  fields: {
                    MODEL_VAR: {
                      name: 'room',
                    },
                    SHAPE_TYPE: 'MESH',
                  },
                  next: {
                    block: {
                      type: 'create_box',
                      extraState:
                        '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="true"></mutation>',
                      fields: {
                        ID_VAR: {
                          name: 'door',
                        },
                      },
                      inputs: {
                        COLOR: {
                          shadow: {
                            type: 'colour',
                            fields: {
                              COLOR: '#8b5a2b',
                            },
                          },
                        },
                        WIDTH: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: 0.15,
                            },
                          },
                        },
                        HEIGHT: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: 3.45,
                            },
                          },
                        },
                        DEPTH: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: 2.1,
                            },
                          },
                        },
                        X: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: 4.35,
                            },
                          },
                        },
                        Y: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: 0.31,
                            },
                          },
                        },
                        Z: {
                          shadow: {
                            type: 'math_number',
                            fields: {
                              NUM: -10,
                            },
                          },
                        },
                        DO: {
                          block: {
                            type: 'set_pivot',
                            fields: {
                              MESH: {
                                name: 'door',
                              },
                            },
                            inputs: {
                              X_PIVOT: {
                                shadow: {
                                  type: 'min_centre_max',
                                  fields: {
                                    PIVOT_OPTION: 'MIN',
                                  },
                                },
                              },
                              Y_PIVOT: {
                                shadow: {
                                  type: 'min_centre_max',
                                  fields: {
                                    PIVOT_OPTION: 'MIN',
                                  },
                                },
                              },
                              Z_PIVOT: {
                                shadow: {
                                  type: 'min_centre_max',
                                  fields: {
                                    PIVOT_OPTION: 'MIN',
                                  },
                                },
                              },
                            },
                            next: {
                              block: {
                                type: 'parent_child',
                                fields: {
                                  PARENT_MESH: {
                                    name: 'room',
                                  },
                                  CHILD_MESH: {
                                    name: 'door',
                                  },
                                },
                                inputs: {
                                  X_OFFSET: {
                                    shadow: {
                                      type: 'math_number',
                                      fields: {
                                        NUM: 4.275,
                                      },
                                    },
                                  },
                                  Y_OFFSET: {
                                    shadow: {
                                      type: 'math_number',
                                      fields: {
                                        NUM: 0.31,
                                      },
                                    },
                                  },
                                  Z_OFFSET: {
                                    shadow: {
                                      type: 'math_number',
                                      fields: {
                                        NUM: -1,
                                      },
                                    },
                                  },
                                },
                                next: {
                                  block: {
                                    type: 'add_physics',
                                    fields: {
                                      MODEL_VAR: {
                                        name: 'door',
                                      },
                                      PHYSICS_TYPE: 'ANIMATED',
                                    },
                                    next: {
                                      block: {
                                        type: 'when_clicked',
                                        extraState:
                                          '<mutation xmlns="http://www.w3.org/1999/xhtml" inline="true"></mutation>',
                                        fields: {
                                          MODEL_VAR: {
                                            name: 'door',
                                          },
                                          TRIGGER: 'OnPickTrigger',
                                        },
                                        inputs: {
                                          DO: {
                                            block: {
                                              type: 'rotate_anim_seconds',
                                              fields: {
                                                MESH_VAR: {
                                                  name: 'door',
                                                },
                                                MODE: 'AWAIT',
                                                REVERSE: false,
                                                LOOP: false,
                                                EASING: 'SineEase',
                                              },
                                              inputs: {
                                                ROT_X: {
                                                  shadow: {
                                                    type: 'math_number',
                                                    fields: {
                                                      NUM: 0,
                                                    },
                                                  },
                                                },
                                                ROT_Y: {
                                                  shadow: {
                                                    type: 'math_number',
                                                    fields: {
                                                      NUM: -90,
                                                    },
                                                  },
                                                },
                                                ROT_Z: {
                                                  shadow: {
                                                    type: 'math_number',
                                                    fields: {
                                                      NUM: 0,
                                                    },
                                                  },
                                                },
                                                DURATION: {
                                                  shadow: {
                                                    type: 'math_number',
                                                    fields: {
                                                      NUM: 1,
                                                    },
                                                  },
                                                },
                                              },
                                              next: {
                                                block: {
                                                  type: 'wait_seconds',
                                                  inputs: {
                                                    DURATION: {
                                                      shadow: {
                                                        type: 'math_number',
                                                        fields: {
                                                          NUM: 3,
                                                        },
                                                      },
                                                    },
                                                  },
                                                  next: {
                                                    block: {
                                                      type: 'rotate_anim_seconds',
                                                      fields: {
                                                        MESH_VAR: {
                                                          name: 'door',
                                                        },
                                                        MODE: 'AWAIT',
                                                        REVERSE: false,
                                                        LOOP: false,
                                                        EASING: 'SineEase',
                                                      },
                                                      inputs: {
                                                        ROT_X: {
                                                          shadow: {
                                                            type: 'math_number',
                                                            fields: {
                                                              NUM: 0,
                                                            },
                                                          },
                                                        },
                                                        ROT_Y: {
                                                          shadow: {
                                                            type: 'math_number',
                                                            fields: {
                                                              NUM: 0,
                                                            },
                                                          },
                                                        },
                                                        ROT_Z: {
                                                          shadow: {
                                                            type: 'math_number',
                                                            fields: {
                                                              NUM: 0,
                                                            },
                                                          },
                                                        },
                                                        DURATION: {
                                                          shadow: {
                                                            type: 'math_number',
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
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      collapsed: true,
                    },
                  },
                },
              },
            },
            extraState: '<mutation xmlns="http://www.w3.org/1999/xhtml" has_do="true"></mutation>',
          },
        },
      },
    },
  ],
};

const toolboxSnippets = {
  kind: 'category',
  icon: './images/snippets.svg',
  //colour: categoryColours["Snippets"],
  categorystyle: 'snippets_category',
  name: '%{BKY_CATEGORY_SNIPPETS}',
  contents: [
    {
      type: 'start',
      kind: 'block',
      keyword: 'skyworld',
      hint: 'snippet_skyworld_hint',
      inputs: {
        DO: {
          block: {
            type: 'set_sky_color',
            inputs: {
              COLOR: {
                block: {
                  type: 'lists_create_with',
                  extraState: { itemCount: 2 },
                  inline: true,
                  inputs: {
                    ADD0: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#6495ed',
                        },
                      },
                    },
                    ADD1: {
                      shadow: {
                        type: 'colour',
                        fields: {
                          COLOR: '#87ceeb',
                        },
                      },
                    },
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
                type: 'create_map',
                fields: {
                  MAP_NAME: 'NONE',
                },
                inputs: {
                  MATERIAL: {
                    shadow: {
                      type: 'material',
                      fields: {
                        TEXTURE_SET: 'none.png',
                      },
                      inputs: {
                        BASE_COLOR: {
                          shadow: {
                            type: 'colour',

                            fields: {
                              COLOR: '#71bc78',
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
      kind: 'block',
      type: 'start',
      hint: 'snippet_player_camera_hint',
      inputs: {
        DO: {
          block: {
            type: 'load_character',
            fields: {
              MODELS: 'Block3.glb',
              ID_VAR: {
                name: 'player',
                type: '',
              },
            },
            inputs: {
              SCALE: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 1,
                  },
                },
              },
              X: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Y: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              Z: {
                shadow: {
                  type: 'math_number',
                  fields: {
                    NUM: 0,
                  },
                },
              },
              HAIR_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#000000',
                  },
                },
              },
              SKIN_COLOR: {
                shadow: {
                  type: 'skin_colour',
                  fields: {
                    COLOR: '#a15c33',
                  },
                },
              },
              EYES_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#000000',
                  },
                },
              },
              SLEEVES_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#008b8b',
                  },
                },
              },
              SHORTS_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#00008b',
                  },
                },
              },
              TSHIRT_COLOR: {
                shadow: {
                  type: 'colour',
                  fields: {
                    COLOR: '#ff8f60',
                  },
                },
              },
            },
            next: {
              block: {
                type: 'add_physics',
                fields: {
                  MODEL_VAR: {
                    name: 'player',
                    type: '',
                  },
                  PHYSICS_TYPE: 'DYNAMIC',
                },
                next: {
                  block: {
                    type: 'camera_follow',
                    fields: {
                      MESH_VAR: {
                        name: 'player',
                        type: '',
                      },
                    },
                    inputs: {
                      RADIUS: {
                        shadow: {
                          type: 'math_number',
                          fields: {
                            NUM: 7,
                          },
                        },
                      },
                      ANGLE: {
                        shadow: {
                          type: 'math_number',
                          fields: {
                            NUM: 90,
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
    toolboxSnippetsBuilding,
  ],
};

const toolboxFunctions = {
  kind: 'category',
  name: '%{BKY_CATEGORY_FUNCTIONS}',
  icon: './images/functions.svg',
  custom: 'PROCEDURE',
  categorystyle: 'procedures_category',
};

export const toolbox = {
  kind: 'categoryToolbox',
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

const isMobileToolbox = () => window.matchMedia('(max-width: 768px)').matches;
const isLightTheme = () => document.body.dataset.theme === 'light';

const subcategoryBg = (colour, level) =>
  isMobileToolbox() && level > 0 && isLightTheme()
    ? `color-mix(in srgb, ${colour} 60%, white)`
    : colour;

// The row-divider colour: the same colour Blockly strokes a block's outline
// with. For our hue-derived block styles that colourTertiary works out to the
// fill blended 25% toward black, so the category rule ends up identical to the
// 1px edge on the matching blocks (verified against computed styles).
const categoryBorderColour = (colour) =>
  Blockly.utils.colour.blend('#000', colour, 0.25) || colour;

class IconCategory extends Blockly.ToolboxCategory {
  constructor(categoryDef, toolbox, opt_parent) {
    super(categoryDef, toolbox, opt_parent);
  }

  addColourBorder_() {
    // Do nothing to prevent the colored block from being added
  }

  /** @override */
  createIconDom_() {
    const img = document.createElement('img');
    img.src = this.toolboxItemDef_.icon || './default_icon.svg'; // Use a default icon if none provided
    img.alt = this.toolboxItemDef_.name + ' icon';
    img.width = '30';
    img.height = '30';
    img.classList.add('customToolboxIcon');
    return img;
  }

  /** @override */
  createDom_() {
    super.createDom_();

    // Use the stored colour_ property for the tab colour
    const tabColour = this.colour_;

    // Apply custom class to the rowDiv_
    this.rowDiv_.classList.add('custom-category');

    // Set the background color of the category to match the tab colour
    if (tabColour) {
      this.rowDiv_.style.setProperty(
        'background-color',
        subcategoryBg(tabColour, this.getLevel()),
        'important'
      );
      this.rowDiv_.style.setProperty(
        '--fc-category-border-colour',
        categoryBorderColour(tabColour)
      );
    }

    return this.htmlDiv_;
  }

  /** @override */
  setSelected(isSelected) {
    super.setSelected(isSelected);

    // Get the category color
    const categoryColour = this.colour_;

    // Always re-apply so Blockly's setSelected can't overwrite our tint
    if (categoryColour) {
      this.rowDiv_.style.setProperty(
        'background-color',
        subcategoryBg(categoryColour, this.getLevel()),
        'important'
      );
    }
  }
}

// Register the custom category
Blockly.registry.register(
  Blockly.registry.Type.TOOLBOX_ITEM,
  Blockly.ToolboxCategory.registrationName,
  IconCategory,
  true
);

class CustomCollapsibleToolboxCategory extends Blockly.CollapsibleToolboxCategory {
  constructor(categoryDef, toolbox, opt_parent) {
    super(categoryDef, toolbox, opt_parent);
    // Store the original icon and color
    this.originalIcon = categoryDef.icon || './default_icon.svg';
    this.originalColor = categoryDef.colour || '#000000';
    this.preventNextPointerClickToggle_ = false;
  }

  toolboxHasFocus_() {
    const toolboxDiv = this.parentToolbox_?.HtmlDiv || this.parentToolbox_?.getHtmlDiv?.();
    const active = document.activeElement;
    if (toolboxDiv && active && (active === toolboxDiv || toolboxDiv.contains(active))) {
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

  // Preserve the original icon
  createIconDom_() {
    const img = document.createElement('img');
    img.src = this.originalIcon;
    img.alt = this.toolboxItemDef_.name + ' icon';
    img.width = '30';
    img.height = '30';
    img.classList.add('customToolboxIcon');
    return img;
  }

  ensurePointerFocusedSelection_() {
    this.parentToolbox_?.setSelectedItem?.(this);
    this.setSelected(true);
    this.setExpanded(true);
    Blockly.keyboardNavigationController?.setIsActive?.(true);
    const focusManager = Blockly.getFocusManager?.();
    focusManager?.focusTree?.(this.parentToolbox_);
    focusManager?.focusNode?.(this);
  }

  ensureKeyboardFocusedSelection_() {
    this.setExpanded(true);
  }

  setSelected(isSelected) {
    super.setSelected(isSelected);

    if (isSelected) {
      this.setExpanded(true);
    }

    // Get the category color
    const categoryColour = this.colour_;

    // Always re-apply so Blockly's setSelected can't overwrite our tint
    if (categoryColour) {
      this.rowDiv_.style.setProperty(
        'background-color',
        subcategoryBg(categoryColour, this.getLevel()),
        'important'
      );
    }
  }

  /** @override */
  createDom_() {
    super.createDom_();

    // Use the stored colour_ property for the tab colour
    const tabColour = this.colour_;

    // Apply custom class to the rowDiv_
    this.rowDiv_.classList.add('custom-category');

    // Set the background color of the category to match the tab colour
    if (tabColour) {
      this.rowDiv_.style.setProperty(
        'background-color',
        subcategoryBg(tabColour, this.getLevel()),
        'important'
      );
      this.rowDiv_.style.setProperty(
        '--fc-category-border-colour',
        categoryBorderColour(tabColour)
      );
    }

    this.rowDiv_.addEventListener(
      'pointerdown',
      (e) => {
        this.preventNextPointerClickToggle_ = !this.categoryHasFocus_();

        if (!this.preventNextPointerClickToggle_) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        this.ensurePointerFocusedSelection_();
      },
      { capture: true }
    );

    this.rowDiv_.addEventListener(
      'click',
      (e) => {
        if (!this.preventNextPointerClickToggle_) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        this.ensurePointerFocusedSelection_();

        this.preventNextPointerClickToggle_ = false;
      },
      { capture: true }
    );

    this.rowDiv_.addEventListener('focusin', () => {
      if (this.toolboxHasFocus_()) {
        this.parentToolbox_?.setSelectedItem?.(this);
        this.ensureKeyboardFocusedSelection_();
      }
    });

    return this.htmlDiv_;
  }
}

// Register the custom collapsible category
Blockly.registry.register(
  Blockly.registry.Type.TOOLBOX_ITEM,
  Blockly.CollapsibleToolboxCategory.registrationName,
  CustomCollapsibleToolboxCategory,
  true
);
