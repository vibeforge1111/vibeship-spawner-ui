import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';

vi.mock('$lib/server/mission-control-relay', () => ({
	relayMissionControlEvent: vi.fn(async () => undefined)
}));

function event(url: string, body?: unknown) {
	return {
		request: new Request(url, body === undefined ? undefined : {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL(url),
		getClientAddress: () => '127.0.0.1'
	};
}

let tempDir = '';

beforeEach(async () => {
	tempDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-creator-route-'));
	process.env.SPAWNER_STATE_DIR = tempDir;
});

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
	const { setCreatorPlanRunnerForTests } = await import('$lib/server/creator-mission');
	setCreatorPlanRunnerForTests(null);
	await rm(tempDir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

describe('/api/creator/mission', () => {
	it('creates and reads a creator mission trace', async () => {
		const { setCreatorPlanRunnerForTests } = await import('$lib/server/creator-mission');
		setCreatorPlanRunnerForTests(async () => ({
			schema_version: 'spark-creator-intent.v1',
			user_goal: 'Create Startup YC path',
			target_domain: 'startup-yc',
			target_operator_surface: 'telegram+builder+swarm',
			expected_agent_capability: 'Improve Spark startup-yc capability.',
			success_examples: ['Held-out score improves.'],
			failure_examples: ['Formatting-only score movement.'],
			tools_in_scope: ['spark_telegram_bot', 'spark_swarm'],
			data_sources_allowed: ['local_repo', 'spark_swarm'],
			risk_level: 'medium',
			privacy_mode: 'swarm_shared',
			desired_outputs: {
				domain_chip: true,
				specialization_path: true,
				benchmark_pack: true,
				autoloop_policy: true,
				telegram_flow: true,
				spawner_mission: false,
				swarm_publish_packet: true
			},
			intent_id: 'creator-intent-startup-yc-route',
			artifact_targets: ['domain_chip', 'benchmark_pack', 'specialization_path', 'autoloop_policy', 'tool_integration', 'swarm_publish_packet'],
			usage_surfaces: ['telegram', 'builder', 'swarm'],
			success_claim: 'Improve Spark startup-yc capability.',
			capabilities_to_prove: ['detect default-dead risk'],
			benchmark_requirements: {
				visible_cases: 20,
				fixed_suite: true,
				held_out_cases: true,
				trap_cases: true,
				simulator_transfer: true,
				fresh_agent_absorption: true,
				human_calibration: false
			},
			network_contribution_policy: 'github_pr_required'
		}));

		const postResponse = await POST(event('http://127.0.0.1/api/creator/mission', {
			brief: 'Create Startup YC path',
			missionId: 'mission-creator-api',
			requestId: 'creator-api-req'
		}) as never);
		expect(postResponse.status).toBe(200);
		const postBody = await postResponse.json();
		expect(postBody.trace.creator_mode).toBe('full_path');
		expect(postBody.trace.trace_id).toBe('creator-trace-mission-creator-api');
		expect(postBody.trace.intent_id).toBe('creator-intent-startup-yc-route');
		expect(postBody.tracePath).toContain('mission-creator-api.json');
		expect(postBody.trace.artifact_manifests[0].artifact_type).toBe('domain_chip');
		expect(postBody.trace.intent_packet.target_domain).toBe('startup-yc');
		expect(postBody.taskCount).toBeGreaterThan(1);
		expect(postBody.canvasUrl).toBe('http://127.0.0.1/canvas?pipeline=creator-creator-api-req&mission=mission-creator-api');
		expect(postBody.trace.tasks.map((task: { id: string }) => task.id)).toContain('benchmark-pack');

		const { relayMissionControlEvent } = await import('$lib/server/mission-control-relay');
		expect(vi.mocked(relayMissionControlEvent)).toHaveBeenCalledTimes(3);
		const missionCreatedCall = vi.mocked(relayMissionControlEvent).mock.calls[0]?.[0] as {
			type?: string;
			data?: { plannedTasks?: Array<{ title: string }> };
		};
		const taskCompletedCall = vi.mocked(relayMissionControlEvent).mock.calls[2]?.[0] as {
			type?: string;
			data?: { taskGraph?: Array<{ id: string }> };
		};
		expect(missionCreatedCall.type).toBe('mission_created');
		expect(missionCreatedCall.data?.plannedTasks?.length).toBe(postBody.taskCount);
		expect(taskCompletedCall.type).toBe('task_completed');
		expect(taskCompletedCall.data?.taskGraph?.map((task) => task.id)).toContain('creator-validation');

		const getResponse = await GET(event('http://127.0.0.1/api/creator/mission?requestId=creator-api-req') as never);
		expect(getResponse.status).toBe(200);
		const getBody = await getResponse.json();
		expect(getBody.trace.mission_id).toBe('mission-creator-api');
		expect(getBody.tracePath).toContain('mission-creator-api.json');
	});

	it('rejects missing briefs', async () => {
		const response = await POST(event('http://127.0.0.1/api/creator/mission', {}) as never);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('brief is required');
	});
});
