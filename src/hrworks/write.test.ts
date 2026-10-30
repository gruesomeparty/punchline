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
