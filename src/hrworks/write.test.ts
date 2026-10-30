// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeHrworks } from './fixture.test-helper.ts';
import { writeDay, writeDays } from './write.ts';

const fast = { timeoutMs: 1000, pauseMs: 0 };
const workday = { date: '2026-07-06', start: '08:00', end: '17:00', expectedMinutes: 510 };

let hrworks: FakeHrworks;
beforeEach(() => {
  hrworks = new FakeHrworks();
});
afterEach(() => {
  hrworks.stop();
});

describe('writeDay', () => {
  it('creates the entry and checks it by reading the day back', async () => {
    const result = await writeDay(document, workday, fast);
    expect(result).toEqual({
      ok: true,
      day: {
        date: '2026-07-06',
        entries: [{ start: '08:00', end: '17:00' }],
        absence: '',
        workday: true,
        creditedMinutes: 510,
      },
    });
    expect(hrworks.saves).toBe(1);
  });

  it('never writes the same day twice', async () => {
    await writeDay(document, workday, fast);
    const again = await writeDay(document, workday, fast);
    expect(again).toMatchObject({ ok: false, saved: false, error: /already has an entry/ });
    expect(hrworks.saves).toBe(1);
  });

  it('refuses days that have an entry, an absence or no work plan', async () => {
    for (const date of ['2026-07-01', '2026-07-02', '2026-07-04']) {
      const result = await writeDay(document, { ...workday, date }, fast);
      expect(result).toMatchObject({ ok: false, saved: false });
    }
    expect(hrworks.saves).toBe(0);
  });

  it('stops when HRworks does not allow adding a time', async () => {
    const day = hrworks.data.get('2026-07')?.[1]?.days[0];
    if (day) day.addDisabled = true;
    hrworks.render();
    const result = await writeDay(document, workday, fast);
    expect(result).toMatchObject({ ok: false, saved: false, error: /doesn't allow adding/ });
  });

  it('opens the week again when HRworks closes it after saving', async () => {
    hrworks.closeWeeksOnSave = true;
    const result = await writeDay(document, workday, fast);
    expect(result).toMatchObject({ ok: true, day: { creditedMinutes: 510 } });
  });

  it('reports a validation error after Speichern', async () => {
    hrworks.rejectSave = 'Die Arbeitszeit überlappt sich mit einer anderen Arbeitszeit.';
    const result = await writeDay(document, workday, fast);
    expect(result).toMatchObject({ ok: false, saved: true, error: /überlappt/ });
  });

  it('flags a save whose credited hours differ from Harvest', async () => {
    const result = await writeDay(document, { ...workday, expectedMinutes: 480 }, fast);
    expect(result).toMatchObject({ ok: false, saved: true, error: /credits 8:30 instead of 8:00/ });
  });
});

describe('writeDay override', () => {
  // 2026-07-01 has 08:00–18:00 in the fake.
  const override = {
    date: '2026-07-01',
    start: '08:00',
    end: '17:00',
    expectedMinutes: 510,
    previous: [{ start: '08:00', end: '18:00' }],
  };

  it('changes the saved entry and checks it by reading the day back', async () => {
    const result = await writeDay(document, override, fast);
    expect(result).toMatchObject({
      ok: true,
      day: { entries: [{ start: '08:00', end: '17:00' }], creditedMinutes: 510 },
    });
    expect(hrworks.saves).toBe(1);
  });

  it('works when the details are already open', async () => {
    const day = hrworks.days().find((d) => d.date === '2026-07-01');
    if (day) day.detailsOpen = true;
    hrworks.render();
    const result = await writeDay(document, override, fast);
    expect(result).toMatchObject({ ok: true });
  });

  it('refuses when HRworks changed since the preview', async () => {
    const changed = { ...override, previous: [{ start: '07:30', end: '18:00' }] };
    const result = await writeDay(document, changed, fast);
    expect(result).toMatchObject({
      ok: false,
      saved: false,
      error: /changed .* since the preview/,
    });
    expect(hrworks.saves).toBe(0);
  });

  it('never overrides twice', async () => {
    await writeDay(document, override, fast);
    const again = await writeDay(document, override, fast);
    expect(again).toMatchObject({ ok: false, saved: false });
    expect(hrworks.saves).toBe(1);
  });

  it('replaces an open entry', async () => {
    const open = { ...override, date: '2026-07-03', previous: [{ start: '07:15', end: '' }] };
    expect(await writeDay(document, open, fast)).toMatchObject({
      ok: true,
      day: { entries: [{ start: '08:00', end: '17:00' }] },
    });
  });

  it('replaces an entry added with "+" but never saved', async () => {
    const day = hrworks.days().find((d) => d.date === '2026-07-06');
    if (day) {
      day.status = ['20:26 Uhr', 'Offene Arbeitszeit'];
      day.editing = { start: '20:26', end: '' };
    }
    hrworks.render();
    const unsaved = { ...override, date: '2026-07-06', previous: [{ start: '20:26', end: '' }] };
    expect(await writeDay(document, unsaved, fast)).toMatchObject({ ok: true });
  });

  it('removes extra open entries, then overrides the first', async () => {
    const day = hrworks.days().find((d) => d.date === '2026-07-03');
    if (day)
      day.extra = [
        { start: '22:28', end: '' },
        { start: '22:30', end: '' },
      ];
    hrworks.render();
    const open = { ...override, date: '2026-07-03', previous: [{ start: '07:15', end: '' }] };
    const result = await writeDay(document, open, fast);
    expect(result).toMatchObject({
      ok: true,
      day: { entries: [{ start: '08:00', end: '17:00' }] },
      removed: [
        { start: '22:28', end: '' },
        { start: '22:30', end: '' },
      ],
    });
    expect(day?.extra ?? []).toEqual([]);
    expect(hrworks.saves).toBe(1);
  });

  it('overrides the remaining open entry when HRworks shows it as 00:00 after a delete', async () => {
    const day = hrworks.days().find((d) => d.date === '2026-07-03');
    if (day) day.extra = [{ start: '22:28', end: '' }];
    hrworks.zeroStartAfterDelete = true;
    hrworks.render();
    const log: string[] = [];
    const open = { ...override, date: '2026-07-03', previous: [{ start: '07:15', end: '' }] };
    const result = await writeDay(document, open, { ...fast, log: (line) => log.push(line) });
    expect(result).toMatchObject({
      ok: true,
      day: { entries: [{ start: '08:00', end: '17:00' }] },
    });
    expect(log).toContain('2026-07-03 shows 1 entries: 00:00–');
    expect(log).toContain('click Speichern');
  });

  it('leaves a day with a finished extra entry alone', async () => {
    const day = hrworks.days().find((d) => d.date === '2026-07-03');
    if (day) day.extra = [{ start: '13:00', end: '17:00' }];
    hrworks.render();
    const open = { ...override, date: '2026-07-03', previous: [{ start: '07:15', end: '' }] };
    expect(await writeDay(document, open, fast)).toMatchObject({
      ok: false,
      saved: false,
      error: /not all are open/,
    });
    expect(day?.extra).toHaveLength(1);
    expect(hrworks.saves).toBe(0);
  });

  it('refuses a day without entries', async () => {
    const empty = { ...override, date: '2026-07-06', previous: [] };
    expect(await writeDay(document, empty, fast)).toMatchObject({ ok: false, saved: false });
    expect(hrworks.saves).toBe(0);
  });
});

describe('writeDays', () => {
  // Fills KW 28 with two more empty days and one with an entry.
  beforeEach(() => {
    const week = hrworks.data.get('2026-07')?.[1];
    week?.days.push(
      { date: '2026-07-07', status: ['Keine Arbeitszeit erfasst', ''] },
      { date: '2026-07-08', status: ['Keine Arbeitszeit erfasst', ''] },
      { date: '2026-07-09', status: ['07:00 Uhr', '18:00 Uhr'], credited: '10:00' },
      { date: '2026-07-11', label: 'Kein Arbeitstag nach Arbeitsplan', addDisabled: true },
    );
    hrworks.render();
  });
  const create = (date: string, end = '17:00', expectedMinutes = 510) => ({
    date,
    start: '08:00',
    end,
    expectedMinutes,
  });

  it('fills in the week, saves once and checks every day', async () => {
    const results = await writeDays(
      document,
      [
        create('2026-07-06'),
        create('2026-07-07', '16:30', 480),
        { ...create('2026-07-09'), previous: [{ start: '07:00', end: '18:00' }] },
      ],
      fast,
    );
    expect(results.map((r) => r.ok)).toEqual([true, true, true]);
    expect(results[1]).toMatchObject({ day: { entries: [{ start: '08:00', end: '16:30' }] } });
    expect(results[2]).toMatchObject({ day: { creditedMinutes: 510 } });
    expect(hrworks.saves).toBe(1);
  });

  it('clicks "+" again when HRworks ignores the click', async () => {
    hrworks.ignoreAddClicks = 1;
    const results = await writeDays(document, [create('2026-07-06'), create('2026-07-07')], fast);
    expect(results.map((r) => r.ok)).toEqual([true, true]);
    expect(hrworks.saves).toBe(1);
  });

  it('saves nothing when one day cannot be filled in', async () => {
    const results = await writeDays(
      document,
      [create('2026-07-06'), create('2026-07-09'), create('2026-07-08')],
      fast,
    );
    expect(results).toMatchObject([
      { ok: false, saved: false, error: /because 2026-07-09 stopped/, blockedBy: '2026-07-09' },
      { ok: false, saved: false, error: /already has an entry.*Reload HRworks/ },
      { ok: false, saved: false, error: /because 2026-07-09 stopped/, blockedBy: '2026-07-09' },
    ]);
    expect(results[1]).not.toHaveProperty('blockedBy');
    expect(hrworks.saves).toBe(0);
  });

  it('reports each day that HRworks credits differently', async () => {
    const results = await writeDays(
      document,
      [create('2026-07-06'), create('2026-07-07', '17:00', 480)],
      fast,
    );
    expect(results).toMatchObject([{ ok: true }, { ok: false, saved: true, error: /credits/ }]);
  });

  it('marks every day as saved when HRworks rejects the save', async () => {
    hrworks.rejectSave = 'Die Arbeitszeit überlappt sich mit einer anderen Arbeitszeit.';
    const results = await writeDays(document, [create('2026-07-06'), create('2026-07-07')], fast);
    expect(results).toMatchObject([
      { ok: false, saved: true, error: /überlappt/ },
      { ok: false, saved: true, error: /überlappt/ },
    ]);
  });

  it('writes a day without a work plan only when allowed', async () => {
    const week = hrworks.data.get('2026-07')?.[1];
    const saturday = week?.days.find((day) => day.date === '2026-07-11');
    if (saturday) delete saturday.addDisabled;
    hrworks.render();
    const refused = await writeDay(document, create('2026-07-11'), fast);
    expect(refused).toMatchObject({ ok: false, saved: false, error: /not a plain workday/ });
    const allowed = await writeDay(document, { ...create('2026-07-11'), dayOff: true }, fast);
    expect(allowed).toMatchObject({ ok: true });
  });
});
