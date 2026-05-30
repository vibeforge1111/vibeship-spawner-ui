import { describe, expect, it } from 'vitest';
import { normalizeStartupSelfImprovementDashboard } from './startup-self-improvement';

describe('startup self-improvement dashboard', () => {
	it('projects blocked bound dossiers as read-only without claiming improvement', () => {
		const dashboard = normalizeStartupSelfImprovementDashboard(
			{
				schemaVersion: 'spark-startup-bench-proof-adapter.v1',
				generatedAt: '2026-05-30T10:08:27.000Z',
				status: 'runner_proof_ready',
				scoreClaimAllowed: false,
				improvementClaimAllowed: false,
				privateScoreSummary: {
					baseline: { scenarioScore: 0.6408 },
					candidate: { scenarioScore: 0.8657 },
					comparison: {
						metric: 'scenario_score',
						candidateMinusBaseline: 0.2249,
						candidateBeatsBaseline: true
					}
				},
				proofGates: {
					hiddenHeldout: { status: 'passed', pass: true },
					wrapperRaw: { status: 'passed', pass: true },
					sidecarReview: { status: 'pending', pass: false, blockers: ['sidecar_review_pending'] },
					scoreReconciliation: { status: 'blocked', pass: false, blockers: ['score_reconciliation_missing'] }
				},
				repeatedStability: { status: 'single_seed_only', pass: false, blockers: ['repeated_stability_missing'] },
				wallClockStability: { status: 'waiting', pass: false, blockers: ['wall_clock_stability_window_missing'] },
				promotionDossier: {
					status: 'blocked',
					scoreClaimAllowed: false,
					improvementClaimAllowed: false,
					public_ready: false,
					network_absorbable: false,
					blockers: ['sidecar_review_pending', 'wall_clock_stability_window_missing', 'score_reconciliation_missing'],
					nextGate: 'clear_startup_bench_proof_blockers'
				},
				proofGateBundle: {
					bundleId: 'startup-bench-proof-unit',
					manifestPath: '/tmp/startup_bench_proof_gates.json',
					gateBundleSha256: '5'.repeat(64),
					status: 'blocked'
				}
			},
			'/tmp/startup_bench_proof_report.bound.json'
		);

		expect(dashboard.readOnly).toBe(true);
		expect(dashboard.actions.canDispatch).toBe(false);
		expect(dashboard.actions.canMutate).toBe(false);
		expect(dashboard.actions.canStartRun).toBe(false);
		expect(dashboard.score.baseline).toBe(0.6408);
		expect(dashboard.score.candidate).toBe(0.8657);
		expect(dashboard.score.delta).toBe(0.2249);
		expect(dashboard.scoreClaimAllowed).toBe(false);
		expect(dashboard.improvementClaimAllowed).toBe(false);
		expect(dashboard.publication.publicReady).toBe(false);
		expect(dashboard.publication.networkAbsorbable).toBe(false);
		expect(dashboard.claimBoundary).toContain('improvementClaimAllowed=false');
		expect(dashboard.blockers).toContain('sidecar review');
		expect(dashboard.blockers).toContain('wall-clock stability');
		expect(dashboard.blockers).toContain('score reconciliation');
		expect(dashboard.gates.find((gate) => gate.id === 'hidden-heldout')?.status).toBe('passed');
		expect(dashboard.gates.find((gate) => gate.id === 'sidecar-review')?.status).toBe('pending');
		expect(dashboard.gates.find((gate) => gate.id === 'repeated-stability')?.status).toBe('blocked');
		expect(JSON.stringify(dashboard)).not.toMatch(/Spark improved|improvement claim allowed/i);
	});
});
