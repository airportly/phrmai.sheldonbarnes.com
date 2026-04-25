#!/usr/bin/env node
/**
 * Generates per-disease share landing pages and OG images into the static
 * export directory. Runs AFTER `next build` (so out/ exists) but BEFORE
 * the build pipeline copies everything into the phrmai dist/.
 *
 * For each of the 13 cardiometabolic diseases, this creates:
 *
 *   out/disease/{key}/index.html  — tiny landing page with proper og:* meta
 *                                   tags pointing at the disease, plus JS
 *                                   that redirects users to the SPA at
 *                                   /humanos/#view=galaxy&disease={key}
 *
 *   out/og/disease/{key}.png      — 1200x630 social card with the disease
 *                                   icon, name, and one-line description on
 *                                   a dark phrmai-branded background
 *
 * Crawlers (Twitter, Slack, Facebook, LinkedIn) read the OG meta tags and
 * stop. Users get redirected to the main SPA so the in-app experience is
 * unchanged.
 *
 * Customize the production domain via SITE_URL env var. Default falls back
 * to phrmai.sheldonbarnes.com because that's what the README declares as
 * the deploy target.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');

const SITE_URL = (process.env.SITE_URL || 'https://phrmai.sheldonbarnes.com').replace(/\/$/, '');
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '/humanos').replace(/\/$/, '');

if (!existsSync(OUT)) {
  console.error(`[og] expected ${OUT} to exist (did next build run?)`);
  process.exit(1);
}

// Disease icon SVG inner content. Mirrors src/components/DiseaseIcon.tsx so
// the build script stays standalone (no TS imports at build time). If you
// change icons in DiseaseIcon.tsx, update these too.
const ICON_PATHS = {
  diabetes_mellitus:
    '<polygon points="12,3 20,7 20,17 12,21 4,17 4,7"/>' +
    '<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  obesity:
    '<circle cx="12" cy="6.5" r="2.5"/>' +
    '<path d="M 5 22 Q 5 12 12 12 Q 19 12 19 22"/>' +
    '<line x1="5" y1="22" x2="19" y2="22"/>',
  metabolic_syndrome:
    '<circle cx="9" cy="10" r="5.5"/>' +
    '<circle cx="15" cy="10" r="5.5"/>' +
    '<circle cx="12" cy="16" r="5.5"/>',
  nafld:
    '<path d="M 12 3 C 18 8, 20 13, 18 18 C 16 22, 10 22, 7 19 C 4 15, 6 8, 12 3 Z"/>' +
    '<path d="M 9 14 Q 12 17 15 14"/>',
  cad:
    '<path d="M 12 21 C 4 14, 4 6, 8 6 Q 12 6, 12 9 Q 12 6, 16 6 C 20 6, 20 14, 12 21 Z"/>' +
    '<line x1="6" y1="9" x2="10" y2="13" stroke-width="2.4"/>',
  mi:
    '<path d="M 12 21 C 4 14, 4 6, 8 6 Q 12 6, 12 9 Q 12 6, 16 6 C 20 6, 20 14, 12 21 Z"/>' +
    '<path d="M 13 9 L 11 13 L 13 13 L 11 17" stroke-width="1.9"/>',
  heart_failure:
    '<path d="M 12 18 C 5 12, 5 5, 9 5 Q 12 5, 12 8 Q 12 5, 15 5 C 19 5, 19 12, 12 18 Z"/>' +
    '<path d="M 9 21 L 12 23 L 15 21"/>' +
    '<line x1="12" y1="18.5" x2="12" y2="22.5"/>',
  hypertension:
    '<path d="M 4 16 A 9 9 0 0 1 20 16"/>' +
    '<line x1="12" y1="16" x2="17" y2="9.5"/>' +
    '<circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/>',
  dyslipidemia:
    '<path d="M 3 8 Q 6.5 4, 10 8 Q 13.5 12, 17 8 Q 20.5 4, 24 8" transform="translate(-1.5,4)"/>' +
    '<path d="M 3 8 Q 6.5 12, 10 8 Q 13.5 4, 17 8 Q 20.5 12, 24 8" transform="translate(-1.5,10)"/>',
  atherosclerosis:
    '<path d="M 3 7 L 21 7"/>' +
    '<path d="M 3 17 L 21 17"/>' +
    '<path d="M 7 7 Q 11 11, 15 7" fill="currentColor" stroke="none" opacity="0.5"/>' +
    '<path d="M 7 7 Q 11 11, 15 7"/>',
  afib:
    '<path d="M 3 12 L 6 12 L 7.5 8 L 9 16 L 10.5 12 L 13 13 L 14.5 9 L 16 14 L 18 12 L 21 12"/>',
  stroke:
    '<path d="M 7 6 C 4 6, 3 10, 5 12 C 3 14, 4 18, 7 18 C 9 20, 13 20, 14 18 C 17 18, 19 14, 17 12 C 19 10, 18 6, 15 6 C 13 4, 9 4, 7 6 Z"/>' +
    '<path d="M 13 9 L 11 13 L 13 13 L 11 17" stroke-width="1.9"/>',
  fh:
    '<path d="M 8 4 Q 16 8, 8 12 Q 16 16, 8 20"/>' +
    '<path d="M 16 4 Q 8 8, 16 12 Q 8 16, 16 20"/>' +
    '<line x1="9" y1="7" x2="15" y2="7" opacity="0.6"/>' +
    '<line x1="9" y1="13" x2="15" y2="13" opacity="0.6"/>' +
    '<line x1="9" y1="19" x2="15" y2="19" opacity="0.6"/>',
};

// Load the disease metadata that ships with the SPA.
const diseaseMeta = JSON.parse(await readFile(path.join(ROOT, 'src/data/disease-metadata.json'), 'utf-8'));
const diseases = Object.entries(diseaseMeta.diseases).map(([key, d]) => ({ key, ...d }));

// ----- 1) OG images: SVG → PNG via sharp -------------------------------------

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildOgSvg(d) {
  const iconPaths = ICON_PATHS[d.key] || '<circle cx="12" cy="12" r="9"/>';
  // The disease icon is in 0..24 viewport units; scale it up to a large
  // 240px glyph in the OG image (so 240/24 = scale of 10).
  const iconSize = 240;
  const iconX = 110;
  const iconY = (630 - iconSize) / 2;
  const iconScale = iconSize / 24;
  const desc = (d.description || '').slice(0, 180);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e27"/>
      <stop offset="100%" stop-color="#070b20"/>
    </linearGradient>
    <radialGradient id="halo" cx="22%" cy="50%" r="34%">
      <stop offset="0%" stop-color="${d.color}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${d.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>

  <!-- starry background suggestion -->
  ${[...Array(50)].map(() => {
    const x = Math.floor(Math.random() * 1200);
    const y = Math.floor(Math.random() * 630);
    const r = (Math.random() * 1.2 + 0.4).toFixed(2);
    const o = (Math.random() * 0.4 + 0.2).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${o}"/>`;
  }).join('')}

  <!-- Disease emblem -->
  <circle cx="${iconX + iconSize/2}" cy="${iconY + iconSize/2}" r="${iconSize/2 + 14}" fill="${d.color}" opacity="0.18"/>
  <circle cx="${iconX + iconSize/2}" cy="${iconY + iconSize/2}" r="${iconSize/2 - 8}" fill="${d.color}" opacity="0.95"/>
  <g transform="translate(${iconX},${iconY}) scale(${iconScale})"
     fill="none" stroke="#0a0e27" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${iconPaths.replace(/currentColor/g, '#0a0e27')}
  </g>

  <!-- Eyebrow -->
  <text x="430" y="240" fill="${d.color}" font-family="-apple-system, system-ui, sans-serif"
        font-size="24" font-weight="600" letter-spacing="6">CARDIOMETABOLIC v1.0 · ${d.efoId}</text>

  <!-- Title -->
  <text x="430" y="320" fill="#ffffff" font-family="-apple-system, system-ui, sans-serif"
        font-size="64" font-weight="500" letter-spacing="1">${escapeXml(d.label)}</text>

  <!-- Description (wrapped manually) -->
  ${wrapText(desc, 60).map((line, i) =>
    `<text x="430" y="${380 + i * 36}" fill="rgba(255,255,255,0.65)" font-family="-apple-system, system-ui, sans-serif" font-size="26">${escapeXml(line)}</text>`
  ).join('')}

  <!-- Phrmai brand strip -->
  <text x="430" y="560" fill="rgba(45, 212, 191, 0.85)" font-family="-apple-system, system-ui, sans-serif"
        font-size="22" font-weight="600" letter-spacing="3">HUMAN OS · TABLE OF CONTEXT</text>
  <text x="430" y="590" fill="rgba(255,255,255,0.40)" font-family="-apple-system, system-ui, sans-serif"
        font-size="18">phrmai.sheldonbarnes.com/humanos · grounded in the cardiometabolic-research MCP</text>
</svg>`;
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = cur + ' ' + w;
    }
    if (lines.length >= 3) break;
  }
  if (cur && lines.length < 4) lines.push(cur.trim());
  return lines.slice(0, 4);
}

// ----- 2) Landing pages -------------------------------------------------------

function buildLandingHtml(d, ogImageUrl, canonicalUrl, redirectUrl) {
  const title = `${d.label} · Human OS`;
  const description = (d.description || '').slice(0, 200);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeXml(title)}</title>
<meta name="description" content="${escapeXml(description)}"/>
<link rel="canonical" href="${canonicalUrl}"/>

<!-- Open Graph -->
<meta property="og:type" content="article"/>
<meta property="og:title" content="${escapeXml(title)}"/>
<meta property="og:description" content="${escapeXml(description)}"/>
<meta property="og:url" content="${canonicalUrl}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:image:alt" content="${escapeXml(d.label)} — Human OS cardiometabolic deep link"/>
<meta property="og:site_name" content="Human OS · Phrmai"/>

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeXml(title)}"/>
<meta name="twitter:description" content="${escapeXml(description)}"/>
<meta name="twitter:image" content="${ogImageUrl}"/>

<!-- Theme -->
<meta name="color-scheme" content="dark"/>
<meta name="theme-color" content="#070b20"/>

<!-- Redirect humans into the SPA. Crawlers stop at the meta above. -->
<meta http-equiv="refresh" content="0; url=${redirectUrl}"/>
<script>window.location.replace(${JSON.stringify(redirectUrl)});</script>

<style>
  body{margin:0;background:#070b20;color:rgba(255,255,255,0.85);font-family:-apple-system,system-ui,sans-serif;padding:48px;line-height:1.55}
  a{color:#5eead4;text-decoration:none}
  h1{font-weight:500;letter-spacing:1px;margin:0 0 8px}
  .hint{color:rgba(255,255,255,0.45);font-size:13px;margin-top:16px}
</style>
</head>
<body>
  <h1>${escapeXml(d.label)}</h1>
  <p>${escapeXml(description)}</p>
  <p class="hint">Loading the Human OS galaxy view… <a href="${redirectUrl}">click here</a> if it doesn't redirect automatically.</p>
</body>
</html>`;
}

// ----- 3) Run -----------------------------------------------------------------

console.log(`[og] generating per-disease share pages → ${OUT}`);
console.log(`[og] site: ${SITE_URL}, basePath: ${BASE_PATH}`);

await mkdir(path.join(OUT, 'og/disease'), { recursive: true });
await mkdir(path.join(OUT, 'disease'), { recursive: true });

let ok = 0;
for (const d of diseases) {
  // OG image
  const svg = buildOgSvg(d);
  const pngPath = path.join(OUT, 'og/disease', `${d.key}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);

  // Landing page
  const ogImageUrl = `${SITE_URL}${BASE_PATH}/og/disease/${d.key}.png`;
  const canonicalUrl = `${SITE_URL}${BASE_PATH}/disease/${d.key}/`;
  const redirectUrl = `${BASE_PATH}/#view=galaxy&disease=${d.key}`;
  const html = buildLandingHtml(d, ogImageUrl, canonicalUrl, redirectUrl);

  await mkdir(path.join(OUT, 'disease', d.key), { recursive: true });
  await writeFile(path.join(OUT, 'disease', d.key, 'index.html'), html, 'utf-8');
  ok += 1;
  console.log(`  ✓ ${d.key.padEnd(34)}  ${d.label}`);
}

console.log(`\n[og] ${ok} disease share pages + OG images generated.`);
