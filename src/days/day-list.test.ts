import { describe, expect, it } from 'vitest';
import { groupDays, isoWeek } from './day-list.ts';

type Day = { date: string; quiet: boolean };
const day = (date: string, quiet = true): Day => ({ date, quiet });
const group = (days: Day[], fold = true) =>
  groupDays(
    days,
    (d) => d.date,
    (d) => d.quiet,
    fold,
  );

describe('isoWeek', () => {
  it('numbers weeks like HRworks', () => {
    expect(isoWeek('2026-08-17')).toBe(34);
    expect(isoWeek('2026-08-23')).toBe(34);
    expect(isoWeek('2026-08-24')).toBe(35);
    // 1 January 2027 is a Friday, so it still belongs to the last week of 2026.
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
  });
});

describe('groupDays', () => {
  it('splits days into Monday-to-Sunday weeks', () => {
    const weeks = group([day('2026-08-24'), day('2026-08-23'), day('2026-08-22')], false);
    expect(weeks.map((w) => w.week)).toEqual([34, 35]);
    expect(weeks[0]?.items).toHaveLength(2);
  });

  it('folds runs of quiet days around a day that needs action', () => {
    const weeks = group([
      day('2026-08-17'),
      day('2026-08-18'),
      day('2026-08-19', false),
      day('2026-08-20'),
      day('2026-08-21'),
      day('2026-08-22'),
    ]);
    expect(weeks[0]?.items.map((i) => (i.kind === 'fold' ? i.items.length : i.item.date))).toEqual([
      2,
      '2026-08-19',
      3,
    ]);
    expect(weeks[0]?.quiet).toBe(false);
  });

  it('keeps a single quiet day as a row', () => {
    const weeks = group([day('2026-08-17'), day('2026-08-18', false)]);
    expect(weeks[0]?.items.map((i) => i.kind)).toEqual(['day', 'day']);
  });

  it('marks a week where nothing needs action', () => {
    const weeks = group([day('2026-08-17'), day('2026-08-18')]);
    expect(weeks[0]?.quiet).toBe(true);
    expect(weeks[0]?.items).toEqual([
      { kind: 'fold', items: [day('2026-08-17'), day('2026-08-18')] },
    ]);
  });

  it('shows every day when folding is off', () => {
    const weeks = group([day('2026-08-17'), day('2026-08-18')], false);
    expect(weeks[0]?.items.map((i) => i.kind)).toEqual(['day', 'day']);
  });
});
