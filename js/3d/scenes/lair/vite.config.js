import {defineConfig} from 'vite';

export default defineConfig({
  // The three original workshops are preserved static modules with their own
  // import maps. Only the Lair entry is bundled by this Vite application.
  optimizeDeps:{entries:['index.html']},
});
