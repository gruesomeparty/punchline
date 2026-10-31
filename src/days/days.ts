// Preview page: loads Harvest totals for a range, reads the same days from the HRworks tab and
// shows what punchline would do for each day, grouped by week. Writing happens after a confirm.

import { HarvestError } from '../harvest/client.ts';
import {
  type DebugLogRequest,
  type DebugLogResponse,
  HRWORKS_URLS,
  pickHrworksTab,
  type ReadDaysRequest,
  type ReadDaysResponse,
  type WriteDaysRequest,
  type WriteDaysResponse,
} from '../hrworks/messages.ts';
import { localToday } from '../lib/time.ts';
import { type HrworksDay, type PlannedDay, planDays } from '../plan/plan.ts';
import { loadWriteLog } from '../plan/write-log.ts';
import { holdUnchecked, isWritable, runWrites, type WritableDay } from '../plan/write-runner.ts';
import { loadSettings, validateSettings } from '../settings/settings.ts';
import { byId, el } from '../ui/dom.ts';
import { followThemeSetting } from '../ui/theme.ts';
import { confirmWrite } from '../ui/write-confirm.ts';
import { defaultRange, presetRange, type RangePreset, rangeError } from './day-cells.ts';
import { groupDays, type ListItem } from './day-list.ts';
import { dayView, foldLabel, summaryLine } from './day-view.ts';
import type { DayRow } from './harvest-days.ts';
import { loadHarvestRows } from './load-harvest.ts';

const form = byId<HTMLFormElement>('range');
const from = byId<HTMLInputElement>('from');
const to = byId<HTMLInputElement>('to');
const status = byId<HTMLDivElement>('status');
const list = byId<HTMLDivElement>('days');
const summary = byId<HTMLElement>('summary');
const summaryBar = summary.parentElement as HTMLElement;
const hideMatching = byId<HTMLInputElement>('hide-matching');
const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
const writeAll = byId<HTMLButtonElement>('write-all');
const footer = byId<HTMLDivElement>('footer');
const debug = byId<HTMLDetailsElement>('debug');
const debugText = byId<HTMLPreElement>('debug-text');
let shownRows: DayRow[] = [];
let plannedDays: PlannedDay[] = [];
/** The latest write result of each day, kept so it survives re-rendering the list. */
const results = new Map<string, { text: string; kind: string }>();
/** Days written and checked since the preview was loaded. */
const writtenDates = new Set<string>();
/** When HRworks was last read for the preview, as an ISO time. */
let previewReadAt = '';

const weekdays = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
/** "Mon 17" */
const shortDay = (date: string) => `${weekdays.format(utc(date))} ${Number(date.slice(8))}`;

followThemeSetting();

const HIDE_KEY = 'punchline.hideMatching';
try {
  hideMatching.checked = localStorage.getItem(HIDE_KEY) !== 'false';
} catch {
  // Storage can be unavailable. Folding then just starts on.
}

function showStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  status.textContent = text;
  status.className = `status ${kind}`;
}

type Shown = { row: DayRow; planned: PlannedDay | null };

/** One day of the list: date, times, status pill, details, and a Write button if writable. */
function renderDay({ row, planned }: Shown): HTMLElement {
  const view = dayView(row, planned);
  const item = el('div', '', `day${row.weekend ? ' weekend' : ''}${view.quiet ? ' quiet' : ''}`);
  const date = el('div', '', 'day-date');
  date.title = fullDate.format(utc(row.date));
  date.append(
    el('span', weekdays.format(utc(row.date)), 'wd'),
    el('span', String(Number(row.date.slice(8))), 'dn'),
  );

  const main = el('div', '', 'day-main');
  const line = el('div', '', 'day-line');
  if (view.before)
    line.append(el('span', view.before, 'times old muted'), el('span', '→', 'muted'));
  if (view.times) line.append(el('span', view.times, 'times'));
  if (view.pill) line.append(el('span', view.pill.label, `pill ${view.pill.kind}`));
  main.append(line, el('div', view.details, 'details'));
  if (view.note) main.append(el('div', view.note, `day-note ${view.noteKind}`));
  const result = el('div', '', 'day-result');
  main.append(result);

  const action = el('div', '', 'day-action');
  if (isWritable(planned ?? undefined)) {
    const day = planned as WritableDay;
    const button = el('button', day.action === 'create' ? 'Write' : 'Override', 'secondary write');
    button.type = 'button';
    button.disabled = writing;
    button.addEventListener('click', () => void writeWithConfirm([day]));
    action.append(button);
  }
  item.append(date, main, action);
  dayElements.set(row.date, item);
  const shown = results.get(row.date);
  if (shown) showResult(item, shown.text, shown.kind);
  return item;
}

