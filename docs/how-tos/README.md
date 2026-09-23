# How to panel content

The How tos tab in Flock's information panel is populated from the HTML files in this
folder — one subfolder per language (e.g. `en/`), each containing one file per how-to,
named after its slug (e.g. `en/add-sky-and-ground.html`). To change what a how-to says, edit
its file under `en/` — no JavaScript changes needed. To add a new how-to card, add an
`en/<slug>.html` file and register the slug in `HOW_TOS` in `ui/howToPanel.js` with
a matching `howto_<slug>_ui` locale entry and one or more topic `tags` (e.g.
`tags: ['gizmo']`). Each tag needs a matching `howto_tag_<tag>_ui` locale entry —
the card grid picks it up as a filter chip automatically, with no other change needed.

## Editing

Each how-to file is an HTML **fragment**, not a whole page: no `<!doctype>`, `<html>`,
`<head>` or `<body>`. Start straight in at the content — an `<h3>` for the how-to's own
sub-headings is one level below the panel's own how-to-name title.

The panel supplies its own styling for plain semantic HTML (`<p>`, `<ul>`, `<a>`,
`<code>`, `<kbd>`) the same way the Help tab does, plus a small set of extra tags for
how-to-specific structure:

| Tag                                   | Use it for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<goal>…</goal>`                      | The objective/outcome at the top of the how-to — what the reader will have built by the end.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `<step>…</step>`                      | One numbered step. Give it a `<step-title>` (see below) as its first child for a scannable "Step N: Title" heading — recommended for every step. The panel also appends a "mark as complete" checkbox to the end of every step — you don't add this yourself. Completion isn't saved anywhere; it just resets when you leave and reopen the how-to.                                                                                                                                                                        |
| `<step-title>…</step-title>`          | A short (2-4 word) title for a `<step>`, e.g. `<step-title>Add a ground</step-title>`. The panel renders it as "Step N: Add a ground" — the number is automatic (CSS counters), don't write it yourself. Optional: a `<step>` with no title falls back to a bare "Step N" label.                                                                                                                                                                                                                                           |
| `<tip>…</tip>`                        | A tip or aside that isn't essential to follow the steps. (`<note>` is reserved for a future note style — don't use it yet.)                                                                                                                                                                                                                                                                                                                                                                                             |
| `<vocab>…</vocab>`                    | A vocabulary term, e.g. `<vocab>fly camera</vocab>`. Rendered inline in a distinct style; a vocab list collecting these terms comes later.                                                                                                                                                                                                                                                                                                                                                                                 |
| `<axis-x>…</axis-x>`, `<axis-y>…</axis-y>`, `<axis-z>…</axis-z>` | An axis reference, e.g. `<axis-x>X</axis-x>`. The letter renders in its gizmo color so readers can match text to arrows and block values — never write a hex value or inline style for this; the colors live in one place in `style.css` (kept in sync with `AXIS_HEX` in `ui/gizmos.js`). |
| `<link-to target="…">label</link-to>` | A link to a real part of the UI, e.g. `<link-to target="tools">gizmo hints</link-to>` or `<link-to target="newproject">Projects</link-to>`. Clicking it draws attention to (and sometimes opens) that part of the app — see `drawAttention()` in `ui/howToPanel.js`. Valid `target` values are defined in `HOWTO_LINK_TARGETS` in the same file — add a new one there before using it in a how-to; a target can check real UI state (e.g. whether a modal is already open) to point at whichever control makes sense next. A target of the form `howto:<slug>` (e.g. `howto:look-around`) opens another how-to card instead. |
| `<ui-button target="…">label</ui-button>` | A button with its icon — menu-bar buttons, toolbox categories (`toolbox:KEY`), block-menu buttons (`block-…`) and the workspace trashcan (`trashcan`). See the target lists below. |
| `<snippet src="…">caption</snippet>`  | A picture of a real block, e.g. `<snippet src="sky-and-map">The sky block</snippet>`. Rendered live from Blockly JSON in `docs/how-tos/snippets/` — see the README there for how to create one. The caption is optional but recommended: it's also the accessible description, since the rendered picture itself is decorative.                                                                                                                                                                                            |

Avoid inline `style` attributes so the text keeps working with the panel's text-size
buttons and with every colour theme.

To show a button inline in a sentence, use
`<ui-button target="…">label</ui-button>` — see the target lists below. It renders
the label bold plus the button's icon (before the name for toolbox categories,
after it for other buttons) and highlights the real button on click, so
never paste an SVG for these buttons.

A plain `<a href="https://…">` is enough for an external link — it's decorated the same
way as in the Help tab (new tab, external-link icon, screen-reader announcement).

### `<ui-button>` targets

One target per menu-bar button. The icons are hardcoded copies of the SVGs in
`index.html` (kept in `UI_BUTTON_ICONS` in `ui/howToPanel.js`) — if a button
icon changes, update its entry there in the same pass. Text-only buttons
(`projects`, `canvasview`, `codeview`) have no icon entry and render as a
label-only highlight link.

| Target | Points at | Example |
| ------ | --------- | ------- |
| `addmenu` | Add menu (`#showShapesButton`) | `<ui-button target="addmenu">Add</ui-button>` |
| `colorpicker` | Colour picker (`#colorPickerButton`) | `<ui-button target="colorpicker">Colour</ui-button>` |
| `positiongizmo` | Position gizmo (`#positionButton`) | `<ui-button target="positiongizmo">Position</ui-button>` |
| `rotategizmo` | Rotate gizmo (`#rotationButton`) | `<ui-button target="rotategizmo">Rotate</ui-button>` |
| `scalegizmo` | Resize gizmo (`#scaleButton`) | `<ui-button target="scalegizmo">Resize</ui-button>` |
| `selectgizmo` | Select gizmo (`#selectButton`) | `<ui-button target="selectgizmo">Select</ui-button>` |
| `duplicategizmo` | Duplicate gizmo (`#duplicateButton`) | `<ui-button target="duplicategizmo">Duplicate</ui-button>` |
| `deletegizmo` | Delete gizmo (`#deleteButton`) | `<ui-button target="deletegizmo">Delete</ui-button>` |
| `cameragizmo` | Camera controls (`#cameraButton`) | `<ui-button target="cameragizmo">Camera</ui-button>` |
| `viewgizmo` | Orbit view (`#eyeButton`) | `<ui-button target="viewgizmo">View</ui-button>` |
| `mainmenu` | Main menu (`#menuBtn`) | `<ui-button target="mainmenu">Menu</ui-button>` |
| `projects` | Projects (`#exampleButton`, label only) | `<ui-button target="projects">Projects</ui-button>` |
| `run` | Run (`#runCodeButton`) | `<ui-button target="run">Play</ui-button>` |
| `stop` | Stop (`#stopCodeButton`) | `<ui-button target="stop">Stop</ui-button>` |
| `playmode` | Play view (`#togglePlay`) | `<ui-button target="playmode">Play view</ui-button>` |
| `fullscreen` | Fullscreen (`#fullscreenToggle`) | `<ui-button target="fullscreen">Fullscreen</ui-button>` |
| `blockhints` | Block hints (`#blockHintsBtn`) | `<ui-button target="blockhints">Block hints</ui-button>` |
| `search` | Find in workspace (`#workspaceSearchBtn`) | `<ui-button target="search">Search</ui-button>` |
| `undo` | Undo (`#undoBtn`) | `<ui-button target="undo">Undo</ui-button>` |
| `redo` | Redo (`#redoBtn`) | `<ui-button target="redo">Redo</ui-button>` |
| `zoomout` | Zoom out (`#zoomOutBtn`) | `<ui-button target="zoomout">Zoom out</ui-button>` |
| `zoomin` | Zoom in (`#zoomInBtn`) | `<ui-button target="zoomin">Zoom in</ui-button>` |
| `canvasview` | Canvas view toggle (`#canvasToggleBtn`, label only) | `<ui-button target="canvasview">Canvas</ui-button>` |
| `codeview` | Code view toggle (`#codeToggleBtn`, label only) | `<ui-button target="codeview">Code</ui-button>` |

