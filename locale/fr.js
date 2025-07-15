

export default {
  // Blockly category message keys for custom categories
  CATEGORY_SCENE: "Scène",
  CATEGORY_MESHES: "Maillages",
  CATEGORY_XR: "RX", 
  CATEGORY_EFFECTS: "Effets",
  CATEGORY_CAMERA: "Caméra",
  CATEGORY_EVENTS: "Événements",
  CATEGORY_TRANSFORM: "Transformation",
  CATEGORY_PHYSICS: "Physique",
  CATEGORY_CONNECT: "Connecter",
  CATEGORY_COMBINE: "Combiner",
  CATEGORY_ANIMATE: "Animer",
  CATEGORY_KEYFRAME: "Image clé",
  CATEGORY_CONTROL: "Contrôle",
  CATEGORY_CONDITION: "Condition",
  CATEGORY_SENSING: "Détection",
  CATEGORY_TEXT: "Texte",
  CATEGORY_STRINGS: "Chaînes",
  CATEGORY_MATERIALS: "Matériaux", 
  CATEGORY_SOUND: "Son",
  CATEGORY_VARIABLES: "Variables",
  CATEGORY_LISTS: "Listes",
  CATEGORY_MATH: "Mathématiques",
  CATEGORY_FUNCTIONS: "Fonctions",
  CATEGORY_SNIPPETS: "Extraits",

  // Custom block translations - Scene blocks
  set_sky_color: "ciel %1",
  create_ground: "sol %1",
  set_background_color: "définir la couleur d'arrière-plan %1",
  create_map: "carte %1 avec matériau %2",
  show: "afficher %1",
  hide: "cacher %1",
  dispose: "supprimer %1",
  clone_mesh: "ajouter %1 clone de %2",

  // Custom block translations - Models blocks
  load_character: `ajouter %1 %2 échelle: %3 x: %4 y: %5 z: %6
					Cheveux: %7 |  Peau: %8 |  Yeux: %9 |  T-Shirt: %10 |  Shorts: %11 |  Détail: %12`,
  load_object: "ajouter %1 %2 %3 échelle: %4 x: %5 y: %6 z: %7",
  load_multi_object: "ajouter %1 %2 échelle: %3 x: %4 y: %5 z: %6\ncouleurs: %7",
  load_model: "ajouter %1 %2 échelle:: %3 x: %4 y: %5 z: %6",

  // Custom block translations - Animate blocks
  glide_to: "glisser %1 vers x %2 y %3 z %4 en %5 ms\n%6 retour? %7 boucle? %8 %9",
  glide_to_seconds: "glisser %1 vers x %2 y %3 z %4 en %5 secondes \n%6 retour? %7 boucle? %8 %9",
  rotate_anim: "tourner %1 vers x %2 y %3 z %4 en %5 ms\n%6 inverse? %7 boucle? %8 %9",
  rotate_anim_seconds: "tourner %1 vers x %2 y %3 z %4 en %5 secondes\n%6 inverse? %7 boucle? %8 %9",
  animate_property: "animer %1 %2 vers %3 en %4 ms inverse? %5 boucle? %6 %7",
  colour_keyframe: "à %1 couleur: %2",
  number_keyframe: "à : %1 valeur: %2",
  xyz_keyframe: "à : %1 x: %2 y: %3 z: %4",
  animate_keyframes: "animer les images clés sur %1 propriété %2\nimages clés %3\naccélération %4 boucle %5 inverse %6 %7",
  animation: "animer les images clés sur %1 propriété %2 groupe %3\nimages clés %4\naccélération %5 boucle %6 inverse %7 mode %8",
  control_animation_group: "groupe d'animation %1 %2",
  animate_from: "animer le groupe %1 depuis %2 secondes",
  stop_animations: "arrêter les animations %1",
  switch_animation: "changer l'animation de %1 vers %2",
  play_animation: "lancer l'animation %1 sur %2",

  // Custom block translations - Base blocks
  xyz: "x: %1 y: %2 z: %3",

  // Custom block translations - Camera blocks
  camera_control: "caméra %1 %2",
  camera_follow: "caméra suivre %1 avec un rayon de %2 devant %3",
  get_camera: "obtenir la caméra comme %1",

  // Custom block translations - Combine blocks
  merge_meshes: "ajouter %1 en tant que fusion de %2",
  subtract_meshes: "ajouter %1 en tant que %2 moins %3",
  intersection_meshes: "ajouter %1 en tant qu’intersection de %2",
  hull_meshes: "ajouter %1 en tant qu’enveloppe de %2",

  // Custom block translations - Connect blocks
  parent: "parent %1 enfant %2",
  parent_child: "parent %1 enfant %2\ndécalage x : %3 y : %4 z : %5",
  remove_parent: "retirer le parent de %1",
  stop_follow: "arrêter de suivre %1",
  hold: "faire en sorte que %1 tienne %2\ndécalage x : %3 y : %4 z : %5",
  drop: "lâcher %1",
  follow: "faire en sorte que %1 suive %2 à %3\ndécalage x : %4 y : %5 z : %6",
  export_mesh: "exporter %1 comme %2",

  // Custom block translations - Control blocks
  wait: "attendre %1 ms",
  wait_seconds: "attendre %1 secondes",
  wait_until: "attendre jusqu’à ce que %1",
  local_variable: "variable locale %1",
  for_loop2: "pour chaque %1 de %2 à %3 par %4 faire %5",
  for_loop: "pour chaque %1 de %2 à %3 par %4 faire %5",
  get_lexical_variable: "%1",

  // Custom block translations - Effects blocks
  light_intensity: "régler l'intensité de la lumière à %1",
  set_fog: "définir la couleur du brouillard %1 mode %2 densité %3",

  // Custom block translation - Events blocks
  start: "démarrer",
  forever: "toujours\n%1",
  when_clicked: "quand %1 %2",
  on_collision: "lors de la collision de %1 avec %2 %3",
  when_key_event: "quand la touche %1 %2",
  broadcast_event: "diffuser l’événement %1",
  on_event: "lors de l’événement %1",

  // Custom block translations - Materials blocks
  change_color: "changer la couleur de %1 en %2",
  change_material: "appliquer le matériau %1 à %2 avec la couleur %3",
  text_material: "matériau %1 texte %2 couleur %3 fond %4\nlargeur %5 hauteur %6 taille %7",
  place_decal: "décalcomanie %1 angle %2",
  decal: "décalcomanie sur %1 depuis x %2 y %3 z %4\nangle x %5 y %6 z %7\ntaille x %8 y %9 z %10 matériau %11",
  highlight: "surligner %1 %2",
  glow: "illuminer %1",
  tint: "teinter %1 %2",
  set_alpha: "régler l'opacité de %1 à %2",
  clear_effects: "effacer les effets de %1",
  colour: "%1",
  skin_colour: "%1",
  greyscale_colour: "%1",
  colour_from_string: "- %1 -",
  random_colour: "couleur aléatoire",
  material: "matériau %1 %2 opacité %3",
  gradient_material: "matériau %1 opacité %2",
  set_material: "définir le matériau de %1 à %2",

  // Custom block translations - Physics blocks
  add_physics: "ajouter physique %1 type %2",
  add_physics_shape: "ajouter forme physique %1 type %2",
  apply_force: "appliquer force à %1 x: %2 y: %3 z: %4",

  // Custom block translations - Sensing blocks
  key_pressed: "touche pressée est %1",
  meshes_touching: "%1 touche %2",
  time: "temps en s",
  distance_to: "distance de %1 à %2",
  touching_surface: "%1 touche la surface",
  get_property: "obtenir %1 de %2",
  canvas_controls: "contrôles de la toile %1",
  button_controls: "contrôles du bouton %1 activé %2 couleur %3",
  microbit_input: "lors de l'événement micro:bit %1",
  ui_slider: "curseur UI %1 de %2 à %3 par défaut %4 à x: %5 y: %6\ncouleur: %7 fond: %8 %9",

  // Custom block translations - Shapes blocks
  create_particle_effect: "ajouter effet de particules %1 sur : %2\nforme : %3 début %4 fin %5 opacité : %6 à %7\nfréquence : %8 taille : %9 à %10 durée de vie : %11 à %12\ngravité : %13 force x : %14 y : %15 z : %16\nvitesse angulaire : %17 à %18 angle initial : %19 à %20",
  control_particle_system: "système de particules %1 %2",
  create_box: "ajouter boîte %1 %2 largeur %3 hauteur %4 profondeur %5\nà x %6 y %7 z %8",
  create_sphere: "ajouter sphère %1 %2 diamètre x %3 diamètre y %4 diamètre z %5\nà x %6 y %7 z %8",
  create_cylinder: "ajouter cylindre %1 %2 hauteur %3 haut %4 bas %5 côtés %6\nà x %7 y %8 z %9",
  create_capsule: "ajouter capsule %1 %2 diamètre %3 hauteur %4\nà x %5 y %6 z %7",
  create_plane: "ajouter plan %1 %2 largeur %3 hauteur %4\nà x %5 y %6 z %7",

  // Custom block translations - Sound blocks
  play_sound: "jouer le son %1 %2 depuis %3\nvitesse %4 volume %5 mode %6 asynchrone %7",
  stop_all_sounds: "arrêter tous les sons",
  midi_note: "note MIDI %1",
  rest: "pause",
  play_notes: "jouer notes sur %1\nnotes %2 durées %3\ninstrument %4 mode %5",
  set_scene_bpm: "régler le BPM de la scène à %1",
  set_mesh_bpm: "régler le BPM de %1 à %2",
  create_instrument: "instrument %1 onde %2 fréquence %3 attaque %4 décroissance %5 maintien %6 relâchement %7",
  instrument: "instrument %1",
  speak: "parler %1 %2 voix %3 langue %4\nvitesse %5 hauteur %6 volume %7 mode %8",

  // Custom block translations - Text blocks
  comment: "// %1",
  print_text: "afficher %1 pendant %2 secondes %3",
  say: "dire %1 pendant %2 s %3\ntexte %4 sur %5 opacité %6 taille %7 %8 %9",
  ui_text: "texte UI %1 %2 à x: %3 y: %4\ntaille: %5 pendant %6 secondes couleur: %7",
  ui_button: "bouton UI %1 %2 à x: %3 y: %4\ntaille: %5 taille du texte: %6 couleur du texte: %7 couleur de fond: %8",
  ui_input: "champ de saisie UI %1 %2 à x: %3 y: %4\ntaille: %5 taille du texte: %6 texte: %7 fond: %8",
  create_3d_text: "ajouter texte 3D %1 : %2 police : %3 taille : %4 couleur : %5\nprofondeur : %6 x : %7 y : %8 z : %9",

  // Custom block translations - Transform blocks
  move_by_xyz: "déplacer %1 de x : %2 y : %3 z : %4",
  move_to_xyz: "déplacer %1 à x : %2 y : %3 z : %4 y ? %5",
  move_to: "déplacer %1 vers %2 y ? %3",
  scale: "échelle %1 x : %2 y : %3 z : %4\norigine x : %5 y : %6 z : %7",
  resize: "redimensionner %1 x : %2 y : %3 z : %4\norigine x : %5 y : %6 z : %7",
  rotate_model_xyz: "pivoter %1 de x : %2 y : %3 z : %4",
  rotate_to: "pivoter %1 vers x : %2 y : %3 z : %4",
  look_at: "regarder %1 vers %2 y ? %3",
  move_forward: "avancer %1 %2 vitesse %3",
  set_pivot: "définir le pivot de %1 x : %2 y : %3 z : %4",
  min_centre_max: "%1",

  // Custom block translations - XR blocks
  device_camera_background: "utiliser la caméra %1 comme arrière-plan",
  set_xr_mode: "définir le mode XR sur %1",

  // Blockly message overrides for French
  LISTS_CREATE_WITH_INPUT_WITH: "liste",
  TEXT_JOIN_TITLE_CREATEWITH: "texte",
  CONTROLS_REPEAT_INPUT_DO: "",
  CONTROLS_WHILEUNTIL_INPUT_DO: "",
  CONTROLS_FOR_INPUT_DO: "",
  CONTROLS_FOREACH_INPUT_DO: "",
  CONTROLS_IF_MSG_THEN: "",
  CONTROLS_IF_MSG_ELSE: "sinon\n",
  CONTROLS_FOR_TITLE: "pour chaque %1 de %2 à %3 par %4",
  
  // Block message translations
  BLOCK_PRINT_TEXT_MESSAGE: "afficher %1 pendant %2 secondes %3",
  BLOCK_WAIT_SECONDS_MESSAGE: "attendre %1 secondes",
  BLOCK_KEY_PRESSED_MESSAGE: "touche %1 pressée?",
  BLOCK_MOVE_FORWARD_MESSAGE: "déplacer %1 vers l'avant de %2",
  BLOCK_CREATE_BOX_MESSAGE: "créer boîte %1 couleur %2 taille %3 × %4 × %5 à %6, %7, %8",
  
  // Add more custom block translations as needed
  
  // Tooltip translations - Scene blocks
  set_sky_color_tooltip: "Définir la couleur du ciel de la scène.\nMot-clé: sky",
  create_ground_tooltip: "Ajouter un plan de sol avec collisions activées à la scène.\nMot-clé: ground",
  set_background_color_tooltip: "Définir la couleur d'arrière-plan de la scène.\nMot-clé: background",
  create_map_tooltip: "Créer une carte avec le nom et le matériau sélectionnés.\nMot-clé: map",
  show_tooltip: "Afficher le maillage sélectionné.\nMot-clé: show",
  hide_tooltip: "Cacher le maillage sélectionné.\nMot-clé: hide",
  dispose_tooltip: "Supprimer le maillage spécifié de la scène.\nMot-clé: dispose",
  clone_mesh_tooltip: "Cloner un maillage et l'assigner à une variable.\nMot-clé: clone",
  
  // Tooltip translations - Models blocks
  load_character_tooltip: "Créer un personnage configurable.\nMot-clé: character",
  load_object_tooltip: "Créer un objet.\nMot-clé: object",
  load_multi_object_tooltip: "Créer un objet avec des couleurs.\nMot-clé: object",
  load_model_tooltip: "Charger un modèle.\nMot-clé: model",

  // Tooltip translations - Animate blocks
  glide_to_tooltip: "Glisser vers une position spécifiée sur une durée avec des options pour inverser, boucler et appliquer une accélération.",
  glide_to_seconds_tooltip: "Glisser vers une position spécifiée sur une durée avec des options pour inverser, boucler et appliquer une accélération.",
  rotate_anim_tooltip: "Faire pivoter une forme vers des angles spécifiés sur une durée avec des options pour inverser, boucler et appliquer une accélération.",
  rotate_anim_seconds_tooltip: "Faire pivoter une forme vers des angles spécifiés sur une durée avec des options pour inverser, boucler et appliquer une accélération.",
  animate_property_tooltip: "Animer une propriété de matériau de la forme et de ses enfants.",
  colour_keyframe_tooltip: "Définir une couleur et une durée pour une image clé.",
  number_keyframe_tooltip: "Définir un nombre et une durée pour une image clé.",
  xyz_keyframe_tooltip: "Définir une image clé XYZ avec durée.",
  animate_keyframes_tooltip: "Animer un ensemble d'images clés sur la forme sélectionnée, avec accélération, boucle et inversion optionnelles.",
  animation_tooltip: "Créer un groupe d'animation pour la forme et la propriété sélectionnées, avec des images clés, une accélération, et des options pour boucler et inverser. Choisissez créer, démarrer ou attendre pour contrôler le comportement.",
  control_animation_group_tooltip: "Contrôler le groupe d'animation en le lançant, en le mettant en pause ou en l'arrêtant.",
  animate_from_tooltip: "Commencer à animer le groupe depuis le temps spécifié (en secondes).",
  stop_animations_tooltip: "Arrêter toutes les animations d'images clés sur la forme sélectionnée.\nMot-clé: stop",
  switch_animation_tooltip: "Changer l'animation de la forme spécifiée vers l'animation donnée.\nMot-clé: switch",
  play_animation_tooltip: "Lancer l'animation sélectionnée une fois sur la forme spécifiée.\nMot-clé: play",

  // Tooltip translations - Base blocks
  xyz_tooltip: "Crée un vecteur avec des coordonnées X, Y, Z",
  
  // Tooltip translations - Camera blocks
  camera_control_tooltip: "Associer une touche spécifique à une action de contrôle de la caméra.",
  camera_follow_tooltip: "Faire suivre un maillage par la caméra avec une distance (rayon) personnalisable par rapport à la cible.\nMot-clé: follow",
  get_camera_tooltip: "Obtenir la caméra actuelle de la scène",

  // Tooltip translations - Combine blocks
  merge_meshes_tooltip: "Fusionner une liste de maillages en un seul et stocker le résultat.\nMot-clé: merge",
  subtract_meshes_tooltip: "Soustraire une liste de maillages d’un maillage de base et stocker le résultat.\nMot-clé: subtract",
  intersection_meshes_tooltip: "Intersecter une liste de maillages et stocker la géométrie résultante.\nMot-clé: intersect",
  hull_meshes_tooltip: "Créer une enveloppe convexe à partir d’une liste de maillages et stocker le résultat.\nMot-clé: hull",

  // Tooltip translations - Connect blocks
  parent_tooltip: "Définit une relation parent-enfant entre deux maillages et maintient l'enfant dans sa position dans le monde\nMot-clé: parent",
  parent_child_tooltip: "Définit une relation parent-enfant entre deux maillages avec un décalage spécifié dans les directions x, y et z.\nMot-clé: child",
  remove_parent_tooltip: "Supprime la relation de parenté du maillage spécifié.\nMot-clé: unparent",
  stop_follow_tooltip: "Arrête le maillage spécifié de suivre un autre.\nMot-clé: stopfollow",
  hold_tooltip: "Attache un maillage à l’os spécifié d’un autre maillage avec un décalage défini en x, y et z.\nMot-clé: hold",
  drop_tooltip: "Détache un maillage de l’os auquel il est actuellement attaché.\nMot-clé: drop",
  follow_tooltip: "Fait en sorte qu’un maillage suive un autre à une position spécifiée (haut, centre ou bas) avec un décalage en x, y et z.\nMot-clé: follow",
  export_mesh_tooltip: "Exporte un maillage au format STL, OBJ ou GLB.\nMot-clé: export",

  // Tooltip translations - Control blocks
  wait_tooltip: "Attendre pendant un temps spécifié en millisecondes.\nMot-clé: milli",
  wait_seconds_tooltip: "Attendre pendant un temps spécifié en secondes.\nMot-clé: wait",
  wait_until_tooltip: "Attendre jusqu’à ce que la condition soit vraie.\nMot-clé: until",
  local_variable_tooltip: "Créer une version locale d'une variable sélectionnée. Cela masque la variable globale et peut avoir une valeur différente.\nMot-clé: local",
  for_loop2_tooltip: "Boucle d’un nombre de départ à un nombre de fin avec un pas donné.",
  for_loop_tooltip: "Boucle d’un nombre de départ à un nombre de fin avec un pas donné. Cliquez sur le menu déroulant pour obtenir la variable de boucle à utiliser dans votre code.\nMot-clé: for",
  get_lexical_variable_tooltip: "Obtenir la valeur d’une variable lexicale",

  // Tooltip translations - Effects blocks
  light_intensity_tooltip: "Définit l'intensité de la lumière principale.\nMot-clé: light intensity",
  set_fog_tooltip: "Configure le brouillard de la scène.\nMot-clé: fog",

  // Tooltip translations - Events blocks
  start_tooltip: "Exécute les blocs à l'intérieur au démarrage du projet. Vous pouvez avoir plusieurs blocs de démarrage.\nMot-clé: start",
  forever_tooltip: "Exécute les blocs à chaque image ou lorsque l’itération précédente se termine.\nMot-clé: forever",
  when_clicked_tooltip: "Exécute les blocs à l’intérieur lorsque le déclencheur du maillage se produit.\nMot-clé: click",
  on_collision_tooltip: "Exécute les blocs à l’intérieur lorsque le maillage entre ou sort en collision avec un autre maillage.\nMot-clé: collide",
  when_key_event_tooltip: "Exécute les blocs à l’intérieur lorsque la touche spécifiée est pressée ou relâchée.",
  broadcast_event_tooltip: "Diffuse un événement qui est reçu par 'on event'.\nMot-clé: broadcast",
  on_event_tooltip: "Exécute le code lorsqu’un événement diffusé est reçu.\nMot-clé: on",

  // Tooltip translations - Materials blocks
  change_color_tooltip: "Change la couleur du maillage sélectionné.\nMot-clé: color",
  change_material_tooltip: "Applique un matériau sélectionné avec une teinte de couleur au maillage spécifié.\nMot-clé: material",
  text_material_tooltip: "Crée un matériau avec du texte ou un emoji, en spécifiant la largeur, la hauteur, la couleur de fond et la taille du texte.",
  place_decal_tooltip: "Place une décalcomanie sur un maillage à l’aide du matériau sélectionné.",
  decal_tooltip: "Crée une décalcomanie sur un maillage avec position, normale, taille et matériau.",
  highlight_tooltip: "Met en surbrillance le maillage sélectionné.\nMot-clé: highlight",
  glow_tooltip: "Ajoute un effet de lueur au maillage sélectionné.\nMot-clé: glow",
  tint_tooltip: "Ajoute un effet de teinte colorée.\nMot-clé: tint",
  set_alpha_tooltip: "Définit l'opacité (alpha) du ou des matériaux sur un maillage spécifié. Les valeurs doivent être entre 0 et 1.\nMot-clé: alpha",
  clear_effects_tooltip: "Efface les effets visuels du maillage sélectionné.\nMot-clé: clear",
  colour_tooltip: "Choisir une couleur.\nMot-clé: color",
  skin_colour_tooltip: "Choisir une couleur de peau.\nMot-clé: skin",
  greyscale_colour_tooltip: "Choisir une couleur en niveaux de gris pour l'élévation.\nMot-clé: grey",
  random_colour_tooltip: "Génère une couleur aléatoire.\nMot-clé: randcol",
  material_tooltip: "Définit les propriétés du matériau",
  gradient_material_tooltip: "Définit les propriétés du matériau",
  set_material_tooltip: "Définit le matériau spécifié sur le maillage donné.",

  // Tooltip translations - Physics blocks
  add_physics_tooltip: "Ajoute la physique au maillage. Les options sont dynamique, statique, animée et aucune.\nMot-clé: physics",
  add_physics_shape_tooltip: "Ajoute une forme physique au maillage. Les options sont maillage ou capsule.\nMot-clé: physics",
  apply_force_tooltip: "Applique une force à un maillage selon les directions X, Y et Z.\nMot-clé: force",

  // Tooltip translations - Sensing blocks
  key_pressed_tooltip: "Renvoie vrai si la touche spécifiée est enfoncée.\nMot-clé: ispressed",
  meshes_touching_tooltip: "Renvoie vrai si les deux maillages sélectionnés se touchent.\nMot-clé: istouching",
  time_tooltip: "Renvoie le temps actuel en secondes.",
  distance_to_tooltip: "Calcule la distance entre deux maillages.",
  touching_surface_tooltip: "Vérifie si le maillage touche une surface.\nMot-clé: surface",
  get_property_tooltip: "Obtient la valeur de la propriété sélectionnée d’un maillage.\nMot-clé: get",
  canvas_controls_tooltip: "Ajoute ou supprime les contrôles de mouvement de la toile.\nMot-clé: canvas",
  button_controls_tooltip: "Configure les contrôles par boutons.\nMot-clé: button",
  microbit_input_tooltip: "Exécute les blocs à l’intérieur lorsqu’un événement micro:bit spécifié est déclenché.",
  ui_slider_tooltip: "Ajoute un curseur UI 2D et stocke sa référence dans une variable.",

  // Tooltip translations - Shapes blocks
  create_particle_effect_tooltip: "Crée un effet de particules attaché à un maillage avec forme, gravité, taille, couleur, transparence, durée de vie, force et rotation configurables.",
  control_particle_system_tooltip: "Contrôle le système de particules en le démarrant, l’arrêtant ou le réinitialisant.",
  create_box_tooltip: "Crée une boîte colorée avec des dimensions et une position spécifiées.\nMot-clé: box",
  create_sphere_tooltip: "Crée une sphère colorée avec des dimensions et une position spécifiées.\nMot-clé: sphere",
  create_cylinder_tooltip: "Crée un cylindre coloré avec des dimensions et une position spécifiées.\nMot-clé: cylinder",
  create_capsule_tooltip: "Crée une capsule colorée avec des dimensions et une position spécifiées.\nMot-clé: capsule",
  create_plane_tooltip: "Crée un plan 2D coloré avec largeur, hauteur et position spécifiées.\nMot-clé: plane",

  // Tooltip translations - Sound blocks
  play_sound_tooltip: "Joue le son sélectionné sur un maillage avec vitesse, volume et mode réglables.\nMot-clé: sound",
  stop_all_sounds_tooltip: "Arrête tous les sons en cours de lecture dans la scène.\nMot-clé: nosound",
  midi_note_tooltip: "Une valeur de note MIDI comprise entre 0 et 127.",
  rest_tooltip: "Un silence (pause) dans une séquence musicale.",
  play_notes_tooltip: "Joue une séquence de notes MIDI et de silences avec des durées correspondantes, en utilisant un maillage pour le panoramique. Peut retourner immédiatement ou après la fin des notes.",
  set_scene_bpm_tooltip: "Définit le BPM pour toute la scène",
  set_mesh_bpm_tooltip: "Définit le BPM pour un maillage sélectionné",
  create_instrument_tooltip: "Crée un instrument et l’assigne à la variable sélectionnée.",
  instrument_tooltip: "Sélectionner un instrument pour jouer des notes.",
  speak_tooltip: "Convertit du texte en parole avec l’API Web Speech et un positionnement 3D optionnel.\nMot-clé: speak",

  // Tooltip translations - Text blocks
  comment_tooltip: "Une ligne de commentaire pour aider à comprendre le code.",
  print_text_tooltip: "Affiche un texte dans le panneau de sortie.\nMot-clé: print",
  say_tooltip: "Affiche un texte comme bulle de dialogue sur un maillage.\nMot-clé: say",
  ui_text_tooltip: "Ajoute un texte à l’interface utilisateur et stocke le contrôle dans une variable pour une utilisation ultérieure.",
  ui_button_tooltip: "Ajoute un bouton 2D à l’interface utilisateur avec une taille prédéfinie, et stocke le contrôle dans une variable pour une utilisation ultérieure.",
  ui_input_tooltip: "Pose une question à l’utilisateur et attend une réponse. Stocke le résultat dans une variable.",
  create_3d_text_tooltip: "Crée du texte 3D dans la scène.",

  // Tooltip translations - Transform blocks
  move_by_xyz_tooltip: "Déplace un maillage d'une certaine valeur selon X, Y et Z.\nMot-clé: move",
  move_to_xyz_tooltip: "Téléporte le maillage aux coordonnées données. Utilise l’axe Y en option.\nMot-clé: moveby",
  move_to_tooltip: "Téléporte le premier maillage à l’emplacement du second.\nMot-clé: moveto",
  scale_tooltip: "Redimensionne un maillage aux valeurs x, y, z données, et contrôle l’origine de l’échelle.\nMot-clé: scale",
  resize_tooltip: "Redimensionne un maillage aux valeurs x, y, z données, et contrôle l’origine de l’échelle.\nMot-clé: resize",
  rotate_model_xyz_tooltip: "Fait tourner le maillage selon les valeurs x, y, z.\nMot-clé: rotate\nMot-clé: rotateby",
  rotate_to_tooltip: "Fait tourner le maillage pour pointer vers les coordonnées.\nMot-clé: rotateto",
  look_at_tooltip: "Fait pivoter le premier maillage pour regarder vers la position du second.\nMot-clé: look",
  move_forward_tooltip: "Déplace le maillage dans la direction spécifiée. 'Forward' le fait avancer, 'sideways' le fait se déplacer par rapport à la caméra, 'strafe' le fait se déplacer latéralement.\nMot-clé: push",
  set_pivot_tooltip: "Définit le point de pivot d’un maillage selon les axes X, Y et Z\nMot-clé: pivot",
  min_centre_max_tooltip: "Choisit min, centre ou max comme point de pivot\nMot-clé: minmax",

  // Tooltip translations - XR blocks
  device_camera_background_tooltip: "Utilise la caméra de l’appareil comme arrière-plan pour la scène. Fonctionne sur mobile et ordinateur.",
  set_xr_mode_tooltip: "Définit le mode XR pour la scène.\nOptions: VR, AR, Magic Window.",

  // Dropdown option translations
  AWAIT_option: "attendre",
  START_option: "démarrer",
  CREATE_option: "créer",

  Linear_option: "Linéaire",
  SineEase_option: "Sine Facile",
  CubicEase_option: "Cubic Facile",
  QuadraticEase_option: "Quadratic Facile",
  ExponentialEase_option: "Exponential Facile",
  BounceEase_option: "Rebond Facile",
  ElasticEase_option: "Élastique Facile",
  BackEase_option: "Retour Facile",

  EASEIN_option: "accélération",
  EASEOUT_option: "décélération",
  EASEINOUT_option: "accélération-décélération",

  play_option: "▶️ Jouer",
  pause_option: "⏸️ Pause",
  stop_option: "⏹️ Arrêter",

  diffuseColor_option: "couleur diffuse",
  emissiveColor_option: "couleur émissive",
  ambientColor_option: "couleur ambiante",
  specularColor_option: "couleur spéculaire",
  alpha_option: "alpha",
  color_option: "couleur",
  position_option: "position",
  rotation_option: "rotation",
  scaling_option: "échelle",
  position_x_option: "position.x",
  position_y_option: "position.y",
  position_z_option: "position.z",
  rotation_x_option: "rotation.x",
  rotation_y_option: "rotation.y",
  rotation_z_option: "rotation.z",
  scaling_x_option: "échelle.x",
  scaling_y_option: "échelle.y",
  scaling_z_option: "échelle.z",

  rotateLeft_option: "Tourner à gauche",
  rotateRight_option: "Tourner à droite",
  rotateUp_option: "Regarder en haut",
  rotateDown_option: "Regarder en bas",
  moveUp_option: "Se déplacer vers le haut",
  moveDown_option: "Se déplacer vers le bas",
  moveLeft_option: "Se déplacer à gauche",
  moveRight_option: "Se déplacer à droite",

  _65_option: "A ◁",
  _68_option: "D",
  _87_option: "W",
  _83_option: "S",
  _81_option: "Q",
  _69_option: "E",
  _70_option: "F",
  _32_option: "Espace",
  _38_option: "Flèche haut",
  _40_option: "Flèche bas",
  _37_option: "Flèche gauche",
  _39_option: "Flèche droite",

  TOP_option: "haut",
  CENTER_option: "centre",
  BOTTOM_option: "bas",

  // HTML translations
  loading_ui: "French",
  demo_ui: "French Demo",
};
