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
		}
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
		expect(body.trace.current_stage).toBe('execution_started');
		expect(capturedAutoRun).toBe(true);
	});

	it('rejects execution requests without a mission or request id', async () => {
		const response = await POST(event('http://127.0.0.1/api/creator/mission/execute', {}) as never);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('missionId or requestId is required');
	});
});
