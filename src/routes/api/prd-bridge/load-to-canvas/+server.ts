import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { autoDispatchPrdCanvasLoad } from '$lib/server/prd-auto-dispatch';

function getSpawnerDir(): string {
	return process.env.SPAWNER_STATE_DIR || join(process.cwd(), '.spawner');
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
		const { requestId, autoRun, telegramRelay, missionId, chatId, userId, goal, buildMode: bodyBuildMode, buildModeReason: bodyBuildModeReason } = await request.json();
		const normalizedTelegramRelay = normalizeTelegramRelay(telegramRelay);
		if (!requestId || typeof requestId !== 'string') {
			return json({ error: 'requestId (string) required' }, { status: 400 });
		}
		const resolvedMissionId = typeof missionId === 'string' && missionId.trim()
			? missionId.trim()
			: missionIdFromRequestId(requestId);

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
			executionPrompt?: string;
			tasks?: TaskRecord[];
		};

		if (!parsed.success || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
			return json({ error: 'Result has no tasks to load' }, { status: 422 });
		}

		const nodes = parsed.tasks.map(taskToNode);
		const connections = buildConnections(parsed.tasks);

		if (!existsSync(spawnerDir)) {
			await mkdir(spawnerDir, { recursive: true });
		}

		let relay: Record<string, unknown> | undefined;
		let buildMode: 'direct' | 'advanced_prd' = bodyBuildMode === 'advanced_prd' ? 'advanced_prd' : 'direct';
		let buildModeReason = typeof bodyBuildModeReason === 'string' ? bodyBuildModeReason : '';
		let pendingRequestMeta: Record<string, unknown> | null = null;
		if (existsSync(pendingRequestFile)) {
			try {
				const pendingRaw = await readFile(pendingRequestFile, 'utf-8');
				const pending = JSON.parse(pendingRaw) as {
					requestId?: string;
					relay?: Record<string, unknown>;
					buildMode?: 'direct' | 'advanced_prd';
					buildModeReason?: string;
				};
				if (pending.requestId === requestId) {
					pendingRequestMeta = pending as Record<string, unknown>;
				}
				if (pending.requestId === requestId) {
					buildMode = pending.buildMode === 'advanced_prd' ? 'advanced_prd' : 'direct';
					buildModeReason = typeof pending.buildModeReason === 'string' ? pending.buildModeReason : '';
				}
				if (pending.requestId === requestId && pending.relay) {
					relay = {
						...pending.relay,
						missionId: resolvedMissionId,
						...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {}),
						requestId,
						autoRun: autoRun !== false,
						buildMode,
						buildModeReason
					};
				}
			} catch {
				// Relay metadata is best-effort; canvas loading should still work.
			}
		}
		if (!relay && (typeof chatId === 'string' || typeof userId === 'string' || typeof goal === 'string' || normalizedTelegramRelay)) {
			relay = {
				missionId: resolvedMissionId,
				...(typeof chatId === 'string' && chatId.trim() ? { chatId: chatId.trim() } : {}),
				...(typeof userId === 'string' && userId.trim() ? { userId: userId.trim() } : {}),
				requestId,
				...(typeof goal === 'string' && goal.trim() ? { goal } : {}),
				...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {}),
				autoRun: autoRun !== false,
				buildMode,
				buildModeReason
			};
		}
		if (relay && !relay.missionId) {
			relay.missionId = resolvedMissionId;
		}

		const load = {
			requestId,
			missionId: resolvedMissionId,
			pipelineId: `prd-${requestId}`,
			pipelineName: parsed.projectName || `PRD ${requestId}`,
			nodes,
			connections,
			source: 'prd-bridge',
			autoRun: autoRun !== false,
			buildMode,
			buildModeReason,
			executionPrompt: parsed.executionPrompt,
			relay,
			timestamp: new Date().toISOString()
		};

		await writeFile(pendingLoadFile, JSON.stringify(load, null, 2), 'utf-8');
		await writeFile(lastLoadFile, JSON.stringify(load, null, 2), 'utf-8');
		if (pendingRequestMeta) {
			await writeFile(
				pendingRequestFile,
				JSON.stringify(
					{
						...pendingRequestMeta,
						status: 'canvas_loaded',
						canvasLoadedAt: new Date().toISOString(),
						pipelineId: load.pipelineId,
						canvasUrl: `/canvas?pipeline=${encodeURIComponent(load.pipelineId)}&mission=${encodeURIComponent(resolvedMissionId)}`
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
				buildMode,
				buildModeReason,
				plannedTasks: parsed.tasks.map((task) => ({
					title: task.title,
					skills: task.skills || []
				})),
				...(relay ? { telegramRelay: relay.telegramRelay } : {})
			}
		});

		const autoDispatchResult = autoRun !== false
			? await autoDispatchPrdCanvasLoad(load)
			: { started: false, skipped: true, reason: 'autoRun disabled', missionId: resolvedMissionId };
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
					buildMode,
					buildModeReason,
					error: autoDispatchResult.error,
					...(relay ? { telegramRelay: relay.telegramRelay } : {})
				}
			});
		}

		return json({
			success: true,
			pipelineId: load.pipelineId,
			pipelineName: load.pipelineName,
			taskCount: nodes.length,
			connectionCount: connections.length,
			autoDispatch: autoDispatchResult,
			canvasUrl: `/canvas?pipeline=${encodeURIComponent(load.pipelineId)}&mission=${encodeURIComponent(resolvedMissionId)}`
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json({ error: message }, { status: 500 });
	}
};
