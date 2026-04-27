import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Discovery — narrated AI-discovery report. Mirrors the chromatin-lens setup:
// dev proxy at /discovery/* via the shell, prod copy at dist/discovery/.
export default defineConfig({
  plugins: [react()],
  base: '/discovery/',
  server: {
    port: 5175,
    strictPort: true,
    open: false,
  },
});
