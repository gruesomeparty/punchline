// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeHrworks } from './fixture.test-helper.ts';
import { writeDay } from './write.ts';

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

  it('refuses an open entry or a day without entries', async () => {
    const open = { ...override, date: '2026-07-03', previous: [{ start: '07:15', end: '' }] };
    expect(await writeDay(document, open, fast)).toMatchObject({ ok: false, saved: false });
    const empty = { ...override, date: '2026-07-06', previous: [] };
    expect(await writeDay(document, empty, fast)).toMatchObject({ ok: false, saved: false });
    expect(hrworks.saves).toBe(0);
  });
});
