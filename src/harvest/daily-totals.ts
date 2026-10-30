import type { HarvestTimeEntry } from './client.ts';

export type HarvestDay = { minutes: number; running: boolean };

/** Sums entries per day. Rounds to whole minutes only after summing, as HRworks has no seconds. */
export function dailyTotals(entries: readonly HarvestTimeEntry[]): Map<string, HarvestDay> {
  const hours = new Map<string, { hours: number; running: boolean }>();
  for (const entry of entries) {
    const day = hours.get(entry.spentDate) ?? { hours: 0, running: false };
    day.hours += entry.hours;
    day.running ||= entry.isRunning;
    hours.set(entry.spentDate, day);
  }
  const days = new Map<string, HarvestDay>();
  for (const [date, day] of hours) {
    days.set(date, { minutes: Math.round(day.hours * 60), running: day.running });
  }
  return days;
}
