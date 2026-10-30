// Every write punchline attempts in HRworks, kept in chrome.storage.local. It is what stops a
// day from being written twice, and it keeps the old HRworks times before an override.

import type { HrworksEntry } from './plan.ts';

export type WriteLogEntry = {
  /** ISO timestamp of the attempt. */
  at: string;
  date: string;
  action: 'create' | 'override';
  start: string;
  end: string;
  /** What HRworks had before, for overrides. */
  previous: HrworksEntry[];
  /** "unknown" means Speichern was clicked but the result couldn't be checked. */
  result: 'ok' | 'failed' | 'unknown';
  message: string;
};

const KEY = 'writeLog';

function isEntry(value: unknown): value is WriteLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.date === 'string' && typeof v.result === 'string';
}

/**
 * A day counts as written once a save went through, or might have. Only the latest entry for a
 * day counts, because each attempt is logged once before it starts and again with its result.
 */
export function wasWritten(log: readonly WriteLogEntry[], date: string): WriteLogEntry | null {
  const latest = log.findLast((entry) => entry.date === date);
  return latest && latest.result !== 'failed' ? latest : null;
}

export async function loadWriteLog(): Promise<WriteLogEntry[]> {
  const stored = (await chrome.storage.local.get(KEY))[KEY];
  return Array.isArray(stored) ? stored.filter(isEntry) : [];
}

export async function appendWriteLog(entry: WriteLogEntry): Promise<void> {
  const log = await loadWriteLog();
  await chrome.storage.local.set({ [KEY]: [...log, entry] });
}