/** A folded run of quiet days. Clicking it shows the days in its place. */
function renderFold(days: Shown[], wholeWeek = false): HTMLElement {
  const label = foldLabel(
    days.map((d) => d.planned as PlannedDay),
    shortDay,
    wholeWeek,
  );
  const button = el('button', label, 'fold');
  button.type = 'button';
  button.title = 'Show these days';
  button.addEventListener('click', () => button.replaceWith(...days.map(renderDay)));
  return button;
}

function renderList(): void {
  dayElements.clear();
  const shown = shownRows.map((row, i): Shown => ({ row, planned: plannedDays[i] ?? null }));
  const weeks = groupDays(
    shown,
    (d) => d.row.date,
    (d) => dayView(d.row, d.planned).quiet,
    hideMatching.checked,
  );
  list.replaceChildren(
    ...weeks.map((week) => {
      const days = week.items.flatMap((item) => (item.kind === 'fold' ? item.items : [item.item]));
      const first = days[0]?.row.date ?? '';
      const last = days.at(-1)?.row.date ?? '';
      const card = el(
        'section',
        '',
        `card week${week.quiet && hideMatching.checked ? ' quiet' : ''}`,
      );
      const head = el('div', '', 'week-head');
      head.append(
        el('h2', `KW ${week.week}`),
        el('span', `${dayMonth.format(utc(first))} – ${dayMonth.format(utc(last))}`, 'muted'),
      );
      card.append(head);
      if (week.quiet && hideMatching.checked) {
        // The whole week needs nothing: one line, opened by clicking it.
        card.append(renderFold(days, true));
        return card;
      }
      card.append(
        ...week.items.map((item: ListItem<Shown>) =>
          item.kind === 'fold' ? renderFold(item.items) : renderDay(item.item),
        ),
      );
      return card;
    }),
  );
}

hideMatching.addEventListener('change', () => {
  try {
    localStorage.setItem(HIDE_KEY, String(hideMatching.checked));
  } catch {
    // Not remembered then.
  }
  renderList();
});

/** Sends a request to the HRworks tab. Returns an error message instead of throwing. */
async function sendToHrworks<T>(
  request: ReadDaysRequest | WriteDaysRequest | DebugLogRequest,
): Promise<T | string> {
  const tab = pickHrworksTab(await chrome.tabs.query({ url: HRWORKS_URLS }));
  if (tab?.id === undefined) return 'Open HRworks Arbeitszeiten in a tab.';
  try {
    return (await chrome.tabs.sendMessage(tab.id, request)) as T;
  } catch (error) {
    // No receiving end: the content script isn't there, usually because the tab was open before
    // punchline was installed or updated. Anything else means the tab went away mid-request.
    const message = error instanceof Error ? error.message : '';
    return message.includes('Receiving end does not exist')
      ? 'Reload the HRworks tab and try again.'
      : LOST_CONTACT;
  }
}

/** Shows the HRworks steps of the latest run, if the debug log is on in the settings. */
async function showDebugLog(): Promise<void> {
  if (!(await loadSettings()).debugLog) return;
  const response = await sendToHrworks<DebugLogResponse>({ type: 'punchline/debug-log' });
  debugText.textContent =
    typeof response === 'string' ? response : response.lines.join('\n') || '(empty)';
  debug.hidden = false;
}

byId('debug-copy').addEventListener('click', () => {
  void navigator.clipboard.writeText(debugText.textContent ?? '');
});

async function readHrworks(from: string, to: string): Promise<HrworksDay[] | string> {
  const response = await sendToHrworks<ReadDaysResponse>({ type: 'punchline/read-days', from, to });
  if (typeof response === 'string') return response;
  return response.ok ? response.days : response.error;
}

let writing = false;
/** The rendered row of each day, by date. Folded days have none until they're shown. */
const dayElements = new Map<string, HTMLElement>();

