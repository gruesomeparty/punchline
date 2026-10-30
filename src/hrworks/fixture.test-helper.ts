// Synthetic HRworks markup for tests. It copies the structure the page reader relies on
// (class names, data-guide-id attributes, nesting) and nothing else. All data is made up.

import { formatDuration, parseTime } from '../lib/time.ts';
import { GERMAN } from './locales.ts';
import { dayHeaderTexts, GUIDE } from './page.ts';
import { WRITE_GUIDE } from './write.ts';

export type FakeDay = {
  /** ISO date. */
  date: string;
  /** Texts under the progress bar, e.g. ["08:00 Uhr", "17:00 Uhr"]. */
  status?: string[];
  /** Day type or absence, e.g. "Jahresurlaub". */
  label?: string;
  /** Credited hours shown in the ⓘ details, e.g. "8:30". */
  credited?: string;
  /** Whether the ⓘ details are already open. */
  detailsOpen?: boolean;
  /** A new, unsaved entry opened with "+", with the values in its inputs. */
  editing?: { start: string; end: string };
  /** HRworks disables "+" on days without a work plan. */
  addDisabled?: boolean;
  /** Times typed into the saved entry's inputs, not saved yet. */
  draft?: { start: string; end: string };
};

export type FakeWeek = { title: string; open: boolean; days: FakeDay[] };

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-');
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${weekday},&nbsp;${d}.${m}.${y?.slice(2)}`;
}

function infoPanel(day: FakeDay): string {
  if (!day.detailsOpen) {
    return `<div class="col-12"><div class="alert-info alert bs-hide" data-guide-id="${GUIDE.details}"></div></div>`;
  }
  return `<div class="col-12"><div class="alert-info alert" data-guide-id="${GUIDE.details}"><div class="row col-12"><div class="col-md-6 col-12">
    <span class="m--font-boldest">Sollarbeitsstunden: </span> <span>8:24</span><div class="me-break"></div>
    <span class="m--font-boldest">Pausendauer:</span> <span>0:30</span>
    <div>0:00 (manuell erfasst)</div><div>0:30 (automatische Pausen aus Pausenregelungen)</div>
    <span class="m--font-boldest">Gutgeschriebene Arbeitsstunden:</span> <span>${day.credited ?? ''}</span>
  </div></div></div></div>`;
}

// The real page fills the inputs from script; the fake uses value attributes instead.
function entryHtml(entry: { start: string; end: string }): string {
  const field = (guide: string, value: string) =>
    `<div class="form-group" data-guide-id="${guide}"><div class="input-group"><input class="form-control" type="text" value="${value}"></div></div>`;
  return `<div class="row" data-guide-id="${WRITE_GUIDE.entry}"><div class="col-10"><div class="row">
    ${field(WRITE_GUIDE.start, entry.start)}${field(WRITE_GUIDE.end, entry.end)}
  </div></div></div>`;
}

/** The saved entry of a day, if its status shows a start, and an end unless it is open. */
function savedEntry(day: FakeDay): { start: string; end: string } | null {
  const [start, end] = (day.status ?? []).map((text) => /^(\d{2}:\d{2}) Uhr$/.exec(text)?.[1]);
  if (!start) return null;
  if (end) return { start, end };
  return day.status?.[1] === 'Offene Arbeitszeit' && !day.editing ? { start, end: '' } : null;
}

// Like HRworks, the ⓘ details show saved entries as editable inputs too.
function details(day: FakeDay): string {
  const open = day.detailsOpen || day.editing;
  const saved = day.detailsOpen ? (day.draft ?? savedEntry(day)) : null;
  const entries = [saved, day.editing].flatMap((entry) => (entry ? [entryHtml(entry)] : []));
  return `<div class="row${open ? '' : ' bs-hide'}">${infoPanel(day)}
    <div class="col-12">${entries.join('')}</div></div>`;
}

export function dayHtml(day: FakeDay): string {
  const status = (day.status ?? []).map((text) => `<span> ${text}</span>`).join(' ');
  const progress =
    day.status && day.status.length > 0
      ? `<div class="progress"><div class="progress-bar"></div></div><div>${status}</div>`
      : '';
  return `<div class="hrw-me-object-holder-without-separator-line">
    <div class="col-12 bs-hide"><div class="hrw-loadingShimmer"></div></div>
    <div class="row hrw-me-working-time-day-header-row" data-guide-id="${GUIDE.dayRow}">
      <div class="col-10"><div class="row">
        <span class="hrw-me-working-time-day-header-span" data-guide-id="${GUIDE.dayLabel}"> ${dayLabel(day.date)}</span>
        <div class="col-lg-5">${progress}</div>
        <span class="hrw-me-working-time-day-header-span"> +00:00 Stunden</span>
        <span class="col-12" data-guide-id="${GUIDE.dayType}">${day.label ? ` ${day.label}` : ''}</span>
      </div></div>
      <div class="col-12">
        <a href="javascript:;" class="btn" data-guide-id="${GUIDE.infoButton}"><i class="icon-streamline-information-circle"></i><span></span></a>
        <a href="javascript:;" class="btn${day.addDisabled ? ' disabled' : ''}"><i class="icon-streamline-add"></i><span></span></a>
      </div>
    </div>
    ${details(day)}
  </div>`;
}

export function weekHtml(week: FakeWeek, index: number): string {
  // Collapsed weeks load their days only when opened, like HRworks does.
  const days = week.open ? [...week.days].reverse().map(dayHtml).join('') : '';
  // Like HRworks, only the first week item has a data-guide-id.
  const guide = index === 0 ? ' data-guide-id="aaa6ecc7-4778-4ef1-814b-6aae2c52cde1"' : '';
  return `<div class="m-accordion__item"${guide}>
    <div class="${week.open ? '' : 'collapsed '}m-accordion__item-head" data-guide-id="${GUIDE.weekHead}" data-toggle="collapse">
      <span class="m-accordion__item-title"> ${week.title}</span>
      <span><span> 0 Stunden</span> <span> 42 Stunden</span></span>
    </div>
    <div class="m-accordion__item-body collapse${week.open ? ' show' : ''}">${days}</div>
  </div>`;
}

// Option values are unique on the real page too (and happy-dom mixes up duplicates).
function options(labels: readonly string[], selected: string): string {
  return labels
    .map(
      (label, i) =>
        `<option value="id-${label}-${i}"${label === selected ? ' selected' : ''}>${label}</option>`,
    )
    .join('');
}

export function pageHtml(year: number, month: number, weeks: FakeWeek[]): string {
  const years = ['2027', '2026', '2025'];
  return `<form><div class="row">
      <div class="form-group" data-guide-id="${GUIDE.monthGroup}"><label><span> Monat</span></label>
        <select class="form-control">${options(GERMAN.months, GERMAN.months[month - 1] ?? '')}</select></div>
      <div class="form-group" data-guide-id="${GUIDE.yearGroup}"><label><span> Jahr</span></label>
        <select class="form-control">${options(years, String(year))}</select></div>
    </div>
    <div class="m-accordion">${[...weeks].reverse().map(weekHtml).join('')}</div>
    <button type="button" data-guide-id="${WRITE_GUIDE.save}"><span> Speichern</span></button>
  </form>`;
}

/**
 * Puts the page into `root`. happy-dom gets the selected option wrong when several selects are
 * parsed at once, so this re-applies the `selected` attributes.
 */
export function showPage(root: HTMLElement, html: string): void {
  root.innerHTML = html;
  for (const option of root.querySelectorAll('option[selected]')) {
    (option as HTMLOptionElement).selected = true;
  }
}

/** HRworks' breaks as observed: 30 minutes from 7 hours, 60 from 9 hours. */
function creditFor(start: string, end: string): number {
  const gross = (parseTime(end) ?? 0) - (parseTime(start) ?? 0);
  return gross - (gross > 540 ? 60 : gross > 420 ? 30 : 0);
}

/** Two made-up months that behave like HRworks: weeks and details load on click. */
export function fakeMonths(): Map<string, FakeWeek[]> {
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

function byGuideIn(root: ParentNode, id: string): Element[] {
  return [...root.querySelectorAll(`[data-guide-id="${id}"]`)];
}

/** A fake HRworks page: weeks, details and saves load a little later, like the real one. */
export class FakeHrworks {
  data = fakeMonths();
  year = 2026;
  month = 7;
  clicks = 0;
  /** How many week clicks to ignore, like HRworks sometimes does. */
  ignoreWeekClicks = 0;
  /** How many "+" clicks to ignore, like HRworks does while it re-renders. */
  ignoreAddClicks = 0;
  /** Validation message to show instead of saving. */
  rejectSave = '';
  /** Collapse all weeks after a save, as a full re-render would. */
  closeWeeksOnSave = false;
  saves = 0;

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
    if (this.rejectSave && this.saves > 0) {
      document.body.insertAdjacentHTML('beforeend', `<div class="alert">${this.rejectSave}</div>`);
    }
  }

  days(): FakeDay[] {
    return this.weeks().flatMap((week) => week.days);
  }

  dayOf(target: Element | null | undefined): FakeDay | undefined {
    const row = target?.closest(`[data-guide-id="${GUIDE.dayRow}"]`);
    const label = row ? dayHeaderTexts(row).day : '';
    return this.days().find((day) => {
      const [y, m, d] = day.date.split('-');
      return label.endsWith(`${d}.${m}.${y?.slice(2)}`);
    });
  }

  // HRworks answers through the server, so changes show up a little later.
  later(change: () => void): void {
    setTimeout(() => {
      change();
      this.render();
    }, 20);
  }

  onChange = (event: Event): void => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const select = event.target;
    const label = select.options[select.selectedIndex]?.textContent ?? '';
    this.later(() => {
      if (GERMAN.months.includes(label)) this.month = GERMAN.months.indexOf(label) + 1;
      else this.year = Number(label);
    });
  };

  /** Every HRworks event sends the whole form, so typed values survive the re-render. */
  entriesOnPage(): { day: FakeDay; start: string; end: string }[] {
    return byGuideIn(document, WRITE_GUIDE.entry).flatMap((entry) => {
      const holder = entry.closest('.hrw-me-object-holder-without-separator-line');
      const day = this.dayOf(holder?.querySelector(`[data-guide-id="${GUIDE.dayRow}"]`));
      const [start = '', end = ''] = [...entry.querySelectorAll('input')].map((i) => i.value);
      return day ? [{ day, start, end }] : [];
    });
  }

  onClick = (event: Event): void => {
    for (const { day, start, end } of this.entriesOnPage()) {
      if (day.editing) day.editing = { start, end };
      else day.draft = { start, end };
    }
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
      const day = this.dayOf(target);
      this.later(() => {
        if (day) day.detailsOpen = true;
      });
    } else if ((event.target as Element).closest('a')?.querySelector('.icon-streamline-add')) {
      const day = this.dayOf(event.target as Element);
      if (!day || (event.target as Element).closest('a')?.classList.contains('disabled')) return;
      if (this.ignoreAddClicks > 0) {
        this.ignoreAddClicks--;
        return;
      }
      // HRworks prefills the start with the current time.
      this.later(() => {
        day.editing = { start: '20:26', end: '' };
      });
    } else if (guide === WRITE_GUIDE.save) {
      this.saves++;
      // Speichern sends every entry on the page, saved or new, with whatever is in its inputs.
      const sent = this.entriesOnPage();
      this.later(() => {
        if (this.rejectSave) return;
        for (const { day, start, end } of sent) {
          delete day.editing;
          delete day.draft;
          day.status = [`${start} Uhr`, `${end} Uhr`];
          day.credited = formatDuration(creditFor(start, end));
        }
        if (this.closeWeeksOnSave) for (const week of this.weeks()) week.open = false;
      });
    }
  };
}
