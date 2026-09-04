import { requireService } from './runtime.mjs';

const service=()=>requireService('paintingRewards',()=>window.KeynlockPaintingRewards);

export const awardPainting=options=>service().award(options);
export const getOwnedPaintingIds=()=>service().ownedIds();
