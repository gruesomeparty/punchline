// Content script in HRworks tabs. Reads or writes days when the punchline pages ask for it,
// one request at a time.

import { loadSettings } from '../settings/settings.ts';
import { type Inline, mountInline } from './inline.ts';
import {
  type DebugLogResponse,
  type HarvestRowsRequest,
  type HarvestRowsResponse,
  isDebugLogRequest,
  isInlineCheckRequest,
  isReadDaysRequest,
  isWriteDaysRequest,
  type ReadDaysResponse,
  type WriteDaysResponse,
} from './messages.ts';
import { HrworksReadError, readHrworksDays } from './page.ts';
import { createTrace, type Trace } from './trace.ts';
import { writeDays } from './write.ts';

let busy = false;
/** Steps of the latest read or write, kept in memory for the debug log. */
let trace: Trace = createTrace();

const BUSY = 'punchline is already working in this HRworks tab.';

/** Runs `task` unless a read or write is already going on in this tab. */
async function exclusive(task: () => Promise<void>): Promise<boolean> {
  if (busy) return false;
  busy = true;
  trace = createTrace();
  try {
    await task();
  } finally {
    busy = false;
  }
  return true;
}

// The badges in HRworks, while the preview mode in Settings is "In HRworks".
let inline: Inline | null = null;

function startInline(): Inline {
  inline ??= mountInline(document, {
    log: (line) => trace.log(line),
    exclusive,
    loadRows: async (from, to) => {
      const request: HarvestRowsRequest = { type: 'punchline/harvest-rows', from, to };
      return (await chrome.runtime.sendMessage(request)) as HarvestRowsResponse;
    },
  });
  return inline;
}

async function syncInline(): Promise<void> {
  const { previewMode } = await loadSettings();
  if (previewMode === 'inline') {
    startInline();
  } else {
    inline?.unmount();
    inline = null;
  }
}

void syncInline();
chrome.storage.onChanged.addListener(() => void syncInline());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  if (isInlineCheckRequest(message)) {
    sendResponse({ ok: true });
    void startInline().check();
    return false;
  }

  if (isDebugLogRequest(message)) {
    const response: DebugLogResponse = { lines: trace.lines() };
    sendResponse(response);
    return false;
  }

  if (isReadDaysRequest(message)) {
    const respond = (response: ReadDaysResponse) => sendResponse(response);
    if (busy) {
      respond({ ok: false, error: BUSY });
      return false;
    }
    busy = true;
    trace = createTrace();
    trace.log(`read ${message.from} to ${message.to}`);
    readHrworksDays(document, message.from, message.to, { log: trace.log })
      .then((days) => respond({ ok: true, days }))
      .catch((error: unknown) =>
        respond({
          ok: false,
          error:
            error instanceof HrworksReadError ? error.message : 'Unexpected error reading HRworks.',
        }),
      )
      .finally(() => {
        busy = false;
      });
    // Keeps the channel open for the async response.
    return true;
  }

  if (isWriteDaysRequest(message)) {
    const respond = (response: WriteDaysResponse) => sendResponse(response);
    if (busy) {
      respond(message.days.map(() => ({ ok: false, error: BUSY, saved: false })));
      return false;
    }
    busy = true;
    trace = createTrace();
    // writeDays never throws, it reports failures in its results.
    writeDays(document, message.days, { log: trace.log })
      .then((results) => {
        trace.log(`results: ${JSON.stringify(results.map((r) => (r.ok ? 'ok' : r.error)))}`);
        respond(results);
      })
      .finally(() => {
        busy = false;
      });
    return true;
  }

  return false;
});
