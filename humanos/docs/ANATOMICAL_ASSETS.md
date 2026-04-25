# Anatomical Assets Reference

This document specifies the anatomical 3D assets needed for Human OS, where to source them, how to convert them, and how to attribute them.

## Primary source: BodyParts3D

BodyParts3D is the foundational anatomical dataset. It was published in 2009 by the Database Center for Life Science (DBCLS) at the University of Tokyo. Version 4.0 contains over 1,500 anatomical structures keyed to FMA (Foundational Model of Anatomy) identifiers.

**License**: CC BY-SA 2.1 Japan. Permits commercial use including for-profit pharma applications. Requires attribution. The share-alike clause applies to derivative anatomical models, not to your software code or your protein database. Standard interpretation: loading and rendering the meshes is not derivative work; modifying the meshes (decimating, retopologizing, splitting) creates derivative work that should be released under the same license.

**Required attribution text**: 
> "BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan."

Place this text in the Human OS interface footer, in the README, and in any published material that includes screenshots of the 3D body figure.

**Download sources**:
- Official: dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- FTP direct: `ftp://ftp.biosciencedbc.jp/archive/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip` (the 99% reduction version, smaller for web use)
- GitHub mirror with STL conversions: github.com/Kevin-Mattheus-Moerman/BodyParts3D

**Recommended download**: The `isa_BP3D_4.0_obj_99.zip` file is roughly 130 MB and contains all 1,523 OBJ files plus a `parts_list.txt` mapping FMA IDs to file names. The 99% reduction tier has the lowest polygon count, which is ideal for web rendering.

## Alternative source: Z-Anatomy

Z-Anatomy is a curated, retopologized, labeled version of BodyParts3D maintained by Belgian medical illustrator Gauthier Kervyn. It uses the Terminologia Anatomica TA2-2019 nomenclature.

**License**: CC BY-SA 4.0. Same commercial-use-permitted terms as BodyParts3D, slightly newer license version.

**Required attribution text**:
> "3D anatomical models from Z-Anatomy, by Gauthier Kervyn, licensed under CC BY-SA 4.0. Based on BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan."

**Download sources**:
- Official: z-anatomy.com
- GitHub: github.com/Z-Anatomy
- Sketchfab previews: sketchfab.com/Z-Anatomy

**When to use Z-Anatomy over BodyParts3D**: The Z-Anatomy meshes are cleaner, better organized, and include label data. They are optimized for Blender. The downside is that extracting individual structures requires running Blender. For v1, BodyParts3D is faster to integrate. For Phase 6 polish, Z-Anatomy may be worth the extra effort.

## Required structures for Human OS v1

The cardiometabolic disease scope requires roughly 15 anatomical meshes. The exact FMA IDs and BodyParts3D file mappings:

| Organ | FMA ID | BodyParts3D file (approximate) | Purpose in Human OS |
|---|---|---|---|
| Skin (body shell) | FMA7163 | `FMA7163_*.obj` | Translucent holographic outer shell |
| Brain | FMA50801 | `FMA50801_*.obj` | Stroke-related navigation |
| Heart | FMA7088 | `FMA7088_*.obj` | HF, AF, CAD, MI navigation |
| Liver | FMA7197 | `FMA7197_*.obj` | NAFLD, lipid metabolism navigation |
| Pancreas | FMA7198 | `FMA7198_*.obj` | Diabetes navigation |
| Kidney (left) | FMA7204 | `FMA7204_*.obj` | Hypertension navigation |
| Kidney (right) | FMA7203 | `FMA7203_*.obj` | Hypertension navigation |
| Stomach | FMA7148 | optional | Metabolic context |
| Small intestine | FMA7200 | optional | Metabolic context |
| Lungs | FMA7195 | optional | Vascular context |
| Skeleton | FMA7493 | `FMA7493_*.obj` | Structural reference, low opacity |
| Aorta | FMA3734 | optional | Vascular context |

Adipose tissue is tricky. BodyParts3D does not have a clean "adipose" mesh. For v1, approximate it with a translucent shell at the abdomen level, or skip the adipose organ from the click-targets and surface adipose-related proteins through search instead.

The exact filenames in BodyParts3D follow the pattern `FMA{ID}_{description}.obj`. The `parts_list.txt` file in the download maps FMA IDs to the actual filenames. Use it programmatically.

## Conversion pipeline

BodyParts3D ships as OBJ files. Three.js loads OBJ natively but GLTF/GLB is the modern standard. Conversion to GLB:

1. Reduces file size by 60 to 80% versus OBJ
2. Embeds materials and textures (none for BodyParts3D, but useful for Z-Anatomy)
3. Loads faster in browsers
4. Supports compressed binary format

**Conversion is done with Blender**. Blender is free, scriptable, and handles OBJ-to-GLB conversion natively. The script `scripts/convert-meshes.py` automates this. It runs Blender headless via the command line.

**Polygon reduction**: Even the 99% reduction tier in BodyParts3D has more polygons than necessary for web rendering. The conversion script applies an additional Decimate modifier to bring meshes to 5,000 to 10,000 triangles each. Total payload after conversion: under 10 MB for all required organs.

**Output naming convention**: `{organ_name}.glb` in the `assets/` directory. So `liver.glb`, `heart.glb`, etc. Keep names predictable for the Three.js loader.

## Hosting

The GLB files need to be served to the browser. Three options:

1. **Public folder of the Next.js app**: Place the GLBs in `public/assets/anatomy/` and reference them as `/assets/anatomy/liver.glb`. Simplest for v1.

2. **CDN**: Upload to Cloudflare R2, AWS S3, or similar. Faster for global users but adds setup overhead. Worth it if the Human OS becomes widely deployed.

3. **Internal PhrmAI hosting**: For deployment inside the Barnes Organization network, use whatever the standard internal CDN or static hosting solution is. Coordinate with IT.

For v1, use option 1. Migrate to a CDN if performance demands it.

## Asset preparation workflow

This is what the engineer running the build needs to do:

```bash
# Download the BodyParts3D archive
cd scripts
./download-bodyparts3d.sh

# Run the Blender conversion (requires Blender installed)
python3 convert-meshes.py

# Output appears in ../public/assets/anatomy/
ls ../public/assets/anatomy/
# Should show: skin.glb, brain.glb, heart.glb, liver.glb, pancreas.glb, kidney_left.glb, kidney_right.glb, skeleton.glb
```

The scripts directory contains the automation. See `scripts/README.md` for details on each script.

## Verification

After conversion, load each GLB in a Three.js viewer to verify:
- Mesh appears at the expected scale (BodyParts3D uses millimeter units)
- No visible holes, flipped normals, or rendering artifacts
- File size is under 5 MB per organ
- Polygon count is in the 5,000 to 10,000 range

If any mesh fails verification, return to Blender and adjust the Decimate modifier ratio or use the higher-resolution BodyParts3D source (the 95% reduction tier instead of 99%).
