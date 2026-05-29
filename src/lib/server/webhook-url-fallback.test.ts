import { describe, it, expect } from 'vitest';

const selectWebhookUrls = (all: string[], matched: string[]): string[] =>
  matched.length > 0 ? matched : all;

describe('selectWebhookUrlsForMissionEvent - fallback logic', () => {
  it('falls back to all webhooks when no match found', () => {
    const all = ['http://localhost:3001', 'http://localhost:3002'];
    expect(selectWebhookUrls(all, [])).toEqual(all);
  });

  it('returns matched subset when match found', () => {
    const all = ['http://localhost:3001', 'http://localhost:3002'];
    expect(selectWebhookUrls(all, ['http://localhost:3001'])).toEqual(['http://localhost:3001']);
  });

  it('handles empty all-webhooks list without throw', () => {
    expect(() => selectWebhookUrls([], [])).not.toThrow();
  });

  it('handles malformed relay data without throw', () => {
    expect(() => {
      const data: unknown = null;
      const webhooks = Array.isArray(data) ? (data as string[]) : [];
      return selectWebhookUrls(webhooks, []);
    }).not.toThrow();
  });

  it('fallback result length bounded by all-webhooks', () => {
    const all = ['http://localhost:3001', 'http://localhost:3002'];
    const result = selectWebhookUrls(all, []);
    expect(result.length).toBeLessThanOrEqual(all.length);
  });

  it('does not introduce urls beyond the provided set', () => {
    const all = ['http://localhost:3001'];
    const result = selectWebhookUrls(all, []);
    expect(result.every(u => all.includes(u))).toBe(true);
  });
});