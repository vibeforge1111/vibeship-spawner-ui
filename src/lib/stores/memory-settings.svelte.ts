/**
 * Memory Settings Store
 *
 * Manages configuration for Mind v5 integration:
 * - Backend selection (Lite/Standard/Auto)
 * - Endpoint configuration
 * - Learning granularity
 * - Connection status
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { memoryClient } from '$lib/services/memory-client';
import type { MemorySettings, LearningGranularity, HealthResponse } from '$lib/types/memory';
import { DEFAULT_MEMORY_SETTINGS } from '$lib/types/memory';

// ============================================
// State Types
// ============================================

export type MemoryConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MemorySettingsState {
	settings: MemorySettings;
	connectionStatus: MemoryConnectionStatus;
	detectedBackend: 'lite' | 'standard' | null;
	version: string | null;
	error: string | null;
	lastConnected: string | null;
}

// ============================================
// Local Storage Key
// ============================================

const STORAGE_KEY = 'spawner-memory-settings';

// ============================================
// Initial State
// ============================================

function loadFromStorage(): MemorySettings {
	if (!browser) return DEFAULT_MEMORY_SETTINGS;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return { ...DEFAULT_MEMORY_SETTINGS, ...parsed };
		}
	} catch {
		// Ignore parse errors
	}
	return DEFAULT_MEMORY_SETTINGS;
}

function saveToStorage(settings: MemorySettings) {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Ignore storage errors
	}
}

const initialState: MemorySettingsState = {
	settings: loadFromStorage(),
	connectionStatus: 'disconnected',
	detectedBackend: null,
	version: null,
	error: null,
	lastConnected: null
};

// ============================================
// Store
// ============================================

export const memorySettingsState = writable<MemorySettingsState>(initialState);

// ============================================
// Derived Stores
// ============================================

export const memorySettings = derived(memorySettingsState, ($state) => $state.settings);
export const isMemoryEnabled = derived(memorySettingsState, ($state) => $state.settings.enabled);
export const memoryConnectionStatus = derived(memorySettingsState, ($state) => $state.connectionStatus);
export const isMemoryConnected = derived(memorySettingsState, ($state) => $state.connectionStatus === 'connected');
export const isMemoryConnecting = derived(memorySettingsState, ($state) => $state.connectionStatus === 'connecting');
export const memoryBackend = derived(memorySettingsState, ($state) => $state.detectedBackend);
export const memoryVersion = derived(memorySettingsState, ($state) => $state.version);
export const memoryError = derived(memorySettingsState, ($state) => $state.error);

// ============================================
// Actions
// ============================================

/**
 * Update memory settings
 */
export function updateMemorySettings(updates: Partial<MemorySettings>) {
	memorySettingsState.update((state) => {
		const newSettings = { ...state.settings, ...updates };
		saveToStorage(newSettings);

		// Update memory client configuration
		memoryClient.configure({
			backend: newSettings.backend,
			liteEndpoint: newSettings.liteEndpoint,
			standardEndpoint: newSettings.standardEndpoint,
			userId: newSettings.userId
		});

		return {
			...state,
			settings: newSettings,
			// Reset connection when settings change
			connectionStatus: 'disconnected',
			detectedBackend: null,
			error: null
		};
	});
}

/**
 * Set memory enabled/disabled
 */
export function setMemoryEnabled(enabled: boolean) {
	updateMemorySettings({ enabled });
}

/**
 * Set backend type
 */
export function setMemoryBackend(backend: 'lite' | 'standard' | 'auto') {
	updateMemorySettings({ backend });
}

/**
 * Set Lite endpoint
 */
export function setLiteEndpoint(endpoint: string) {
	updateMemorySettings({ liteEndpoint: endpoint });
}

/**
 * Set Standard endpoint
 */
export function setStandardEndpoint(endpoint: string) {
	updateMemorySettings({ standardEndpoint: endpoint });
}

/**
 * Set learning granularity
 */
export function setLearningGranularity(granularity: LearningGranularity) {
	updateMemorySettings({ learningGranularity: granularity });
}

