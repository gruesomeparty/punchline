// Content script in HRworks tabs. Reads or writes days when the punchline pages ask for it,
// one request at a time.

import {
  isReadDaysRequest,
  isWriteDayRequest,
  type ReadDaysResponse,
  type WriteDayResponse,
} from './messages.ts';
import { HrworksReadError, readHrworksDays } from './page.ts';
import { writeDay } from './write.ts';

let busy = false;

const BUSY = 'punchline is already working in this HRworks tab.';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  if (isReadDaysRequest(message)) {
    const respond = (response: ReadDaysResponse) => sendResponse(response);
    if (busy) {
      respond({ ok: false, error: BUSY });
      return false;
    }
    busy = true;
    readHrworksDays(document, message.from, message.to)
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

  if (isWriteDayRequest(message)) {
    const respond = (response: WriteDayResponse) => sendResponse(response);
    if (busy) {
      respond({ ok: false, error: BUSY, saved: false });
      return false;
    }
    busy = true;
    // writeDay never throws, it reports failures in its result.
    writeDay(document, message.day)
      .then(respond)
      .finally(() => {
        busy = false;
      });
    return true;
  }

  return false;
});
