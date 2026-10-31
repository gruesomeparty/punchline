// Popup entry point. The popup closes on blur, so real work happens in the side panel or a
// full extension tab.

import { byId } from '../ui/dom.ts';
import { followThemeSetting } from '../ui/theme.ts';

followThemeSetting();

// sidePanel.open only works during the click itself, so the window is looked up beforehand.
let windowId: number | undefined;
void chrome.windows.getCurrent().then((win) => {
  windowId = win.id;
});

byId('open-days').addEventListener('click', async () => {
  if (windowId === undefined) return;
  await chrome.sidePanel.open({ windowId });
  window.close();
});

byId('open-tab').addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('days/days.html') });
  window.close();
});

byId('open-settings').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});
