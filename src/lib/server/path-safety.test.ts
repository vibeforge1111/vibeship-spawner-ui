import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSafeId, PathSafetyError, resolveWithinBaseDir } from './path-safety';

describe('path-safety', () => {
	it('accepts compact ids used for missions, requests, and skills', () => {
		expect(() => assertSafeId('mission-1777456803045', 'mission id')).not.toThrow();
		expect(() => assertSafeId('prd_tg-build_123', 'request id')).not.toThrow();
	});

	it('rejects ids that could carry path traversal or shell-ish punctuation', () => {
		for (const id of ['../secret', 'mission/123', 'mission.123', 'mission 123', '', 'x'.repeat(129)]) {
			expect(() => assertSafeId(id, 'mission id')).toThrow(PathSafetyError);
			try {
				assertSafeId(id, 'mission id');
			} catch (error) {
				expect(error).toBeInstanceOf(PathSafetyError);
				expect((error as PathSafetyError).status).toBe(400);
				expect((error as Error).message).toBe('Invalid mission id');
			}
		}
	});

	it('resolves normal files inside the base directory', () => {
		const base = resolve('state/results');

		expect(resolveWithinBaseDir(base, 'mission-result.json')).toBe(resolve(base, 'mission-result.json'));
		expect(resolveWithinBaseDir(base, 'nested/mission-result.json')).toBe(
			resolve(base, 'nested/mission-result.json')
		);
	});

	it('rejects base directory operations and traversal outside the base', () => {
		const base = resolve('state/results');

		expect(() => resolveWithinBaseDir(base, '.')).toThrow(PathSafetyError);
		expect(() => resolveWithinBaseDir(base, '..')).toThrow(PathSafetyError);
		expect(() => resolveWithinBaseDir(base, '../secrets.json')).toThrow(PathSafetyError);

		for (const fileName of ['.', '..', '../secrets.json']) {
			try {
				resolveWithinBaseDir(base, fileName);
			} catch (error) {
				expect(error).toBeInstanceOf(PathSafetyError);
				expect((error as PathSafetyError).status).toBe(403);
			}
		}
	});

	it('does not confuse sibling directories that share the same prefix', () => {
		const base = resolve('state/result');

		expect(() => resolveWithinBaseDir(base, '../results-extra/mission.json')).toThrow(
			'Path escapes allowed directory'
		);
	});
});
