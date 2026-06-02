import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { syncCreatorMissionTraceFromLifecycleEvent } from './creator-mission-trace-sync';

const cleanupDirs: string[] = [];

afterEach(async () => {
	for (const dir of cleanupDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

function baseTrace(missionId: string): Record<string, unknown> {
	return {
		schema_version: 'spark-creator-trace.v1',
		trace_id: `trace:${missionId}`,
		intent_id: `intent:${missionId}`,
		mission_id: missionId,
		request_id: missionId,
		creator_mode: 'build',
		user_goal: 'Build a test app',
		repo_root: null,
		artifacts: [],
		artifact_manifests: [],
		artifact_manifest_validation_issues: [],
		repo_changes: [],
		benchmarks: [],
		publish_readiness: 'private_draft',
		validation_runs: [],
		tasks: [],
		validation_gates: [],
		current_stage: 'execution_running',
		stage_status: 'running',
		execution_policy: 'dry_run',
		intent_packet: {
			schema_version: 'spark-creator-intent.v1',
			intent_id: `intent:${missionId}`,
			mode: 'build',
			privacy_mode: 'private_draft',
			brief: 'Build a test app',
			deliverables: [],
			acceptance_checks: [],
			artifact_policy: { allowed: [], required: [] },
			repo_policy: { repo: null, branch: null, pull_request: null },
			created_at: '2026-04-30T08:00:00.000Z'
		},
		specialization_entry: {
			domain: 'general',
			label: 'General',
			confidence: 0,
			reasons: [],
			selected_at: '2026-04-30T08:00:00.000Z'
		},
		benchmark_summary: {
			baseline_score: null,
			candidate_score: null,
			delta: null,
			held_out_pass: false
		},
		improvement_evidence: {
			baseline_ref: null,
			candidate_ref: null,
			metrics: [],
			notes: []
		},
		swarm: {
			payload_ready: false,
			api_ready: false,
			publish_mode: 'private_draft'
		},
		blockers: [],
		links: {
			canvas: '',
			kanban: '',
			repo: '',
			pull_request: ''
		},
		created_at: '2026-04-30T08:00:00.000Z',
		updated_at: '2026-04-30T08:00:00.000Z'
	};
}

describe('creator mission trace sync', () => {
	it('does not treat a missing candidate score as completed validation', async () => {
		const stateDir = await mkdtemp(path.join(tmpdir(), 'creator-trace-sync-'));
		cleanupDirs.push(stateDir);
		const missionId = 'mission-creator-missing-candidate-score';
		const missionDir = path.join(stateDir, 'creator-missions');
		await mkdir(missionDir, { recursive: true });
		const trace = baseTrace(missionId);
		trace.benchmark_summary = {
			baseline_score: null,
			delta: null,
			held_out_pass: false
		};
		await writeFile(path.join(missionDir, `${missionId}.json`), JSON.stringify(trace, null, 2), 'utf-8');

		const synced = syncCreatorMissionTraceFromLifecycleEvent(
			{
				type: 'mission_completed',
				missionId,
				timestamp: '2026-04-30T09:00:00.000Z'
			},
			stateDir
		);

		expect(synced?.current_stage).toBe('execution_completed');
		const saved = JSON.parse(await readFile(path.join(missionDir, `${missionId}.json`), 'utf-8'));
		expect(saved.current_stage).toBe('execution_completed');
	});
});
