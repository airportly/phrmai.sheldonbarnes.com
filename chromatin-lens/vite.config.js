import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Fixed subpath. In dev the shell proxies /chromatin-lens/* → this server; in
  // prod the build output is copied to dist/chromatin-lens/ and served at
  // phrmai.sheldonbarnes.com/chromatin-lens/. Absolute base (not './') so Vite's
  // HMR WebSocket URLs are correct when proxied.
  base: '/chromatin-lens/',
  server: {
    port: 5173,
    strictPort: true,
    open: false
  }
});
