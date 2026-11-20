// Makes a save fixture from an older build of the archive.
//   git archive <commit> js/3d/scenes/key-archive | tar -x -C /tmp/<commit>
//   node make-save.mjs /tmp/<commit>/js/3d/scenes/key-archive/dist/js/rules.js \
//     | gzip -9 > tests/fixtures/saves/<commit>.json.gz
// (very old builds keep rules.js in js/ instead of dist/js/).
// It plays a short session: two keys sorted, one held, a muddy key soaking.
const [, , rulesPath] = process.argv;
const r = await import(rulesPath);
const state = r.createInitialState();
r.upgradeKeyConditions?.(state);
const clean = state.keys.filter(k => k.status === 'floor' && !k.broken && !k.mud && !k.rust && !k.wax);
const byType = clean.filter(k => k.type === clean[0].type);
// Sort two keys into their cabinet, keep one in hand, soak a muddy key if possible.
for (const key of byType.slice(0, 2)) {
  r.pickupKey(state, key.id);
  state.selected = state.held.indexOf(key.id);
  r.putKeyInCabinet(state, key.type);
}
r.pickupKey(state, byType[2].id);
const muddy = state.keys.find(k => k.status === 'floor' && k.mud && !k.rust && !k.broken);
if (muddy && r.startSoak) {
  r.pickupKey(state, muddy.id);
  state.selected = state.held.indexOf(muddy.id);
  try { r.startSoak(state, 'center-mud', 'mud', 1_000); } catch {}
}
process.stdout.write(JSON.stringify(state));
