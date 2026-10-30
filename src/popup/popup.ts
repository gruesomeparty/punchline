// Popup entry point. The popup closes on blur, so real work happens in full extension tabs.

import { byId } from '../ui/dom.ts';

byId('open-days').addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('days/days.html') });
  window.close();
});

byId('open-settings').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});
