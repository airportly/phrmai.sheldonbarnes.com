// Installs dependencies for every tool that has a package.json.
// Used as a pre-step by `npm run dev` so a fresh clone is one command.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PROJECTS = ['shell', 'chromatin-lens', 'discovery'];

for (const p of PROJECTS) {
  const dir = path.join(ROOT, p);
  const hasPkg = existsSync(path.join(dir, 'package.json'));
  const hasNodeModules = existsSync(path.join(dir, 'node_modules'));
  if (!hasPkg) continue;
  if (hasNodeModules) {
    console.log(`✓ ${p} already installed`);
    continue;
  }
  console.log(`\n\x1b[36m▸ Installing ${p}\x1b[0m`);
  execSync('npm install --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
}
