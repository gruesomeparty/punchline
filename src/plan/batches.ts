// Groups days the way HRworks shows them, so each group can be written with one Speichern.
// HRworks weeks run Monday to Sunday and are cut at the month edges.

import { addDays, weekday } from '../lib/time.ts';

function weekKey(date: string): string {
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  return `${date.slice(0, 7)}/${monday}`;
}

/** Splits items into HRworks weeks, oldest first. */
export function byHrworksWeek<T>(items: readonly T[], dateOf: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => dateOf(a).localeCompare(dateOf(b)))) {
    const key = weekKey(dateOf(item));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}
