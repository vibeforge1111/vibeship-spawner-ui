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
import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';
import { getMissionControlBoard, relayMissionControlEvent } from '$lib/server/mission-control-relay';

const ALLOWED_PROVIDER_IDS = new Set(DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => provider.id));
const ALLOWED_PROVIDER_LABEL = [...ALLOWED_PROVIDER_IDS].join(', ');

function _plannedTasksFromExecutionPack(executionPack: {
	mcpTaskPlans?: Record<string, { taskTitle?: unknown }>;
}): Array<{ title: string; skills: string[] }> {
	if (!executionPack.mcpTaskPlans || typeof executionPack.mcpTaskPlans !== 'object') return [];
	return Object.values(executionPack.mcpTaskPlans)
		.map((task): { title: string; skills: string[] } | null => {
			const title = typeof task.taskTitle === 'string' ? task.taskTitle.trim() : '';
			return title ? { title, skills: [] as string[] } : null;
		})
		.filter((task): task is { title: string; skills: string[] } => Boolean(task));
}

export function _terminalBoardStatusForAutoRun(
	missionId: string,
	autoRun: boolean,
	board = getMissionControlBoard()
): 'running' | 'created' | 'completed' | 'failed' | null {
	if (!autoRun) return null;
	if (board.running?.some((entry) => entry.missionId === missionId)) return 'running';
	if (board.created?.some((entry) => entry.missionId === missionId)) return 'created';
	if (board.completed?.some((entry) => entry.missionId === missionId)) return 'completed';
	if (board.failed?.some((entry) => entry.missionId === missionId)) return 'failed';
	return null;
}

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
		const { executionPack, apiKeys, workingDirectory, relay } = body;

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
					error: `Unsupported provider(s) in execution pack: ${unsupportedProviderIds.join(', ')}. Allowed: ${ALLOWED_PROVIDER_LABEL}.`
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
						.map((provider: { id: string; label: string; apiKeyEnv: string }) => `${provider.label} (${provider.apiKeyEnv})`)
						.join(', ')}`,
					missingProviders: missingRequiredKeyProviders
				},
				{ status: 400 }
			);
		}

		const relayMeta =
			relay && typeof relay === 'object'
				? {
						chatId: typeof relay.chatId === 'string' ? relay.chatId : undefined,
						userId: typeof relay.userId === 'string' ? relay.userId : undefined,
						requestId: typeof relay.requestId === 'string' ? relay.requestId : undefined,
						goal: typeof relay.goal === 'string' ? relay.goal : undefined,
						telegramRelay:
							relay.telegramRelay && typeof relay.telegramRelay === 'object'
								? relay.telegramRelay
								: undefined
					}
				: {};
		const relayData = {
			...relayMeta,
			missionName: typeof executionPack.masterPrompt === 'string'
				? executionPack.masterPrompt.match(/Mission:\s*(.+)/)?.[1]
				: undefined,
			plannedTasks: _plannedTasksFromExecutionPack(executionPack),
			providers: executionPack.providers.map((provider: { id: string }) => provider.id)
		};
		const terminalStatus = _terminalBoardStatusForAutoRun(
			executionPack.missionId,
			relay && typeof relay === 'object' && relay.autoRun === true
		);
		if (terminalStatus) {
			return json({
				success: true,
				missionId: executionPack.missionId,
				skipped: true,
				reason: `Auto-run skipped because mission is already ${terminalStatus}`,
				sessions: Object.fromEntries(
					executionPack.providers.map((provider: { id: string }) => [provider.id, { status: terminalStatus }])
				),
				startedAt: new Date().toISOString()
			});
		}
		const relayBridgeEvent = (bridgeEvent: Record<string, unknown>) => {
			const relayEvent = {
				...bridgeEvent,
				source:
					typeof bridgeEvent.source === 'string' && bridgeEvent.source !== 'spawner-ui'
						? bridgeEvent.source
						: 'canvas-dispatch',
				data: {
					...relayData,
					...((bridgeEvent.data as Record<string, unknown> | undefined) || {})
				}
			};
			void relayMissionControlEvent(relayEvent);
		};

		const missionCreatedEvent = {
			type: 'mission_created',
			missionId: executionPack.missionId,
			source: 'canvas-dispatch',
			timestamp: new Date().toISOString(),
			message: `Canvas mission created for ${executionPack.providers.length} provider(s)`,
			data: relayData
		};
		eventBridge.emit(missionCreatedEvent);
		void relayMissionControlEvent(missionCreatedEvent);

		const result = await providerRuntime.dispatch({
			executionPack,
			apiKeys: mergedApiKeys,
			workingDirectory,
			onEvent: (evt) => {
				eventBridge.emit(evt);
				relayBridgeEvent(evt as unknown as Record<string, unknown>);
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
