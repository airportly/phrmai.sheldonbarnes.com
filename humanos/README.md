# Human OS

A holographic, voice-interactive clinical AI interface for cardiometabolic drug discovery. Built on the Cardiometabolic Research MCP server, with Z-Anatomy and BodyParts3D as the anatomical rendering layer and Claude as the reasoning layer.

## What this is

Human OS is the user-facing interface for a Clinical AI Center of Excellence vision. It puts the human body at the center of the drug discovery workflow, with a rotating 3D anatomical model as the primary navigation primitive and eight context cards (molecular structure, protein binding, signaling pathways, ADME, patient population variance, dark proteome, toxicity, unknown unknowns) that populate based on what the user clicks or asks about.

Every piece of data the user sees is grounded in a curated cardiometabolic disease database. Nothing is hallucinated. The architectural argument is that grounded MCP retrieval makes a clinical AI interface trustworthy in a way that pure language model recall cannot.

## Project structure

- `docs/` - Vision document, build phases, design specifications
- `scripts/` - Build pipeline, BodyParts3D conversion, asset preparation
- `assets/` - Anatomical models after conversion (created by build script)
- `src/components/` - React components for the body, cards, chat, voice
- `src/lib/` - MCP integration, Claude API wrapper, FMA mapping logic
- `src/data/` - Static data (FMA-to-protein mapping, disease metadata)
- `public/` - Static assets served by Next.js

## Where to start

1. Read `docs/VISION.md` for the strategic context
2. Read `docs/BUILD_PHASES.md` for the execution sequence
3. Read `docs/DESIGN_SPEC.md` for the visual language
4. Run `scripts/setup.sh` to initialize the Next.js project
5. Run `scripts/download-bodyparts3d.sh` to fetch the anatomical assets
6. Run `scripts/convert-meshes.py` (requires Blender) to produce GLB files
7. Build Phase 1 per the build phases document

## Status

This is a handoff package from a chat conversation with Claude. The architectural decisions are documented. The data integration is wired through the cardiometabolic-research MCP server. The next step is execution by Claude Code or a human engineer using these documents as the specification.

## License notes

- Z-Anatomy is CC BY-SA 4.0
- BodyParts3D is CC BY-SA 2.1 Japan
- Both require attribution. See `docs/LICENSING.md` for the exact attribution text.
- Your software code and protein database are not subject to the share-alike clause unless you modify the anatomical meshes. Standard interpretation is that loading and rendering the meshes is not modification.
