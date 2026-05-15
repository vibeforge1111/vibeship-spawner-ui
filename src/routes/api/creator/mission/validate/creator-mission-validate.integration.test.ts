import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './+server';
import {
	createCreatorMission,
	readCreatorMissionTrace,
	setCreatorValidationCommandRunnerForTests,
	type CreatorIntentPacket
} from '$lib/server/creator-mission';
import { getMissionControlRelaySnapshot } from '$lib/server/mission-control-relay';

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
		target_operator_surface: 'builder',
		expected_agent_capability: 'Improve Spark startup-yc capability.',
		success_examples: ['Held-out score improves.'],
		failure_examples: ['Formatting-only score movement.'],
		tools_in_scope: ['spark_intelligence_builder'],
		data_sources_allowed: ['local_repo'],
		risk_level: 'medium',
		privacy_mode: 'local_only',
		desired_outputs: {
			domain_chip: true,
			specialization_path: false,
			benchmark_pack: true,
			autoloop_policy: false,
			telegram_flow: false,
			spawner_mission: false,
			swarm_publish_packet: false
		},
		intent_id: 'creator-intent-startup-yc-validate',
		artifact_targets: ['creator_report'],
		usage_surfaces: ['builder'],
		success_claim: 'Improve Spark startup-yc capability.',
		capabilities_to_prove: ['detect default-dead risk'],
		benchmark_requirements: { visible_cases: 5, fixed_suite: true, trap_cases: true },
		network_contribution_policy: 'workspace_only'
	};
}

async function waitForValidationRun(missionId: string) {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const trace = await readCreatorMissionTrace({ missionId }, tempDir);
		if (trace && trace.validation_runs.length > 0) return trace;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(`Timed out waiting for validation run on ${missionId}`);
}

let tempDir = '';

beforeEach(async () => {
	tempDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-creator-validate-route-'));
	process.env.SPAWNER_STATE_DIR = tempDir;
	setCreatorValidationCommandRunnerForTests(async () => ({
		exitCode: 0,
		stdout: 'ok',
		stderr: ''
	}));
});

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
	setCreatorValidationCommandRunnerForTests(null);
	await rm(tempDir, { recursive: true, force: true });
});

describe('/api/creator/mission/validate', () => {
	it('runs manifest validations for an existing creator mission trace', async () => {
		await createCreatorMission(
			{ brief: 'Create Startup YC path', missionId: 'mission-creator-validate-api', requestId: 'req-validate-api' },
			{
				stateDir: tempDir,
				runManifestPlanner: async () => ({
					intent_packet: packet(),
					artifact_manifests: [
						{
							schema_version: 'spark-artifact-manifest.v1',
							artifact_id: 'startup-yc-creator-report-v1',
							artifact_type: 'creator_report',
							repo: tempDir,
							inputs: ['creator-intent-startup-yc-validate'],
							outputs: ['reports/creator-run-summary.json'],
							validation_commands: ['python --version'],
							promotion_gates: ['schema_gate', 'rollback_gate'],
							rollback_plan: 'Delete generated reports.'
						}
					],
					validation_issues: []
				})
			}
		);

		const response = await POST(event('http://127.0.0.1/api/creator/mission/validate', {
			missionId: 'mission-creator-validate-api'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.status).toBe('passed');
		expect(body.trace.stage_status).toBe('validated');
		expect(body.trace.validation_runs).toHaveLength(1);
		const snapshot = getMissionControlRelaySnapshot('mission-creator-validate-api');
		expect(snapshot.recent.some((entry) =>
			entry.eventType === 'task_progress' &&
			entry.summary.includes('Validation 1/1') &&
			entry.summary.includes('python --version')
		)).toBe(true);
	});

	it('accepts background validation and records the run asynchronously', async () => {
		await createCreatorMission(
			{ brief: 'Create Startup YC path', missionId: 'mission-creator-validate-async', requestId: 'req-validate-async' },
			{
				stateDir: tempDir,
				runManifestPlanner: async () => ({
					intent_packet: packet(),
					artifact_manifests: [
						{
							schema_version: 'spark-artifact-manifest.v1',
							artifact_id: 'startup-yc-creator-report-v1',
							artifact_type: 'creator_report',
							repo: tempDir,
							inputs: ['creator-intent-startup-yc-validate'],
							outputs: ['reports/creator-run-summary.json'],
							validation_commands: ['python --version'],
							promotion_gates: ['schema_gate', 'rollback_gate'],
							rollback_plan: 'Delete generated reports.'
						}
					],
					validation_issues: []
				})
			}
		);

		const response = await POST(event('http://127.0.0.1/api/creator/mission/validate', {
			missionId: 'mission-creator-validate-async',
			async: true
		}) as never);

		expect(response.status).toBe(202);
		const body = await response.json();
		expect(body).toMatchObject({
			ok: true,
			accepted: true,
			status: 'running',
			missionId: 'mission-creator-validate-async',
			requestId: 'req-validate-async'
		});
		const trace = await waitForValidationRun('mission-creator-validate-async');
		expect(trace.stage_status).toBe('validated');
		expect(trace.validation_runs[0].status).toBe('passed');
	});

	it('rejects validation requests without a mission or request id', async () => {
		const response = await POST(event('http://127.0.0.1/api/creator/mission/validate', {}) as never);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('missionId or requestId is required');
	});

	it('rejects unknown creator missions before enqueueing validation', async () => {
		const response = await POST(event('http://127.0.0.1/api/creator/mission/validate', {
			missionId: 'mission-creator-missing',
			async: true
		}) as never);
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe('creator mission trace not found');
	});
});
