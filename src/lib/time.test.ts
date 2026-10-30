import { describe, expect, it } from 'vitest';
import {
  addDays,
  datesBetween,
  formatDuration,
  formatTime,
  isIsoDate,
  isWeekend,
  localToday,
  parseTime,
  weekday,
} from './time.ts';

describe('time formatting', () => {
  it('formats times of day', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(7 * 60 + 5)).toBe('07:05');
    expect(formatTime(23 * 60 + 59)).toBe('23:59');
  });

  it('formats durations like HRworks', () => {
    expect(formatDuration(504)).toBe('8:24');
    expect(formatDuration(-90)).toBe('-1:30');
  });

  it('parses times', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime(' 7:30 ')).toBe(450);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('07:60')).toBeNull();
    expect(parseTime('0730')).toBeNull();
  });
});

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28.02.2026')).toBe(false);
  });

  it('lists dates across month and year ends', () => {
    expect(datesBetween('2025-12-30', '2026-01-02')).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(datesBetween('2026-01-02', '2026-01-01')).toEqual([]);
  });

  it('knows weekends', () => {
    expect(weekday('2026-10-30')).toBe(5);
    expect(isWeekend('2026-10-31')).toBe(true);
    expect(isWeekend('2026-11-01')).toBe(true);
    expect(isWeekend('2026-11-02')).toBe(false);
  });

  it('uses the local date for today', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('adds days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
