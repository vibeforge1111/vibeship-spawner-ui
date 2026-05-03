import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Mission } from '$lib/services/mcp-client';
import { eventBridge } from '$lib/services/event-bridge';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { buildMultiLLMExecutionPack, createDefaultMultiLLMOptions } from '$lib/services/multi-llm-orchestrator';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { providerRuntime } from '$lib/server/provider-runtime';
import { applyProviderEnvOverrides } from '$lib/server/provider-config';
import { resolveSparkRunProjectPath, SparkRunWorkspaceError } from '$lib/server/spark-run-workspace';
import { normalizeTier, type SkillTier } from '$lib/server/skill-tiers';

interface SparkRunBody {
	goal?: string;
	projectPath?: string;
	providers?: string[];
	chatId?: string;
	userId?: string;
	requestId?: string;
	tier?: 'base' | 'pro';
	promptMode?: 'simple' | 'orchestrator';
	suppressRelay?: boolean;
	telegramRelay?: {
		port?: string | number;
		profile?: string;
		url?: string;
	};
}

function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

function normalizeProviderIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeTelegramRelay(value: SparkRunBody['telegramRelay']): Record<string, unknown> | null {
	if (!value || typeof value !== 'object') return null;
	const relay: Record<string, unknown> = {};
	if (typeof value.profile === 'string' && value.profile.trim()) {
		relay.profile = value.profile.trim();
	}
	if (typeof value.url === 'string' && value.url.trim()) {
		relay.url = value.url.trim();
	}
	const port = typeof value.port === 'number'
		? value.port
		: typeof value.port === 'string'
			? Number(value.port.trim())
			: NaN;
	if (Number.isFinite(port) && port > 0) {
		relay.port = Math.trunc(port);
	}
	return Object.keys(relay).length > 0 ? relay : null;
}

function createSparkMission(
	body: SparkRunBody,
	goal: string,
	selectedProviderIds: string[],
	tier: SkillTier
): Mission {
	const now = new Date().toISOString();
	const missionId = `spark-${Date.now()}`;
	const requestId = body.requestId?.trim() || missionId;
	const chatId = body.chatId?.trim() || null;
	const userId = body.userId?.trim() || 'spark-telegram';
	const telegramRelay = normalizeTelegramRelay(body.telegramRelay);

	return {
		id: missionId,
		user_id: userId,
		name: `Spark Run: ${goal.length > 140 ? goal.slice(0, 137) + '…' : goal}`,
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
			projectPath: resolveSparkRunProjectPath(body.projectPath),
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
				providers: selectedProviderIds,
				tier,
				suppressRelay: body.suppressRelay === true,
				...(telegramRelay ? { telegramRelay } : {})
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
		const configuredDefault = envRecord.DEFAULT_MISSION_PROVIDER?.trim();
		const selectedProviderIds =
			requestedProviderIds.length > 0
				? requestedProviderIds
				: configuredDefault && defaults.providers.some((p) => p.id === configuredDefault)
					? [configuredDefault]
					: defaults.providers
							.filter((provider) => provider.requiresApiKey && provider.apiKeyEnv && isConfiguredApiKey(envRecord[provider.apiKeyEnv]))
							.map((provider) => provider.id);

		if (selectedProviderIds.length === 0) {
			return json({ success: false, error: 'No runnable Spark providers are configured' }, { status: 400 });
		}

		const selectedProviders = defaults.providers
			.filter((provider) => selectedProviderIds.includes(provider.id))
			.map((provider) =>
				applyProviderEnvOverrides(provider, envRecord, {
					missionDefaultProviderId: configuredDefault || selectedProviderIds[0] || null
				})
			);
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

		const tier = normalizeTier(body.tier);
		const mission = createSparkMission(body, goal, selectedProviderIds, tier);
		const missionMetadata = mission.outputs.spark as Record<string, unknown>;
		const emitMissionEvent = (type: string, message: string, data?: Record<string, unknown>) => {
			const bridgeEvent = {
				type,
				missionId: mission.id,
				missionName: mission.name,
				source: 'spark-run',
				timestamp: new Date().toISOString(),
				message,
				data: {
					...missionMetadata,
					missionName: mission.name,
					goal,
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
			...applyProviderEnvOverrides(provider, envRecord, {
				missionDefaultProviderId: configuredDefault || selectedProviderIds[0] || null
			}),
			enabled: selectedProviderIds.includes(provider.id)
		}));

		const executionPack = buildMultiLLMExecutionPack({
			mission,
			options,
			baseUrl: new URL(event.request.url).origin
		});
		executionPack.missionId = mission.id;

		const tierNotice =
			tier === 'base'
				? '\n\n[Skill tier: BASE - load only the 30 free foundation skills. Do not request pro-only skills.]'
				: '\n\n[Skill tier: PRO - full spark-skill-graphs catalog (613 skills) is available for /api/h70-skills/<id> loading.]';

		if (body.promptMode === 'simple') {
			const simpleProviderPrompts: Record<string, string> = {};
			for (const provider of executionPack.providers) {
				simpleProviderPrompts[provider.id] = `${goal}${tierNotice}`;
			}
			executionPack.providerPrompts = simpleProviderPrompts;
		} else if (executionPack.providerPrompts) {
			for (const id of Object.keys(executionPack.providerPrompts)) {
				executionPack.providerPrompts[id] = `${executionPack.providerPrompts[id]}${tierNotice}`;
			}
		}

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
				// Per-provider task events arrive with source = provider.id (e.g. 'zai',
				// 'minimax'). Tag that as taskName so the relay labels "Task started: zai"
				// instead of the generic "task" that's the same for every provider.
				const providerId = typeof bridgeEvent.source === 'string' ? bridgeEvent.source : null;
				const isTaskEvent = typeof bridgeEvent.type === 'string' && bridgeEvent.type.startsWith('task_');
				const taskName = isTaskEvent && providerId ? providerId : bridgeEvent.taskName;
				const relayEvent = {
					...bridgeEvent,
					missionName: mission.name,
					taskName,
					source: 'spark-run',
					data: {
						...missionMetadata,
						missionName: mission.name,
						goal,
						originalSource: providerId,
						provider: providerId,
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
		if (error instanceof SparkRunWorkspaceError) {
			return json({ success: false, error: error.message }, { status: error.status });
		}
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Spark run failed' },
			{ status: 500 }
		);
	}
};
