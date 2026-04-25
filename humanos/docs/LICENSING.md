# Licensing

This document captures the licensing requirements for Human OS and the third-party assets it uses.

## Your code

The Human OS application code (everything in `src/`, `pages/`, `scripts/`) can be licensed however Barnes Organization LLC-S chooses. For internal PhrmAI use, no public license is required. If Human OS is ever open-sourced or shared externally, MIT or Apache 2.0 are the standard choices.

The code does not inherit the share-alike clause from BodyParts3D or Z-Anatomy. Loading and rendering anatomical meshes is not derivative work in the standard interpretation of CC BY-SA. Modifying the meshes (decimating, retopologizing, splitting) does create derivative work, in which case the modified meshes must be released under the same license. The conversion script in `scripts/convert-meshes.py` does decimate the meshes; the resulting GLB files are derivative works and should be released under CC BY-SA if Human OS is distributed externally.

For internal PhrmAI use, the share-alike clause is satisfied by attribution alone, since the meshes are not being redistributed externally.

## BodyParts3D attribution

License: Creative Commons Attribution-Share Alike 2.1 Japan
URL: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

Required attribution text:
> "BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan."

Where to display:
- README.md
- Application footer (visible in the UI chrome)
- Any published material that includes screenshots or videos of the 3D body figure
- About / Credits page if the application has one

## Z-Anatomy attribution (if used)

License: Creative Commons Attribution-Share Alike 4.0 International
URL: https://creativecommons.org/licenses/by-sa/4.0/

Required attribution text:
> "3D anatomical models from Z-Anatomy, by Gauthier Kervyn, licensed under CC BY-SA 4.0. Based on BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan."

Where to display: same as BodyParts3D.

## Three.js, React, Next.js

All MIT licensed. No attribution required, though leaving the copyright headers in place if you copy code is good practice.

## Anthropic SDK and Claude API

Use of the Anthropic API is subject to Anthropic's terms of service. The SDK itself is MIT licensed.

For internal PhrmAI deployment, ensure compliance with Barnes Organization external API usage policies and any applicable data residency requirements.

## OpenTargets, AlphaFold, AlphaMissense

These are the underlying data sources for the cardiometabolic-research MCP server, not direct dependencies of Human OS. The licensing for those is handled by the MCP server itself, which is a separate Barnes Organization internal asset.

If Human OS is ever distributed externally and uses the MCP server, the redistribution must respect:
- OpenTargets: CC0 for most data, individual sources may have specific licenses
- AlphaFold: CC BY 4.0 for predictions
- AlphaMissense: CC BY-NC-SA 4.0 (note the non-commercial clause; whether internal R&D at a for-profit entity counts as "non-commercial" is a non-trivial question. For Barnes Organization LLC-S use, run this past counsel before any external distribution. External sharing of AlphaMissense scores definitely requires careful review.)

## Compliance notes

For Barnes Organization LLC-S internal deployment, the licensing posture is mostly clean: BodyParts3D and Z-Anatomy are licensed for commercial pharma use with attribution, and Human OS is internal use only. The one watch item is the AlphaMissense non-commercial clause noted above.

For external sharing or open-sourcing Human OS in the future, the AlphaMissense non-commercial clause is the meaningful restriction. The recommended path is to keep AlphaMissense data inside the MCP server (which Barnes Organization controls) and have Human OS query it as a service, rather than embedding the scores in the application.
