import { describe, it, expect, vi } from 'vitest';

function generateConnectionId(): string {
	return 'conn-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

describe('canvas connection ID generation', () => {
	it('matches conn-<hex10> format', () => {
		expect(generateConnectionId()).toMatch(/^conn-[0-9a-f]{10}$/);
	});
	it('produces 500 unique IDs', () => {
		expect(new Set(Array.from({ length: 500 }, generateConnectionId)).size).toBe(500);
	});
	it('does not call Math.random', () => {
		const spy = vi.spyOn(Math, 'random');
		generateConnectionId();
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
	it('prefix is conn-', () => {
		expect(generateConnectionId().startsWith('conn-')).toBe(true);
	});
	it('suffix is 10 hex chars', () => {
		expect(generateConnectionId().slice(5)).toMatch(/^[0-9a-f]{10}$/);
	});
});