### `<ui-button>` toolbox targets

`target="toolbox:KEY"`, where `KEY` matches a `CATEGORY_<KEY>` locale entry —
e.g. `<ui-button target="toolbox:SNIPPETS">Snippets</ui-button>`. The icon is
the category's own icon from `toolbox.js`, so no icon entry needs updating.
Clicking highlights the category's row; for a subcategory whose parent isn't
open yet (e.g. Strings inside Text), the glow goes to the parent category
instead. Available keys:

`SCENE`, `MESHES` (Objects), `XR`, `EFFECTS`, `CAMERA`, `EVENTS`,
`TRANSFORM`, `PHYSICS`, `CONNECT`, `COMBINE`, `ANIMATE`, `KEYFRAME`,
`CONTROL`, `CONDITION`, `SENSING`, `TEXT`, `STRINGS`, `MATERIALS`, `SOUND`,
`VARIABLES`, `VARIABLES_SUBCATEGORY`, `LISTS`, `MATH`, `FUNCTIONS`,
`SNIPPETS`, `MOVEMENT`.

### `<ui-button>` block-menu and trashcan targets

The floating block menu only opens on a selected block, so these highlight
nothing until the reader has selected a block — tell them to select one
first. The workspace trashcan (`trashcan`) is always visible.

| Target | Points at | Example |
| ------ | --------- | ------- |
| `block-expand` | Expand block | `<ui-button target="block-expand">Expand</ui-button>` |
| `block-collapse` | Collapse block | `<ui-button target="block-collapse">Collapse</ui-button>` |
| `block-unlock` | Unlock block | `<ui-button target="block-unlock">Unlock</ui-button>` |
| `block-duplicate` | Duplicate block | `<ui-button target="block-duplicate">Duplicate</ui-button>` |
| `block-copy` | Copy block | `<ui-button target="block-copy">Copy</ui-button>` |
| `block-paste` | Paste block | `<ui-button target="block-paste">Paste</ui-button>` |
| `block-detach` | Detach block | `<ui-button target="block-detach">Detach</ui-button>` |
| `block-enable` | Enable / Disable block | `<ui-button target="block-enable">Enable</ui-button>` |
| `block-view` | View in canvas | `<ui-button target="block-view">View</ui-button>` |
| `block-delete` | Delete block | `<ui-button target="block-delete">Delete</ui-button>` |
| `trashcan` | Workspace trashcan | `<ui-button target="trashcan">Trashcan</ui-button>` |

## Translations

One folder per language, named with the same language codes as `locale/` (e.g. `en/`,
`de/`, `es/`). Only `en/` is required. To add a translation, copy the `en/` folder to the
new language code and translate the text inside each file — the panel picks up the new
folder with no code change. A how-to missing from a language's folder falls back to its
`en/` version, so a half-finished translation never leaves a how-to blank.
