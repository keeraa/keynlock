import { defineConfig } from 'vite';

// The standalone laboratory site. Relative base: it can be hosted at any path.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
