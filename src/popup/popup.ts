// Popup entry point. The popup closes on blur, so real work happens in HRworks itself, the
// side panel, or a full extension tab.

import { HRWORKS_URLS, type InlineCheckRequest, pickHrworksTab } from '../hrworks/messages.ts';
import { loadSettings, type PreviewMode } from '../settings/settings.ts';
import { byId } from '../ui/dom.ts';
import { followThemeSetting } from '../ui/theme.ts';

followThemeSetting();

const status = byId('popup-status');

// sidePanel.open only works during the click itself, so everything it needs is looked up
// beforehand.
let windowId: number | undefined;
let previewMode: PreviewMode = 'inline';
void chrome.windows.getCurrent().then((win) => {
  windowId = win.id;
});
void loadSettings().then((settings) => {
  previewMode = settings.previewMode;
});

/** Asks the HRworks tab to check its badges, and brings the tab forward. */
async function checkInHrworks(): Promise<boolean> {
  const tab = pickHrworksTab(await chrome.tabs.query({ url: HRWORKS_URLS }));
  if (tab?.id === undefined) {
    status.textContent = 'Open HRworks Arbeitszeiten first.';
    return false;
  }
  const request: InlineCheckRequest = { type: 'punchline/inline-check' };
  try {
    await chrome.tabs.sendMessage(tab.id, request);
  } catch {
    status.textContent = 'Reload the HRworks tab and try again.';
    return false;
  }
  await chrome.tabs.update(tab.id, { active: true });
  return true;
}

byId('open-days').addEventListener('click', async () => {
  if (previewMode === 'inline') {
    if (await checkInHrworks()) window.close();
    return;
  }
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
