import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { autoDispatchPrdCanvasLoad } from '$lib/server/prd-auto-dispatch';
import {
	missionControlPathForMission,
	resolveMissionControlAccess
} from '$lib/server/mission-control-access';
import { spawnerStateDir } from '$lib/server/spawner-state';
import {
	capabilityProposalSummary,
	normalizeCapabilityProposalPacket
} from '$lib/server/capability-proposal-packet';
import { extractTraceRef, normalizeTraceRef, traceRefFromMissionId } from '$lib/server/trace-ref';

function getSpawnerDir(): string {
	return spawnerStateDir();
}

function resultFilePath(requestId: string): string {
	const safe = requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
	return join(getSpawnerDir(), 'results', `${safe}.json`);
}

function normalizeTelegramRelay(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = value as Record<string, unknown>;
	const relay: Record<string, unknown> = {};
	if (typeof raw.profile === 'string' && raw.profile.trim()) {
		relay.profile = raw.profile.trim();
	}
	if (typeof raw.url === 'string' && raw.url.trim()) {
		relay.url = raw.url.trim();
	}
	const port = typeof raw.port === 'number' ? raw.port : typeof raw.port === 'string' ? Number(raw.port.trim()) : NaN;
	if (Number.isFinite(port) && port > 0) {
		relay.port = Math.trunc(port);
	}
	return Object.keys(relay).length > 0 ? relay : undefined;
}

