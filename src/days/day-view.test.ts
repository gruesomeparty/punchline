import { describe, expect, it } from 'vitest';
import type { HrworksDay, PlannedDay } from '../plan/plan.ts';
import { dayView, foldLabel, isQuiet, summaryLine } from './day-view.ts';
import type { DayRow } from './harvest-days.ts';

const times = { start: '08:00', end: '17:00', breakMinutes: 60 };
const harvest: DayRow = {
  date: '2026-08-17',
  weekend: false,
  netMinutes: 480,
  status: 'times',
  times,
};
const hrworks: HrworksDay = {
  date: '2026-08-17',
  entries: [],
  absence: '',
  workday: true,
  creditedMinutes: null,
};
const create: PlannedDay = { harvest, hrworks, action: 'create', times };
const skip: PlannedDay = {
  harvest,
  hrworks: { ...hrworks, entries: [{ start: '08:00', end: '17:00' }], creditedMinutes: 480 },
  action: 'skip',
  reason: 'Already matches',
};
const weekend: PlannedDay = {
  harvest: { date: '2026-08-22', weekend: true, netMinutes: 0, status: 'no-hours' },
  hrworks: { ...hrworks, date: '2026-08-22', workday: false },
  action: 'none',
  reason: 'Weekend hours are off in the settings',
};

describe('dayView', () => {
  it('shows Harvest times before HRworks was read', () => {
    expect(dayView(harvest, null)).toMatchObject({
      times: '08:00 → 17:00',
      pill: null,
      details: 'Harvest 8:00 · break 1:00',
      quiet: false,
    });
  });

  it('shows legal warnings without changing the action', () => {
    const long: DayRow = { ...harvest, warnings: ['Sunday work', 'More than 10:00 h'] };
    expect(dayView(long, { ...create, harvest: long })).toMatchObject({
      pill: { label: 'Create', kind: 'create' },
      warning: 'Sunday work · More than 10:00 h',
    });
    expect(dayView(harvest, create).warning).toBe('');
  });

  it('shows a create with what HRworks has now', () => {
    expect(dayView(harvest, create)).toMatchObject({
      times: '08:00 → 17:00',
      pill: { label: 'Create', kind: 'create' },
      before: '',
      details: 'Harvest 8:00 · break 1:00 · HRworks Empty',
    });
  });

  it('shows the old entries of an override separately', () => {
    const override: PlannedDay = {
      harvest,
      hrworks: { ...hrworks, entries: [{ start: '07:30', end: '18:00' }], creditedMinutes: 570 },
      action: 'override',
      times,
      previous: [{ start: '07:30', end: '18:00' }],
    };
    expect(dayView(harvest, override)).toMatchObject({
      before: '07:30–18:00 (9:30)',
      details: 'Harvest 8:00 · break 1:00',
    });
  });

  it('shows what HRworks has on a matching day, and marks it quiet', () => {
    expect(dayView(harvest, skip)).toMatchObject({ times: '08:00 → 17:00', quiet: true });
  });
});

describe('isQuiet', () => {
  it('counts matching days and empty days without hours', () => {
    expect(isQuiet(skip)).toBe(true);
    expect(isQuiet(weekend)).toBe(true);
    expect(isQuiet(create)).toBe(false);
    expect(isQuiet(null)).toBe(false);
  });
});

describe('foldLabel', () => {
  const short = (date: string) => `d${date.slice(8)}`;
  it('names the range and whether the days match', () => {
    expect(foldLabel([skip, { ...skip, harvest: { ...harvest, date: '2026-08-21' } }], short)).toBe(
      '✓ d17 – d21 · 2 days match',
    );
    expect(foldLabel([skip, weekend], short)).toBe('✓ d17 – d22 · 1 match, 1 without hours');
    expect(foldLabel([weekend, weekend], short)).toBe('✓ d22 – d22 · 2 days without hours');
    expect(foldLabel([skip, skip], short, true)).toBe('✓ All 2 days match');
    expect(foldLabel([skip, weekend], short, true)).toBe('✓ All 2 days · 1 match, 1 without hours');
  });
});

describe('summaryLine', () => {
  it('counts actions and leaves out zeros', () => {
    expect(summaryLine([create, create, skip, weekend])).toBe('2 to create · 1 match');
    expect(summaryLine([weekend])).toBe('Nothing to do');
  });
});
