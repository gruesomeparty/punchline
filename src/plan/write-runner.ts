// Writes planned days week by week and keeps the write log, for every place that writes: the
// preview page and the badges in HRworks. The caller decides how a week reaches HRworks and how
// progress is shown.

import type { WriteDay, WriteResult } from '../hrworks/write.ts';
import { byHrworksWeek } from './batches.ts';
import type { PlannedDay } from './plan.ts';
import { appendWriteLog, type WriteLogEntry, wasWritten } from './write-log.ts';

export type WritableDay = PlannedDay & { action: 'create' | 'override' };

export function isWritable(day: PlannedDay | null | undefined): day is WritableDay {
  return day?.action === 'create' || day?.action === 'override';
}

/** HRworks' entries before an override, as "07:30–18:00". Empty for a create. */
export function oldTimes(day: WritableDay): string {
  return day.action === 'override'
    ? day.previous.map((entry) => `${entry.start}–${entry.end}`).join(', ')
    : '';
}

export function toWriteDay(day: WritableDay): WriteDay {
  return {
    date: day.harvest.date,
    start: day.times.start,
    end: day.times.end,
    expectedMinutes: day.harvest.netMinutes,
    ...(day.action === 'override' ? { previous: day.previous } : {}),
    ...(day.hrworks?.workday === false ? { dayOff: true } : {}),
  };
}

/**
 * Splits days into those that may be written and those held back. A save whose result couldn't
 * be checked holds its day until HRworks was read again after it (`readAt`, an ISO time), so the
 * confirm shows what HRworks has now. `earlier` is the last logged write of a writable day.
 */
export function holdUnchecked(
  days: readonly WritableDay[],
  log: readonly WriteLogEntry[],
  readAt: string,
): { ready: WritableDay[]; held: WritableDay[]; earlier: WriteLogEntry | null } {
  const ready: WritableDay[] = [];
  const held: WritableDay[] = [];
  let earlier: WriteLogEntry | null = null;
  for (const day of days) {
    const last = wasWritten(log, day.harvest.date);
    if (last?.result === 'unknown' && last.at >= readAt) {
      held.push(day);
    } else {
      ready.push(day);
      earlier = last;
    }
  }
  return { ready, held, earlier };
}

export type RunOptions = {
  /** Writes one HRworks week. A string means the request itself failed. */
  send: (week: WriteDay[]) => Promise<WriteResult[] | string>;
  /** Whether a failed request may still have saved, such as a tab that went away mid-save. */
  maySaved?: (error: string) => boolean;
  /** Shows a day's progress or result. */
  show: (date: string, text: string, kind: 'ok' | 'error' | 'muted') => void;
};

export type RunResult = { written: string[]; stop: string };

/** Writes week by week and stops at the first week with a problem. Never throws. */
export async function runWrites(
  days: readonly WritableDay[],
  options: RunOptions,
): Promise<RunResult> {
  const written: string[] = [];
  let stop = '';
  for (const week of byHrworksWeek(days, (day) => day.harvest.date)) {
    for (const day of week) options.show(day.harvest.date, 'Writing…', 'muted');
    const attempts = week.map((day) => ({
      date: day.harvest.date,
      action: day.action,
      start: day.times.start,
      end: day.times.end,
      previous: day.action === 'override' ? day.previous : [],
    }));
    // Logged before anything is sent, so the old times survive even if the tab closes mid-save.
    for (const attempt of attempts) {
      await appendWriteLog({
        ...attempt,
        at: new Date().toISOString(),
        result: 'unknown',
        message: 'Started, no result yet.',
      });
    }
    const response = await options.send(week.map(toWriteDay));
    const results: WriteResult[] =
      typeof response === 'string'
        ? week.map(() => ({
            ok: false,
            error: response,
            saved: options.maySaved?.(response) ?? false,
          }))
        : response;
    for (const [i, attempt] of attempts.entries()) {
      const result = results[i] ?? { ok: false, error: 'No answer for this day.', saved: true };
      const removed = result.ok ? (result.removed ?? []) : [];
      await appendWriteLog({
        ...attempt,
        previous: [...attempt.previous, ...removed],
        at: new Date().toISOString(),
        result: result.ok ? 'ok' : result.saved ? 'unknown' : 'failed',
        message: result.ok ? '' : result.error,
      });
      if (result.ok) {
        written.push(attempt.date);
        const note = removed.length > 0 ? ` (removed ${removed.length} open entries)` : '';
        options.show(attempt.date, `Written and checked${note}`, 'ok');
      } else {
        const hint = result.saved ? ' Check this day in HRworks.' : '';
        options.show(attempt.date, `${result.error}${hint}`, 'error');
        // Name the day that stopped the week, not a day that was only held back by it.
        stop ||= result.blockedBy ? '' : attempt.date;
      }
    }
    if (!stop && results.some((result) => !result.ok)) stop = week[0]?.harvest.date ?? '?';
    if (stop) break;
  }
  return { written, stop };
}
