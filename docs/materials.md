# Contributing Open Source Materials to Flock XR
This document explains how material textures work in Flock XR and how to contribute a new one.

We only accept textures with open licenses (e.g. **CC0**, **CC BY**, **MIT**).  
Please make sure you have the right to share your work before submitting.

---

## Background

A material in Flock XR is a texture image plus one or more colours chosen by the learner. The textures live in the `textures` folder and are listed in `materialNames` in `config.js`, which fills the picker on the **material** and **change material** blocks.

Textures are drawn in **greyscale**. Flock XR colours them in at run time, so one image can be used as red bricks, blue bricks or black and white bricks. This keeps the download small and gives learners control over how their world looks.

The exception is `none.png`, the **Flat** material. It has no pattern: one colour gives a plain colour and two or more colours give a gradient.

---

## Tile Size

A texture is repeated, or **tiled**, across the surface of a shape. Flock XR keeps the tile size the same in the world whatever size the shape is, so a large wall shows more bricks than a small one rather than bigger bricks.

- One copy of the image covers **4 × 4 world units**. This is set by `TEXTURE_TILE_SIZE` in `config.js`.
- The same size is used for boxes, spheres, cylinders, capsules, planes and maps, and for imported models.
- When a shape is resized, its texture is re-tiled so the pattern keeps its size instead of stretching.
- Learners can change the size with the **scale** option on the material. A scale of 2 makes each copy of the image cover 8 × 8 units; a scale of 0.5 makes it cover 2 × 2 units. The **angle** option rotates the pattern.

The box from the toolbox is 1 unit on each side, so one copy of your image covers a 4 × 4 square of those boxes, and each box face shows a quarter of the image across and a quarter down. Draw your details at that size. For example, `bricks.png` holds 20 rows of bricks, so each brick is 0.2 units high.

If a texture's natural size doesn't work at 4 units, it can be given its own adjustment in `textureTilingFactors` in `api/material.js`. For example, `tiles.png` uses `0.8`, so one copy covers 5 units. Please only use this if redrawing the image isn't practical.

### Image size

- Most textures are **400 × 400 pixels**, or 100 pixels per world unit. Use this unless your pattern needs fine detail.
- Use a **square** image.
- The image must **tile seamlessly**: the left edge must join the right edge and the top must join the bottom, with no visible seam.
- Keep the file as small as possible. Flat areas of grey compress well; noise and gradients do not.
- Use a fully **opaque** PNG. Transparent pixels are handled differently by the single-colour and multi-colour materials, so they won't look the same everywhere.

---

## How Colours Are Mapped

Learners can give a material one colour or a list of colours. Each pixel in your image is matched by its **brightness** and by how **grey** it is.

### One colour

The texture is multiplied by the colour:

- **White** becomes the chosen colour.
- **Greys** become darker shades of the chosen colour.
- **Black** stays black.

### A list of colours

Each pixel is checked in this order and the first rule that matches is used:

| Pixel in your image | Becomes | Rule |
| --- | --- | --- |
| **White** | 1st colour, exactly | Average brightness above 95% (about 242 of 255) and the red, green and blue values within 5% of each other |
| **Black** | 3rd colour, exactly | Only when 3 or more colours are given. Average brightness below 20% (about 51 of 255) and red, green and blue within 20% of each other |
| **Grey** | A shade of the 2nd colour | Red, green and blue within 20% of each other. The pixel's brightness is multiplied by the 2nd colour, so light greys give light shades and dark greys give dark shades |
| **Coloured** | Unchanged | Anything that isn't grey, e.g. a pink nose |

Things to know:

- Colours after the third are ignored.
- With only two colours, black is treated as a very dark grey, so it stays close to black.
- White is replaced by the 1st colour exactly, with no shading. Use pure white (`#ffffff`) for areas that should take the main colour, and a light grey such as `#e0e0e0` for areas that should be a pale shade of the 2nd colour.
- Grey shading only uses the 2nd colour. To give learners several shades, use several greys. In `bricks.png` the bricks are different greys, so with colours `[white, red, black]` they become a mix of red shades with black mortar.
- Coloured pixels are never recoloured. Use them sparingly for details that should always look the same, like the cheeks in `fishes.png`. Keep everything else neutral grey, since a slightly tinted grey counts as coloured and won't change.
- Drawing with a few clear tones (white, two or three greys and black) gives learners the most control. Outlines in black let a 3-colour list pick the outline colour.

### Checking your texture

Before you submit, try your texture in Flock XR with:

1. No colour, to check the pattern and the seams.
2. One colour, e.g. orange.
3. Two colours, e.g. `[white, blue]`.
4. Three colours, e.g. `[yellow, green, black]`.

Try it on a large box and a small box, and on a sphere, to check the tile size looks right.

---

## Process for Adding a Material Directly to Flock XR

1. **Fork** the GitHub repository for the development version of Flock XR.
2. Upload your `.png` texture into the `textures` folder. Use a lower-case name with underscores, e.g. `fish_above.png`.
3. Create a short `README.md` in the same folder describing:
   - The texture
   - The source
   - The license
4. _(Optional)_ Add your file name to `materialNames` in `config.js` so it appears in the material picker — or we can do this part for you. The picker uses the texture itself as its thumbnail.
5. Create a **Pull Request** with a short description of your submission.

Once your Pull Request is submitted, we'll review it to ensure:

- It tiles without visible seams.
- The file size is small enough to avoid loading delays.
- The pattern looks the right size at 4 units per tile.
- It colours well with one, two and three colours.
- The texture is suitable for a young, global audience.

After approval, your material will be merged and added to the development version of Flock XR.

---

## Process for Emailing Your Material to Flock XR

If you prefer, you can email your texture directly to **info@flipcomputing.com**.  
Please include:

- Your name (and GitHub username if applicable)
- The texture file in `.png` format
- A short description and license information

We'll review your submission and handle the upload for you.

The creation of these resources was supported by a [grant from Nlnet](https://nlnet.nl/project/FlockXR).
