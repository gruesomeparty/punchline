// Preview page: loads Harvest totals for a range, reads the same days from the HRworks tab and
// shows what punchline would do for each day. Read-only.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import {
  HRWORKS_URLS,
  pickHrworksTab,
  type ReadDaysRequest,
  type ReadDaysResponse,
} from '../hrworks/messages.ts';
import { localToday, parseTime } from '../lib/time.ts';
import { type HrworksDay, type PlannedDay, planDays } from '../plan/plan.ts';
import { countActions, previewCells } from '../plan/plan-cells.ts';
import { loadSettings, validateSettings } from '../settings/settings.ts';
import { byId, el } from '../ui/dom.ts';
import { defaultRange, rangeError } from './day-cells.ts';
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
        el('td', cells.break),
        el('td', cells.action, cells.actionKind),
        el('td', cells.note, cells.noteKind),
      );
      return tr;
    }),
  );
  table.hidden = false;
}

/** Reads the range from the HRworks tab. Returns an error message instead of throwing. */
async function readHrworks(from: string, to: string): Promise<HrworksDay[] | string> {
  const tab = pickHrworksTab(await chrome.tabs.query({ url: HRWORKS_URLS }));
  if (tab?.id === undefined) return 'Open HRworks Arbeitszeiten in a tab to compare.';
  const request: ReadDaysRequest = { type: 'punchline/read-days', from, to };
  try {
    const response = (await chrome.tabs.sendMessage(tab.id, request)) as ReadDaysResponse;
    return response.ok ? response.days : response.error;
  } catch {
    // The content script isn't there, usually because the tab was open before punchline was
    // installed or updated.
    return 'Reload the HRworks tab and try again.';
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