function showResult(item: HTMLElement, text: string, kind: string): void {
  item.querySelector('.day-action')?.replaceChildren();
  const result = item.querySelector('.day-result');
  if (result) {
    result.textContent = text;
    result.className = `day-result ${kind}`;
  }
}

/** Shows how writing a day went, below its times. */
function showInCell(date: string, text: string, kind: string): void {
  results.set(date, { text, kind });
  const item = dayElements.get(date);
  if (item) showResult(item, text, kind);
}

function setWriteButtons(disabled: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button.write')) {
    button.disabled = disabled;
  }
}

const LOST_CONTACT = 'Lost contact with the HRworks tab while it was writing.';

/** Writes the days week by week, after a confirm. Stops at the first week with a problem. */
async function writeWithConfirm(candidates: readonly WritableDay[]): Promise<void> {
  if (writing || candidates.length === 0) return;
  const { ready, held, earlier } = holdUnchecked(candidates, await loadWriteLog(), previewReadAt);
  for (const day of held) {
    showInCell(
      day.harvest.date,
      'Saved without a check. Load the preview again to see what HRworks has now.',
      'warn',
    );
  }
  if (held.length > 0 && ready.length === 0) {
    showStatus('Load the preview again first: an earlier save could not be checked.', 'error');
  }
  const chosen =
    ready.length > 0 ? await confirmWrite(ready, earlier, { icon: '../icons/icon-48.png' }) : [];
  if (chosen.length === 0) return;

  writing = true;
  setWriteButtons(true);
  const { written, stop } = await runWrites(chosen, {
    send: async (week) => {
      const request: WriteDaysRequest = { type: 'punchline/write-days', days: week };
      return sendToHrworks<WriteDaysResponse>(request);
    },
    maySaved: (error) => error === LOST_CONTACT,
    show: showInCell,
  });
  for (const date of written) writtenDates.add(date);
  writing = false;
  setWriteButtons(false);
  updateWriteAll();
  await showDebugLog();
  if (chosen.length > 1) {
    showStatus(
      stop
        ? `Wrote ${written.length} of ${chosen.length} days, then stopped at ${stop}. Load the ` +
            'preview again to continue.'
        : `Wrote and checked all ${chosen.length} days.`,
      stop ? 'error' : 'ok',
    );
  }
}

/** The days still to write. "Write all" only shows when there are at least two. */
function remainingDays(): WritableDay[] {
  return plannedDays.filter(isWritable).filter((day) => !writtenDates.has(day.harvest.date));
}

function updateWriteAll(): void {
  const count = remainingDays().length;
  writeAll.textContent = `Write all ${count} days`;
  footer.hidden = count < 2;
}

writeAll.addEventListener('click', () => void writeWithConfirm(remainingDays()));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const invalid = rangeError(from.value, to.value);
  if (invalid) {
    showStatus(invalid, 'error');
    return;
  }
  const settings = await loadSettings();
  if (validateSettings(settings).length > 0) {
    showStatus('Set up your Harvest token and account ID in the settings first.', 'error');
    return;
  }

  submit.disabled = true;
  footer.hidden = true;
  summaryBar.hidden = true;
  plannedDays = [];
  writtenDates.clear();
  results.clear();
  showStatus('Loading from Harvest…');
  try {
    const rows = await loadHarvestRows(settings, from.value, to.value);
    shownRows = rows;
    renderList();

    showStatus('Reading HRworks…');
    previewReadAt = new Date().toISOString();
    const hrworks = await readHrworks(from.value, to.value);
    await showDebugLog();
    if (typeof hrworks === 'string') {
      showStatus(`Harvest loaded. ${hrworks}`, 'error');
      return;
    }
    const planned = planDays(rows, hrworks, {
      mode: settings.conflictMode,
      weekendHours: settings.weekendHours,
    });
    plannedDays = planned;
    renderList();
    updateWriteAll();
    summary.textContent = summaryLine(planned);
    summaryBar.hidden = false;
    showStatus('');
  } catch (error) {
    showStatus(error instanceof HarvestError ? error.message : 'Unexpected error.', 'error');
  } finally {
    submit.disabled = false;
  }
});

const range = defaultRange(localToday());
from.value = range.from;
to.value = range.to;

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
  button.addEventListener('click', () => {
    const preset = presetRange(button.dataset.preset as RangePreset, localToday());
    from.value = preset.from;
    to.value = preset.to;
    form.requestSubmit();
  });
}
