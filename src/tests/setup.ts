/**
 * Test Setup
 *
 * Global test configuration and mocks
 */

import { vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	length: 0,
	key: vi.fn()
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock fetch for API calls
vi.stubGlobal('fetch', vi.fn());

// Reset mocks between tests
beforeEach(() => {
	vi.clearAllMocks();
	localStorageMock.getItem.mockReturnValue(null);
});
