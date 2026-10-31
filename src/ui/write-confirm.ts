// The confirm before writing, shared by the preview page and the badges in HRworks.

import { formatDuration } from '../lib/time.ts';
import type { WriteLogEntry } from '../plan/write-log.ts';
import { oldTimes, type WritableDay } from '../plan/write-runner.ts';
import { confirmDialog, selectDialog } from './confirm-dialog.ts';

const weekdays = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
/** "Mon 17" */
const shortDay = (date: string) => `${weekdays.format(utc(date))} ${Number(date.slice(8))}`;

/** Asks before writing. Resolves with the days the user chose, or none when cancelled. */
export async function confirmWrite(
  days: readonly WritableDay[],
  earlier: WriteLogEntry | null,
  { icon, container = document.body }: { icon?: string | Element; container?: ParentNode },
): Promise<WritableDay[]> {
  const [day] = days;
  if (days.length === 1 && day) {
    const { start, end } = day.times;
    const override = day.action === 'override';
    const shownDate = fullDate.format(utc(day.harvest.date));
    const ok = await confirmDialog(
      {
        title: override ? `Override ${shownDate} in HRworks?` : `Write ${shownDate} to HRworks?`,
        rows: [
          ...(override ? [{ label: 'Before', value: oldTimes(day), old: true }] : []),
          { label: override ? 'After' : 'Enter', value: `${start}–${end}` },
          { label: 'After breaks', value: `${formatDuration(day.harvest.netMinutes)} (Harvest)` },
        ],
        note:
          (earlier ? `punchline wrote this day on ${earlier.at.slice(0, 10)}. ` : '') +
          (override
            ? 'HRworks has no undo. punchline logs the old times before it saves. Extra open ' +
              'entries on this day are removed.'
            : 'punchline checks the day in HRworks after saving.'),
        confirmLabel: override ? 'Override' : 'Write',
        ...(icon ? { icon } : {}),
      },
      container,
    );
    return ok ? [day] : [];
  }
  const overrides = days.filter((d) => d.action === 'override').length;
  const chosen = await selectDialog(
    {
      title: `Write ${days.length} days to HRworks?`,
      rows: days.map((d) => ({
        label: shortDay(d.harvest.date),
        ...(d.action === 'override' ? { before: oldTimes(d) } : {}),
        after: `${d.times.start}–${d.times.end}`,
      })),
      note:
        'punchline saves once per HRworks week and checks every day after. It stops at the first ' +
        'problem; compare again to continue.' +
        (overrides > 0 ? ' Old times are logged before an override.' : ''),
      confirmLabel: 'Write',
      ...(icon ? { icon } : {}),
    },
    container,
  );
  return chosen?.flatMap((i) => days[i] ?? []) ?? [];
}
