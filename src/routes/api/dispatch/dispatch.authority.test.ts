import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/provider-runtime', () => ({
	providerRuntime: {
		getMissionStatus: vi.fn(() => ({
			providers: {},
			snapshotAvailable: false,
			allComplete: false
		})),
		dispatch: vi.fn(async ({ executionPack }) => ({
			success: true,
			missionId: executionPack.missionId,
			sessions: { codex: { status: 'running' } },
			startedAt: '2026-05-31T00:00:00.000Z'
		}))
	}
}));

import { POST } from './+server';
import { providerRuntime } from '$lib/server/provider-runtime';

const executionPack = {
	enabled: true,
	strategy: 'single',
	primaryProviderId: 'codex',
	providers: [
		{
			id: 'codex',
			label: 'Codex',
			model: 'gpt-5.5',
			enabled: true,
			kind: 'terminal_cli',
			eventSource: 'codex',
			requiresApiKey: false
		}
	],
	assignments: {},
	mcpTaskPlans: {},
	blockedTaskIds: [],
	masterPrompt: '# Mission: Authority Probe',
	providerPrompts: {},
	launchCommands: {},
	createdAt: '2026-05-31T00:00:00.000Z',
	missionId: 'mission-authority-probe'
};

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1:3333/api/dispatch', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/dispatch'),
		getClientAddress: () => '127.0.0.1'
	};
}

function machineAuthority() {
	return {
		schema: 'spark.machine_origin_policy.v1',
		origin: 'spawner-ui.test',
		source: 'dispatch_authority_test',
		reason: 'Focused dispatch authority regression.',
		allowedTools: ['spawner.dispatch'],
		mutationClassesAllowed: ['launches_mission'],
		networkPolicy: 'local_only'
	};
}

describe('/api/dispatch authority contract', () => {
	it('blocks provider dispatch when no TurnIntent or machine-origin policy is present', async () => {
		const dispatch = vi.mocked(providerRuntime.dispatch);
		dispatch.mockClear();

		const response = await POST(event({ executionPack }) as never);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('allows provider dispatch with an explicit machine-origin policy', async () => {
		const dispatch = vi.mocked(providerRuntime.dispatch);
		dispatch.mockClear();

		const response = await POST(event({
			executionPack,
			executionAuthority: machineAuthority()
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.authority).toMatchObject({
			allowed: true,
			source: 'machine_origin_policy',
			origin: 'spawner-ui.test'
		});
		expect(dispatch).toHaveBeenCalledTimes(1);
	});
});
