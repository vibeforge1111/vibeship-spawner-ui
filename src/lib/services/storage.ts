/**
 * Storage Service
 *
 * Centralized localStorage abstraction with:
 * - Browser environment check (SSR-safe)
 * - Type-safe get/set with JSON serialization
 * - Consistent error handling
 *
 * H70 Skills Applied: code-quality
 * - Simple functions over complex abstractions
 * - No prefix to maintain backward compatibility
 */

import { browser } from '$app/environment';

/**
 * Get a JSON value from localStorage with type safety
 */
export function storageGet<T>(key: string, defaultValue: T): T {
	if (!browser) return defaultValue;
	try {
		const item = localStorage.getItem(key);
		return item ? JSON.parse(item) : defaultValue;
	} catch {
		return defaultValue;
	}
}

/**
 * Set a JSON value in localStorage
 */
export function storageSet<T>(key: string, value: T): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage full or disabled - fail silently
	}
}

/**
 * Remove a value from localStorage
 */
export function storageRemove(key: string): void {
	if (!browser) return;
	localStorage.removeItem(key);
}

/**
 * Get a raw string value (no JSON parsing)
 */
export function storageGetRaw(key: string): string | null {
	if (!browser) return null;
	return localStorage.getItem(key);
}

/**
 * Set a raw string value (no JSON serialization)
 */
export function storageSetRaw(key: string, value: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage full or disabled - fail silently
	}
}

/**
 * Check if a key exists
 */
export function storageHas(key: string): boolean {
	if (!browser) return false;
	return localStorage.getItem(key) !== null;
}
