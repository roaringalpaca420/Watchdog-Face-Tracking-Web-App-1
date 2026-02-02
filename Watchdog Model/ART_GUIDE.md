# Mouth Art Guide: Teeth, Tongue, No Black Hole

The goal is for the viewer to see a **real 3D mouth** when the avatar opens up—**teeth** and **tongue** inside—not a dark hole. The **tongue stays in the mouth** when the mouth opens; optionally it can stick out when you add tongue tracking later.

## Why this matters

- **jawOpen** and other mouth blendshapes will open the mouth in the demo. If you don’t model the interior, the mouth will look like an empty black hole.
- Adding **teeth** and **tongue** (and maybe gums) makes it read as a proper 3D head and sells the expression.

## What to model in Blender

### 1. Teeth

- **Upper and lower teeth** (or at least a row the viewer can see when the mouth opens).
- You can:
  - Model them as part of the head mesh (mouth interior faces), or
  - Use **separate meshes** (e.g. “UpperTeeth”, “LowerTeeth”) parented to the same armature so they move with the head.
- **Visibility:** They should be visible when **jawOpen** (and mouth-open blendshapes) are active. If teeth are on the head mesh, your **jawOpen** shape key should open the mouth and reveal them. If teeth are separate objects, they’re always visible; just position them so they sit naturally inside the open mouth.

### 2. Tongue

- **Tongue** should sit **inside the mouth** so when the mouth opens, the viewer sees the tongue (and teeth), not a void.
- **Two states:**
  - **Mouth open, tongue in:** Tongue visible inside the mouth (driven by **jawOpen** / mouth open). No extra tracking needed.
  - **Tongue stuck out:** The model has a **tongueOut** shape key. Right now MediaPipe doesn’t track tongue, so in the demo you’ll keep **tongueOut** at 0. When you add tongue tracking later (or a test slider), you’ll drive **tongueOut** (0 = in, 1 = out) so the tongue can stick out when the user sticks theirs out.

### 3. No “corny black hole”

- Avoid a single dark opening with no interior. Add at least:
  - Teeth (upper/lower or a visible row).
  - Tongue (visible when mouth is open).
- Optionally: gums, roof of mouth, or a simple mouth cavity color so it reads as 3D.

## Pipeline in Blender (after running the script)

1. **Run** `create_watchdog_model.py` so you have the head mesh + all shape keys (including **tongueOut**).
2. **Sculpt / model** the mouth interior:
   - Cut or shape the mouth opening on the head so **jawOpen** (and other mouth keys) open it clearly.
   - Add teeth (separate objects or part of the head).
   - Add a tongue mesh (inside the mouth; you can add a **tongueOut** deformation later so it can stick out).
3. **Sculpt shape keys** so **jawOpen** opens the mouth and reveals teeth + tongue; **mouthSmileLeft/Right**, **mouthFrownLeft/Right**, etc. look good.
4. **Optional:** Sculpt **tongueOut** on the tongue (or a tongue part of the mesh) so when that key is 1, the tongue moves forward/out. Leave it at 0 in the demo until you have tongue tracking.

## Demo / app side

- **Mouth open/close:** Already driven by MediaPipe (**jawOpen**, **mouthSmileLeft/Right**, etc.). No change needed for teeth/tongue visibility—that’s all in the GLB art.
- **Tongue out:** MediaPipe doesn’t output tongue yet. The GLB has a **tongueOut** morph target. In your Face Virtual Avatar demo, after you call `avatar.updateBlendshapes(coefsMap)`, you can set:
  - `coefsMap.set("tongueOut", 0)` for now (tongue stays in), or
  - When you add a tongue tracker (or a test slider): `coefsMap.set("tongueOut", tongueOutValue)` (0 = in, 1 = out).

That way the mouth reads as 3D (teeth + tongue, no black hole), and the model is ready for tongue-out tracking when you have it.
