// A confirm dialog in punchline's own style, instead of the browser's plain confirm().
// Built with el(), so day data can't inject markup.

import { el } from './dom.ts';

export type ConfirmOptions = {
  title: string;
  /** Label and value pairs. A value with `old` is shown struck through. */
  rows: { label: string; value: string; old?: boolean }[];
  note?: string;
  confirmLabel: string;
  /** The punchline icon: a URL relative to the page, or an element where images can't load. */
  icon?: string | Element;
};

function header(title: string, iconSource: string | Element | undefined): HTMLDivElement {
  const head = el('div', '', 'confirm-head');
  if (typeof iconSource === 'string') {
    const icon = el('img');
    icon.src = iconSource;
    icon.alt = '';
    icon.width = 32;
    icon.height = 32;
    head.append(icon);
  } else if (iconSource) {
    head.append(iconSource);
  }
  head.append(el('h2', title));
  return head;
}

function actionButtons(confirmLabel: string) {
  const cancel = el('button', 'Cancel', 'secondary');
  cancel.type = 'button';
  cancel.value = 'cancel';
  const ok = el('button', confirmLabel);
  ok.type = 'submit';
  ok.value = 'ok';
  const form = el('form', '', 'confirm-actions');
  form.method = 'dialog';
  form.append(cancel, ok);
  return { cancel, ok, form };
}

/** Shows the dialog and resolves with whether the user confirmed. Escape counts as cancel. */
function show(dialog: HTMLDialogElement, cancel: HTMLButtonElement, container: ParentNode) {
  return new Promise<boolean>((resolve) => {
    cancel.addEventListener('click', () => dialog.close('cancel'));
    // Escape closes the dialog with an empty return value.
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    container.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

/** Shows a modal dialog and resolves with whether the user confirmed. */
/** `container` is where the dialog goes, such as a shadow root on a page punchline is injected in. */
export function confirmDialog(
  options: ConfirmOptions,
  container: ParentNode = document.body,
): Promise<boolean> {
  const dialog = el('dialog', '', 'confirm');
  const head = header(options.title, options.icon);

  const list = el('dl');
  for (const row of options.rows) {
    list.append(el('dt', row.label), el('dd', row.value, row.old ? 'old' : ''));
  }

  const { cancel, form } = actionButtons(options.confirmLabel);
  dialog.append(head, list);
  if (options.note) dialog.append(el('p', options.note, 'hint'));
  dialog.append(form);
  return show(dialog, cancel, container);
}

export type SelectOptions = {
  title: string;
  /** One row per change. `before` is shown struck through, then an arrow and `after`. */
  rows: { label: string; before?: string; after: string }[];
  note?: string;
  /** The confirm button's label, followed by the number of selected rows. */
  confirmLabel: string;
  icon?: string | Element;
};

/**
 * Lists changes with a checkbox each, all ticked. Resolves with the indexes of the ticked rows,
 * or null when cancelled. The confirm button is disabled while nothing is ticked.
 */
export async function selectDialog(
  options: SelectOptions,
  container: ParentNode = document.body,
): Promise<number[] | null> {
  const dialog = el('dialog', '', 'confirm');
  const list = el('div', '', 'changes');
  const boxes = options.rows.map((row) => {
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    const change = el('span', '', 'change');
    change.append(el('span', row.label, 'change-day'));
    if (row.before) change.append(el('span', row.before, 'old muted'), el('span', '→', 'muted'));
    change.append(el('span', row.after));
    const label = el('label');
    label.append(box, change);
    list.append(label);
    return box;
  });
  const count = el('p', '', 'selected-count');
  const { cancel, ok, form } = actionButtons(options.confirmLabel);
  const update = () => {
    const ticked = boxes.filter((box) => box.checked).length;
    count.textContent = `${ticked} of ${boxes.length} selected`;
    ok.textContent = `${options.confirmLabel} (${ticked})`;
    ok.disabled = ticked === 0;
  };
  list.addEventListener('change', update);
  update();

  dialog.append(header(options.title, options.icon), list, count);
  if (options.note) dialog.append(el('p', options.note, 'hint'));
  dialog.append(form);
  if (!(await show(dialog, cancel, container))) return null;
  return boxes.flatMap((box, i) => (box.checked ? [i] : []));
}
