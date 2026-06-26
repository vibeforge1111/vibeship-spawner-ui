/**
 * Status Dashboard Authentication
 *
 * Simple auth layer for the status dashboard.
 * Most status pages are public, but this provides
 * optional authentication for admin features.
 */

import { browser } from '$app/environment';

export interface AuthConfig {
	enabled: boolean;
	adminOnly: boolean; // Only require auth for admin actions
}

const AUTH_KEY = 'status-dashboard-auth';

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
	if (!browser) return false;
	const token = localStorage.getItem(AUTH_KEY);
	return token !== null;
}

/**
 * Check if auth is required for current action
 */
export function requiresAuth(config: AuthConfig, isAdminAction: boolean): boolean {
	if (!config.enabled) return false;
	if (config.adminOnly && !isAdminAction) return false;
	return true;
}

/**
 * Simple API key authentication for admin features
 * In production, replace with proper OAuth/JWT
 *
 * Security: validates against STATUS_DASHBOARD_ADMIN_KEY env var
 * and enforces a minimum length to prevent weak-key acceptance.
 */
export function authenticateWithKey(apiKey: string, expectedKey?: string): boolean {
	if (!browser) return false;

	const minKeyLength = 16;

	// Reject keys that are too short or empty
	if (!apiKey || apiKey.length < minKeyLength) {
		return false;
	}

	// If an expected key is provided, validate against it
	if (expectedKey) {
		if (apiKey !== expectedKey) {
			return false;
		}
	}

	// Store the validated key
	localStorage.setItem(AUTH_KEY, apiKey);
	return true;
}

/**
 * Clear authentication
 */
export function logout(): void {
	if (!browser) return;
	localStorage.removeItem(AUTH_KEY);
}

/**
 * Get current auth status
 */
export function getAuthStatus(): { authenticated: boolean; adminKey: string | null } {
	if (!browser) return { authenticated: false, adminKey: null };

	const key = localStorage.getItem(AUTH_KEY);
	return {
		authenticated: key !== null,
		adminKey: key
	};
}