function normalizeRequestId(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function missionIdFromRequestId(requestId: string): string {
	const normalized = normalizeRequestId(requestId);
	const stamp = normalized.match(/(\d{10,})$/)?.[1];
	return `mission-${stamp || normalized}`;
}

interface TaskRecord {
	id: string;
	title: string;
	summary?: string;
	description?: string;
	skills?: string[];
	dependencies?: string[];
	workspaceTargets?: string[];
	acceptanceCriteria?: string[];
	verificationCommands?: string[];
}

function executionTextFromResult(parsed: {
	projectName?: string;
	executionPrompt?: string;
	tasks?: TaskRecord[];
}): string {
	if (typeof parsed.executionPrompt === 'string' && parsed.executionPrompt.trim()) {
		return parsed.executionPrompt;
	}
	const lines = [
		`Build ${parsed.projectName || 'the requested project'} from the structured PRD canvas.`,
		...(parsed.tasks || []).flatMap((task) => [
			`Task ${task.id}: ${task.title}`,
			...(task.summary ? [`Summary: ${task.summary}`] : []),
			...(task.description ? [`Description: ${task.description}`] : []),
			...((task.acceptanceCriteria || []).map((criterion) => `Acceptance: ${criterion}`)),
			...((task.verificationCommands || []).map((command) => `Verify: ${command}`))
		])
	];
	return lines.join('\n');
}

function storedCanvasLoad(load: Record<string, unknown>): Record<string, unknown> {
	const { executionPrompt: _executionPrompt, metadata, ...rest } = load;
	const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
		? (metadata as Record<string, unknown>)
		: {};
	return {
		...rest,
		metadata: {
			...metadataRecord,
			instructionTextRedacted: true,
			instructionTextStorage: 'ephemeral_dispatch_only'
		},
		instructionTextRedacted: true
	};
}

function taskSkillId(taskId: string): string {
	const normalized = taskId.trim() || 'task';
	return normalized.startsWith('task-') ? normalized : `task-${normalized}`;
}

function taskDisplayName(task: TaskRecord): string {
	const title = (task.title || task.id || 'Untitled task').trim();
	const prefix = `${task.id}:`;
	return title.startsWith(prefix) ? title.slice(prefix.length).trim() || title : title;
}

function taskSkillTags(task: TaskRecord): string[] {
	return [...new Set((task.skills || []).map((skill) => skill.trim()).filter(Boolean))];
}

function buildTaskDescription(task: TaskRecord): string {
	const lines = [task.summary || task.description || task.title];

	if (task.workspaceTargets?.length) {
		lines.push('', 'Workspace targets:', ...task.workspaceTargets.map((target) => `- ${target}`));
	}

	if (task.acceptanceCriteria?.length) {
		lines.push('', 'Acceptance criteria:', ...task.acceptanceCriteria.map((criterion) => `- ${criterion}`));
	}

	if (task.verificationCommands?.length) {
		lines.push('', 'Verification commands:', ...task.verificationCommands.map((command) => `- ${command}`));
	}

	return lines.join('\n');
}

function taskToNode(task: TaskRecord, index: number) {
	const row = Math.floor(index / 3);
	const col = index % 3;
	const skills = taskSkillTags(task);
	return {
		skill: {
			id: taskSkillId(task.id),
			name: taskDisplayName(task),
			description: buildTaskDescription(task),
			category: 'project',
			tier: 'free',
			tags: skills,
			skillChain: skills,
			chainDescription: skills.length > 0 ? `Paired skills: ${skills.join(', ')}` : undefined,
			triggers: ['prd-import']
		},
		position: { x: 160 + col * 320, y: 140 + row * 200 }
	};
}

function buildConnections(tasks: TaskRecord[]): Array<{ sourceIndex: number; targetIndex: number }> {
	const idxById = new Map<string, number>();
	tasks.forEach((t, i) => idxById.set(t.id, i));

	const conns: Array<{ sourceIndex: number; targetIndex: number }> = [];
	for (let i = 0; i < tasks.length; i++) {
		const deps = tasks[i].dependencies || [];
		for (const dep of deps) {
			const src = idxById.get(dep);
			if (src !== undefined) conns.push({ sourceIndex: src, targetIndex: i });
		}
	}
	return conns;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { requestId, autoRun, telegramRelay, missionId, chatId, userId, goal, buildMode: bodyBuildMode, buildModeReason: bodyBuildModeReason, traceRef, trace_ref } = await request.json();
		const normalizedTelegramRelay = normalizeTelegramRelay(telegramRelay);
		if (!requestId || typeof requestId !== 'string') {
			return json({ error: 'requestId (string) required' }, { status: 400 });
		}
		const resolvedMissionId = typeof missionId === 'string' && missionId.trim()
			? missionId.trim()
			: missionIdFromRequestId(requestId);
		let resolvedTraceRef = normalizeTraceRef(traceRef ?? trace_ref);

		const path = resultFilePath(requestId);
		const spawnerDir = getSpawnerDir();
		const pendingLoadFile = join(spawnerDir, 'pending-load.json');
		const lastLoadFile = join(spawnerDir, 'last-canvas-load.json');
		const pendingRequestFile = join(spawnerDir, 'pending-request.json');
		if (!existsSync(path)) {
			return json({ error: `No analysis result for ${requestId} yet` }, { status: 404 });
		}

		const raw = await readFile(path, 'utf-8');
		const parsed = JSON.parse(raw) as {
			success?: boolean;
			projectName?: string;
			projectType?: string;
			executionPrompt?: string;
			tier?: string;
			tasks?: TaskRecord[];
			capabilityProposalPacket?: unknown;
			capability_proposal_packet?: unknown;
		};

		if (!parsed.success || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
			return json({ error: 'Result has no tasks to load' }, { status: 422 });
		}

		const nodes = parsed.tasks.map(taskToNode);
		const connections = buildConnections(parsed.tasks);
		const deterministicStaticResult =
			parsed.projectType === 'static-exact-file-proof' || parsed.projectType === 'static-single-file-html';
		const effectiveAutoRun = autoRun !== false && !deterministicStaticResult;

		if (!existsSync(spawnerDir)) {
			await mkdir(spawnerDir, { recursive: true });
		}

		let relay: Record<string, unknown> | undefined;
		let buildMode: 'direct' | 'advanced_prd' = bodyBuildMode === 'advanced_prd' ? 'advanced_prd' : 'direct';
		let buildModeReason = typeof bodyBuildModeReason === 'string' ? bodyBuildModeReason : '';
		let pendingRequestMeta: Record<string, unknown> | null = null;
		let capabilityProposalPacket = normalizeCapabilityProposalPacket(
			parsed.capabilityProposalPacket ?? parsed.capability_proposal_packet
		);
		if (existsSync(pendingRequestFile)) {
			try {
				const pendingRaw = await readFile(pendingRequestFile, 'utf-8');
				const pending = JSON.parse(pendingRaw) as {
					requestId?: string;
					relay?: Record<string, unknown>;
					buildMode?: 'direct' | 'advanced_prd';
					buildModeReason?: string;
					tier?: string;
				};
				if (pending.requestId === requestId) {
					pendingRequestMeta = pending as Record<string, unknown>;
					resolvedTraceRef =
						resolvedTraceRef ||
						extractTraceRef(pendingRequestMeta, parsed) ||
						traceRefFromMissionId(resolvedMissionId);
					capabilityProposalPacket =
						normalizeCapabilityProposalPacket(pendingRequestMeta.capabilityProposalPacket) ||
						capabilityProposalPacket;
				}
				if (pending.requestId === requestId) {
					buildMode = pending.buildMode === 'advanced_prd' ? 'advanced_prd' : 'direct';
					buildModeReason = typeof pending.buildModeReason === 'string' ? pending.buildModeReason : '';
				}
				if (pending.requestId === requestId && pending.relay) {
					relay = {
						...pending.relay,
						missionId: resolvedMissionId,
						...(typeof pending.tier === 'string' ? { tier: pending.tier } : {}),
						...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {}),
						requestId,
						...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
						autoRun: effectiveAutoRun,
						buildMode,
						buildModeReason
					};
				}
			} catch {
				// Relay metadata is best-effort; canvas loading should still work.
			}
		}
		resolvedTraceRef = resolvedTraceRef || extractTraceRef(parsed) || traceRefFromMissionId(resolvedMissionId);
		const capabilitySummary = capabilityProposalSummary(capabilityProposalPacket);
		if (!relay && (typeof chatId === 'string' || typeof userId === 'string' || typeof goal === 'string' || normalizedTelegramRelay)) {
			relay = {
				missionId: resolvedMissionId,
				...(typeof chatId === 'string' && chatId.trim() ? { chatId: chatId.trim() } : {}),
				...(typeof userId === 'string' && userId.trim() ? { userId: userId.trim() } : {}),
				requestId,
				...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
				...(typeof goal === 'string' && goal.trim() ? { goal } : {}),
				...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {}),
				autoRun: effectiveAutoRun,
				buildMode,
				buildModeReason
			};
		}
		if (relay && !relay.missionId) {
			relay.missionId = resolvedMissionId;
		}
		if (relay && resolvedTraceRef && !relay.traceRef) {
			relay.traceRef = resolvedTraceRef;
		}

		const executionText = executionTextFromResult(parsed);
		const load = {
			requestId,
			missionId: resolvedMissionId,
			...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
			pipelineId: `prd-${requestId}`,
			pipelineName: parsed.projectName || `PRD ${requestId}`,
			nodes,
			connections,
			source: 'prd-bridge',
			autoRun: effectiveAutoRun,
			buildMode,
			buildModeReason,
			tier: typeof pendingRequestMeta?.tier === 'string'
				? pendingRequestMeta.tier
				: typeof parsed.tier === 'string'
					? parsed.tier
					: 'base',
			executionPrompt: executionText,
			...(capabilityProposalPacket ? { capabilityProposalPacket } : {}),
			...(capabilitySummary ? { capabilityProposalSummary: capabilitySummary } : {}),
			metadata: {
				...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
				...(capabilityProposalPacket ? { capabilityProposalPacket } : {}),
				...(capabilitySummary ? { capabilityProposalSummary: capabilitySummary } : {})
			},
			relay,
			timestamp: new Date().toISOString()
		};
		const missionControlAccess = resolveMissionControlAccess(missionControlPathForMission(resolvedMissionId));

		const persistedLoad = storedCanvasLoad(load);
		await writeFile(pendingLoadFile, JSON.stringify(persistedLoad, null, 2), 'utf-8');
		await writeFile(lastLoadFile, JSON.stringify(persistedLoad, null, 2), 'utf-8');
		if (pendingRequestMeta) {
			await writeFile(
				pendingRequestFile,
				JSON.stringify(
					{
						...pendingRequestMeta,
						status: 'canvas_loaded',
						canvasLoadedAt: new Date().toISOString(),
						...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
						pipelineId: load.pipelineId,
						canvasUrl: `/canvas?pipeline=${encodeURIComponent(load.pipelineId)}&mission=${encodeURIComponent(resolvedMissionId)}`,
						missionControlAccess,
						...(capabilityProposalPacket ? { capabilityProposalPacket } : {}),
						...(capabilitySummary ? { capabilityProposalSummary: capabilitySummary } : {})
					},
					null,
					2
				),
				'utf-8'
			);
		}
		void relayMissionControlEvent({
			type: 'mission_created',
			missionId: resolvedMissionId,
			missionName: load.pipelineName,
			taskName: 'Canvas ready',
			message: `Canvas ready for ${load.pipelineName}. ${nodes.length} task(s) queued.`,
			source: 'prd-bridge',
			data: {
				requestId,
				...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
				buildMode,
				buildModeReason,
				...(capabilitySummary ? { capabilityProposal: capabilitySummary } : {}),
				plannedTasks: parsed.tasks.map((task) => ({
					title: task.title,
					skills: task.skills || []
				})),
				...(relay?.projectLineage ? { projectLineage: relay.projectLineage } : {}),
				...(relay ? { telegramRelay: relay.telegramRelay } : {})
			}
		});

		const autoDispatchResult = effectiveAutoRun
			? await autoDispatchPrdCanvasLoad(load)
			: {
					started: false,
					skipped: true,
					reason: deterministicStaticResult
						? 'deterministic static artifacts already written'
						: 'autoRun disabled',
					missionId: resolvedMissionId
				};
		if (!autoDispatchResult.started && !autoDispatchResult.skipped) {
			void relayMissionControlEvent({
				type: 'log',
				missionId: resolvedMissionId,
				missionName: load.pipelineName,
				taskName: 'Auto-start',
				message: `Canvas auto-start failed: ${autoDispatchResult.error || 'unknown error'}`,
				source: 'prd-auto-dispatch',
				data: {
					requestId,
					...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
					buildMode,
					buildModeReason,
					error: autoDispatchResult.error,
					...(relay?.projectLineage ? { projectLineage: relay.projectLineage } : {}),
					...(relay ? { telegramRelay: relay.telegramRelay } : {})
				}
			});
		}

		return json({
			success: true,
			pipelineId: load.pipelineId,
			pipelineName: load.pipelineName,
			...(resolvedTraceRef ? { traceRef: resolvedTraceRef } : {}),
			taskCount: nodes.length,
			connectionCount: connections.length,
			autoDispatch: autoDispatchResult,
			canvasUrl: `/canvas?pipeline=${encodeURIComponent(load.pipelineId)}&mission=${encodeURIComponent(resolvedMissionId)}`,
			missionControlAccess
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json({ error: message }, { status: 500 });
	}
};
