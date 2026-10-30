// Styles of the punchline bar and badges inside HRworks. Shape follows the host page (its font,
// text colour, small radii), the accent stays punchline's, so it's always clear what the
// extension added. HRworks can be light or dark; the hosts carry data-theme to match it.

export const INLINE_STYLE = `
  :host {
    all: initial;
    display: inline-block;
    font: inherit;
    color: inherit;
    --accent: #5b4fd6;
    --on-accent: #ffffff;
    --warn: #9a5b00;
    --error: #c42b1c;
    --ok: #1b7f3b;
    --muted: #6e6e73;
    --line: #d9d9de;
    --surface: #ffffff;
    --fg: #1d1d1f;
  }
  :host([data-theme="dark"]) {
    --accent: #a9a1ff;
    --on-accent: #1e1e1e;
    --warn: #f0b24a;
    --error: #ff6b5e;
    --ok: #5fd07c;
    --muted: #a1a1a6;
    --line: #4a4a50;
    --surface: #2a2a2e;
    --fg: #f5f5f7;
  }
  :host(punchline-bar) {
    display: block;
    margin: 8px 0;
  }
  button {
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 4px 0;
    font-size: 13px;
  }
  .mark {
    display: inline-flex;
  }
  .primary,
  .secondary {
    border-radius: 6px;
    padding: 3px 10px;
    border: 1px solid var(--accent);
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .secondary {
    background: transparent;
    color: var(--accent);
  }
  .summary,
  .status {
    color: var(--muted);
  }
  .status.error {
    color: var(--error);
  }
  .status.ok {
    color: var(--ok);
  }
  [hidden] {
    display: none;
  }
  .badge {
    display: inline-block;
    vertical-align: middle;
    margin-right: 12px;
    padding: 3px 10px;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .badge s {
    font-weight: normal;
    opacity: 0.7;
  }
  button.badge:hover {
    border-color: currentColor;
    background-image: linear-gradient(color-mix(in srgb, currentColor 8%, transparent) 0 0);
  }
  .create {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .override {
    color: var(--warn);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
  }
  .flag {
    color: var(--error);
    background: color-mix(in srgb, var(--error) 10%, transparent);
  }
  .match {
    color: var(--muted);
    background: none;
    border-color: transparent;
  }
  .result {
    font-weight: normal;
    white-space: normal;
    border-color: transparent;
  }
  .result.ok {
    color: var(--ok);
  }
  .result.error,
  .result.warn {
    color: var(--error);
  }
  .result.muted {
    color: var(--muted);
  }
  dialog.confirm {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--fg);
    padding: 16px;
    width: min(420px, calc(100vw - 32px));
    box-sizing: border-box;
    box-shadow: 0 12px 40px rgb(0 0 0 / 25%);
    font: 13px/1.45 system-ui, -apple-system, sans-serif;
  }
  dialog.confirm::backdrop {
    background: rgb(0 0 0 / 35%);
  }
  .confirm-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .confirm-head h2 {
    font-size: 15px;
    margin: 0;
  }
  dialog.confirm dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
    margin: 0 0 12px;
  }
  dialog.confirm dt {
    color: var(--muted);
  }
  dialog.confirm dd {
    margin: 0;
    font-weight: 600;
  }
  .old {
    text-decoration: line-through;
    color: var(--muted);
    font-weight: normal;
  }
  .hint,
  .selected-count,
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
  .changes {
    max-height: 50vh;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .changes label {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    align-items: center;
    padding: 6px 10px;
    cursor: pointer;
  }
  .changes label + label {
    border-top: 1px solid var(--line);
  }
  .change {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
  }
  .change-day {
    font-weight: 600;
    min-width: 4.5em;
  }
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
  .confirm-actions button {
    border-radius: 6px;
    padding: 4px 12px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }
  .confirm-actions button.secondary {
    background: transparent;
    color: var(--accent);
    border-color: var(--line);
  }
`;
