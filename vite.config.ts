import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built demo works from any folder or static host.
export default defineConfig({ plugins: [react()], base: './' });
