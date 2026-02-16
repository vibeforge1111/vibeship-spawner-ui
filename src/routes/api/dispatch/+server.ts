/**
 * Provider Dispatch API
 *
 * POST: Dispatch execution pack to all configured providers in parallel.
 * GET:  Check dispatch status for a mission.
 * DELETE: Cancel all provider sessions for a mission.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { requireControlAuth, enforceRateLimit } from '$lib/server/mcp-auth';
import { eventBridge } from '$lib/services/event-bridge';
import { providerRuntime } from '$lib/server/provider-runtime';

const ALLOWED_PROVIDER_IDS = new Set(['claude', 'codex']);

function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

export const POST: RequestHandler = async (event) => {
	// Auth: allow localhost without key
	const unauthorized = requireControlAuth(event, {
		surface: 'Dispatch',
		apiKeyEnvVar: 'MCP_API_KEY',
		fallbackApiKeyEnvVar: 'EVENTS_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	// Rate limit: 10 dispatches per minute
	const rateLimited = enforceRateLimit(event, {
		scope: 'dispatch_post',
		limit: 10,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = await event.request.json();
		const { executionPack, apiKeys, workingDirectory } = body;

		if (!executionPack || !executionPack.providers || !Array.isArray(executionPack.providers)) {
			return json({ success: false, error: 'Invalid execution pack' }, { status: 400 });
		}

		if (executionPack.providers.length === 0) {
			return json(
				{ success: false, error: 'No providers in execution pack' },
				{ status: 400 }
			);
		}

		const requestedProviderIds: string[] = executionPack.providers.map((provider: { id: string }) => provider.id);
		const unsupportedProviderIds = requestedProviderIds.filter((id) => !ALLOWED_PROVIDER_IDS.has(id));
		if (unsupportedProviderIds.length > 0) {
			return json(
				{
					success: false,
					error: `Unsupported provider(s) in execution pack: ${unsupportedProviderIds.join(', ')}. Allowed: claude, codex.`
				},
				{ status: 400 }
			);
		}

		// Merge server env vars with UI-provided keys (UI keys take precedence)
		// Cast env to Record for dynamic key access (SvelteKit types it strictly)
		const envRecord = env as Record<string, string | undefined>;
		const serverEnvKeys: Record<string, string> = {};
		for (const provider of executionPack.providers) {
			if (provider.apiKeyEnv) {
				const val = envRecord[provider.apiKeyEnv];
				if (isConfiguredApiKey(val)) {
					serverEnvKeys[provider.id] = val.trim();
				}
			}
		}

		const uiApiKeys = apiKeys || {};
		const mergedApiKeys = {
			...serverEnvKeys,
			...Object.fromEntries(
				Object.entries(uiApiKeys)
					.filter(([, value]) => isConfiguredApiKey(typeof value === 'string' ? value : undefined))
					.map(([providerId, value]) => [providerId, (value as string).trim()])
			)
		};

		const missingRequiredKeyProviders = executionPack.providers
			.filter((provider: { id: string; requiresApiKey?: boolean; apiKeyEnv?: string }) => provider.requiresApiKey)
			.filter((provider: { id: string }) => !isConfiguredApiKey(mergedApiKeys[provider.id]))
			.map((provider: { id: string; label?: string; apiKeyEnv?: string }) => ({
				id: provider.id,
				label: provider.label || provider.id,
				apiKeyEnv: provider.apiKeyEnv || 'API_KEY'
			}));

		if (missingRequiredKeyProviders.length > 0) {
			return json(
				{
					success: false,
					error: `Missing required API keys: ${missingRequiredKeyProviders
						.map((provider) => `${provider.label} (${provider.apiKeyEnv})`)
						.join(', ')}`,
					missingProviders: missingRequiredKeyProviders
				},
				{ status: 400 }
			);
		}

		const result = await providerRuntime.dispatch({
			executionPack,
			apiKeys: mergedApiKeys,
			workingDirectory,
			onEvent: (evt) => {
				eventBridge.emit(evt);
			}
		});

		return json(result);
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		console.error('[Dispatch API] POST error:', error);
		return json({ success: false, error }, { status: 500 });
	}
};

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Dispatch',
		apiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const missionId = new URL(event.request.url).searchParams.get('missionId');
	if (!missionId) {
		return json({ error: 'missionId query parameter required' }, { status: 400 });
	}

	const status = providerRuntime.getMissionStatus(missionId);
	return json({ missionId, ...status });
};

export const DELETE: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Dispatch',
		apiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const missionId = new URL(event.request.url).searchParams.get('missionId');
	if (!missionId) {
		return json({ error: 'missionId query parameter required' }, { status: 400 });
	}

	await providerRuntime.cancelMission(missionId);
	return json({ success: true, missionId });
};
