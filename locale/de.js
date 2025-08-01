import common from "./commmonHTML.js"

export default {
  // Blockly category message keys for custom categories
  CATEGORY_SCENE: "Szene",
  CATEGORY_MESHES: "Meshes", 
  CATEGORY_XR: "XR",
  CATEGORY_EFFECTS: "Effekte",
  CATEGORY_CAMERA: "Kamera",
  CATEGORY_EVENTS: "Ereignisse",
  CATEGORY_TRANSFORM: "Transformieren",
  CATEGORY_PHYSICS: "Physik",
  CATEGORY_CONNECT: "Verbinden",
  CATEGORY_COMBINE: "Kombinieren",
  CATEGORY_ANIMATE: "Animieren",
  CATEGORY_KEYFRAME: "Schlüsselbild",
  CATEGORY_CONTROL: "Steuerung",
  CATEGORY_CONDITION: "Bedingung",
  CATEGORY_SENSING: "Erkennung",
  CATEGORY_TEXT: "Text",
  CATEGORY_STRINGS: "Zeichenketten", 
  CATEGORY_MATERIALS: "Materialien",
  CATEGORY_SOUND: "Ton",
  CATEGORY_VARIABLES: "Variablen",
  CATEGORY_LISTS: "Listen",
  CATEGORY_MATH: "Mathe",
  CATEGORY_FUNCTIONS: "Funktionen",
  CATEGORY_SNIPPETS: "Snippets",

  // Custom block translations - Scene blocks
  set_sky_color: "Himmel %1",
  create_ground: "Boden %1",
  set_background_color: "Hintergrundfarbe setzen %1",
  create_map: "Karte %1 mit Material %2",
  show: "zeige %1",
  hide: "verstecke %1",
  dispose: "%1 entfernen",
  clone_mesh: "füge %1 Klon von %2 hinzu",

  // Custom block translations - Models blocks
  load_character: "füge %1 %2 hinzu Skalierung: %3 x: %4 y: %5 z: %6\nHaare: %7 | Haut: %8 | Augen: %9 | T-Shirt: %10 | Shorts: %11 | Details: %12",
  load_object: "füge %1 %2 %3 hinzu Skalierung: %4 x: %5 y: %6 z: %7",
  load_multi_object: "füge %1 %2 hinzu Skalierung: %3 x: %4 y: %5 z: %6\nFarben: %7",
  load_model: "füge %1 %2 hinzu Skalierung: %3 x: %4 y: %5 z: %6",

  // Custom block translations - Animate blocks
  glide_to: "%1 gleitet zu x %2 y %3 z %4 in %5 ms\n%6 zurück? %7 Schleife? %8 %9",
  glide_to_seconds: "%1 gleitet zu x %2 y %3 z %4 in %5 Sekunden\n%6 zurück? %7 Schleife? %8 %9",
  rotate_anim: "rotiere %1 zu x %2 y %3 z %4 in %5 ms\n%6 rückwärts? %7 Schleife? %8 %9",
  rotate_anim_seconds: "rotiere %1 zu x %2 y %3 z %4 in %5 Sekunden\n%6 rückwärts? %7 Schleife? %8 %9",
  animate_property: "animieren %1 %2 zu %3 in %4 ms rückwärts? %5 Schleife? %6 %7",
  colour_keyframe: "bei %1 Farbe: %2",
  number_keyframe: "bei %1 Wert: %2",
  xyz_keyframe: "bei %1 x: %2 y: %3 z: %4",
  animate_keyframes: "animieren Schlüsselbilder von %1 Eigenschaft %2\nKeyframes %3\nEasing %4 Schleife %5 Rückwärts %6 %7",
  animation: "animieren Schlüsselbilder von %1 Eigenschaft %2 Gruppe %3\nKeyframes %4\nEasing %5 Schleife %6 Rückwärts %7 Modus %8",
  control_animation_group: "Animationsgruppe %1 %2",
  animate_from: "animieren Gruppe %1 ab %2 Sekunden",
  stop_animations: "Animationen stoppen %1",
  switch_animation: "Animation von %1 zu %2 wechseln",
  play_animation: "Animation %1 auf %2 abspielen",

  // Custom block translations - Base blocks
  xyz: "x: %1 y: %2 z: %3",

  // Custom block translations - Camera blocks
  camera_control: "Kamera %1 %2",
  camera_follow: "Kamera folgt %1 mit Radius %2 vorne %3",
  get_camera: "Kamera als %1 holen",

  // Custom block translations - Combine blocks
  merge_meshes: "füge %1 als Vereinigung von %2 hinzu",
  subtract_meshes: "füge %1 als %2 minus %3 hinzu",
  intersection_meshes: "füge %1 als Schnitt von %2 hinzu",
  hull_meshes: "füge %1 als Hülle von %2 hinzu",

  // Custom block translations - Connect blocks
  parent: "Elternteil %1 Kind %2",
  parent_child: "Elternteil %1 Kind %2\nOffset x: %3 y: %4 z: %5",
  remove_parent: "Elternteil von %1 entfernen",
  stop_follow: "Folgen von %1 beenden",
  hold: "%1 hält %2\nOffset x: %3 y: %4 z: %5",
  drop: "%1 fallen lassen",
  follow: "mache, dass %1 %2 bei %3 folgt\nOffset x: %4 y: %5 z: %6",
  export_mesh: "%1 als %2 exportieren",
  attach: "befestige %1 an %2 bei %3\nOffset x: %4 y: %5 z: %6",

  // Custom block translations - Control blocks
  wait: "warte %1 ms",
  wait_seconds: "warte %1 Sekunden",
  wait_until: "warte bis %1",
  local_variable: "lokal %1",
  for_loop2: "für %1 von %2 bis %3 mit Schritt %4 dann %5",
  for_loop: "für %1 von %2 bis %3 mit Schritt %4 dann %5",
  get_lexical_variable: "%1",

  // Custom block translations - Effects blocks
  light_intensity: "Lichtintensität auf %1 setzen",
  set_fog: "Nebel setzen Farbe %1 Modus %2 Dichte %3",

  // Custom block translation - Events blocks
  start: "start",
  forever: "für immer\n%1",
  when_clicked: "wenn %1 %2",
  on_collision: "bei Kollision von %1 %2 %3",
  when_key_event: "wenn Taste %1 %2",
  broadcast_event: "Ereignis %1 senden",
  on_event: "bei Ereignis %1",

  // Custom block translations - Materials blocks
  change_color: "Farbe %1 auf %2 setzen",
  change_material: "Material %1 auf %2 anwenden mit Farbe %3",
  text_material: "Material %1 Text %2 Farbe %3 Hintergrund %4\nBreite %5 Höhe %6 Größe %7",
  place_decal: "Aufkleber %1 Winkel %2",
  decal: "Aufkleber auf %1 von x %2 y %3 z %4 \nWinkel x %5 y %6 z %7\nGröße x %8 y %9 z %10 Material %11",
  highlight: "hervorheben %1 %2",
  glow: "leuchten %1",
  tint: "tönen %1 %2",
  set_alpha: "Alpha von %1 auf %2 setzen",
  clear_effects: "Effekte von %1 entfernen",
  colour: "%1",
  skin_colour: "%1",
  greyscale_colour: "%1",
  colour_from_string: "- %1 -",
  random_colour: "Zufallsfarbe",
  material: "Material %1 %2 Alpha %3",
  gradient_material: "Material %1 Alpha %2",
  set_material: "Material von %1 auf %2 setzen",

  // Physics blocks
  add_physics: "Physik hinzufügen %1 Typ %2",
  add_physics_shape: "Physikform hinzufügen %1 Typ %2",
  apply_force: "Kraft auf %1 anwenden x: %2 y: %3 z: %4",

  // Sensing blocks
  key_pressed: "Taste gedrückt? %1",
  meshes_touching: "%1 berührt %2",
  time: "Zeit in s",
  distance_to: "Entfernung von %1 nach %2",
  touching_surface: "Berührt %1 eine Oberfläche",
  get_property: "Hole %1 von %2",
  canvas_controls: "Leinwandsteuerung %1",
  button_controls: "Buttonsteuerung %1 aktiviert %2 Farbe %3",
  microbit_input: "wenn micro:bit-Ereignis %1",
  ui_slider: "UI-Regler %1 von %2 bis %3 Standard %4 bei x: %5 y: %6\nFarbe: %7 Hintergrund: %8 %9",

  // Shapes blocks
  create_particle_effect: "Füge Partikeleffekt %1 hinzu auf: %2\nForm: %3 Start: %4 Ende: %5 Alpha: %6–%7\nRate: %8 Größe: %9–%10 Lebensdauer: %11–%12\nGravitation: %13 Kraft x: %14 y: %15 z: %16\nDrehgeschwindigkeit: %17–%18 Anfangswinkel: %19–%20",
  control_particle_system: "Steuere Partikelsystem %1 %2",
  create_box: "Box hinzufügen %1 %2 Breite %3 Höhe %4 Tiefe %5\nbei x: %6 y: %7 z: %8",
  create_sphere: "Kugel hinzufügen %1 %2 Ø x: %3 y: %4 z: %5\nbei x: %6 y: %7 z: %8",
  create_cylinder: "Zylinder hinzufügen %1 %2 Höhe: %3 oben: %4 unten: %5 Seiten: %6\nbei x: %7 y: %8 z: %9",
  create_capsule: "Kapsel hinzufügen %1 %2 Ø: %3 Höhe: %4\nbei x: %5 y: %6 z: %7",
  create_plane: "Ebene hinzufügen %1 %2 Breite: %3 Höhe: %4\nbei x: %5 y: %6 z: %7",

  // Sound blocks
  play_sound: "Ton abspielen %1 %2 von %3\nGeschwindigkeit: %4 Lautstärke: %5 Modus: %6 async: %7",
  stop_all_sounds: "Alle Töne stoppen",
  midi_note: "MIDI-Note %1",
  rest: "Pause",
  play_notes: "Noten spielen auf %1\nNoten: %2 Dauern: %3\nInstrument: %4 Modus: %5",
  set_scene_bpm: "Szenen-BPM auf %1 setzen",
  set_mesh_bpm: "BPM von %1 auf %2 setzen",
  create_instrument: "Instrument %1 Welle: %2 Frequenz: %3 Attacke: %4 Decay: %5 Sustain: %6 Release: %7",
  instrument: "Instrument %1",
  speak: "Sprechen %1 %2 Stimme: %3 Sprache: %4\nTempo: %5 Tonhöhe: %6 Lautstärke: %7 Modus: %8",

  // Text blocks
  comment: "// %1",
  print_text: "drucke %1 für %2 Sekunden %3",
  say: "sage %1 für %2 s %3\nText: %4 auf %5 Alpha: %6 Größe: %7 %8 %9",
  ui_text: "UI-Text %1 %2 bei x: %3 y: %4\nGröße: %5 für %6 Sekunden Farbe: %7",
  ui_button: "UI‑Button %1 %2 bei x: %3 y: %4\nGröße: %5 Textgröße: %6 Textfarbe: %7 Hintergrund: %8",
  ui_input: "UI‑Eingabe %1 %2 bei x: %3 y: %4\nGröße: %5 Textgröße: %6 Text: %7 Hintergrund: %8",
  create_3d_text: "Füge 3D‑Text hinzu %1: %2 Schrift: %3 Größe: %4 Farbe: %5\nTiefe: %6 x: %7 y: %8 z: %9",

  // Transform blocks
  move_by_xyz: "Bewege %1 um x: %2 y: %3 z: %4",
  move_to_xyz: "Bewege %1 zu x: %2 y: %3 z: %4 y? %5",
  move_to: "Bewege %1 zu %2 y? %3",
  scale: "Skaliere %1 x: %2 y: %3 z: %4\nUrsprung x: %5 y: %6 z: %7",
  resize: "Größe ändern %1 x: %2 y: %3 z: %4\nUrsprung x: %5 y: %6 z: %7",
  rotate_model_xyz: "Rotiere %1 um x: %2 y: %3 z: %4",
  rotate_to: "Rotiere %1 zu x: %2 y: %3 z: %4",
  look_at: "Lass %1 auf %2 sehen y? %3",
  move_forward: "Bewege %1 %2 Geschwindigkeit %3",
  set_pivot: "Setze Pivot von %1 x: %2 y: %3 z: %4",
  min_centre_max: "%1",

  // XR blocks
  device_camera_background: "verwende %1 Kamera als Hintergrund",
  set_xr_mode: "XR‑Modus auf %1 setzen",

  // Blockly overrides
  LISTS_CREATE_WITH_INPUT_WITH: "Liste",
  TEXT_JOIN_TITLE_CREATEWITH: "Text",
  CONTROLS_REPEAT_INPUT_DO: "",
  CONTROLS_WHILEUNTIL_INPUT_DO: "",
  CONTROLS_FOR_INPUT_DO: "",
  CONTROLS_FOREACH_INPUT_DO: "",
  CONTROLS_IF_MSG_THEN: "",
  CONTROLS_IF_MSG_ELSE: "else\n",
  CONTROLS_FOR_TITLE: "für jede(n) %1 von %2 bis %3 mit Schritt %4",

  // Block messages
  BLOCK_PRINT_TEXT_MESSAGE: "drucke %1 für %2 Sekunden %3",
  BLOCK_WAIT_SECONDS_MESSAGE: "warte %1 Sekunden",
  BLOCK_KEY_PRESSED_MESSAGE: "Taste %1 gedrückt?",
  BLOCK_MOVE_FORWARD_MESSAGE: "bewege %1 vorwärts um %2",
  BLOCK_CREATE_BOX_MESSAGE: "erstelle Box %1 Farbe %2 Größe %3 × %4 × %5 bei %6, %7, %8",

  // Scene tooltips
  set_sky_color_tooltip: "Stelle die Himmel‑Farbe der Szene ein.\nSchlüsselwort: sky",
  create_ground_tooltip: "Füge eine Bodenebene mit aktiven Kollisionen zur Szene hinzu.\nSchlüsselwort: ground",
  set_background_color_tooltip: "Setze die Hintergrundfarbe der Szene.\nSchlüsselwort: background",
  create_map_tooltip: "Erstelle eine Karte mit dem gewählten Namen und Material.\nSchlüsselwort: map",
  show_tooltip: "Zeige das ausgewählte Objekt.\nSchlüsselwort: show",
  hide_tooltip: "Verberge das ausgewählte Objekt.\nSchlüsselwort: hide",
  dispose_tooltip: "Entferne das angegebene Objekt aus der Szene.\nSchlüsselwort: dispose",
  clone_mesh_tooltip: "Klon ein Objekt und weise es einer Variable zu.\nSchlüsselwort: clone",

  // Models tooltips
  load_character_tooltip: "Erstelle einen konfigurierbaren Charakter.\nSchlüsselwort: character",
  load_object_tooltip: "Erstelle ein Objekt.\nSchlüsselwort: object",
  load_multi_object_tooltip: "Erstelle ein Objekt mit Farben.\nSchlüsselwort: object",
  load_model_tooltip: "Lade ein Modell.\nSchlüsselwort: model",

  // Animate tooltips
  glide_to_tooltip: "Gleite zu einer Position über eine Dauer mit Optionen für Rückwärts, Schleife und Easing.",
  glide_to_seconds_tooltip: "Gleite zu einer Position über Sekunden mit Optionen zum Rückwärtslaufen, Schleifen und Easing.",
  rotate_anim_tooltip: "Rotiert ein Objekt zu angegebenen Winkeln über eine Dauer mit Optionen für Rückwärts, Schleife und Easing.",
  rotate_anim_seconds_tooltip: "Rotiert ein Objekt über Sekunden mit Unterstützung für Rückläufe, Schleifen und Easing.",
  animate_property_tooltip: "Animiert eine Materialeigenschaft des Objekts und seiner Kinder.",
  colour_keyframe_tooltip: "Setze Farbe und Dauer für ein Schlüsselbild.",
  number_keyframe_tooltip: "Setze Zahl und Dauer für ein Schlüsselbild.",
  xyz_keyframe_tooltip: "Setze XYZ‑Schlüsselbild mit Dauer.",
  animate_keyframes_tooltip: "Animiert mehrere Schlüsselbilder am Objekt mit Easing, optionalem Loop und Rückwärtsfunktion.",
  animation_tooltip: "Erstelle eine Animationsgruppe mit Schlüsselbildern, Easing, optionaler Schleife und Rückwärtsfunktion. Wähle create, start oder await, um das Verhalten zu steuern.",
  control_animation_group_tooltip: "Steuere die Animationsgruppe durch Abspielen, Pausieren oder Stoppen.",
  animate_from_tooltip: "Starte Animation der Gruppe ab gegebener Sekunde.",
  stop_animations_tooltip: "Stoppt alle Schlüsselbild‑Animationen des gewählten Objekts.\nSchlüsselwort: stop",
  switch_animation_tooltip: "Wechsle die Animation des Objekts zur angegebenen.\nSchlüsselwort: switch",
  play_animation_tooltip: "Spiele die gewählte Animation einmal ab.\nSchlüsselwort: play",

  // Base tooltips
  xyz_tooltip: "Erstellt einen Vektor mit X, Y, Z Koordinaten",

  // Camera tooltips
  camera_control_tooltip: "Verknüpfe eine Taste mit einer Kamerasteuerungsaktion.",
  camera_follow_tooltip: "Lässt die Kamera einem Objekt mit einstellbarem Abstand folgen.\nSchlüsselwort: follow",
  get_camera_tooltip: "Hole die aktuelle Szene‑Kamera",

  // Combine tooltips
  merge_meshes_tooltip: "Fasse eine Liste von Objekten zu einem zusammen und speichere das Ergebnis.\nSchlüsselwort: merge",
  subtract_meshes_tooltip: "Subtrahiere eine Liste von Objekten von einem Basisobjekt und speichere das Ergebnis.\nSchlüsselwort: subtract",
  intersection_meshes_tooltip: "Erstelle die Schnittmenge mehrerer Objekte und speichere die resultierende Geometrie.\nSchlüsselwort: intersect",
  hull_meshes_tooltip: "Erstelle eine konvexe Hülle aus einer Liste von Objekten.\nSchlüsselwort: hull",

  // Connect tooltips
  parent_tooltip: "Setze eine Eltern‑Kind‑Beziehung, hält Kind in Weltposition.\nSchlüsselwort: parent",
  parent_child_tooltip: "Setze Eltern‑Kind‑Beziehung mit Versatz in X, Y, Z.\nSchlüsselwort: child",
  remove_parent_tooltip: "Entferne Elternbeziehung eines Objekts.\nSchlüsselwort: unparent",
  stop_follow_tooltip: "Stoppt das Folgen eines Objekts durch ein zweites.\nSchlüsselwort: stopfollow",
  hold_tooltip: "Befestige ein Objekt an einem Knochen eines anderen mit Versatz.\nSchlüsselwort: hold",
  drop_tooltip: "Löse ein Objekt von seinem Knochen.",
  follow_tooltip: "Lass ein Objekt einem anderen folgen (oben, Mitte, unten) mit Versatz.\nSchlüsselwort: follow",
  export_mesh_tooltip: "Exportiere ein Objekt als STL, OBJ oder GLB.\nSchlüsselwort: export",

  // Control tooltips
  wait_tooltip: "Warte die angegebene Dauer in Millisekunden.\nSchlüsselwort: milli",
  wait_seconds_tooltip: "Warte die angegebene Dauer in Sekunden.\nSchlüsselwort: wait",
  wait_until_tooltip: "Warte, bis Bedingung wahr ist.\nSchlüsselwort: until",
  local_variable_tooltip: "Erstelle eine lokale Variable (überschreibt globale mit eigenem Wert).\nSchlüsselwort: local",
  for_loop2_tooltip: "Schleife von Start‑ bis Endwert mit Schritt.",
  for_loop_tooltip: "Schleife mit Start, Ende und Schritt. Dropdown zur Auswahl der Loop‑Variable.\nSchlüsselwort: for",
  get_lexical_variable_tooltip: "Hole den Wert einer lexikalischen Variablen",

  // Effects tooltips
  light_intensity_tooltip: "Stelle die Intensität der Hauptbeleuchtung ein.\nSchlüsselwort: light intensity",
  set_fog_tooltip: "Konfiguriere den Nebel der Szene.\nSchlüsselwort: fog",

  // Events tooltips
  start_tooltip: "Führe Blöcke beim Projektstart aus. Mehrere Startblöcke möglich.\nSchlüsselwort: start",
  forever_tooltip: "Führe Blöcke in jedem Frame oder nach Iteration aus.\nSchlüsselwort: forever",
  when_clicked_tooltip: "Führe Blöcke aus, wenn ein Objekt geklickt wird.\nSchlüsselwort: click",
  on_collision_tooltip: "Führe Blöcke aus bei Kollision oder Ende der Kollision.\nSchlüsselwort: collide",
  when_key_event_tooltip: "Führe Blöcke aus bei Tastendruck oder -freigabe.",
  broadcast_event_tooltip: "Sende Ereignis, das von on_event empfangen wird.\nSchlüsselwort: broadcast",
  on_event_tooltip: "Führe Code aus, wenn Broadcast‑Ereignis empfangen wird.\nSchlüsselwort: on",

  // Materials tooltips
  change_color_tooltip: "Farbe des gewählten Objekts ändern.\nSchlüsselwort: color",
  change_material_tooltip: "Wende ausgewähltes Material mit Farbtönung auf Objekt an.\nSchlüsselwort: material",
  text_material_tooltip: "Erstelle Material mit Text oder Emoji – Breite, Höhe, Hintergrundfarbe und Größenangabe.",
  place_decal_tooltip: "Plaziere Aufkleber auf einem Objekt mit dem ausgewählten Material.",
  decal_tooltip: "Erstelle einen Decal mit Position, Normalen, Größe und Material.",
  highlight_tooltip: "Heb das ausgewählte Objekt hervor.\nSchlüsselwort: highlight",
  glow_tooltip: "Füge dem Objekt einen Leuchteffekt hinzu.\nSchlüsselwort: glow",
  tint_tooltip: "Füge eine Farbtönung hinzu.\nSchlüsselwort: tint",
  set_alpha_tooltip: "Setze die Transparenz des Materials auf 0–1.\nSchlüsselwort: alpha",
  clear_effects_tooltip: "Entferne visuelle Effekte vom Objekt.\nSchlüsselwort: clear",
  colour_tooltip: "Farbe wählen.\nSchlüsselwort: color",
  skin_colour_tooltip: "Hautfarbe wählen.\nSchlüsselwort: skin",
  greyscale_colour_tooltip: "Graustufenfarbe für Höhen wählen.\nSchlüsselwort: grey",
  random_colour_tooltip: "Generiere eine Zufallsfarbe.\nSchlüsselwort: randcol",
  material_tooltip: "Definiere Materialeigenschaften",
  gradient_material_tooltip: "Definiere Materialeigenschaften mit Verlauf",
  set_material_tooltip: "Setze das angegebene Material auf das Objekt",

  // Physics tooltips
  add_physics_tooltip: "Füge Physik zum Objekt hinzu: dynamisch, statisch, animiert oder keine.\nSchlüsselwort: physics",
  add_physics_shape_tooltip: "Füge Physik‑Form hinzu: Mesh oder Kapsel.\nSchlüsselwort: physics",
  apply_force_tooltip: "Wende Kraft auf Objekt in XYZ‑Richtung an.\nSchlüsselwort: force",

  // Tooltip translations - Sensing blocks
  key_pressed_tooltip: "Gibt true zurück, wenn die angegebene Taste gedrückt ist.\nSchlüsselwort: ispressed",
  meshes_touching_tooltip: "Gibt true zurück, wenn die zwei gewählten Objekte sich berühren.\nSchlüsselwort: istouching",
  time_tooltip: "Gibt die aktuelle Zeit in Sekunden zurück.",
  distance_to_tooltip: "Berechnet den Abstand zwischen zwei Objekten.",
  touching_surface_tooltip: "Prüft, ob das Objekt eine Oberfläche berührt.\nSchlüsselwort: surface",
  get_property_tooltip: "Gibt den Wert der gewählten Eigenschaft eines Objekts zurück.\nSchlüsselwort: get",
  canvas_controls_tooltip: "Füge Bewegungssteuerung für Canvas hinzu oder entferne sie.\nSchlüsselwort: canvas",
  button_controls_tooltip: "Konfiguriere Tastensteuerung.\nSchlüsselwort: button",
  microbit_input_tooltip: "Führt Blöcke aus, wenn ein bestimmtes micro:bit-Ereignis ausgelöst wird.",
  ui_slider_tooltip: "Füge einen 2D-Schieberegler zur UI hinzu und speichere seine Referenz in einer Variable.",

  // Tooltip translations - Shapes blocks
  create_particle_effect_tooltip: "Erstelle einen Partikeleffekt an einem Objekt mit konfigurierbarer Form, Schwerkraft, Größe, Farbe, Transparenz, Lebensdauer, Kraft und Rotation.",
  control_particle_system_tooltip: "Steuere das Partikelsystem durch Start, Stopp oder Zurücksetzen.",
  create_box_tooltip: "Erstelle eine farbige Box mit angegebenen Maßen und Position.\nSchlüsselwort: box",
  create_sphere_tooltip: "Erstelle eine farbige Kugel mit angegebenen Maßen und Position.\nSchlüsselwort: sphere",
  create_cylinder_tooltip: "Erstelle einen farbigen Zylinder mit angegebenen Maßen und Position.\nSchlüsselwort: cylinder",
  create_capsule_tooltip: "Erstelle eine farbige Kapsel mit angegebenen Maßen und Position.\nSchlüsselwort: capsule",
  create_plane_tooltip: "Erstelle eine farbige 2D-Fläche mit Breite, Höhe und Position.\nSchlüsselwort: plane",

  // Tooltip translations - Sound blocks
  play_sound_tooltip: "Spiele den ausgewählten Sound auf einem Objekt mit anpassbarer Geschwindigkeit, Lautstärke und Modus.\nSchlüsselwort: sound",
  stop_all_sounds_tooltip: "Stoppe alle aktuell in der Szene abgespielten Sounds.\nSchlüsselwort: nosound",
  midi_note_tooltip: "Ein MIDI-Notenwert zwischen 0 und 127.",
  rest_tooltip: "Eine Pause (Stille) in einer Musiksequenz.",
  play_notes_tooltip: "Spiele eine Sequenz aus MIDI-Noten und Pausen mit entsprechenden Dauern. Nutzt Objekt für Stereo-Panning. Kann sofort oder nach dem Abspielen zurückkehren.",
  set_scene_bpm_tooltip: "Setzt die BPM für die gesamte Szene.",
  set_mesh_bpm_tooltip: "Setzt die BPM für ein ausgewähltes Objekt.",
  create_instrument_tooltip: "Erstellt ein Instrument und weist es der gewählten Variable zu.",
  instrument_tooltip: "Wähle ein Instrument, das für das Abspielen von Noten verwendet wird.",
  speak_tooltip: "Wandle Text in Sprache mit der Web Speech API um, optional mit 3D-Positionierung.\nSchlüsselwort: speak",

  // Tooltip translations - Text blocks
  comment_tooltip: "Ein Kommentar, um den Code verständlicher zu machen.",
  print_text_tooltip: "Gibt Text im Ausgabebereich aus.\nSchlüsselwort: print",
  say_tooltip: "Zeigt einen Text als Sprechblase auf einem Objekt an.\nSchlüsselwort: say",
  ui_text_tooltip: "Füge Text zur UI hinzu und speichere die Kontrolle in einer Variable für spätere Nutzung oder Entfernung.",
  ui_button_tooltip: "Füge einen 2D-Button mit vorgegebener Größe zur UI hinzu und speichere die Kontrolle in einer Variable.",
  ui_input_tooltip: "Stelle dem Benutzer eine Frage und warte auf die Eingabe. Ergebnis wird in einer Variable gespeichert.",
  create_3d_text_tooltip: "Erstelle 3D-Text in der Szene.",

  // Tooltip translations - Transform blocks
  move_by_xyz_tooltip: "Bewege ein Objekt um den angegebenen Wert in X-, Y- und Z-Richtung.\nSchlüsselwort: move",
  move_to_xyz_tooltip: "Teleportiert das Objekt zu den angegebenen Koordinaten. Optional Y-Achse nutzen.\nSchlüsselwort: moveby",
  move_to_tooltip: "Teleportiert das erste Objekt zur Position des zweiten.\nSchlüsselwort: moveto",
  scale_tooltip: "Skaliert ein Objekt auf die gegebenen X-, Y-, und Z-Werte und kontrolliert den Ursprung der Skalierung.\nSchlüsselwort: scale",
  resize_tooltip: "Ändert die Größe eines Objekts auf die gegebenen X-, Y-, Z-Werte mit Skalierungsursprung.\nSchlüsselwort: resize",
  rotate_model_xyz_tooltip: "Drehe das Objekt um die gegebenen X-, Y-, Z-Werte.\nSchlüsselwort: rotate\nSchlüsselwort: rotateby",
  rotate_to_tooltip: "Drehe das Objekt in Richtung der angegebenen Koordinaten.\nSchlüsselwort: rotateto",
  look_at_tooltip: "Dreht das erste Objekt so, dass es auf die Position des zweiten zeigt.\nSchlüsselwort: look",
  move_forward_tooltip: "Bewegt das Objekt in die gewählte Richtung: 'Vorwärts' entlang Blickrichtung, 'Seitlich' relativ zur Kamera, 'Strafe' quer zur Kamerarichtung.\nSchlüsselwort: push",
  set_pivot_tooltip: "Setze den Pivotpunkt eines Objekts in X-, Y- und Z-Richtung.\nSchlüsselwort: pivot",
  min_centre_max_tooltip: "Wähle min, center oder max als Pivotpunkt.\nSchlüsselwort: minmax",

  // XR tooltips
  device_camera_background_tooltip: "Verwende Gerätekamera als Hintergrund für die Szene. Funktioniert auf Mobilgeräten und Desktop.",
  set_xr_mode_tooltip: "Setze XR‑Modus der Szene.\nOptionen: VR, AR, Magic Window.",
}
