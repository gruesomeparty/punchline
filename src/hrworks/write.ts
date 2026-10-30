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
  isLoading,
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
  /** The ⋮ menu of an entry, and its "Löschen" item. */
  menu: 'd90aac9a-af09-4404-ae63-8fb01160d840',
  remove: 'ed0bcd4f-48d4-44f0-b402-88cb52d8d8bc',
  /** "Ja" in the dialog that asks whether to delete an entry. */
  confirmYes: 'ace8e7eb-1d12-4cf1-9001-1f1a6ab49888',
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
  | {
      ok: true;
      day: HrworksDay;
      /** Extra open entries that were removed before the override, for the log. */
      removed?: HrworksEntry[];
    }
  /** `saved` says whether Speichern was clicked, so the user knows to check HRworks. */
  | {
      ok: false;
      error: string;
      saved: boolean;
      /** Set when this day was fine but another day of its week stopped the save. */
      blockedBy?: string;
    };

function byGuide(root: ParentNode, id: string): Element[] {
  return [...root.querySelectorAll(`[data-guide-id="${id}"]`)];
}

function addButton(row: Element): HTMLElement | null {
  return (row.querySelector('.icon-streamline-add')?.closest('a, button') as HTMLElement) ?? null;
}

function isDisabled(element: Element): boolean {
  return element.classList.contains('disabled') || element.hasAttribute('disabled');
}

/** The entries under a day row, in its details block (the row's next sibling). */
function entryRows(row: Element): Element[] {
  const details = row.nextElementSibling;
  return details ? byGuide(details, WRITE_GUIDE.entry) : [];
}

