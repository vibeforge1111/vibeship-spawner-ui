import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Mission } from '$lib/services/mcp-client';
import { eventBridge } from '$lib/services/event-bridge';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { buildMultiLLMExecutionPack, createDefaultMultiLLMOptions } from '$lib/services/multi-llm-orchestrator';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { providerRuntime } from '$lib/server/provider-runtime';

interface SparkRunBody {
	goal?: string;
	projectPath?: string;
	providers?: string[];
	chatId?: string;
	userId?: string;
	requestId?: string;
}

function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

function normalizeProviderIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function createSparkMission(body: SparkRunBody, goal: string, selectedProviderIds: string[]): Mission {
	const now = new Date().toISOString();
	const missionId = `spark-${Date.now()}`;
	const requestId = body.requestId?.trim() || missionId;
	const chatId = body.chatId?.trim() || null;
	const userId = body.userId?.trim() || 'spark-telegram';

	return {
		id: missionId,
		user_id: userId,
		name: `Spark Run: ${goal.slice(0, 60)}`,
		description: goal,
		mode: 'multi-llm-orchestrator',
		status: 'ready',
		agents: [
			{
				id: 'spark-orchestrator',
				name: 'Spark Orchestrator',
				role: 'orchestrator',
				skills: []
			}
		],
		tasks: [
			{
				id: 'task-1',
				title: 'Execute goal',
				description: goal,
				assignedTo: 'spark-orchestrator',
				status: 'pending',
				handoffType: 'parallel'
			}
		],
		context: {
			projectPath: body.projectPath?.trim() || 'C:/Users/USER/Desktop',
			projectType: 'tool',
			goals: [goal]
		},
		current_task_id: null,
		outputs: {
			spark: {
				source: 'telegram',
				requestId,
				chatId,
				userId,
				providers: selectedProviderIds
			}
		},
		error: null,
		created_at: now,
		updated_at: now,
		started_at: null,
		completed_at: null
	};
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'SparkRun',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'spark_run',
		limit: 30,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as SparkRunBody;
		const goal = body.goal?.trim();
		if (!goal) {
			return json({ success: false, error: 'goal is required' }, { status: 400 });
		}

		const defaults = createDefaultMultiLLMOptions();
		const envRecord = env as Record<string, string | undefined>;
		const requestedProviderIds = normalizeProviderIds(body.providers);
		const selectedProviderIds =
			requestedProviderIds.length > 0
				? requestedProviderIds
				: defaults.providers
						.filter((provider) => provider.requiresApiKey && provider.apiKeyEnv && isConfiguredApiKey(envRecord[provider.apiKeyEnv]))
						.map((provider) => provider.id);

		if (selectedProviderIds.length === 0) {
			return json({ success: false, error: 'No runnable Spark providers are configured' }, { status: 400 });
		}

		const selectedProviders = defaults.providers.filter((provider) => selectedProviderIds.includes(provider.id));
		if (selectedProviders.length === 0) {
			return json({ success: false, error: `Unknown providerIds: ${selectedProviderIds.join(', ')}` }, { status: 400 });
		}

		const missingKeyProviders = selectedProviders
			.filter((provider) => provider.requiresApiKey)
			.filter((provider) => !provider.apiKeyEnv || !isConfiguredApiKey(envRecord[provider.apiKeyEnv]));
		if (missingKeyProviders.length > 0) {
			return json(
				{ success: false, error: `Missing provider keys: ${missingKeyProviders.map((provider) => provider.id).join(', ')}` },
				{ status: 400 }
			);
		}

		const mission = createSparkMission(body, goal, selectedProviderIds);
		const missionMetadata = mission.outputs.spark as Record<string, unknown>;
		const emitMissionEvent = (type: string, message: string, data?: Record<string, unknown>) => {
			const bridgeEvent = {
				type,
				missionId: mission.id,
				source: 'spark-run',
				timestamp: new Date().toISOString(),
				message,
				data: {
					...missionMetadata,
					...(data || {})
				}
			};
			eventBridge.emit(bridgeEvent);
			void relayMissionControlEvent(bridgeEvent);
		};

		emitMissionEvent('mission_created', `Mission created (${mission.id}).`);
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.autoEnableByKeys = false;
		options.autoDispatch = true;
		options.autoRouteByTask = false;
		options.strategy = selectedProviders.length > 1 ? 'parallel_consensus' : 'single';
		options.primaryProviderId = selectedProviderIds[0];
		options.providers = defaults.providers.map((provider) => ({
			...provider,
			enabled: selectedProviderIds.includes(provider.id)
		}));

		const executionPack = buildMultiLLMExecutionPack({
			mission,
			options,
			baseUrl: new URL(event.request.url).origin
		});

		const apiKeys = Object.fromEntries(
			selectedProviders
				.filter((provider) => provider.apiKeyEnv)
				.map((provider) => [provider.id, envRecord[provider.apiKeyEnv!]?.trim() || ''])
				.filter((entry) => entry[1].length > 0)
		);

		const dispatchResult = await providerRuntime.dispatch({
			executionPack,
			apiKeys,
			workingDirectory: mission.context.projectPath,
			onEvent: (bridgeEvent) => {
				const relayEvent = {
					...bridgeEvent,
					data: {
						...missionMetadata,
						...(bridgeEvent.data || {})
					}
				};
				eventBridge.emit(relayEvent);
				void relayMissionControlEvent(relayEvent);
			}
		});

		emitMissionEvent('mission_started', `Mission started (${dispatchResult.missionId}).`, {
			startedAt: dispatchResult.startedAt
		});

		return json({
			success: true,
			missionId: dispatchResult.missionId,
			requestId: body.requestId?.trim() || mission.id,
			providers: selectedProviderIds,
			startedAt: dispatchResult.startedAt
		});
	} catch (error) {
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Spark run failed' },
			{ status: 500 }
		);
	}
};
