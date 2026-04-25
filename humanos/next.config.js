/** @type {import('next').NextConfig} */
// `npm run dev` keeps NEXT_PUBLIC_BASE_PATH unset → no basePath, /api/chat
// works against the dev server.
//
// `npm run build:static` (used by the phrmai monorepo's build pipeline) sets
// NEXT_PUBLIC_BASE_PATH=/humanos and EXPORT=1, which:
//   - prefixes all asset URLs with /humanos
//   - emits a static `out/` directory next-build copies into phrmai/dist/humanos/
// In static export, API routes are not produced — the build script renames
// pages/api away first.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const isExport = process.env.EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  ...(isExport ? {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
};

module.exports = nextConfig;
