// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { offerPanelClose } from './close-panel.ts';

function setup(options: { inTab?: boolean; withClose?: boolean; closeFails?: boolean } = {}) {
  const button = document.createElement('button');
  button.hidden = true;
  const close = vi.fn(async () => {
    if (options.closeFails) throw new Error('no panel');
  });
  const api = {
    tabs: { getCurrent: async () => (options.inTab ? ({ id: 1 } as chrome.tabs.Tab) : undefined) },
    windows: { getCurrent: async () => ({ id: 7 }) as chrome.windows.Window },
    sidePanel: options.withClose === false ? {} : { close },
  };
  const closeWindow = vi.fn();
  return { button, api, close, closeWindow };
}

describe('offerPanelClose', () => {
  it('stays hidden in a normal tab', async () => {
    const { button, api, closeWindow } = setup({ inTab: true });
    await offerPanelClose(button, api, closeWindow);
    expect(button.hidden).toBe(true);
  });

  it('closes the side panel of the current window', async () => {
    const { button, api, close, closeWindow } = setup();
    await offerPanelClose(button, api, closeWindow);
    expect(button.hidden).toBe(false);
    button.click();
    await vi.waitFor(() => expect(close).toHaveBeenCalledWith({ windowId: 7 }));
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('closes the page where the browser has no sidePanel.close', async () => {
    const { button, api, closeWindow } = setup({ withClose: false });
    await offerPanelClose(button, api, closeWindow);
    button.click();
    await vi.waitFor(() => expect(closeWindow).toHaveBeenCalled());
  });

  it('closes the page when sidePanel.close fails', async () => {
    const { button, api, closeWindow } = setup({ closeFails: true });
    await offerPanelClose(button, api, closeWindow);
    button.click();
    await vi.waitFor(() => expect(closeWindow).toHaveBeenCalled());
  });
});
