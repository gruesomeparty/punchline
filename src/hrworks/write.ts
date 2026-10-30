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
  date: string,
): Promise<EntryInputs> {
  if (header.entries.length > 0) {
    throw new HrworksReadError(`HRworks already has an entry on ${date}. Nothing written.`);
  }
  if (!header.workday || header.absence) {
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
  date: string,
  previous: HrworksEntry[],
): Promise<EntryInputs> {
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
  if (!header.workday || header.absence) {
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

export async function writeDay(
  doc: Document,
  day: WriteDay,
  options: ReadOptions = {},
): Promise<WriteResult> {
  const session = hrworksSession(doc, options);
  let saved = false;
  try {
    checkPage(doc);
    const row = await session.openDay(day.date);
    const header = readDayHeader(doc, row);
    if (!header) throw new HrworksReadError(`Unexpected day in HRworks for ${day.date}.`);
    const inputs = day.previous
      ? await openSavedEntry(doc, session, row, header, day.date, day.previous)
      : await openNewEntry(doc, session, row, header, day.date);

    typeInto(inputs.start, day.start);
    typeInto(inputs.end, day.end);
    await session.pause();
    if (inputs.start.value !== day.start || inputs.end.value !== day.end) {
      throw new HrworksReadError(
        `HRworks changed the times to ${inputs.start.value}–${inputs.end.value}. Nothing saved.`,
      );
    }

    const save = byGuide(doc, WRITE_GUIDE.save)[0] as HTMLElement | undefined;
    if (!save) throw new HrworksReadError('HRworks shows no Speichern button.');
    // Ignore an error text that was already on the page before this save.
    const errorBefore = knownError(doc);
    saved = true;
    save.click();
    await session.pause();

    // The save is confirmed by the day header showing exactly the new times.
    const want = JSON.stringify([{ start: day.start, end: day.end }]);
    const showsNewTimes = () => {
      const current = findRow(doc, day.date);
      const shown = current ? readDayHeader(doc, current) : null;
      return JSON.stringify(shown?.entries) === want;
    };
    let error: string | null = null;
    await session.until(() => {
      error = errorBefore ? null : knownError(doc);
      return !!error || showsNewTimes() || !findRow(doc, day.date);
    }, `confirm the save on ${day.date}`);
    if (error) throw new HrworksReadError(error);
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
    const after = readDayHeader(doc, findRow(doc, day.date) ?? row);
    if (!after) throw new HrworksReadError(`Unexpected day in HRworks for ${day.date}.`);
    return { ok: true, day: { ...after, creditedMinutes: credited } };
  } catch (error) {
    const message =
      error instanceof HrworksReadError ? error.message : 'Unexpected error writing to HRworks.';
    return { ok: false, error: message, saved };
  }
}
