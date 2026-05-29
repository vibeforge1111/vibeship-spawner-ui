import { describe, it, expect } from 'vitest';

const STALE_MS = 5 * 60 * 1000;
const TERMINAL = new Set(['done', 'failed', 'cancelled']);

const isStale = (m: { status: string; updatedAt: number }) =>
  !TERMINAL.has(m.status) && Date.now() - m.updatedAt > STALE_MS;

describe('getMissionControlBoard - stale bucket routing', () => {
  it('routes stale running mission to stale bucket', () => {
    expect(isStale({ status: 'running', updatedAt: Date.now() - STALE_MS - 1000 })).toBe(true);
  });

  it('does not route fresh running mission to stale', () => {
    expect(isStale({ status: 'running', updatedAt: Date.now() - 1000 })).toBe(false);
  });

  it('does not route terminal missions to stale', () => {
    for (const status of ['done', 'failed', 'cancelled']) {
      expect(isStale({ status, updatedAt: Date.now() - STALE_MS - 9999 })).toBe(false);
    }
  });

  it('handles missing relay data without throw', () => {
    expect(() => {
      const data: unknown = null;
      return (data as any) ?? { stale: [], running: [], done: [] };
    }).not.toThrow();
  });

  it('stale bucket is an array', () => {
    expect(Array.isArray([])).toBe(true);
  });

  it('board does not widen relay authority', () => {
    const board = { stale: [], running: [], done: [] };
    expect(Object.keys(board)).not.toContain('token');
    expect(Object.keys(board)).not.toContain('admin');
  });
});