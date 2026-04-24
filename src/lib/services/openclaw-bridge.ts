import { randomUUID } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import type { Mission } from '$lib/services/mcp-client';
import { TOP_100_MCPS } from '$lib/types/mcp';
import { eventBridge } from '$lib/services/event-bridge';
import {
	PRECONFIGURED_MCPS,
	callTool,
	connectMCP,
	disconnectMCP,
	getConnections,
	getTools,
	isConnected,
	type MCPClientConfig
} from '$lib/services/mcp/client';

export type OpenclawCommandName =
	| 'canvas.create_pipeline'
	| 'canvas.add_skill'
	| 'canvas.add_connection'
	| 'canvas.get_state'
	| 'mission.build'
	| 'mission.start'
	| 'mission.pause'
	| 'mission.resume'
	| 'mission.stop'
	| 'mission.status'
	| 'mcp.list'
	| 'mcp.connect'
	| 'mcp.call_tool'
	| 'mcp.disconnect'
	| 'events.subscribe'
	| 'worker.run'
	| 'worker.cancel'
	| 'worker.status';

export const OPENCLAW_ALLOWED_COMMANDS: OpenclawCommandName[] = [
	'canvas.create_pipeline',
	'canvas.add_skill',
	'canvas.add_connection',
	'canvas.get_state',
	'mission.build',
	'mission.start',
	'mission.pause',
	'mission.resume',
	'mission.stop',
	'mission.status',
	'mcp.list',
	'mcp.connect',
	'mcp.call_tool',
	'mcp.disconnect',
	'events.subscribe',
	'worker.run',
	'worker.cancel',
	'worker.status'
];

export interface OpenclawBridgeEvent {
	id: string;
	type: string;
	sessionId: string;
	timestamp: string;
	data: Record<string, unknown>;
}

export interface OpenclawCanvasSnapshot {
	sessionId: string;
	updatedAt: string;
	pipelineId: string;
	pipelineName: string;
	nodes: OpenclawCanvasNode[];
	connections: OpenclawCanvasConnection[];
}

export interface OpenclawSession {
	id: string;
	status: 'active' | 'ended';
	createdAt: string;
	updatedAt: string;
	endedAt?: string;
	actor?: string;
	metadata: Record<string, unknown>;
	commandCount: number;
	canvas: {
		pipelineId: string;
		pipelineName: string;
		nodes: OpenclawCanvasNode[];
		connections: OpenclawCanvasConnection[];
	};
	mission: Mission | null;
	events: OpenclawBridgeEvent[];
}

export interface OpenclawSessionStartInput {
	sessionId?: string;
	actor?: string;
	metadata?: Record<string, unknown>;
}

export interface OpenclawCommandInput {
	sessionId: string;
	command: OpenclawCommandName;
	params?: Record<string, unknown>;
	requestId?: string;
	actor?: string;
}

export interface OpenclawCommandResult {
	ok: boolean;
	sessionId: string;
	command: OpenclawCommandName;
	requestId?: string;
	data?: Record<string, unknown>;
	error?: string;
}

export type OpenclawProviderId = 'claude' | 'codex';

export interface OpenclawProviderTaskInput {
	providerId: OpenclawProviderId;
	missionId: string;
	prompt: string;
	model?: string;
	workingDirectory?: string;
	commandTemplate?: string;
	taskId?: string;
	openclawSessionId?: string;
	signal?: AbortSignal;
}

export interface OpenclawProviderTaskResult {
	success: boolean;
	openclawSessionId: string;
	response?: string;
	error?: string;
	durationMs?: number;
}

interface OpenclawWorkerState {
	sessionId: string;
	providerId: OpenclawProviderId;
	missionId: string;
	taskId?: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	startedAt: string;
	completedAt?: string;
	error?: string;
	response?: string;
	process?: ChildProcess;
	progress: number;
}

interface OpenclawWorkerExecutorContext {
	sessionId: string;
	providerId: OpenclawProviderId;
	missionId: string;
	taskId?: string;
	prompt: string;
	model: string;
	commandTemplate: string;
	workingDirectory?: string;
	signal?: AbortSignal;
	emitProgress: (progress: number, message: string) => void;
}

type OpenclawWorkerExecutor = (
	context: OpenclawWorkerExecutorContext
) => Promise<{ success: boolean; response?: string; error?: string }>;

