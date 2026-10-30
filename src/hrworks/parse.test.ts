import { describe, expect, it } from 'vitest';
import { GERMAN } from './locales.ts';
import {
  findDuration,
  parseClock,
  parseDayHeader,
  parseDayLabel,
  parseDuration,
  parseWeekTitle,
} from './parse.ts';

describe('parseDayLabel', () => {
  it('reads German day labels', () => {
    expect(parseDayLabel('Mo, 16.02.26')).toBe('2026-02-16');
    expect(parseDayLabel(' Fr, 25.09.26')).toBe('2026-09-25');
    expect(parseDayLabel('Fr, 25.09.2026')).toBe('2026-09-25');
  });

  it('rejects anything else', () => {
    expect(parseDayLabel('KW 39')).toBeNull();
    expect(parseDayLabel('Mo, 31.02.26')).toBeNull();
  });
});

describe('parseDuration', () => {
  it('reads signed hours', () => {
    expect(parseDuration('-08:24 Stunden')).toBe(-504);
    expect(parseDuration('+00:06 Stunden')).toBe(6);
    expect(parseDuration('8:30')).toBe(510);
    expect(parseDuration(' 10:00 ')).toBe(600);
  });

  it('rejects anything else', () => {
    expect(parseDuration('8,5')).toBeNull();
    expect(parseDuration('8:75')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('parseClock', () => {
  it('reads times of day', () => {
    expect(parseClock('07:00 Uhr')).toBe('07:00');
    expect(parseClock('7:30 Uhr')).toBe('07:30');
    expect(parseClock('25:00 Uhr')).toBeNull();
    expect(parseClock('Offene Arbeitszeit')).toBeNull();
  });
});

describe('parseDayHeader', () => {
  const day = 'Mo, 05.01.26';

  it('reads an empty workday', () => {
    expect(parseDayHeader({ day, status: ['Keine Arbeitszeit erfasst', ''], label: '' })).toEqual({
      date: '2026-01-05',
      entries: [],
      absence: '',
      workday: true,
    });
  });

  it('reads a day with an entry', () => {
    expect(parseDayHeader({ day, status: ['07:00 Uhr', '16:00 Uhr'], label: '' })?.entries).toEqual(
      [{ start: '07:00', end: '16:00' }],
    );
  });

  it('reads an open entry', () => {
    expect(
      parseDayHeader({ day, status: ['20:26 Uhr', 'Offene Arbeitszeit'], label: '' })?.entries,
    ).toEqual([{ start: '20:26', end: '' }]);
  });

  it('reads weekends and absences', () => {
    expect(
      parseDayHeader({ day, status: [], label: 'Kein Arbeitstag nach Arbeitsplan' }),
    ).toMatchObject({ workday: false, absence: '' });
    expect(parseDayHeader({ day, status: [], label: 'Jahresurlaub' })).toMatchObject({
      workday: true,
      absence: 'Jahresurlaub',
    });
  });

  it('returns null for anything unexpected', () => {
    expect(parseDayHeader({ day: 'Montag', status: [], label: '' })).toBeNull();
    expect(parseDayHeader({ day, status: ['irgendwas', 'anderes'], label: '' })).toBeNull();
    expect(parseDayHeader({ day, status: ['a', 'b', 'c'], label: '' })).toBeNull();
    expect(parseDayHeader({ day, status: ['x', 'Offene Arbeitszeit'], label: '' })).toBeNull();
  });
});

describe('findDuration', () => {
  it('finds a value in the same or the next text', () => {
    expect(findDuration([`${GERMAN.credited}:`, '8:30'], GERMAN.credited)).toBe(510);
    expect(findDuration(['Sollarbeitsstunden: 8:24'], 'Sollarbeitsstunden')).toBe(504);
  });

  it('returns null when the label is missing', () => {
    expect(findDuration(['Pausendauer:', '1:00'], GERMAN.credited)).toBeNull();
  });
});

describe('parseWeekTitle', () => {
  it('reads the dates of a week', () => {
    expect(parseWeekTitle('KW 29 (13.07. - 19.07.)', 2026)).toEqual({
      from: '2026-07-13',
      to: '2026-07-19',
    });
    expect(parseWeekTitle(' KW 27 (01.07. - 05.07.)', 2026)?.from).toBe('2026-07-01');
  });

  it('rejects anything else', () => {
    expect(parseWeekTitle('KW 29', 2026)).toBeNull();
    expect(parseWeekTitle('KW 9 (31.02. - 01.03.)', 2026)).toBeNull();
    expect(parseWeekTitle('KW 9 (19.07. - 13.07.)', 2026)).toBeNull();
  });
});
