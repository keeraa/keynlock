import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  base: '/stations/atelier/',
  build: {
    outDir: '../../public/stations/atelier',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        bridge: resolve(import.meta.dirname, 'bridge.html'),
      },
      output: {
        // Separately cache the stable Three.js runtime and painting catalog.
        // Workshop-only edits then transfer only the smaller application chunk.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            if (id.includes('/examples/jsm/')) return 'three-addons';
            if (id.endsWith('/three.core.js')) return 'three-primitives';
            if (id.endsWith('/three.module.js')) return 'three-renderer';
          }
          if (id.endsWith('/src/painting-catalog.js')) return 'painting-catalog';
          return undefined;
        },
      },
    },
  },
});