export interface OpenclawCanvasNode {
	id: string;
	skillId: string;
	skillName: string;
	description: string;
	position: { x: number; y: number };
}

export interface OpenclawCanvasConnection {
	id: string;
	sourceNodeId: string;
	targetNodeId: string;
}

type OpenclawSubscriber = (event: OpenclawBridgeEvent) => void;

const MAX_SESSION_EVENTS = 500;
const CANCELLED_ERROR = 'Cancelled';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringOrUndefined(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toString(value: unknown, fallback: string): string {
	const parsed = toStringOrUndefined(value);
	return parsed || fallback;
}

function toNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nowIso(): string {
	return new Date().toISOString();
}

function createId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isProviderId(value: unknown): value is OpenclawProviderId {
	return value === 'claude' || value === 'codex';
}

interface ProviderCommand {
	binary: 'claude' | 'codex';
	args: string[];
}

function isSafeCommandToken(value: string): boolean {
	return /^[A-Za-z0-9._:/@+=-]+$/.test(value);
}

function isBinaryAvailable(binaryName: ProviderCommand['binary']): boolean {
	try {
		const locator = process.platform === 'win32' ? 'where.exe' : 'which';
		execFileSync(locator, [binaryName], { stdio: 'pipe', timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

function resolveProviderCommandTemplate(providerId: OpenclawProviderId, model?: string, template?: string): string {
	const fallbackTemplate = providerId === 'claude' ? 'claude --model {model}' : 'codex exec --model {model}';
	const commandTemplate = template && template.trim() ? template : fallbackTemplate;
	const fallbackModel = providerId === 'claude' ? 'claude-opus-4-1' : 'gpt-5.5';
	return commandTemplate.replace('{model}', (model && model.trim()) || fallbackModel);
}

function parseProviderCommand(providerId: OpenclawProviderId, commandTemplate: string): ProviderCommand {
	const tokens = commandTemplate.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) {
		throw new Error('Provider command template is empty');
	}
	if (tokens.some((token) => !isSafeCommandToken(token))) {
		throw new Error('Provider command template contains unsafe shell characters');
	}

	if (providerId === 'claude') {
		if (tokens[0] !== 'claude' || tokens.length !== 3 || tokens[1] !== '--model') {
			throw new Error('Claude provider command must be: claude --model <model>');
		}
		return { binary: 'claude', args: ['--model', tokens[2]] };
	}

	if (tokens[0] !== 'codex' || tokens[1] !== 'exec') {
		throw new Error('Codex provider command must start with: codex exec');
	}
	if (tokens.length === 3 && tokens[2] === '--yolo') {
		return { binary: 'codex', args: ['exec', '--yolo'] };
	}
	if (tokens.length === 4 && tokens[2] === '--model') {
		return { binary: 'codex', args: ['exec', '--model', tokens[3]] };
	}
	throw new Error('Codex provider command must be: codex exec --model <model> or codex exec --yolo');
}

function sanitizeMcpConfig(value: unknown): MCPClientConfig | null {
	if (!isRecord(value)) return null;
	const command = toStringOrUndefined(value.command);
	if (!command) return null;

	const args =
		Array.isArray(value.args) && value.args.every((arg) => typeof arg === 'string')
			? (value.args as string[])
			: undefined;

	let env: Record<string, string> | undefined;
	if (isRecord(value.env)) {
		const entries = Object.entries(value.env).filter(([, v]) => typeof v === 'string');
		env = Object.fromEntries(entries) as Record<string, string>;
	}

	return { command, args, env };
}

class OpenclawBridgeService {
	private sessions = new Map<string, OpenclawSession>();
	private subscribers = new Map<string, Set<OpenclawSubscriber>>();
	private instanceOwners = new Map<string, { sessionId: string; mcpId?: string }>();
	private workerSessions = new Map<string, OpenclawWorkerState>();
	private workerExecutorOverride: OpenclawWorkerExecutor | null = null;

	startSession(input: OpenclawSessionStartInput = {}): OpenclawSession {
		const sessionId = input.sessionId || randomUUID();
		const existing = this.sessions.get(sessionId);
		if (existing && existing.status === 'active') {
			return existing;
		}

		const createdAt = nowIso();
		const session: OpenclawSession = {
			id: sessionId,
			status: 'active',
			createdAt,
			updatedAt: createdAt,
			actor: input.actor,
			metadata: input.metadata || {},
			commandCount: 0,
			canvas: {
				pipelineId: createId('pipe'),
				pipelineName: 'Openclaw Pipeline',
				nodes: [],
				connections: []
			},
			mission: null,
			events: []
		};

		this.sessions.set(sessionId, session);
		this.emitEvent(sessionId, 'openclaw.session.started', {
			actor: session.actor || null,
			metadata: session.metadata
		});
		return session;
	}

	endSession(sessionId: string, reason = 'requested'): OpenclawSession {
		const session = this.requireSession(sessionId);
		if (session.status === 'ended') {
			return session;
		}

		const workerState = this.workerSessions.get(sessionId);
		if (workerState?.status === 'running') {
			try {
				workerState.process?.kill('SIGTERM');
			} catch {
				// noop
			}
		}

		session.status = 'ended';
		session.endedAt = nowIso();
		session.updatedAt = session.endedAt;
		this.emitEvent(sessionId, 'openclaw.session.ended', { reason });
		return session;
	}

	getSession(sessionId: string): OpenclawSession | null {
		return this.sessions.get(sessionId) || null;
	}

	getSessionEvents(sessionId: string): OpenclawBridgeEvent[] {
		return [...(this.sessions.get(sessionId)?.events || [])];
	}

	getLatestCanvasSnapshot(since?: string): OpenclawCanvasSnapshot | null {
		const sinceTs = since ? Date.parse(since) : Number.NaN;
		const sessions = [...this.sessions.values()].filter((session) =>
			session.events.some((event) => event.type === 'openclaw.canvas.updated')
		);
		if (sessions.length === 0) return null;

		sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
		const latest = sessions[0];
		const latestTs = Date.parse(latest.updatedAt);
		if (!Number.isNaN(sinceTs) && !Number.isNaN(latestTs) && latestTs <= sinceTs) {
			return null;
		}

		return {
			sessionId: latest.id,
			updatedAt: latest.updatedAt,
			pipelineId: latest.canvas.pipelineId,
			pipelineName: latest.canvas.pipelineName,
			nodes: latest.canvas.nodes.map((node) => ({ ...node, position: { ...node.position } })),
			connections: latest.canvas.connections.map((connection) => ({ ...connection }))
		};
	}

	subscribe(sessionId: string, callback: OpenclawSubscriber): () => void {
		if (!this.subscribers.has(sessionId)) {
			this.subscribers.set(sessionId, new Set());
		}
		this.subscribers.get(sessionId)!.add(callback);
		return () => {
			this.subscribers.get(sessionId)?.delete(callback);
		};
	}

	setWorkerExecutorForTests(executor: OpenclawWorkerExecutor | null): void {
		this.workerExecutorOverride = executor;
	}

	getWorkerSession(sessionId: string): OpenclawWorkerState | null {
		return this.workerSessions.get(sessionId) || null;
	}

	async executeProviderTask(input: OpenclawProviderTaskInput): Promise<OpenclawProviderTaskResult> {
		const startedAtMs = Date.now();
		const { providerId, missionId, prompt } = input;
		const taskId = input.taskId;
		const session = this.startSession({
			sessionId: input.openclawSessionId,
			actor: 'provider-runtime',
			metadata: {
				kind: 'provider_worker',
				providerId,
				missionId,
				taskId: taskId || null
			}
		});
		const openclawSessionId = session.id;
		const command = resolveProviderCommandTemplate(providerId, input.model, input.commandTemplate);

		const workerState: OpenclawWorkerState = {
			sessionId: openclawSessionId,
			providerId,
			missionId,
			taskId,
			status: 'running',
			startedAt: nowIso(),
			progress: 0
		};
		this.workerSessions.set(openclawSessionId, workerState);

		this.emitProviderEvent(workerState, 'task_started', {
			message: `${providerId} worker started`
		});

		const emitProgress = (progress: number, message: string) => {
			if (workerState.status !== 'running') return;
			workerState.progress = Math.max(workerState.progress, Math.min(99, Math.round(progress)));
			this.emitProviderEvent(workerState, 'task_progress', {
				progress: workerState.progress,
				message
			});
		};

		const executor = this.workerExecutorOverride || this.executeProviderTaskViaProcess.bind(this);

		try {
			const result = await executor({
				sessionId: openclawSessionId,
				providerId,
				missionId,
				taskId,
				prompt,
				model: input.model || '',
				commandTemplate: command,
				workingDirectory: input.workingDirectory,
				signal: input.signal,
				emitProgress
			});

			if (workerState.status === 'cancelled') {
				return {
					success: false,
					openclawSessionId,
					error: CANCELLED_ERROR,
					durationMs: Date.now() - startedAtMs
				};
			}

			if (result.success) {
				workerState.status = 'completed';
				workerState.response = result.response;
				workerState.completedAt = nowIso();
				this.emitProviderEvent(workerState, 'task_completed', {
					progress: 100,
					message: `${providerId} worker completed`,
					response: result.response || ''
				});
				this.endSession(openclawSessionId, 'completed');
				return {
					success: true,
					openclawSessionId,
					response: result.response,
					durationMs: Date.now() - startedAtMs
				};
			}

			workerState.status = 'failed';
			workerState.error = result.error || 'Worker execution failed';
			workerState.completedAt = nowIso();
			this.emitProviderEvent(workerState, 'task_failed', {
				message: workerState.error,
				error: {
					message: workerState.error,
					providerId
				}
			});
			this.endSession(openclawSessionId, 'failed');
			return {
				success: false,
				openclawSessionId,
				error: workerState.error,
				durationMs: Date.now() - startedAtMs
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Worker execution failed';
			if (workerState.status !== 'cancelled') {
				workerState.status = 'failed';
				workerState.error = message;
				workerState.completedAt = nowIso();
				this.emitProviderEvent(workerState, 'task_failed', {
					message,
					error: { message, providerId }
				});
				this.endSession(openclawSessionId, 'failed');
			}
			return {
				success: false,
				openclawSessionId,
				error: workerState.status === 'cancelled' ? CANCELLED_ERROR : message,
				durationMs: Date.now() - startedAtMs
			};
		}
	}

	cancelProviderTask(sessionId: string, reason = CANCELLED_ERROR): boolean {
		const workerState = this.workerSessions.get(sessionId);
		if (!workerState) return false;
		if (workerState.status !== 'running') return false;

		workerState.status = 'cancelled';
		workerState.error = reason;
		workerState.completedAt = nowIso();
		try {
			workerState.process?.kill('SIGTERM');
		} catch {
			// noop
		}

		this.emitProviderEvent(workerState, 'task_cancelled', {
			message: reason,
			error: { message: reason, providerId: workerState.providerId }
		});
		this.endSession(sessionId, reason);
		return true;
	}

	async executeCommand(input: OpenclawCommandInput): Promise<OpenclawCommandResult> {
		const session = this.requireSession(input.sessionId);
		if (session.status !== 'active') {
			return {
				ok: false,
				sessionId: input.sessionId,
				command: input.command,
				requestId: input.requestId,
				error: 'Session is not active'
			};
		}

		const actor = input.actor || 'unknown';
		session.commandCount += 1;
		session.updatedAt = nowIso();
		session.actor = actor;
		this.emitEvent(input.sessionId, 'openclaw.command.received', {
			command: input.command,
			actor,
			requestId: input.requestId || null,
			params: input.params || {}
		});

		try {
			const data = await this.dispatchCommand(session, input.command, input.params || {});
			this.emitEvent(input.sessionId, 'openclaw.command.completed', {
				command: input.command,
				actor,
				requestId: input.requestId || null,
				data
			});
			return {
				ok: true,
				sessionId: input.sessionId,
				command: input.command,
				requestId: input.requestId,
				data
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Command failed';
			this.emitEvent(input.sessionId, 'openclaw.command.failed', {
				command: input.command,
				actor,
				requestId: input.requestId || null,
				error: message
			});
			return {
				ok: false,
				sessionId: input.sessionId,
				command: input.command,
				requestId: input.requestId,
				error: message
			};
		}
	}

	resetForTests(): void {
		this.sessions.clear();
		this.subscribers.clear();
		this.instanceOwners.clear();
		this.workerSessions.clear();
		this.workerExecutorOverride = null;
	}

	private requireSession(sessionId: string): OpenclawSession {
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Unknown session: ${sessionId}`);
		}
		return session;
	}

	private emitEvent(sessionId: string, type: string, data: Record<string, unknown>): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;

		const event: OpenclawBridgeEvent = {
			id: createId('ocl-evt'),
			type,
			sessionId,
			timestamp: nowIso(),
			data
		};

		session.events.push(event);
		if (session.events.length > MAX_SESSION_EVENTS) {
			session.events.splice(0, session.events.length - MAX_SESSION_EVENTS);
		}

		const metadataMissionId =
			typeof session.metadata?.missionId === 'string' ? (session.metadata.missionId as string) : undefined;

		// Emit into the global event bridge for shared observability.
		// Provider runtime lifecycle events are emitted separately with normalized payloads.
		if (!type.startsWith('task_')) {
			eventBridge.emit({
				id: event.id,
				type,
				source: 'openclaw',
				timestamp: event.timestamp,
				missionId: session.mission?.id || metadataMissionId,
				data: {
					...data,
					sessionId
				}
			});
		}

		const scoped = this.subscribers.get(sessionId);
		scoped?.forEach((callback) => callback(event));
	}

	private async dispatchCommand(
		session: OpenclawSession,
		command: OpenclawCommandName,
		params: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		switch (command) {
			case 'canvas.create_pipeline':
				return this.handleCanvasCreatePipeline(session, params);
			case 'canvas.add_skill':
				return this.handleCanvasAddSkill(session, params);
			case 'canvas.add_connection':
				return this.handleCanvasAddConnection(session, params);
			case 'canvas.get_state':
				return this.handleCanvasGetState(session);
			case 'mission.build':
				return this.handleMissionBuild(session, params);
			case 'mission.start':
				return this.handleMissionStatusChange(session, 'running');
			case 'mission.pause':
				return this.handleMissionStatusChange(session, 'paused');
			case 'mission.resume':
				return this.handleMissionStatusChange(session, 'running');
			case 'mission.stop':
				return this.handleMissionStop(session);
			case 'mission.status':
				return this.handleMissionStatus(session);
			case 'mcp.list':
				return this.handleMcpList(session);
			case 'mcp.connect':
				return await this.handleMcpConnect(session, params);
			case 'mcp.call_tool':
				return await this.handleMcpCallTool(session, params);
			case 'mcp.disconnect':
				return await this.handleMcpDisconnect(session, params);
			case 'events.subscribe':
				return {
					endpoint: `/api/openclaw/events?sessionId=${encodeURIComponent(session.id)}`,
					sessionId: session.id
				};
			case 'worker.run':
				return await this.handleWorkerRun(session, params);
			case 'worker.cancel':
				return this.handleWorkerCancel(session, params);
			case 'worker.status':
				return this.handleWorkerStatus(session);
		}
	}

	private handleCanvasCreatePipeline(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Record<string, unknown> {
		const pipelineId = toString(params.pipelineId, createId('pipe'));
		const pipelineName = toString(params.name, 'Openclaw Pipeline');
		session.canvas = {
			pipelineId,
			pipelineName,
			nodes: [],
			connections: []
		};
		session.mission = null;
		this.emitEvent(session.id, 'openclaw.canvas.updated', {
			action: 'create_pipeline',
			pipelineId,
			pipelineName
		});
		return {
			pipelineId,
			pipelineName,
			nodeCount: 0,
			connectionCount: 0
		};
	}

	private handleCanvasAddSkill(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Record<string, unknown> {
		const skillId = toString(params.skillId, createId('skill'));
		const skillName = toString(params.skillName, skillId);
		const description = toString(params.description, `Task for ${skillName}`);
		const nodeId = toString(params.nodeId, createId('node'));
		const position = isRecord(params.position)
			? {
					x: toNumber(params.position.x, session.canvas.nodes.length * 220),
					y: toNumber(params.position.y, 120)
				}
			: { x: session.canvas.nodes.length * 220, y: 120 };

		const node: OpenclawCanvasNode = {
			id: nodeId,
			skillId,
			skillName,
			description,
			position
		};
		session.canvas.nodes.push(node);
		this.emitEvent(session.id, 'openclaw.canvas.updated', {
			action: 'add_skill',
			node
		});

		return {
			node,
			nodeCount: session.canvas.nodes.length
		};
	}

	private handleCanvasAddConnection(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Record<string, unknown> {
		const sourceNodeId = toStringOrUndefined(params.sourceNodeId);
		const targetNodeId = toStringOrUndefined(params.targetNodeId);
		if (!sourceNodeId || !targetNodeId) {
			throw new Error('sourceNodeId and targetNodeId are required');
		}

		const hasSource = session.canvas.nodes.some((node) => node.id === sourceNodeId);
		const hasTarget = session.canvas.nodes.some((node) => node.id === targetNodeId);
		if (!hasSource || !hasTarget) {
			throw new Error('Both source and target nodes must exist');
		}

		const connection: OpenclawCanvasConnection = {
			id: toString(params.connectionId, createId('conn')),
			sourceNodeId,
			targetNodeId
		};
		session.canvas.connections.push(connection);
		this.emitEvent(session.id, 'openclaw.canvas.updated', {
			action: 'add_connection',
			connection
		});
		return {
			connection,
			connectionCount: session.canvas.connections.length
		};
	}

	private handleCanvasGetState(session: OpenclawSession): Record<string, unknown> {
		return {
			pipelineId: session.canvas.pipelineId,
			pipelineName: session.canvas.pipelineName,
			nodes: session.canvas.nodes,
			connections: session.canvas.connections
		};
	}

	private handleMissionBuild(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Record<string, unknown> {
		if (session.canvas.nodes.length === 0) {
			throw new Error('Cannot build mission from empty canvas');
		}

		const now = nowIso();
		const agentId = 'openclaw-agent';
		const taskIdByNodeId = new Map<string, string>();
		session.canvas.nodes.forEach((node, index) => {
			taskIdByNodeId.set(node.id, `task-${index + 1}`);
		});

		const tasks = session.canvas.nodes.map((node, index) => {
			const taskId = taskIdByNodeId.get(node.id)!;
			const dependsOn = session.canvas.connections
				.filter((connection) => connection.targetNodeId === node.id)
				.map((connection) => taskIdByNodeId.get(connection.sourceNodeId)!)
				.filter(Boolean);

			return {
				id: taskId,
				title: node.skillName,
				description: node.description,
				assignedTo: agentId,
				dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
				status: 'pending' as const,
				handoffType: 'sequential' as const
			};
		});

		const mission: Mission = {
			id: createId('mission'),
			user_id: 'openclaw',
			name: toString(params.name, session.canvas.pipelineName),
			description: toString(params.description, `Mission generated from ${session.canvas.pipelineName}`),
			mode: 'multi-llm-orchestrator',
			status: 'ready',
			agents: [
				{
					id: agentId,
					name: 'Openclaw Orchestrator',
					role: 'orchestrator',
					skills: session.canvas.nodes.map((node) => node.skillId)
				}
			],
			tasks,
			context: {
				projectPath: toString(params.projectPath, '.'),
				projectType: toString(params.projectType, 'tool'),
				goals: Array.isArray(params.goals)
					? params.goals.filter((goal): goal is string => typeof goal === 'string')
					: [`Complete pipeline "${session.canvas.pipelineName}"`]
			},
			current_task_id: null,
			outputs: {},
			error: null,
			created_at: now,
			updated_at: now,
			started_at: null,
			completed_at: null
		};

		session.mission = mission;
		this.emitEvent(session.id, 'openclaw.mission.built', {
			missionId: mission.id,
			taskCount: mission.tasks.length
		});
		return {
			mission
		};
	}

	private handleMissionStatusChange(
		session: OpenclawSession,
		nextStatus: Mission['status']
	): Record<string, unknown> {
		if (!session.mission) {
			throw new Error('No mission has been built for this session');
		}

		session.mission.status = nextStatus;
		session.mission.updated_at = nowIso();
		if (nextStatus === 'running') {
			session.mission.started_at = session.mission.started_at || nowIso();
		}
		this.emitEvent(session.id, 'openclaw.mission.status', {
			missionId: session.mission.id,
			status: nextStatus
		});
		return {
			mission: session.mission
		};
	}

	private handleMissionStop(session: OpenclawSession): Record<string, unknown> {
		if (!session.mission) {
			throw new Error('No mission has been built for this session');
		}

		session.mission.status = 'failed';
		session.mission.error = 'Stopped by openclaw command';
		session.mission.updated_at = nowIso();
		this.emitEvent(session.id, 'openclaw.mission.status', {
			missionId: session.mission.id,
			status: session.mission.status
		});
		return {
			mission: session.mission
		};
	}

	private handleMissionStatus(session: OpenclawSession): Record<string, unknown> {
		if (!session.mission) {
			return {
				mission: null
			};
		}
		return {
			mission: session.mission
		};
	}

	private handleMcpList(session: OpenclawSession): Record<string, unknown> {
		const connected = Array.from(getConnections().entries())
			.filter(([instanceId]) => this.instanceOwners.get(instanceId)?.sessionId === session.id)
			.map(([instanceId, connection]) => {
				const owner = this.instanceOwners.get(instanceId);
				return {
					instanceId,
					mcpId: owner?.mcpId || null,
					serverInfo: connection.serverInfo,
					toolCount: connection.tools.length
				};
			});

		return {
			preconfigured: Object.keys(PRECONFIGURED_MCPS),
			registryCount: TOP_100_MCPS.length,
			connected
		};
	}

	private async handleMcpConnect(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		const instanceId = toString(params.instanceId, createId('mcp'));
		const mcpId = toStringOrUndefined(params.mcpId);
		const owner = this.instanceOwners.get(instanceId);
		if (owner && owner.sessionId !== session.id) {
			throw new Error(`MCP instance "${instanceId}" is owned by another session`);
		}
		if (!owner && isConnected(instanceId)) {
			throw new Error(`MCP instance "${instanceId}" is already connected outside this session`);
		}

		let config: MCPClientConfig | null = null;
		if (mcpId && PRECONFIGURED_MCPS[mcpId]) {
			config = PRECONFIGURED_MCPS[mcpId];
		} else {
			config = sanitizeMcpConfig(params.config);
		}
		if (!config) {
			throw new Error('Provide a valid preconfigured mcpId or config');
		}

		const connection = await connectMCP(instanceId, config);
		this.instanceOwners.set(instanceId, { sessionId: session.id, mcpId });
		this.emitEvent(session.id, 'openclaw.mcp.connected', {
			instanceId,
			mcpId: mcpId || null,
			serverInfo: connection.serverInfo
		});
		return {
			instanceId,
			mcpId: mcpId || null,
			serverInfo: connection.serverInfo,
			tools: connection.tools.map((tool) => ({
				name: tool.name,
				description: tool.description
			}))
		};
	}

	private async handleMcpCallTool(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		const instanceId = toStringOrUndefined(params.instanceId);
		const toolName = toStringOrUndefined(params.toolName);
		if (!instanceId || !toolName) {
			throw new Error('instanceId and toolName are required');
		}
		if (!isConnected(instanceId)) {
			throw new Error(`MCP instance "${instanceId}" is not connected`);
		}
		this.assertSessionOwnsInstance(session, instanceId);

		const args = isRecord(params.args) ? params.args : {};
		const result = await callTool(instanceId, toolName, args);
		this.emitEvent(session.id, 'openclaw.mcp.tool_called', {
			instanceId,
			toolName
		});
		return {
			instanceId,
			toolName,
			result
		};
	}

	private async handleMcpDisconnect(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		const instanceId = toStringOrUndefined(params.instanceId);
		if (!instanceId) {
			throw new Error('instanceId is required');
		}
		this.assertSessionOwnsInstance(session, instanceId);

		await disconnectMCP(instanceId);
		this.instanceOwners.delete(instanceId);
		this.emitEvent(session.id, 'openclaw.mcp.disconnected', {
			instanceId
		});
		return {
			instanceId,
			connected: isConnected(instanceId),
			toolCount: getTools(instanceId).length
		};
	}

	private async handleWorkerRun(
		session: OpenclawSession,
		params: Record<string, unknown>
	): Promise<Record<string, unknown>> {
		const providerIdRaw = toStringOrUndefined(params.providerId);
		if (!providerIdRaw || !isProviderId(providerIdRaw)) {
			throw new Error('worker.run requires providerId: claude|codex');
		}
		const missionId = toStringOrUndefined(params.missionId);
		const prompt = toStringOrUndefined(params.prompt);
		if (!missionId || !prompt) {
			throw new Error('worker.run requires missionId and prompt');
		}

		const result = await this.executeProviderTask({
			providerId: providerIdRaw,
			missionId,
			prompt,
			model: toStringOrUndefined(params.model),
			workingDirectory: toStringOrUndefined(params.workingDirectory),
			taskId: toStringOrUndefined(params.taskId),
			openclawSessionId: session.id
		});

		return {
			providerId: providerIdRaw,
			missionId,
			openclawSessionId: result.openclawSessionId,
			success: result.success,
			error: result.error || null,
			response: result.response || null,
			durationMs: result.durationMs || 0
		};
	}

	private handleWorkerCancel(session: OpenclawSession, params: Record<string, unknown>): Record<string, unknown> {
		const reason = toString(params.reason, 'cancelled');
		const cancelled = this.cancelProviderTask(session.id, reason);
		return {
			openclawSessionId: session.id,
			cancelled,
			reason
		};
	}

	private handleWorkerStatus(session: OpenclawSession): Record<string, unknown> {
		const worker = this.workerSessions.get(session.id);
		if (!worker) {
			return {
				openclawSessionId: session.id,
				status: 'idle'
			};
		}
		return {
			openclawSessionId: session.id,
			providerId: worker.providerId,
			missionId: worker.missionId,
			taskId: worker.taskId || null,
			status: worker.status,
			progress: worker.progress,
			error: worker.error || null
		};
	}

	private emitProviderEvent(
		worker: OpenclawWorkerState,
		type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'task_cancelled',
		payload: Record<string, unknown>
	): void {
		const timestamp = nowIso();
		const data = {
			missionId: worker.missionId,
			providerId: worker.providerId,
			openclawSessionId: worker.sessionId,
			...(worker.taskId ? { taskId: worker.taskId } : {}),
			...payload
		};

		this.emitEvent(worker.sessionId, type, data);
		eventBridge.emit({
			id: createId('ocl-norm'),
			type,
			missionId: worker.missionId,
			taskId: worker.taskId,
			source: worker.providerId,
			timestamp,
			message: typeof payload.message === 'string' ? payload.message : undefined,
			progress: typeof payload.progress === 'number' ? payload.progress : undefined,
			data
		});
	}

	private async executeProviderTaskViaProcess(
		context: OpenclawWorkerExecutorContext
	): Promise<{ success: boolean; response?: string; error?: string }> {
		let command: ProviderCommand;
		try {
			command = parseProviderCommand(context.providerId, context.commandTemplate);
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}

		if (!isBinaryAvailable(command.binary)) {
			return { success: false, error: `${context.providerId} CLI "${command.binary}" not found in PATH` };
		}

		return await new Promise((resolve) => {
			let stdout = '';
			let stderr = '';
			let finished = false;
			let progressMarks = 0;
			const child = spawn(command.binary, command.args, {
				cwd: context.workingDirectory || process.cwd(),
				shell: process.platform === 'win32',
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env }
			});

			const workerState = this.workerSessions.get(context.sessionId);
			if (workerState) {
				workerState.process = child;
			}

			const finalize = (result: { success: boolean; response?: string; error?: string }) => {
				if (finished) return;
				finished = true;
				resolve(result);
			};

			if (context.signal) {
				const onAbort = () => {
					try {
						child.kill('SIGTERM');
					} catch {
						// noop
					}
					finalize({ success: false, error: CANCELLED_ERROR });
				};
				if (context.signal.aborted) {
					onAbort();
					return;
				}
				context.signal.addEventListener('abort', onAbort, { once: true });
			}

			child.stdout?.on('data', (chunk: Buffer) => {
				const text = chunk.toString();
				stdout += text;
				progressMarks += 1;
				context.emitProgress(Math.min(90, progressMarks * 10), `${context.providerId} processing...`);
			});

			child.stderr?.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			child.on('error', (err) => {
				finalize({ success: false, error: err.message });
			});

			child.on('close', (code) => {
				const trimmed = stdout.trim();
				if (code === 0) {
					finalize({ success: true, response: trimmed });
					return;
				}
				const message = stderr.trim() || `Exited with code ${code}`;
				finalize({ success: false, error: message });
			});

			if (child.stdin) {
				child.stdin.write(context.prompt);
				child.stdin.end();
			}
		});
	}

	private assertSessionOwnsInstance(
		session: OpenclawSession,
		instanceId: string
	): { sessionId: string; mcpId?: string } {
		const owner = this.instanceOwners.get(instanceId);
		if (!owner) {
			throw new Error(`MCP instance "${instanceId}" is not managed by an openclaw session`);
		}
		if (owner.sessionId !== session.id) {
			throw new Error(`MCP instance "${instanceId}" is owned by another session`);
		}
		return owner;
	}
}

export const openclawBridge = new OpenclawBridgeService();

