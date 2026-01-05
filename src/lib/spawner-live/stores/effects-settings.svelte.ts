/**
 * Spawner Live - Effects Settings Store
 * Tunable settings for all visual effects
 */

import { writable, derived, get } from 'svelte/store';
import { type EffectsSettings, defaultEffectsSettings, effectsPresets } from '../types/animation';
import { liveModeStore } from './live-mode.svelte';

// Persistence key
const STORAGE_KEY = 'spawner-live-effects-settings';

// Load from localStorage
function loadSettings(): EffectsSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...defaultEffectsSettings, ...JSON.parse(stored) };
		}
	} catch {
		// Ignore parse errors
	}
	return defaultEffectsSettings;
}

// Save to localStorage
function saveSettings(settings: EffectsSettings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Ignore storage errors
	}
}

// Create the store
function createEffectsSettingsStore() {
	const initialSettings = loadSettings();
	const { subscribe, set, update } = writable<EffectsSettings>(initialSettings);

	return {
		subscribe,

		/**
		 * Update individual setting
		 */
		updateSetting: <K extends keyof EffectsSettings>(key: K, value: EffectsSettings[K]) => {
			update((settings) => {
				const newSettings = { ...settings, [key]: value };
				saveSettings(newSettings);
				return newSettings;
			});
		},

		/**
		 * Update nested setting (e.g., spotlights.color)
		 */
		updateNestedSetting: <K extends keyof EffectsSettings>(
			category: K,
			key: string,
			value: unknown
		) => {
			update((settings) => {
				const categorySettings = settings[category];
				if (typeof categorySettings === 'object' && categorySettings !== null) {
					const newSettings = {
						...settings,
						[category]: {
							...categorySettings,
							[key]: value
						}
					};
					saveSettings(newSettings);
					return newSettings;
				}
				return settings;
			});
		},

		/**
		 * Apply a preset
		 */
		applyPreset: (preset: 'minimal' | 'balanced' | 'maximum') => {
			const presetSettings = effectsPresets[preset];
			update((settings) => {
				const newSettings = { ...settings, ...presetSettings, preset };
				saveSettings(newSettings);
				return newSettings;
			});

			// Also update live mode store
			liveModeStore.setPreset(preset);
		},

		/**
		 * Toggle enabled state
		 */
		toggleEnabled: () => {
			update((settings) => {
				const newSettings = { ...settings, enabled: !settings.enabled };
				saveSettings(newSettings);
				return newSettings;
			});
		},

		/**
		 * Enable all effects
		 */
		enableAll: () => {
			update((settings) => {
				const newSettings: EffectsSettings = {
					...settings,
					enabled: true,
					spotlights: { ...settings.spotlights, enabled: true },
					particles: { ...settings.particles, enabled: true },
					indicators: { ...settings.indicators, enabled: true },
					completionBurst: { ...settings.completionBurst, enabled: true },
					errorShake: { ...settings.errorShake, enabled: true },
					handoffSpotlight: { ...settings.handoffSpotlight, enabled: true },
					milestone: { ...settings.milestone, enabled: true },
					progressRing: { ...settings.progressRing, enabled: true }
				};
				saveSettings(newSettings);
				return newSettings;
			});
		},

		/**
		 * Disable all effects (except core)
		 */
		disableAll: () => {
			update((settings) => {
				const newSettings: EffectsSettings = {
					...settings,
					spotlights: { ...settings.spotlights, enabled: false },
					particles: { ...settings.particles, enabled: false },
					indicators: { ...settings.indicators, enabled: false },
					completionBurst: { ...settings.completionBurst, enabled: false },
					errorShake: { ...settings.errorShake, enabled: false },
					handoffSpotlight: { ...settings.handoffSpotlight, enabled: false },
					milestone: { ...settings.milestone, enabled: false },
					progressRing: { ...settings.progressRing, enabled: false }
				};
				saveSettings(newSettings);
				return newSettings;
			});
		},

		/**
		 * Reset to defaults
		 */
		reset: () => {
			saveSettings(defaultEffectsSettings);
			set(defaultEffectsSettings);
		},

		/**
		 * Get current settings (non-reactive)
		 */
		getCurrent: () => get({ subscribe })
	};
}

// Export the store
export const effectsSettings = createEffectsSettingsStore();

// Derived stores for specific effect states
export const spotlightsEnabled = derived(effectsSettings, ($s) => $s.enabled && $s.spotlights.enabled);
export const particlesEnabled = derived(effectsSettings, ($s) => $s.enabled && $s.particles.enabled);
export const celebrationsEnabled = derived(effectsSettings, ($s) => $s.enabled && $s.milestone.enabled);
