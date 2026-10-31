// User settings, stored locally in chrome.storage.local. The Harvest token never leaves the
// extension except in requests to the Harvest API.

import type { OAuthLogin } from '../harvest/oauth.ts';
import { parseTime } from '../lib/time.ts';
import type { ConflictMode } from '../plan/plan.ts';
import {
  BREAK_PRESETS,
  type BreakPresetId,
  type BreakRule,
  validateRules,
} from '../rules/breaks.ts';

export type Settings = {
  /** Personal access token, or the token from "Log in with Harvest". */
  harvestToken: string;
  harvestAccountId: string;
  /** Where the token came from. OAuth tokens expire and are renewed by logging in again. */
  harvestLogin: HarvestLogin;
  /** When an OAuth token expires, in ms since the epoch. 0 for personal access tokens. */
  harvestTokenExpiresAt: number;
  /** Which preset the rules came from, or 'custom' once the user edits them. */
  breakPreset: BreakPresetId | 'custom';
  breakRules: BreakRule[];
  /** Start time entered in HRworks for every day, as `HH:MM`. */
  startTime: string;
  /** What to do when HRworks already has different hours: show them, or replace them. */
  conflictMode: ConflictMode;
  /** Write Harvest hours on days without a work plan in HRworks, such as weekends. */
  weekendHours: boolean;
  /** Shows the HRworks steps of the latest run in the preview, for troubleshooting. */
  debugLog: boolean;
  /** Light, dark, or whatever the system uses. */
  theme: Theme;
};

export type Theme = 'system' | 'light' | 'dark';

export type HarvestLogin = 'token' | 'oauth';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  harvestToken: '',
  harvestAccountId: '',
  harvestLogin: 'token',
  harvestTokenExpiresAt: 0,
  breakPreset: 'ch',
  breakRules: BREAK_PRESETS.ch.rules,
  startTime: '08:00',
  conflictMode: 'flag',
  weekendHours: false,
  debugLog: false,
  theme: 'system',
};

function isRule(value: unknown): value is BreakRule {
  if (typeof value !== 'object' || value === null) return false;
  const rule = value as Record<string, unknown>;
  return typeof rule.afterMinutes === 'number' && typeof rule.breakMinutes === 'number';
}

/** Reads whatever is in storage into valid settings, falling back to defaults field by field. */
export function normalizeSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const text = (key: string, fallback: string) =>
    typeof stored[key] === 'string' ? stored[key] : fallback;

  const preset = stored.breakPreset;
  const breakPreset =
    preset === 'custom' || (typeof preset === 'string' && preset in BREAK_PRESETS)
      ? (preset as Settings['breakPreset'])
      : DEFAULT_SETTINGS.breakPreset;
  const rules =
    Array.isArray(stored.breakRules) && stored.breakRules.every(isRule) ? stored.breakRules : null;
  const startTime = text('startTime', DEFAULT_SETTINGS.startTime);

  return {
    harvestToken: text('harvestToken', '').trim(),
    harvestAccountId: text('harvestAccountId', '').trim(),
    harvestLogin: stored.harvestLogin === 'oauth' ? 'oauth' : 'token',
    harvestTokenExpiresAt:
      typeof stored.harvestTokenExpiresAt === 'number' && stored.harvestTokenExpiresAt > 0
        ? stored.harvestTokenExpiresAt
        : 0,
    breakPreset,
    breakRules:
      rules && validateRules(rules).length === 0
        ? rules
        : breakPreset === 'custom'
          ? DEFAULT_SETTINGS.breakRules
          : BREAK_PRESETS[breakPreset].rules,
    startTime: parseTime(startTime) === null ? DEFAULT_SETTINGS.startTime : startTime,
    conflictMode: stored.conflictMode === 'override' ? 'override' : 'flag',
    weekendHours: stored.weekendHours === true,
    debugLog: stored.debugLog === true,
    theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'system',
  };
}

/** Problems that stop the settings from being saved. */
export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];
  if (!settings.harvestToken) {
    errors.push(
      settings.harvestLogin === 'oauth'
        ? 'Log in with Harvest again.'
        : 'Enter your Harvest personal access token.',
    );
  }
  if (!/^\d+$/.test(settings.harvestAccountId)) {
    errors.push('The Harvest account ID is a number.');
  }
  if (parseTime(settings.startTime) === null) errors.push('Enter the start time as HH:MM.');
  errors.push(...validateRules(settings.breakRules));
  return errors;
}

/**
 * Takes over a Harvest login. Keeps the chosen account when the login covers it, so someone with
 * several Harvest accounts doesn't get switched on every renewal.
 */
export function applyLogin(settings: Settings, login: OAuthLogin): Settings {
  const keep =
    login.accountIds.includes(settings.harvestAccountId) || login.accountIds.length === 0;
  return {
    ...settings,
    harvestToken: login.token,
    harvestAccountId: keep ? settings.harvestAccountId : (login.accountIds[0] as string),
    harvestLogin: 'oauth',
    harvestTokenExpiresAt: login.expiresAt,
  };
}

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return normalizeSettings(stored[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
