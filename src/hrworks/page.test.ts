// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeHrworks } from './fixture.test-helper.ts';
import {
  dayHeaderTexts,
  dayRows,
  HrworksReadError,
  readCredited,
  readHrworksDays,
  readSelectedMonth,
  readWeeks,
} from './page.ts';

const fast = { timeoutMs: 1000, pauseMs: 0 };

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

  it('says how many days the week listed when one is missing, with a code', async () => {
    for (const day of hrworks.weeks()[0]?.days ?? []) {
      if (day.date === '2026-07-03') day.hidden = true;
    }
    hrworks.render();
    const log: string[] = [];
    await expect(
      readHrworksDays(document, '2026-07-01', '2026-07-05', { ...fast, log: (l) => log.push(l) }),
    ).rejects.toThrow(
      "HRworks didn't show 2026-07-03. KW 27 (01.07. - 05.07.) lists 4 of 5 days. (PL-302)",
    );
    expect(log[0]).toMatch(/^page lang=.* language=Deutsch month=2026-07 weeks=2 open=1/);
    expect(log).toContain(
      'week "KW 27 (01.07. - 05.07.)" shows 4 of 5 days: 05.07. off, 04.07. off, ' +
        '02.07. absence, 01.07. 1 entry',
    );
  });

  it('reads weekend days that HRworks does not list as days off', async () => {
    for (const day of hrworks.weeks()[0]?.days ?? []) {
      if (day.date >= '2026-07-04') day.hidden = true;
    }
    hrworks.render();
    const log: string[] = [];
    const days = await readHrworksDays(document, '2026-07-03', '2026-07-05', {
      ...fast,
      log: (l) => log.push(l),
    });
    expect(days.map((day) => [day.date, day.workday, day.entries.length])).toEqual([
      ['2026-07-03', true, 1],
      ['2026-07-04', false, 0],
      ['2026-07-05', false, 0],
    ]);
    expect(log).toContain('not listed, read as days off: 2026-07-04, 2026-07-05');
  });

  it('reads a month that starts with a hidden Sunday-only week (issue #29)', async () => {
    // November 2026 starts on a Sunday, so HRworks lists a one-day week first.
    hrworks.data.set('2026-11', [
      {
        title: 'KW 44 (01.11. - 01.11.)',
        open: false,
        days: [{ date: '2026-11-01', label: 'Kein Arbeitstag nach Arbeitsplan', hidden: true }],
      },
      {
        title: 'KW 45 (02.11. - 08.11.)',
        open: false,
        days: [{ date: '2026-11-02', status: ['Keine Arbeitszeit erfasst', ''] }],
      },
    ]);
    const log: string[] = [];
    const started = Date.now();
    const days = await readHrworksDays(document, '2026-11-01', '2026-11-02', {
      timeoutMs: 5000,
      pauseMs: 0,
      log: (l) => log.push(l),
    });
    expect(days.map((day) => [day.date, day.workday])).toEqual([
      ['2026-11-01', false],
      ['2026-11-02', true],
    ]);
    expect(log).toContain('week "KW 44 (01.11. - 01.11.)" shows no days, reading them as days off');
    // Two short tries instead of the full timeout.
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it('still stops when a week with workdays never opens', async () => {
    const week = hrworks.weeks()[1];
    if (week) for (const day of week.days) day.hidden = true;
    await expect(readHrworksDays(document, '2026-07-06', '2026-07-06', fast)).rejects.toThrow(
      /PL-202/,
    );
  });

  it('waits for the last days of a week that HRworks shows a moment later', async () => {
    const week = hrworks.weeks()[0];
    if (week) week.open = false;
    hrworks.render();
    hrworks.lateDays = 2;
    const days = await readHrworksDays(document, '2026-07-01', '2026-07-05', fast);
    expect(days.map((day) => [day.date, day.workday])).toEqual([
      ['2026-07-01', true],
      ['2026-07-02', true],
      ['2026-07-03', true],
      ['2026-07-04', false],
      ['2026-07-05', false],
    ]);
  });

  it('stops when HRworks is not showing Arbeitszeiten', async () => {
    document.body.innerHTML = '<p>Anmelden</p>';
    await expect(readHrworksDays(document, '2026-07-01', '2026-07-01', fast)).rejects.toThrow(
      /Arbeitszeiten/,
    );
  });

  it('stops when HRworks is in a language it does not know', async () => {
    const january = document.querySelector('option');
    if (january) january.textContent = 'January';
    await expect(readHrworksDays(document, '2026-07-01', '2026-07-01', fast)).rejects.toThrow(
      /only knows HRworks in Deutsch/,
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
