import { describe, expect, it } from 'vitest';
import { BREAK_PRESETS } from '../rules/breaks.ts';
import { harvestDays } from './harvest-days.ts';

const options = {
  startMinutes: 7 * 60,
  rules: BREAK_PRESETS.ch.rules,
  today: '2026-01-09',
  maxNetMinutes: 600,
};

describe('harvestDays', () => {
  it('builds one row per day', () => {
    const totals = new Map([
      ['2026-01-05', { minutes: 510, running: false }],
      ['2026-01-07', { minutes: 120, running: true }],
      ['2026-01-08', { minutes: 900, running: false }],
    ]);
    const rows = harvestDays('2026-01-04', '2026-01-10', totals, {
      ...options,
      startMinutes: 14 * 60,
    });
    expect(rows.map((row) => [row.date, row.status, row.weekend])).toEqual([
      ['2026-01-04', 'no-hours', true],
      ['2026-01-05', 'times', false],
      ['2026-01-06', 'no-hours', false],
      ['2026-01-07', 'incomplete', false],
      ['2026-01-08', 'error', false],
      ['2026-01-09', 'incomplete', false],
      ['2026-01-10', 'incomplete', true],
    ]);
  });

  it('computes the times for a day', () => {
    const totals = new Map([['2026-01-05', { minutes: 510, running: false }]]);
    const [row] = harvestDays('2026-01-05', '2026-01-05', totals, options);
    expect(row).toEqual({
      date: '2026-01-05',
      weekend: false,
      netMinutes: 510,
      status: 'times',
      times: { start: '07:00', end: '16:00', breakMinutes: 30 },
      warnings: [],
    });
  });

  it('says why a day is incomplete', () => {
    const totals = new Map([['2026-01-07', { minutes: 120, running: true }]]);
    const rows = harvestDays('2026-01-07', '2026-01-10', totals, options);
    expect(rows.map((row) => (row.status === 'incomplete' ? row.reason : row.status))).toEqual([
      'Timer running',
      'no-hours',
      'Today',
      'Future',
    ]);
  });

  it('warns about legal limits but still computes the times', () => {
    const totals = new Map([
      ['2026-01-04', { minutes: 120, running: false }],
      ['2026-01-05', { minutes: 660, running: false }],
      ['2026-01-06', { minutes: 480, running: false }],
    ]);
    const rows = harvestDays('2026-01-04', '2026-01-06', totals, options);
    expect(rows.map((row) => [row.status, row.status === 'times' ? row.warnings : null])).toEqual([
      ['times', ['Sunday work']],
      ['times', ['More than the legal 10:00 h a day']],
      ['times', []],
    ]);
  });
});
