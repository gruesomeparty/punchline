// Synthetic HRworks markup for tests. It copies the structure the page reader relies on
// (class names, data-guide-id attributes, nesting) and nothing else. All data is made up.

import { GUIDE } from './page.ts';
import { MONTH_NAMES } from './parse.ts';

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
};

export type FakeWeek = { title: string; open: boolean; days: FakeDay[] };

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-');
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${weekday},&nbsp;${d}.${m}.${y?.slice(2)}`;
}

function details(day: FakeDay): string {
  if (!day.detailsOpen) {
    return `<div class="row bs-hide"><div class="col-12"><div class="alert-info alert bs-hide" data-guide-id="${GUIDE.details}"></div></div></div>`;
  }
  return `<div class="row"><div class="col-12"><div class="alert-info alert" data-guide-id="${GUIDE.details}"><div class="row col-12"><div class="col-md-6 col-12">
    <span class="m--font-boldest">Sollarbeitsstunden: </span> <span>8:24</span><div class="me-break"></div>
    <span class="m--font-boldest">Pausendauer:</span> <span>0:30</span>
    <div>0:00 (manuell erfasst)</div><div>0:30 (automatische Pausen aus Pausenregelungen)</div>
    <span class="m--font-boldest">Gutgeschriebene Arbeitsstunden:</span> <span>${day.credited ?? ''}</span>
  </div></div></div></div></div>`;
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
        <a href="javascript:;" class="btn"><i class="icon-streamline-add"></i><span></span></a>
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
function options(labels: string[], selected: string): string {
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
        <select class="form-control">${options(MONTH_NAMES, MONTH_NAMES[month - 1] ?? '')}</select></div>
      <div class="form-group" data-guide-id="${GUIDE.yearGroup}"><label><span> Jahr</span></label>
        <select class="form-control">${options(years, String(year))}</select></div>
    </div>
    <div class="m-accordion">${[...weeks].reverse().map(weekHtml).join('')}</div>
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