/** The editable entries under a day row. */
function entryInputs(row: Element): { start: HTMLInputElement; end: HTMLInputElement }[] {
  return entryRows(row).flatMap((entry) => {
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
  // HRworks ignores a click while it is still re-rendering from the previous event, for
  // example the day typed in just before. So "+" is clicked again while the day still has no
  // new entry, never once one appeared.
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    const current = findRow(doc, date);
    const add = current ? addButton(current) : null;
    if (!add || isDisabled(add)) {
      throw new HrworksReadError(`HRworks doesn't allow adding a time on ${date}.`);
    }
    await session.waitFor(() => !isLoading(doc), session.timeoutMs / attempts);
    add.click();
    await session.pause();
    const count = () => {
      const now = findRow(doc, date);
      return now ? entryInputs(now).length : 0;
    };
    if (await session.waitFor(() => count() > 0, session.timeoutMs / attempts)) break;
    if (attempt === attempts) {
      throw new HrworksReadError(`HRworks didn't open a new entry on ${date} in time.`);
    }
  }
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
): Promise<{ inputs: EntryInputs; removed: HrworksEntry[] }> {
  const { date, previous = [] } = day;
  if (JSON.stringify(header.entries) !== JSON.stringify(previous)) {
    throw new HrworksReadError(
      `HRworks changed on ${date} since the preview. Nothing written. Load the preview again.`,
    );
  }
  const [entry] = previous;
  if (previous.length !== 1 || !entry) {
    throw new HrworksReadError(
      `punchline only overrides a day with one entry. Change ${date} in HRworks.`,
    );
  }
  if ((!header.workday && !day.dayOff) || header.absence) {
    throw new HrworksReadError(`${date} is not a plain workday in HRworks. Nothing written.`);
  }
  // Reading the credited hours opens the details, which hold the entries' inputs. An entry that
  // was just added with "+" already shows them.
  if (entryInputs(row).length === 0) await session.openCredited(date);
  await session.until(() => {
    const current = findRow(doc, date);
    return !!current && entryInputs(current).length > 0;
  }, `show the entries on ${date}`);
  const removed = await removeExtraOpenEntries(doc, session, date);
  const inputs = await waitForOneEntry(doc, session, date, `show the entry on ${date}`);
  if (inputs.start.value !== entry.start || inputs.end.value !== entry.end) {
    throw new HrworksReadError(
      `HRworks shows ${inputs.start.value}–${inputs.end.value} on ${date} instead of ` +
        `${entry.start}–${entry.end}. Nothing written.`,
    );
  }
  return { inputs, removed };
}

/**
 * The day header shows only the first entry. Extra entries without an end time, such as ones
 * added with "+" and never finished, carry no hours, so they are removed and the first one is
 * overridden. A day with a finished extra entry may be a real split shift and is left alone.
 */
async function removeExtraOpenEntries(
  doc: Document,
  session: Session,
  date: string,
): Promise<HrworksEntry[]> {
  const current = () => {
    const now = findRow(doc, date);
    return now ? entryInputs(now) : [];
  };
  const all = current();
  if (all.length <= 1) return [];
  if (all.some((inputs) => inputs.end.value.trim() !== '')) {
    throw new HrworksReadError(
      `${date} has ${all.length} entries in HRworks and not all are open. Change it by hand.`,
    );
  }
  const removed = all.slice(1).map((inputs) => ({ start: inputs.start.value, end: '' }));
  while (current().length > 1) {
    const before = current().length;
    const now = findRow(doc, date);
    const last = now ? entryRows(now).at(-1) : undefined;
    const menu = last && byGuide(last, WRITE_GUIDE.menu)[0];
    const toggle = menu?.querySelector<HTMLElement>('.m-dropdown__toggle');
    const remove = menu && byGuide(menu, WRITE_GUIDE.remove)[0]?.querySelector<HTMLElement>('a');
    if (!toggle || !remove) {
      throw new HrworksReadError(`HRworks shows no way to remove an entry on ${date}.`);
    }
    const start = current().at(-1)?.start.value ?? '';
    toggle.click();
    await session.pause();
    remove.click();
    await session.pause();
    // HRworks asks first, naming the entry by day and start ("… 19.08.26 22:28 löschen …").
    // Only that exact entry may be confirmed.
    const yes = () => byGuide(doc, WRITE_GUIDE.confirmYes)[0] as HTMLElement | undefined;
    await session.until(() => !!yes(), `ask to remove the entry on ${date}`);
    const dialog = yes()?.closest('[role="dialog"], .modal') ?? null;
    const [y, m, d] = date.split('-');
    const asked = (dialog?.textContent ?? '').replace(/\s+/g, ' ');
    if (!asked.includes(`${d}.${m}.${y?.slice(2)} ${start}`)) {
      throw new HrworksReadError(
        `HRworks asked to remove a different entry than the one on ${date} ${start}. ` +
          'Click "Nein" and reload HRworks.',
      );
    }
    yes()?.click();
    await session.pause();
    await session.until(() => current().length < before, `remove an extra entry on ${date}`);
  }
  return removed;
}

/** The new entry's inputs of a day that was filled in but not saved yet. */
function filledInputs(doc: Document, date: string): EntryInputs | null {
  const row = findRow(doc, date);
  const all = row ? entryInputs(row) : [];
  return all.length === 1 ? (all[0] ?? null) : null;
}

/** Types one day's times into HRworks without saving. Returns the extra entries it removed. */
async function fillDay(doc: Document, session: Session, day: WriteDay): Promise<HrworksEntry[]> {
  const row = await session.openDay(day.date);
  const header = readDayHeader(doc, row);
  if (!header) throw new HrworksReadError(`Unexpected day in HRworks for ${day.date}.`);
  const { inputs, removed } = day.previous
    ? await openSavedEntry(doc, session, row, header, day)
    : { inputs: await openNewEntry(doc, session, row, header, day), removed: [] };
  typeInto(inputs.start, day.start);
  typeInto(inputs.end, day.end);
  await session.pause();
  if (inputs.start.value !== day.start || inputs.end.value !== day.end) {
    throw new HrworksReadError(
      `HRworks changed the times on ${day.date} to ${inputs.start.value}–${inputs.end.value}.`,
    );
  }
  return removed;
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
  const removed = new Map<string, HrworksEntry[]>();
  try {
    checkPage(doc);
    for (const day of days) {
      current = day.date;
      removed.set(day.date, await fillDay(doc, session, day));
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
      ...(day.date === current ? {} : { blockedBy: current }),
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
      const extra = removed.get(day.date) ?? [];
      const checked = await checkDay(doc, session, day);
      results.push({ ok: true, day: checked, ...(extra.length > 0 ? { removed: extra } : {}) });
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
