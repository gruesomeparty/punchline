// Enters one working time in HRworks and checks it by reading the day back.
// This is the only module that saves anything in HRworks. A new entry is only added while the
// day is still empty, and an override only changes the entry the preview showed, so running
// either twice can't create a second entry or change times the user hasn't seen.

import { formatDuration } from '../lib/time.ts';
import type { HrworksDay, HrworksEntry } from '../plan/plan.ts';
import { GERMAN } from './locales.ts';
import {
  checkPage,
  findRow,
  HrworksReadError,
  hrworksSession,
  localeOf,
  type ReadOptions,
  readDayHeader,
} from './page.ts';
import type { DayHeader } from './parse.ts';

export const WRITE_GUIDE = {
  entry: '49de136b-a470-41bf-8478-f8b8da456576',
  start: 'b88c6142-3907-4da7-92e3-3486566804f6',
  end: '10589c97-f535-436c-9d7e-c4276bef0d75',
  save: 'e474b16c-8177-4338-b339-dbb027e2ee81',
} as const;

export type WriteDay = {
  date: string;
  start: string;
  end: string;
  /** Net minutes HRworks must credit after its breaks, i.e. the Harvest hours. */
  expectedMinutes: number;
  /**
   * The entries the preview showed for an override. Missing for a new entry. HRworks must still
   * show exactly these, or nothing is changed.
   */
  previous?: HrworksEntry[];
  /** The user allows writing on days without a work plan, such as weekends. */
  dayOff?: boolean;
};

export type WriteResult =
  | { ok: true; day: HrworksDay }
  /** `saved` says whether Speichern was clicked, so the user knows to check HRworks. */
  | { ok: false; error: string; saved: boolean };

function byGuide(root: ParentNode, id: string): Element[] {
  return [...root.querySelectorAll(`[data-guide-id="${id}"]`)];
}

function addButton(row: Element): HTMLElement | null {
  return (row.querySelector('.icon-streamline-add')?.closest('a, button') as HTMLElement) ?? null;
}

function isDisabled(element: Element): boolean {
  return element.classList.contains('disabled') || element.hasAttribute('disabled');
}

/** The editable entries under a day row, in its details block (the row's next sibling). */
function entryInputs(row: Element): { start: HTMLInputElement; end: HTMLInputElement }[] {
  const details = row.nextElementSibling;
  if (!details) return [];
  return byGuide(details, WRITE_GUIDE.entry).flatMap((entry) => {
    const start = byGuide(entry, WRITE_GUIDE.start)[0]?.querySelector('input');
    const end = byGuide(entry, WRITE_GUIDE.end)[0]?.querySelector('input');
    return start && end ? [{ start, end }] : [];
  });
}

/**
 * HRworks reads the inputs when the form is sent on Speichern, so setting the value is enough.
 * The events let its time mask reformat the value the way typing would.
 */
