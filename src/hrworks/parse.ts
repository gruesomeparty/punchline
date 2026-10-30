// Parses the texts HRworks shows on the Arbeitszeiten page. Pure string work, so it can be
// tested without a browser. The page reader collects the texts, this module interprets them.
// The texts come from locales.ts; anything unrecognised returns null so the caller stops.

import { isIsoDate, parseTime } from '../lib/time.ts';
import type { HrworksDay, HrworksEntry } from '../plan/plan.ts';
import { GERMAN, type HrworksTexts } from './locales.ts';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "Mo, 16.02.26" (also with a non-breaking space) → "2026-02-16". */
export function parseDayLabel(text: string): string | null {
  const match = /(\d{2})\.(\d{2})\.(\d{2}|\d{4})\s*$/.exec(text.replace(/ /g, ' ').trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y?.length === 2 ? `20${y}` : y;
  const date = `${year}-${m}-${d}`;
  return isIsoDate(date) ? date : null;
}

/** "-08:24 Stunden", "+00:06 Stunden", "8:30" → minutes, signed. */
export function parseDuration(text: string, locale: HrworksTexts = GERMAN): number | null {
  const suffix = escapeRegExp(locale.hoursSuffix);
  const match = new RegExp(`^([+-]?)(\\d{1,3}):(\\d{2})(\\s*${suffix})?$`).exec(text.trim());
  if (!match) return null;
  const [, sign, h, m] = match;
  const minutes = Number(h) * 60 + Number(m);
  if (Number(m) > 59) return null;
  return sign === '-' ? -minutes : minutes;
}

/** "07:00 Uhr" → "07:00". */
export function parseClock(text: string, locale: HrworksTexts = GERMAN): string | null {
  const suffix = escapeRegExp(locale.clockSuffix);
  const match = new RegExp(`^(\\d{1,2}:\\d{2})\\s*${suffix}$`).exec(text.trim());
  if (!match?.[1]) return null;
  const minutes = parseTime(match[1]);
  return minutes === null ? null : match[1].padStart(5, '0');
}

/** The texts of one day header row, as the page reader collects them. */
export type DayHeaderTexts = {
  /** "Mo, 16.02.26" */
  day: string;
  /** Texts under the progress bar: ["Keine Arbeitszeit erfasst", ""] or ["07:00 Uhr", "16:00 Uhr"]. */
  status: string[];
  /** Day type or absence on the right: "", "Jahresurlaub", "Kein Arbeitstag nach Arbeitsplan". */
  label: string;
};

export type DayHeader = Omit<HrworksDay, 'creditedMinutes'>;

/** Interprets a day header row. Returns null for anything it doesn't recognise. */
export function parseDayHeader(
  texts: DayHeaderTexts,
  locale: HrworksTexts = GERMAN,
): DayHeader | null {
  const date = parseDayLabel(texts.day);
  if (!date) return null;
  const label = texts.label.trim();
  const workday = label !== locale.notAWorkday;
  const absence = workday ? label : '';
  const status = texts.status.map((text) => text.trim()).filter(Boolean);

  let entries: HrworksEntry[];
  if (status.length === 0 || (status.length === 1 && status[0] === locale.noEntry)) {
    entries = [];
  } else if (status.length === 2 && status[1] === locale.openEntry) {
    const start = parseClock(status[0] ?? '', locale);
    if (!start) return null;
    entries = [{ start, end: '' }];
  } else if (status.length === 2) {
    const start = parseClock(status[0] ?? '', locale);
    const end = parseClock(status[1] ?? '', locale);
    if (!start || !end) return null;
    entries = [{ start, end }];
  } else {
    return null;
  }
  return { date, entries, absence, workday };
}

/** Finds "Label: value" in the details panel texts and parses the value as a duration. */
export function findDuration(
  texts: readonly string[],
  label: string,
  locale: HrworksTexts = GERMAN,
): number | null {
  for (let i = 0; i < texts.length; i++) {
    const text = (texts[i] ?? '').trim();
    if (!text.startsWith(label)) continue;
    // The value is either in the same text ("Label: 8:30") or in the next one.
    const rest = text.slice(label.length).replace(/^:\s*/, '');
    return parseDuration(rest || (texts[i + 1] ?? ''), locale);
  }
  return null;
}

/**
 * "KW 29 (13.07. - 19.07.)" → the dates it covers. HRworks cuts weeks at the month edges, so
 * both ends fall in the year shown in the "Jahr" select.
 */
export function parseWeekTitle(text: string, year: number): { from: string; to: string } | null {
  const match = /\((\d{2})\.(\d{2})\.\s*-\s*(\d{2})\.(\d{2})\.\)/.exec(text);
  if (!match) return null;
  const [, d1, m1, d2, m2] = match;
  const from = `${year}-${m1}-${d1}`;
  const to = `${year}-${m2}-${d2}`;
  return isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : null;
}
