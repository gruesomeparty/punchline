// What one day row of the preview list shows. Kept apart from the page so it can be tested.

import type { PlannedDay } from '../plan/plan.ts';
import { type ActionKind, planCells, previewCells } from '../plan/plan-cells.ts';
import type { DayRow } from './harvest-days.ts';

export type DayView = {
  /** What goes into HRworks, or the Harvest times before HRworks was read: "08:00 → 17:00". */
  times: string;
  pill: { label: string; kind: ActionKind } | null;
  /** HRworks' current entries for an override, shown struck through. */
  before: string;
  /** Secondary facts: "Harvest 8:00 · break 0:30 · HRworks Empty". */
  details: string;
  note: string;
  noteKind: string;
  /** Nothing to do on this day, so it can be folded away. */
  quiet: boolean;
};

export function isQuiet(planned: PlannedDay | null): boolean {
  if (!planned) return false;
  if (planned.action === 'skip') return true;
  return (
    planned.action === 'none' &&
    planned.harvest.netMinutes === 0 &&
    (planned.hrworks?.entries.length ?? 0) === 0
  );
}

export function dayView(row: DayRow, planned: PlannedDay | null): DayView {
  const cells = previewCells(row, planned);
  const enter = cells.enter.replace('–', ' → ');
  const details = [
    `Harvest ${cells.harvest}`,
    cells.break ? `break ${cells.break}` : '',
    planned && planned.action !== 'override' ? `HRworks ${cells.hrworks}` : '',
  ].filter(Boolean);
  if (!planned) {
    return {
      times: enter,
      pill: null,
      before: '',
      details: details.join(' · '),
      note: cells.note,
      noteKind: cells.noteKind,
      quiet: false,
    };
  }
  const plan = planCells(planned);
  // A day that matches shows what HRworks has, since nothing will be entered.
  const shown =
    planned.action === 'skip' && planned.hrworks
      ? planned.hrworks.entries.map((e) => `${e.start} → ${e.end}`).join(', ')
      : enter;
  return {
    times: shown,
    pill: plan.action ? { label: plan.action, kind: plan.kind } : null,
    before: planned.action === 'override' ? plan.hrworks : '',
    details: details.join(' · '),
    note: cells.note,
    noteKind: cells.noteKind,
    quiet: isQuiet(planned),
  };
}

/**
 * "✓ Mon 17 – Fri 21 · 5 days match", or "✓ Thu 20 – Sun 23 · 2 match, 2 without hours" when
 * the run includes days without hours. A whole week reads "✓ All 7 days · …".
 */
export function foldLabel(
  days: readonly PlannedDay[],
  shortDay: (date: string) => string,
  wholeWeek = false,
): string {
  const match = days.filter((day) => day.action === 'skip').length;
  const other = days.length - match;
  const what =
    other === 0
      ? `${days.length} days match`
      : match === 0
        ? `${other} days without hours`
        : `${match} match, ${other} without hours`;
  if (wholeWeek) {
    return other === 0 ? `✓ All ${days.length} days match` : `✓ All ${days.length} days · ${what}`;
  }
  const first = days[0]?.harvest.date ?? '';
  const last = days.at(-1)?.harvest.date ?? '';
  const range = days.length > 1 ? `${shortDay(first)} – ${shortDay(last)}` : shortDay(first);
  return `✓ ${range} · ${what}`;
}

/** "3 to create · 1 to override · 18 match", leaving out zeros. */
export function summaryLine(days: readonly PlannedDay[]): string {
  const count = (action: PlannedDay['action']) => days.filter((d) => d.action === action).length;
  const parts = [
    [count('create'), 'to create'],
    [count('override'), 'to override'],
    [count('flag') + count('check'), 'flagged'],
    [count('skip'), 'match'],
  ] as const;
  const text = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  return text.length > 0 ? text.join(' · ') : 'Nothing to do';
}
