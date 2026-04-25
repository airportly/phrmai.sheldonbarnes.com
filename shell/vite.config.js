import { defineConfig } from 'vite';

// PHRMAI shell — the app-store landing at phrmai.sheldonbarnes.com.
// In dev mode, proxies /<tool-slug>/* to each tool's own dev server so the
// user experiences one unified origin at http://localhost:3000.
//
// Add a new tool:
//   1. Register it in src/apps.js (add a card)
//   2. Add its proxy entry below (dev only)
//   3. Wire its build step in ../scripts/build.mjs
export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/humanos': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        ws: true // Next.js HMR over WebSocket
      },
      '/chromatin-lens': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true // forward Vite HMR WebSocket
      },
      '/protein-viewer': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
