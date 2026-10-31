import { describe, expect, it } from 'vitest';
import type { DayRow } from '../days/harvest-days.ts';
import type { HrworksDay, PlannedDay } from '../plan/plan.ts';
import { badgeView } from './badge-view.ts';

const times = { start: '08:00', end: '16:30', breakMinutes: 30 };
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

describe('badgeView', () => {
  it('shows only times and the action', () => {
    expect(badgeView({ harvest, hrworks, action: 'create', times })).toMatchObject({
      kind: 'create',
      text: '+ 08:00–16:30',
      writable: true,
    });
    const override: PlannedDay = {
      harvest,
      hrworks,
      action: 'override',
      times,
      previous: [{ start: '07:30', end: '18:00' }],
    };
    expect(badgeView(override)).toMatchObject({ old: '07:30–18:00', text: '08:00–16:30' });
  });

  it('keeps matching days quiet and explains flags on hover', () => {
    expect(badgeView({ harvest, hrworks, action: 'skip', reason: 'x' })?.text).toBe('✓');
    expect(badgeView({ harvest, hrworks, action: 'flag', reason: 'Differs' })).toMatchObject({
      text: '⚠ check',
      title: 'Differs',
      writable: false,
    });
    expect(badgeView({ harvest, hrworks, action: 'none', reason: 'Future' })).toBeNull();
  });
});
