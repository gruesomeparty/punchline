import { describe, expect, it } from 'vitest';
import { fetchCurrentUser, fetchTimeEntries, HarvestError } from './client.ts';

const credentials = { token: 'test-token', accountId: '12345' };

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, { status?: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const response = responses[url];
    if (!response) throw new TypeError('network error');
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status ?? 200 });
  };
  return { fetchFn, calls };
}

describe('fetchCurrentUser', () => {
  it('sends the token and account ID', async () => {
    const { fetchFn, calls } = fakeFetch({
      'https://api.harvestapp.com/v2/users/me': {
        body: { id: 7, first_name: 'Ada', last_name: 'Example' },
      },
    });
    expect(await fetchCurrentUser(credentials, fetchFn)).toEqual({
      id: 7,
      firstName: 'Ada',
      lastName: 'Example',
    });
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'Harvest-Account-Id': '12345',
    });
  });

  it('explains a rejected token', async () => {
    const { fetchFn } = fakeFetch({ 'https://api.harvestapp.com/v2/users/me': { status: 401 } });
    await expect(fetchCurrentUser(credentials, fetchFn)).rejects.toThrow(/rejected the token/);
  });

  it('explains rate limits, other errors and network failures', async () => {
    const rateLimited = fakeFetch({ 'https://api.harvestapp.com/v2/users/me': { status: 429 } });
    await expect(fetchCurrentUser(credentials, rateLimited.fetchFn)).rejects.toThrow(/rate/);
    const broken = fakeFetch({ 'https://api.harvestapp.com/v2/users/me': { status: 500 } });
    await expect(fetchCurrentUser(credentials, broken.fetchFn)).rejects.toThrow(/HTTP 500/);
    const offline = fakeFetch({});
    await expect(fetchCurrentUser(credentials, offline.fetchFn)).rejects.toThrow(/reach Harvest/);
  });

  it('rejects an unexpected body', async () => {
    const { fetchFn } = fakeFetch({ 'https://api.harvestapp.com/v2/users/me': { body: [] } });
    await expect(fetchCurrentUser(credentials, fetchFn)).rejects.toBeInstanceOf(HarvestError);
  });
});

describe('fetchTimeEntries', () => {
  const first =
    'https://api.harvestapp.com/v2/time_entries?user_id=7&from=2026-01-01&to=2026-01-31';
  const second = 'https://api.harvestapp.com/v2/time_entries?page=2&user_id=7';

  it('filters by user and follows pagination', async () => {
    const { fetchFn, calls } = fakeFetch({
      [first]: {
        body: {
          time_entries: [{ spent_date: '2026-01-05', hours: 2.5, is_running: false }],
          links: { next: second },
        },
      },
      [second]: {
        body: {
          time_entries: [{ spent_date: '2026-01-06', hours: 1, is_running: true }],
          links: { next: null },
        },
      },
    });
    const entries = await fetchTimeEntries(credentials, 7, '2026-01-01', '2026-01-31', fetchFn);
    expect(entries).toEqual([
      { spentDate: '2026-01-05', hours: 2.5, isRunning: false },
      { spentDate: '2026-01-06', hours: 1, isRunning: true },
    ]);
    expect(calls.map((call) => call.url)).toEqual([first, second]);
  });

  it('never sends the token to another host', async () => {
    const { fetchFn, calls } = fakeFetch({
      [first]: { body: { time_entries: [], links: { next: 'https://example.com/steal' } } },
    });
    await expect(
      fetchTimeEntries(credentials, 7, '2026-01-01', '2026-01-31', fetchFn),
    ).rejects.toThrow(/unexpected link/);
    expect(calls).toHaveLength(1);
  });

  it('rejects malformed entries', async () => {
    const { fetchFn } = fakeFetch({ [first]: { body: { time_entries: [{ hours: 1 }] } } });
    await expect(
      fetchTimeEntries(credentials, 7, '2026-01-01', '2026-01-31', fetchFn),
    ).rejects.toThrow(/without a date/);
    const noList = fakeFetch({ [first]: { body: {} } });
    await expect(
      fetchTimeEntries(credentials, 7, '2026-01-01', '2026-01-31', noList.fetchFn),
    ).rejects.toThrow(/Unexpected answer/);
  });
});
