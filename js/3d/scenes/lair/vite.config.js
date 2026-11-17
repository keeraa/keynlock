import {defineConfig} from 'vite';
import {resolve} from 'node:path';

export default defineConfig({
  // The three original workshops are preserved static modules with their own
  // import maps. Only the Lair entry is bundled by this Vite application.
  optimizeDeps:{entries:['index.html']},
  build:{rollupOptions:{input:{main:resolve('index.html'),alchemy:resolve('integrations/alchemy/src/index.html')}}},
});
