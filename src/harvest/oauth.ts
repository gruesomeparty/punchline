// "Log in with Harvest" via Harvest's client-side OAuth2 flow. That flow returns the access token
// straight to the redirect URL, so the extension never needs a client secret.

const AUTHORIZE = 'https://id.getharvest.com/oauth2/authorize';

/**
 * Client ID of the punchline OAuth app registered at id.getharvest.com/developers. Client IDs
 * are public by design. Empty means the login button stays hidden and only tokens work.
 */
export const HARVEST_CLIENT_ID = '8M81ynuGcGACpfBXkj9lp6vF';

/** Re-login a day early, so a sync never starts with a token that runs out halfway. */
export const EXPIRY_MARGIN_MS = 24 * 60 * 60 * 1000;

export type OAuthLogin = {
  token: string;
  /** Harvest accounts the token was granted for, from the `harvest:<id>` scopes. */
  accountIds: string[];
  /** When the token expires, in ms since the epoch. */
  expiresAt: number;
};

export class OAuthError extends Error {
  override name = 'OAuthError';
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE}?${params}`;
}

/** Reads the token from the URL Harvest redirected to. */
export function parseRedirect(responseUrl: string, expectedState: string, now: number): OAuthLogin {
  let url: URL;
  try {
    url = new URL(responseUrl);
  } catch {
    throw new OAuthError('Harvest returned an unreadable login answer.');
  }
  // The token arrives in the fragment. Errors such as a denied consent may come as query params.
  const params = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);

  if (params.get('state') !== expectedState) {
    throw new OAuthError('The Harvest login answer did not match the request. Try again.');
  }
  const error = params.get('error');
  if (error) {
    throw new OAuthError(
      error === 'access_denied'
        ? 'The Harvest login was cancelled.'
        : `Harvest login failed (${error}).`,
    );
  }
  const token = params.get('access_token');
  if (!token) throw new OAuthError('Harvest did not return an access token.');

  const seconds = Number(params.get('expires_in'));
  const accountIds = (params.get('scope') ?? '')
    .split(/\s+/)
    .map((scope) => /^harvest:(\d+)$/.exec(scope)?.[1])
    .filter((id): id is string => id !== undefined);
  return {
    token,
    accountIds,
    // Without a lifetime, assume the documented 14 days rather than "never".
    expiresAt: now + (Number.isFinite(seconds) && seconds > 0 ? seconds : 14 * 24 * 60 * 60) * 1000,
  };
}

export function needsRelogin(expiresAt: number, now: number): boolean {
  return expiresAt - now < EXPIRY_MARGIN_MS;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Runs the login. Non-interactive mode succeeds without any window while the user is still
 * signed in to Harvest and has approved punchline before, and fails otherwise.
 */
export async function logInWithHarvest(interactive: boolean): Promise<OAuthLogin> {
  const state = randomState();
  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authorizeUrl(HARVEST_CLIENT_ID, chrome.identity.getRedirectURL(), state),
      interactive,
      // Harvest ID may redirect with JavaScript, so give a silent attempt a moment to finish.
      abortOnLoadForNonInteractive: false,
      timeoutMsForNonInteractive: 5000,
    });
  } catch {
    throw new OAuthError(
      interactive ? 'The Harvest login window was closed.' : 'Log in to Harvest again.',
    );
  }
  if (!responseUrl) throw new OAuthError('Harvest did not finish the login.');
  return parseRedirect(responseUrl, state, Date.now());
}
