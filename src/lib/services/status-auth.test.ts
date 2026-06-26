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

	it('rejects keys shorter than 8 characters', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		expect(authenticateWithKey('short')).toBe(false);
		expect(authenticateWithKey('1234567')).toBe(false);
	});

	it('accepts keys of 8 characters or longer', async () => {
		const { authenticateWithKey } = await import('./status-auth');
		expect(authenticateWithKey('12345678')).toBe(true);
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

	it('getAuthStatus never exposes the stored API key', async () => {
		const { authenticateWithKey, getAuthStatus } = await import('./status-auth');
		authenticateWithKey('super-secret-admin-key-2024');
		const status = getAuthStatus();
		expect(status.authenticated).toBe(true);
		expect(status.adminKey).toBeNull();
	});

	it('getAuthStatus returns null adminKey when not authenticated', async () => {
		const { getAuthStatus } = await import('./status-auth');
		const status = getAuthStatus();
		expect(status.authenticated).toBe(false);
		expect(status.adminKey).toBeNull();
	});
});
