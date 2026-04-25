#!/usr/bin/env node
/**
 * Build-static — wraps `next build` with the prep needed to produce a static
 * export at /humanos for phrmai.com. Two things to handle that vanilla
 * `next build` doesn't:
 *
 *   1. API routes (pages/api/*) must be removed before static export, since
 *      `output: 'export'` errors on dynamic / server-rendered routes.
 *   2. NEXT_PUBLIC_BASE_PATH and EXPORT have to be set so next.config.js
 *      flips into export mode.
 *
 * The API folder is moved to .api-backup/ before the build and put back after,
 * including on Ctrl-C and exceptions, so the source stays intact.
 */

import { execSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const apiDir = resolve(root, 'pages/api');
const backupDir = resolve(root, '.api-backup');

let moved = false;
const restore = () => {
  if (!moved) return;
  if (existsSync(backupDir)) {
    if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
    renameSync(backupDir, apiDir);
  }
  moved = false;
};

process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

try {
  if (existsSync(apiDir)) {
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
    renameSync(apiDir, backupDir);
    moved = true;
  }

  execSync('next build', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '/humanos',
      EXPORT: '1',
    },
  });

  // Layer per-disease share pages + OG images on top of the export. Crawlers
  // hitting /humanos/disease/{key}/ get proper meta + a 1200x630 PNG; users
  // get redirected into the SPA at the appropriate galaxy view.
  execSync('node scripts/generate-share-pages.mjs', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '/humanos',
      SITE_URL: process.env.SITE_URL || 'https://phrmai.sheldonbarnes.com',
    },
  });

  console.log(`\nStatic export complete. Output: ${resolve(root, 'out')}`);
} finally {
  restore();
}
