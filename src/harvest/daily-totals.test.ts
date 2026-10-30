import { describe, expect, it } from 'vitest';
import { dailyTotals } from './daily-totals.ts';

describe('dailyTotals', () => {
  it('sums entries per day and rounds to minutes after summing', () => {
    const totals = dailyTotals([
      { spentDate: '2026-01-05', hours: 0.1, isRunning: false },
      { spentDate: '2026-01-05', hours: 0.2, isRunning: false },
      { spentDate: '2026-01-05', hours: 7.83, isRunning: false },
      { spentDate: '2026-01-06', hours: 4, isRunning: false },
    ]);
    // 8.13 h = 487.8 min
    expect(totals.get('2026-01-05')).toEqual({ minutes: 488, running: false });
    expect(totals.get('2026-01-06')).toEqual({ minutes: 240, running: false });
  });

  it('marks days with a running timer', () => {
    const totals = dailyTotals([
      { spentDate: '2026-01-05', hours: 3, isRunning: false },
      { spentDate: '2026-01-05', hours: 1, isRunning: true },
    ]);
    expect(totals.get('2026-01-05')?.running).toBe(true);
  });
});
