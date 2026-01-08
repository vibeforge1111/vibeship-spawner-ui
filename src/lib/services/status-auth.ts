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
 */
export function authenticateWithKey(apiKey: string): boolean {
	if (!browser) return false;

	// For demo: accept any non-empty key
	// In production: validate against server
	if (apiKey && apiKey.length >= 8) {
		localStorage.setItem(AUTH_KEY, apiKey);
		return true;
	}
	return false;
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
