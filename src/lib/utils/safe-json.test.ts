import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJsonOrFallback, parseJsonOrThrow, tryParseJson } from './safe-json';

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('safe JSON helpers', () => {
	it('parses valid JSON', () => {
		expect(parseJsonOrFallback('{"ok":true}', { ok: false }, 'test')).toEqual({ ok: true });
	});

	it('parses JSON with a UTF-8 BOM prefix', () => {
		expect(parseJsonOrThrow(`\ufeff{"ok":true}`, 'bom-test')).toEqual({ ok: true });
		expect(parseJsonOrFallback(`\ufeff{"ok":true}`, { ok: false }, 'bom-test')).toEqual({ ok: true });
	});

	it('returns fallback and logs only a label on invalid JSON', () => {
		const result = tryParseJson('{bad json', { ok: false }, 'mission-cache');

		expect(result.ok).toBe(false);
		expect(result.value).toEqual({ ok: false });
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('mission-cache'));
		expect(String(vi.mocked(console.warn).mock.calls[0][0])).not.toContain('{bad json');
	});

	it('treats empty input as a safe fallback without warning', () => {
		expect(tryParseJson('', [], 'empty')).toEqual({ ok: true, value: [] });
		expect(console.warn).not.toHaveBeenCalled();
	});
});
