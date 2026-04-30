import { env } from '$env/dynamic/private';
import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import { eventBridge, type BridgeEvent } from '$lib/services/event-bridge';
import type { Skill } from '$lib/stores/skills.svelte';
import { buildMissionFromCanvas } from '$lib/services/mission-builder';
import { matchTaskToSkills } from '$lib/services/h70-skill-matcher';
import {
	buildMultiLLMExecutionPack,
	DEFAULT_MULTI_LLM_PROVIDERS,
	type MultiLLMProviderConfig
} from '$lib/services/multi-llm-orchestrator';
import { resolveRelayMissionProvider } from '$lib/services/relay-mission-provider';
import {
	getMissionControlBoard,
	relayMissionControlEvent,
	type MissionControlBridgeEvent,
	type MissionControlBoardEntry
} from '$lib/server/mission-control-relay';
import { providerRuntime } from '$lib/server/provider-runtime';
import { getTierSkills, normalizeTier, type SkillTier } from '$lib/server/skill-tiers';

interface PrdAutoSkill {
	id?: string;
	name?: string;
	description?: string;
	category?: string;
	tier?: string;
	tags?: string[];
	triggers?: string[];
}

export interface PrdCanvasLoadForAutoDispatch {
	requestId: string;
	missionId: string;
	pipelineId: string;
	pipelineName: string;
	tier?: string;
	nodes: Array<{
		skill?: PrdAutoSkill;
		position?: CanvasNode['position'];
	}>;
	connections: Array<{ sourceIndex?: number; targetIndex?: number }>;
	autoRun?: boolean;
	executionPrompt?: string;
	relay?: Record<string, unknown>;
	buildMode?: 'direct' | 'advanced_prd';
	buildModeReason?: string;
}

export interface PrdAutoDispatchResult {
	started: boolean;
	skipped?: boolean;
	reason?: string;
	missionId: string;
	projectPath?: string;
	providerId?: string;
	error?: string;
}

type TaskForSkillPairing = { id: string; title: string; description?: string };

const NO_BUILD_INCOMPATIBLE_SKILLS = new Set([
	'vite',
	'nextjs-app-router',
	'sveltekit',
	'svelte-kit',
	'react-patterns',
	'react-native-specialist',
	'tailwind-css',
	'tailwind-ui',
	'typescript-strict'
]);

function normalizeProviderId(value: string | undefined): string | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	return DEFAULT_MULTI_LLM_PROVIDERS.some((provider) => provider.id === normalized) ? normalized : null;
}

function getSparkDefaultProviderId(): string {
	const envRecord = env as Record<string, string | undefined>;
	return (
		normalizeProviderId(envRecord.DEFAULT_MISSION_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_MISSION_LLM_BOT_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_MISSION_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_BOT_DEFAULT_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_SPARK_LLM_PROVIDER) ||
		'codex'
	);
}

function configuredProvider(provider: MultiLLMProviderConfig): MultiLLMProviderConfig {
	const envRecord = env as Record<string, string | undefined>;
	const upperId = provider.id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
	const model = envRecord[`SPARK_${upperId}_MODEL`] || envRecord[`${upperId}_MODEL`] || provider.model;
	const baseUrl =
		envRecord[`SPARK_${upperId}_BASE_URL`] || envRecord[`${upperId}_BASE_URL`] || provider.baseUrl;
	const commandTemplate =
		envRecord[`SPARK_${upperId}_COMMAND_TEMPLATE`] ||
		envRecord[`${upperId}_COMMAND_TEMPLATE`] ||
		provider.commandTemplate;
	return {
		...provider,
		model,
		...(baseUrl ? { baseUrl } : {}),
		...(commandTemplate ? { commandTemplate } : {})
	};
}

function isKnownNonTerminalMissionStatus(status: MissionControlBoardEntry['status']): boolean {
	return status === 'created' || status === 'running' || status === 'paused';
}

export function shouldAutoDispatchPrdLoad(load: PrdCanvasLoadForAutoDispatch): { ok: boolean; reason?: string } {
	if (!(load.autoRun || load.relay?.autoRun === true)) {
		return { ok: false, reason: 'autoRun disabled' };
	}
	if (!load.missionId?.trim()) {
		return { ok: false, reason: 'missing mission id' };
	}
	if (!Array.isArray(load.nodes) || load.nodes.length === 0) {
		return { ok: false, reason: 'no canvas nodes' };
	}

	const board = getMissionControlBoard();
	for (const status of ['running', 'completed', 'failed', 'cancelled', 'paused'] as const) {
		if ((board[status] || []).some((entry) => entry.missionId === load.missionId)) {
			const terminal = !isKnownNonTerminalMissionStatus(status);
			return {
				ok: false,
				reason: terminal
					? `mission already ${status}`
					: `mission already ${status}; backend dispatch will not duplicate it`
			};
		}
	}

	return { ok: true };
}

