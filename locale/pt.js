import common from "./commmonHTML.js"

export default {
  // Blockly category message keys for custom categories
  CATEGORY_SCENE: "Cena",
  CATEGORY_MESHES: "Malhas", 
  CATEGORY_XR: "XR",
  CATEGORY_EFFECTS: "Efeitos",
  CATEGORY_CAMERA: "Câmera",
  CATEGORY_EVENTS: "Eventos",
  CATEGORY_TRANSFORM: "Transformar",
  CATEGORY_PHYSICS: "Física",
  CATEGORY_CONNECT: "Conectar",
  CATEGORY_COMBINE: "Combinar",
  CATEGORY_ANIMATE: "Animar",
  CATEGORY_KEYFRAME: "Quadro-chave",
  CATEGORY_CONTROL: "Controle",
  CATEGORY_CONDITION: "Condição",
  CATEGORY_SENSING: "Sensores",
  CATEGORY_TEXT: "Texto",
  CATEGORY_STRINGS: "Strings", 
  CATEGORY_MATERIALS: "Materiais",
  CATEGORY_SOUND: "Som",
  CATEGORY_VARIABLES: "Variáveis",
  CATEGORY_LISTS: "Listas",
  CATEGORY_MATH: "Matemática",
  CATEGORY_FUNCTIONS: "Funções",
  CATEGORY_SNIPPETS: "Trechos",

  // Custom block translations - Scene blocks
  set_sky_color: "céu %1",
  create_ground: "chão %1",
  set_background_color: "definir cor de fundo %1",
  create_map: "mapa %1 com material %2",
  show: "mostrar %1",
  hide: "ocultar %1",
  dispose: "remover %1",
  clone_mesh: "adicionar %1 cópia de %2",

  // Custom block translations - Models blocks
  load_character: "adicionar %1 %2 escala: %3 x: %4 y: %5 z: %6\nCabelo: %7 | Pele: %8 | Olhos: %9 | Camiseta: %10 | Shorts: %11 | Detalhe: %12",
  load_object: "adicionar %1 %2 %3 escala: %4 x: %5 y: %6 z: %7",
  load_multi_object: "adicionar %1 %2 escala: %3 x: %4 y: %5 z: %6\ncores: %7",
  load_model: "adicionar %1 %2 escala: %3 x: %4 y: %5 z: %6",
  
  // Custom block translations - Animate blocks
  glide_to: "deslizar %1 para x %2 y %3 z %4 em %5 ms\n%6 voltar? %7 repetir? %8 %9",
  glide_to_seconds: "deslizar %1 para x %2 y %3 z %4 em %5 segundos\n%6 voltar? %7 repetir? %8 %9",
  rotate_anim: "girar %1 para x %2 y %3 z %4 em %5 ms\n%6 inverter? %7 repetir? %8 %9",
  rotate_anim_seconds: "girar %1 para x %2 y %3 z %4 em %5 segundos\n%6 inverter? %7 repetir? %8 %9",
  animate_property: "animar %1 %2 até %3 em %4 ms inverter? %5 repetir? %6 %7",
  colour_keyframe: "em %1 cor: %2",
  number_keyframe: "em: %1 valor: %2",
  xyz_keyframe: "em: %1 x: %2 y: %3 z: %4",
  animate_keyframes: "animar quadros-chave em %1 propriedade %2\nquadros-chave %3\neasing %4 repetir %5 inverter %6 %7",
  animation: "animar quadros-chave em %1 propriedade %2 grupo %3\nquadros-chave %4\neasing %5 repetir %6 inverter %7 modo %8",
  control_animation_group: "grupo de animação %1 %2",
  animate_from: "animar grupo %1 a partir de %2 segundos",
  stop_animations: "parar animações %1",
  switch_animation: "trocar animação de %1 para %2",
  play_animation: "reproduzir animação %1 em %2",

  // Custom block translations - Base blocks
  xyz: "x: %1 y: %2 z: %3",

  // Custom block translations - Camera blocks
  camera_control: "câmera %1 %2",
  camera_follow: "câmera segue %1 com raio %2 frente %3",
  get_camera: "obter câmera como %1",

  // Custom block translations - Combine blocks
  merge_meshes: "adicionar %1 como fusão de %2",
  subtract_meshes: "adicionar %1 como %2 menos %3",
  intersection_meshes: "adicionar %1 como interseção de %2",
  hull_meshes: "adicionar %1 como envoltória de %2",
  
  // Custom block translations - Connect blocks
  parent: "pai %1 filho %2",
  parent_child: "pai %1 filho %2\ndeslocamento x: %3 y: %4 z: %5",
  remove_parent: "remover pai de %1",
  stop_follow: "parar de seguir %1",
  hold: "fazer %1 segurar %2\ndeslocamento x: %3 y: %4 z: %5",
  drop: "soltar %1",
  follow: "fazer %1 seguir %2 em %3\ndeslocamento x: %4 y: %5 z: %6",
  export_mesh: "exportar %1 como %2",
  
  // Custom block translations - Control blocks
  wait: "esperar %1 ms",
  wait_seconds: "esperar %1 segundos",
  wait_until: "esperar até %1",
  local_variable: "variável local %1",
  for_loop2: "para cada %1 de %2 até %3 passo %4 faça %5",
  for_loop: "para cada %1 de %2 até %3 passo %4 faça %5",
  get_lexical_variable: "%1",

  // Custom block translations - Effects blocks
  light_intensity: "definir intensidade da luz para %1",
  set_fog: "definir cor da névoa %1 modo %2 densidade %3",
  
  // Custom block translation - Events blocks
  start: "início",
  forever: "para sempre\n%1",
  when_clicked: "quando %1 %2",
  on_collision: "ao colidir %1 %2 %3",
  when_key_event: "quando tecla %1 %2",
  broadcast_event: "transmitir evento %1",
  on_event: "ao evento %1",

  // Custom block translations - Materials blocks
  change_color: "cor %1 para %2",
  change_material: "aplicar material %1 em %2 com cor %3",
  text_material: "material %1 texto %2 cor %3 fundo %4\nlargura %5 altura %6 tamanho %7",
  place_decal: "adesivo %1 ângulo %2",
  decal: "adesivo em %1 de x %2 y %3 z %4\nângulo x %5 y %6 z %7\ntamanho x %8 y %9 z %10 material %11",
  highlight: "destacar %1 %2",
  glow: "brilhar %1",
  tint: "tonalizar %1 %2",
  set_alpha: "definir opacidade de %1 para %2",
  clear_effects: "limpar efeitos de %1",
  colour: "%1",
  skin_colour: "%1",
  greyscale_colour: "%1",
  colour_from_string: "- %1 -",
  random_colour: "cor aleatória",
  material: "material %1 %2 opacidade %3",
  gradient_material: "material %1 opacidade %2",
  set_material: "definir material de %1 para %2",
}
