// What the days table shows for each row. Kept apart from the page so it can be tested.

import { addDays, formatDuration, isIsoDate, weekday } from '../lib/time.ts';
import type { DayRow } from './harvest-days.ts';

export type NoteKind = '' | 'muted' | 'warn' | 'error';

export type DayCells = {
  harvest: string;
  start: string;
  end: string;
  break: string;
  note: string;
  noteKind: NoteKind;
};

function note(row: DayRow): [string, NoteKind] {
  switch (row.status) {
    case 'times':
      return ['', ''];
    case 'no-hours':
      return row.weekend ? ['Weekend', 'muted'] : ['No hours, check manually', 'warn'];
    case 'incomplete':
      return [row.reason, 'muted'];
    case 'error':
      return [row.error, 'error'];
  }
}

export function dayCells(row: DayRow): DayCells {
  const times = row.status === 'times' ? row.times : null;
  const [text, kind] = note(row);
  return {
    harvest: row.netMinutes > 0 ? formatDuration(row.netMinutes) : '–',
    start: times?.start ?? '',
    end: times?.end ?? '',
    break: times ? formatDuration(times.breakMinutes) : '',
    note: text,
    noteKind: kind,
  };
}

/** This month up to yesterday. On the 1st, that's the whole previous month. */
export function defaultRange(today: string): { from: string; to: string } {
  const yesterday = addDays(today, -1);
  return { from: `${yesterday.slice(0, 7)}-01`, to: yesterday };
}

export type RangePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month';

/** Quick ranges, so the date picker isn't needed (it misbehaves in the side panel). */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case 'this-week':
      return { from: monday, to: today };
    case 'last-week':
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'this-month':
      return { from: firstOfMonth, to: today };
    case 'last-month': {
      const lastDay = addDays(firstOfMonth, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    }
  }
}

export const MAX_DAYS = 400;

/** Why a date range can't be loaded, or null if it can. */
export function rangeError(from: string, to: string): string | null {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return 'Pick a start date on or before the end date.';
  }
  if (addDays(from, MAX_DAYS) <= to) return `Pick at most ${MAX_DAYS} days at a time.`;
  return null;
}
