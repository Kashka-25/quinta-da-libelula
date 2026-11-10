import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built demo works from any folder or static host.
// Three.js gets its own chunk so it caches separately from the site's code.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } }, chunkSizeWarningLimit: 700 },
});
