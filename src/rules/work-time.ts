// Legal limits that punchline only warns about. It never refuses to write a day: the Harvest
// hours are what people worked, and leaving them out of HRworks would be worse than a record
// that shows a violation.

import { formatDuration, weekday } from '../lib/time.ts';
import type { BreakPresetId } from './breaks.ts';

/**
 * Most net minutes allowed per day. Germany: ArbZG §3 allows at most 10 h. Switzerland only
 * limits the week (ArG Art. 9), so there is no daily limit to check.
 */
export const DAILY_MAX_MINUTES: Readonly<Record<BreakPresetId, number | null>> = {
  ch: null,
  de: 600,
};

/** The daily limit for the chosen break preset. Custom rules have none. */
export function dailyMaxFor(preset: BreakPresetId | 'custom'): number | null {
  return preset === 'custom' ? null : DAILY_MAX_MINUTES[preset];
}

/** Warnings for a day with `netMinutes` of work, for the preview and the HRworks badges. */
export function workTimeWarnings(
  date: string,
  netMinutes: number,
  maxNetMinutes: number | null,
): string[] {
  const warnings: string[] = [];
  if (maxNetMinutes !== null && netMinutes > maxNetMinutes) {
    warnings.push(`More than the legal ${formatDuration(maxNetMinutes)} h a day`);
  }
  // Both Germany (ArbZG §9) and Switzerland (ArG Art. 18) generally ban Sunday work.
  if (netMinutes > 0 && weekday(date) === 0) warnings.push('Sunday work');
  return warnings;
}
