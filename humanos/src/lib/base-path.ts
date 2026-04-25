/**
 * Base path helper.
 *
 * In dev (npm run dev) NEXT_PUBLIC_BASE_PATH is empty, so paths resolve at the
 * root and the local server works as before. For the phrmai.com production
 * export the env var is set to "/humanos", which prefixes every static asset
 * URL and every fetch path so they resolve under the subpath.
 *
 * Use `assetPath('/assets/anatomy/heart.glb')` instead of hard-coding the
 * leading slash. Use `apiPath('/api/chat')` for fetches that hit a Next.js
 * API route (or the equivalent edge function once one is wired up).
 */

export const BASE_PATH: string = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

export function assetPath(path: string): string {
  if (!BASE_PATH) return path;
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

export const apiPath = assetPath;
