# create_watchdog_model.py
# Run this script inside Blender (Scripting workspace -> Run Script).
# Creates a watchdog-style head mesh with MediaPipe/ARKit blendshape names
# and a root bone, matching the structure of the raccoon example for the
# Face Virtual Avatar demo.
#
# After running: optionally assign "Watchdog Image.png" as texture,
# sculpt blend shapes for expressions, then export as GLB.

import bpy
import math

# All 52 MediaPipe Face Landmarker blendshape names (index 0 = _neutral).
# We add Basis (neutral) plus 51 shape keys; _neutral is omitted as Basis is the neutral.
BLENDSHAPE_NAMES = [
    "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
    "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
    "eyeBlinkLeft", "eyeBlinkRight",
    "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight",
    "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight",
    "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight",
    "jawForward", "jawLeft", "jawOpen", "jawRight",
    "mouthClose", "mouthDimpleLeft", "mouthDimpleRight",
    "mouthFrownLeft", "mouthFrownRight", "mouthFunnel", "mouthLeft",
    "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
    "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper",
    "mouthShrugLower", "mouthShrugUpper", "mouthSmileLeft", "mouthSmileRight",
    "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft", "mouthUpperUpRight",
    "noseSneerLeft", "noseSneerRight",
]

# Extra shape key for future tongue tracking. MediaPipe doesn't output this yet;
# your app can drive it (0 = tongue in mouth, 1 = tongue out) when you add tracking.
EXTRA_BLENDSHAPE_NAMES = ["tongueOut"]


def clear_scene():
    """Remove default scene objects so we start clean."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def create_watchdog_head_mesh():
    """
    Create a simple dog head mesh (watchdog / German Shepherd style):
    rounded head shape from a UV sphere, scaled like a head with a bit of
    muzzle length. You can refine ears and muzzle in Blender after running.
    """
    # Base head: UV sphere (good base for face-like morph targets)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0)
    head = bpy.context.active_object
    head.name = "WatchdogHead"
    # Head-like proportions: slightly elongated (muzzle) and a bit wide
    head.scale = (1.05, 1.2, 0.95)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    return head


def add_root_bone(head_object):
    """
    Add an armature with a single root bone (required by the Avatar class
    in the Face Virtual Avatar demo). The bone is placed at the head origin.
    """
    # Add armature in Object mode
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.armature_add(enter_editmode=False, align="WORLD", location=(0, 0, 0))
    armature = bpy.context.active_object
    armature.name = "Armature"

    bpy.ops.object.mode_set(mode="EDIT")
    bone = armature.data.edit_bones["Bone"]
    bone.name = "root"
    bone.head = (0, 0, 0)
    bone.tail = (0, 0, 0.2)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Parent head to armature so they export together; demo applies matrix to scene root
    head_object.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    return armature


def add_blendshape_keys(mesh_object):
    """
    Add shape keys with exact MediaPipe blendshape names. Each key is a copy of
    Basis (neutral) so the model loads correctly; you can sculpt real expressions later.
    """
    if mesh_object.type != "MESH":
        return
    bpy.ops.object.select_all(action="DESELECT")
    mesh_object.select_set(True)
    bpy.context.view_layer.objects.active = mesh_object
    mesh = mesh_object.data
    # Ensure Basis exists (Blender creates it when you add the first shape key)
    if not mesh.shape_keys:
        bpy.ops.object.shape_key_add(from_mix=False)
    basis = mesh.shape_keys.key_blocks["Basis"]

    for name in BLENDSHAPE_NAMES + EXTRA_BLENDSHAPE_NAMES:
        if name in mesh.shape_keys.key_blocks:
            continue
        # Add shape key; from_mix=False copies current positions (Basis)
        sk = mesh.shape_keys.key_blocks.new(name=name, from_mix=False)
        for i in range(len(mesh.vertices)):
            sk.data[i].co = basis.data[i].co.copy()


def main():
    clear_scene()
    head = create_watchdog_head_mesh()
    add_blendshape_keys(head)
    add_root_bone(head)
    # Center view on the head
    bpy.ops.object.select_all(action="DESELECT")
    head.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    print("Watchdog model created: WatchdogHead mesh + root bone + 51 MediaPipe + tongueOut shape keys.")
    print("Next: Add teeth + tongue geometry so mouth open shows 3D interior (see ART_GUIDE.md).")
    print("      Optionally assign 'Watchdog Image.png' as texture, then File -> Export -> glTF 2.0 (.glb)")


if __name__ == "__main__":
    main()
