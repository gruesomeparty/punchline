import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, errorDetail, errorMessage, HrworksReadError } from './errors.ts';

describe('HrworksReadError', () => {
  it('ends its message with the code', () => {
    const error = new HrworksReadError('dayMissing', "HRworks didn't show 2026-10-10.");
    expect(error.message).toBe("HRworks didn't show 2026-10-10. (PL-302)");
    expect(error.code).toBe('PL-302');
    expect(error.text).toBe("HRworks didn't show 2026-10-10.");
  });

  it('uses each code once', () => {
    const codes = Object.values(ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has every code explained in the troubleshooting guide', () => {
    const guide = readFileSync('docs/troubleshooting.md', 'utf8');
    for (const code of Object.values(ERROR_CODES)) expect(guide).toContain(`| ${code} |`);
  });
});

describe('errorMessage', () => {
  it('adds text before the code', () => {
    const error = new HrworksReadError('notWritable', 'HRworks already has an entry.');
    expect(errorMessage(error, 'Unexpected.', ' Nothing saved.')).toBe(
      'HRworks already has an entry. Nothing saved. (PL-401)',
    );
  });

  it('gives other errors the fallback and the code for unexpected errors', () => {
    expect(errorMessage(new TypeError('x is undefined'), 'Unexpected error.')).toBe(
      'Unexpected error. (PL-900)',
    );
  });
});

describe('errorDetail', () => {
  it('keeps the name and message of unexpected errors for the debug log', () => {
    expect(errorDetail(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(errorDetail('boom')).toBe('boom');
    expect(errorDetail(new HrworksReadError('timeout', 'Too slow.'))).toBe('Too slow. (PL-201)');
  });
});
