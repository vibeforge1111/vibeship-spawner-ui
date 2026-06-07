import { describe, it, expect, vi } from 'vitest';

function generateTempPath(persistPath: string): string {
	return `${persistPath}.${process.pid}.${Date.now()}.${crypto.randomUUID().replace(/-/g, '')}.tmp`;
}

describe('provider temp file path', () => {
	it('matches <persistPath>.<pid>.<ts>.<hex32>.tmp format', () => {
		const path = generateTempPath('/state/results.json');
		expect(path).toMatch(/\.tmp$/);
		expect(path).toContain(`${process.pid}`);
	});
	it('produces unique paths across 500 calls', () => {
		const paths = new Set(Array.from({ length: 500 }, () => generateTempPath('/base')));
		expect(paths.size).toBe(500);
	});
	it('does not call Math.random', () => {
		const spy = vi.spyOn(Math, 'random');
		generateTempPath('/base');
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
	it('ends with .tmp', () => {
		expect(generateTempPath('/base').endsWith('.tmp')).toBe(true);
	});
	it('hex suffix is 32 chars', () => {
		const path = generateTempPath('/base');
		const parts = path.split('.');
		const hex = parts[parts.length - 2];
		expect(hex).toMatch(/^[0-9a-f]{32}$/);
	});
});
