// Root build: collects every tool's static output into ./dist/<tool-name>/
// and writes the landing page to ./dist/index.html.
// Vercel runs `npm run build` at the repo root → serves ./dist/ at phrmai.sheldonbarnes.com.

import { execSync } from 'node:child_process';
import { cp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
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

// GenomeOS — Vite build. Outputs to genome-os/dist/, we copy to dist/genome-os/.
async function buildGenomeOS() {
  header('Building genome-os (Vite)');
  const tool = path.join(ROOT, 'genome-os');
  run('npm install --no-audit --no-fund', tool);
  run('npm run build', tool);
  const out = path.join(DIST, 'genome-os');
  await cp(path.join(tool, 'dist'), out, { recursive: true });
  console.log('  → dist/genome-os/');
}

// Protein Viewer — static only, just copy the folder.
async function buildProteinViewer() {
  header('Building protein-viewer (static copy)');
  const tool = path.join(ROOT, 'protein-viewer');
  const out = path.join(DIST, 'protein-viewer');
  await cp(tool, out, { recursive: true });
  console.log('  → dist/protein-viewer/');
}

async function writeLanding() {
  header('Writing landing page → dist/index.html');
  const html = await readFile(path.join(ROOT, 'scripts', 'landing.html'), 'utf8');
  await writeFile(path.join(DIST, 'index.html'), html);
}

async function main() {
  await clean();
  await buildGenomeOS();
  await buildProteinViewer();
  await writeLanding();
  console.log('\n\x1b[32m✓ Build complete.\x1b[0m');
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Build failed:\x1b[0m', err);
  process.exit(1);
});
