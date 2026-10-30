// Mandatory breaks and the start/end times that produce a given net working time.
//
// HRworks deducts breaks automatically, based on the time entered for the day (gross).
// To make HRworks show the same net hours as Harvest, we enter a gross time that is
// exactly net + the break HRworks will take off for that gross time.

import { formatTime, MINUTES_PER_DAY } from '../lib/time.ts';

/** If more than `afterMinutes` are entered for a day, `breakMinutes` are deducted. */
export type BreakRule = { afterMinutes: number; breakMinutes: number };

export type BreakPresetId = 'ch' | 'de';

export const BREAK_PRESETS: Readonly<Record<BreakPresetId, { label: string; rules: BreakRule[] }>> =
  {
    // ArG Art. 15: 15 min above 5.5 h, 30 min above 7 h, 60 min above 9 h.
    ch: {
      label: 'Switzerland',
      rules: [
        { afterMinutes: 330, breakMinutes: 15 },
        { afterMinutes: 420, breakMinutes: 30 },
        { afterMinutes: 540, breakMinutes: 60 },
      ],
    },
    // ArbZG §4: 30 min above 6 h, 45 min above 9 h.
    de: {
      label: 'Germany',
      rules: [
        { afterMinutes: 360, breakMinutes: 30 },
        { afterMinutes: 540, breakMinutes: 45 },
      ],
    },
  };

/** The break deducted for a day with `grossMinutes` entered. The longest matching break wins. */
export function breakFor(grossMinutes: number, rules: readonly BreakRule[]): number {
  let result = 0;
  for (const rule of rules) {
    if (grossMinutes > rule.afterMinutes) result = Math.max(result, rule.breakMinutes);
  }
  return result;
}

/**
 * The shortest gross time that leaves exactly `netMinutes` after breaks. The gross time is
 * net + one of the possible breaks, so it's enough to try each of them. One always fits:
 * gross minus break grows minute by minute and only drops back at a threshold, so it can't
 * skip a value.
 */
export function grossFor(netMinutes: number, rules: readonly BreakRule[]): number {
  const candidates = [0, ...rules.map((rule) => rule.breakMinutes)]
    .map((breakMinutes) => netMinutes + breakMinutes)
    .filter((gross) => gross - breakFor(gross, rules) === netMinutes);
  return Math.min(...candidates);
}

export type DayTimes = { start: string; end: string; breakMinutes: number };

export type DayTimesResult = { ok: true; times: DayTimes } | { ok: false; error: string };

/** Start and end times for a day with `netMinutes` of work, starting at `startMinutes`. */
export function dayTimes(
  netMinutes: number,
  startMinutes: number,
  rules: readonly BreakRule[],
): DayTimesResult {
  const gross = grossFor(netMinutes, rules);
  const end = startMinutes + gross;
  // HRworks silently turns an end before the start into an overnight shift, so never go
  // past midnight.
  if (end >= MINUTES_PER_DAY) {
    return { ok: false, error: 'The end time would be after midnight.' };
  }
  return {
    ok: true,
    times: {
      start: formatTime(startMinutes),
      end: formatTime(end),
      breakMinutes: gross - netMinutes,
    },
  };
}

/** Problems with a rule list, for the settings page. An empty list means the rules are usable. */
export function validateRules(rules: readonly BreakRule[]): string[] {
  const errors: string[] = [];
  for (const [i, rule] of rules.entries()) {
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < MINUTES_PER_DAY;
    if (!ok(rule.afterMinutes) || !ok(rule.breakMinutes)) {
      errors.push(`Rule ${i + 1}: use whole minutes between 0 and 24 hours.`);
    }
  }
  const sorted = [...rules].sort((a, b) => a.afterMinutes - b.afterMinutes);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const rule = sorted[i];
    if (prev && rule && rule.breakMinutes <= prev.breakMinutes) {
      errors.push('A longer day must have a longer break than a shorter one.');
      break;
    }
  }
  return errors;
}
