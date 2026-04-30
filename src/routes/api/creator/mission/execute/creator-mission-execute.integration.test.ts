import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './+server';
import {
	createCreatorMission,
	setCreatorDispatchRunnerForTests,
	type CreatorIntentPacket
} from '$lib/server/creator-mission';

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

function packet(): CreatorIntentPacket {
	return {
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
		privacy_mode: 'github_pr',
		desired_outputs: {
			domain_chip: true,
			specialization_path: true,
			benchmark_pack: true,
			autoloop_policy: true,
			telegram_flow: true,
			spawner_mission: true,
			swarm_publish_packet: true
		},
		intent_id: 'creator-intent-startup-yc-api',
		artifact_targets: ['domain_chip', 'benchmark_pack', 'specialization_path', 'autoloop_policy', 'tool_integration', 'swarm_publish_packet'],
		usage_surfaces: ['telegram', 'builder', 'spawner', 'swarm'],
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
	};
}

let tempDir = '';

beforeEach(async () => {
	tempDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-creator-execute-route-'));
	process.env.SPAWNER_STATE_DIR = tempDir;
});

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
	setCreatorDispatchRunnerForTests(null);
	await rm(tempDir, { recursive: true, force: true });
});

describe('/api/creator/mission/execute', () => {
	it('starts execution for an existing creator mission trace', async () => {
		await createCreatorMission(
			{ brief: 'Create Startup YC path', missionId: 'mission-creator-execute-api', requestId: 'req-execute-api' },
			{ stateDir: tempDir, runPlanner: async () => packet() }
		);

		let capturedAutoRun = false;
		setCreatorDispatchRunnerForTests(async (load) => {
			capturedAutoRun = load.autoRun === true && load.relay.autoRun === true;
			return {
				started: true,
				missionId: load.missionId,
				projectPath: 'C:\\Users\\USER\\Desktop',
				providerId: 'codex'
			};
		});

		const response = await POST(event('http://127.0.0.1/api/creator/mission/execute', {
			missionId: 'mission-creator-execute-api'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.started).toBe(true);
		expect(body.providerId).toBe('codex');
		expect(body.tracePath).toContain('mission-creator-execute-api.json');
		expect(body.trace.current_stage).toBe('execution_started');
		expect(body.trace.trace_id).toBe('creator-trace-mission-creator-execute-api');
		expect(capturedAutoRun).toBe(true);
	});

	it('rejects execution requests without a mission or request id', async () => {
		const response = await POST(event('http://127.0.0.1/api/creator/mission/execute', {}) as never);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('missionId or requestId is required');
	});
});
