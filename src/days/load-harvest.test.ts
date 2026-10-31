import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../settings/settings.ts';
import { freshCredentials } from './load-harvest.ts';

const DAY = 24 * 60 * 60 * 1000;
const oauth: Settings = {
  ...DEFAULT_SETTINGS,
  harvestToken: 'old',
  harvestAccountId: '42',
  harvestLogin: 'oauth',
  harvestTokenExpiresAt: 10 * DAY,
};

function deps(now: number, login: () => Promise<unknown>) {
  return { now, login: vi.fn(login), save: vi.fn(async () => {}) } as unknown as Parameters<
    typeof freshCredentials
  >[1] & { login: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
}

describe('freshCredentials', () => {
  it('leaves personal access tokens and fresh logins alone', async () => {
    const d = deps(9.9 * DAY, async () => ({}));
    const token = { ...oauth, harvestLogin: 'token' as const };
    expect(await freshCredentials(token, d)).toBe(token);
    const early = deps(DAY, async () => ({}));
    expect(await freshCredentials(oauth, early)).toBe(oauth);
    expect(d.login).not.toHaveBeenCalled();
    expect(early.login).not.toHaveBeenCalled();
  });

  it('renews silently and saves the new token near expiry', async () => {
    const d = deps(9.5 * DAY, async () => ({
      token: 'new',
      accountIds: ['42'],
      expiresAt: 24 * DAY,
    }));
    const renewed = await freshCredentials(oauth, d);
    expect(d.login).toHaveBeenCalledWith(false);
    expect(renewed.harvestToken).toBe('new');
    expect(renewed.harvestTokenExpiresAt).toBe(24 * DAY);
    expect(d.save).toHaveBeenCalledWith(renewed);
  });

  it('keeps a still valid token when the silent login fails', async () => {
    const d = deps(9.5 * DAY, async () => {
      throw new Error('signed out');
    });
    expect(await freshCredentials(oauth, d)).toBe(oauth);
    expect(d.save).not.toHaveBeenCalled();
  });

  it('asks to log in again once the token has expired', async () => {
    const d = deps(11 * DAY, async () => {
      throw new Error('signed out');
    });
    await expect(freshCredentials(oauth, d)).rejects.toThrow(/Log in again/);
  });
});
