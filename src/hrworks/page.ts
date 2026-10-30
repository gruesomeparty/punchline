// Reads the HRworks "Arbeitszeiten" page in the open tab. Read-only: it switches the month,
// expands weeks and opens the ⓘ details of days with entries, but never edits or saves.
// HRworks regenerates element ids on every render, so everything here goes through class names
// and the stable data-guide-id attributes.

import { datesBetween, monthsBetween } from '../lib/time.ts';
import type { HrworksDay } from '../plan/plan.ts';
import { GERMAN, type HrworksTexts, LOCALES, localeForMonths } from './locales.ts';
import { type DayHeaderTexts, findDuration, parseDayHeader, parseWeekTitle } from './parse.ts';

export const GUIDE = {
  monthGroup: 'b9f6866f-6fae-40b0-8492-915e82db60be',
  yearGroup: 'd12f0b77-e789-407f-a061-09518b131643',
  weekHead: '878eaf39-e2c2-4347-9b75-0bbeace7ff77',
  dayRow: 'aaf3f94b-8277-4c12-8f52-d6d0d1739667',
  dayLabel: '682f1821-6e5c-424c-8698-96cd9e20c1cb',
  dayType: 'e3a4e5b5-9945-4792-a671-d63b46256e0a',
  infoButton: '10e026eb-4c0b-49ae-a793-cdfb210d19ba',
  details: '1d69ad6e-2e7b-48c3-a25f-877f64d8458e',
} as const;

/** Something on the page wasn't what punchline expects. The message is shown to the user. */
export class HrworksReadError extends Error {
  override name = 'HrworksReadError';
}

export type ReadOptions = {
  /** How long to wait for HRworks to finish loading after a click. */
  timeoutMs?: number;
  /** Pause between clicks, so HRworks gets one request at a time. */
  pauseMs?: number;
};

function byGuide(root: ParentNode, id: string): Element[] {
  return [...root.querySelectorAll(`[data-guide-id="${id}"]`)];
}

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/ /g, ' ').trim();
}

/** HRworks hides elements with these classes instead of removing them. */
function isHidden(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.classList.contains('bs-hide') || node.classList.contains('d-none')) return true;
  }
  return false;
}

export function isLoading(root: ParentNode): boolean {
  return [...root.querySelectorAll('.hrw-loadingShimmer')].some((el) => !isHidden(el));
}

function selectIn(doc: Document, group: string): HTMLSelectElement | null {
  return byGuide(doc, group)[0]?.querySelector('select') ?? null;
}

/** The HRworks language, recognised by the month names. Null if unknown or not on the page. */
export function localeOf(doc: Document): HrworksTexts | null {
  const month = selectIn(doc, GUIDE.monthGroup);
  return month ? localeForMonths([...month.options].map(textOf)) : null;
}

/** The month and year the page shows, or null when this isn't the Arbeitszeiten page. */
export function readSelectedMonth(doc: Document): { year: number; month: number } | null {
  const month = selectIn(doc, GUIDE.monthGroup);
  const year = selectIn(doc, GUIDE.yearGroup);
  const locale = localeOf(doc);
  if (!month || !year || !locale) return null;
  const monthIndex = locale.months.indexOf(textOf(month.options[month.selectedIndex]));
  const yearNumber = Number(textOf(year.options[year.selectedIndex]));
  if (monthIndex < 0 || !Number.isInteger(yearNumber)) return null;
  return { year: yearNumber, month: monthIndex + 1 };
}

export type Week = { item: Element; head: HTMLElement; title: string; open: boolean };

export function readWeeks(doc: Document): Week[] {
  // Only the first week carries a data-guide-id, so go through the week heads.
  return byGuide(doc, GUIDE.weekHead).map((element) => {
    const head = element as HTMLElement;
    const item = head.closest('.m-accordion__item');
    if (!item) throw new HrworksReadError('A week on the HRworks page has an unexpected layout.');
    const body = item.querySelector('.m-accordion__item-body');
    return {
      item,
      head,
      title: textOf(head.querySelector('.m-accordion__item-title')),
      open: body?.classList.contains('show') ?? false,
    };
  });
}

export function dayRows(root: ParentNode): Element[] {
  return byGuide(root, GUIDE.dayRow);
}

