import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createCreatorMission,
	creatorMissionPath,
	executeCreatorMission,
	readCreatorMissionTrace,
	setCreatorManifestRunnerForTests,
	setCreatorValidationCommandRunnerForTests,
	validateCreatorMission,
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

function fullPathBundle(repo: string): CreatorArtifactBundle {
	return {
		intent_packet: packet(),
		artifact_manifests: [
			manifest('domain_chip', repo),
			manifest('benchmark_pack', repo),
			manifest('specialization_path', repo),
			manifest('autoloop_policy', repo),
			manifest('tool_integration', repo),
			manifest('swarm_publish_packet', repo)
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
	setCreatorValidationCommandRunnerForTests(null);
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
		expect(trace.specialization_entry.required_artifacts).toEqual([
			'domain_chip',
			'benchmark_pack',
			'specialization_path',
			'autoloop_policy',
			'tool_integration',
			'swarm_publish_packet'
		]);
		expect(trace.specialization_entry.agent_entrypoint).toContain('benchmark to prove better tool use, reasoning, and decisions');
		expect(trace.specialization_entry.evaluation_loop.held_out).toContain('not used as mutation prompts');
		expect(trace.improvement_evidence).toMatchObject({
			status: 'missing',
			held_out_required: true,
			held_out_pass: false
		});
		expect(trace.links.canvas).toBe('http://127.0.0.1:4174/canvas?pipeline=creator-creator-request-test&mission=mission-creator-test');
		expect(trace.links.kanban).toBe('http://127.0.0.1:4174/kanban?mission=mission-creator-test');

		const saved = JSON.parse(await readFile(creatorMissionPath('mission-creator-test', stateDir), 'utf-8'));
		expect(saved.intent_packet.target_domain).toBe('startup-yc');
		expect(saved.artifact_manifests.map((manifest: { artifact_id: string }) => manifest.artifact_id)).toContain('startup-yc-domain-chip-v1');
		expect(saved.tasks).toHaveLength(8);
		expect(saved.specialization_entry.telegram_command).toContain('--surface telegram');
		expect(saved.improvement_evidence.status).toBe('missing');

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

	it('records full-path specialization improvement evidence without publishing to Swarm', async () => {
		const stateDir = await tempStateDir();
		await createCreatorMission(
			{
				brief: 'Create a Startup YC specialization path with benchmarked autoloop from Telegram and Spark Swarm',
				missionId: 'mission-creator-golden-path',
				requestId: 'req-golden-path',
				privacyMode: 'swarm_shared'
			},
			{
				stateDir,
				runManifestPlanner: async () => fullPathBundle(stateDir)
			}
		);

		setCreatorValidationCommandRunnerForTests(async (_executable, _args, options) => {
			await mkdir(path.join(options.cwd, 'reports'), { recursive: true });
			await writeFile(
				path.join(options.cwd, 'validation-ledger.json'),
				JSON.stringify({
					benchmark_evidence: {
						baseline_score: 0.42,
						candidate_score: 0.73,
						delta: 0.31,
						held_out_verdict: 'pass',
						benchmark_refs: ['benchmarks/startup-yc.visible.json', 'benchmarks/startup-yc.held-out.json'],
						reasoning_delta: 'Candidate correctly rejects formatting-only gains.',
						tool_usage_delta: 'Candidate uses the benchmark runner before autoloop keep decisions.',
						ability_delta: 'Agent chooses stronger Startup YC triage actions on held-out cases.'
					}
				}),
				'utf-8'
			);
			await writeFile(
				path.join(options.cwd, 'reports', 'creator-mission-status.json'),
				JSON.stringify({
					schema_version: 'adaptive_creator_loop.creator_mission_status.v1',
					mission_id: 'mission-creator-golden-path',
					read_only: true,
					claim_boundary: 'read-only product adapter over canonical creator-system outputs',
					canonical: {
						verdict: 'ready_for_swarm_packet',
						stage_status: 'review_required',
						evidence_tier: 'transfer_supported',
						evidence_mode: 'recomputed',
						automation_blocked: false,
						blocking_checks: [],
						warning_checks: [],
						missing_paths: [],
						recommended_next_command: 'review the local contribution packet'
					},
					publication: {
						publish_mode: 'swarm_shared',
						local_display_allowed: true,
						github_pr_allowed: false,
						swarm_shared_allowed: false,
						network_absorbable: false,
						requested_network_absorption: true,
						blocked_reason: 'Network absorption still needs review.',
						required_gates: ['human_operator_review', 'publication_approval'],
						missing_gates: ['publication_approval'],
						gate_status: { human_operator_review: true, publication_approval: false },
						unsafe_claim_blocked: true
					},
					source_packets: [],
					blockers: [{ source: 'publication_gate', message: 'Network absorption is not approved.' }],
					warnings: [],
					next_actions: ['Keep this local until the publication gate is approved.'],
					surface_adapters: {
						telegram: { text: 'Startup YC creator path is review-ready locally.', may_request_secret_paste: false },
						builder: {},
						spawner: {},
						canvas: {},
						kanban: {}
					}
				}),
				'utf-8'
			);
			return { exitCode: 0, stdout: 'ok', stderr: '' };
		});

		const result = await validateCreatorMission(
			{ missionId: 'mission-creator-golden-path' },
			{ stateDir, now: () => new Date('2026-04-30T13:00:00.000Z') }
		);

		expect(result.run.status).toBe('passed');
		expect(result.trace.stage_status).toBe('validated');
		expect(result.trace.validation_runs).toHaveLength(1);
		expect(result.trace.tasks.map((task) => task.id)).toEqual([
			'creator-intent-plan',
			'domain-chip-contract',
			'benchmark-pack',
			'specialization-path',
			'autoloop-policy',
			'telegram-spawner-flow',
			'creator-validation',
			'swarm-publish-packet'
		]);
		expect(result.trace.validation_gates.map((gate) => gate.id)).toEqual([
			'schema_gate',
			'lineage_gate',
			'benchmark_gate',
			'benchmark_proof_gate',
			'complexity_gate',
			'memory_hygiene_gate',
			'transfer_gate',
			'publish_review_gate'
		]);
		expect(result.trace.specialization_entry).toMatchObject({
			telegram_command: '/creator plan --domain startup-yc --surface telegram --benchmark held-out',
			required_artifacts: ['domain_chip', 'benchmark_pack', 'specialization_path', 'autoloop_policy', 'tool_integration', 'swarm_publish_packet']
		});
		expect(result.trace.specialization_entry.evaluation_loop.keep_rule).toContain('held-out passes');
		expect(result.trace.benchmark_summary).toEqual({
			baseline_score: 0.42,
			candidate_score: 0.73,
			delta: 0.31,
			held_out_pass: true
		});
		expect(result.trace.improvement_evidence).toMatchObject({
			status: 'recorded',
			baseline_score: 0.42,
			candidate_score: 0.73,
			delta: 0.31,
			held_out_required: true,
			held_out_pass: true,
			validation_run_id: result.run.run_id,
			benchmark_refs: ['benchmarks/startup-yc.visible.json', 'benchmarks/startup-yc.held-out.json']
		});
		expect(result.trace.improvement_evidence.notes.join('\n')).toContain('benchmark runner before autoloop keep decisions');
		expect(result.trace.benchmarks).toEqual(['benchmarks/startup-yc.visible.json', 'benchmarks/startup-yc.held-out.json']);
		expect(result.trace.canonical).toMatchObject({
			verdict: 'ready_for_swarm_packet',
			stage_status: 'review_required',
			evidence_tier: 'transfer_supported',
			evidence_mode: 'recomputed'
		});
		expect(result.trace.publication).toMatchObject({
			publish_mode: 'swarm_shared',
			swarm_shared_allowed: false,
			network_absorbable: false,
			missing_gates: ['publication_approval']
		});
		expect(result.trace.creator_mission_status?.schema_version).toBe('adaptive_creator_loop.creator_mission_status.v1');
		expect(result.trace.blockers.join('\n')).toContain('publication_gate: Network absorption is not approved.');
		expect(result.trace.publish_readiness).toBe('workspace_validated');
		expect(result.trace.stage_status).not.toBe('published');
		expect(result.trace.swarm).toMatchObject({
			payload_ready: false,
			api_ready: false,
			publish_mode: 'swarm_shared'
		});
		const saved = JSON.parse(await readFile(creatorMissionPath('mission-creator-golden-path', stateDir), 'utf-8'));
		expect(saved.improvement_evidence.status).toBe('recorded');
		expect(saved.swarm.payload_ready).toBe(false);
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

	it('runs allowlisted manifest validation commands and updates the trace', async () => {
		const stateDir = await tempStateDir();
		setCreatorValidationCommandRunnerForTests(async (executable, args, options) => ({
			exitCode: executable === 'python' && args[0] === '--version' && options.cwd === stateDir ? 0 : 1,
			stdout: 'Python 3.13.5',
			stderr: ''
		}));
		await createCreatorMission(
			{
				brief: 'Create Startup YC path',
				missionId: 'mission-creator-validate',
				requestId: 'req-validate'
			},
			{
				stateDir,
				runManifestPlanner: async () => ({
					intent_packet: packet({ target_domain: 'startup-yc' }),
					artifact_manifests: [
						{
							schema_version: 'spark-artifact-manifest.v1',
							artifact_id: 'startup-yc-validation-v1',
							artifact_type: 'creator_report',
							repo: stateDir,
							inputs: ['creator-intent-startup-yc-test'],
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

		const result = await validateCreatorMission(
			{ missionId: 'mission-creator-validate' },
			{ stateDir, now: () => new Date('2026-04-30T12:00:00.000Z') }
		);

		expect(result.run.status).toBe('passed');
		expect(result.run.results[0]).toMatchObject({
			status: 'passed',
			command: 'python --version',
			stdout_tail: 'Python 3.13.5'
		});
		expect(result.trace.stage_status).toBe('validated');
		expect(result.trace.publish_readiness).toBe('workspace_validated');
		const saved = JSON.parse(await readFile(creatorMissionPath('mission-creator-validate', stateDir), 'utf-8'));
		expect(saved.validation_runs).toHaveLength(1);
	});

	it('reports per-command validation progress', async () => {
		const stateDir = await tempStateDir();
		const progressEvents: Array<{ phase: string; index: number; total: number; command: string; status?: string }> = [];
		await createCreatorMission(
			{
				brief: 'Create Startup YC path',
				missionId: 'mission-creator-validate-progress',
				requestId: 'req-validate-progress'
			},
			{
				stateDir,
				runManifestPlanner: async () => ({
					intent_packet: packet({ target_domain: 'startup-yc' }),
					artifact_manifests: [
						{
							schema_version: 'spark-artifact-manifest.v1',
							artifact_id: 'startup-yc-validation-progress-v1',
							artifact_type: 'creator_report',
							repo: stateDir,
							inputs: ['creator-intent-startup-yc-test'],
							outputs: ['reports/creator-run-summary.json'],
							validation_commands: ['python --version', 'python -m pytest tests'],
							promotion_gates: ['schema_gate', 'rollback_gate'],
							rollback_plan: 'Delete generated reports.'
						}
					],
					validation_issues: []
				})
			}
		);

		const result = await validateCreatorMission(
			{ missionId: 'mission-creator-validate-progress' },
			{
				stateDir,
				commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
				onCommandProgress: (event) => {
					progressEvents.push({
						phase: event.phase,
						index: event.index,
						total: event.total,
						command: event.command,
						status: event.result?.status
					});
				}
			}
		);

		expect(result.run.status).toBe('passed');
		expect(progressEvents).toEqual([
			{ phase: 'started', index: 1, total: 2, command: 'python --version', status: undefined },
			{ phase: 'completed', index: 1, total: 2, command: 'python --version', status: 'passed' },
			{ phase: 'started', index: 2, total: 2, command: 'python -m pytest tests', status: undefined },
			{ phase: 'completed', index: 2, total: 2, command: 'python -m pytest tests', status: 'passed' }
		]);
	});

	it('runs npm manifest validation commands through the platform executable', async () => {
		const stateDir = await tempStateDir();
		await createCreatorMission(
			{
				brief: 'Create Startup YC path',
				missionId: 'mission-creator-validate-npm',
				requestId: 'req-validate-npm'
			},
			{
				stateDir,
				runManifestPlanner: async () => ({
					intent_packet: packet({ target_domain: 'startup-yc' }),
					artifact_manifests: [
						{
							schema_version: 'spark-artifact-manifest.v1',
							artifact_id: 'startup-yc-node-validation-v1',
							artifact_type: 'tool_integration',
							repo: stateDir,
							inputs: ['creator-intent-startup-yc-test'],
							outputs: ['package.json'],
							validation_commands: ['npm --version'],
							promotion_gates: ['schema_gate', 'rollback_gate'],
							rollback_plan: 'No generated files to remove.'
						}
					],
					validation_issues: []
				})
			}
		);

		const result = await validateCreatorMission(
			{ missionId: 'mission-creator-validate-npm' },
			{ stateDir, timeoutMs: 30_000 }
		);

		expect(result.run.status).toBe('passed');
		expect(result.run.results[0]).toMatchObject({
			status: 'passed',
			command: 'npm --version'
		});
		expect(result.run.results[0].stdout_tail.trim()).toMatch(/^\d+\.\d+\.\d+/);
	});
});
