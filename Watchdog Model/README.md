# Watchdog Model — Face-Tracking Avatar

This folder is **only for creating the 3D model** used in the MediaPipe Face Virtual Avatar demo. The goal is to produce a **watchdog head** in the same format as the raccoon example so it works with face tracking and blendshapes.

## What the raccoon example is

- **Format:** A **3D GLB model** (`raccoon_head.glb`), not a 2D image.
- **Structure:**
  - A **root bone** (first bone in the scene) — used for positioning/rotation.
  - One or more **meshes** that have **morph targets (blendshapes)** with **exact MediaPipe/ARKit names** (e.g. `eyeBlinkLeft`, `mouthSmileLeft`, `jawOpen`).
- **Usage:** The demo applies the face transformation matrix to the model and drives those blendshapes from the webcam, so the avatar moves with your face.

## What we need from your watchdog image

Your **Watchdog Image.png** (German Shepherd–style head, black/tan, big eyes, pointed ears) is the **visual reference**. We are building a **new 3D model from scratch** that:

1. **Looks like** that watchdog (shape, ears, muzzle, eyes).
2. **Behaves like** the raccoon: same GLB structure (root bone + meshes with the same blendshape names).

So: **same type of asset as the raccoon** (3D GLB with bone + blendshapes), **styled as your watchdog**.

## Pipeline (creating the model)

1. **Run the Blender script** in this folder to generate a watchdog-style head with:
   - A single root bone (for the demo’s `Avatar` class).
   - One mesh with all 51 MediaPipe blendshape **names** as shape keys (neutral = no deformation; you can sculpt real expressions later).
2. **Optional:** In Blender, assign **Watchdog Image.png** as the head texture so the colors match your reference.
3. **Export** the scene as **GLB** (File → Export → glTF 2.0 (.glb)):
   - Enable **Shape Keys** (morph targets) in the export options.
   - Include the armature if you want the root bone in the file (the demo expects at least one bone).
4. Use the exported **.glb** in your Face Virtual Avatar demo (same way you load `raccoon_head.glb`).

### Running the Blender script

1. Open **Blender**.
2. Switch to the **Scripting** workspace.
3. Open **create_watchdog_model.py** (or paste its contents into the text editor).
4. Click **Run Script** (or Alt+P).
5. The scene will be cleared and replaced with **WatchdogHead** (mesh) and **Armature** with one bone named **root**.
6. Optionally add a material to the head and set **Watchdog Image.png** as the base color texture.
7. File → Export → glTF 2.0 (.glb) → enable **Shape Keys** → export (e.g. `watchdog_head.glb`).

## Mouth: teeth, tongue, no black hole

When the mouth opens (driven by **jawOpen** and other mouth blendshapes), the viewer should see **teeth** and **tongue** inside—not an empty dark hole. See **ART_GUIDE.md** for how to model teeth and tongue in Blender so the mouth reads as 3D.

**Tongue tracking:** MediaPipe’s face landmarker does **not** track tongue-out yet. The model includes a **tongueOut** shape key (0 = tongue in mouth, 1 = tongue out). Your demo can set it to 0 for now; when you add tongue tracking (or a test slider), drive **tongueOut** so the avatar’s tongue sticks out when yours does. The model is ready for that.

## Files in this folder

| File | Purpose |
|------|--------|
| `Watchdog Image.png` | Your 2D reference — design and colors for the 3D head. |
| `MediaPipe Face Virtual Avatar Demo.txt` | Reference code showing how the raccoon GLB is loaded and driven (includes tongueOut note). |
| `README.md` | This file — what the raccoon is and how we turn the watchdog image into a usable model. |
| `create_watchdog_model.py` | Blender script: build watchdog head mesh + root bone + 51 MediaPipe + tongueOut shape keys. |
| `blendshape_names.txt` | List of the 51 MediaPipe blendshape names (for scripts and manual checks). |
| `ART_GUIDE.md` | Mouth art: teeth, tongue, no black hole; tongueOut for future tongue tracking. |

## If something is confusing

- **“Same type of image as the raccoon”** → We treat the raccoon as a **3D model** (GLB). Your “image” is the **watchdog design**; the **usable asset** for the project is a **3D GLB** that looks like that watchdog and has the same structure as the raccoon.
- **“From scratch”** → The geometry and blendshape names are created by the script; you can refine shape and sculpt real expressions in Blender afterward.
- **“This folder solely for creating the model”** → Only model-creation assets and scripts live here; the actual demo/app can live in another folder and just load the exported GLB.

If you want to change the pipeline (e.g. different tool than Blender or a different naming convention), say how you’d like to work and we can adapt the steps.
