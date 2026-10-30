// User settings, stored locally in chrome.storage.local. The Harvest token never leaves the
// extension except in requests to the Harvest API.

import { parseTime } from '../lib/time.ts';
import type { ConflictMode } from '../plan/plan.ts';
import {
  BREAK_PRESETS,
  type BreakPresetId,
  type BreakRule,
  validateRules,
} from '../rules/breaks.ts';

export type Settings = {
  harvestToken: string;
  harvestAccountId: string;
  /** Which preset the rules came from, or 'custom' once the user edits them. */
  breakPreset: BreakPresetId | 'custom';
  breakRules: BreakRule[];
  /** Start time entered in HRworks for every day, as `HH:MM`. */
  startTime: string;
  /** What to do when HRworks already has different hours: show them, or replace them. */
  conflictMode: ConflictMode;
  /** Where "Open preview" shows the preview: Chrome's side panel or on top of HRworks. */
  previewMode: PreviewMode;
  /** Write Harvest hours on days without a work plan in HRworks, such as weekends. */
  weekendHours: boolean;
  /** Shows the HRworks steps of the latest run in the preview, for troubleshooting. */
  debugLog: boolean;
  /** Light, dark, or whatever the system uses. */
  theme: Theme;
};

export type PreviewMode = 'sidePanel' | 'overlay';

export type Theme = 'system' | 'light' | 'dark';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  harvestToken: '',
  harvestAccountId: '',
  breakPreset: 'ch',
  breakRules: BREAK_PRESETS.ch.rules,
  startTime: '08:00',
  conflictMode: 'flag',
  previewMode: 'sidePanel',
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
    breakPreset,
    breakRules:
      rules && validateRules(rules).length === 0
        ? rules
        : breakPreset === 'custom'
          ? DEFAULT_SETTINGS.breakRules
          : BREAK_PRESETS[breakPreset].rules,
    startTime: parseTime(startTime) === null ? DEFAULT_SETTINGS.startTime : startTime,
    conflictMode: stored.conflictMode === 'override' ? 'override' : 'flag',
    previewMode: stored.previewMode === 'overlay' ? 'overlay' : 'sidePanel',
    weekendHours: stored.weekendHours === true,
    debugLog: stored.debugLog === true,
    theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'system',
  };
}

/** Problems that stop the settings from being saved. */
export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];
  if (!settings.harvestToken) errors.push('Enter your Harvest personal access token.');
  if (!/^\d+$/.test(settings.harvestAccountId)) {
    errors.push('The Harvest account ID is a number.');
  }
  if (parseTime(settings.startTime) === null) errors.push('Enter the start time as HH:MM.');
  errors.push(...validateRules(settings.breakRules));
  return errors;
}

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return normalizeSettings(stored[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
