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
import { parseJsonOrFallback } from '$lib/utils/safe-json';

/**
 * Get a JSON value from localStorage with type safety
 */
export function storageGet<T>(key: string, defaultValue: T): T {
	if (!browser) return defaultValue;
	try {
		const item = localStorage.getItem(key);
		return item ? parseJsonOrFallback<T>(item, defaultValue, `storage:${key}`) : defaultValue;
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
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage unavailable or blocked - match other helpers and fail silently
	}
}

/**
 * Get a raw string value (no JSON parsing)
 */
export function storageGetRaw(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
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
	try {
		return localStorage.getItem(key) !== null;
	} catch {
		return false;
	}
}
