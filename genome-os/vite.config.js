import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Fixed subpath. In dev the shell proxies /genome-os/* → this server; in
  // prod the build output is copied to dist/genome-os/ and served at
  // phrmai.sheldonbarnes.com/genome-os/. Absolute base (not './') so Vite's
  // HMR WebSocket URLs are correct when proxied.
  base: '/genome-os/',
  server: {
    port: 5173,
    strictPort: true,
    open: false
  }
});
