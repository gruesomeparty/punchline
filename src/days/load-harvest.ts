// Loads Harvest hours for a range and turns them into day rows. Shared by the preview page and
// the background, which does it for the badges in HRworks so the token never enters that page.

import { fetchCurrentUser, fetchTimeEntries, HarvestError } from '../harvest/client.ts';
import { dailyTotals } from '../harvest/daily-totals.ts';
import { logInWithHarvest, needsRelogin, type OAuthLogin } from '../harvest/oauth.ts';
import type { HarvestRowsResponse } from '../hrworks/messages.ts';
import { localToday, parseTime } from '../lib/time.ts';
import { dailyMaxFor } from '../rules/work-time.ts';
import {
  applyLogin,
  loadSettings,
  type Settings,
  saveSettings,
  validateSettings,
} from '../settings/settings.ts';
import { type DayRow, harvestDays } from './harvest-days.ts';

type Relogin = {
  now: number;
  login: (interactive: boolean) => Promise<OAuthLogin>;
  save: (settings: Settings) => Promise<void>;
};

/**
 * Renews an OAuth token that is about to expire. Harvest's client-side flow has no refresh
 * token, so this is a silent login, which works while the user is still signed in to Harvest.
 */
export async function freshCredentials(
  settings: Settings,
  { now, login, save }: Relogin = { now: Date.now(), login: logInWithHarvest, save: saveSettings },
): Promise<Settings> {
  if (settings.harvestLogin !== 'oauth' || !needsRelogin(settings.harvestTokenExpiresAt, now)) {
    return settings;
  }
  let renewed: Settings;
  try {
    renewed = applyLogin(settings, await login(false));
  } catch {
    // An expired token would only fail later with a vaguer message.
    if (settings.harvestTokenExpiresAt <= now) {
      throw new HarvestError('Your Harvest login expired. Log in again in the punchline settings.');
    }
    return settings;
  }
  await save(renewed);
  return renewed;
}

export async function loadHarvestRows(
  current: Settings,
  from: string,
  to: string,
): Promise<DayRow[]> {
  const settings = await freshCredentials(current);
  const credentials = { token: settings.harvestToken, accountId: settings.harvestAccountId };
  const user = await fetchCurrentUser(credentials);
  const entries = await fetchTimeEntries(credentials, user.id, from, to);
  return harvestDays(from, to, dailyTotals(entries), {
    startMinutes: parseTime(settings.startTime) ?? 0,
    rules: settings.breakRules,
    today: localToday(),
    maxNetMinutes: dailyMaxFor(settings.breakPreset),
  });
}

/** Answers the badges in HRworks with the rows for a range. Errors are messages, never throws. */
export async function harvestRowsResponse(from: string, to: string): Promise<HarvestRowsResponse> {
  const settings = await loadSettings();
  if (validateSettings(settings).length > 0) {
    return { ok: false, error: 'Connect Harvest in the punchline settings first.' };
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
