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
| `<snippet src="…">caption</snippet>`  | A picture of a real block, e.g. `<snippet src="sky-and-map">The sky block</snippet>`. Rendered live from Blockly JSON in `docs/how-tos/snippets/` — see the README there for how to create one. The caption is optional but recommended: it's also the accessible description, since the rendered picture itself is decorative.                                                                                                                                                                                            |

Avoid inline `style` attributes so the text keeps working with the panel's text-size
buttons and with every colour theme.

To show a UI button inline in a sentence, paste its SVG from `index.html` with
`class="howto-icon"` (sized to the surrounding text by `style.css`) — see the Add
step in `en/add-objects.html`.

A plain `<a href="https://…">` is enough for an external link — it's decorated the same
way as in the Help tab (new tab, external-link icon, screen-reader announcement).

## Translations

One folder per language, named with the same language codes as `locale/` (e.g. `en/`,
`de/`, `es/`). Only `en/` is required. To add a translation, copy the `en/` folder to the
new language code and translate the text inside each file — the panel picks up the new
folder with no code change. A how-to missing from a language's folder falls back to its
`en/` version, so a half-finished translation never leaves a how-to blank.
