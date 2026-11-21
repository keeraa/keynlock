import {defineConfig} from 'vite';

export default defineConfig({
  // The Atelier and the laboratory are imported from js/3d/workshops (npm
  // workspaces); Vite serves them from the workspace root.
  optimizeDeps:{entries:['index.html']},
});
