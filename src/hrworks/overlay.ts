// Shows the punchline preview on top of the HRworks page. The preview is the extension's own
// page in an iframe: HRworks' scripts can't read into it, so Harvest data stays out of their
// reach. The frame sits in a closed shadow root so HRworks' styles can't reach it either.

const HOST_ID = 'punchline-overlay';

// Matches the preview's own look (page.css), so the frame and its page read as one panel.
const DARK = `
    --bg: #1e1e1e;
    --fg: #f5f5f7;
    --muted: #a1a1a6;
    --line: #3a3a3c;
    --hover: rgb(255 255 255 / 0.08);
`;

const STYLE = `
  :host {
    --bg: #f5f5f7;
    --fg: #1d1d1f;
    --muted: #6e6e73;
    --line: #e3e3e8;
    --hover: rgb(0 0 0 / 0.06);
  }
  @media (prefers-color-scheme: dark) {
    :host(:not([data-theme="light"])) {${DARK}}
  }
  :host([data-theme="dark"]) {${DARK}}
  .panel {
    position: fixed;
    top: 8px;
    right: 8px;
    bottom: 8px;
    width: min(420px, calc(100vw - 16px));
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--bg);
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px 6px 14px;
    font: 600 13px system-ui, -apple-system, sans-serif;
    color: var(--fg);
    border-bottom: 1px solid var(--line);
  }
  button {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  button:hover {
    background: var(--hover);
  }
  iframe {
    flex: 1;
    border: 0;
    width: 100%;
    background: transparent;
  }
`;

/**
 * Opens the overlay, or closes it when it is already open. Returns whether it is open now.
 * `theme` matches the frame's bar to the theme chosen in Settings.
 */
export function toggleOverlay(
  doc: Document,
  src: string,
  theme: 'system' | 'light' | 'dark' = 'system',
): boolean {
  const existing = doc.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return false;
  }
  const host = doc.createElement('div');
  host.id = HOST_ID;
  if (theme !== 'system') host.dataset.theme = theme;
  const root = host.attachShadow({ mode: 'closed' });

  const style = doc.createElement('style');
  style.textContent = STYLE;
  const panel = doc.createElement('div');
  panel.className = 'panel';
  const bar = doc.createElement('div');
  bar.className = 'bar';
  const title = doc.createElement('span');
  title.textContent = 'punchline';
  const close = doc.createElement('button');
  close.type = 'button';
  close.title = 'Close';
  close.textContent = '×';
  close.addEventListener('click', () => host.remove());
  bar.append(title, close);
  const frame = doc.createElement('iframe');
  frame.src = src;
  frame.title = 'punchline preview';
  panel.append(bar, frame);
  root.append(style, panel);
  doc.body.append(host);
  return true;
}
