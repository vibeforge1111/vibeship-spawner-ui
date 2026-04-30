import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createCreatorMission,
	creatorMissionPath,
	executeCreatorMission,
	readCreatorMissionTrace,
	setCreatorManifestRunnerForTests,
	type CreatorArtifactBundle,
	type CreatorArtifactManifest,
	type CreatorArtifactType,
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
		intent_id: 'creator-intent-startup-yc-test',
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
		network_contribution_policy: 'github_pr_required',
		...overrides
	};
}

function manifest(artifactType: CreatorArtifactType, repo: string): CreatorArtifactManifest {
	return {
		schema_version: 'spark-artifact-manifest.v1' as const,
		artifact_id: `startup-yc-${artifactType.replace(/_/g, '-')}-v1`,
		artifact_type: artifactType,
		repo,
		inputs: ['creator-intent-startup-yc-test'],
		outputs: [`${artifactType}.json`],
		validation_commands: ['python -m pytest tests'],
		promotion_gates: ['schema_gate', 'rollback_gate'],
		rollback_plan: `Revert ${artifactType}.`
	};
}

function bundle(overrides: Partial<CreatorIntentPacket> = {}): CreatorArtifactBundle {
	return {
		intent_packet: packet(overrides),
		artifact_manifests: [
			manifest('domain_chip', 'domain-chip-startup-yc'),
			manifest('benchmark_pack', 'startup-bench')
		],
		validation_issues: []
	};
}

async function tempStateDir(): Promise<string> {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'spawner-creator-mission-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	const { setCreatorDispatchRunnerForTests } = await import('./creator-mission');
	setCreatorManifestRunnerForTests(null);
	setCreatorDispatchRunnerForTests(null);
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
				runManifestPlanner: async () => bundle()
			}
		);

		expect(trace).toMatchObject({
			schema_version: 'spark-creator-trace.v1',
			trace_id: 'creator-trace-mission-creator-test',
			intent_id: 'creator-intent-startup-yc-test',
			mission_id: 'mission-creator-test',
			request_id: 'creator-request-test',
			creator_mode: 'full_path',
			current_stage: 'task_graph_created',
			stage_status: 'queued',
			artifacts: ['domain_chip', 'benchmark_pack', 'specialization_path', 'autoloop_policy', 'tool_integration', 'swarm_publish_packet'],
			artifact_manifests: [
				expect.objectContaining({
					artifact_id: 'startup-yc-domain-chip-v1',
					artifact_type: 'domain_chip',
					repo: 'domain-chip-startup-yc'
				}),
				expect.objectContaining({
					artifact_id: 'startup-yc-benchmark-pack-v1',
					artifact_type: 'benchmark_pack',
					repo: 'startup-bench'
				})
			],
			artifact_manifest_validation_issues: [],
			repo_changes: [],
			benchmarks: [],
			publish_readiness: 'private_draft',
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
		expect(saved.artifact_manifests.map((manifest: { artifact_id: string }) => manifest.artifact_id)).toContain('startup-yc-domain-chip-v1');
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
			{ stateDir, runManifestPlanner: async () => bundle({ target_domain: 'investor-diligence' }) }
		);

		const trace = await readCreatorMissionTrace({ requestId: 'req-lookup' }, stateDir);
		expect(trace?.mission_id).toBe('mission-creator-lookup');
		expect(trace?.intent_packet.target_domain).toBe('investor-diligence');
	});

	it('executes a persisted creator mission with an auto-run canvas load', async () => {
		const stateDir = await tempStateDir();
		await createCreatorMission(
			{
				brief: 'Create Startup YC path',
				missionId: 'mission-creator-execute',
				requestId: 'req-execute'
			},
			{
				stateDir,
				runManifestPlanner: async () => bundle({ target_domain: 'startup-yc' })
			}
		);

		let capturedLoad: any = null;
		const result = await executeCreatorMission(
			{ missionId: 'mission-creator-execute' },
			{
				stateDir,
				now: () => new Date('2026-04-30T11:00:00.000Z'),
				dispatchRunner: async (load) => {
					capturedLoad = load;
					return {
						started: true,
						missionId: load.missionId,
						projectPath: 'C:\\Users\\USER\\Desktop',
						providerId: 'codex'
					};
				}
			}
		);

		expect(result.dispatch.started).toBe(true);
		expect(capturedLoad.autoRun).toBe(true);
		expect(capturedLoad.relay.autoRun).toBe(true);
		expect(capturedLoad.executionPrompt).toContain('Target operating-system folder:');
		expect(capturedLoad.executionPrompt).toContain('Artifact manifests: domain_chip:domain-chip-startup-yc');
		expect(result.trace.current_stage).toBe('execution_started');
		expect(result.trace.stage_status).toBe('running');

		const saved = JSON.parse(await readFile(creatorMissionPath('mission-creator-execute', stateDir), 'utf-8'));
		expect(saved.current_stage).toBe('execution_started');
		expect(saved.updated_at).toBe('2026-04-30T11:00:00.000Z');

		const queuedCanvas = JSON.parse(await readFile(path.join(stateDir, 'last-canvas-load.json'), 'utf-8'));
		expect(queuedCanvas.autoRun).toBe(true);
		expect(queuedCanvas.relay.autoRun).toBe(true);
	});

	it('can use Builder creator manifests as the planning source', async () => {
		const stateDir = await tempStateDir();
		setCreatorManifestRunnerForTests(async () => ({
			intent_packet: packet({ target_domain: 'startup-yc' }),
			artifact_manifests: [
				{
					schema_version: 'spark-artifact-manifest.v1',
					artifact_id: 'startup-yc-specialization-path-v1',
					artifact_type: 'specialization_path',
					repo: 'specialization-path-startup-yc',
					inputs: ['creator-intent-startup-yc-test'],
					outputs: ['specialization-path.json'],
					validation_commands: ['python -m pytest tests'],
					promotion_gates: ['schema_gate', 'rollback_gate'],
					rollback_plan: 'Revert the specialization path commit.'
				}
			],
			validation_issues: []
		}));

		const trace = await createCreatorMission(
			{
				brief: 'Create Startup YC path',
				missionId: 'mission-creator-manifests',
				requestId: 'req-manifests'
			},
			{ stateDir }
		);

		expect(trace.artifact_manifests).toHaveLength(1);
		expect(trace.artifact_manifests[0].repo).toBe('specialization-path-startup-yc');
	});
});
