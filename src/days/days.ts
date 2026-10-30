// Preview page: loads Harvest totals for a range, reads the same days from the HRworks tab and
// shows what punchline would do for each day. Writing is one day at a time, after a confirm.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import {
  HRWORKS_URLS,
  pickHrworksTab,
  type ReadDaysRequest,
  type ReadDaysResponse,
  type WriteDayRequest,
  type WriteDayResponse,
} from '../hrworks/messages.ts';
import { formatDuration, localToday, parseTime } from '../lib/time.ts';
import { type HrworksDay, type PlannedDay, planDays } from '../plan/plan.ts';
import { countActions, previewCells } from '../plan/plan-cells.ts';
import { appendWriteLog, loadWriteLog, wasWritten } from '../plan/write-log.ts';
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
async function sendToHrworks<T>(request: ReadDaysRequest | WriteDayRequest): Promise<T | string> {
  const tab = pickHrworksTab(await chrome.tabs.query({ url: HRWORKS_URLS }));
  if (tab?.id === undefined) return 'Open HRworks Arbeitszeiten in a tab.';
  try {
    return (await chrome.tabs.sendMessage(tab.id, request)) as T;
  } catch {
    // The content script isn't there, usually because the tab was open before punchline was
    // installed or updated.
    return 'Reload the HRworks tab and try again.';
  }
}

async function readHrworks(from: string, to: string): Promise<HrworksDay[] | string> {
  const response = await sendToHrworks<ReadDaysResponse>({ type: 'punchline/read-days', from, to });
  if (typeof response === 'string') return response;
  return response.ok ? response.days : response.error;
}

let writing = false;

/** A "Write" button for days to create, an "Override" button for days to change. */
function writeCell(day: PlannedDay | undefined): HTMLTableCellElement {
  const cell = el('td');
  if (day?.action !== 'create' && day?.action !== 'override') return cell;
  const label = day.action === 'create' ? 'Write' : 'Override';
  const button = el('button', label, 'secondary write');
  button.type = 'button';
  button.addEventListener('click', () => void writeOne(day, cell));
  cell.append(button);
  return cell;
}

async function writeOne(day: PlannedDay, cell: HTMLTableCellElement): Promise<void> {
  if (writing || (day.action !== 'create' && day.action !== 'override')) return;
  const { date } = day.harvest;
  const { start, end } = day.times;
  const earlier = wasWritten(await loadWriteLog(), date);
  if (earlier) {
    cell.replaceChildren(el('span', `Already written ${earlier.at.slice(0, 10)}`, 'warn'));
    return;
  }
  const net = formatDuration(day.harvest.netMinutes);
  const previous = day.action === 'override' ? day.previous : [];
  const old = previous.map((entry) => `${entry.start}–${entry.end}`).join(', ');
  const shownDate = fullDate.format(new Date(`${date}T00:00:00Z`));
  const override = day.action === 'override';
  const confirmed = await confirmDialog({
    title: override ? `Override ${shownDate} in HRworks?` : `Write ${shownDate} to HRworks?`,
    rows: [
      ...(override ? [{ label: 'HRworks now', value: old, old: true }] : []),
      { label: override ? 'New' : 'Enter', value: `${start}–${end}` },
      { label: 'After breaks', value: `${net} (Harvest)` },
    ],
    note: override
      ? 'HRworks has no undo. punchline logs the old times before it saves.'
      : 'punchline checks the day in HRworks after saving.',
    confirmLabel: override ? 'Override' : 'Write',
    icon: '../icons/icon-48.png',
  });
  if (!confirmed) return;

  writing = true;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button.write')) {
    button.disabled = true;
  }
  cell.replaceChildren(el('span', 'Writing…', 'muted'));
  const request: WriteDayRequest = {
    type: 'punchline/write-day',
    day: {
      date,
      start,
      end,
      expectedMinutes: day.harvest.netMinutes,
      ...(day.action === 'override' ? { previous } : {}),
    },
  };
  // Logged before anything is sent, so the old times survive even if the tab closes mid-save.
  const attempt = { date, action: day.action, start, end, previous };
  await appendWriteLog({
    ...attempt,
    at: new Date().toISOString(),
    result: 'unknown',
    message: 'Started, no result yet.',
  });
  const response = await sendToHrworks<WriteDayResponse>(request);
  const result =
    typeof response === 'string' ? { ok: false as const, error: response, saved: false } : response;
  await appendWriteLog({
    ...attempt,
    at: new Date().toISOString(),
    result: result.ok ? 'ok' : result.saved ? 'unknown' : 'failed',
    message: result.ok ? '' : result.error,
  });
  if (result.ok) {
    cell.replaceChildren(el('span', 'Written and checked', 'ok'));
  } else {
    const hint = result.saved ? ' Check this day in HRworks.' : '';
    cell.replaceChildren(el('span', `${result.error}${hint}`, 'error'));
  }
  writing = false;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button.write')) {
    button.disabled = false;
  }
}

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
    const planned = planDays(rows, hrworks, settings.conflictMode);
    renderRows(rows, planned);
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