/**
 * Set user ID
 */
export function setMemoryUserId(userId: string) {
	updateMemorySettings({ userId });
}

/**
 * Connect to Mind API
 */
export async function connectMemory(): Promise<boolean> {
	const state = get(memorySettingsState);

	if (!state.settings.enabled) {
		memorySettingsState.update((s) => ({
			...s,
			error: 'Memory integration is disabled'
		}));
		return false;
	}

	memorySettingsState.update((s) => ({
		...s,
		connectionStatus: 'connecting',
		error: null
	}));

	// Configure client with current settings
	memoryClient.configure({
		backend: state.settings.backend,
		liteEndpoint: state.settings.liteEndpoint,
		standardEndpoint: state.settings.standardEndpoint,
		userId: state.settings.userId
	});

	try {
		const result = await memoryClient.checkHealth();

		if (result.success && result.data) {
			memorySettingsState.update((s) => ({
				...s,
				connectionStatus: 'connected',
				detectedBackend: result.data!.backend ?? memoryClient.getBackend(),
				version: result.data!.version,
				error: null,
				lastConnected: new Date().toISOString()
			}));
			return true;
		} else {
			memorySettingsState.update((s) => ({
				...s,
				connectionStatus: 'error',
				error: result.error ?? 'Failed to connect to Mind API'
			}));
			return false;
		}
	} catch (e) {
		memorySettingsState.update((s) => ({
			...s,
			connectionStatus: 'error',
			error: e instanceof Error ? e.message : 'Connection failed'
		}));
		return false;
	}
}

/**
 * Disconnect from Mind API
 */
export function disconnectMemory() {
	memorySettingsState.update((s) => ({
		...s,
		connectionStatus: 'disconnected',
		detectedBackend: null,
		version: null,
		error: null
	}));
}

/**
 * Test connection without changing state
 */
export async function testMemoryConnection(): Promise<{ success: boolean; backend?: string; version?: string; error?: string }> {
	const state = get(memorySettingsState);

	memoryClient.configure({
		backend: state.settings.backend,
		liteEndpoint: state.settings.liteEndpoint,
		standardEndpoint: state.settings.standardEndpoint,
		userId: state.settings.userId
	});

	const result = await memoryClient.checkHealth();

	if (result.success && result.data) {
		return {
			success: true,
			backend: result.data.backend,
			version: result.data.version
		};
	}

	return {
		success: false,
		error: result.error ?? 'Connection test failed'
	};
}

/**
 * Quick connect to local Lite tier
 */
export async function connectLiteTier(): Promise<boolean> {
	updateMemorySettings({
		backend: 'lite',
		liteEndpoint: 'http://localhost:8080'
	});
	return connectMemory();
}

/**
 * Reset settings to defaults
 */
export function resetMemorySettings() {
	memorySettingsState.set({
		...initialState,
		settings: DEFAULT_MEMORY_SETTINGS
	});
	saveToStorage(DEFAULT_MEMORY_SETTINGS);
}

/**
 * Initialize memory connection on app start
 */
export async function initializeMemory(): Promise<boolean> {
	const state = get(memorySettingsState);

	if (!state.settings.enabled) {
		return false;
	}

	// Try to connect automatically
	return connectMemory();
}

/**
 * Check if should record based on granularity setting
 */
export function shouldRecordDecision(confidence: number): boolean {
	const state = get(memorySettingsState);
	const granularity = state.settings.learningGranularity;

	switch (granularity) {
		case 'everything':
			return true;
		case 'moderate':
			return confidence >= 0.5;  // Medium threshold
		case 'significant':
			return confidence >= 0.7;  // High threshold
		case 'manual':
			return false;  // User must explicitly mark
		default:
			return true;
	}
}

/**
 * Check if should auto-extract patterns
 */
export function shouldExtractPatterns(): boolean {
	const state = get(memorySettingsState);
	return state.settings.autoExtractPatterns && state.connectionStatus === 'connected';
}
