# PHRMAI · toward HumanOS

Interactive pharma-AI tools by [Sheldon Barnes](https://www.sheldonbarnes.com),
deployed to **https://phrmai.sheldonbarnes.com/**.

Each tool is a self-contained folder. At build time they are collected into
`dist/<tool-name>/` and served statically. Over time these tools accrete into
a unified **HumanOS** — an interactive mental model of human biology for
pharma teams.

## Tools

| Path | Tool | Stack |
|---|---|---|
| [`genome-os/`](./genome-os) | 8-level interactive chromatin explorer (β-globin locus) with mitosis, loop extrusion, transcription, replication, and a narrated audio tour | Vite · React · three.js · @react-three/fiber |
| [`protein-viewer/`](./protein-viewer) | Hands-free 3D Boltz-2 / OpenFold3 structure viewer with voice control | Static HTML · Mol* (CDN) · Web Speech API |

## Structure

```
phrmai.sheldonbarnes.com/
├── genome-os/              # Vite project — own package.json
├── protein-viewer/         # Plain HTML + Mol* via CDN — no build
├── scripts/
│   ├── build.mjs           # Root build: collects tools into dist/
│   └── landing.html        # Landing page → dist/index.html
├── package.json            # Root build entry point
├── vercel.json             # Vercel deployment config
└── dist/                   # Generated — each tool lives under dist/<tool>/
    ├── index.html          # Landing page listing all tools
    ├── genome-os/
    └── protein-viewer/
```

## Local development

Run one tool at a time using its own dev server:

```bash
# GenomeOS (Vite, port 5173)
npm run dev:genome-os

# Protein viewer (http-server, port 5174)
npm run dev:protein-viewer
```

Each tool is self-contained — you can `cd` into any tool folder and use its
native workflow.

## Build

```bash
npm run build
```

This runs `scripts/build.mjs`, which:

1. Wipes `dist/`
2. `npm install` + `npm run build` inside `genome-os/`, copies its `dist/` to `dist/genome-os/`
3. Copies `protein-viewer/` straight to `dist/protein-viewer/`
4. Copies `scripts/landing.html` to `dist/index.html`

## Deploy (Vercel)

1. Import this repo into Vercel
2. Framework preset: **Other** (vercel.json pins the rest)
3. Add custom domain `phrmai.sheldonbarnes.com`
4. Future tools auto-deploy on every `git push`

## Adding a new tool

1. Create a new folder at the repo root (e.g., `pathway-browser/`)
2. If it needs a build step, give it its own `package.json`
3. Add its build step to `scripts/build.mjs` — either `run('npm run build', ...)` + copy, or just copy if it's static
4. Add a card to `scripts/landing.html`
5. `git push` — Vercel rebuilds everything

## License

All rights reserved. © Sheldon Barnes.
