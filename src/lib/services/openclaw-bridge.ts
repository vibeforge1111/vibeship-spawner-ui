import { randomUUID } from 'node:crypto';
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
	| 'events.subscribe';

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
	'events.subscribe'
];

export interface OpenclawBridgeEvent {
	id: string;
	type: string;
	sessionId: string;
	timestamp: string;
	data: Record<string, unknown>;
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

interface OpenclawCanvasNode {
	id: string;
	skillId: string;
	skillName: string;
	description: string;
	position: { x: number; y: number };
}

interface OpenclawCanvasConnection {
	id: string;
	sourceNodeId: string;
	targetNodeId: string;
}

type OpenclawSubscriber = (event: OpenclawBridgeEvent) => void;

const MAX_SESSION_EVENTS = 500;

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

	subscribe(sessionId: string, callback: OpenclawSubscriber): () => void {
		if (!this.subscribers.has(sessionId)) {
			this.subscribers.set(sessionId, new Set());
		}
		this.subscribers.get(sessionId)!.add(callback);
		return () => {
			this.subscribers.get(sessionId)?.delete(callback);
		};
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

		// Emit into the global event bridge for shared observability.
		eventBridge.emit({
			id: event.id,
			type,
			source: 'openclaw',
			timestamp: event.timestamp,
			missionId: session.mission?.id,
			data: {
				...data,
				sessionId
			}
		});

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
