import { describe, expect, it } from 'vitest';
import { GERMAN, LOCALES, localeForMonths } from './locales.ts';

describe('localeForMonths', () => {
  it('recognises a language by its month names', () => {
    expect(localeForMonths(GERMAN.months)).toBe(GERMAN);
    expect(localeForMonths(['January', ...GERMAN.months.slice(1)])).toBeNull();
    expect(localeForMonths(GERMAN.months.slice(1))).toBeNull();
  });

  it('keeps every language complete', () => {
    for (const locale of LOCALES) {
      expect(locale.months).toHaveLength(12);
      expect(new Set(locale.months).size).toBe(12);
      expect(locale.saveErrors.length).toBeGreaterThan(0);
    }
  });
});
