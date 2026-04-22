// Root build: collects every tool's static output into ./dist/<tool-name>/
// and builds the PHRMAI shell into dist/ (so the landing page lives at the root).
// Vercel runs `npm run build` at the repo root → serves ./dist/ at phrmai.sheldonbarnes.com.

import { execSync } from 'node:child_process';
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const header = (s) => console.log(`\n\x1b[36m▸ ${s}\x1b[0m`);

async function clean() {
  header('Cleaning dist/');
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST);
}

// Shell (Vite) — builds to shell/dist, we copy contents to the root of ./dist/
async function buildShell() {
  header('Building shell (PHRMAI landing)');
  const tool = path.join(ROOT, 'shell');
  run('npm install --no-audit --no-fund', tool);
  run('npm run build', tool);
  await cp(path.join(tool, 'dist'), DIST, { recursive: true });
  console.log('  → dist/ (landing page at the root)');
}

// GenomeOS (Vite) — base is /genome-os/, builds to genome-os/dist, copy to dist/genome-os/
async function buildGenomeOS() {
  header('Building genome-os (Vite + React + r3f)');
  const tool = path.join(ROOT, 'genome-os');
  run('npm install --no-audit --no-fund', tool);
  run('npm run build', tool);
  const out = path.join(DIST, 'genome-os');
  await cp(path.join(tool, 'dist'), out, { recursive: true });
  console.log('  → dist/genome-os/');
}

// Protein Viewer — static HTML + CDN Mol*, just copy the folder.
async function buildProteinViewer() {
  header('Building protein-viewer (static copy)');
  const src = path.join(ROOT, 'protein-viewer');
  const out = path.join(DIST, 'protein-viewer');
  await cp(src, out, { recursive: true });
  console.log('  → dist/protein-viewer/');
}

async function main() {
  await clean();
  await buildShell();
  await buildGenomeOS();
  await buildProteinViewer();
  console.log('\n\x1b[32m✓ Build complete.\x1b[0m  dist/ ready to deploy.');
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Build failed:\x1b[0m', err);
  process.exit(1);
});
