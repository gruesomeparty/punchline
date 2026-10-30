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

export type WriteDayRequest = { type: 'punchline/write-day'; day: WriteDay };

export type WriteDayResponse = WriteResult;

export function isWriteDayRequest(message: unknown): message is WriteDayRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  if (m.type !== 'punchline/write-day' || typeof m.day !== 'object' || m.day === null) return false;
  const day = m.day as Record<string, unknown>;
  return (
    typeof day.date === 'string' &&
    typeof day.start === 'string' &&
    typeof day.end === 'string' &&
    typeof day.expectedMinutes === 'number'
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
