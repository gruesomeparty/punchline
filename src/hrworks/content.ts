// Content script in HRworks tabs. Waits for the punchline pages to ask for HRworks days.

import { isReadDaysRequest, type ReadDaysResponse } from './messages.ts';
import { HrworksReadError, readHrworksDays } from './page.ts';

let busy = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isReadDaysRequest(message)) return false;
  const respond = (response: ReadDaysResponse) => sendResponse(response);
  if (busy) {
    respond({ ok: false, error: 'punchline is already reading this HRworks tab.' });
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
});
