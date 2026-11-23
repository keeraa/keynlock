// @ts-check
/**
 * The Atelier's layout inside the Lair, done by the Atelier itself on its own
 * markup. The Lair only provides places (slots) on its screen:
 *   corner — top right: the easel and frame colours and the colour reset;
 *   header — beside «В ЛОГОВО»: «ВСЯ КОЛЛЕКЦИЯ».
 * Within the panel the readiness stands beside the likeness and the control
 * hints join the tools row. Their looks are in styles/embedding.css.
 *
 * @param {HTMLElement} root  the Atelier's markup (#atelier-embedded-app)
 * @param {{ corner?: HTMLElement | null, header?: HTMLElement | null }} slots
 */
export function arrangeEmbeddedLayout(root, { corner = null, header = null } = {}) {
  const moveInto = (slot, kind, ...selectors) => {
    if (!slot) return;
    slot.classList.add('atelier-slot', `atelier-slot--${kind}`);
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) slot.append(element);
    }
  };
  moveInto(corner, 'corner', '.wood-pickers', '#reset-button');
  moveInto(header, 'header', '#collection-footer');
  const readiness = root.querySelector('.restoration-feedback');
  if (readiness) root.querySelector('.workbench-main')?.append(readiness);
  const hints = root.querySelector('.workbench-footer .keyboard-tip');
  if (hints) root.querySelector('.restoration-row')?.append(hints);
}
