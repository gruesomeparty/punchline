// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FakeWeek, pageHtml, showPage } from './fixture.test-helper.ts';
import {
  dayHeaderTexts,
  dayRows,
  GUIDE,
  HrworksReadError,
  readCredited,
  readHrworksDays,
  readSelectedMonth,
  readWeeks,
} from './page.ts';
import { MONTH_NAMES } from './parse.ts';

const fast = { timeoutMs: 1000, pauseMs: 0 };

/** Two made-up months that behave like HRworks: weeks and details load on click. */
function months(): Map<string, FakeWeek[]> {
  return new Map([
    [
      '2026-06',
      [
        {
          title: 'KW 27 (29.06. - 30.06.)',
          open: false,
          days: [
            { date: '2026-06-29', status: ['08:00 Uhr', '17:00 Uhr'], credited: '8:30' },
            { date: '2026-06-30', status: ['Keine Arbeitszeit erfasst', ''] },
          ],
        },
      ],
    ],
    [
      '2026-07',
      [
        {
          title: 'KW 27 (01.07. - 05.07.)',
          open: true,
          days: [
            { date: '2026-07-01', status: ['08:00 Uhr', '18:00 Uhr'], credited: '9:00' },
            { date: '2026-07-02', label: 'Jahresurlaub' },
            { date: '2026-07-03', status: ['07:15 Uhr', 'Offene Arbeitszeit'], credited: '0:00' },
            { date: '2026-07-04', label: 'Kein Arbeitstag nach Arbeitsplan' },
            { date: '2026-07-05', label: 'Kein Arbeitstag nach Arbeitsplan' },
          ],
        },
        {
          title: 'KW 28 (06.07. - 12.07.)',
          open: false,
          days: [{ date: '2026-07-06', status: ['Keine Arbeitszeit erfasst', ''] }],
        },
      ],
    ],
  ]);
}

class FakeHrworks {
  data = months();
  year = 2026;
  month = 7;
  clicks = 0;
  /** How many week clicks to ignore, like HRworks sometimes does. */
  ignoreWeekClicks = 0;

  constructor() {
    this.render();
    document.addEventListener('change', this.onChange);
    document.addEventListener('click', this.onClick);
  }

  stop(): void {
    document.removeEventListener('change', this.onChange);
    document.removeEventListener('click', this.onClick);
  }

  weeks(): FakeWeek[] {
    return this.data.get(`${this.year}-${String(this.month).padStart(2, '0')}`) ?? [];
  }

  render(): void {
    showPage(document.body, pageHtml(this.year, this.month, this.weeks()));
  }

  // HRworks answers through the server, so changes show up a little later.
  later(change: () => void): void {
    setTimeout(() => {
      change();
      this.render();
    }, 20);
  }

  onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const label = select.options[select.selectedIndex]?.textContent ?? '';
    this.later(() => {
      if (MONTH_NAMES.includes(label)) this.month = MONTH_NAMES.indexOf(label) + 1;
      else this.year = Number(label);
    });
  };

  onClick = (event: Event): void => {
    const target = (event.target as Element).closest('[data-guide-id]');
    const guide = target?.getAttribute('data-guide-id');
    this.clicks++;
    if (guide === GUIDE.weekHead && this.ignoreWeekClicks > 0) {
      this.ignoreWeekClicks--;
    } else if (guide === GUIDE.weekHead) {
      const title = target?.querySelector('.m-accordion__item-title')?.textContent?.trim();
      this.later(() => {
        for (const week of this.weeks()) week.open = week.title === title;
      });
    } else if (guide === GUIDE.infoButton) {
      const row = target?.closest(`[data-guide-id="${GUIDE.dayRow}"]`);
      const label = row ? dayHeaderTexts(row).day : '';
      this.later(() => {
        for (const day of this.weeks().flatMap((week) => week.days)) {
          const [y, m, d] = day.date.split('-');
          if (label.endsWith(`${d}.${m}.${y?.slice(2)}`)) day.detailsOpen = true;
        }
      });
    }
  };
}

let hrworks: FakeHrworks;
beforeEach(() => {
  hrworks = new FakeHrworks();
});
afterEach(() => {
  hrworks.stop();
});

