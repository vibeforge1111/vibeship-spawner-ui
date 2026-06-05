import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/mcp/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/services/mcp/client')>();
	return {
		...actual,
		callTool: vi.fn(),
		isConnected: vi.fn()
	};
});

import { POST } from './+server';
import { callTool, isConnected } from '$lib/services/mcp/client';
import {
	buildClientGovernorDecisionAuthority,
	buildClientTurnIntentVNextAuthority
} from '$lib/services/harness-authority-client';

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1/api/mcp/call', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/mcp/call'),
		getClientAddress: () => '127.0.0.1'
	};
}

function callAuthority() {
	return buildClientGovernorDecisionAuthority({
		source: 'mcp-call.authority.test',
		reason: 'Focused MCP tool-call authority regression.',
		toolName: 'spawner.mcp.call_tool',
		mutationClass: 'external_network',
		target: 'filesystem:ping',
		externalNetwork: true
	});
}

describe('/api/mcp/call authority contract', () => {
	beforeEach(() => {
		vi.mocked(isConnected).mockReset();
		vi.mocked(isConnected).mockReturnValue(true);
		vi.mocked(callTool).mockReset();
		vi.mocked(callTool).mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
	});

	it('blocks MCP tool calls without Harness Core authority', async () => {
		const response = await POST(
			event({
				instanceId: 'filesystem',
				toolName: 'ping',
				args: { value: 1 }
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
		expect(callTool).not.toHaveBeenCalled();
	});

	it('blocks MCP tool calls with bare TurnIntentEnvelopeVNext authority', async () => {
		const response = await POST(
			event({
				instanceId: 'filesystem',
				toolName: 'ping',
				args: { value: 1 },
				executionAuthority: buildClientTurnIntentVNextAuthority({
					source: 'mcp-call.authority.test',
					reason: 'Focused MCP tool-call bare-VNext regression.',
					toolName: 'spawner.mcp.call_tool',
					mutationClass: 'external_network',
					target: 'filesystem:ping',
					externalNetwork: true
				})
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
		expect(callTool).not.toHaveBeenCalled();
	});

	it('allows MCP tool calls with native GovernorDecisionV1 authority', async () => {
		const response = await POST(
			event({
				instanceId: 'filesystem',
				toolName: 'ping',
				args: { value: 1 },
				executionAuthority: callAuthority()
			}) as never
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.authority).toMatchObject({
			allowed: true,
			source: 'governor_decision',
			governorOutcome: 'execute'
		});
		expect(callTool).toHaveBeenCalledWith('filesystem', 'ping', { value: 1 });
	});
});
