import { describe, expect, it } from 'vitest';
import {
	enrichMissionControlBoardWithProviderResults,
	summarizeProviderResults
} from './mission-control-results';
import type { MissionControlBoardEntry } from './mission-control-relay';
import type { ProviderMissionResultSnapshot } from './provider-runtime';

function result(overrides: Partial<ProviderMissionResultSnapshot>): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'completed',
		response: null,
		error: null,
		durationMs: null,
		tokenUsage: null,
		startedAt: '2026-04-25T00:00:00.000Z',
		completedAt: '2026-04-25T00:00:01.000Z',
		...overrides
	};
}

function entry(
	missionId: string,
	overrides: Partial<MissionControlBoardEntry> = {}
): MissionControlBoardEntry {
	return {
		missionId,
		missionName: null,
		status: 'completed',
		lastEventType: 'mission_completed',
		lastUpdated: '2026-04-25T00:00:01.000Z',
		queuedAt: null,
		startedAt: null,
		lastSummary: '[MissionControl] Mission completed.',
		taskName: null,
		taskCount: 0,
		taskNames: [],
		taskStatusCounts: { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: 0 },
		tasks: [],
		...overrides
	};
}

describe('mission-control-results', () => {
	it('summarizes completed provider responses for mission cards', () => {
		const summary = summarizeProviderResults([
			result({ providerId: 'codex', response: 'SPARK_SPAWNER_CODEX_OK\n\nextra detail' })
		]);

		expect(summary.providerSummary).toBe('Codex: SPARK_SPAWNER_CODEX_OK extra detail');
		expect(summary.providerResults).toEqual([
			expect.objectContaining({
				providerId: 'codex',
				status: 'completed',
				summary: 'SPARK_SPAWNER_CODEX_OK extra detail'
			})
		]);
	});

	it('uses provider errors when no response exists', () => {
		const summary = summarizeProviderResults([
			result({ providerId: 'codex', status: 'failed', error: 'Codex exited 1' })
		]);

		expect(summary.providerSummary).toBe('Codex: Codex exited 1');
		expect(summary.providerResults[0].summary).toBe('Codex exited 1');
	});

	it('redacts local file paths from provider summaries before display', () => {
		const summary = summarizeProviderResults([
			result({
				providerId: 'codex',
				response:
					'Wrote [agent.py](C:/Users/USER/.spark/modules/spark-intelligence-builder/source/src/agent.py) and `/Users/leventcem/.spark/logs/spawner-ui.log`.'
			})
		]);

		expect(summary.providerSummary).toBe('Codex: Wrote agent.py and local file.');
		expect(summary.providerSummary).not.toContain('C:/Users/USER');
		expect(summary.providerSummary).not.toContain('/Users/leventcem');
	});

	it('keeps hosted project metadata from structured provider responses', () => {
		process.env.SPARK_PROJECT_PREVIEW_BASE_URL = 'https://preview.sparkswarm.ai';
		const summary = summarizeProviderResults([
			result({
				providerId: 'codex',
				response: JSON.stringify({
					status: 'completed',
					summary: 'Materialized hosted project files.',
					project_path: 'C:/Users/USER/.spark/workspaces/mission-1'
				})
			})
		]);
		delete process.env.SPARK_PROJECT_PREVIEW_BASE_URL;

		expect(summary.providerResults[0]).toMatchObject({
			summary: 'Materialized hosted project files.',
			projectPath: 'C:/Users/USER/.spark/workspaces/mission-1',
			project_path: 'C:/Users/USER/.spark/workspaces/mission-1'
		});
		expect(summary.providerResults[0].previewUrl).toContain('https://preview.sparkswarm.ai/');
	});

	it('enriches each board entry through the supplied result lookup', () => {
		const enriched = enrichMissionControlBoardWithProviderResults(
			{ completed: [entry('mission-1')], failed: [] },
			(missionId) => (missionId === 'mission-1' ? [result({ response: 'done' })] : [])
		);

		expect(enriched.completed[0].providerSummary).toBe('Codex: done');
		expect(enriched.completed[0].providerResults).toHaveLength(1);
	});

	it('does not show stale running provider summaries on completed board cards', () => {
		const enriched = enrichMissionControlBoardWithProviderResults(
			{ completed: [entry('mission-stale-provider')], failed: [] },
			() => [result({ status: 'running', response: null, completedAt: null })]
		);

		expect(enriched.completed[0].providerResults[0]).toEqual(
			expect.objectContaining({
				status: 'completed',
				summary: 'completed from Mission Control lifecycle events',
				completedAt: '2026-04-25T00:00:01.000Z'
			})
		);
		expect(enriched.completed[0].providerSummary).toBe(
			'Codex: completed from Mission Control lifecycle events'
		);
	});

	it('moves non-terminal board cards to completed when provider results are completed', () => {
		const enriched = enrichMissionControlBoardWithProviderResults(
			{
				created: [
					entry('mission-provider-done', {
						status: 'created',
						lastEventType: 'mission_created',
						tasks: [{ title: 'Build the thing', skills: [], status: 'queued' }],
						taskStatusCounts: {
							queued: 1,
							running: 0,
							completed: 0,
							failed: 0,
							cancelled: 0,
							total: 1
						}
					})
				],
				completed: [],
				failed: [],
				running: [],
				paused: []
			},
			() => [result({ status: 'completed', response: 'done' })]
		);

		expect(enriched.created).toEqual([]);
		expect(enriched.completed[0]).toMatchObject({
			missionId: 'mission-provider-done',
			status: 'completed',
			lastEventType: 'provider_completed',
			taskStatusCounts: { completed: 1, total: 1 },
			providerSummary: 'Codex: done'
		});
	});

	it('keeps paused board cards paused even when the underlying provider process was cancelled', () => {
		const enriched = enrichMissionControlBoardWithProviderResults(
			{
				paused: [
					entry('mission-paused-provider-cancelled', {
						status: 'paused',
						lastEventType: 'mission_paused',
						tasks: [{ title: 'Build the thing', skills: [], status: 'running', progress: 72 }],
						taskStatusCounts: {
							queued: 0,
							running: 1,
							completed: 0,
							failed: 0,
							cancelled: 0,
							total: 1
						}
					})
				],
				completed: [],
				failed: [],
				running: [],
				created: [],
				cancelled: []
			},
			() => [result({ status: 'cancelled', error: 'Mission paused' })]
		);

		expect(enriched.paused[0]).toMatchObject({
			missionId: 'mission-paused-provider-cancelled',
			status: 'paused',
			lastEventType: 'mission_paused',
			providerSummary: 'Codex: paused; ready to resume'
		});
		expect(enriched.cancelled).toEqual([]);
	});

	it('moves paused board cards back to running when the provider resumes', () => {
		const enriched = enrichMissionControlBoardWithProviderResults(
			{
				paused: [
					entry('mission-paused-provider-running', {
						status: 'paused',
						lastEventType: 'mission_paused',
						tasks: [{ title: 'Build the thing', skills: [], status: 'running', progress: 72 }],
						taskStatusCounts: {
							queued: 0,
							running: 1,
							completed: 0,
							failed: 0,
							cancelled: 0,
							total: 1
						}
					})
				],
				completed: [],
				failed: [],
				running: [],
				created: [],
				cancelled: []
			},
			() => [result({ status: 'running', response: null, error: null, completedAt: null })]
		);

		expect(enriched.paused).toEqual([]);
		expect(enriched.running[0]).toMatchObject({
			missionId: 'mission-paused-provider-running',
			status: 'running',
			lastEventType: 'provider_running',
			providerSummary: 'Codex: running'
		});
	});
});
