// Shows the punchline preview on top of the HRworks page. The preview is the extension's own
// page in an iframe: HRworks' scripts can't read into it, so Harvest data stays out of their
// reach. The frame sits in a closed shadow root so HRworks' styles can't reach it either.

const HOST_ID = 'punchline-overlay';

const STYLE = `
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(560px, 100vw);
    height: 100vh;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    background: #fff;
    box-shadow: -4px 0 16px rgb(0 0 0 / 0.25);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    font: 13px system-ui, sans-serif;
    background: #5b4fd6;
    color: #fff;
  }
  button {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
  }
  iframe {
    flex: 1;
    border: 0;
    width: 100%;
  }
`;

/** Opens the overlay, or closes it when it is already open. Returns whether it is open now. */
export function toggleOverlay(doc: Document, src: string): boolean {
  const existing = doc.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return false;
  }
  const host = doc.createElement('div');
  host.id = HOST_ID;
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
