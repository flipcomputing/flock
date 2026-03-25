import { getDropdownOption, translate } from "./main/translation.js";

export const themeNames = [
  "theme-bright.mp3",
  "theme-calm.mp3",
  "theme-electronic.mp3",
  "theme-game.mp3",
  "theme-medieval.mp3",
  "theme-metal.mp3",
];

export const audioNames = [
  "highDown.mp3",
  "highUp.mp3",
  "laser1.mp3",
  "laser6.mp3",
  "laser8.mp3",
  "lowDown.mp3",
  "lowRandom.mp3",
  "lowThreeTone.mp3",
  "phaseJump1.mp3",
  "powerUp1.mp3",
  "powerUp2.mp3",
  "powerUp3.mp3",
  "powerUp4.mp3",
  "powerUp5.mp3",
  "spaceTrash1.mp3",
  "threeTone1.mp3",
  "threeTone2.mp3",
];

export function audioFileToLabel(filename) {
  return filename
    .replace(".mp3", "")
    .replace(/([A-Z])/g, " $1")
    .replace(/(\d+)/g, " $1")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getThemeDisplayName(filename) {
  const baseName = filename.replace("theme-", "").replace(".mp3", "");
  const key = "theme_" + baseName + "_option";
  const translated = translate(key);
  return translated && translated !== key
    ? translated
    : baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

export const characterNames = [
  "Liz1.glb",
  "Liz2.glb",
  "Block1.glb",
  "Block2.glb",
  "Block3.glb",
  "Block4.glb",
  "Block5.glb",
  "Block6.glb",
  "Liz3.glb",
  "Liz4.glb",
  "Liz5.glb",
  "Liz6.glb",
  /*"Character1.glb",
        "Character2.glb",
        "Character3.glb",
        "Character4.glb",*/
];

export const multiObjectNames = [
  "tree.glb",
  "tree2.glb",
  "tree3.glb",
  "tree4.glb",
  "hut.glb",
  "hut2.glb",
  "hut3.glb",
  "hut4.glb",
  "rocks.glb",
  "rocks2.glb",
  "rocks3.glb",
  "rocks4.glb",
  "pond.glb",
  "boat.glb",
  "airplane.glb",
  "airplane2.glb",
  "skateboard.glb",
  "humped.glb",
  "jetty.glb",
  "flower.glb",
  "flower2.glb",
  //"stones_straight.glb",
  //"stones_curve.glb",
];

export const objectNames = [
  "Star.glb",
  "Heart.glb",
  "Coin.glb",
  "egg.glb",
  "Gem1.glb",
  "Gem2.glb",
  "Gem3.glb",
  "Key.glb",
  "Wand.glb",
  "Hat.glb",
  "donut.glb",
  "pumpkin.glb",
  "apple.glb",
  "starboppers.glb",
  "headphones.glb",
];

function modelNameToDisplayName(modelName) {
  return String(modelName || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const objectDisplayNameTranslationKeys = {
  "Liz1.glb": "model_display_liz1",
  "Liz2.glb": "model_display_liz2",
  "Liz3.glb": "model_display_liz3",
  "Liz4.glb": "model_display_liz4",
  "Liz5.glb": "model_display_liz5",
  "Liz6.glb": "model_display_liz6",
  "Block1.glb": "model_display_block1",
  "Block2.glb": "model_display_block2",
  "Block3.glb": "model_display_block3",
  "Block4.glb": "model_display_block4",
  "Block5.glb": "model_display_block5",
  "Block6.glb": "model_display_block6",

  "tree.glb": "model_display_tree",
  "tree2.glb": "model_display_tree2",
  "tree3.glb": "model_display_tree3",
  "tree4.glb": "model_display_tree4",
  "hut.glb": "model_display_hut",
  "hut2.glb": "model_display_hut2",
  "hut3.glb": "model_display_hut3",
  "hut4.glb": "model_display_hut4",
  "rocks.glb": "model_display_rocks",
  "rocks2.glb": "model_display_rocks2",
  "rocks3.glb": "model_display_rocks3",
  "rocks4.glb": "model_display_rocks4",
  "pond.glb": "model_display_pond",
  "boat.glb": "model_display_boat",
  "airplane.glb": "model_display_airplane",
  "airplane2.glb": "model_display_airplane2",
  "skateboard.glb": "model_display_skateboard",
  "humped.glb": "model_display_humped",
  "jetty.glb": "model_display_jetty",
  "flower.glb": "model_display_flower",
  "flower2.glb": "model_display_flower2",
  "Star.glb": "model_display_star",
  "Heart.glb": "model_display_heart",
  "Coin.glb": "model_display_coin",
  "egg.glb": "model_display_egg",
  "Gem1.glb": "model_display_gem1",
  "Gem2.glb": "model_display_gem2",
  "Gem3.glb": "model_display_gem3",
  "Key.glb": "model_display_key",
  "Wand.glb": "model_display_wand",
  "Hat.glb": "model_display_hat",
  "donut.glb": "model_display_donut",
  "pumpkin.glb": "model_display_pumpkin",
  "apple.glb": "model_display_apple",
  "starboppers.glb": "model_display_starboppers",
  "headphones.glb": "model_display_headphones",
  "Flock.glb": "model_display_flock",
  "Flock_Santa.glb": "model_display_flock_santa",
  "Character.glb": "model_display_character",
  "rhino.glb": "model_display_rhino",
};

export function getModelDisplayName(modelName) {
  const key = objectDisplayNameTranslationKeys[modelName];
  if (key) {
    const translated = translate(key);
    if (translated && translated !== key) {
      return translated;
    }
  }
  return modelNameToDisplayName(modelName);
}

export const objectColours = {
  "Star.glb": ["#FFD700", "#FFD700", "#FFD700"],
  "Heart.glb": ["#FF69B4", "#FF69B4", "#FF69B4"],
  "Coin.glb": ["#A47E1B", "#C9A227", "#76520E"],
  "egg.glb": ["#fffcec", "#fffcec", "#fffcec"],
  "Gem1.glb": ["#00BFFF", "#00BFFF", "#00BFFF"],
  "Gem2.glb": ["#8A2BE2", "#8A2BE2", "#8A2BE2"],
  "Gem3.glb": ["#FF4500", "#FF4500", "#FF4500"],
  "Key.glb": ["#A47E1B", "#C9A227", "#76520E"],
  "Wand.glb": ["#FF4500", "#8A2BE2", "#92614A"],
  "Hat.glb": ["#9D3F72", "#B5FDFD", "#3D0073"],
  "donut.glb": ["#f9cb9c", "#fba0c3"],
  "pumpkin.glb": ["#E78632", "#75430F"],
  "apple.glb": ["#3FAF45", "#A9323F", "#624A20"],
  "starboppers.glb": ["#FFD700", "#FFD700", "#FFD700", "#f9f9f9"],
  "headphones.glb": ["#53E0E7", "#3291E7", "#7D7D7D"],

  "tree.glb": ["#66CDAA", "#CD853F"],
  "tree2.glb": ["#7F9F7F", "#A1623B"],
  "tree3.glb": ["#403C3C", "#312616"],
  "tree4.glb": ["#0D5B28", "#6D6C51"],

  "rocks.glb": ["#898D86", "#99a83d"],
  "rocks2.glb": ["#898D86", "#99a83d"],
  "rocks3.glb": ["#898D86", "#99a83d"],
  "rocks4.glb": ["#898D86", "#99a83d", "#6BC6EF", "#f9f9f9"],
  "pond.glb": ["#00E704", "#5A91E7", "#9A9A9A"],

  "hut.glb": ["#B66946", "#5F2524", "#C25A5C", "#E1B46E", "#3BACBA", "#878787"],
  "hut2.glb": [
    "#814C22",
    "#231E1D",
    "#FFF6A6",
    "#E7AF3A",
    "#E73627",
    "#878787",
  ],
  "hut3.glb": [
    "#F6DAB6",
    "#6CC3C1",
    "#9DC45C",
    "#EEB975",
    "#F3B4BE",
    "#878787",
  ],
  "hut4.glb": [
    "#F2E8CF",
    "#BC4749",
    "#EEB975",
    "#AF1B3F",
    "#6A994E",
    "#878787",
  ],

  "boat.glb": [
    "#4F8A46",
    "#E7D48E",
    "#E76635",
    "#E76C69",
    "#5E64E7",
    "#4A4A4A",
    "#AAAAAA",
    "#E711CD",
  ],

  "airplane.glb": ["#E75D43", "#6A6A6A", "#E7C777"],

  "airplane2.glb": ["#6A6A6A", "#E75D43", "#E7C777"],

  "skateboard.glb": ["#E769D3", "#484848", "#251BE7"],

  "rhino.glb": ["#6D6B6C", "#F6F6F6", "#373737", "#230F0F"],
  "lion.glb": ["#000000", "#DECC9C", "#8A4900", "#C69452"],

  "humped.glb": ["#FFA869", "#7E5024", "#E76F31"],
  "jetty.glb": ["#FFA869", "#7E5024", "#E76F31"],
  "flower.glb": ["#E73F9F", "#4AB700", "#E7D535"],
  "flower2.glb": ["#E73F9F", "#E7774E", "#E7D535"],
  //"stones_straight.glb": ["#E73F9F", "#4AB700", "#E7D535","#dce0d9", "#fbf6ef", "#ead7c3"],
  //"stones_curve.glb": ["#E73F9F", "#4AB700", "#E7D535","#dce0d9", "#fbf6ef", "#ead7c3"],
};

export const modelNames = [
  "Flock.glb",
  //"Flock_Santa.glb",
  //"Character.glb",
  //"bird.glb",
  //"boat.glb",
  "lion.glb",
  "rhino.glb",
  //"Seagull.glb",
];

export const blockNames = [
  "Character1.glb",
  "Character2.glb",
  "Character3.glb",
  "Character4.glb",
  "Flock.glb",
  "Flock_Santa.glb",
  "Character.glb",
  "lion.glb",
  "rhino.glb",
  //"Seagull.glb",
];

export const modelAnimationNames = [
  "Flock.glb",
  "Flock_Santa.glb",
  "rhino.glb",
  "lion.glb",
  //"Seagull.glb",
];

export function mapNames() {
  return [
    getDropdownOption("circular_depression.png"),
    getDropdownOption("checkerboard.png"),
    getDropdownOption("sloped_plane.png"),
    getDropdownOption("cove_plateau.png"),
    getDropdownOption("random_hills.png"),
    getDropdownOption("diagonal_ridge.png"),
    getDropdownOption("mixed_heights.png"),
    getDropdownOption("uneven_terrain.png"),
  ];
}

export function animationNames() {
  return [
    getDropdownOption("Idle"),
    getDropdownOption("Walk"),
    getDropdownOption("Run"),
    getDropdownOption("Wave"),
    getDropdownOption("Yes"),
    getDropdownOption("No"),
    getDropdownOption("Duck"),
    getDropdownOption("Fall"),
    getDropdownOption("Fly"),
    getDropdownOption("Jump"),
    getDropdownOption("JumpUp"),
    getDropdownOption("JumpIdle"),
    getDropdownOption("JumpLand"),
    getDropdownOption("Flip"),
    getDropdownOption("Dance1"),
    getDropdownOption("Dance2"),
    getDropdownOption("Dance3"),
    getDropdownOption("Dance4"),
    getDropdownOption("Punch"),
    getDropdownOption("HitReact"),
    getDropdownOption("Idle_Hold"),
    getDropdownOption("Walk_Hold"),
    getDropdownOption("Run_Hold"),
    getDropdownOption("Sit_Down"),
    getDropdownOption("Sitting"),
    getDropdownOption("Stand_Up"),
    getDropdownOption("Wobble"),
    getDropdownOption("Clap"),
    getDropdownOption("Climb_rope"),
  ];
}

export const materialNames = [
  "none.png",
  "arrows.png",
  "bricks.png",
  "carbonfibre.png",
  "carpet.png",
  "circles.png",
  "eyeball.png",
  "fabric.png",
  "fishes.png",
  "fish_above.png",
  "flowers.png",
  "flower_tile.png",
  "fruit.png",
  "grass.png",
  "gravel.png",
  "Grid.png",
  "leaves.png",
  "marble.png",
  "mushroom.png",
  "planks.png",
  "rough.png",
  "shapes.png",
  "stars.png",
  "stripes.png",
  "swirl.png",
  "tiles.png",
  "triangles.png",
  "wiggles.png",
  "windmill.png",
  "wood.png",
  "gridxy.png",
];

export const attachNames = ["Hold", "Head"];

export const attachBlockMapping = {
  Hold: "Hold",
  Head: "Head",
};

export const attachMixamoMapping = {
  Hold: "mixamorig:LeftHand",
  Head: "mixamorig:Head",
};

export function getAttachNames() {
  return attachNames.map((name) => getDropdownOption(name));
}
