import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createCreatorMission,
	creatorMissionPath,
	readCreatorMissionTrace,
	type CreatorIntentPacket
} from './creator-mission';

let tempDirs: string[] = [];

function packet(overrides: Partial<CreatorIntentPacket> = {}): CreatorIntentPacket {
	return {
		schema_version: 'spark-creator-intent.v1',
		user_goal: 'Create a Startup YC specialization path with benchmarked autoloop from Telegram and Spark Swarm',
		target_domain: 'startup-yc',
		target_operator_surface: 'telegram+builder+swarm',
		expected_agent_capability: 'Improve Spark startup-yc capability.',
		success_examples: ['Benchmark improves on held-out Startup YC cases.'],
		failure_examples: ['Score improves only through formatting.'],
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
		...overrides
	};
}

async function tempStateDir(): Promise<string> {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'spawner-creator-mission-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true });
	}
	tempDirs = [];
});

describe('creator mission trace', () => {
	it('creates a persisted full-path trace from a creator intent packet', async () => {
		const stateDir = await tempStateDir();
		const trace = await createCreatorMission(
			{
				brief: 'Create a Startup YC specialization path with benchmarked autoloop from Telegram and Spark Swarm',
				missionId: 'mission-creator-test',
				requestId: 'creator-request-test',
				baseUrl: 'http://127.0.0.1:4174'
			},
			{
				stateDir,
				now: () => new Date('2026-04-30T10:00:00.000Z'),
				runPlanner: async () => packet()
			}
		);

		expect(trace).toMatchObject({
			schema_version: 'spark-creator-trace.v1',
			mission_id: 'mission-creator-test',
			request_id: 'creator-request-test',
			creator_mode: 'full_path',
			current_stage: 'task_graph_created',
			stage_status: 'queued',
			artifacts: ['domain_chip', 'benchmark_pack', 'specialization_path', 'autoloop_policy', 'telegram_flow', 'swarm_publish_packet'],
			swarm: { payload_ready: false, api_ready: false, publish_mode: 'swarm_shared' }
		});
		expect(trace.tasks.map((task) => task.id)).toEqual([
			'creator-intent-plan',
			'domain-chip-contract',
			'benchmark-pack',
			'specialization-path',
			'autoloop-policy',
			'telegram-spawner-flow',
			'creator-validation',
			'swarm-publish-packet'
		]);
		expect(trace.validation_gates.map((gate) => gate.id)).toContain('publish_review_gate');
		expect(trace.links.canvas).toBe('http://127.0.0.1:4174/canvas?pipeline=creator-creator-request-test&mission=mission-creator-test');
		expect(trace.links.kanban).toBe('http://127.0.0.1:4174/kanban?mission=mission-creator-test');

		const saved = JSON.parse(await readFile(creatorMissionPath('mission-creator-test', stateDir), 'utf-8'));
		expect(saved.intent_packet.target_domain).toBe('startup-yc');
		expect(saved.tasks).toHaveLength(8);

		const queuedCanvas = JSON.parse(await readFile(path.join(stateDir, 'pending-load.json'), 'utf-8'));
		expect(queuedCanvas).toMatchObject({
			requestId: 'creator-request-test',
			missionId: 'mission-creator-test',
			pipelineId: 'creator-creator-request-test',
			source: 'creator-mission',
			autoRun: false,
			buildMode: 'advanced_prd'
		});
		expect(queuedCanvas.nodes).toHaveLength(8);
		expect(queuedCanvas.connections.length).toBeGreaterThan(0);
	});

	it('can look up a trace by request id', async () => {
		const stateDir = await tempStateDir();
		await createCreatorMission(
			{ brief: 'Make Spark good at investor diligence', missionId: 'mission-creator-lookup', requestId: 'req-lookup' },
			{ stateDir, runPlanner: async () => packet({ target_domain: 'investor-diligence' }) }
		);

		const trace = await readCreatorMissionTrace({ requestId: 'req-lookup' }, stateDir);
		expect(trace?.mission_id).toBe('mission-creator-lookup');
		expect(trace?.intent_packet.target_domain).toBe('investor-diligence');
	});
});
