import { getDropdownOption, translate } from './main/translation.js';

export const SHORTCUTS_HELP_URL = 'https://hub.flockxr.com/knowledge-base/keyboard-controls/';

export const TOP_BLOCK_TYPES = Object.freeze([
  'start',
  'forever',
  'when_clicked',
  'when_touches',
  'on_collision',
  'when_key_event',
  'when_action_event',
  'on_event',
  'section',
  'procedures_defnoreturn',
  'procedures_defreturn',
  'procedures_defprefab',
  'microbit_input',
]);

export const themeNames = [
  'theme-bright.mp3',
  'theme-calm.mp3',
  'theme-electronic.mp3',
  'theme-game.mp3',
  'theme-medieval.mp3',
  'theme-metal.mp3',
];

export const audioNames = [
  'highDown.mp3',
  'highUp.mp3',
  'laser1.mp3',
  'laser2.mp3',
  'laser3.mp3',
  'lowDown.mp3',
  'lowRandom.mp3',
  'lowThreeTone.mp3',
  'phaseJump1.mp3',
  'powerUp1.mp3',
  'powerUp2.mp3',
  'powerUp3.mp3',
  'powerUp4.mp3',
  'powerUp5.mp3',
  'spaceTrash.mp3',
  'threeTone1.mp3',
  'threeTone2.mp3',
  'chop.mp3',
  'creak.mp3',
  'door_close.mp3',
  'door_open.mp3',
  'footstep.mp3',
  'metal_latch.mp3',
];