describe('page structure', () => {
  it('reads the selected month and the weeks', () => {
    expect(readSelectedMonth(document)).toEqual({ year: 2026, month: 7 });
    expect(readWeeks(document).map((w) => [w.title, w.open])).toEqual([
      ['KW 28 (06.07. - 12.07.)', false],
      ['KW 27 (01.07. - 05.07.)', true],
    ]);
  });

  it('collects the texts of a day row', () => {
    const rows = dayRows(document);
    expect(rows.map((row) => dayHeaderTexts(row).day)).toContain('Mi, 01.07.26');
    const entry = rows.find((row) => dayHeaderTexts(row).day.endsWith('01.07.26'));
    expect(entry && dayHeaderTexts(entry)).toEqual({
      day: 'Mi, 01.07.26',
      status: ['08:00 Uhr', '18:00 Uhr'],
      label: '',
    });
    expect(entry && readCredited(entry)).toBeNull();
  });

  it('is not the Arbeitszeiten page without the month selects', () => {
    document.body.innerHTML = '<p>Anmelden</p>';
    expect(readSelectedMonth(document)).toBeNull();
  });
});

describe('readHrworksDays', () => {
  it('reads a range inside the shown month', async () => {
    const days = await readHrworksDays(document, '2026-07-01', '2026-07-06', fast);
    expect(days).toEqual([
      {
        date: '2026-07-01',
        entries: [{ start: '08:00', end: '18:00' }],
        absence: '',
        workday: true,
        creditedMinutes: 540,
      },
      {
        date: '2026-07-02',
        entries: [],
        absence: 'Jahresurlaub',
        workday: true,
        creditedMinutes: null,
      },
      {
        date: '2026-07-03',
        entries: [{ start: '07:15', end: '' }],
        absence: '',
        workday: true,
        creditedMinutes: 0,
      },
      { date: '2026-07-04', entries: [], absence: '', workday: false, creditedMinutes: null },
      { date: '2026-07-05', entries: [], absence: '', workday: false, creditedMinutes: null },
      { date: '2026-07-06', entries: [], absence: '', workday: true, creditedMinutes: null },
    ]);
  });

  it('switches months and skips weeks outside the range', async () => {
    const days = await readHrworksDays(document, '2026-06-29', '2026-07-01', fast);
    expect(days.map((day) => [day.date, day.creditedMinutes])).toEqual([
      ['2026-06-29', 510],
      ['2026-06-30', null],
      ['2026-07-01', 540],
    ]);
    expect(readWeeks(document).find((w) => w.title.startsWith('KW 28'))?.open).toBe(false);
  });

  it('clicks a week again when HRworks ignores the first click', async () => {
    hrworks.ignoreWeekClicks = 1;
    const days = await readHrworksDays(document, '2026-07-06', '2026-07-06', {
      timeoutMs: 600,
      pauseMs: 0,
    });
    expect(days.map((day) => day.date)).toEqual(['2026-07-06']);
  });

  it('stops when a day in the range is missing', async () => {
    await expect(readHrworksDays(document, '2026-07-05', '2026-07-07', fast)).rejects.toThrow(
      /2026-07-07/,
    );
  });

  it('stops when HRworks is not showing Arbeitszeiten', async () => {
    document.body.innerHTML = '<p>Anmelden</p>';
    await expect(readHrworksDays(document, '2026-07-01', '2026-07-01', fast)).rejects.toThrow(
      /Arbeitszeiten/,
    );
  });

  it('stops when the session is about to expire', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div>Ihre Sitzung läuft bald ab</div>');
    await expect(readHrworksDays(document, '2026-07-01', '2026-07-01', fast)).rejects.toThrow(
      /session/,
    );
  });

  it('stops on a day it does not recognise', async () => {
    const week = hrworks.weeks()[0];
    if (week?.days[0]) week.days[0].status = ['irgendwas', 'anderes'];
    hrworks.render();
    await expect(
      readHrworksDays(document, '2026-07-01', '2026-07-01', fast),
    ).rejects.toBeInstanceOf(HrworksReadError);
  });

  it('times out when HRworks never loads the details', async () => {
    hrworks.stop();
    await expect(
      readHrworksDays(document, '2026-07-01', '2026-07-01', { timeoutMs: 200, pauseMs: 0 }),
    ).rejects.toThrow(/in time/);
  });
});
