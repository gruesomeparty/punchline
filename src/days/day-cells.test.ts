import { describe, expect, it } from 'vitest';
import { dayCells, defaultRange, rangeError } from './day-cells.ts';

const base = { date: '2026-01-05', weekend: false };

describe('dayCells', () => {
  it('shows the times for a day with hours', () => {
    expect(
      dayCells({
        ...base,
        netMinutes: 510,
        status: 'times',
        times: { start: '07:00', end: '16:00', breakMinutes: 30 },
      }),
    ).toEqual({
      harvest: '8:30',
      start: '07:00',
      end: '16:00',
      break: '0:30',
      note: '',
      noteKind: '',
    });
  });

  it('asks for a manual check on empty weekdays only', () => {
    expect(dayCells({ ...base, netMinutes: 0, status: 'no-hours' })).toMatchObject({
      harvest: '–',
      note: 'No hours, check manually',
      noteKind: 'warn',
    });
    expect(dayCells({ ...base, weekend: true, netMinutes: 0, status: 'no-hours' })).toMatchObject({
      note: 'Weekend',
      noteKind: 'muted',
    });
  });

  it('shows why a day is skipped', () => {
    expect(
      dayCells({ ...base, netMinutes: 60, status: 'incomplete', reason: 'Today' }),
    ).toMatchObject({ harvest: '1:00', start: '', note: 'Today', noteKind: 'muted' });
    expect(
      dayCells({ ...base, netMinutes: 900, status: 'error', error: 'Too long' }),
    ).toMatchObject({ note: 'Too long', noteKind: 'error' });
  });
});

describe('defaultRange', () => {
  it('covers this month up to yesterday', () => {
    expect(defaultRange('2026-10-30')).toEqual({ from: '2026-10-01', to: '2026-10-29' });
  });

  it('covers last month on the 1st', () => {
    expect(defaultRange('2026-11-01')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
});

describe('rangeError', () => {
  it('accepts a normal range', () => {
    expect(rangeError('2026-01-01', '2026-01-31')).toBeNull();
    expect(rangeError('2025-01-01', '2026-01-31')).toBeNull();
  });

  it('rejects reversed, invalid and too long ranges', () => {
    expect(rangeError('2026-02-01', '2026-01-31')).toMatch(/on or before/);
    expect(rangeError('', '2026-01-31')).toMatch(/on or before/);
    expect(rangeError('2025-01-01', '2026-02-05')).toMatch(/at most 400 days/);
  });
});
