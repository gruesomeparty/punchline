import { describe, expect, it } from 'vitest';
import { isReadDaysRequest, isWriteDaysRequest, pickHrworksTab } from './messages.ts';

describe('isReadDaysRequest', () => {
  it('accepts only well-formed requests', () => {
    expect(isReadDaysRequest({ type: 'punchline/read-days', from: 'a', to: 'b' })).toBe(true);
    expect(isReadDaysRequest({ type: 'punchline/read-days', from: 'a' })).toBe(false);
    expect(isReadDaysRequest({ type: 'other', from: 'a', to: 'b' })).toBe(false);
    expect(isReadDaysRequest(null)).toBe(false);
  });
});

describe('isWriteDaysRequest', () => {
  it('accepts only well-formed days', () => {
    const day = { date: '2026-08-24', start: '08:00', end: '17:00', expectedMinutes: 510 };
    expect(isWriteDaysRequest({ type: 'punchline/write-days', days: [day] })).toBe(true);
    expect(isWriteDaysRequest({ type: 'punchline/write-days', days: [{ ...day, end: 5 }] })).toBe(
      false,
    );
    expect(isWriteDaysRequest({ type: 'punchline/write-days', days: day })).toBe(false);
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
