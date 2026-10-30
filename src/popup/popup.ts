// Popup entry point. The popup closes on blur, so real work happens in the side panel, the
// overlay on HRworks, or a full extension tab.

import { HRWORKS_URLS, pickHrworksTab, type ToggleOverlayRequest } from '../hrworks/messages.ts';
import { loadSettings, type PreviewMode } from '../settings/settings.ts';
import { byId } from '../ui/dom.ts';
import { followThemeSetting } from '../ui/theme.ts';

followThemeSetting();

const status = byId('popup-status');

// sidePanel.open only works during the click itself, so everything it needs is looked up
// beforehand.
let windowId: number | undefined;
let previewMode: PreviewMode = 'sidePanel';
void chrome.windows.getCurrent().then((win) => {
  windowId = win.id;
});
void loadSettings().then((settings) => {
  previewMode = settings.previewMode;
});

async function openOverlay(): Promise<boolean> {
  const tab = pickHrworksTab(await chrome.tabs.query({ url: HRWORKS_URLS }));
  if (tab?.id === undefined) {
    status.textContent = 'Open HRworks Arbeitszeiten first.';
    return false;
  }
  const request: ToggleOverlayRequest = { type: 'punchline/toggle-overlay' };
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
  if (previewMode === 'overlay') {
    if (await openOverlay()) window.close();
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