export function audioFileToLabel(filename) {
  return filename
    .replace('.mp3', '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/(\d+)/g, ' $1')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getThemeDisplayName(filename) {
  const baseName = filename.replace('theme-', '').replace('.mp3', '');
  const key = 'theme_' + baseName + '_option';
  const translated = translate(key);
  return translated && translated !== key
    ? translated
    : baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

export function getSoundDisplayName(filename) {
  const baseName = filename.replace('.mp3', '');
  const key = 'sound_' + baseName + '_option';
  const translated = translate(key);
  return translated && translated !== key ? translated : audioFileToLabel(filename);
}

export const characterNames = [
  'Liz1.glb',
  'Liz2.glb',
  'Block1.glb',
  'Block2.glb',
  'Block3.glb',
  'Block4.glb',
  'Block5.glb',
  'Block6.glb',
  'Liz3.glb',
  'Liz4.glb',
  'Liz5.glb',
  'Liz6.glb',
];

export const multiObjectNames = [
  'tree.glb',
  'tree2.glb',
  'tree3.glb',
  'tree4.glb',
  'hut.glb',
  'hut2.glb',
  'hut3.glb',
  'hut4.glb',
  'rocks.glb',
  'rocks2.glb',
  'rocks3.glb',
  'rocks4.glb',
  'window_window.glb',
  'window_only.glb',
  'window_stairs.glb',
  'window_door.glb',
  'window_door_reversed.glb',
  'pond.glb',
  'boat.glb',
  'airplane.glb',
  'airplane2.glb',
  'skateboard.glb',
  'humped.glb',
  'jetty.glb',
  'boardwalk_straight.glb',
  'flower.glb',
  'flower2.glb',
  'mushroom.glb',
  'mushroom_2.glb',
  'icecrystals.glb',
  'stalagmite.glb',
];

export const objectNames = [
  'Star.glb',
  'Heart.glb',
  'Coin.glb',
  'egg.glb',
  'Gem1.glb',
  'Gem2.glb',
  'Gem3.glb',
  'Key.glb',
  'Wand.glb',
  'Hat.glb',
  'donut.glb',
  'pumpkin.glb',
  'apple.glb',
  'starboppers.glb',
  'headphones.glb',
];

function modelNameToDisplayName(modelName) {
  return String(modelName || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const objectDisplayNameTranslationKeys = {
  'Liz1.glb': 'model_display_liz1',
  'Liz2.glb': 'model_display_liz2',
  'Liz3.glb': 'model_display_liz3',
  'Liz4.glb': 'model_display_liz4',
  'Liz5.glb': 'model_display_liz5',
  'Liz6.glb': 'model_display_liz6',
  'Block1.glb': 'model_display_block1',
  'Block2.glb': 'model_display_block2',
  'Block3.glb': 'model_display_block3',
  'Block4.glb': 'model_display_block4',
  'Block5.glb': 'model_display_block5',
  'Block6.glb': 'model_display_block6',

  'tree.glb': 'model_display_tree',
  'tree2.glb': 'model_display_tree2',
  'tree3.glb': 'model_display_tree3',
  'tree4.glb': 'model_display_tree4',
  'hut.glb': 'model_display_hut',
  'hut2.glb': 'model_display_hut2',
  'hut3.glb': 'model_display_hut3',
  'hut4.glb': 'model_display_hut4',
  'rocks.glb': 'model_display_rocks',
  'rocks2.glb': 'model_display_rocks2',
  'rocks3.glb': 'model_display_rocks3',
  'rocks4.glb': 'model_display_rocks4',
  'window_window.glb': 'model_display_window_window',
  'window_only.glb': 'model_display_window_only',
  'window_stairs.glb': 'model_display_window_stairs',
  'window_door.glb': 'model_display_window_door',
  'pond.glb': 'model_display_pond',
  'boat.glb': 'model_display_boat',
  'airplane.glb': 'model_display_airplane',
  'airplane2.glb': 'model_display_airplane2',
  'skateboard.glb': 'model_display_skateboard',
  'humped.glb': 'model_display_humped',
  'jetty.glb': 'model_display_jetty',
  'flower.glb': 'model_display_flower',
  'flower2.glb': 'model_display_flower2',
  'Star.glb': 'model_display_star',
  'Heart.glb': 'model_display_heart',
  'Coin.glb': 'model_display_coin',
  'egg.glb': 'model_display_egg',
  'Gem1.glb': 'model_display_gem1',
  'Gem2.glb': 'model_display_gem2',
  'Gem3.glb': 'model_display_gem3',
  'Key.glb': 'model_display_key',
  'Wand.glb': 'model_display_wand',
  'Hat.glb': 'model_display_hat',
  'donut.glb': 'model_display_donut',
  'mushroom.glb': 'model_display_mushroom',
  'mushroom_2.glb': 'model_display_mushroom_2',
  'icecrystals.glb': 'model_display_icecrystals',
  'stalagmite.glb': 'model_display_stalagmite',
  'pumpkin.glb': 'model_display_pumpkin',
  'apple.glb': 'model_display_apple',
  'starboppers.glb': 'model_display_starboppers',
  'headphones.glb': 'model_display_headphones',
  'Flock.glb': 'model_display_flock',
  'Bunny.glb': 'model_display_bunny',
  'Tiger.glb': 'model_display_tiger',
  'Flock_Santa.glb': 'model_display_flock_santa',
  'Character.glb': 'model_display_character',
  'rhino.glb': 'model_display_rhino',
  'camera.glb': 'model_display_camera',
};

// Per-model collider override for imported GLBs. Currently supports 'BOX'.
export const objectColliderShapes = {
  // 'boat.glb': 'BOX',
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
  'Star.glb': ['#FFD700', '#FFD700', '#FFD700'],
  'Heart.glb': ['#FF69B4', '#FF69B4', '#FF69B4'],
  'Coin.glb': ['#A47E1B', '#C9A227', '#76520E'],
  'egg.glb': ['#fffcec', '#fffcec', '#fffcec'],
  'Gem1.glb': ['#00BFFF', '#00BFFF', '#00BFFF'],
  'Gem2.glb': ['#8A2BE2', '#8A2BE2', '#8A2BE2'],
  'Gem3.glb': ['#FF4500', '#FF4500', '#FF4500'],
  'Key.glb': ['#A47E1B', '#C9A227', '#76520E'],
  'Wand.glb': ['#FF4500', '#8A2BE2', '#92614A'],
  'Hat.glb': ['#9D3F72', '#B5FDFD', '#3D0073'],
  'donut.glb': ['#f9cb9c', '#fba0c3'],
  'mushroom.glb': ['#ffffff', '#E73A49', '#8F7A61'],
  'mushroom_2.glb': ['#ffffff', '#E73A49', '#8F7A61'],
  'pumpkin.glb': ['#E78632', '#75430F'],
  'apple.glb': ['#3FAF45', '#A9323F', '#624A20'],
  'starboppers.glb': ['#FFD700', '#FFD700', '#FFD700', '#f9f9f9'],
  'headphones.glb': ['#53E0E7', '#3291E7', '#7D7D7D'],
  'camera.glb': ['#3A3A3A', '#511D91', '#6A676E', '#D4FBA7'],

  'tree.glb': ['#66CDAA', '#CD853F'],
  'tree2.glb': ['#7F9F7F', '#A1623B'],
  'tree3.glb': ['#403C3C', '#312616'],
  'tree4.glb': ['#0D5B28', '#6D6C51'],

  'rocks.glb': ['#898D86', '#99a83d'],
  'rocks2.glb': ['#898D86', '#99a83d'],
  'rocks3.glb': ['#898D86', '#99a83d'],
  'rocks4.glb': ['#898D86', '#99a83d', '#6BC6EF', '#f9f9f9'],
  'pond.glb': ['#00E704', '#5A91E7', '#9A9A9A'],

  'hut.glb': ['#B66946', '#5F2524', '#C25A5C', '#E1B46E', '#3BACBA', '#878787'],
  'hut2.glb': ['#814C22', '#231E1D', '#FFF6A6', '#E7AF3A', '#E73627', '#878787'],
  'hut3.glb': ['#F6DAB6', '#6CC3C1', '#9DC45C', '#EEB975', '#F3B4BE', '#878787'],
  'hut4.glb': ['#F2E8CF', '#BC4749', '#EEB975', '#AF1B3F', '#6A994E', '#878787'],
  'window_window.glb': ['#E7A988', '#E74E5F', '#E7E7E7'],
  'window_only.glb': ['#E7A988', '#E74E5F', '#E7E7E7'],
  'window_stairs.glb': ['#E7A988', '#E74E5F', '#E7E7E7'],
  'window_door.glb': ['#E7A988', '#E74E5F', '#E7E7E7'],
  'window_door_reversed.glb': ['#E7A988', '#E74E5F', '#E7E7E7'],
  'boat.glb': [
    '#4F8A46',
    '#E7D48E',
    '#E76635',
    '#E76C69',
    '#5E64E7',
    '#4A4A4A',
    '#AAAAAA',
    '#E711CD',
  ],

  'airplane.glb': ['#E75D43', '#6A6A6A', '#E7C777', '#979797', '#A033E7'],

  'airplane2.glb': ['#E75D43', '#6A6A6A', '#E7C777', '#979797', '#A033E7'],

  'skateboard.glb': ['#E769D3', '#484848', '#251BE7'],

  'Flock.glb': [
    '#511D91',
    '#33125B',
    '#FFFFFF',
    '#000000',
    '#511D91',
    '#F77100',
    '#343434',
    '#511D91',
  ],

    'Bunny.glb': [
    '#55C7C3',
    '#55C7C3',
    '#55C7C3',
    '#68445F',
    '#E7E7E7',
    '#CE4A93',
    '#000000',
    '#000000',
    '#FFFFFF',
  ],

     'Tiger.glb': [
    '#8A4E45',
    '#5C430A',
    '#C76E61',
    '#AE6B5D',
    '#68445F',
    '#CE4A93',
    '#000000',
    '#FFFFFF',
    '#FFFFFF',
  ],
  
  'rhino.glb': ['#6D6B6C', '#F6F6F6', '#373737', '#230F0F'],
  'lion.glb': ['#000000', '#DECC9C', '#8A4900', '#C69452'],

  'humped.glb': ['#FFA869', '#E76F31', '#7E5024'],
  'boardwalk_straight.glb': ['#7E5024', '#7E5024', '#7E5024'],
  'jetty.glb': ['#FFA869', '#7E5024', '#E76F31'],
  'flower.glb': ['#E73F9F', '#4AB700', '#E7D535'],
  'flower2.glb': ['#7C38E7', '#4AB700', '#E7D535'],
};

export const modelNames = ['Flock.glb', 'Bunny.glb', 'Tiger.glb', 'lion.glb', 'rhino.glb'];

export const blockNames = [
  'Character1.glb',
  'Character2.glb',
  'Character3.glb',
  'Character4.glb',
  'Flock.glb',
  'Bunny.glb',
  'Tiger.glb',
  'Flock_Santa.glb',
  'Character.glb',
  'lion.glb',
  'rhino.glb',
];

export const modelAnimations = {
  'Flock.glb': ['Fly', 'Idle', 'Walk', 'Wave'],
  'Bunny.glb': ['Idle', 'Walk'],
  'Tiger.glb': ['Idle', 'Walk'],
  'rhino.glb': ['Idle'],
  'lion.glb': ['Idle'],
  'airplane.glb': ['Fly'],
  'airplane2.glb': ['Fly'],
};

export const modelAnimationNames = Object.keys(modelAnimations);

export function mapNames() {
  return [
    getDropdownOption('circular_depression.png'),
    getDropdownOption('checkerboard.png'),
    getDropdownOption('sloped_plane.png'),
    getDropdownOption('cove_plateau.png'),
    getDropdownOption('random_hills.png'),
    getDropdownOption('diagonal_ridge.png'),
    getDropdownOption('mixed_heights.png'),
    getDropdownOption('uneven_terrain.png'),
    getDropdownOption('mountains.png'),
    getDropdownOption('Islands.png'),
    getDropdownOption('Lookout.png'),
    getDropdownOption('Valley.png'),
    getDropdownOption('Basin.png'),
  ];
}

export function animationNames() {
  return [
    getDropdownOption('Idle'),
    getDropdownOption('Walk'),
    getDropdownOption('Run'),
    getDropdownOption('Wave'),
    getDropdownOption('Yes'),
    getDropdownOption('No'),
    getDropdownOption('Duck'),
    getDropdownOption('Fall'),
    getDropdownOption('Fly'),
    getDropdownOption('Swim'),
    getDropdownOption('Tread_Water'),
    getDropdownOption('Jump'),
    getDropdownOption('JumpUp'),
    getDropdownOption('JumpIdle'),
    getDropdownOption('JumpLand'),
    getDropdownOption('Flip'),
    getDropdownOption('Dance1'),
    getDropdownOption('Dance2'),
    getDropdownOption('Dance3'),
    getDropdownOption('Dance4'),
    getDropdownOption('Angry'),
    getDropdownOption('Punch'),
    getDropdownOption('HitReact'),
    getDropdownOption('Idle_Hold'),
    getDropdownOption('Walk_Hold'),
    getDropdownOption('Run_Hold'),
    getDropdownOption('Sit_Down'),
    getDropdownOption('Sitting'),
    getDropdownOption('Stand_Up'),
    getDropdownOption('Wobble'),
    getDropdownOption('Clap'),
    getDropdownOption('Climb_rope'),
  ];
}

export const materialNames = [
  'none.png',
  'arrows.png',
  'bricks.png',
  'carbonfibre.png',
  'carpet.png',
  'circles.png',
  'clouds.png',
  'eyeball.png',
  'fabric.png',
  'fishes.png',
  'fish_above.png',
  'flowers.png',
  'flower_tile.png',
  'flower_clumps.png',
  'fruit.png',
  'grass.png',
  'grass_clumps.png',
  'gravel.png',
  'Grid.png',
  'hedge.png',
  'jigsaw.png',
  'leaves.png',
  'marble.png',
  'mosaic.png',
  'mushroom.png',
  'planks.png',
  'road.png',
  'rough.png',
  'shapes.png',
  'squares.png',
  'splatters.png',
  'stars.png',
  'stripes.png',
  'swirl.png',
  'tiles.png',
  'triangles.png',
  'wiggles.png',
  'windmill.png',
  'wood.png',
  'gridxy.png',
];

export const TEXTURE_TILE_SIZE = 4;

export const NUMBER_RANGES = Object.freeze({
  unit: Object.freeze({ min: 0, max: 1, step: 0.05 }),
  soundSpeed: Object.freeze({ min: 0.1, max: 3, step: 0.1 }),
  envelope: Object.freeze({ min: 0, max: 5, step: 0.05 }),
  release: Object.freeze({ min: 0, max: 10, step: 0.05 }),
  effectRate: Object.freeze({ min: 0.1, max: 20, step: 0.1 }),
  midiNote: Object.freeze({ min: 0, max: 127, step: 1 }),
  speechPitch: Object.freeze({ min: 0, max: 2, step: 0.1 }),
  angle: Object.freeze({ min: 0, max: 360, step: 1, wrap: true }),
  particleAngle: Object.freeze({ min: 0, max: 359, step: 1, clamp: false }),
  speechRate: Object.freeze({ min: 0.1, max: 10, step: 0.1 }),
  sides: Object.freeze({ min: 3, max: 64, step: 1 }),
  particleRate: Object.freeze({ min: 0, max: 500, step: 1 }),
  microbitChannel: Object.freeze({ min: 0, max: 255, step: 1 }),
  nonNegative: Object.freeze({ min: 0, max: Infinity, slider: false }),
  fontSize: Object.freeze({ min: 1, max: Infinity, slider: false }),
  modelScale: Object.freeze({ min: 0.01, max: 100, slider: false }),
  cameraDistance: Object.freeze({ min: 0.5, max: 5000, slider: false }),
});

export const RANGED_INPUTS = Object.freeze({
  'set_alpha.ALPHA': 'unit',
  'material.ALPHA': 'unit',
  'gradient_texture_material.ALPHA': 'unit',
  'gradient_texture_material.NOISE': 'unit',
  'gradient_material.ALPHA': 'unit',
  'say.ALPHA': 'unit',
  'ui_text.ALPHA': 'unit',
  'on_screen_controls.ALPHA': 'unit',
  'set_vr_comfort.ALPHA': 'unit',
  'create_particle_effect.START_ALPHA': 'unit',
  'create_particle_effect.END_ALPHA': 'unit',
  'play_sound.VOLUME': 'unit',
  'play_theme.VOLUME': 'unit',
  'speak.VOLUME': 'unit',
  'create_instrument.VOLUME': 'unit',
  'create_instrument.SUSTAIN': 'unit',
  'create_instrument.EFFECT_DEPTH': 'unit',
  'create_instrument.EFFECT_RATE': 'effectRate',
  'create_instrument.ATTACK': 'envelope',
  'create_instrument.DECAY': 'envelope',
  'create_instrument.RELEASE': 'release',
  'note.PITCH': 'midiNote',
  'speak.PITCH': 'speechPitch',
  'gradient_colour.DIRECTION': 'angle',
  'gradient_texture_material.DIRECTION': 'angle',
  'material.ANGLE': 'angle',
  'create_particle_effect.MIN_INITIAL_ROTATION': 'particleAngle',
  'create_particle_effect.MAX_INITIAL_ROTATION': 'particleAngle',
  'set_bounciness.BOUNCINESS': 'unit',
  'create_wedge.PEAK': 'unit',
  'set_fog.DENSITY': 'unit',
  'play_sound.SPEED': 'soundSpeed',
  'play_theme.SPEED': 'soundSpeed',
  'speak.RATE': 'speechRate',
  'create_cylinder.TESSELLATIONS': 'sides',
  'create_donut.SIDES': 'sides',
  'create_ring.SIDES': 'sides',
  'create_particle_effect.RATE': 'particleRate',
  'add_microbit.CHANNEL': 'microbitChannel',
  'load_model.SCALE': 'modelScale',
  'load_object.SCALE': 'modelScale',
  'load_multi_object.SCALE': 'modelScale',
  'load_character.SCALE': 'modelScale',
  'say.SIZE': 'fontSize',
  'ui_text.FONT_SIZE': 'fontSize',
  'ui_input.TEXT_SIZE': 'fontSize',
  'text_material.TEXT_SIZE': 'fontSize',
  'glide_to.DURATION': 'nonNegative',
  'glide_to_seconds.DURATION': 'nonNegative',
  'glide_to_object.DURATION': 'nonNegative',
  'glide_to_axis.DURATION': 'nonNegative',
  'rotate_anim.DURATION': 'nonNegative',
  'rotate_anim_seconds.DURATION': 'nonNegative',
  'rotate_to_object.DURATION': 'nonNegative',
  'animate_property.DURATION': 'nonNegative',
  'colour_keyframe.DURATION': 'nonNegative',
  'number_keyframe.DURATION': 'nonNegative',
  'xyz_keyframe.DURATION': 'nonNegative',
  'animate_from.TIME': 'nonNegative',
  'wait.DURATION': 'nonNegative',
  'wait_seconds.DURATION': 'nonNegative',
  'note.DURATION': 'nonNegative',
  'print_text.DURATION': 'nonNegative',
  'subtitle.DURATION': 'nonNegative',
  'say.DURATION': 'nonNegative',
  'ui_text.DURATION': 'nonNegative',
  'controller_rumble.DURATION': 'nonNegative',
  'create_box.WIDTH': 'nonNegative',
  'create_box.HEIGHT': 'nonNegative',
  'create_box.DEPTH': 'nonNegative',
  'create_sphere.DIAMETER_X': 'nonNegative',
  'create_sphere.DIAMETER_Y': 'nonNegative',
  'create_sphere.DIAMETER_Z': 'nonNegative',
  'create_cylinder.HEIGHT': 'nonNegative',
  'create_cylinder.DIAMETER_TOP': 'nonNegative',
  'create_cylinder.DIAMETER_BOTTOM': 'nonNegative',
  'create_capsule.DIAMETER': 'nonNegative',
  'create_capsule.HEIGHT': 'nonNegative',
  'create_wedge.WIDTH': 'nonNegative',
  'create_wedge.HEIGHT': 'nonNegative',
  'create_wedge.DEPTH': 'nonNegative',
  'create_donut.DIAMETER': 'nonNegative',
  'create_donut.INNER_DIAMETER': 'nonNegative',
  'create_donut.THICKNESS': 'nonNegative',
  'create_ring.DIAMETER': 'nonNegative',
  'create_ring.INNER_DIAMETER': 'nonNegative',
  'create_ring.THICKNESS': 'nonNegative',
  'create_ring.HEIGHT': 'nonNegative',
  'create_plane.WIDTH': 'nonNegative',
  'create_plane.HEIGHT': 'nonNegative',
  'create_freeform.RADIUS': 'nonNegative',
  'create_3d_text.SIZE': 'nonNegative',
  'create_3d_text.DEPTH': 'nonNegative',
  'text_material.WIDTH': 'nonNegative',
  'text_material.HEIGHT': 'nonNegative',
  'scale.X': 'nonNegative',
  'scale.Y': 'nonNegative',
  'scale.Z': 'nonNegative',
  'resize.X': 'nonNegative',
  'resize.Y': 'nonNegative',
  'resize.Z': 'nonNegative',
  'load_character.SIZE_X': 'nonNegative',
  'load_character.SIZE_Y': 'nonNegative',
  'load_character.SIZE_Z': 'nonNegative',
  'load_object.SIZE_X': 'nonNegative',
  'load_object.SIZE_Y': 'nonNegative',
  'load_object.SIZE_Z': 'nonNegative',
  'load_multi_object.SIZE_X': 'nonNegative',
  'load_multi_object.SIZE_Y': 'nonNegative',
  'load_multi_object.SIZE_Z': 'nonNegative',
  'load_model.SIZE_X': 'nonNegative',
  'load_model.SIZE_Y': 'nonNegative',
  'load_model.SIZE_Z': 'nonNegative',
  'clone_mesh.SIZE_X': 'nonNegative',
  'clone_mesh.SIZE_Y': 'nonNegative',
  'clone_mesh.SIZE_Z': 'nonNegative',
  'set_mass.MASS': 'nonNegative',
  'jump.JUMP_HEIGHT': 'nonNegative',
  'main_light.INTENSITY': 'nonNegative',
  'set_fog.START': 'nonNegative',
  'set_fog.END': 'nonNegative',
  'camera_follow.RADIUS': 'cameraDistance',
  'create_follow_camera.DISTANCE': 'cameraDistance',
  'create_orbit_camera.DISTANCE': 'cameraDistance',
  'create_particle_effect.MIN_SIZE': 'nonNegative',
  'create_particle_effect.MAX_SIZE': 'nonNegative',
  'create_particle_effect.MIN_LIFETIME': 'nonNegative',
  'create_particle_effect.MAX_LIFETIME': 'nonNegative',
  'controls_repeat_ext.TIMES': 'nonNegative',
});

export function rangeForInput(blockType, inputName) {
  return NUMBER_RANGES[RANGED_INPUTS[`${blockType}.${inputName}`]] ?? null;
}

export function clampToRange(value, rangeName) {
  const { min, max } = NUMBER_RANGES[rangeName];
  return Math.min(max, Math.max(min, value));
}

export const attachNames = [
  'LeftHand',
  'RightHand',
  'Head',
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
];

export const AUTOSAVE_KEY = 'flock_autosave.flock';

export const FLOCK_FORMAT_VERSION = '2.0.0';

// Feature flag for autosaving to the last explicitly-saved file. localStorage
// autosave is unaffected by this flag.
export const AUTOSAVE_TO_FILE_ENABLED = false;

// project= URLs are auto-fetched and their contents auto-executed as code,
// so anything outside this list needs explicit user consent first.
const TRUSTED_PROJECT_URL_PREFIXES = [
  'https://github.com/flipcomputing/flockxr-projects',
  'https://raw.githubusercontent.com/flipcomputing/flockxr-projects',
];

// The domain itself and every subdomain.
const TRUSTED_PROJECT_DOMAINS = ['flockxr.com'];

function isTrustedProjectDomain(url) {
  if (url.protocol !== 'https:' || url.port !== '') return false;
  return TRUSTED_PROJECT_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  );
}

export function isTrustedProjectUrl(url, editorOrigin = window.location.origin) {
  if (url.origin === editorOrigin) return true;
  if (isTrustedProjectDomain(url)) return true;
  return TRUSTED_PROJECT_URL_PREFIXES.some((prefix) => {
    const boundary = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return url.href === prefix || url.href.startsWith(boundary);
  });
}

const mixamoLeftHandSocket = {
  bone: 'mixamorig:RightHand',
  origin: ['mixamorig:RightHand', 'mixamorig:RightHandMiddle1'],
  rotation: [-7, -12, 76],
};

export const attachSockets = {
  block: {
    LeftHand: { bone: 'Hold' },
    Hold: { bone: 'Hold' },
    Head: { bone: 'Head', restOnBase: true },
  },
  // Mixamo bone names are from the character's own perspective, but GLTF
  // import mirrors the model, so left/right are swapped from the viewer's
  // perspective. LeftHand (viewer's left) maps to mixamorig:RightHand, etc.
  mixamo: {
    LeftHand: mixamoLeftHandSocket,
    Hold: mixamoLeftHandSocket,
    RightHand: {
      bone: 'mixamorig:LeftHand',
      origin: ['mixamorig:LeftHand', 'mixamorig:LeftHandMiddle1'],
      rotation: [17, 113, -98],
    },
    Head: {
      bone: 'mixamorig:Head',
      origin: 'mixamorig:HeadTop_End',
      restOnBase: true,
    },
    Hips: { bone: 'mixamorig:Hips' },
    Spine: { bone: 'mixamorig:Spine' },
    Spine1: { bone: 'mixamorig:Spine1' },
    Spine2: { bone: 'mixamorig:Spine2' },
    Neck: { bone: 'mixamorig:Neck' },
    LeftShoulder: { bone: 'mixamorig:RightShoulder' },
    LeftArm: { bone: 'mixamorig:RightArm', rotation: [-22, 23, 66] },
    LeftForeArm: { bone: 'mixamorig:RightForeArm', rotation: [-9, 3, 68] },
    RightShoulder: { bone: 'mixamorig:LeftShoulder' },
    RightArm: { bone: 'mixamorig:LeftArm', rotation: [-1, 57, -56] },
    RightForeArm: { bone: 'mixamorig:LeftForeArm', rotation: [-4, 122, -55] },
    LeftUpLeg: { bone: 'mixamorig:RightUpLeg' },
    LeftLeg: { bone: 'mixamorig:RightLeg' },
    LeftFoot: { bone: 'mixamorig:RightFoot' },
    RightUpLeg: { bone: 'mixamorig:LeftUpLeg' },
    RightLeg: { bone: 'mixamorig:LeftLeg' },
    RightFoot: { bone: 'mixamorig:LeftFoot' },
  },
};

export function getAttachNames() {
  return attachNames.map((name) => getDropdownOption(name));
}
