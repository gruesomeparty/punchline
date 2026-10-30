// Minimal Harvest API v2 client: who am I, and my time entries in a date range.
// The token is only ever sent to api.harvestapp.com.

const API = 'https://api.harvestapp.com/v2';

export type HarvestCredentials = { token: string; accountId: string };

export type HarvestUser = { id: number; firstName: string; lastName: string };

export type HarvestTimeEntry = { spentDate: string; hours: number; isRunning: boolean };

export class HarvestError extends Error {
  override name = 'HarvestError';
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function get(url: string, credentials: HarvestCredentials, fetchFn: Fetch): Promise<unknown> {
  // Pagination links come from the response. Never follow one off the API host with our token.
  if (!url.startsWith(`${API}/`)) {
    throw new HarvestError('Harvest returned an unexpected link. Stopped.');
  }
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Harvest-Account-Id': credentials.accountId,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new HarvestError('Could not reach Harvest. Check your connection.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HarvestError('Harvest rejected the token or account ID. Check your settings.');
  }
  if (response.status === 429) {
    throw new HarvestError('Harvest is rate limiting requests. Try again in a minute.');
  }
  if (!response.ok) {
    throw new HarvestError(`Harvest answered with HTTP ${response.status}.`);
  }
  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function fetchCurrentUser(
  credentials: HarvestCredentials,
  fetchFn: Fetch = fetch,
): Promise<HarvestUser> {
  const body = await get(`${API}/users/me`, credentials, fetchFn);
  if (!isRecord(body) || typeof body.id !== 'number') {
    throw new HarvestError('Unexpected answer from Harvest for the current user.');
  }
  return {
    id: body.id,
    firstName: typeof body.first_name === 'string' ? body.first_name : '',
    lastName: typeof body.last_name === 'string' ? body.last_name : '',
  };
}

/**
 * Time entries of one user, `from` to `to` inclusive. Without `user_id`, Harvest returns the
 * entries of everyone the token can see, which for managers means the whole team.
 */
export async function fetchTimeEntries(
  credentials: HarvestCredentials,
  userId: number,
  from: string,
  to: string,
  fetchFn: Fetch = fetch,
): Promise<HarvestTimeEntry[]> {
  const params = new URLSearchParams({ user_id: String(userId), from, to });
  let url: string | null = `${API}/time_entries?${params}`;
  const entries: HarvestTimeEntry[] = [];

  while (url) {
    const body = await get(url, credentials, fetchFn);
    if (!isRecord(body) || !Array.isArray(body.time_entries)) {
      throw new HarvestError('Unexpected answer from Harvest for time entries.');
    }
    for (const raw of body.time_entries) {
      if (!isRecord(raw) || typeof raw.spent_date !== 'string' || typeof raw.hours !== 'number') {
        throw new HarvestError('Harvest returned a time entry without a date or hours.');
      }
      entries.push({
        spentDate: raw.spent_date,
        hours: raw.hours,
        isRunning: raw.is_running === true,
      });
    }
    const next: unknown = isRecord(body.links) ? body.links.next : null;
    url = typeof next === 'string' ? next : null;
  }
  return entries;
}
