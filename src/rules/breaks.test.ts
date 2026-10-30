import { describe, expect, it } from 'vitest';
import { BREAK_PRESETS, breakFor, dayTimes, grossFor, validateRules } from './breaks.ts';

const ch = BREAK_PRESETS.ch.rules;
const de = BREAK_PRESETS.de.rules;
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('breakFor', () => {
  it('takes the longest break whose threshold is exceeded', () => {
    expect(breakFor(h(5, 30), ch)).toBe(0);
    expect(breakFor(h(5, 31), ch)).toBe(15);
    expect(breakFor(h(7), ch)).toBe(15);
    expect(breakFor(h(7, 1), ch)).toBe(30);
    expect(breakFor(h(9, 1), ch)).toBe(60);
    expect(breakFor(h(9, 1), de)).toBe(45);
  });

  it('returns 0 without rules', () => {
    expect(breakFor(h(12), [])).toBe(0);
  });
});

describe('grossFor', () => {
  it('adds no break to short days', () => {
    expect(grossFor(h(4), ch)).toBe(h(4));
    expect(grossFor(h(6), de)).toBe(h(6));
  });

  it('adds the break that HRworks will take off again', () => {
    expect(grossFor(h(6, 45), ch)).toBe(h(7));
    expect(grossFor(h(6, 46), ch)).toBe(h(7, 16));
    expect(grossFor(h(8, 30), ch)).toBe(h(9));
    expect(grossFor(h(9), ch)).toBe(h(10));
    expect(grossFor(h(10), ch)).toBe(h(11));
    expect(grossFor(h(8), de)).toBe(h(8, 30));
    expect(grossFor(h(9, 1), de)).toBe(h(9, 46));
  });

  it('always leaves exactly the net time after breaks', () => {
    for (const rules of [ch, de]) {
      for (let net = 0; net <= h(12); net++) {
        const gross = grossFor(net, rules);
        expect(gross - breakFor(gross, rules)).toBe(net);
      }
    }
  });

  it('matches the original script (30 min above 7 h, 60 min above 8.5 h net)', () => {
    const scriptRules = [
      { afterMinutes: h(7), breakMinutes: 30 },
      { afterMinutes: h(9), breakMinutes: 60 },
    ];
    const script = (net: number) => net + (net > h(8, 30) ? 60 : net > h(7) ? 30 : 0);
    for (let net = 0; net <= h(12); net++) {
      expect(grossFor(net, scriptRules)).toBe(script(net));
    }
  });

  it('finds a gross time even for odd custom rules', () => {
    const odd = [{ afterMinutes: h(1), breakMinutes: h(2) }];
    for (let net = 0; net <= h(6); net++) {
      const gross = grossFor(net, odd);
      expect(gross - breakFor(gross, odd)).toBe(net);
    }
  });
});

describe('dayTimes', () => {
  it('computes start and end', () => {
    expect(dayTimes(h(8, 30), h(7), ch)).toEqual({
      ok: true,
      times: { start: '07:00', end: '16:00', breakMinutes: 30 },
    });
  });

  it('refuses to go past midnight', () => {
    const result = dayTimes(h(10), h(14), ch);
    expect(result.ok).toBe(false);
  });
});

describe('validateRules', () => {
  it('accepts the presets', () => {
    expect(validateRules(ch)).toEqual([]);
    expect(validateRules(de)).toEqual([]);
    expect(validateRules([])).toEqual([]);
  });

  it('rejects fractions and negative values', () => {
    expect(validateRules([{ afterMinutes: 1.5, breakMinutes: 30 }])).toHaveLength(1);
    expect(validateRules([{ afterMinutes: 300, breakMinutes: -1 }])).toHaveLength(1);
  });

  it('rejects breaks that do not grow with the day', () => {
    expect(
      validateRules([
        { afterMinutes: h(9), breakMinutes: 30 },
        { afterMinutes: h(6), breakMinutes: 45 },
      ]),
    ).toHaveLength(1);
  });
});
