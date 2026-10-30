// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayRow } from '../days/harvest-days.ts';
import { FakeHrworks } from './fixture.test-helper.ts';
import { type Inline, mountInline } from './inline.ts';
import type { HarvestRowsResponse } from './messages.ts';

const rows: DayRow[] = [
  {
    date: '2026-07-01',
    weekend: false,
    netMinutes: 540,
    status: 'times',
    times: { start: '08:00', end: '18:00', breakMinutes: 60 },
  },
  {
    date: '2026-07-06',
    weekend: false,
    netMinutes: 510,
    status: 'times',
    times: { start: '08:00', end: '17:00', breakMinutes: 30 },
  },
];

let hrworks: FakeHrworks;
let inline: Inline;
let store: Record<string, unknown>;
let response: HarvestRowsResponse;

beforeEach(() => {
  hrworks = new FakeHrworks();
  store = {};
  response = { ok: true, rows, mode: 'flag', weekendHours: false };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (items: Record<string, unknown>) => Object.assign(store, items),
      },
    },
  });
  inline = mount(false);
});

/** Mounts punchline in the fake HRworks. Most tests compare by hand to stay predictable. */
function mount(autoCompare: boolean): Inline {
  let busy = false;
  return mountInline(document, {
    timeoutMs: 1000,
    pauseMs: 0,
    shadowMode: 'open',
    autoCompare,
    loadRows: async (from, to) =>
      response.ok
        ? { ...response, rows: response.rows.filter((r) => r.date >= from && r.date <= to) }
        : response,
    exclusive: async (task) => {
      if (busy) return false;
      busy = true;
      try {
        await task();
      } finally {
        busy = false;
      }
      return true;
    },
  });
}

afterEach(() => {
  inline.unmount();
  hrworks.stop();
  vi.unstubAllGlobals();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** HRworks shows the day rows of one week at a time, like an accordion. */
async function openSecondWeek(): Promise<void> {
  for (const week of hrworks.weeks()) week.open = week.title.startsWith('KW 28');
  hrworks.render();
  await wait(100);
}
const bar = () => document.querySelector('punchline-bar')?.shadowRoot;
const badge = (date: string) =>
  document
    .querySelector(`punchline-badge[data-date="${date}"]`)
    ?.shadowRoot?.querySelector('.badge');

describe('mountInline', () => {
  it('adds its bar under the month picker and keeps it after HRworks re-renders', async () => {
    await wait(0);
    expect(bar()?.textContent).toContain('Compare with Harvest');
    hrworks.render();
    await wait(100);
    expect(bar()).toBeTruthy();
  });

  it('puts a badge with times and the action on each day, and only that', async () => {
    await inline.check();
    expect(badge('2026-07-01')?.textContent).toBe('✓');
    await openSecondWeek();
    expect(badge('2026-07-06')?.textContent).toBe('+ 08:00–17:00');
    expect(bar()?.querySelector('.summary')?.textContent).toBe('1 to create · 1 match');
    // The page's own text is unchanged: the badges live in shadow roots.
    expect(document.body.textContent).not.toContain('08:00–17:00');
  });

  it('brings badges back when HRworks rebuilds its rows', async () => {
    await inline.check();
    hrworks.render();
    expect(badge('2026-07-01')).toBeFalsy();
    await wait(100);
    expect(badge('2026-07-01')?.textContent).toBe('✓');
  });

  it('writes a day after the confirm and logs it', async () => {
    await inline.check();
    await openSecondWeek();
    (badge('2026-07-06') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(bar()?.querySelector('dialog')).toBeTruthy());
    bar()?.querySelector('dialog')?.close('ok');
    await vi.waitFor(() => expect(badge('2026-07-06')?.textContent).toBe('Written and checked'), {
      timeout: 3000,
    });
    expect(hrworks.saves).toBe(1);
    expect((store.writeLog as { result: string }[]).map((e) => e.result)).toEqual([
      'unknown',
      'ok',
    ]);
  });

  it('writes nothing when the confirm is cancelled', async () => {
    await inline.check();
    await openSecondWeek();
    (badge('2026-07-06') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(bar()?.querySelector('dialog')).toBeTruthy());
    bar()?.querySelector('dialog')?.close();
    await wait(50);
    expect(hrworks.saves).toBe(0);
    expect(store.writeLog).toBeUndefined();
  });

  it('shows why Harvest could not be loaded', async () => {
    response = { ok: false, error: 'Set up your Harvest token in the punchline settings first.' };
    await inline.check();
    expect(bar()?.querySelector('.status')?.textContent).toMatch(/Set up your Harvest token/);
  });

  it('forgets the comparison when HRworks shows another month', async () => {
    await inline.check();
    await openSecondWeek();
    expect(bar()?.querySelector('.summary')?.textContent).toBe('1 to create · 1 match');
    hrworks.month = 6;
    hrworks.render();
    await wait(100);
    expect(bar()?.querySelector('.summary')?.textContent).toBe('');
    expect(document.querySelector('punchline-badge')).toBeNull();
    const buttons = [...(bar()?.querySelectorAll('button.secondary') ?? [])] as HTMLButtonElement[];
    expect(buttons.every((button) => button.hidden)).toBe(true);
  });

  it('compares a week as soon as it is opened, and syncs that week', async () => {
    inline.unmount();
    inline = mount(true);
    await vi.waitFor(() => expect(badge('2026-07-01')?.textContent).toBe('✓'), { timeout: 3000 });
    await openSecondWeek();
    await vi.waitFor(() => expect(badge('2026-07-06')?.textContent).toBe('+ 08:00–17:00'), {
      timeout: 3000,
    });
    const sync = [...(bar()?.querySelectorAll('button') ?? [])].find((button) =>
      button.textContent?.startsWith('Sync week'),
    ) as HTMLButtonElement;
    expect(sync.textContent).toBe('Sync week (1)');
    expect(sync.hidden).toBe(false);
    sync.click();
    await vi.waitFor(() => expect(bar()?.querySelector('dialog')).toBeTruthy());
    bar()?.querySelector('dialog')?.close('ok');
    await vi.waitFor(() => expect(badge('2026-07-06')?.textContent).toBe('Written and checked'), {
      timeout: 3000,
    });
    expect(hrworks.saves).toBe(1);
    expect(sync.hidden).toBe(true);
  });

  it('removes everything it added on unmount', async () => {
    await inline.check();
    inline.unmount();
    expect(document.querySelector('punchline-bar, punchline-badge')).toBeNull();
  });
});
