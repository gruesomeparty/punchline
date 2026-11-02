// Content script in HRworks tabs. Shows punchline's bar and badges on the Arbeitszeiten page, and
// reads or writes days when the punchline pages ask for it, one request at a time.

import { errorDetail, errorMessage } from './errors.ts';
import { mountInline } from './inline.ts';
import {
  type DebugLogResponse,
  type HarvestRowsRequest,
  type HarvestRowsResponse,
  isDebugLogRequest,
  isReadDaysRequest,
  isWriteDaysRequest,
  type ReadDaysResponse,
  type WriteDaysResponse,
} from './messages.ts';
import { readHrworksDays } from './page.ts';
import { aboutLine, createTrace, type Trace } from './trace.ts';
import { writeDays } from './write.ts';

let busy = false;
/** Steps of the latest read or write, kept in memory for the debug log. */
let trace: Trace = createTrace();

const BUSY = 'punchline is already working in this HRworks tab.';

/** The debug log as people copy it, so a pasted log says which version it came from. */
function report(): string[] {
  return [aboutLine(chrome.runtime.getManifest().version, navigator.userAgent), ...trace.lines()];
}

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

// The bar and badges in HRworks. They stay for the life of the tab and wait for the
// Arbeitszeiten page to show up.
mountInline(document, {
  log: (line) => trace.log(line),
  report: () => report().join('\n'),
  exclusive,
  loadRows: async (from, to) => {
    const request: HarvestRowsRequest = { type: 'punchline/harvest-rows', from, to };
    return (await chrome.runtime.sendMessage(request)) as HarvestRowsResponse;
  },
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  if (isDebugLogRequest(message)) {
    const response: DebugLogResponse = { lines: report() };
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
      .catch((error: unknown) => {
        trace.log(`error: ${errorDetail(error)}`);
        respond({ ok: false, error: errorMessage(error, 'Unexpected error reading HRworks.') });
      })
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
