// Settings page. All checks live in settings.ts, this file only moves values in and out of the form.

import { fetchCurrentUser, HarvestError } from '../harvest/client.ts';
import { HARVEST_CLIENT_ID, logInWithHarvest, OAuthError } from '../harvest/oauth.ts';
import { BREAK_PRESETS, type BreakRule } from '../rules/breaks.ts';
import {
  applyLogin,
  type HarvestLogin,
  loadSettings,
  type Settings,
  saveSettings,
  validateSettings,
} from '../settings/settings.ts';
import { byId, el } from '../ui/dom.ts';
import { applyTheme } from '../ui/theme.ts';

const form = byId<HTMLFormElement>('settings');
const token = byId<HTMLInputElement>('token');
const account = byId<HTMLInputElement>('account');
const start = byId<HTMLInputElement>('start');
const preset = byId<HTMLSelectElement>('preset');
const rulesBody = byId<HTMLTableElement>('rules').tBodies[0] as HTMLTableSectionElement;
const conflict = form.elements.namedItem('conflict') as RadioNodeList;
const theme = form.elements.namedItem('theme') as RadioNodeList;
const reveal = byId<HTMLButtonElement>('reveal');
const weekend = byId<HTMLInputElement>('weekend');
const debugLog = byId<HTMLInputElement>('debug-log');
const status = byId<HTMLDivElement>('status');
const testResult = byId<HTMLSpanElement>('test-result');
const oauthRow = byId<HTMLDivElement>('oauth-row');
const oauthStatus = byId<HTMLParagraphElement>('oauth-status');
const tokenHint = byId<HTMLParagraphElement>('token-hint');

// Where the token in the form came from. Typing a token by hand turns it back into 'token'.
let login: { kind: HarvestLogin; expiresAt: number } = { kind: 'token', expiresAt: 0 };

function showStatus(target: HTMLElement, text: string, kind: 'ok' | 'error' | '' = ''): void {
  target.textContent = text;
  target.className = `status ${kind}`;
}

function renderRules(rules: readonly BreakRule[]): void {
  rulesBody.replaceChildren(
    ...rules.map((rule) => {
      const row = el('tr');
      const after = el('input');
      after.type = 'number';
      after.min = '0';
      after.step = '0.25';
      after.value = String(rule.afterMinutes / 60);
      after.setAttribute('aria-label', 'More than (hours)');
      const pause = el('input');
      pause.type = 'number';
      pause.min = '0';
      pause.step = '1';
      pause.value = String(rule.breakMinutes);
      pause.setAttribute('aria-label', 'Break (minutes)');
      const remove = el('button', 'Remove', 'secondary');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        row.remove();
        preset.value = 'custom';
      });
      const cells = [after, pause, remove].map((child) => {
        const cell = el('td');
        cell.append(child);
        return cell;
      });
      row.append(...cells);
      return row;
    }),
  );
}

function readRules(): BreakRule[] {
  return [...rulesBody.rows].map((row) => {
    const [after, pause] = row.querySelectorAll('input');
    return {
      afterMinutes: Math.round(Number(after?.value) * 60),
      breakMinutes: Number(pause?.value),
    };
  });
}

function readForm(): Settings {
  return {
    harvestToken: token.value.trim(),
    harvestAccountId: account.value.trim(),
    harvestLogin: login.kind,
    harvestTokenExpiresAt: login.expiresAt,
    breakPreset: preset.value as Settings['breakPreset'],
    breakRules: readRules(),
    startTime: start.value,
    conflictMode: conflict.value === 'override' ? 'override' : 'flag',
    weekendHours: weekend.checked,
    debugLog: debugLog.checked,
    theme: theme.value === 'light' || theme.value === 'dark' ? theme.value : 'system',
  };
}

