import { describe, expect, it } from 'vitest';
import { aboutLine, createTrace } from './trace.ts';

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

describe('aboutLine', () => {
  it('names the punchline and Chrome versions', () => {
    const agent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/142.0.7444.60 Safari/537.36';
    expect(aboutLine('1.0.0', agent)).toBe('punchline 1.0.0, Chrome 142.0.7444.60');
    expect(aboutLine('1.0.0', 'curl')).toBe('punchline 1.0.0, Chrome unknown');
  });
});
