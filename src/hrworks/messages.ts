// Messages between the extension pages and the content script in the HRworks tab.

import type { HrworksDay } from '../plan/plan.ts';
import type { WriteDay, WriteResult } from './write.ts';

export type ReadDaysRequest = { type: 'punchline/read-days'; from: string; to: string };

export type ReadDaysResponse = { ok: true; days: HrworksDay[] } | { ok: false; error: string };

export function isReadDaysRequest(message: unknown): message is ReadDaysRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return m.type === 'punchline/read-days' && typeof m.from === 'string' && typeof m.to === 'string';
}

/** Days of one HRworks week, written with a single Speichern. */
export type WriteDaysRequest = { type: 'punchline/write-days'; days: WriteDay[] };

/** One result per requested day, in the same order. */
export type WriteDaysResponse = WriteResult[];

function isWriteDay(value: unknown): value is WriteDay {
  if (typeof value !== 'object' || value === null) return false;
  const day = value as Record<string, unknown>;
  return (
    typeof day.date === 'string' &&
    typeof day.start === 'string' &&
    typeof day.end === 'string' &&
    typeof day.expectedMinutes === 'number'
  );
}

export function isWriteDaysRequest(message: unknown): message is WriteDaysRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return m.type === 'punchline/write-days' && Array.isArray(m.days) && m.days.every(isWriteDay);
}

/** Asks for the debug log of the latest read or write in the HRworks tab. */
export type DebugLogRequest = { type: 'punchline/debug-log' };

export type DebugLogResponse = { lines: string[] };

export function isDebugLogRequest(message: unknown): message is DebugLogRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === 'punchline/debug-log'
  );
}

export type ToggleOverlayRequest = { type: 'punchline/toggle-overlay' };

export function isToggleOverlayRequest(message: unknown): message is ToggleOverlayRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === 'punchline/toggle-overlay'
  );
}

/**
 * HRworks pages the content script runs on. HRworks is a single-page app that changes its URL
 * without reloading, so the script runs on every HRworks page and checks for itself whether
 * Arbeitszeiten is open. Must stay inside the manifest allowlist.
 */
export const HRWORKS_URLS = ['https://hrworks.de/*', 'https://*.hrworks.de/*'];

/** Picks the tab to read from: the one showing Arbeitszeiten if there is one, else the first. */
export function pickHrworksTab<T extends { url?: string | undefined }>(
  tabs: readonly T[],
): T | null {
  return tabs.find((tab) => tab.url?.includes('/working-times')) ?? tabs[0] ?? null;
}
