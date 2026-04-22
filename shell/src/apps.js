// The PHRMAI app manifest. Render order = display order.
// Add a new tool by appending an entry here and wiring its dev proxy
// (shell/vite.config.js) and build step (scripts/build.mjs).

export const APPS = [
  {
    id: 'genome-os',
    name: 'GenomeOS',
    tagline: 'Eight-level interactive chromatin explorer',
    description:
      'Zoom the β-globin locus from the nucleus down to individual atoms. Play mitosis, loop extrusion, transcription, replication — with a narrated audio tour.',
    path: '/genome-os/',
    tags: ['Chromatin', '3D', 'Audio tour', 'β-globin'],
    stack: ['Vite', 'React', 'three.js'],
    accent: '#7aa2ff',
    accent2: '#ffd93d',
    glyph: 'nucleus',
    version: 'v0.1',
    status: 'live'
  },
  {
    id: 'protein-viewer',
    name: 'Molecule Viewer',
    tagline: 'Voice-guided Boltz-2 & OpenFold3 structures',
    description:
      'Hands-free 3D viewer for protein structure predictions. Ask the assistant to walk a chain, focus a residue, or launch a guided tour. Powered by Mol*.',
    path: '/protein-viewer/',
    tags: ['Mol*', 'Voice', 'Boltz-2', 'OpenFold3'],
    stack: ['Mol*', 'Web Speech API'],
    accent: '#76b900',
    accent2: '#4ecdc4',
    glyph: 'helix',
    version: 'v0.1',
    status: 'live'
  },
  {
    id: 'phrmai-sdk',
    name: 'PHRMAI SDK',
    tagline: 'Build your own PHRMAI tools',
    description:
      'A TypeScript library for the shared primitives across every tool — 3D scaffolding, audio tours, click-to-learn info cards, imaging panels. Coming soon.',
    tags: ['Library', 'TypeScript', 'Coming soon'],
    stack: ['TypeScript', 'React', 'three.js'],
    accent: '#a78bfa',
    accent2: '#f472b6',
    glyph: 'sdk',
    version: '—',
    status: 'coming-soon'
  }
];
