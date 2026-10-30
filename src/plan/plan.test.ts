import { describe, expect, it } from 'vitest';
import type { DayRow } from '../days/harvest-days.ts';
import { type HrworksDay, planDays } from './plan.ts';

const times = { start: '07:00', end: '16:00', breakMinutes: 30 };

const harvest = (overrides: Partial<DayRow> = {}): DayRow =>
  ({
    date: '2026-01-05',
    weekend: false,
    netMinutes: 510,
    status: 'times',
    times,
    ...overrides,
  }) as DayRow;

const hrworks = (overrides: Partial<HrworksDay> = {}): HrworksDay => ({
  date: '2026-01-05',
  entries: [],
  absence: '',
  workday: true,
  creditedMinutes: null,
  ...overrides,
});

const plan = (
  row: DayRow,
  day: HrworksDay | null,
  mode: 'flag' | 'override' = 'flag',
  weekendHours = false,
) => {
  const [planned] = planDays([row], day ? [day] : [], { mode, weekendHours });
  return planned;
};

describe('planDays with Harvest hours', () => {
  it('creates an entry on an empty day', () => {
    expect(plan(harvest(), hrworks())).toMatchObject({ action: 'create', times });
  });

  it('writes weekend hours only when turned on', () => {
    const day = hrworks({ workday: false });
    const row = harvest({ weekend: true });
    expect(plan(row, day)).toMatchObject({ action: 'none', reason: /off in the settings/ });
    expect(plan(row, day, 'flag', true)).toMatchObject({ action: 'create' });
    const entry = hrworks({
      workday: false,
      entries: [{ start: '07:00', end: '12:00' }],
      creditedMinutes: 300,
    });
    expect(plan(row, entry, 'override')).toMatchObject({ action: 'flag' });
    expect(plan(row, entry, 'override', true)).toMatchObject({ action: 'override' });
  });

  it('skips a day that already matches, within a minute', () => {
    const day = hrworks({ entries: [{ start: '07:00', end: '16:00' }], creditedMinutes: 511 });
    expect(plan(harvest(), day)).toMatchObject({ action: 'skip' });
  });

  it('flags a different day in flag mode', () => {
    const day = hrworks({ entries: [{ start: '08:00', end: '16:00' }], creditedMinutes: 450 });
    expect(plan(harvest(), day)).toMatchObject({
      action: 'flag',
      reason: 'HRworks differs from Harvest',
    });
  });

  it('overrides a different day in override mode and keeps the old values', () => {
    const previous = [{ start: '08:00', end: '16:00' }];
    const day = hrworks({ entries: previous, creditedMinutes: 450 });
    expect(plan(harvest(), day, 'override')).toMatchObject({ action: 'override', previous, times });
  });

  it('never overrides what it cannot read safely', () => {
    const several = hrworks({
      entries: [
        { start: '07:00', end: '12:00' },
        { start: '13:00', end: '16:00' },
      ],
      creditedMinutes: 480,
    });
    const open = hrworks({ entries: [{ start: '07:00', end: '' }], creditedMinutes: 0 });
    const unreadable = hrworks({ entries: [{ start: '07:00', end: '16:00' }] });
    for (const day of [several, open, unreadable]) {
      expect(plan(harvest(), day, 'override')?.action).toBe('flag');
    }
  });

  it('flags an absence on a day with Harvest hours', () => {
    expect(plan(harvest(), hrworks({ absence: 'Jahresurlaub', workday: false }))).toMatchObject({
      action: 'flag',
      reason: 'HRworks shows "Jahresurlaub"',
    });
  });
});

describe('planDays without Harvest hours', () => {
  const noHours = harvest({ netMinutes: 0, status: 'no-hours' } as Partial<DayRow>);

  it('shows the HRworks absence', () => {
    expect(plan(noHours, hrworks({ absence: 'Krankheit' }))).toMatchObject({
      action: 'none',
      reason: 'Krankheit',
    });
  });

  it('asks for a manual check when neither side has anything', () => {
    expect(plan(noHours, hrworks())).toMatchObject({ action: 'check' });
  });

  it('stays quiet on weekends', () => {
    const weekend = { ...noHours, weekend: true } as DayRow;
    expect(plan(weekend, hrworks({ workday: false }))).toMatchObject({
      action: 'none',
      reason: 'Weekend',
    });
  });

  it('flags HRworks entries that Harvest does not have', () => {
    const day = hrworks({ entries: [{ start: '07:00', end: '16:00' }], creditedMinutes: 510 });
    expect(plan(noHours, day)?.action).toBe('flag');
  });
});

describe('planDays edge cases', () => {
  it('flags a day missing from HRworks', () => {
    expect(plan(harvest(), null)).toMatchObject({ action: 'flag' });
  });

  it('leaves incomplete days alone and flags Harvest errors', () => {
    const today = harvest({ status: 'incomplete', reason: 'Today' } as Partial<DayRow>);
    expect(plan(today, hrworks())).toMatchObject({ action: 'none', reason: 'Today' });
    const error = harvest({ status: 'error', error: 'Too long' } as Partial<DayRow>);
    expect(plan(error, hrworks())).toMatchObject({ action: 'flag', reason: 'Too long' });
  });
});
