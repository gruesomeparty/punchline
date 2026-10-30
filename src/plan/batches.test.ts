import { describe, expect, it } from 'vitest';
import { byHrworksWeek } from './batches.ts';

describe('byHrworksWeek', () => {
  it('groups by week from Monday and cuts at the month edge', () => {
    const dates = ['2026-08-31', '2026-08-24', '2026-08-28', '2026-09-01', '2026-08-21'];
    expect(byHrworksWeek(dates, (date) => date)).toEqual([
      ['2026-08-21'],
      ['2026-08-24', '2026-08-28'],
      ['2026-08-31'],
      ['2026-09-01'],
    ]);
  });

  it('keeps Sunday with the week before', () => {
    expect(byHrworksWeek(['2026-08-30', '2026-08-24'], (date) => date)).toEqual([
      ['2026-08-24', '2026-08-30'],
    ]);
  });
});
