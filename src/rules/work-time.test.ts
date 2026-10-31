import { describe, expect, it } from 'vitest';
import { dailyMaxFor, workTimeWarnings } from './work-time.ts';

describe('dailyMaxFor', () => {
  it('has a daily limit only for Germany', () => {
    expect(dailyMaxFor('de')).toBe(600);
    expect(dailyMaxFor('ch')).toBeNull();
    expect(dailyMaxFor('custom')).toBeNull();
  });
});

describe('workTimeWarnings', () => {
  const monday = '2026-08-17';
  const sunday = '2026-08-23';

  it('warns above the daily limit, not at it', () => {
    expect(workTimeWarnings(monday, 600, 600)).toEqual([]);
    expect(workTimeWarnings(monday, 601, 600)).toEqual(['More than the legal 10:00 h a day']);
    expect(workTimeWarnings(monday, 900, null)).toEqual([]);
  });

  it('warns about Sunday work, but not Saturday', () => {
    expect(workTimeWarnings(sunday, 120, null)).toEqual(['Sunday work']);
    expect(workTimeWarnings('2026-08-22', 120, null)).toEqual([]);
    expect(workTimeWarnings(sunday, 0, null)).toEqual([]);
  });

  it('lists every warning that applies', () => {
    expect(workTimeWarnings(sunday, 660, 600)).toHaveLength(2);
  });
});
