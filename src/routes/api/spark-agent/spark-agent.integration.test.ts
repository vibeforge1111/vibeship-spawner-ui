import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as startSession } from './session/start/+server';
import { POST as command } from './command/+server';
import { GET as events } from './events/+server';
import { GET as canvasState } from './canvas-state/+server';
import { POST as endSession } from './session/end/+server';
import { sparkAgentBridge } from '$lib/services/spark-agent-bridge';
import { getConnections } from '$lib/services/mcp/client';

async function readChunk(response: Response, timeoutMs = 1000): Promise<string> {
	if (!response.body) {
		return '';
	}
	const reader = response.body.getReader();
	const readPromise = reader.read();
	const timeout = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
		setTimeout(() => resolve({ done: true, value: undefined }), timeoutMs)
	);
	const result = await Promise.race([readPromise, timeout]);
	if (result.done || !result.value) {
		return '';
	}
	return new TextDecoder().decode(result.value);
}

afterEach(() => {
	getConnections().clear();
	sparkAgentBridge.resetForTests();
});

describe('/api/spark-agent integration', () => {
	it('rejects non-local requests without an API key', async () => {
		const response = await command({
			request: new Request('https://example.com/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: 'non-local',
					command: 'canvas.get_state'
				})
			})
		} as never);
		expect(response.status).toBe(401);
	});

	it('runs a full session flow: start -> canvas -> mission -> status -> end', async () => {
		const startResponse = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'integration-test' })
			})
		} as never);
		expect(startResponse.status).toBe(200);
		const started = await startResponse.json();
		const sessionId = started.session.id as string;
		expect(typeof sessionId).toBe('string');

		const createPipelineResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.create_pipeline',
					params: { name: 'Integration Pipeline' }
				})
			})
		} as never);
		expect(createPipelineResponse.status).toBe(200);

		const addSkillAResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.add_skill',
					params: {
						nodeId: 'node-a',
						skillId: 'planner',
						skillName: 'Planner',
						description: 'Plan implementation'
					}
				})
			})
		} as never);
		expect(addSkillAResponse.status).toBe(200);

		const addSkillBResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.add_skill',
					params: {
						nodeId: 'node-b',
						skillId: 'implementer',
						skillName: 'Implementer',
						description: 'Implement planned changes'
					}
				})
			})
		} as never);
		expect(addSkillBResponse.status).toBe(200);

		const addConnectionResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.add_connection',
					params: {
						sourceNodeId: 'node-a',
						targetNodeId: 'node-b'
					}
				})
			})
		} as never);
		expect(addConnectionResponse.status).toBe(200);

		const missionBuildResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'mission.build',
					params: { name: 'Integration Mission' }
				})
			})
		} as never);
		expect(missionBuildResponse.status).toBe(200);
		const built = await missionBuildResponse.json();
		expect(built.data.mission.tasks.length).toBe(2);

		const missionStartResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'mission.start'
				})
			})
		} as never);
		expect(missionStartResponse.status).toBe(200);

		const missionStatusResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'mission.status'
				})
			})
		} as never);
		expect(missionStatusResponse.status).toBe(200);
		const missionStatusBody = await missionStatusResponse.json();
		expect(missionStatusBody.data.mission.status).toBe('running');

		const mcpListResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'mcp.list'
				})
			})
		} as never);
		expect(mcpListResponse.status).toBe(200);
		const mcpListBody = await mcpListResponse.json();
		expect(mcpListBody.data.registryCount).toBeGreaterThan(0);

		const endResponse = await endSession({
			request: new Request('http://localhost/api/spark-agent/session/end', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					reason: 'integration-complete'
				})
			})
		} as never);
		expect(endResponse.status).toBe(200);
		const ended = await endResponse.json();
		expect(ended.session.status).toBe('ended');
	});

	it('streams session events over /api/spark-agent/events', async () => {
		const startResponse = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			})
		} as never);
		const started = await startResponse.json();
		const sessionId = started.session.id as string;

		const abortController = new AbortController();
		const eventsResponse = await events({
			request: new Request(`http://localhost/api/spark-agent/events?sessionId=${sessionId}`, {
				method: 'GET',
				signal: abortController.signal
			}),
			url: new URL(`http://localhost/api/spark-agent/events?sessionId=${sessionId}`)
		} as never);
		expect(eventsResponse.status).toBe(200);

		const firstChunk = await readChunk(eventsResponse, 1000);
		expect(firstChunk).toContain('"type":"connected"');
		expect(firstChunk).toContain(sessionId);
		abortController.abort();
	});

	it('returns latest canvas snapshot for browser polling', async () => {
		const startResponse = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'canvas-sync-test' })
			})
		} as never);
		const sessionId = (await startResponse.json()).session.id as string;

		await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.create_pipeline',
					params: {
						pipelineId: 'pipe-live-sync',
						name: 'Live Sync Pipeline'
					}
				})
			})
		} as never);

		await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'canvas.add_skill',
					params: {
						nodeId: 'node-tagged',
						skillId: 'frontend-polish',
						skillName: 'Frontend Polish',
						description: 'Polish canvas nodes',
						tags: ['canvas', 'visual-hierarchy'],
						skills: ['frontend-engineer', 'ui-design', 'responsive-mobile-first']
					}
				})
			})
		} as never);

		const response = await canvasState({
			request: new Request('http://localhost/api/spark-agent/canvas-state', {
				method: 'GET'
			}),
			url: new URL('http://localhost/api/spark-agent/canvas-state')
		} as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.hasUpdate).toBe(true);
		expect(body.snapshot.pipelineId).toBe('pipe-live-sync');
		expect(body.snapshot.nodes[0]).toMatchObject({
			id: 'node-tagged',
			tags: ['canvas', 'visual-hierarchy'],
			skillChain: ['frontend-engineer', 'ui-design', 'responsive-mobile-first']
		});

		const sinceResponse = await canvasState({
			request: new Request(`http://localhost/api/spark-agent/canvas-state?since=${encodeURIComponent(body.snapshot.updatedAt)}`, {
				method: 'GET'
			}),
			url: new URL(`http://localhost/api/spark-agent/canvas-state?since=${encodeURIComponent(body.snapshot.updatedAt)}`)
		} as never);
		expect(sinceResponse.status).toBe(200);
		const sinceBody = await sinceResponse.json();
		expect(sinceBody.hasUpdate).toBe(false);
		expect(sinceBody.snapshot).toBeNull();
	});

	it('streams normalized worker lifecycle events (started/progress/completed)', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
			context.emitProgress(40, `${context.providerId} boot`);
			context.emitProgress(85, `${context.providerId} run`);
			return { success: true, response: 'done' };
		});

		const startResponse = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'worker-test' })
			})
		} as never);
		const sessionId = (await startResponse.json()).session.id as string;

		const runResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'worker.run',
					params: {
						providerId: 'codex',
						missionId: 'mission-worker-events',
						prompt: 'Do the work',
						model: 'gpt-5.5'
					}
				})
			})
		} as never);
		expect(runResponse.status).toBe(200);
		const runBody = await runResponse.json();
		expect(runBody.data.success).toBe(true);
		expect(runBody.data.sparkAgentSessionId).toBe(sessionId);

		const abortController = new AbortController();
		const eventsResponse = await events({
			request: new Request(`http://localhost/api/spark-agent/events?sessionId=${sessionId}`, {
				method: 'GET',
				signal: abortController.signal
			}),
			url: new URL(`http://localhost/api/spark-agent/events?sessionId=${sessionId}`)
		} as never);
		expect(eventsResponse.status).toBe(200);

		const chunk = await readChunk(eventsResponse, 1000);
		expect(chunk).toContain('"type":"connected"');
		expect(chunk).toContain(sessionId);

		const sessionEvents = sparkAgentBridge.getSessionEvents(sessionId);
		expect(sessionEvents.some((event) => event.type === 'task_started')).toBe(true);
		expect(sessionEvents.some((event) => event.type === 'task_progress')).toBe(true);
		expect(sessionEvents.some((event) => event.type === 'task_completed')).toBe(true);
		expect(sessionEvents.some((event) => event.data.sparkAgentSessionId === sessionId)).toBe(true);
		abortController.abort();
	});

	it('does not accept caller-supplied worker command templates through the API', async () => {
		let observedCommandTemplate = '';
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
			observedCommandTemplate = context.commandTemplate;
			return { success: true, response: 'done' };
		});

		const startResponse = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'worker-command-template-test' })
			})
		} as never);
		const sessionId = (await startResponse.json()).session.id as string;

		const runResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					command: 'worker.run',
					params: {
						providerId: 'codex',
						missionId: 'mission-worker-template',
						prompt: 'Do the work',
						model: 'gpt-5.5',
						commandTemplate: 'codex exec --yolo && calc'
					}
				})
			})
		} as never);

		expect(runResponse.status).toBe(200);
		expect(observedCommandTemplate).toBe('codex exec --model gpt-5.5 --sandbox workspace-write');
	});

	it('rejects unsafe internal provider command templates before process execution', async () => {
		const result = await sparkAgentBridge.executeProviderTask({
			providerId: 'codex',
			missionId: 'mission-unsafe-template',
			prompt: 'Do the work',
			commandTemplate: 'codex exec --yolo && calc'
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('unsafe shell characters');
	});

	it('isolates MCP instances by session for list, call, and disconnect', async () => {
		const startA = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'session-a' })
			})
		} as never);
		const sessionA = (await startA.json()).session.id as string;

		const startB = await startSession({
			request: new Request('http://localhost/api/spark-agent/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'session-b' })
			})
		} as never);
		const sessionB = (await startB.json()).session.id as string;

		const ownCallTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
		const foreignCallTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'nope' }] });
		const ownClose = vi.fn().mockResolvedValue(undefined);
		const foreignClose = vi.fn().mockResolvedValue(undefined);

		const connections = getConnections();
		connections.set(
			'instance-owned',
			{
				client: { callTool: ownCallTool, close: ownClose },
				transport: {},
				tools: [{ name: 'ping', description: 'Ping tool' }],
				serverInfo: { name: 'owned-server', version: '1.0.0' }
			} as never
		);
		connections.set(
			'instance-foreign',
			{
				client: { callTool: foreignCallTool, close: foreignClose },
				transport: {},
				tools: [{ name: 'ping', description: 'Ping tool' }],
				serverInfo: { name: 'foreign-server', version: '1.0.0' }
			} as never
		);

		const bridgeInternals = sparkAgentBridge as unknown as {
			instanceOwners: Map<string, { sessionId: string; mcpId?: string }>;
		};
		bridgeInternals.instanceOwners.set('instance-owned', { sessionId: sessionA, mcpId: 'filesystem' });
		bridgeInternals.instanceOwners.set('instance-foreign', { sessionId: sessionB, mcpId: 'filesystem' });

		const listResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: sessionA, command: 'mcp.list' })
			})
		} as never);
		expect(listResponse.status).toBe(200);
		const listBody = await listResponse.json();
		expect(listBody.data.connected).toHaveLength(1);
		expect(listBody.data.connected[0].instanceId).toBe('instance-owned');

		const ownCallResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionA,
					command: 'mcp.call_tool',
					params: {
						instanceId: 'instance-owned',
						toolName: 'ping',
						args: { value: 1 }
					}
				})
			})
		} as never);
		expect(ownCallResponse.status).toBe(200);
		expect(ownCallTool).toHaveBeenCalledTimes(1);

		const foreignCallResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionA,
					command: 'mcp.call_tool',
					params: {
						instanceId: 'instance-foreign',
						toolName: 'ping',
						args: {}
					}
				})
			})
		} as never);
		expect(foreignCallResponse.status).toBe(400);
		const foreignCallBody = await foreignCallResponse.json();
		expect(foreignCallBody.error).toContain('owned by another session');
		expect(foreignCallTool).not.toHaveBeenCalled();

		const foreignDisconnectResponse = await command({
			request: new Request('http://localhost/api/spark-agent/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionA,
					command: 'mcp.disconnect',
					params: { instanceId: 'instance-foreign' }
				})
			})
		} as never);
		expect(foreignDisconnectResponse.status).toBe(400);
		expect(foreignClose).not.toHaveBeenCalled();
	});
});
