import { LANGUAGES, getLanguage, setLanguage } from './i18n.js';

// The pause menu's player settings: mouse sensitivity, sound, music volume and
// room speakers, and the language (switching reloads the page after saving).
export function bindSettingsControls(document, { audio, music, save, onSensitivity }) {
  const $ = id => document.getElementById(id);
  $('sensitivity').addEventListener('input', event => onSensitivity(Number(event.target.value)));

  const languageSelect = $('language');
  if (languageSelect) {
    for (const [code, name] of Object.entries(LANGUAGES))
      languageSelect.add(new Option(name, code, false, code === getLanguage()));
    languageSelect.addEventListener('change', event => { save(); setLanguage(event.target.value); });
  }

  $('sound').checked = !audio.isMuted();
  $('sound').addEventListener('change', event => { audio.setMuted(!event.target.checked); });

  const musicVolume = $('music-volume');
  const musicVolumeValue = $('music-volume-value');
  if (musicVolume && musicVolumeValue) {
    musicVolume.value = music.getVolume();
    musicVolumeValue.value = `${music.getVolume()}%`;
    musicVolume.addEventListener('input', () => {
      music.setVolume(musicVolume.value);
      musicVolumeValue.value = `${music.getVolume()}%`;
    });
  }

  const musicSpatial = $('music-spatial');
  musicSpatial.checked = music.getSpatial();
  musicSpatial.addEventListener('change', () => music.setSpatial(musicSpatial.checked));
}
