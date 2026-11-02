// Error codes for everything that can stop punchline in the HRworks tab. Coworkers report
// problems remotely, usually with just the message, so every message carries a short, stable
// code that points to one cause. docs/troubleshooting.md explains each code; a test keeps the
// two in sync. Never reuse a code for a different cause.

export const ERROR_CODES = {
  /** HRworks shows the "session expires soon" dialog. */
  sessionExpiring: 'PL-101',
  /** The tab doesn't show Zeitwirtschaft → Arbeitszeiten. */
  notWorkingTimes: 'PL-102',
  /** HRworks is in a language punchline has no texts for. */
  unknownLanguage: 'PL-103',
  /** The month or year select shows something punchline can't read. */
  unknownMonth: 'PL-104',
  /** An element punchline needs (week layout, select option, button) isn't there. */
  unexpectedLayout: 'PL-105',
  /** HRworks didn't finish a step within the time limit. */
  timeout: 'PL-201',
  /** A week stayed closed or empty after several clicks. */
  weekNotOpened: 'PL-202',
  /** No week of the shown month covers the date, or the week vanished while reading. */
  weekMissing: 'PL-301',
  /** The week is open, but the day has no row in it. */
  dayMissing: 'PL-302',
  /** The day's row was there and went away while punchline worked on it. */
  dayGone: 'PL-303',
  /** A week title, day row or details text that punchline can't parse. */
  unexpectedText: 'PL-304',
  /** A day row shows up under a week that doesn't cover its date. */
  wrongWeek: 'PL-305',
  /** The day can't take the entry: it has one already, is an absence or allows no new time. */
  notWritable: 'PL-401',
  /** HRworks shows other times on the day than the preview did. */
  changedSincePreview: 'PL-402',
  /** The day has several entries that punchline won't sort out on its own. */
  extraEntries: 'PL-403',
  /** HRworks dropped or changed the times punchline typed, before saving. */
  typedTimesLost: 'PL-404',
  /** Saved, but HRworks credits other hours than the break rules predict. */
  creditMismatch: 'PL-405',
  /** Anything that isn't one of the above, such as a bug in punchline. */
  unexpected: 'PL-900',
} as const;

export type ErrorKind = keyof typeof ERROR_CODES;
export type ErrorCode = (typeof ERROR_CODES)[ErrorKind];

/** Something on the page wasn't what punchline expects. The message is shown to the user. */
export class HrworksReadError extends Error {
  override name = 'HrworksReadError';
  readonly code: ErrorCode;
  /** The message without the code, to add more to it. */
  readonly text: string;

  constructor(kind: ErrorKind, text: string) {
    const code = ERROR_CODES[kind];
    super(`${text} (${code})`);
    this.code = code;
    this.text = text;
  }
}

/**
 * The text to show for any error, with `more` added before the code. Errors that aren't an
 * HrworksReadError get `fallback` and the code for unexpected errors.
 */
export function errorMessage(error: unknown, fallback: string, more = ''): string {
  if (error instanceof HrworksReadError) return `${error.text}${more} (${error.code})`;
  return `${fallback}${more} (${ERROR_CODES.unexpected})`;
}

/** What went wrong, for the debug log. Unexpected errors keep their own name and message. */
export function errorDetail(error: unknown): string {
  if (error instanceof HrworksReadError) return error.message;
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  return String(error).slice(0, 300);
}
