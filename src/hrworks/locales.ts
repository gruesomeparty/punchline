// Every HRworks text punchline matches on, per UI language. Users can switch the HRworks
// language, so nothing else should hard-code these. To add a language, copy GERMAN, translate
// each text exactly as HRworks shows it, and add it to LOCALES. Day labels and week titles
// are parsed as dd.mm.yy; a language that formats dates differently needs parser changes too.

export type HrworksTexts = {
  language: string;
  /** Options of the month select, January first. Also how the language is recognised. */
  months: readonly string[];
  /** Day status when the day has no working time. */
  noEntry: string;
  /** Shown instead of the end time while an entry is still open. */
  openEntry: string;
  /** Day type of days without work in the work plan (weekends). */
  notAWorkday: string;
  /** Label of the net hours in the ⓘ details. */
  credited: string;
  /** Suffix after times of day: "07:00 Uhr". */
  clockSuffix: string;
  /** Suffix after durations: "-08:24 Stunden". */
  hoursSuffix: string;
  /** Part of the dialog shown shortly before the session expires. */
  sessionExpiring: string;
  /** Parts of validation messages that mean a save was rejected. */
  saveErrors: readonly string[];
};

export const GERMAN: HrworksTexts = {
  language: 'Deutsch',
  months: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ],
  noEntry: 'Keine Arbeitszeit erfasst',
  openEntry: 'Offene Arbeitszeit',
  notAWorkday: 'Kein Arbeitstag nach Arbeitsplan',
  credited: 'Gutgeschriebene Arbeitsstunden',
  clockSuffix: 'Uhr',
  hoursSuffix: 'Stunden',
  sessionExpiring: 'Ihre Sitzung läuft bald ab',
  saveErrors: ['überlappt'],
};

export const LOCALES: readonly HrworksTexts[] = [GERMAN];

/** The language whose month names are exactly these select options, or null. */
export function localeForMonths(options: readonly string[]): HrworksTexts | null {
  return (
    LOCALES.find(
      (locale) =>
        locale.months.length === options.length &&
        locale.months.every((month, i) => month === options[i]),
    ) ?? null
  );
}
