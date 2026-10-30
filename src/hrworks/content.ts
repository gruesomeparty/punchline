// Content script in HRworks tabs. Reads or writes days when the punchline pages ask for it,
// one request at a time.

import {
  type DebugLogResponse,
  isDebugLogRequest,
  isReadDaysRequest,
  isToggleOverlayRequest,
  isWriteDaysRequest,
  type ReadDaysResponse,
  type WriteDaysResponse,
} from './messages.ts';
import { toggleOverlay } from './overlay.ts';
import { HrworksReadError, readHrworksDays } from './page.ts';
import { createTrace, type Trace } from './trace.ts';
import { writeDays } from './write.ts';

let busy = false;
/** Steps of the latest read or write, kept in memory for the debug log. */
let trace: Trace = createTrace();

const BUSY = 'punchline is already working in this HRworks tab.';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  if (isToggleOverlayRequest(message)) {
    sendResponse({ open: toggleOverlay(document, chrome.runtime.getURL('days/days.html')) });
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
