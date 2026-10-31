// Turns Harvest totals into one row per day: what HRworks should get, or why it gets nothing.
// HRworks isn't involved yet. The preview compares these rows with HRworks later.

import type { HarvestDay } from '../harvest/daily-totals.ts';
import { datesBetween, isWeekend } from '../lib/time.ts';
import { type BreakRule, type DayTimes, dayTimes } from '../rules/breaks.ts';
import { workTimeWarnings } from '../rules/work-time.ts';

/** `warnings` name legal limits a day goes over. They never stop it from being written. */
export type DayRow = {
  date: string;
  weekend: boolean;
  netMinutes: number;
} & (
  | { status: 'times'; times: DayTimes; warnings?: string[] }
  | { status: 'no-hours' }
  | { status: 'incomplete'; reason: string }
  | { status: 'error'; error: string }
);

export type DayOptions = {
  startMinutes: number;
  rules: readonly BreakRule[];
  today: string;
  /** Legal daily maximum in net minutes, or null for none. */
  maxNetMinutes: number | null;
};

export function harvestDays(
  from: string,
  to: string,
  totals: ReadonlyMap<string, HarvestDay>,
  options: DayOptions,
): DayRow[] {
  return datesBetween(from, to).map((date): DayRow => {
    const day = totals.get(date);
    const base = { date, weekend: isWeekend(date), netMinutes: day?.minutes ?? 0 };
    // Today and future days may still change in Harvest, so they're never final.
    if (date >= options.today) {
      return { ...base, status: 'incomplete', reason: date === options.today ? 'Today' : 'Future' };
    }
    if (day?.running) return { ...base, status: 'incomplete', reason: 'Timer running' };
    if (!day || day.minutes === 0) return { ...base, status: 'no-hours' };
    const result = dayTimes(day.minutes, options.startMinutes, options.rules);
    if (!result.ok) return { ...base, status: 'error', error: result.error };
    const warnings = workTimeWarnings(date, day.minutes, options.maxNetMinutes);
    return { ...base, status: 'times', times: result.times, warnings };
  });
}
