// How the preview shows a planned day. Kept apart from the page so it can be tested.

import { dayCells } from '../days/day-cells.ts';
import type { DayRow } from '../days/harvest-days.ts';
import { formatDuration } from '../lib/time.ts';
import type { PlannedDay } from './plan.ts';

export type ActionKind = 'create' | 'override' | 'skip' | 'flag' | 'check' | 'none';

export type PlanCells = {
  /** What HRworks has now: "07:00–16:00 (8:30)", "Jahresurlaub", "Empty", … */
  hrworks: string;
  /** What punchline will enter, if anything: "07:00–16:00". */
  planned: string;
  action: string;
  kind: ActionKind;
  reason: string;
};

const ACTION_LABELS: Record<ActionKind, string> = {
  create: 'Create',
  override: 'Override',
  skip: 'Skip',
  flag: 'Flag',
  check: 'Check',
  none: '',
};

function describeHrworks(day: PlannedDay): string {
  const hrworks = day.hrworks;
  if (!hrworks) return 'Not found';
  if (hrworks.entries.length > 0) {
    const pairs = hrworks.entries.map((e) => `${e.start}–${e.end || '…'}`).join(', ');
    return hrworks.creditedMinutes === null
      ? pairs
      : `${pairs} (${formatDuration(hrworks.creditedMinutes)})`;
  }
  if (hrworks.absence) return hrworks.absence;
  return hrworks.workday ? 'Empty' : 'No workday';
}

export function planCells(day: PlannedDay): PlanCells {
  const planned =
    day.action === 'create' || day.action === 'override'
      ? `${day.times.start}–${day.times.end}`
      : '';
  return {
    hrworks: describeHrworks(day),
    planned,
    action: ACTION_LABELS[day.action],
    kind: day.action,
    reason: 'reason' in day ? day.reason : '',
  };
}

export type CellKind = '' | 'ok' | 'muted' | 'warn' | 'error';

const ACTION_KINDS: Record<ActionKind, CellKind> = {
  create: 'ok',
  override: 'warn',
  skip: 'muted',
  flag: 'warn',
  check: 'warn',
  none: 'muted',
};

export type PreviewCells = {
  harvest: string;
  hrworks: string;
  enter: string;
  break: string;
  action: string;
  actionKind: CellKind;
  note: string;
  noteKind: CellKind;
};

/** One row of the days table, with or without the HRworks comparison. */
export function previewCells(row: DayRow, planned: PlannedDay | null): PreviewCells {
  const harvest = dayCells(row);
  if (!planned) {
    return {
      harvest: harvest.harvest,
      hrworks: '',
      enter: harvest.start ? `${harvest.start}–${harvest.end}` : '',
      break: harvest.break,
      action: '',
      actionKind: '',
      note: harvest.note,
      noteKind: harvest.noteKind,
    };
  }
  const cells = planCells(planned);
  const times = planned.action === 'create' || planned.action === 'override' ? planned.times : null;
  return {
    harvest: harvest.harvest,
    hrworks: cells.hrworks,
    enter: cells.planned,
    break: times ? formatDuration(times.breakMinutes) : '',
    action: cells.action,
    actionKind: ACTION_KINDS[cells.kind],
    note: cells.reason,
    noteKind: cells.kind === 'none' || cells.kind === 'skip' ? 'muted' : '',
  };
}
