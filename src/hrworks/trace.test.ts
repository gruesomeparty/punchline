import { describe, expect, it } from 'vitest';
import { createTrace } from './trace.ts';

describe('createTrace', () => {
  it('prefixes lines with the seconds since the start', () => {
    let time = 1000;
    const trace = createTrace(10, () => time);
    trace.log('first');
    time = 3450;
    trace.log('second');
    expect(trace.lines()).toEqual(['   0.0s first', '   2.5s second']);
  });

  it('keeps only the newest lines', () => {
    const trace = createTrace(2, () => 0);
    for (const line of ['a', 'b', 'c']) trace.log(line);
    expect(trace.lines().map((line) => line.trim())).toEqual(['0.0s b', '0.0s c']);
  });
});
