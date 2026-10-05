# Contributing Open Source Models to Flock XR

We love seeing the community share models with Flock XR!  
This document explains how to contribute your existing model or create a new one.

We only accept models with open licenses (e.g. **CC0**, **CC BY**, **MIT**).  
Please make sure you have the right to share your work before submitting.

---

## [Characters Only] Background

All characters in Flock XR use the same armature.

Animations are rigged on this shared armature and stored separately from the models.

You can download existing models and animations from the [Flock XR GitHub repository](https://github.com/flipcomputing/flock).  
The Flip Computing GitHub account holds the live and development versions of Flock XR.

The armatures were rigged in [Mixamo](https://www.mixamo.com) using the autorigger and are all in humanoid form.

You can either:

1. Use one of the existing models as a base, **or**
2. Create your own model and then import it into **Mixamo** to apply the Flock XR armature.

---

## [Characters Only] Process for Downloading a Rigged Model from Mixamo

1. Export from Mixamo as an **FBX** file with just the default **T-Pose**.
2. Import the FBX into **Blender**.
3. Resize if necessary and apply all transformations.
4. Before exporting for Flock XR, clean up the Blender file to remove any unused:
   - Armatures
   - Actions
   - Materials
   - Cameras
   - Lights
5. Export the final file as a **.glb**.

---

## [Optional] Alignment Parts for Rooms and Buildings

When someone positions an object using the pin on its block, Flock XR shows alignment handles on the outside of other models near the camera. Learners click a handle to place their object against a side, lined up with an edge or tucked into a corner.

For models with useful surfaces inside or around them, such as rooms, buildings and furniture, you can give individual parts their own handles. For example, a floor, the inside of a wall or a window sill.

1. In Blender, keep each part you want handles on as a **separate object** with its own geometry.
2. Give it a name that starts with **`align_`**, for example `align_floor`, `align_wall_left` or `align_sill`. Capitals don't matter.
3. Make each part's shape match the surface learners will use. Handles go on the part's bounding box, so a floor that runs underneath the walls puts its corner handles inside the walls. Model the floor to fit inside the room instead.
4. Apply scale as usual. For a part that sits at an angle, such as a wall on a slant, keep its rotation on the object rather than applying it. See the note on rotation below.

Things to know:

- Only parts named `align_` get handles; all other parts are ignored. Mark only the surfaces learners will want to line things up with.
- A part's handles appear when the camera is close enough for the part to look a reasonable size on screen. At most 20 nearby parts show handles at once.
- Handles follow the object's rotation in Blender. If you apply the rotation, it's baked into the mesh and the handles line up with the world axes instead of the part.
- If a Blender object uses several materials, it may export as several meshes that all share its name, and each one gets handles. Give the surface a single material, or split it into its own object.

---

## Process for Adding a Model Directly to Flock XR

1. **Fork** the GitHub repository for the development version of Flock XR.
2. Upload your `.glb` model into the `models` folder.
3. Create a short `README.md` in the same folder describing:
   - The model
   - The source
   - The license
4. _(Optional)_ Edit the config file to include your model name in the dropdown menu — or we can do this part for you.
5. Create a **Pull Request** with a short description of your submission.

Once your Pull Request is submitted, we’ll review it to ensure:

- It loads correctly and the file size is small enough to avoid loading delays.
- Transforms are aligned with our other models.
- **[Characters Only]** Existing animations play correctly.
- The model is suitable for a young, global audience.

After approval:

- Your model will be merged and added to the development version of Flock XR.
- We’ll also create a thumbnail for your model so it appears correctly in the model galleries.

---

## Process for Emailing Your Character to Flock XR

If you prefer, you can email your model directly to **info@flipcomputing.com**.  
Please include:

- Your name (and GitHub username if applicable)
- The model file in `.glb` format
- A short description and license information

We’ll review your submission and handle the upload for you.

The creation of these resources was supported by a [grant from Nlnet](https://nlnet.nl/project/FlockXR).
