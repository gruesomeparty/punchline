// Groups the preview's days into weeks and folds runs of days that need nothing, like a diff
// hides unchanged lines. Kept apart from the page so it can be tested.

import { addDays, weekday } from '../lib/time.ts';

export type ListItem<T> = { kind: 'day'; item: T } | { kind: 'fold'; items: T[] };

export type WeekGroup<T> = {
  /** ISO week number, the "KW" HRworks shows. */
  week: number;
  items: ListItem<T>[];
  /** Every day of the week needs nothing. */
  quiet: boolean;
};

/** The ISO 8601 week number of a date (`YYYY-MM-DD`). */
export function isoWeek(date: string): number {
  // The week belongs to the year of its Thursday, and week 1 holds that year's 4 January.
  const thursday = addDays(date, 3 - ((weekday(date) + 6) % 7));
  const firstJan = `${thursday.slice(0, 4)}-01-01`;
  const dayOfYear = Math.round((Date.parse(thursday) - Date.parse(firstJan)) / 86_400_000);
  return Math.floor(dayOfYear / 7) + 1;
}

function monday(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/**
 * Splits days into Monday-to-Sunday weeks, oldest first. With `fold`, every run of two or more
 * quiet days inside a week becomes one fold item. A single quiet day stays a plain row.
 */
export function groupDays<T>(
  days: readonly T[],
  dateOf: (item: T) => string,
  isQuiet: (item: T) => boolean,
  fold: boolean,
): WeekGroup<T>[] {
  const weeks = new Map<string, T[]>();
  for (const day of [...days].sort((a, b) => dateOf(a).localeCompare(dateOf(b)))) {
    const key = monday(dateOf(day));
    weeks.set(key, [...(weeks.get(key) ?? []), day]);
  }
  return [...weeks.values()].map((week) => {
    const items: ListItem<T>[] = [];
    let run: T[] = [];
    const flush = () => {
      if (run.length >= 2 && fold) items.push({ kind: 'fold', items: run });
      else items.push(...run.map((item): ListItem<T> => ({ kind: 'day', item })));
      run = [];
    };
    for (const day of week) {
      if (isQuiet(day)) {
        run.push(day);
      } else {
        flush();
        items.push({ kind: 'day', item: day });
      }
    }
    flush();
    return {
      week: isoWeek(dateOf(week[0] as T)),
      items,
      quiet: week.every(isQuiet),
    };
  });
}
