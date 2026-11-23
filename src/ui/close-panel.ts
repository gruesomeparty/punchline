// Brave and some other Chromium browsers host extension side panels in their own sidebar, which
// has no close button. So a page that can run as the side panel offers its own. In a normal tab
// the tab's own close button is enough, and the button stays hidden.

type PanelApi = {
  tabs: { getCurrent(): Promise<chrome.tabs.Tab | undefined> };
  windows: { getCurrent(): Promise<chrome.windows.Window> };
  sidePanel: { close?: (options: { windowId: number }) => Promise<void> };
};

/** Shows `button` when the page runs as the side panel, and closes the panel on click. */
export async function offerPanelClose(
  button: HTMLButtonElement,
  api: PanelApi = chrome,
  closeWindow: () => void = () => window.close(),
): Promise<void> {
  // Only a page in a tab has a current tab.
  if (await api.tabs.getCurrent()) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      const { id } = await api.windows.getCurrent();
      // sidePanel.close is fairly new, so older browsers fall back to closing the page.
      if (api.sidePanel.close && id !== undefined) {
        await api.sidePanel.close({ windowId: id });
        return;
      }
    } catch {
      // Fall through: closing the page closes the side panel too.
    }
    closeWindow();
  });
}
