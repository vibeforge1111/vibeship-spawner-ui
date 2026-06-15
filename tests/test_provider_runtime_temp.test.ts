import { describe, it, expect } from 'vitest';

function makeTempPath(persistPath: string): string {
	return `${persistPath}.${crypto.randomUUID()}.tmp`;
}

describe('provider-runtime temp path', () => {
	it('does not contain process.pid', () => {
		const p = makeTempPath('/state/results.json');
		expect(p).not.toContain(String(process.pid));
	});
	it('ends with .tmp', () => {
		expect(makeTempPath('/state/results.json')).toMatch(/\.tmp$/);
	});
	it('contains a UUID segment', () => {
		const p = makeTempPath('/state/results.json');
		expect(p).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
	});
	it('produces 1000 unique paths', () => {
		const paths = new Set(Array.from({ length: 1000 }, () => makeTempPath('/state/results.json')));
		expect(paths.size).toBe(1000);
	});
	it('preserves original path as prefix', () => {
		expect(makeTempPath('/a/b/c.json')).toStartWith('/a/b/c.json.');
	});
});
