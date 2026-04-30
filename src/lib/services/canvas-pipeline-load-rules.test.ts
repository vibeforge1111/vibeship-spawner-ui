import { describe, expect, it } from 'vitest';
import type { PendingPipelineLoad } from './pipeline-loader';
import {
	getCanvasNodeSignature,
	getPipelineLoadKey,
	readablePipelineNameFromId,
	shouldAutoApplyLatestLoad
} from './canvas-pipeline-load-rules';
import type { Skill } from '$lib/stores/skills.svelte';

function skill(id: string, name: string): Skill {
	return {
		id,
		name,
		description: '',
		category: 'development',
		tier: 'free',
		tags: [],
		triggers: []
	};
}

function load(overrides: Partial<PendingPipelineLoad> = {}): PendingPipelineLoad {
	return {
		pipelineId: 'prd-tg-build-831-1777442000000',
		pipelineName: 'Spark Route Probe',
		nodes: [
			{ skill: skill('task-1', 'Plan the route'), position: { x: 0, y: 0 } },
			{ skill: skill('task-2', 'Verify the route'), position: { x: 200, y: 0 } }
		],
		connections: [],
		source: 'prd-bridge',
		autoRun: true,
		timestamp: '2026-04-29T00:00:00.000Z',
		...overrides
	};
}

describe('canvas pipeline load rules', () => {
	it('builds stable load keys and node signatures', () => {
		const candidate = load();
		expect(getPipelineLoadKey(candidate)).toBe('prd-tg-build-831-1777442000000:2026-04-29T00:00:00.000Z');
		expect(getCanvasNodeSignature(candidate.nodes)).toBe('task-1:Plan the route|task-2:Verify the route');
	});

	it('turns PRD pipeline IDs into readable fallback names', () => {
		expect(readablePipelineNameFromId('prd-tg-build-8319079055-1763-spark-route-probe-1777380423509')).toBe(
			'spark route probe'
		);
		expect(readablePipelineNameFromId('prd-memory_quality_dashboard')).toBe('memory quality dashboard');
		expect(readablePipelineNameFromId('prd-1777442000000')).toBe('1777442000000');
	});

	it('applies a fresh PRD bridge auto-run load when the active canvas differs', () => {
		const candidate = load();
		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				activePipelineId: 'old-pipeline',
				currentNodes: []
			})
		).toBe(true);

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				activePipelineId: candidate.pipelineId,
				currentNodes: [{ skill: { id: 'different', name: 'Different' } }]
			})
		).toBe(true);
	});

	it('applies a fresh creator mission load for mission-scoped Canvas recovery', () => {
		const candidate = load({
			pipelineId: 'creator-tg-creator-1',
			source: 'creator-mission',
			autoRun: true
		});

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				activePipelineId: 'old-pipeline',
				currentNodes: []
			})
		).toBe(true);
	});

	it('recovers a requested creator mission Canvas even when auto-run is disabled', () => {
		const candidate = load({
			pipelineId: 'creator-tg-creator-1',
			source: 'creator-mission',
			autoRun: false,
			relay: { autoRun: false }
		});

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				requestedPipelineId: 'creator-tg-creator-1',
				activePipelineId: 'old-pipeline',
				currentNodes: []
			})
		).toBe(true);

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				activePipelineId: 'old-pipeline',
				currentNodes: []
			})
		).toBe(false);
	});

	it('does not reapply a duplicate or already-applied load', () => {
		const candidate = load();
		const loadKey = getPipelineLoadKey(candidate);
		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				lastAppliedLatestLoadKey: loadKey,
				activePipelineId: 'old-pipeline',
				currentNodes: []
			})
		).toBe(false);

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				appliedPipelineLoadKey: loadKey,
				activePipelineId: candidate.pipelineId,
				currentNodes: []
			})
		).toBe(false);
	});

	it('rejects loads that are not safe auto-run PRD bridge candidates', () => {
		expect(
			shouldAutoApplyLatestLoad({
				load: load({ source: 'goal' }),
				currentNodes: []
			})
		).toBe(false);
		expect(
			shouldAutoApplyLatestLoad({
				load: load({ autoRun: false, relay: { autoRun: false } }),
				currentNodes: []
			})
		).toBe(false);
		expect(
			shouldAutoApplyLatestLoad({
				load: load({ nodes: [] }),
				currentNodes: []
			})
		).toBe(false);
		expect(
			shouldAutoApplyLatestLoad({
				load: load(),
				disposed: true,
				currentNodes: []
			})
		).toBe(false);
	});

	it('honors requested pipeline filters and skips unchanged active canvases', () => {
		const candidate = load();
		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				requestedPipelineId: 'different-pipeline',
				currentNodes: []
			})
		).toBe(false);

		expect(
			shouldAutoApplyLatestLoad({
				load: candidate,
				requestedPipelineId: candidate.pipelineId,
				activePipelineId: candidate.pipelineId,
				currentNodes: candidate.nodes
			})
		).toBe(false);
	});
});
