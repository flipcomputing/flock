

export default {
  // Blockly category message keys for custom categories
  CATEGORY_SCENE: "Scene",
  CATEGORY_MESHES: "Meshes", 
  CATEGORY_XR: "XR",
  CATEGORY_EFFECTS: "Effects",
  CATEGORY_CAMERA: "Camera",
  CATEGORY_EVENTS: "Events",
  CATEGORY_TRANSFORM: "Transform",
  CATEGORY_PHYSICS: "Physics",
  CATEGORY_CONNECT: "Connect",
  CATEGORY_COMBINE: "Combine",
  CATEGORY_ANIMATE: "Animate",
  CATEGORY_KEYFRAME: "Keyframe",
  CATEGORY_CONTROL: "Control",
  CATEGORY_CONDITION: "Condition",
  CATEGORY_SENSING: "Sensing",
  CATEGORY_TEXT: "Text",
  CATEGORY_STRINGS: "Strings", 
  CATEGORY_MATERIALS: "Materials",
  CATEGORY_SOUND: "Sound",
  CATEGORY_VARIABLES: "Variables",
  CATEGORY_LISTS: "Lists",
  CATEGORY_MATH: "Math",
  CATEGORY_FUNCTIONS: "Functions",
  CATEGORY_SNIPPETS: "Snippets",

  // Custom block translations - Scene blocks
  set_sky_color: "sky %1",
  create_ground: "ground %1",
  set_background_color: "set background color %1",
  create_map: "map %1 with material %2",
  show: "show %1",
  hide: "hide %1",
  dispose: "dispose %1",
  clone_mesh: "add %1 clone of %2",

  // Custom block translations - Models blocks
  load_character: "add %1 %2 scale: %3 x: %4 y: %5 z: %6\nHair: %7 |  Skin: %8 |  Eyes: %9 |  T-Shirt: %10 |  Shorts: %11 |  Detail: %12",
  load_object: "add %1 %2 %3 scale: %4 x: %5 y: %6 z: %7",
  load_multi_object: "add %1 %2 scale: %3 x: %4 y: %5 z: %6\ncolors: %7",
  load_model: "add %1 %2 scale: %3 x: %4 y: %5 z: %6",
  
  // Blockly message overrides for English
  LISTS_CREATE_WITH_INPUT_WITH: "list",
  TEXT_JOIN_TITLE_CREATEWITH: "text",
  CONTROLS_REPEAT_INPUT_DO: "",
  CONTROLS_WHILEUNTIL_INPUT_DO: "",
  CONTROLS_FOR_INPUT_DO: "",
  CONTROLS_FOREACH_INPUT_DO: "",
  CONTROLS_IF_MSG_THEN: "",
  CONTROLS_IF_MSG_ELSE: "else\n",
  CONTROLS_FOR_TITLE: "for each %1 from %2 to %3 by %4",
  
  // Block message translations
  BLOCK_PRINT_TEXT_MESSAGE: "print %1 for %2 seconds %3",
  BLOCK_WAIT_SECONDS_MESSAGE: "wait %1 seconds",
  BLOCK_KEY_PRESSED_MESSAGE: "key %1 pressed?",
  BLOCK_MOVE_FORWARD_MESSAGE: "move %1 forward by %2",
  BLOCK_CREATE_BOX_MESSAGE: "create box %1 color %2 size %3 × %4 × %5 at %6, %7, %8",
  
  // Add more custom block translations as needed
  
  // Tooltip translations - Scene Blocks
  set_sky_color_tooltip: "Set the sky color of the scene.\nKeyword: sky",
  create_ground_tooltip: "Add a ground plane with collisions enabled to the scene.\nKeyword: ground",
  set_background_color_tooltip: "Set the scene's background color.\nKeyword: background",
  create_map_tooltip: "Create a map with the selected name and material.\nKeyword: map",
  show_tooltip: "Show the selected mesh.\nKeyword: show",
  hide_tooltip: "Hide the selected mesh.\nKeyword: hide",
  dispose_tooltip: "Remove the specified mesh from the scene.\nKeyword: dispose",
  clone_mesh_tooltip: "Clone a mesh and assign it to a variable.\nKeyword: clone",

  // Tooltip translations - Models blocks
  load_character_tooltip: "Create a configurable character.\nKeyword: character",
  load_object_tooltip: "Create an object.\nKeyword: object",
  load_multi_object_tooltip: "Create an object with colours.\nKeyword: object",
  load_model_tooltip: "Load a model.\nKeyword: model",
};