export function canvasLoadToMissionGraph(load: PrdCanvasLoadForAutoDispatch): {
	nodes: CanvasNode[];
	connections: Connection[];
} {
	const nodes: CanvasNode[] = load.nodes.map((node, index) => {
		const rawSkill = node.skill || {};
		const skill: Skill = {
			id: rawSkill.id || `task-${index + 1}`,
			name: rawSkill.name || `Task ${index + 1}`,
			description: rawSkill.description || `Execute task ${index + 1}`,
			category: 'development',
			tier: 'free',
			tags: Array.isArray(rawSkill.tags) ? rawSkill.tags : [],
			triggers: Array.isArray(rawSkill.triggers) ? rawSkill.triggers : []
		};
		const id = `node-${index + 1}-${String(skill.id || `task-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
		return {
			id,
			skillId: skill.id,
			skill,
			position: node.position || { x: 160 + index * 320, y: 140 },
			status: 'queued'
		};
	});

	const connections: Connection[] = load.connections
		.map((connection, index) => {
			const sourceIndex = Number(connection.sourceIndex);
			const targetIndex = Number(connection.targetIndex);
			const source = nodes[sourceIndex];
			const target = nodes[targetIndex];
			if (!source || !target) return null;
			return {
				id: `conn-${index + 1}-${source.id}-to-${target.id}`,
				sourceNodeId: source.id,
				sourcePortId: 'output',
				targetNodeId: target.id,
				targetPortId: 'input'
			};
		})
		.filter((connection): connection is Connection => Boolean(connection));

	return { nodes, connections };
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeLoadTier(load: PrdCanvasLoadForAutoDispatch): SkillTier {
	const relayTier = typeof load.relay?.tier === 'string' ? load.relay.tier : undefined;
	return normalizeTier(load.tier ?? relayTier);
}

function isNoBuildVanillaLoad(load: PrdCanvasLoadForAutoDispatch): boolean {
	const text = [
		load.executionPrompt || '',
		typeof load.relay?.goal === 'string' ? load.relay.goal : '',
		load.buildModeReason || '',
		...load.nodes.flatMap((node) => [node.skill?.name || '', node.skill?.description || ''])
	].join('\n').toLowerCase();

	return (
		/\bno\s+build\s+step\b/.test(text) ||
		/\bvanilla[-\s]?js\b/.test(text) ||
		/\bno\s+dependencies\b/.test(text) ||
		/\bopen(?:ing)?\s+index\.html\s+directly\b/.test(text)
	);
}

function filterMissionContractSkills(skills: string[], load: PrdCanvasLoadForAutoDispatch): string[] {
	if (!isNoBuildVanillaLoad(load)) return skills;
	return skills.filter((skill) => !NO_BUILD_INCOMPATIBLE_SKILLS.has(skill));
}

function mergeSkillIds(skillIds: string[], allowedSkillIds: Set<string>, maxSkills: number): string[] {
	const merged: string[] = [];
	for (const skillId of skillIds) {
		if (!allowedSkillIds.has(skillId) || merged.includes(skillId)) continue;
		merged.push(skillId);
		if (merged.length >= maxSkills) break;
	}
	return merged;
}

function nodeProvidedSkillIds(loadNode: PrdCanvasLoadForAutoDispatch['nodes'][number] | undefined): string[] {
	if (!loadNode?.skill) return [];
	return [
		...stringList(loadNode.skill.tags),
		...(typeof loadNode.skill.id === 'string' ? [loadNode.skill.id] : [])
	];
}

export async function buildAutoDispatchTaskSkillMap(
	load: PrdCanvasLoadForAutoDispatch,
	tasks: TaskForSkillPairing[],
	existingTaskSkillMap?: Map<string, string[]>
): Promise<Map<string, string[]>> {
	const tier = normalizeLoadTier(load);
	const allowedSkillIds = new Set((await getTierSkills(tier)).map((skill) => skill.id));
	const maxSkillsPerTask = tier === 'base' ? 3 : 5;
	const taskSkillMap = new Map<string, string[]>();

	for (const [index, task] of tasks.entries()) {
		const loadNode = load.nodes[index];
		const providedSkills = nodeProvidedSkillIds(loadNode);
		const inferredSkills = matchTaskToSkills(task.title, task.description, maxSkillsPerTask);
		const existingSkills = existingTaskSkillMap?.get(task.id) || [];
		const skills = mergeSkillIds(
			filterMissionContractSkills([...existingSkills, ...providedSkills, ...inferredSkills], load),
			allowedSkillIds,
			maxSkillsPerTask
		);

		if (skills.length > 0) {
			taskSkillMap.set(task.id, skills);
		}
	}

	return taskSkillMap;
}

export function inferProjectPathFromPrdLoad(load: PrdCanvasLoadForAutoDispatch): string {
	const text = [
		load.executionPrompt || '',
		typeof load.relay?.goal === 'string' ? load.relay.goal : '',
		...load.nodes.map((node) => node.skill?.description || '')
	].join('\n');
	const labeledPath =
		text.match(/(?:target operating-system folder|project path|target folder|create it at|build this at)\s*:?\s*`?((?:[A-Z]:[\\/]|\/)[^\r\n`]+)/i)?.[1] ||
		text.match(/\bat\s+`?((?:[A-Z]:[\\/]|\/)[^\r\n`]+)/i)?.[1];
	return (
		labeledPath
			?.trim()
			.replace(/:\s+.*$/i, '')
			.replace(/\s+(?:as|inside|with|and)\b.*$/i, '')
			.replace(/[).,;]+$/, '') || '.'
	);
}

