#!/usr/bin/env python3
"""
Human OS - BodyParts3D mesh conversion pipeline.

Reads OBJ files from the BodyParts3D part-of archive, joins all parts that
belong to one anatomical concept (FMA ID), applies polygon reduction via
Blender, and exports each concept as a single GLB for Three.js consumption.

Usage:
    python3 scripts/convert-meshes.py

Requires:
    Blender installed (Mac: /Applications/Blender.app or BLENDER_PATH env var)
    The BodyParts3D part-of archive extracted at
        assets/bodyparts3d-source/extracted-partof/partof_BP3D_4.0_obj_99/
    The mapping file
        assets/bodyparts3d-source/partof_element_parts.txt

Writes GLB files to public/assets/anatomy/.

The part-of archive expresses whole organs as compositions of many FJ####.obj
sub-meshes (e.g. the heart is ~80 files: chambers, valves, vessels, walls).
This script reads partof_element_parts.txt to get the FJ list per FMA, then
spawns Blender headless to import them all, join into one mesh, decimate,
and export as a single GLB.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_BASE = PROJECT_ROOT / "assets" / "bodyparts3d-source"
SOURCE_DIR = SOURCE_BASE / "extracted-partof" / "partof_BP3D_4.0_obj_99"
MAPPING_FILE = SOURCE_BASE / "partof_element_parts.txt"
OUTPUT_DIR = PROJECT_ROOT / "public" / "assets" / "anatomy"

# FMA IDs verified against partof_parts_list_e.txt on the DBCLS LATEST archive.
# polys is the post-decimation triangle target. The 99% reduction tier already
# ships low-poly, so the decimate is a soft cap, not a heavy reduction.
REQUIRED_ORGANS = {
    "skin.glb":         {"fma": "FMA7163",  "polys": 15000, "name": "Skin"},
    "brain.glb":        {"fma": "FMA50801", "polys": 12000, "name": "Brain"},
    "heart.glb":        {"fma": "FMA7088",  "polys": 12000, "name": "Heart"},
    "liver.glb":        {"fma": "FMA7197",  "polys": 8000,  "name": "Liver"},
    "pancreas.glb":     {"fma": "FMA7198",  "polys": 4000,  "name": "Pancreas"},
    "kidney_left.glb":  {"fma": "FMA7205",  "polys": 4000,  "name": "Left kidney"},
    "kidney_right.glb": {"fma": "FMA7204",  "polys": 4000,  "name": "Right kidney"},
    "skeleton.glb":     {"fma": "FMA23876", "polys": 30000, "name": "Skeleton (in vivo)"},
}


def find_blender():
    if "BLENDER_PATH" in os.environ:
        return os.environ["BLENDER_PATH"]
    candidates = [
        "/Applications/Blender.app/Contents/MacOS/Blender",
        shutil.which("blender"),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


def load_fma_to_fj_map():
    """Parse partof_element_parts.txt into {fma_id: [fj_id, ...]}."""
    if not MAPPING_FILE.exists():
        print(f"ERROR: Mapping file not found: {MAPPING_FILE}")
        sys.exit(1)
    mapping = {}
    with open(MAPPING_FILE, encoding="utf-8") as f:
        next(f)  # header
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            fma, _name, fj = parts[0], parts[1], parts[2]
            mapping.setdefault(fma, []).append(fj)
    return mapping


def fj_to_obj_path(fj_id):
    """Resolve an FJ id to its OBJ file in the source dir, if it exists."""
    p = SOURCE_DIR / f"{fj_id}.obj"
    return p if p.exists() else None


def build_blender_script(obj_files, output_glb, target_polys):
    """Generate the Blender Python script that joins, decimates, exports."""
    obj_list_repr = "[\n" + ",\n".join(f'        r"{p}"' for p in obj_files) + "\n    ]"
    return f'''
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

obj_files = {obj_list_repr}

imported = []
for path in obj_files:
    before = set(bpy.context.scene.objects)
    try:
        # BodyParts3D is Z-up with +Y as anterior (front of body).
        bpy.ops.wm.obj_import(filepath=path, up_axis="Z", forward_axis="Y")
    except (AttributeError, TypeError):
        bpy.ops.import_scene.obj(filepath=path, axis_up="Z", axis_forward="Y")
    after = set(bpy.context.scene.objects)
    imported.extend(after - before)

if not imported:
    raise SystemExit("No objects imported")

bpy.ops.object.select_all(action="DESELECT")
for o in imported:
    if o.type == "MESH":
        o.select_set(True)
bpy.context.view_layer.objects.active = imported[0]

if len([o for o in imported if o.type == "MESH"]) > 1:
    bpy.ops.object.join()

obj = bpy.context.view_layer.objects.active
if obj is None or obj.type != "MESH":
    raise SystemExit("Joined object is not a mesh")

current_polys = len(obj.data.polygons)
target = {target_polys}
if current_polys > target:
    ratio = max(target / current_polys, 0.01)
    decimate = obj.modifiers.new(name="Decimate", type="DECIMATE")
    decimate.ratio = ratio
    bpy.ops.object.modifier_apply(modifier="Decimate")

bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="MEDIAN")
obj.location = (0, 0, 0)

max_dim = max(obj.dimensions) if obj.dimensions else 0
if max_dim > 0:
    s = 1.0 / max_dim
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

mat = bpy.data.materials.new(name="OrganMaterial")
mat.use_nodes = True
if obj.data.materials:
    obj.data.materials[0] = mat
else:
    obj.data.materials.append(mat)

bpy.ops.export_scene.gltf(
    filepath=r"{output_glb}",
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_materials="EXPORT",
)

print("DONE: " + r"{output_glb}" + " polys=" + str(len(obj.data.polygons)))
'''


def convert_one(blender_path, obj_files, output_glb, target_polys, name):
    print(f"  Converting {name} ({len(obj_files)} parts)...")
    script = build_blender_script([str(p) for p in obj_files], str(output_glb), target_polys)
    result = subprocess.run(
        [blender_path, "--background", "--python-expr", script],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0 or not output_glb.exists():
        tail = (result.stderr or result.stdout or "")[-800:]
        print(f"    FAILED ({result.returncode}): {tail}")
        return False
    size_kb = output_glb.stat().st_size / 1024
    print(f"    OK ({size_kb:.1f} KB) -> {output_glb.name}")
    return True


def main():
    print("===========================================")
    print("Human OS - Mesh Conversion Pipeline")
    print("===========================================")
    print()

    blender = find_blender()
    if not blender:
        print("ERROR: Blender not found.")
        print("Install: brew install --cask blender")
        print("Or set BLENDER_PATH to the executable.")
        sys.exit(1)
    print(f"Blender: {blender}")

    if not SOURCE_DIR.exists():
        print(f"ERROR: Source directory not found: {SOURCE_DIR}")
        print("Run scripts/download-bodyparts3d.sh first.")
        sys.exit(1)
    print(f"Source: {SOURCE_DIR}")

    mapping = load_fma_to_fj_map()
    print(f"Mapping: {len(mapping)} FMA ids loaded from {MAPPING_FILE.name}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output: {OUTPUT_DIR}")
    print()

    successes, failures, missing = 0, 0, 0
    for output_name, cfg in REQUIRED_ORGANS.items():
        print(f"[{cfg['name']}] FMA: {cfg['fma']}")
        fj_ids = mapping.get(cfg["fma"], [])
        if not fj_ids:
            print(f"    MISSING: no FJ entries for {cfg['fma']}")
            missing += 1
            print()
            continue
        obj_paths = [fj_to_obj_path(fj) for fj in fj_ids]
        obj_paths = [p for p in obj_paths if p is not None]
        if not obj_paths:
            print(f"    MISSING: {len(fj_ids)} FJ ids mapped but no OBJ files on disk")
            missing += 1
            print()
            continue
        if len(obj_paths) < len(fj_ids):
            print(f"    NOTE: {len(obj_paths)}/{len(fj_ids)} OBJ files present; proceeding")

        output_glb = OUTPUT_DIR / output_name
        if convert_one(blender, obj_paths, output_glb, cfg["polys"], cfg["name"]):
            successes += 1
        else:
            failures += 1
        print()

    print("===========================================")
    print(f"Conversion complete: {successes} OK, {failures} failed, {missing} missing")
    print("===========================================")

    if successes > 0:
        print()
        print("GLB files written to:")
        print(f"  {OUTPUT_DIR}")
        print()
        print("Next: refresh http://localhost:3000")

    if failures > 0 or missing > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
