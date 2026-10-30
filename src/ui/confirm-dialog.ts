// A confirm dialog in punchline's own style, instead of the browser's plain confirm().
// Built with el(), so day data can't inject markup.

import { el } from './dom.ts';

export type ConfirmOptions = {
  title: string;
  /** Label and value pairs. A value with `old` is shown struck through. */
  rows: { label: string; value: string; old?: boolean }[];
  note?: string;
  confirmLabel: string;
  /** URL of the punchline icon, relative to the page. */
  icon?: string;
};

/** Shows a modal dialog and resolves with whether the user confirmed. */
export function confirmDialog(options: ConfirmOptions, doc: Document = document): Promise<boolean> {
  const dialog = el('dialog', '', 'confirm');
  const head = el('div', '', 'confirm-head');
  if (options.icon) {
    const icon = el('img');
    icon.src = options.icon;
    icon.alt = '';
    icon.width = 32;
    icon.height = 32;
    head.append(icon);
  }
  head.append(el('h2', options.title));

  const list = el('dl');
  for (const row of options.rows) {
    list.append(el('dt', row.label), el('dd', row.value, row.old ? 'old' : ''));
  }

  const cancel = el('button', 'Cancel', 'secondary');
  cancel.type = 'button';
  cancel.value = 'cancel';
  const ok = el('button', options.confirmLabel);
  ok.type = 'submit';
  ok.value = 'ok';
  const actions = el('form', '', 'confirm-actions');
  actions.method = 'dialog';
  actions.append(cancel, ok);

  dialog.append(head, list);
  if (options.note) dialog.append(el('p', options.note, 'hint'));
  dialog.append(actions);

  return new Promise((resolve) => {
    cancel.addEventListener('click', () => dialog.close('cancel'));
    // Escape closes the dialog with an empty return value, which counts as cancel.
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    doc.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
