import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeUrl,
  logInWithHarvest,
  needsRelogin,
  OAuthError,
  parseRedirect,
} from './oauth.ts';

const REDIRECT = 'https://abcdefghijklmnop.chromiumapp.org/';

describe('authorizeUrl', () => {
  it('asks for a token with the client ID, redirect and state', () => {
    const url = new URL(authorizeUrl('client-1', REDIRECT, 'xyz'));
    expect(url.origin + url.pathname).toBe('https://id.getharvest.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      response_type: 'token',
      redirect_uri: REDIRECT,
      state: 'xyz',
    });
  });
});

describe('parseRedirect', () => {
  it('reads the token, Harvest accounts and expiry from the fragment', () => {
    const login = parseRedirect(
      `${REDIRECT}#access_token=tok&token_type=bearer&expires_in=1209600&scope=harvest%3A123+forecast%3A9+harvest%3A456&state=s`,
      's',
      1_000,
    );
    expect(login).toEqual({
      token: 'tok',
      accountIds: ['123', '456'],
      expiresAt: 1_000 + 1_209_600_000,
    });
  });

  it('assumes 14 days when Harvest sends no lifetime', () => {
    const login = parseRedirect(`${REDIRECT}#access_token=tok&state=s`, 's', 0);
    expect(login.expiresAt).toBe(14 * 24 * 60 * 60 * 1000);
    expect(login.accountIds).toEqual([]);
  });

  it('rejects an answer for another request', () => {
    expect(() => parseRedirect(`${REDIRECT}#access_token=tok&state=other`, 's', 0)).toThrow(
      /did not match/,
    );
  });

  it('explains a cancelled consent and other errors', () => {
    expect(() => parseRedirect(`${REDIRECT}?error=access_denied&state=s`, 's', 0)).toThrow(
      'The Harvest login was cancelled.',
    );
    expect(() => parseRedirect(`${REDIRECT}?error=server_error&state=s`, 's', 0)).toThrow(
      /server_error/,
    );
  });

  it('rejects a missing token or unreadable URL', () => {
    expect(() => parseRedirect(`${REDIRECT}#state=s`, 's', 0)).toThrow(OAuthError);
    expect(() => parseRedirect('not a url', 's', 0)).toThrow(/unreadable/);
  });
});

describe('needsRelogin', () => {
  const day = 24 * 60 * 60 * 1000;
  it('renews within a day of expiry', () => {
    expect(needsRelogin(10 * day, 8 * day)).toBe(false);
    expect(needsRelogin(10 * day, 9.5 * day)).toBe(true);
    expect(needsRelogin(0, 1)).toBe(true);
  });
});

describe('logInWithHarvest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubIdentity(launch: (details: { url: string; interactive: boolean }) => unknown) {
    vi.stubGlobal('chrome', {
      identity: { getRedirectURL: () => REDIRECT, launchWebAuthFlow: vi.fn(launch) },
    });
  }

  it('returns the login with the state it sent', async () => {
    stubIdentity(async ({ url }) => {
      const state = new URL(url).searchParams.get('state');
      return `${REDIRECT}#access_token=tok&expires_in=60&scope=harvest%3A1&state=${state}`;
    });
    const login = await logInWithHarvest(true);
    expect(login.token).toBe('tok');
    expect(login.accountIds).toEqual(['1']);
  });

  it('turns a closed window or failed silent login into a message', async () => {
    stubIdentity(async () => {
      throw new Error('The user did not approve access.');
    });
    await expect(logInWithHarvest(true)).rejects.toThrow('The Harvest login window was closed.');
    await expect(logInWithHarvest(false)).rejects.toThrow('Log in to Harvest again.');
  });

  it('fails when Chrome returns no URL', async () => {
    stubIdentity(async () => undefined);
    await expect(logInWithHarvest(false)).rejects.toThrow(/did not finish/);
  });
});
