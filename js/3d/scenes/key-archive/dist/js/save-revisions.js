// Revisions of the version-2 save format.
//
// Most save upgrades in rules.js (upgradeKeyConditions, upgradeCabinetSlots,
// upgradeStationBaths, …) infer what is missing from the save's shape and
// run on every load, so they stay safe even if an older cached page writes
// the save back. Use a revision only for a change that cannot be inferred
// that way, or that an older page must not overwrite:
//   1. add a step to MIGRATIONS (step i upgrades revision i to i + 1);
//   2. SAVE_REVISION follows automatically;
//   3. add a fixture from the previous build to tests/fixtures/saves.
// A page that finds a save with a higher revision than its own (or a newer
// `version`) refuses to load or overwrite it and asks the player to reload,
// instead of calling it damaged.

const MIGRATIONS = [
  // 0 → 1: the revision field itself. Older saves need nothing else.
  state => state,
];

export const SAVE_VERSION = 2;
export const SAVE_REVISION = MIGRATIONS.length;

export function saveRevision(snapshot) {
  return Number.isInteger(snapshot?.revision) && snapshot.revision >= 0 ? snapshot.revision : 0;
}

export function isNewerSave(snapshot) {
  return Boolean(snapshot) && (Number(snapshot.version) > SAVE_VERSION || saveRevision(snapshot) > SAVE_REVISION);
}

export function migrateSave(snapshot) {
  for (let revision = saveRevision(snapshot); revision < SAVE_REVISION; revision++) MIGRATIONS[revision](snapshot);
  snapshot.revision = SAVE_REVISION;
  return snapshot;
}
