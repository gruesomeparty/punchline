import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendWriteLog, loadWriteLog, type WriteLogEntry, wasWritten } from './write-log.ts';

const entry: WriteLogEntry = {
  at: '2026-10-30T20:00:00.000Z',
  date: '2026-08-28',
  action: 'create',
  start: '08:00',
  end: '17:00',
  previous: [],
  result: 'ok',
  message: '',
};

describe('wasWritten', () => {
  it('counts saves that went through or might have', () => {
    expect(wasWritten([entry], '2026-08-28')).toBe(entry);
    expect(wasWritten([{ ...entry, result: 'unknown' }], '2026-08-28')).not.toBeNull();
    expect(wasWritten([{ ...entry, result: 'failed' }], '2026-08-28')).toBeNull();
    expect(wasWritten([entry], '2026-08-31')).toBeNull();
  });
});

describe('write log storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends entries and ignores junk', async () => {
    const store: Record<string, unknown> = { writeLog: [entry, 'junk'] };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (items: Record<string, unknown>) => Object.assign(store, items),
        },
      },
    });
    expect(await loadWriteLog()).toEqual([entry]);
    await appendWriteLog({ ...entry, date: '2026-08-31' });
    expect((await loadWriteLog()).map((e) => e.date)).toEqual(['2026-08-28', '2026-08-31']);
  });
});