function plannedTasksFromMission(
	tasks: TaskForSkillPairing[],
	taskSkillMap: Map<string, string[]>
): Array<{ title: string; skills: string[] }> {
	return tasks
		.map((task) => {
			const title = task.title.replace(/^task-[^:]+:\s*/i, '').trim();
			if (!title) return null;
			return {
				title,
				skills: taskSkillMap.get(task.id) || []
			};
		})
		.filter((task): task is { title: string; skills: string[] } => Boolean(task));
}

export async function autoDispatchPrdCanvasLoad(load: PrdCanvasLoadForAutoDispatch): Promise<PrdAutoDispatchResult> {
	const allowed = shouldAutoDispatchPrdLoad(load);
	if (!allowed.ok) {
		return { started: false, skipped: true, reason: allowed.reason, missionId: load.missionId };
	}

	try {
		const runtimeStatus = providerRuntime.getMissionStatus(load.missionId);
		const providerStatuses = Object.values(runtimeStatus.providers || {});
		if (
			providerStatuses.some((status) => status === 'running' || status === 'idle') ||
			(runtimeStatus.snapshotAvailable && !runtimeStatus.allComplete)
		) {
			return {
				started: false,
				skipped: true,
				reason: 'provider runtime already has an active dispatch for this mission',
				missionId: load.missionId
			};
		}

		const graph = canvasLoadToMissionGraph(load);
		const projectPath = inferProjectPathFromPrdLoad(load);
		const provider = resolveRelayMissionProvider(
			DEFAULT_MULTI_LLM_PROVIDERS.map(configuredProvider),
			getSparkDefaultProviderId()
		);
		if (!provider) {
			return {
				started: false,
				missionId: load.missionId,
				projectPath,
				error: 'No mission provider is available for PRD auto-dispatch'
			};
		}

		const buildResult = await buildMissionFromCanvas(graph.nodes, graph.connections, {
			missionId: load.missionId,
			name: load.pipelineName,
			description: load.executionPrompt || load.pipelineName,
			mode: 'multi-llm-orchestrator',
			projectPath,
			projectType: load.buildMode === 'advanced_prd' ? 'advanced-prd-build' : 'direct-build',
			goals: [load.executionPrompt || load.pipelineName],
			loadH70Skills: false
		});

		if (!buildResult.success || !buildResult.mission) {
			return {
				started: false,
				missionId: load.missionId,
				projectPath,
				error: buildResult.error || 'Failed to build mission from PRD canvas'
			};
		}

		const taskSkillMap = await buildAutoDispatchTaskSkillMap(load, buildResult.mission.tasks, buildResult.taskSkillMap);

		const executionPack = buildMultiLLMExecutionPack({
			mission: buildResult.mission,
			taskSkillMap,
			baseUrl: 'http://127.0.0.1:3333',
			options: {
				enabled: true,
				strategy: 'single',
				primaryProviderId: provider.id,
				autoEnableByKeys: true,
				autoRouteByTask: false,
				autoDispatch: true,
				apiKeys: {},
				keyPresence: {},
				mcpCapabilities: [],
				mcpTools: [],
				taskProviderPreferences: {},
				providers: DEFAULT_MULTI_LLM_PROVIDERS.map((candidate) => ({
					...configuredProvider(candidate),
					enabled: candidate.id === provider.id
				}))
			}
		});
		executionPack.missionId = load.missionId;

		const relayData = {
			...load.relay,
			missionName: load.pipelineName,
			tier: normalizeLoadTier(load),
			plannedTasks: plannedTasksFromMission(buildResult.mission.tasks, taskSkillMap),
			providers: [provider.id]
		};
		const onEvent = (bridgeEvent: BridgeEvent) => {
			const event: BridgeEvent = {
				...bridgeEvent,
				source:
					typeof bridgeEvent.source === 'string' && bridgeEvent.source !== 'spawner-ui'
						? bridgeEvent.source
						: 'prd-auto-dispatch',
				data: {
					...relayData,
					...(bridgeEvent.data || {})
				}
			};
			eventBridge.emit(event);
			void relayMissionControlEvent(event as unknown as MissionControlBridgeEvent);
		};

		const missionStartedEvent: BridgeEvent = {
			type: 'mission_started',
			missionId: load.missionId,
			source: 'prd-auto-dispatch',
			timestamp: new Date().toISOString(),
			message: `Auto-started ${load.pipelineName} with ${provider.label}`,
			data: relayData
		};
		eventBridge.emit(missionStartedEvent);
		void relayMissionControlEvent({
			...missionStartedEvent,
			missionName: load.pipelineName
		});

		await providerRuntime.dispatch({
			executionPack,
			apiKeys: {},
			workingDirectory: projectPath,
			onEvent
		});

		return {
			started: true,
			missionId: load.missionId,
			projectPath,
			providerId: provider.id
		};
	} catch (error) {
		return {
			started: false,
			missionId: load.missionId,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
