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

## Process for Adding a Model Directly to Flock XR

1. **Fork** the GitHub repository for the development version of Flock XR.  
2. Upload your `.glb` model into the `models` folder.  
3. Create a short `README.md` in the same folder describing:
   - The model  
   - The source  
   - The license  
4. *(Optional)* Edit the config file to include your model name in the dropdown menu — or we can do this part for you.  
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


The creation of these resources was supported by a grant from Nlnet.
