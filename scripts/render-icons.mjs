// One-shot icon renderer. Produces favicon.svg + rasterized PNGs (32, 180,
// 512) and an Open Graph social card (1200×630) for each app, placed in
// the app's public/ folder (Vite copies public/ → dist/) or directly in
// the app's folder for the static protein-viewer.
//
// Run manually when icons change:
//   node scripts/render-icons.mjs
//
// Outputs are committed to the repo so Vercel doesn't need sharp at build.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// =========================================================================
// PHRMAI shell — gradient orb with three orbiting app dots
// =========================================================================
const PHRMAI_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7aa2ff" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="#7aa2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#ffd93d"/>
      <stop offset="55%" stop-color="#f472b6"/>
      <stop offset="100%" stop-color="#7aa2ff"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#0a0e1a"/>
  <circle cx="256" cy="256" r="256" fill="url(#glow)"/>
  <circle cx="256" cy="256" r="140" fill="url(#core)"/>
  <ellipse cx="216" cy="208" rx="50" ry="32" fill="#ffffff" opacity="0.28"/>
  <circle cx="256" cy="68" r="20" fill="#7aa2ff"/>
  <circle cx="424" cy="340" r="20" fill="#ffd93d"/>
  <circle cx="88" cy="340" r="20" fill="#f472b6"/>
</svg>`;

const PHRMAI_OG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e1a"/>
      <stop offset="100%" stop-color="#131b2e"/>
    </linearGradient>
    <linearGradient id="heading" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7aa2ff"/>
      <stop offset="50%" stop-color="#ffd93d"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
    <radialGradient id="orbGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#7aa2ff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#7aa2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbCore" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#ffd93d"/>
      <stop offset="55%" stop-color="#f472b6"/>
      <stop offset="100%" stop-color="#7aa2ff"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="300" cy="315" r="290" fill="url(#orbGlow)"/>
  <circle cx="300" cy="315" r="180" fill="url(#orbCore)"/>
  <ellipse cx="248" cy="258" rx="62" ry="40" fill="#ffffff" opacity="0.28"/>
  <circle cx="300" cy="105" r="22" fill="#7aa2ff"/>
  <circle cx="510" cy="420" r="22" fill="#ffd93d"/>
  <circle cx="90" cy="420" r="22" fill="#f472b6"/>
  <text x="620" y="260" font-family="Helvetica, Arial, sans-serif" font-size="130" font-weight="800" fill="url(#heading)" letter-spacing="-4">PHRMAI</text>
  <text x="620" y="332" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="300" fill="#fde68a">toward HumanOS</text>
  <text x="620" y="404" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#94a3b8">Interactive pharma-AI tools</text>
  <text x="620" y="442" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#94a3b8">anchored on real biology</text>
  <text x="620" y="548" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#64748b">by Sheldon Barnes · phrmai.sheldonbarnes.com</text>
</svg>`;

// =========================================================================
// ChromatinLens — nucleus with colored chromosome territories
// =========================================================================
const CHROMATIN_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="nucBg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0a0e1a"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#0a0e1a"/>
  <circle cx="256" cy="256" r="220" fill="url(#nucBg)" stroke="#a5b4fc" stroke-width="4" stroke-opacity="0.55"/>
  <ellipse cx="180" cy="180" rx="58" ry="44" fill="#ffd93d"/>
  <ellipse cx="334" cy="160" rx="52" ry="40" fill="#7aa2ff"/>
  <ellipse cx="360" cy="320" rx="60" ry="46" fill="#a78bfa"/>
  <ellipse cx="194" cy="340" rx="52" ry="42" fill="#4ecdc4"/>
  <ellipse cx="268" cy="244" rx="38" ry="32" fill="#f472b6"/>
  <circle cx="160" cy="254" r="22" fill="#fb923c"/>
</svg>`;

const CHROMATIN_OG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e1a"/>
      <stop offset="100%" stop-color="#131b2e"/>
    </linearGradient>
    <radialGradient id="nucGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7aa2ff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#7aa2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nucBg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0a0e1a"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="310" cy="315" r="280" fill="url(#nucGlow)"/>
  <circle cx="310" cy="315" r="210" fill="url(#nucBg)" stroke="#a5b4fc" stroke-width="3" stroke-opacity="0.6"/>
  <ellipse cx="240" cy="230" rx="62" ry="48" fill="#ffd93d"/>
  <ellipse cx="395" cy="215" rx="55" ry="44" fill="#7aa2ff"/>
  <ellipse cx="420" cy="385" rx="62" ry="48" fill="#a78bfa"/>
  <ellipse cx="250" cy="410" rx="55" ry="46" fill="#4ecdc4"/>
  <ellipse cx="320" cy="310" rx="40" ry="34" fill="#f472b6"/>
  <circle cx="188" cy="320" r="24" fill="#fb923c"/>
  <text x="620" y="220" font-family="Helvetica, Arial, sans-serif" font-size="82" font-weight="800" fill="#fef3c7" letter-spacing="-2">ChromatinLens</text>
  <text x="620" y="278" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#ffd93d">Eight-level chromatin explorer</text>
  <text x="620" y="348" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">From the whole nucleus down to individual atoms.</text>
  <text x="620" y="388" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">Mitosis. Loop extrusion. Transcription. Replication.</text>
  <text x="620" y="428" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">Click any element · narrated audio tour.</text>
  <text x="620" y="548" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#64748b">phrmai.sheldonbarnes.com / chromatin-lens</text>
</svg>`;

