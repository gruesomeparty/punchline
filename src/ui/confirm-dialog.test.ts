// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { confirmDialog, selectDialog } from './confirm-dialog.ts';

const options = {
  title: 'Override 23 Jul 2026 in HRworks?',
  rows: [
    { label: 'HRworks now', value: '07:30–18:00', old: true },
    { label: 'New', value: '08:00–17:00' },
  ],
  note: 'HRworks has no undo.',
  confirmLabel: 'Override',
};

function dialog(): HTMLDialogElement {
  const found = document.querySelector('dialog');
  if (!found) throw new Error('no dialog');
  return found;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('confirmDialog', () => {
  it('shows the rows as text and resolves true on confirm', async () => {
    const answer = confirmDialog({ ...options, rows: [{ label: '<b>x</b>', value: '1' }] });
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector('dt')?.textContent).toBe('<b>x</b>');
    dialog().close('ok');
    expect(await answer).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('marks old values and resolves false on cancel', async () => {
    const answer = confirmDialog(options);
    expect(dialog().querySelector('dd.old')?.textContent).toBe('07:30–18:00');
    dialog().querySelector<HTMLButtonElement>('button.secondary')?.click();
    expect(await answer).toBe(false);
  });

  it('counts Escape as cancel', async () => {
    const answer = confirmDialog(options);
    dialog().close();
    expect(await answer).toBe(false);
  });
});

describe('selectDialog', () => {
  const rows = [
    { label: 'Mon 17', after: '08:00–17:00' },
    { label: 'Tue 18', before: '22:28–', after: '08:00–19:30' },
  ];

  it('starts with every row ticked and resolves with the ticked ones', async () => {
    const answer = selectDialog({ title: 'Write?', rows, confirmLabel: 'Write' });
    expect(dialog().querySelector('.selected-count')?.textContent).toBe('2 of 2 selected');
    expect(dialog().querySelector('.old')?.textContent).toBe('22:28–');
    const [first] = dialog().querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    first?.click();
    expect(dialog().querySelector('.selected-count')?.textContent).toBe('1 of 2 selected');
    expect(dialog().querySelector('button[value="ok"]')?.textContent).toBe('Write (1)');
    dialog().close('ok');
    expect(await answer).toEqual([1]);
  });

  it('disables confirm with nothing ticked and resolves null on cancel', async () => {
    const answer = selectDialog({ title: 'Write?', rows, confirmLabel: 'Write' });
    for (const box of dialog().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      box.click();
    }
    expect(dialog().querySelector<HTMLButtonElement>('button[value="ok"]')?.disabled).toBe(true);
    dialog().close();
    expect(await answer).toBeNull();
  });
});
