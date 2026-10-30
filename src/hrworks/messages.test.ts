import { describe, expect, it } from 'vitest';
import { isReadDaysRequest, pickHrworksTab } from './messages.ts';

describe('isReadDaysRequest', () => {
  it('accepts only well-formed requests', () => {
    expect(isReadDaysRequest({ type: 'punchline/read-days', from: 'a', to: 'b' })).toBe(true);
    expect(isReadDaysRequest({ type: 'punchline/read-days', from: 'a' })).toBe(false);
    expect(isReadDaysRequest({ type: 'other', from: 'a', to: 'b' })).toBe(false);
    expect(isReadDaysRequest(null)).toBe(false);
  });
});

describe('pickHrworksTab', () => {
  it('prefers the tab showing Arbeitszeiten', () => {
    const home = { id: 1, url: 'https://example.hrworks.de/k/home' };
    const times = { id: 2, url: 'https://example.hrworks.de/k/time-management/working-times' };
    expect(pickHrworksTab([home, times])).toBe(times);
    expect(pickHrworksTab([home])).toBe(home);
    expect(pickHrworksTab([])).toBeNull();
  });
});
