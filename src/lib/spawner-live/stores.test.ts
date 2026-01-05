import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock localStorage before importing stores
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
	getItem: vi.fn((key: string) => mockStorage[key] || null),
	setItem: vi.fn((key: string, value: string) => {
		mockStorage[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete mockStorage[key];
	}),
	clear: vi.fn(() => {
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
	})
});

// Now import stores after mocking
import {
	liveModeStore,
	currentMode,
	currentPreset,
	isLiveEnabled,
	isPresentationMode,
	isDeveloperMode
} from './stores';

describe('Spawner Live Stores', () => {
	beforeEach(() => {
		// Clear mock storage
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
		// Reset stores
		liveModeStore.reset();
	});

	describe('liveModeStore', () => {
		it('should have default values after reset', () => {
			const state = get(liveModeStore);
			expect(state.enabled).toBe(true);
			expect(state.mode).toBe('presentation');
			expect(state.preset).toBe('balanced');
		});

		it('should update enabled state', () => {
			liveModeStore.setEnabled(false);
			expect(get(isLiveEnabled)).toBe(false);

			liveModeStore.setEnabled(true);
			expect(get(isLiveEnabled)).toBe(true);
		});

		it('should update mode', () => {
			liveModeStore.setMode('developer');
			expect(get(currentMode)).toBe('developer');

			liveModeStore.setMode('presentation');
			expect(get(currentMode)).toBe('presentation');
		});

		it('should toggle mode', () => {
			liveModeStore.reset();
			expect(get(currentMode)).toBe('presentation');

			liveModeStore.toggle();
			expect(get(currentMode)).toBe('developer');

			liveModeStore.toggle();
			expect(get(currentMode)).toBe('presentation');
		});

		it('should update preset', () => {
			liveModeStore.setPreset('minimal');
			expect(get(currentPreset)).toBe('minimal');

			liveModeStore.setPreset('maximum');
			expect(get(currentPreset)).toBe('maximum');
		});
	});

	describe('derived stores', () => {
		it('isLiveEnabled should reflect enabled state', () => {
			liveModeStore.setEnabled(false);
			expect(get(isLiveEnabled)).toBe(false);

			liveModeStore.setEnabled(true);
			expect(get(isLiveEnabled)).toBe(true);
		});

		it('isPresentationMode should be true when mode is presentation', () => {
			liveModeStore.setMode('presentation');
			expect(get(isPresentationMode)).toBe(true);

			liveModeStore.setMode('developer');
			expect(get(isPresentationMode)).toBe(false);
		});

		it('isDeveloperMode should be true when mode is developer', () => {
			liveModeStore.setMode('developer');
			expect(get(isDeveloperMode)).toBe(true);

			liveModeStore.setMode('presentation');
			expect(get(isDeveloperMode)).toBe(false);
		});

		it('currentMode should reflect the mode', () => {
			liveModeStore.setMode('developer');
			expect(get(currentMode)).toBe('developer');

			liveModeStore.setMode('presentation');
			expect(get(currentMode)).toBe('presentation');
		});

		it('currentPreset should reflect the preset', () => {
			liveModeStore.setPreset('balanced');
			expect(get(currentPreset)).toBe('balanced');

			liveModeStore.setPreset('maximum');
			expect(get(currentPreset)).toBe('maximum');
		});
	});
});
