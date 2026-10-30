import { describe, expect, it } from 'vitest';
import type { DayRow } from '../days/harvest-days.ts';
import type { HrworksDay, PlannedDay } from './plan.ts';
import { planCells, previewCells } from './plan-cells.ts';

const times = { start: '07:00', end: '16:00', breakMinutes: 30 };
const harvest: DayRow = {
  date: '2026-01-05',
  weekend: false,
  netMinutes: 510,
  status: 'times',
  times,
};
const hrworks: HrworksDay = {
  date: '2026-01-05',
  entries: [],
  absence: '',
  workday: true,
  creditedMinutes: null,
};

describe('planCells', () => {
  it('shows a planned create', () => {
    const day: PlannedDay = { harvest, hrworks, action: 'create', times };
    expect(planCells(day)).toEqual({
      hrworks: 'Empty',
      planned: '07:00–16:00',
      action: 'Create',
      kind: 'create',
      reason: '',
    });
  });

  it('shows existing entries with their credited hours', () => {
    const day: PlannedDay = {
      harvest,
      hrworks: { ...hrworks, entries: [{ start: '08:00', end: '16:00' }], creditedMinutes: 450 },
      action: 'flag',
      reason: 'HRworks differs from Harvest',
    };
    expect(planCells(day)).toMatchObject({
      hrworks: '08:00–16:00 (7:30)',
      planned: '',
      action: 'Flag',
      reason: 'HRworks differs from Harvest',
    });
  });

  it('describes open entries, absences, weekends and missing days', () => {
    const open = { ...hrworks, entries: [{ start: '07:00', end: '' }] };
    expect(planCells({ harvest, hrworks: open, action: 'flag', reason: '' }).hrworks).toBe(
      '07:00–…',
    );
    const absent = { ...hrworks, absence: 'Jahresurlaub' };
    expect(planCells({ harvest, hrworks: absent, action: 'none', reason: '' }).hrworks).toBe(
      'Jahresurlaub',
    );
    const weekend = { ...hrworks, workday: false };
    expect(planCells({ harvest, hrworks: weekend, action: 'none', reason: '' }).hrworks).toBe(
      'No workday',
    );
    expect(planCells({ harvest, hrworks: null, action: 'flag', reason: '' }).hrworks).toBe(
      'Not found',
    );
  });
});

describe('previewCells', () => {
  it('shows Harvest times alone before HRworks is read', () => {
    expect(previewCells(harvest, null)).toEqual({
      harvest: '8:30',
      hrworks: '',
      enter: '07:00–16:00',
      break: '0:30',
      action: '',
      actionKind: '',
      note: '',
      noteKind: '',
    });
  });

  it('shows the planned action next to HRworks', () => {
    expect(previewCells(harvest, { harvest, hrworks, action: 'create', times })).toMatchObject({
      hrworks: 'Empty',
      enter: '07:00–16:00',
      break: '0:30',
      action: 'Create',
      actionKind: 'ok',
    });
    const skipped = previewCells(harvest, { harvest, hrworks, action: 'skip', reason: 'Matches' });
    expect(skipped).toMatchObject({ enter: '', break: '', actionKind: 'muted', noteKind: 'muted' });
  });
});
