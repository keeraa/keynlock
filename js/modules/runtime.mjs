/**
 * Stable ES-module facade for new code.
 *
 * Existing classic scripts keep the file:// build working. New modules should
 * import from this facade instead of reaching into unrelated globals directly.
 */
export const content=()=>window.KeynlockContent;
export const saveStore=()=>window.KeynlockSaveStore;
export const gameCatalog=()=>window.GameCatalog;
export const gameActions=()=>window.GameActions;
export const resources=()=>window.KeynlockResources;
export const restoration=()=>window.KeynlockRestoration;
export const paintingRewards=()=>window.KeynlockPaintingRewards;
export const alchemy=()=>window.Alchemy;

export function requireService(name,service){
  const value=service();
  if(!value)throw new Error(`KEYNLOCK service is not ready: ${name}`);
  return value;
}
