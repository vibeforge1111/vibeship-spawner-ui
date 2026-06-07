import { describe, it, expect } from 'vitest';

function makeTempPath(filePath: string): string {
	return `${filePath}.${crypto.randomUUID()}.tmp`;
}

describe('creator-mission temp path', () => {
	it('does not contain process.pid', () => {
		const p = makeTempPath('/state/m.json');
		expect(p).not.toContain(String(process.pid));
	});
	it('ends with .tmp', () => {
		expect(makeTempPath('/state/m.json')).toMatch(/\.tmp$/);
	});
	it('contains a UUID segment', () => {
		const p = makeTempPath('/state/m.json');
		expect(p).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
	});
	it('produces unique paths across 1000 calls', () => {
		const paths = new Set(Array.from({ length: 1000 }, () => makeTempPath('/state/m.json')));
		expect(paths.size).toBe(1000);
	});
	it('preserves the original file path as prefix', () => {
		expect(makeTempPath('/a/b/c.json')).toStartWith('/a/b/c.json.');
	});
});
