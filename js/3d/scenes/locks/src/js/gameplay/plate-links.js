/** Classic lock coupling: the selected strip always drives one adjacent strip. */
export function plateCoupling(index, count, direction) {
  const neighbor = index === count - 1 ? index - 1 : index + 1;
  return [
    { index, delta: direction },
    { index: neighbor, delta: (index % 2 ? -1 : 1) * direction },
  ];
}

export function applyPlateCoupling(positions, index, direction, min = 1, max = 7) {
  const moves = plateCoupling(index, positions.length, direction);
  if (moves.some(move => positions[move.index] + move.delta < min ||
    positions[move.index] + move.delta > max)) return false;
  for (const move of moves) positions[move.index] += move.delta;
  return true;
}
