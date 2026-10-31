// Loads Harvest hours for a range and turns them into day rows. Shared by the preview page and
// the background, which does it for the badges in HRworks so the token never enters that page.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import type { HarvestRowsResponse } from '../hrworks/messages.ts';
import { localToday, parseTime } from '../lib/time.ts';
import { loadSettings, type Settings, validateSettings } from '../settings/settings.ts';
import { type DayRow, harvestDays } from './harvest-days.ts';

export async function loadHarvestRows(
  settings: Settings,
  from: string,
  to: string,
): Promise<DayRow[]> {
  const credentials = { token: settings.harvestToken, accountId: settings.harvestAccountId };
  const user = await fetchCurrentUser(credentials);
  const entries = await fetchTimeEntries(credentials, user.id, from, to);
  return harvestDays(from, to, dailyTotals(entries), {
    startMinutes: parseTime(settings.startTime) ?? 0,
    rules: settings.breakRules,
    today: localToday(),
  });
}

/** Answers the badges in HRworks with the rows for a range. Errors are messages, never throws. */
export async function harvestRowsResponse(from: string, to: string): Promise<HarvestRowsResponse> {
  const settings = await loadSettings();
  if (validateSettings(settings).length > 0) {
    return { ok: false, error: 'Set up your Harvest token in the punchline settings first.' };
  }
  try {
    const rows = await loadHarvestRows(settings, from, to);
    return { ok: true, rows, mode: settings.conflictMode, weekendHours: settings.weekendHours };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof HarvestError ? error.message : 'Unexpected error loading Harvest.',
    };
  }
}
