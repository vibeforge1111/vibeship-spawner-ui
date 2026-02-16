import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as startSession } from './session/start/+server';
import { POST as command } from './command/+server';
import { GET as events } from './events/+server';
import { POST as endSession } from './session/end/+server';
import { openclawBridge } from '$lib/services/openclaw-bridge';
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
	openclawBridge.resetForTests();
});

describe('/api/openclaw integration', () => {
	it('rejects non-local requests without an API key', async () => {
		const response = await command({
			request: new Request('https://example.com/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/session/start', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/session/end', {
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

	it('streams session events over /api/openclaw/events', async () => {
		const startResponse = await startSession({
			request: new Request('http://localhost/api/openclaw/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			})
		} as never);
		const started = await startResponse.json();
		const sessionId = started.session.id as string;

		const abortController = new AbortController();
		const eventsResponse = await events({
			request: new Request(`http://localhost/api/openclaw/events?sessionId=${sessionId}`, {
				method: 'GET',
				signal: abortController.signal
			}),
			url: new URL(`http://localhost/api/openclaw/events?sessionId=${sessionId}`)
		} as never);
		expect(eventsResponse.status).toBe(200);

		const firstChunk = await readChunk(eventsResponse, 1000);
		expect(firstChunk).toContain('"type":"connected"');
		expect(firstChunk).toContain(sessionId);
		abortController.abort();
	});

	it('isolates MCP instances by session for list, call, and disconnect', async () => {
		const startA = await startSession({
			request: new Request('http://localhost/api/openclaw/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actor: 'session-a' })
			})
		} as never);
		const sessionA = (await startA.json()).session.id as string;

		const startB = await startSession({
			request: new Request('http://localhost/api/openclaw/session/start', {
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

		const bridgeInternals = openclawBridge as unknown as {
			instanceOwners: Map<string, { sessionId: string; mcpId?: string }>;
		};
		bridgeInternals.instanceOwners.set('instance-owned', { sessionId: sessionA, mcpId: 'filesystem' });
		bridgeInternals.instanceOwners.set('instance-foreign', { sessionId: sessionB, mcpId: 'filesystem' });

		const listResponse = await command({
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
			request: new Request('http://localhost/api/openclaw/command', {
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
