// The lab changes only the objects affected by a district rule. House
// blueprints can remain intact while a road, lamp or setback is edited.
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function diffStreetPlans(previous, next) {
  const oldHouses = new Map((previous?.houses || []).map(house => [house.id, house]));
  const newHouses = new Map(next.houses.map(house => [house.id, house]));
  const removed = [...oldHouses.keys()].filter(id => !newHouses.has(id));
  const changed = [], added = [], moved = [], unchanged = [];
  for (const house of next.houses) {
    const before = oldHouses.get(house.id);
    if (!before) added.push(house.id);
    else if (!same(before.config, house.config)) changed.push(house.id);
    else if (before.x !== house.x || before.z !== house.z || before.rotation !== house.rotation) moved.push(house.id);
    else unchanged.push(house.id);
  }
  return {
    roadChanged: !previous || !same(
      [previous.road,previous.sidewalks,previous.seed,previous.roads,previous.courtyard,previous.walkways],
      [next.road,next.sidewalks,next.seed,next.roads,next.courtyard,next.walkways]),
    lampsChanged: !previous || !same(previous.lamps, next.lamps),
    removed, changed, added, moved, unchanged,
  };
}
