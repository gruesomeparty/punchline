// Days page: loads Harvest totals for a range and shows the HRworks times they need.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import { localToday, parseTime } from '../lib/time.ts';
import { loadSettings, validateSettings } from '../settings/settings.ts';
import { byId, el } from '../ui/dom.ts';
import { dayCells, defaultRange, rangeError } from './day-cells.ts';
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

function renderRows(rows: readonly DayRow[]): void {
  table.tBodies[0]?.replaceChildren(
    ...rows.map((row) => {
      const day = new Date(`${row.date}T00:00:00Z`);
      const cells = dayCells(row);
      const tr = el('tr', '', row.weekend ? 'muted' : '');
      tr.append(
        el('td', `${weekdays.format(day)}, ${fullDate.format(day)}`),
        el('td', cells.harvest),
        el('td', cells.start),
        el('td', cells.end),
        el('td', cells.break),
        el('td', cells.note, cells.noteKind),
      );
      return tr;
    }),
  );
  table.hidden = false;
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
    renderRows(rows);
    const ready = rows.filter((row) => row.status === 'times').length;
    showStatus(`${ready} of ${rows.length} days have hours to enter in HRworks.`, 'ok');
  } catch (error) {
    showStatus(error instanceof HarvestError ? error.message : 'Unexpected error.', 'error');
  } finally {
    submit.disabled = false;
  }
});

const range = defaultRange(localToday());
from.value = range.from;
to.value = range.to;
