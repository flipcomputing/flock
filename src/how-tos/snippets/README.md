# How-to snippet blocks

JSON files referenced by `<snippet src="…">` tags in `docs/how-tos/*/*.html` — each one is a
Blockly block (in the same serialization format `Blockly.serialization.blocks.append()` accepts),
rendered live as an inline SVG by `ui/howToPanel.js` when the how-to article is opened.

One folder, shared by every language: unlike the how-to text itself, a block's JSON has no
language in it (Blockly renders whatever text a block has, like "sky" or "map", from the current
locale automatically), so there's nothing to translate here.

## Why live-rendered, not a picture

Earlier drafts of this feature exported each snippet as a PNG once, ahead of time. That doesn't
scale: a rendered image bakes in whatever language was active when it was exported, so it would
need re-exporting **per language** as translations are added — on top of images generally being
much bigger than the JSON they're drawn from (kilobytes vs. hundreds of bytes), which matters
because how-to content is precached for offline use in the PWA. Rendering the block live from its
JSON avoids both problems: one small file works for every language, and there's nothing to
regenerate if the block's own look ever changes.

## Creating one

1. In the running app, build the block you want to show.
2. Right-click the block (press and hold on a touchscreen) and choose **Export block as snippet**.
   This downloads a `.fsnip` file — plain JSON, the same format Blockly itself uses to save/load
   blocks.
3. Save it into this folder as `<name>.json` (just change the extension), and reference it from a
   how-to: `<snippet src="<name>">Optional caption</snippet>`.
