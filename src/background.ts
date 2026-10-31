// Service worker. Loads Harvest hours for the badges in HRworks, so the Harvest token stays in
// the extension and never reaches the HRworks page.

import { harvestRowsResponse } from './days/load-harvest.ts';
import { isHarvestRowsRequest } from './hrworks/messages.ts';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isHarvestRowsRequest(message)) return false;
  void harvestRowsResponse(message.from, message.to).then(sendResponse);
  // Keeps the channel open for the async response.
  return true;
});
