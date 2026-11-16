// Temporary playtesting setting. Flip to false when limited pick inventory returns.
export const UNLIMITED_TOOLS_FOR_TESTING = true;

export const startingToolCount = (unlimited = UNLIMITED_TOOLS_FOR_TESTING) =>
  unlimited ? Infinity : 3;

export const spendTool = count => Number.isFinite(count) ? Math.max(0, count - 1) : Infinity;

export const formatToolCount = count => Number.isFinite(count) ? String(count) : '∞';
