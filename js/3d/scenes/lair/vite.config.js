import {defineConfig} from 'vite';

export default defineConfig({
  // The Atelier and the laboratory are imported from js/3d/workshops (npm
  // workspaces); Vite serves them from the workspace root.
  optimizeDeps:{entries:['index.html']},
  build:{
    rollupOptions:{
      output:{
        // Three.js in its own file: it changes far less often than the game,
        // so a returning player's browser keeps it cached across releases.
        manualChunks(id){
          if(id.includes('/node_modules/three/'))return 'three';
          return undefined;
        },
      },
    },
    // three.js alone is ~700 kB minified; the warning is about that file.
    chunkSizeWarningLimit:800,
  },
});
