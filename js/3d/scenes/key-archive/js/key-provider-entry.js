import { createForgeKeyProvider } from './key-forge-adapter.js?v=4';
import { preloadKeyTextures } from './key-materials.js';

// A versioned profile file is the single design input for the archive.
// Changing it updates all instances, hand models, cabinets and 2D stamps on
// the next load while preserving each stored key's archive type and state.
let profiles = [];
try {
  const response = await fetch(new URL('../assets/key-design-profiles.json', import.meta.url),
    { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.schema !== 1 || !Array.isArray(payload.profiles))
    throw new Error('Unknown key design profile format');
  profiles = payload.profiles;
} catch (error) {
  console.warn('Key Forge profiles unavailable; factory defaults are used.', error);
}

try {
  await preloadKeyTextures();
} catch (error) {
  console.warn('A gouache key texture did not preload; the scene will retry lazily.', error);
}

export default createForgeKeyProvider(profiles);
