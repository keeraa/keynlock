/** Mount the actual Atelier application in the Lair document and WebGL world.
 * The artwork, brushes, catalogue and persistence are the preserved sources.
 * No iframe or second WebGL context is created for restoration. */
import { markup, restorationFeedbackStyles, startAtelier, styles } from '@keynlock/atelier/embedding';

export function mountAtelierInRoom(host) {
  const documentSource = new DOMParser().parseFromString(markup,'text/html');
  const atelier = documentSource.querySelector('#app');
  if (!atelier) throw new Error('Не найден оригинальный интерфейс Ателье цвета');
  atelier.id = 'atelier-embedded-app';
  atelier.classList.add('lair-embedded');
  atelier.querySelectorAll('script').forEach(script => script.remove());
  // CSS @scope isolates the original design from the Lair's header, canvas,
  // visual settings and other selectors with the same names.
  const scopedStyle = document.createElement('style');
  scopedStyle.dataset.atelierStyle = 'original';
  scopedStyle.textContent = `@scope (#atelier-embedded-app) {\n${styles.replace(/@import\s+url\([^)]*\)\s*;/g,'')}\n}`;
  document.head.appendChild(scopedStyle);
  document.querySelector('#app').appendChild(atelier);
  host.atelier.root = atelier;
  window.dispatchEvent(new CustomEvent('keynlock:atelier',{detail:{type:'mounted'}}));

  // These are the ORIGINAL tool cursor and damage hint, placed over the Lair
  // canvas rather than inside the original Atelier's hidden viewport.
  const feedback = document.createElement('div');
  feedback.id = 'atelier-scene-feedback';
  feedback.setAttribute('aria-hidden','true');
  feedback.append(atelier.querySelector('#restoration-cursor'), atelier.querySelector('#damage-hint'));
  document.querySelector('#app').appendChild(feedback);
  const feedbackStyle = document.createElement('style');
  feedbackStyle.textContent = restorationFeedbackStyles;
  document.head.appendChild(feedbackStyle);

  // Start the real workshop once, on the same page and shared renderer.
  // The original module will announce models-ready and ready separately.
  void startAtelier().catch(error => {
    console.error('Не удалось встроить исходную реставрацию:',error);
    window.dispatchEvent(new CustomEvent('keynlock:atelier',{
      detail:{type:'error',message:error.message},
    }));
  });
  return atelier;
}
