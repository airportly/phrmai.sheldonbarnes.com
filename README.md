# PHRMAI · toward HumanOS

Interactive pharma-AI tools by [Sheldon Barnes](https://www.sheldonbarnes.com),
deployed to **https://phrmai.sheldonbarnes.com/**.

The site works like an app store: a shell landing page lists every tool as a
card; clicking a card launches the tool. Over time the collection accretes
into **HumanOS** — a unified interactive mental model of human biology for
pharma teams.

## Tools

| Card | Tool | Stack |
|---|---|---|
| HumanOS | Holographic clinical AI for cardiometabolic discovery: rotating 3D body, 1,903 disease-associated proteins surfaced via four views (body, catalog, constellation, 3D galaxy), real AlphaFold confidence + AlphaMissense variants from the cardiometabolic-research MCP | Next.js · React · three.js · MCP |
| ChromatinLens | 8-level interactive chromatin explorer (β-globin locus) with mitosis, loop extrusion, transcription, replication, and a narrated audio tour | Vite · React · three.js |
| Molecule Viewer | Hands-free Boltz-2 / OpenFold3 structure viewer | Static HTML · Mol* (CDN) · Web Speech API |
| PHRMAI SDK | Shared primitives for new tools (coming soon) | TypeScript · React · three.js |

## Structure

```
phrmai.sheldonbarnes.com/
├── shell/                  # PHRMAI app-store landing (Vite)
│   ├── src/
│   │   ├── apps.js         # The app manifest — edit to add a tool
│   │   ├── glyphs.js       # Inline SVG icons per tool
│   │   ├── main.js         # Renders cards, handles launches
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js      # Dev proxy to each tool
│
├── humanos/                # Next.js, statically exported with basePath=/humanos
├── chromatin-lens/         # Vite + React + three.js (own package.json)
├── protein-viewer/         # Static HTML + Mol* from CDN
│
├── scripts/
│   ├── build.mjs           # Builds shell + every tool into dist/
│   └── install-all.mjs     # Installs deps across every sub-project
│
├── package.json            # Root — one dev / build / start
├── vercel.json             # Vercel config
└── dist/                   # Generated output (gitignored)
    ├── index.html          # Shell landing
    ├── assets/             # Shell bundle
    ├── chromatin-lens/          # /chromatin-lens/ route
    └── protein-viewer/     # /protein-viewer/ route
```

## Local development — one command

```bash
npm run dev
```

That:
1. Installs dependencies for every sub-project if missing (first run only)
2. Concurrently starts:
   - **Shell** on `http://localhost:3000` (the one you actually open)
   - **ChromatinLens** Vite dev server on port 5173
   - **Protein Viewer** static server on port 5174
3. The shell **proxies `/chromatin-lens` and `/protein-viewer`** to their real dev servers, so everything appears as a single origin at `localhost:3000`

Open **http://localhost:3000** → landing page → click a card → tool launches in the same tab with full hot-reload.

Want to iterate on a single tool without the shell? Each tool's dev server is reachable on its own port (ChromatinLens 5173, protein viewer 5174), or run them individually:

```bash
npm run dev:chromatin-lens        # ChromatinLens alone
npm run dev:protein-viewer   # protein viewer alone
npm run dev:shell            # landing page alone (won't proxy without the others)
```

## Production build

```bash
npm run build          # builds everything into ./dist/
npm run preview        # serves dist/ locally on port 3000
npm start              # shortcut: build + preview
```

## Deploy (Vercel)

1. Import this repo into Vercel
2. Framework preset: **Other** (vercel.json pins build command + output dir)
3. Custom domain: `phrmai.sheldonbarnes.com`
4. Every `git push` rebuilds and redeploys all tools

## Adding a new tool

1. **Create the folder** at the repo root — e.g. `pathway-browser/` — with whatever stack fits
2. **Register it** in `shell/src/apps.js` (name, tagline, tags, accent colors, glyph id)
3. **Add a dev proxy** in `shell/vite.config.js` pointing `/<tool-slug>` → its dev port
4. **Add a build step** in `scripts/build.mjs` (either `run('npm run build', …)` + copy, or a straight folder copy for static tools)
5. If it has its own `package.json`, add it to `PROJECTS` in `scripts/install-all.mjs`
6. **Optional**: add an SVG glyph in `shell/src/glyphs.js`
7. `git push` — Vercel rebuilds

## The PHRMAI SDK (in progress)

As the tools stabilize, the common primitives will be extracted into a shared
library (working title: `@phrmai/sdk`):

- 3D scaffolding for multi-scale zoom (the ChromatinLens scale/focus pipeline)
- Audio tour orchestration (Web Speech API player)
- Click-to-learn info cards
- Imaging panel with stylized schematic + external-source links
- Shared dark-mode design tokens

Future tools will import these instead of re-implementing. That's the path to
HumanOS — not a single monolith, but a portfolio of tools that speak a shared
visual and interaction language.

## HumanOS deployment notes

HumanOS is the only Next.js tool in the portfolio. The build pipeline statically exports it via `npm run build:static` (in `humanos/`), which:

1. Renames `pages/api/` to `.api-backup/` so the export doesn't trip on dynamic routes.
2. Runs `next build` with `EXPORT=1` and `NEXT_PUBLIC_BASE_PATH=/humanos`.
3. Restores the `pages/api/` folder afterward.

The output lands in `humanos/out/`, which the root `scripts/build.mjs` copies into `dist/humanos/`.

**Live AI is intentionally off in this static build.** The UI shows an "AI offline" badge and falls back to local keyword matching against the snapshot. To wire live Anthropic Claude:

1. Add a Vercel Edge Function at the repo root: `api/humanos-chat.ts`. Reuse the implementation in `humanos/src/lib/claude-client.ts`.
2. Set `ANTHROPIC_API_KEY` (and optionally `MCP_SERVER_URL`) in Vercel env vars.
3. In `humanos/src/components/HumanOS.tsx`, change the two `apiPath('/api/chat')` calls to `apiPath('/api/humanos-chat')` so they hit the Edge function at the phrmai root rather than the (absent) Next.js API route.

This keeps HumanOS itself fully static — no Vercel Next.js framework preset needed — while still routing live AI calls through a server-side endpoint that keeps the API key out of the browser.

## License

All rights reserved. © Sheldon Barnes.