function showLogin(): void {
  if (login.kind === 'oauth') {
    const until = new Date(login.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
    showStatus(
      oauthStatus,
      `Logged in until ${until}. Renews on its own while you stay signed in to Harvest.`,
      'ok',
    );
    tokenHint.textContent = 'Filled in by the Harvest login.';
  } else {
    tokenHint.textContent = HARVEST_CLIENT_ID
      ? 'Instead of logging in. Stored only in this browser.'
      : 'Stored only in this browser.';
  }
}

function fillForm(settings: Settings): void {
  login = { kind: settings.harvestLogin, expiresAt: settings.harvestTokenExpiresAt };
  showLogin();
  token.value = settings.harvestToken;
  account.value = settings.harvestAccountId;
  start.value = settings.startTime;
  conflict.value = settings.conflictMode;
  weekend.checked = settings.weekendHours;
  debugLog.checked = settings.debugLog;
  theme.value = settings.theme;
  applyTheme(settings.theme);
  preset.value = settings.breakPreset;
  renderRules(settings.breakRules);
}

// Without a registered OAuth app there is nothing to log in to.
oauthRow.hidden = !HARVEST_CLIENT_ID;

byId('oauth-login').addEventListener('click', async () => {
  showStatus(oauthStatus, 'Waiting for Harvest…');
  let settings: Settings;
  try {
    settings = applyLogin(readForm(), await logInWithHarvest(true));
  } catch (error) {
    showStatus(
      oauthStatus,
      error instanceof OAuthError ? error.message : 'Unexpected error.',
      'error',
    );
    return;
  }
  fillForm(settings);
  // Saved right away, so the login isn't lost by forgetting Save. Other unsaved edits go along.
  const errors = validateSettings(settings);
  if (errors.length > 0) {
    showStatus(status, errors.join(' '), 'error');
    return;
  }
  await saveSettings(settings);
  showStatus(status, 'Saved.', 'ok');
});

token.addEventListener('input', () => {
  login = { kind: 'token', expiresAt: 0 };
  showLogin();
  showStatus(oauthStatus, 'Log in once. punchline renews it while you stay signed in to Harvest.');
});

reveal.addEventListener('click', () => {
  const show = token.type === 'password';
  token.type = show ? 'text' : 'password';
  reveal.textContent = show ? 'Hide' : 'Show';
  reveal.setAttribute('aria-pressed', String(show));
});

// Preview the theme right away. It's stored with the other settings on Save.
for (const input of form.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
  input.addEventListener('change', () => applyTheme(readForm().theme));
}

preset.addEventListener('change', () => {
  if (preset.value === 'ch' || preset.value === 'de')
    renderRules(BREAK_PRESETS[preset.value].rules);
});

rulesBody.addEventListener('input', () => {
  preset.value = 'custom';
});

byId('add-rule').addEventListener('click', () => {
  renderRules([...readRules(), { afterMinutes: 0, breakMinutes: 0 }]);
  preset.value = 'custom';
  showStatus(status, 'Unsaved changes.');
});

byId('test').addEventListener('click', async () => {
  showStatus(testResult, 'Checking…');
  try {
    const user = await fetchCurrentUser({
      token: token.value.trim(),
      accountId: account.value.trim(),
    });
    showStatus(testResult, `Connected as ${user.firstName} ${user.lastName}.`, 'ok');
  } catch (error) {
    const message = error instanceof HarvestError ? error.message : 'Unexpected error.';
    showStatus(testResult, message, 'error');
  }
});

// "Saved." only holds until the next edit.
for (const type of ['input', 'change']) {
  form.addEventListener(type, () => showStatus(status, 'Unsaved changes.'));
}
// Removing or adding a rule changes the form without an input event.
byId('rules').addEventListener('click', (event) => {
  if ((event.target as Element).closest('button')) showStatus(status, 'Unsaved changes.');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = readForm();
  const errors = validateSettings(settings);
  if (errors.length > 0) {
    showStatus(status, errors.join(' '), 'error');
    return;
  }
  await saveSettings(settings);
  showStatus(status, 'Saved.', 'ok');
});

fillForm(await loadSettings());