/** Collects the texts of a day header row for parseDayHeader. */
export function dayHeaderTexts(row: Element): DayHeaderTexts {
  const day = byGuide(row, GUIDE.dayLabel)[0];
  // The status texts ("07:00 Uhr", "Keine Arbeitszeit erfasst") sit in the block right after
  // the day label, under the progress bar.
  const status = [...(day?.nextElementSibling?.querySelectorAll('span') ?? [])].map(textOf);
  return { day: textOf(day), status, label: textOf(byGuide(row, GUIDE.dayType)[0]) };
}

/** The ⓘ details panel that belongs to a day row. It is the row's next sibling. */
function detailsPanel(row: Element): Element | null {
  const next = row.nextElementSibling;
  return next ? (byGuide(next, GUIDE.details)[0] ?? null) : null;
}

/** "Gutgeschriebene Arbeitsstunden" from an open details panel, or null if it isn't shown. */
export function readCredited(row: Element, locale: HrworksTexts = GERMAN): number | null {
  const panel = detailsPanel(row);
  if (!panel || isHidden(panel)) return null;
  const texts = [...panel.querySelectorAll('span, div')]
    .filter((el) => el.childElementCount === 0)
    .map(textOf);
  return findDuration(texts, locale.credited, locale);
}

/** Parses a day row in the page's language. */
export function readDayHeader(doc: Document, row: Element) {
  return parseDayHeader(dayHeaderTexts(row), localeOf(doc) ?? GERMAN);
}

export function findRow(doc: Document, date: string): Element | null {
  return dayRows(doc).find((row) => readDayHeader(doc, row)?.date === date) ?? null;
}

/** Stops on anything that means the page isn't in a state punchline understands. */
export function checkPage(doc: Document): void {
  const text = doc.body?.textContent ?? '';
  // The dialog can cover any page, so look for it in every language.
  if (LOCALES.some((locale) => text.includes(locale.sessionExpiring))) {
    throw new HrworksReadError(
      'HRworks says your session is about to expire. Click "Ok" in HRworks and try again.',
    );
  }
  if (!selectIn(doc, GUIDE.monthGroup)) {
    throw new HrworksReadError('Open Zeitwirtschaft → Arbeitszeiten in HRworks and try again.');
  }
  if (!localeOf(doc)) {
    const supported = LOCALES.map((locale) => locale.language).join(', ');
    throw new HrworksReadError(`punchline only knows HRworks in ${supported} so far.`);
  }
  if (!readSelectedMonth(doc)) {
    throw new HrworksReadError('HRworks shows a month punchline does not recognise.');
  }
}

export type Session = ReturnType<typeof hrworksSession>;

