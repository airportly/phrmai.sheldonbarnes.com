import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built bundle works from any subpath
  // (e.g., /tools/genome-os-viewer/ when embedded in the sheldonbarnes.com site).
  base: './',
  server: {
    port: 5173,
    open: true
  }
});