function typeInto(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

/** A validation message HRworks is known to show, in the page's language. */
function knownError(doc: Document): string | null {
  const text = doc.body?.textContent ?? '';
  const error = (localeOf(doc) ?? GERMAN).saveErrors.find((part) => text.includes(part));
  return error ? `HRworks rejected the entry ("…${error}…").` : null;
}

type Session = ReturnType<typeof hrworksSession>;
type EntryInputs = { start: HTMLInputElement; end: HTMLInputElement };

async function waitForOneEntry(
  doc: Document,
  session: Session,
  date: string,
  what: string,
): Promise<EntryInputs> {
  let inputs: EntryInputs | undefined;
  await session.until(() => {
    const current = findRow(doc, date);
    const all = current ? entryInputs(current) : [];
    inputs = all.length === 1 ? all[0] : undefined;
    return !!inputs;
  }, what);
  if (!inputs) throw new HrworksReadError(`No entry to edit on ${date}.`);
  return inputs;
}

/** Clicks "+" on an empty workday and returns the new entry's inputs. */
async function openNewEntry(
  doc: Document,
  session: Session,
  row: Element,
  header: DayHeader,
  day: WriteDay,
): Promise<EntryInputs> {
  const { date } = day;
  if (header.entries.length > 0) {
    throw new HrworksReadError(`HRworks already has an entry on ${date}. Nothing written.`);
  }
  if ((!header.workday && !day.dayOff) || header.absence) {
    throw new HrworksReadError(`${date} is not a plain workday in HRworks. Nothing written.`);
  }
  if (entryInputs(row).length > 0) {
    throw new HrworksReadError(`${date} already has an unsaved entry open in HRworks.`);
  }
  const add = addButton(row);
  if (!add || isDisabled(add)) {
    throw new HrworksReadError(`HRworks doesn't allow adding a time on ${date}.`);
  }
  add.click();
  await session.pause();
  return waitForOneEntry(doc, session, date, `open a new entry on ${date}`);
}

/**
 * Opens the ⓘ details of a day with one saved entry and returns that entry's inputs. Refuses
 * unless HRworks still shows exactly what the preview showed, since the user confirmed that.
 */
async function openSavedEntry(
  doc: Document,
  session: Session,
  row: Element,
  header: DayHeader,
  day: WriteDay,
): Promise<EntryInputs> {
  const { date, previous = [] } = day;
  if (JSON.stringify(header.entries) !== JSON.stringify(previous)) {
    throw new HrworksReadError(
      `HRworks changed on ${date} since the preview. Nothing written. Load the preview again.`,
    );
  }
  const [entry] = previous;
  if (previous.length !== 1 || !entry?.end) {
    throw new HrworksReadError(
      `punchline only overrides a day with one finished entry. Change ${date} in HRworks.`,
    );
  }
  if ((!header.workday && !day.dayOff) || header.absence) {
    throw new HrworksReadError(`${date} is not a plain workday in HRworks. Nothing written.`);
  }
  // An open details block holds the saved entry; more inputs mean an unsaved one too.
  if (entryInputs(row).length > 1) {
    throw new HrworksReadError(`${date} already has an unsaved entry open in HRworks.`);
  }
  // Reading the credited hours opens the details, which hold the saved entry's inputs.
  await session.openCredited(date);
  const inputs = await waitForOneEntry(doc, session, date, `show the entry on ${date}`);
  if (inputs.start.value !== entry.start || inputs.end.value !== entry.end) {
    throw new HrworksReadError(
      `HRworks shows ${inputs.start.value}–${inputs.end.value} on ${date} instead of ` +
        `${entry.start}–${entry.end}. Nothing written.`,
    );
  }
  return inputs;
}

/** The new entry's inputs of a day that was filled in but not saved yet. */
function filledInputs(doc: Document, date: string): EntryInputs | null {
  const row = findRow(doc, date);
  const all = row ? entryInputs(row) : [];
  return all.length === 1 ? (all[0] ?? null) : null;
}

/** Types one day's times into HRworks without saving. */
async function fillDay(doc: Document, session: Session, day: WriteDay): Promise<void> {
  const row = await session.openDay(day.date);
  const header = readDayHeader(doc, row);
  if (!header) throw new HrworksReadError(`Unexpected day in HRworks for ${day.date}.`);
  const inputs = day.previous
    ? await openSavedEntry(doc, session, row, header, day)
    : await openNewEntry(doc, session, row, header, day);
  typeInto(inputs.start, day.start);
  typeInto(inputs.end, day.end);
  await session.pause();
  if (inputs.start.value !== day.start || inputs.end.value !== day.end) {
    throw new HrworksReadError(
      `HRworks changed the times on ${day.date} to ${inputs.start.value}–${inputs.end.value}.`,
    );
  }
}

/** Checks one saved day: the header shows exactly the new times and the credited hours match. */
async function checkDay(doc: Document, session: Session, day: WriteDay): Promise<HrworksDay> {
  const want = JSON.stringify([{ start: day.start, end: day.end }]);
  const showsNewTimes = () => {
    const current = findRow(doc, day.date);
    const shown = current ? readDayHeader(doc, current) : null;
    return JSON.stringify(shown?.entries) === want;
  };
  if (!showsNewTimes()) {
    // HRworks re-rendered the page after saving and the week closed: open it again.
    await session.openDay(day.date);
    await session.until(showsNewTimes, `show the saved times on ${day.date}`);
  }
  const credited = await session.openCredited(day.date);
  if (Math.abs(credited - day.expectedMinutes) > 1) {
    throw new HrworksReadError(
      `Saved, but HRworks credits ${formatDuration(credited)} instead of ` +
        `${formatDuration(day.expectedMinutes)}. Check the break rules in the settings.`,
    );
  }
  const after = readDayHeader(doc, findRow(doc, day.date) ?? doc.body);
  if (!after) throw new HrworksReadError(`Unexpected day in HRworks for ${day.date}.`);
  return { ...after, creditedMinutes: credited };
}

function message(error: unknown): string {
  return error instanceof HrworksReadError ? error.message : 'Unexpected error writing to HRworks.';
}

/**
 * Writes the days of one HRworks week with a single Speichern, then checks each day.
 * Returns one result per day, in the same order. Never throws.
 *
 * Every day is typed in first. Clicking "+" or ⓘ on a later day makes HRworks re-render, so all
 * typed times are checked again right before Speichern. If any day can't be filled in, nothing
 * is saved.
 */
export async function writeDays(
  doc: Document,
  days: readonly WriteDay[],
  options: ReadOptions = {},
): Promise<WriteResult[]> {
  const session = hrworksSession(doc, options);
  const failAll = (error: string, saved: boolean): WriteResult[] =>
    days.map(() => ({ ok: false, error, saved }));
  if (days.length === 0) return [];

  let current = days[0]?.date ?? '';
  let filled = 0;
  try {
    checkPage(doc);
    for (const day of days) {
      current = day.date;
      await fillDay(doc, session, day);
      filled++;
    }
    for (const day of days) {
      current = day.date;
      const inputs = filledInputs(doc, day.date);
      if (inputs?.start.value !== day.start || inputs.end.value !== day.end) {
        throw new HrworksReadError(`HRworks lost the times typed on ${day.date}.`);
      }
    }
  } catch (error) {
    const hint = filled > 0 ? ' Reload HRworks to drop the times typed so far.' : '';
    return days.map((day) => ({
      ok: false,
      error:
        day.date === current
          ? `${message(error)} Nothing saved.${hint}`
          : `Not saved, because ${current} stopped the week.`,
      saved: false,
    }));
  }

  try {
    const save = byGuide(doc, WRITE_GUIDE.save)[0] as HTMLElement | undefined;
    if (!save) throw new HrworksReadError('HRworks shows no Speichern button.');
    // Ignore an error text that was already on the page before this save.
    const errorBefore = knownError(doc);
    save.click();
    await session.pause();

    // The save is done when HRworks shows an error, the last day shows its new times, or the
    // week was re-rendered closed.
    const last = days[days.length - 1] as WriteDay;
    const want = JSON.stringify([{ start: last.start, end: last.end }]);
    let error: string | null = null;
    await session.until(() => {
      error = errorBefore ? null : knownError(doc);
      const row = findRow(doc, last.date);
      const shown = row ? readDayHeader(doc, row) : null;
      return !!error || !row || JSON.stringify(shown?.entries) === want;
    }, 'confirm the save');
    if (error) return failAll(error, true);
  } catch (error) {
    return failAll(message(error), true);
  }

  const results: WriteResult[] = [];
  for (const day of days) {
    try {
      results.push({ ok: true, day: await checkDay(doc, session, day) });
    } catch (error) {
      results.push({ ok: false, error: message(error), saved: true });
    }
  }
  return results;
}

/** Writes a single day. See writeDays. */
export async function writeDay(
  doc: Document,
  day: WriteDay,
  options: ReadOptions = {},
): Promise<WriteResult> {
  const [result] = await writeDays(doc, [day], options);
  return result ?? { ok: false, error: 'Unexpected error writing to HRworks.', saved: false };
}
