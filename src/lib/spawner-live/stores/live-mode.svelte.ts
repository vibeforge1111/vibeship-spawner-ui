/**
 * Spawner Live - Live Mode Store
 * Toggle between Presentation and Developer modes
 */

import { writable, derived } from 'svelte/store';

export type LiveMode = 'presentation' | 'developer';
export type EffectPreset = 'minimal' | 'balanced' | 'maximum';

interface LiveModeState {
	mode: LiveMode;
	preset: EffectPreset;
	enabled: boolean;
	reducedMotion: boolean;
}

// Persistence key
const STORAGE_KEY = 'spawner-live-mode';

// Load from localStorage
function loadState(): LiveModeState {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Ignore parse errors
	}

	return {
		mode: 'presentation',
		preset: 'balanced',
		enabled: true,
		reducedMotion: false
	};
}

// Save to localStorage
function saveState(state: LiveModeState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignore storage errors
	}
}

// Create the store
function createLiveModeStore() {
	const initialState = loadState();
	const { subscribe, set, update } = writable<LiveModeState>(initialState);

	return {
		subscribe,

		/**
		 * Toggle between presentation and developer modes
		 */
		toggle: () => {
			update((state) => {
				const newState = {
					...state,
					mode: state.mode === 'presentation' ? 'developer' : 'presentation'
				} as LiveModeState;
				saveState(newState);
				return newState;
			});
		},

		/**
		 * Set mode directly
		 */
		setMode: (mode: LiveMode) => {
			update((state) => {
				const newState = { ...state, mode };
				saveState(newState);
				return newState;
			});
		},

		/**
		 * Set effect preset
		 */
		setPreset: (preset: EffectPreset) => {
			update((state) => {
				const newState = { ...state, preset };
				saveState(newState);
				return newState;
			});
		},

		/**
		 * Enable/disable live mode entirely
		 */
		setEnabled: (enabled: boolean) => {
			update((state) => {
				const newState = { ...state, enabled };
				saveState(newState);
				return newState;
			});
		},

		/**
		 * Set reduced motion preference
		 */
		setReducedMotion: (reducedMotion: boolean) => {
			update((state) => {
				const newState = { ...state, reducedMotion };
				saveState(newState);
				return newState;
			});
		},

		/**
		 * Reset to defaults
		 */
		reset: () => {
			const defaultState: LiveModeState = {
				mode: 'presentation',
				preset: 'balanced',
				enabled: true,
				reducedMotion: false
			};
			saveState(defaultState);
			set(defaultState);
		}
	};
}

// Export the store
export const liveModeStore = createLiveModeStore();

// Derived stores for convenience
export const currentMode = derived(liveModeStore, ($store) => $store.mode);
export const currentPreset = derived(liveModeStore, ($store) => $store.preset);
export const isLiveEnabled = derived(liveModeStore, ($store) => $store.enabled);
export const isPresentationMode = derived(liveModeStore, ($store) => $store.mode === 'presentation');
export const isDeveloperMode = derived(liveModeStore, ($store) => $store.mode === 'developer');
