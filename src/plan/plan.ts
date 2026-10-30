// Decides what to do with each day by comparing Harvest with what HRworks already shows.
// Harvest is the source of truth. Net hours (after breaks) are compared on both sides.

import type { DayRow } from '../days/harvest-days.ts';
import type { DayTimes } from '../rules/breaks.ts';

/** One start/end pair as HRworks shows it. */
export type HrworksEntry = { start: string; end: string };

/** What HRworks shows for a day. Produced by the HRworks page reader. */
export type HrworksDay = {
  date: string;
  /** Existing start/end pairs. An open entry (no end yet) has an empty `end`. */
  entries: HrworksEntry[];
  /** Absence or holiday shown by HRworks, e.g. "Jahresurlaub". Empty if none. */
  absence: string;
  /** False when HRworks says the work plan has no work that day (weekends). */
  workday: boolean;
  /** Net hours HRworks credits for the day, if it could be read. */
  creditedMinutes: number | null;
};

export type ConflictMode = 'flag' | 'override';

export type DayAction =
  | { action: 'create'; times: DayTimes }
  | { action: 'override'; times: DayTimes; previous: HrworksEntry[] }
  | { action: 'skip'; reason: string }
  | { action: 'flag'; reason: string }
  | { action: 'check'; reason: string }
  | { action: 'none'; reason: string };

export type PlannedDay = { harvest: DayRow; hrworks: HrworksDay | null } & DayAction;

/** Harvest rounds to whole minutes and HRworks shows whole minutes, so allow one minute. */
const TOLERANCE_MINUTES = 1;

export type PlanOptions = {
  mode: ConflictMode;
  /** Write Harvest hours on days without a work plan in HRworks, such as weekends. */
  weekendHours: boolean;
};

function decide(
  harvest: DayRow,
  hrworks: HrworksDay | null,
  { mode, weekendHours }: PlanOptions,
): DayAction {
  if (!hrworks) return { action: 'flag', reason: 'Day not found in HRworks' };

  if (harvest.status === 'incomplete') return { action: 'none', reason: harvest.reason };
  if (harvest.status === 'error') return { action: 'flag', reason: harvest.error };

  if (harvest.status === 'no-hours') {
    // Never create or change anything without Harvest hours. Just show what HRworks has.
    if (hrworks.entries.length > 0) {
      return { action: 'flag', reason: 'HRworks has an entry but Harvest has no hours' };
    }
    if (hrworks.absence) return { action: 'none', reason: hrworks.absence };
    if (harvest.weekend || !hrworks.workday) return { action: 'none', reason: 'Weekend' };
    return { action: 'check', reason: 'No hours in Harvest or HRworks, check manually' };
  }

  const { times } = harvest;
  // Days without a work plan (weekends) are only written when the user turned that on.
  const offPlan = !hrworks.workday && !weekendHours;
  if (hrworks.entries.length === 0) {
    // An absence with Harvest hours needs a human: one of the two systems is wrong.
    if (hrworks.absence) {
      return { action: 'flag', reason: `HRworks shows "${hrworks.absence}"` };
    }
    if (offPlan) return { action: 'none', reason: 'Weekend hours are off in the settings' };
    return { action: 'create', times };
  }
  if (hrworks.entries.length > 1) {
    return { action: 'flag', reason: 'HRworks has several entries on this day' };
  }
  if (hrworks.entries.some((entry) => !entry.end)) {
    return { action: 'flag', reason: 'HRworks has an open entry on this day' };
  }
  if (hrworks.creditedMinutes === null) {
    return { action: 'flag', reason: 'Could not read the hours HRworks credits' };
  }
  const difference = hrworks.creditedMinutes - harvest.netMinutes;
  if (Math.abs(difference) <= TOLERANCE_MINUTES) {
    return { action: 'skip', reason: 'Already matches Harvest' };
  }
  if (mode === 'override' && !offPlan) {
    return { action: 'override', times, previous: hrworks.entries };
  }
  return { action: 'flag', reason: 'HRworks differs from Harvest' };
}

export function planDays(
  harvestRows: readonly DayRow[],
  hrworksDays: readonly HrworksDay[],
  options: PlanOptions,
): PlannedDay[] {
  const byDate = new Map(hrworksDays.map((day) => [day.date, day]));
  return harvestRows.map((harvest) => {
    const hrworks = byDate.get(harvest.date) ?? null;
    return { harvest, hrworks, ...decide(harvest, hrworks, options) };
  });
}
