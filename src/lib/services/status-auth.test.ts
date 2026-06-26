import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock localStorage for Node.js test environment
const localStorageStore = new Map<string, string>();
const mockLocalStorage = {
	getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
	setItem: vi.fn((key: string, value: string) => localStorageStore.set(key, value)),
	removeItem: vi.fn((key: string) => localStorageStore.delete(key)),
	clear: vi.fn(() => localStorageStore.clear())
};

vi.stubGlobal('localStorage', mockLocalStorage);

vi.mock('$app/environment', () => ({
	browser: true
}));

describe('status-auth', () => {
	beforeEach(() => {
		localStorageStore.clear();
		vi.clearAllMocks();
	});

	it('rejects empty keys', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		expect(authenticateWithKey('')).toBe(false);
	});

	it('rejects keys shorter than 16 characters', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		expect(authenticateWithKey('short')).toBe(false);
		expect(authenticateWithKey('12345678')).toBe(false);
		expect(authenticateWithKey('123456789012345')).toBe(false);
	});

	it('accepts keys of 16 characters or longer', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		expect(authenticateWithKey('1234567890123456')).toBe(true);
	});

	it('validates against expected key when provided', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		const expectedKey = 'my-secret-admin-key-2024';
		expect(authenticateWithKey(expectedKey, expectedKey)).toBe(true);
		expect(authenticateWithKey('wrong-key-value-here', expectedKey)).toBe(false);
	});

	it('does not store rejected keys', async () => {
		const { authenticateWithKey, isAuthenticated } = await import('./status-auth');
		authenticateWithKey('short');
		expect(isAuthenticated()).toBe(false);
		expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
	});

	it('stores validated keys in localStorage', async () => {
		const { authenticateWithKey, isAuthenticated } = await import('./status-auth');
		authenticateWithKey('valid-admin-key-1234');
		expect(isAuthenticated()).toBe(true);
		expect(mockLocalStorage.setItem).toHaveBeenCalledWith('status-dashboard-auth', 'valid-admin-key-1234');
	});

	it('logout clears the stored key', async () => {
		const { authenticateWithKey, logout, isAuthenticated } = await import('./status-auth');
		authenticateWithKey('valid-admin-key-1234');
		expect(isAuthenticated()).toBe(true);
		logout();
		expect(isAuthenticated()).toBe(false);
		expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('status-dashboard-auth');
	});
});
