// Preview page: loads Harvest totals for a range, reads the same days from the HRworks tab and
// shows what punchline would do for each day. Writing is one day at a time, after a confirm.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import {
  HRWORKS_URLS,
  pickHrworksTab,
  type ReadDaysRequest,
  type ReadDaysResponse,
  type WriteDaysRequest,
  type WriteDaysResponse,
} from '../hrworks/messages.ts';
import type { WriteDay, WriteResult } from '../hrworks/write.ts';
import { formatDuration, localToday, parseTime } from '../lib/time.ts';
import { byHrworksWeek } from '../plan/batches.ts';
import { type HrworksDay, type PlannedDay, planDays } from '../plan/plan.ts';
import { countActions, previewCells } from '../plan/plan-cells.ts';
import { appendWriteLog, loadWriteLog, type WriteLogEntry, wasWritten } from '../plan/write-log.ts';
import { loadSettings, validateSettings } from '../settings/settings.ts';
import { confirmDialog } from '../ui/confirm-dialog.ts';
import { byId, el } from '../ui/dom.ts';
import { defaultRange, presetRange, type RangePreset, rangeError } from './day-cells.ts';
import { type DayRow, harvestDays } from './harvest-days.ts';

const form = byId<HTMLFormElement>('range');
const from = byId<HTMLInputElement>('from');
const to = byId<HTMLInputElement>('to');
const status = byId<HTMLDivElement>('status');
const table = byId<HTMLTableElement>('days');
const submit = form.querySelector('button') as HTMLButtonElement;
const writeAll = byId<HTMLButtonElement>('write-all');
let plannedDays: PlannedDay[] = [];

const weekdays = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

function showStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  status.textContent = text;
  status.className = `status ${kind}`;
}

function renderRows(rows: readonly DayRow[], planned: readonly PlannedDay[] | null): void {
  table.tBodies[0]?.replaceChildren(
    ...rows.map((row, i) => {
      const day = new Date(`${row.date}T00:00:00Z`);
      const cells = previewCells(row, planned?.[i] ?? null);
      const tr = el('tr', '', row.weekend ? 'muted' : '');
      tr.append(
        el('td', `${weekdays.format(day)}, ${fullDate.format(day)}`),
        el('td', cells.harvest),
        el('td', cells.hrworks),
        el('td', cells.enter),
        el('td', cells.break, 'col-break'),
        el('td', cells.action, cells.actionKind),
        el('td', cells.note, cells.noteKind),
        writeCell(planned?.[i]),
      );
      return tr;
    }),
  );
  table.hidden = false;
}

/** Sends a request to the HRworks tab. Returns an error message instead of throwing. */
async function sendToHrworks<T>(request: ReadDaysRequest | WriteDaysRequest): Promise<T | string> {
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

async function readHrworks(from: string, to: string): Promise<HrworksDay[] | string> {
  const response = await sendToHrworks<ReadDaysResponse>({ type: 'punchline/read-days', from, to });
  if (typeof response === 'string') return response;
  return response.ok ? response.days : response.error;
}

let writing = false;
/** The action cell of each day in the table, by date. */
const actionCells = new Map<string, HTMLTableCellElement>();

type WritableDay = PlannedDay & { action: 'create' | 'override' };

function isWritable(day: PlannedDay | undefined): day is WritableDay {
  return day?.action === 'create' || day?.action === 'override';
}

/** A "Write" button for days to create, an "Override" button for days to change. */
function writeCell(day: PlannedDay | undefined): HTMLTableCellElement {
  const cell = el('td');
  if (!isWritable(day)) return cell;
  actionCells.set(day.harvest.date, cell);
  const label = day.action === 'create' ? 'Write' : 'Override';
  const button = el('button', label, 'secondary write');
  button.type = 'button';
  button.addEventListener('click', () => void writeWithConfirm([day]));
  cell.append(button);
  return cell;
}

function showInCell(date: string, text: string, kind: string): void {
  actionCells.get(date)?.replaceChildren(el('span', text, kind));
}

function setWriteButtons(disabled: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button.write')) {
    button.disabled = disabled;
  }
}

const oldTimes = (day: WritableDay) =>
  day.action === 'override'
    ? day.previous.map((entry) => `${entry.start}–${entry.end}`).join(', ')
    : '';
const shortDate = (date: string) => `${weekdays.format(new Date(`${date}T00:00:00Z`))} ${date}`;

function toWriteDay(day: WritableDay): WriteDay {
  return {
    date: day.harvest.date,
    start: day.times.start,
    end: day.times.end,
    expectedMinutes: day.harvest.netMinutes,
    ...(day.action === 'override' ? { previous: day.previous } : {}),
    ...(day.hrworks?.workday === false ? { dayOff: true } : {}),
  };
}

function confirmWrite(days: readonly WritableDay[], earlier: WriteLogEntry | null) {
  const icon = '../icons/icon-48.png';
  const [day] = days;
  if (days.length === 1 && day) {
    const { start, end } = day.times;
    const override = day.action === 'override';
    const shownDate = fullDate.format(new Date(`${day.harvest.date}T00:00:00Z`));
    return confirmDialog({
      title: override ? `Override ${shownDate} in HRworks?` : `Write ${shownDate} to HRworks?`,
      rows: [
        ...(override ? [{ label: 'HRworks now', value: oldTimes(day), old: true }] : []),
        { label: override ? 'New' : 'Enter', value: `${start}–${end}` },
        { label: 'After breaks', value: `${formatDuration(day.harvest.netMinutes)} (Harvest)` },
      ],
      note:
        (earlier ? `punchline wrote this day on ${earlier.at.slice(0, 10)}. ` : '') +
        (override
          ? 'HRworks has no undo. punchline logs the old times before it saves.'
          : 'punchline checks the day in HRworks after saving.'),
      confirmLabel: override ? 'Override' : 'Write',
      icon,
    });
  }
  const overrides = days.filter((d) => d.action === 'override').length;
  return confirmDialog({
    title: `Write ${days.length} days to HRworks?`,
    rows: days.map((d) => ({
      label: shortDate(d.harvest.date),
      value:
        d.action === 'override'
          ? `${oldTimes(d)} → ${d.times.start}–${d.times.end}`
          : `${d.times.start}–${d.times.end}`,
    })),
    note:
      'punchline saves once per HRworks week and checks every day after. It stops at the first ' +
      'problem; load the preview again to continue.' +
      (overrides > 0 ? ` ${overrides} override(s): the old times are logged first.` : ''),
    confirmLabel: 'Write all',
    icon,
  });
}