// =========================================================================
// Molecule Viewer — interwoven double-helix glyph
// =========================================================================
const PROTEIN_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0e1a"/>
  <path d="M 160 80 C 380 176 160 240 380 336 C 160 432 380 496 160 496"
        fill="none" stroke="#76b900" stroke-width="24" stroke-linecap="round"/>
  <path d="M 352 80 C 132 176 352 240 132 336 C 352 432 132 496 352 496"
        fill="none" stroke="#4ecdc4" stroke-width="24" stroke-linecap="round"/>
  <g stroke="#d1d5db" stroke-width="7" opacity="0.5" stroke-linecap="round">
    <line x1="170" y1="140" x2="342" y2="140"/>
    <line x1="170" y1="228" x2="342" y2="228"/>
    <line x1="170" y1="316" x2="342" y2="316"/>
    <line x1="170" y1="404" x2="342" y2="404"/>
  </g>
</svg>`;

const PROTEIN_OG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e1a"/>
      <stop offset="100%" stop-color="#131b2e"/>
    </linearGradient>
    <radialGradient id="helixGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#76b900" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#76b900" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="310" cy="315" r="300" fill="url(#helixGlow)"/>
  <path d="M 180 100 C 440 200 180 260 440 360 C 180 460 440 520 180 560"
        fill="none" stroke="#76b900" stroke-width="22" stroke-linecap="round"/>
  <path d="M 440 100 C 180 200 440 260 180 360 C 440 460 180 520 440 560"
        fill="none" stroke="#4ecdc4" stroke-width="22" stroke-linecap="round"/>
  <g stroke="#d1d5db" stroke-width="5" opacity="0.55" stroke-linecap="round">
    <line x1="220" y1="165" x2="400" y2="165"/>
    <line x1="220" y1="263" x2="400" y2="263"/>
    <line x1="220" y1="361" x2="400" y2="361"/>
    <line x1="220" y1="459" x2="400" y2="459"/>
    <line x1="220" y1="525" x2="400" y2="525"/>
  </g>
  <text x="620" y="220" font-family="Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="#fef3c7" letter-spacing="-2">Molecule Viewer</text>
  <text x="620" y="282" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="500" fill="#76b900">Voice-guided Boltz-2 + OpenFold3</text>
  <text x="620" y="358" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">Hands-free 3D protein structures.</text>
  <text x="620" y="398" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">Ask to focus a residue, walk a chain,</text>
  <text x="620" y="438" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#94a3b8">or launch a guided tour.</text>
  <text x="620" y="548" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#64748b">phrmai.sheldonbarnes.com / protein-viewer</text>
</svg>`;

// =========================================================================
// Render jobs
// =========================================================================
const APPS = [
  {
    id: 'phrmai',
    outDir: path.join(ROOT, 'shell', 'public'),
    favicon: PHRMAI_FAVICON,
    og: PHRMAI_OG,
  },
  {
    id: 'chromatin-lens',
    outDir: path.join(ROOT, 'chromatin-lens', 'public'),
    favicon: CHROMATIN_FAVICON,
    og: CHROMATIN_OG,
  },
  {
    id: 'protein-viewer',
    outDir: path.join(ROOT, 'protein-viewer'),
    favicon: PROTEIN_FAVICON,
    og: PROTEIN_OG,
  },
];

const header = (s) => console.log(`\n\x1b[36m▸ ${s}\x1b[0m`);

async function renderApp(app) {
  header(`Rendering icons → ${path.relative(ROOT, app.outDir)}`);
  await mkdir(app.outDir, { recursive: true });

  const favBuf = Buffer.from(app.favicon);
  const ogBuf = Buffer.from(app.og);

  await writeFile(path.join(app.outDir, 'favicon.svg'), app.favicon);
  await writeFile(path.join(app.outDir, 'og-image.svg'), app.og);

  // Rasterize favicons
  await sharp(favBuf, { density: 512 }).resize(32, 32).png({ compressionLevel: 9 }).toFile(path.join(app.outDir, 'favicon-32.png'));
  await sharp(favBuf, { density: 512 }).resize(180, 180).png({ compressionLevel: 9 }).toFile(path.join(app.outDir, 'apple-touch-icon.png'));
  await sharp(favBuf, { density: 512 }).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(app.outDir, 'icon-512.png'));

  // Rasterize OG card
  await sharp(ogBuf, { density: 200 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(path.join(app.outDir, 'og-image.png'));

  console.log(`  ✓ favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png, og-image.{svg,png}`);
}

async function main() {
  for (const app of APPS) {
    await renderApp(app);
  }
  console.log('\n\x1b[32m✓ All icons rendered.\x1b[0m');
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ Icon render failed:\x1b[0m', err);
  process.exit(1);
});
