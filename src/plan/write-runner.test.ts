import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayRow } from '../days/harvest-days.ts';
import type { HrworksDay } from './plan.ts';
import type { WriteLogEntry } from './write-log.ts';
import { holdUnchecked, runWrites, toWriteDay, type WritableDay } from './write-runner.ts';

const times = { start: '08:00', end: '16:30', breakMinutes: 30 };
function day(date: string, action: 'create' | 'override' = 'create'): WritableDay {
  const harvest: DayRow = { date, weekend: false, netMinutes: 480, status: 'times', times };
  const hrworks: HrworksDay = {
    date,
    entries: [],
    absence: '',
    workday: true,
    creditedMinutes: null,
  };
  return action === 'create'
    ? { harvest, hrworks, action, times }
    : { harvest, hrworks, action, times, previous: [{ start: '07:30', end: '18:00' }] };
}

let store: Record<string, unknown>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (items: Record<string, unknown>) => Object.assign(store, items),
      },
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const log = () => store.writeLog as WriteLogEntry[];

describe('toWriteDay', () => {
  it('carries the previous entries of an override', () => {
    expect(toWriteDay(day('2026-08-17', 'override'))).toEqual({
      date: '2026-08-17',
      start: '08:00',
      end: '16:30',
      expectedMinutes: 480,
      previous: [{ start: '07:30', end: '18:00' }],
    });
  });
});

describe('holdUnchecked', () => {
  const unknown: WriteLogEntry = {
    at: '2026-10-30T20:00:00.000Z',
    date: '2026-08-17',
    action: 'create',
    start: '08:00',
    end: '16:30',
    previous: [],
    result: 'unknown',
    message: '',
  };

  it('holds a day saved without a check after the last read', () => {
    const result = holdUnchecked(
      [day('2026-08-17'), day('2026-08-18')],
      [unknown],
      '2026-10-30T19:00:00Z',
    );
    expect(result.held.map((d) => d.harvest.date)).toEqual(['2026-08-17']);
    expect(result.ready.map((d) => d.harvest.date)).toEqual(['2026-08-18']);
  });

  it('releases it once HRworks was read again', () => {
    const result = holdUnchecked([day('2026-08-17')], [unknown], '2026-10-30T21:00:00Z');
    expect(result.held).toEqual([]);
    expect(result.earlier).toBe(unknown);
  });
});

describe('runWrites', () => {
  it('writes week by week, logs before and after, and reports progress', async () => {
    const sent: string[][] = [];
    const shown: string[] = [];
    const result = await runWrites([day('2026-08-17'), day('2026-08-24')], {
      send: async (week) => {
        sent.push(week.map((d) => d.date));
        return week.map((d) => ({
          ok: true,
          day: { date: d.date, entries: [], absence: '', workday: true, creditedMinutes: 480 },
        }));
      },
      show: (date, text) => shown.push(`${date} ${text}`),
    });
    expect(sent).toEqual([['2026-08-17'], ['2026-08-24']]);
    expect(result).toEqual({ written: ['2026-08-17', '2026-08-24'], stop: '' });
    expect(log().map((e) => e.result)).toEqual(['unknown', 'ok', 'unknown', 'ok']);
    expect(shown).toContain('2026-08-17 Written and checked');
  });

  it('stops at the day that failed and logs a request that may have saved as unknown', async () => {
    const result = await runWrites([day('2026-08-17'), day('2026-08-24')], {
      send: async () => 'Lost contact',
      maySaved: (error) => error === 'Lost contact',
      show: () => {},
    });
    expect(result).toEqual({ written: [], stop: '2026-08-17' });
    expect(log().map((e) => e.result)).toEqual(['unknown', 'unknown']);
  });

  it('names the day that stopped the week, not one held back by it', async () => {
    const result = await runWrites([day('2026-08-17'), day('2026-08-18')], {
      send: async () => [
        {
          ok: false,
          error: 'Not saved, because 2026-08-18 stopped the week.',
          saved: false,
          blockedBy: '2026-08-18',
        },
        { ok: false, error: 'HRworks said no.', saved: false },
      ],
      show: () => {},
    });
    expect(result.stop).toBe('2026-08-18');
    expect(log().at(-1)?.result).toBe('failed');
  });
});
