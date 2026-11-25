import './music-dock.css';

/** Reveal the player for a mouse, with a button for keyboard and touch. */
export function mountMusicDock(dock) {
  const toggle = dock.querySelector('#lair-music-toggle');
  const panel = dock.querySelector('#lair-music');
  let hovered = false;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    if (!open) panel.querySelector('.music-controls__title[aria-expanded="true"]')?.click();
  }

  dock.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    setOpen(true);
  });
  dock.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = false;
    setOpen(false);
  });
  toggle.addEventListener('click', () => setOpen(hovered || panel.inert));
  dock.addEventListener('focusout', event => {
    if (!hovered && !dock.contains(event.relatedTarget)) setOpen(false);
  });
  dock.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.inert) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      toggle.focus();
      setOpen(false);
    }
  });
  dock.ownerDocument.addEventListener('pointerdown', event => {
    if (!dock.contains(event.target)) setOpen(false);
  });
}
