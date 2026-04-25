# Build Scripts

This directory contains the automation scripts for setting up the Human OS project. They are designed to be run in sequence by Claude Code or by an engineer.

## Sequence

```bash
bash scripts/setup.sh                    # Initialize Next.js project
bash scripts/download-bodyparts3d.sh     # Download anatomical assets
python3 scripts/convert-meshes.py        # Convert OBJ to GLB (requires Blender)
```

## setup.sh

Initializes a Next.js project with TypeScript, Tailwind, Three.js, and the Anthropic SDK. Creates tsconfig, next.config.js, tailwind.config, gitignore, and an env template. Idempotent: safe to re-run.

Prerequisites:
- Node.js 18 or higher
- npm

## download-bodyparts3d.sh

Downloads the BodyParts3D archive from DBCLS Japan via FTP. Falls back to the GitHub mirror by Kevin-Mattheus-Moerman if FTP fails. Extracts the archive into `assets/bodyparts3d-source/extracted/`.

Prerequisites:
- curl or wget for download
- unzip for extraction
- Optionally git for the GitHub fallback

The download is roughly 130 MB. The extracted contents are roughly 200 MB. Both are gitignored.

## convert-meshes.py

Runs Blender headless to convert the relevant OBJ files into GLB files for Three.js. Applies polygon reduction so each mesh is in the 4,000 to 20,000 triangle range. Output goes to `public/assets/anatomy/`.

Prerequisites:
- Python 3.7 or higher
- Blender installed (https://www.blender.org/download/)

Set the `BLENDER_PATH` environment variable if Blender is not on the standard PATH:
```bash
export BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender
python3 scripts/convert-meshes.py
```

The conversion takes roughly 30 seconds per organ on a modern machine. Total runtime: 4 to 8 minutes for all 8 organs.

## Output verification

After running all three scripts, you should have:
```
public/assets/anatomy/
  skin.glb
  brain.glb
  heart.glb
  liver.glb
  pancreas.glb
  kidney_left.glb
  kidney_right.glb
  skeleton.glb
```

Total size: under 20 MB. Open any of them in a GLB viewer (online viewers like gltf-viewer.donmccurdy.com work well) to verify the meshes look correct before integrating with Three.js.

## Troubleshooting

**FTP download fails**: The DBCLS FTP server is occasionally unavailable. Use the GitHub mirror at github.com/Kevin-Mattheus-Moerman/BodyParts3D, which has STL files instead of OBJ. The Blender script handles both formats with minor modifications.

**Blender not found**: Install Blender from blender.org. On macOS, the typical path is `/Applications/Blender.app/Contents/MacOS/Blender`. Set the `BLENDER_PATH` environment variable if needed.

**Conversion produces empty GLB files**: Check that the source OBJ files actually exist in `assets/bodyparts3d-source/extracted/`. The Blender script logs which OBJ it tried to import.

**Missing FMA IDs**: BodyParts3D version 4.0 might use slightly different file naming than version 3.0. The convert script searches for files matching `FMA{id}_*.obj` and falls back to `FMA{id}.obj`. If neither matches, list the directory contents to see what is actually there and update the search pattern in `convert-meshes.py`.