const LOST_CONTACT = 'Lost contact with the HRworks tab while it was writing.';

/** Writes the days week by week, after a confirm. Stops at the first week with a problem. */
async function writeWithConfirm(candidates: readonly WritableDay[]): Promise<void> {
  if (writing || candidates.length === 0) return;
  // A save whose result couldn't be checked must be looked at first. After a checked save the
  // fresh preview is what counts: the write refuses unless HRworks still shows what it showed.
  const log = await loadWriteLog();
  const days: WritableDay[] = [];
  let earlier: WriteLogEntry | null = null;
  for (const day of candidates) {
    const last = wasWritten(log, day.harvest.date);
    if (last?.result === 'unknown') {
      showInCell(
        day.harvest.date,
        `Saved ${last.at.slice(0, 10)} without a check. Look at HRworks first.`,
        'warn',
      );
    } else {
      days.push(day);
      earlier = last;
    }
  }
  if (days.length === 0 || !(await confirmWrite(days, earlier))) return;

  writing = true;
  setWriteButtons(true);
  let written = 0;
  let stop = '';
  for (const week of byHrworksWeek(days, (day) => day.harvest.date)) {
    for (const day of week) showInCell(day.harvest.date, 'Writing…', 'muted');
    const attempts = week.map((day) => ({
      date: day.harvest.date,
      action: day.action,
      start: day.times.start,
      end: day.times.end,
      previous: day.action === 'override' ? day.previous : [],
    }));
    // Logged before anything is sent, so the old times survive even if the tab closes mid-save.
    for (const attempt of attempts) {
      await appendWriteLog({
        ...attempt,
        at: new Date().toISOString(),
        result: 'unknown',
        message: 'Started, no result yet.',
      });
    }
    const request: WriteDaysRequest = { type: 'punchline/write-days', days: week.map(toWriteDay) };
    const response = await sendToHrworks<WriteDaysResponse>(request);
    const results: WriteResult[] =
      typeof response === 'string'
        ? week.map(() => ({ ok: false, error: response, saved: response === LOST_CONTACT }))
        : response;
    for (const [i, attempt] of attempts.entries()) {
      const result = results[i] ?? { ok: false, error: 'No answer for this day.', saved: true };
      await appendWriteLog({
        ...attempt,
        at: new Date().toISOString(),
        result: result.ok ? 'ok' : result.saved ? 'unknown' : 'failed',
        message: result.ok ? '' : result.error,
      });
      if (result.ok) {
        written++;
        showInCell(attempt.date, 'Written and checked', 'ok');
      } else {
        const hint = result.saved ? ' Check this day in HRworks.' : '';
        showInCell(attempt.date, `${result.error}${hint}`, 'error');
        // Name the day that stopped the week, not a day that was only held back by it.
        stop ||= result.blockedBy ? '' : attempt.date;
      }
    }
    if (!stop && results.some((result) => !result.ok)) stop = week[0]?.harvest.date ?? '?';
    if (stop) break;
  }
  writing = false;
  setWriteButtons(false);
  if (days.length > 1) {
    showStatus(
      stop
        ? `Wrote ${written} of ${days.length} days, then stopped at ${stop}. Load the preview ` +
            'again to continue.'
        : `Wrote and checked all ${days.length} days.`,
      stop ? 'error' : 'ok',
    );
  }
}

writeAll.addEventListener('click', () => void writeWithConfirm(plannedDays.filter(isWritable)));

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
  writeAll.hidden = true;
  plannedDays = [];
  actionCells.clear();
  showStatus('Loading from Harvest…');
  try {
    const credentials = { token: settings.harvestToken, accountId: settings.harvestAccountId };
    const user = await fetchCurrentUser(credentials);
    const entries = await fetchTimeEntries(credentials, user.id, from.value, to.value);
    const rows = harvestDays(from.value, to.value, dailyTotals(entries), {
      startMinutes: parseTime(settings.startTime) ?? 0,
      rules: settings.breakRules,
      today: localToday(),
    });
    renderRows(rows, null);

    showStatus('Reading HRworks…');
    const hrworks = await readHrworks(from.value, to.value);
    if (typeof hrworks === 'string') {
      showStatus(`Harvest loaded. ${hrworks}`, 'error');
      return;
    }
    const planned = planDays(rows, hrworks, {
      mode: settings.conflictMode,
      weekendHours: settings.weekendHours,
    });
    plannedDays = planned;
    renderRows(rows, planned);
    const writable = planned.filter(isWritable).length;
    writeAll.textContent = `Write all ${writable} days`;
    writeAll.hidden = writable < 2;
    const counts = countActions(planned);
    showStatus(
      `${counts.create} to create, ${counts.override} to override, ${counts.skip} already match, ` +
        `${counts.flag} flagged, ${counts.check} to check manually.`,
      'ok',
    );
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
