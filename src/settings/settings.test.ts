import { afterEach, describe, expect, it, vi } from 'vitest';
import { BREAK_PRESETS } from '../rules/breaks.ts';
import {
  applyLogin,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  validateSettings,
} from './settings.ts';

describe('normalizeSettings', () => {
  it('falls back to defaults for missing or broken storage', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ breakPreset: 'xx', startTime: '25:00' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and trims credentials', () => {
    const settings = normalizeSettings({
      harvestToken: ' abc ',
      harvestAccountId: ' 42 ',
      harvestLogin: 'oauth',
      harvestTokenExpiresAt: 1_000,
      breakPreset: 'de',
      breakRules: BREAK_PRESETS.de.rules,
      startTime: '08:30',
      conflictMode: 'override',
      weekendHours: true,
      debugLog: true,
      theme: 'dark',
    });
    expect(settings).toEqual({
      harvestToken: 'abc',
      harvestAccountId: '42',
      harvestLogin: 'oauth',
      harvestTokenExpiresAt: 1_000,
      breakPreset: 'de',
      breakRules: BREAK_PRESETS.de.rules,
      startTime: '08:30',
      conflictMode: 'override',
      weekendHours: true,
      debugLog: true,
      theme: 'dark',
    });
  });

  it('replaces invalid rules with the preset rules', () => {
    const settings = normalizeSettings({ breakPreset: 'de', breakRules: [{ afterMinutes: -5 }] });
    expect(settings.breakRules).toEqual(BREAK_PRESETS.de.rules);
    const custom = normalizeSettings({ breakPreset: 'custom', breakRules: 'x' });
    expect(custom.breakRules).toEqual(DEFAULT_SETTINGS.breakRules);
  });
});

describe('validateSettings', () => {
  it('requires credentials', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toHaveLength(2);
  });

  it('accepts complete settings', () => {
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, harvestToken: 'abc', harvestAccountId: '42' }),
    ).toEqual([]);
  });

  it('rejects a bad start time and bad rules', () => {
    const errors = validateSettings({
      ...DEFAULT_SETTINGS,
      harvestToken: 'abc',
      harvestAccountId: '42',
      startTime: '7',
      breakRules: [{ afterMinutes: 1.5, breakMinutes: 0 }],
    });
    expect(errors).toHaveLength(2);
  });
});

describe('validateSettings for a Harvest login', () => {
  it('asks to log in again instead of asking for a token', () => {
    const errors = validateSettings({
      ...DEFAULT_SETTINGS,
      harvestLogin: 'oauth',
      harvestAccountId: '42',
    });
    expect(errors).toEqual(['Log in with Harvest again.']);
  });
});

describe('applyLogin', () => {
  const login = { token: 'new', accountIds: ['7', '42'], expiresAt: 5_000 };

  it('stores the token and keeps an account the login covers', () => {
    const settings = applyLogin({ ...DEFAULT_SETTINGS, harvestAccountId: '42' }, login);
    expect(settings).toMatchObject({
      harvestToken: 'new',
      harvestAccountId: '42',
      harvestLogin: 'oauth',
      harvestTokenExpiresAt: 5_000,
    });
  });

  it('switches to the first granted account otherwise', () => {
    expect(applyLogin(DEFAULT_SETTINGS, login).harvestAccountId).toBe('7');
  });

  it('keeps the entered account when the login names none', () => {
    const settings = { ...DEFAULT_SETTINGS, harvestAccountId: '42' };
    expect(applyLogin(settings, { ...login, accountIds: [] }).harvestAccountId).toBe('42');
  });
});

describe('storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips settings through chrome.storage.local', async () => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (items: Record<string, unknown>) => Object.assign(store, items),
        },
      },
    });
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    const settings = { ...DEFAULT_SETTINGS, harvestToken: 'abc', harvestAccountId: '42' };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
  });
});
