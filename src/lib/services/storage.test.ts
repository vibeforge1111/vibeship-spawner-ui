import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true
}));

import { storageGetRaw, storageHas, storageRemove, storageSetRaw } from './storage';

describe('storage helpers', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns safe defaults when raw storage reads are unavailable', () => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => {
				throw new DOMException('blocked', 'SecurityError');
			})
		});

		expect(storageGetRaw('spawner-key')).toBeNull();
		expect(storageHas('spawner-key')).toBe(false);
	});

	it('does not throw when removing from unavailable storage', () => {
		vi.stubGlobal('localStorage', {
			removeItem: vi.fn(() => {
				throw new DOMException('blocked', 'SecurityError');
			})
		});

		expect(() => storageRemove('spawner-key')).not.toThrow();
	});

	it('keeps raw storage behavior unchanged when storage is available', () => {
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key: string) => values.get(key) ?? null),
			setItem: vi.fn((key: string, value: string) => {
				values.set(key, value);
			}),
			removeItem: vi.fn((key: string) => {
				values.delete(key);
			})
		});

		storageSetRaw('spawner-key', 'ok');

		expect(storageGetRaw('spawner-key')).toBe('ok');
		expect(storageHas('spawner-key')).toBe(true);

		storageRemove('spawner-key');

		expect(storageGetRaw('spawner-key')).toBeNull();
		expect(storageHas('spawner-key')).toBe(false);
	});
});