/** Page steps shared by reading and writing. Each waits for HRworks before it returns. */
export function hrworksSession(doc: Document, options: ReadOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pauseMs = options.pauseMs ?? 300;
  const pause = () => new Promise((resolve) => setTimeout(resolve, pauseMs));

  /** Polls until `done` holds. Returns false after `ms`, and stops early on an unexpected page. */
  async function waitFor(done: () => boolean, ms = timeoutMs): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (true) {
      checkPage(doc);
      if (done()) return true;
      if (Date.now() > deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function until(done: () => boolean, what: string): Promise<void> {
    if (!(await waitFor(done))) throw new HrworksReadError(`HRworks didn't ${what} in time.`);
  }

  async function choose(group: string, label: string): Promise<void> {
    const select = selectIn(doc, group);
    const option = [...(select?.options ?? [])].find((o) => textOf(o) === label);
    if (!select || !option) throw new HrworksReadError(`HRworks has no "${label}" to select.`);
    if (select.value === option.value) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
  }

  async function showMonth(year: number, month: number): Promise<void> {
    const name = (localeOf(doc) ?? GERMAN).months[month - 1] ?? '';
    await choose(GUIDE.yearGroup, String(year));
    await choose(GUIDE.monthGroup, name);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    await until(() => {
      const shown = readSelectedMonth(doc);
      if (shown?.year !== year || shown.month !== month || isLoading(doc)) return false;
      const weeks = readWeeks(doc);
      return (
        weeks.length > 0 &&
        weeks.every((week) => parseWeekTitle(week.title, year)?.from.startsWith(prefix))
      );
    }, `show ${name} ${year}`);
  }

  /** Opens a week of the shown month and returns its day rows once they have loaded. */
  async function openWeek(title: string): Promise<Element[]> {
    // Look the week up again each time: HRworks may re-render the list after a click.
    const findWeek = () => readWeeks(doc).find((week) => week.title === title);
    if (!findWeek()) throw new HrworksReadError(`The week "${title}" disappeared from HRworks.`);
    const loaded = () => {
      const current = findWeek();
      return !!current?.open && dayRows(current.item).length > 0 && !isLoading(current.item);
    };
    // HRworks sometimes ignores the first click on a week, so a week that stays closed gets
    // clicked again. An open week that is still loading only needs more time.
    const attempts = 3;
    for (let attempt = 1; !loaded(); attempt++) {
      const current = findWeek();
      if (current && !current.open) {
        current.head.click();
        await pause();
      }
      if (await waitFor(loaded, timeoutMs / attempts)) break;
      if (attempt === attempts) throw new HrworksReadError(`HRworks didn't open ${title} in time.`);
    }
    return dayRows(findWeek()?.item ?? doc);
  }

  /** Shows the month and opens the week of `date`, and returns the day's row. */
  async function openDay(date: string): Promise<Element> {
    const year = Number(date.slice(0, 4));
    await showMonth(year, Number(date.slice(5, 7)));
    const week = readWeeks(doc).find((w) => {
      const range = parseWeekTitle(w.title, year);
      return !!range && range.from <= date && date <= range.to;
    });
    if (!week) throw new HrworksReadError(`HRworks shows no week with ${date}.`);
    await openWeek(week.title);
    const row = findRow(doc, date);
    if (!row) throw new HrworksReadError(`HRworks didn't show ${date}.`);
    return row;
  }

  async function openCredited(date: string): Promise<number> {
    const row = findRow(doc, date);
    if (!row) throw new HrworksReadError(`HRworks no longer shows ${date}.`);
    const locale = localeOf(doc) ?? GERMAN;
    if (readCredited(row, locale) === null) {
      const button = byGuide(row, GUIDE.infoButton)[0] as HTMLElement | undefined;
      if (!button) throw new HrworksReadError(`HRworks shows no details button for ${date}.`);
      button.click();
      await pause();
    }
    let credited = null as number | null;
    await until(() => {
      const current = findRow(doc, date);
      credited = current ? readCredited(current, locale) : null;
      return credited !== null;
    }, `show the details of ${date}`);
    if (credited === null) throw new HrworksReadError(`No credited hours for ${date}.`);
    return credited;
  }

  return { timeoutMs, pause, waitFor, until, showMonth, openWeek, openDay, openCredited };
}

/** Reads every day from `from` to `to` (inclusive), oldest first. */
export async function readHrworksDays(
  doc: Document,
  from: string,
  to: string,
  options: ReadOptions = {},
): Promise<HrworksDay[]> {
  const session = hrworksSession(doc, options);
  checkPage(doc);
  const days: HrworksDay[] = [];
  for (const { year, month } of monthsBetween(from, to)) {
    await session.showMonth(year, month);
    for (const title of readWeeks(doc).map((week) => week.title)) {
      const range = parseWeekTitle(title, year);
      if (!range) throw new HrworksReadError(`Unexpected week title in HRworks: "${title}".`);
      if (range.to < from || range.from > to) continue;

      for (const row of await session.openWeek(title)) {
        const header = readDayHeader(doc, row);
        if (!header) throw new HrworksReadError(`Unexpected day in HRworks ${title}.`);
        if (header.date < range.from || header.date > range.to) {
          throw new HrworksReadError(`HRworks shows ${header.date} under ${title}.`);
        }
        if (header.date < from || header.date > to) continue;
        const creditedMinutes =
          header.entries.length > 0 ? await session.openCredited(header.date) : null;
        days.push({ ...header, creditedMinutes });
      }
    }
  }

  // A silent gap would look like "nothing in HRworks", so a missing day stops the read.
  const read = new Set(days.map((day) => day.date));
  const missing = datesBetween(from, to).find((date) => !read.has(date));
  if (missing) throw new HrworksReadError(`HRworks didn't show ${missing}.`);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
