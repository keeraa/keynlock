// @ts-check
/**
 * The game's tracks, by file name. Every scene plays the same list in the
 * same order; each scene turns a file into a URL its own build can serve
 * (the files live in key-archive/dist/assets/music). The file name is also
 * what the saved playhead remembers, so keep names stable.
 */
export const MUSIC_TRACKS = Object.freeze([
  Object.freeze({ file: 'chopin-nocturne-op9-no1.mp3',
    title: Object.freeze({ ru: 'Шопен · Ноктюрн op. 9 № 1', en: 'Chopin · Nocturne Op. 9 No. 1' }) }),
  Object.freeze({ file: 'chopin-nocturne-op9-no2.mp3',
    title: Object.freeze({ ru: 'Шопен · Ноктюрн op. 9 № 2', en: 'Chopin · Nocturne Op. 9 No. 2' }) }),
  Object.freeze({ file: 'chopin-nocturne-b-flat-minor.mp3',
    title: Object.freeze({ ru: 'Шопен · Ноктюрн си-бемоль минор', en: 'Chopin · Nocturne in B-flat minor' }) }),
]);

/** The list with URLs: urlOf(file) is the scene's way to reach each file. */
export function musicTracksWithUrls(/** @type {(file: string) => string} */ urlOf) {
  return MUSIC_TRACKS.map(track => ({ ...track, url: urlOf(track.file) }));
}
