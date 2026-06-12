import { describe, expect, it } from 'vitest';
import {
	assertWatchdogPayloadRedacted,
	collectWatchdogPrivacyFindings,
	createWatchdogProbeBoard,
	deriveWatchdogStatus,
	watchdogProbeBoardFixtures,
	watchdogProbeBoardSchema
} from './harness-watchdog';

describe('harness watchdog probe board contract', () => {
	it('defines the complete redacted board shape', () => {
		const board = watchdogProbeBoardSchema.parse(watchdogProbeBoardFixtures.healthy);

		expect(board.schemaVersion).toBe('spark.spawner.watchdog_probe_board.v1');
		expect(board.source).toBe('spawner-ui');
		expect(board.requestId).toBe('tg-build-02c441099b20-1780867252235');
		expect(board.missionId).toBe('mission-1780867252235');
		expect(board.traceRef).toBe('trace:spawner-prd:mission-1780867252235');
		expect(board.runtimeHealth.length).toBeGreaterThan(0);
		expect(board.authorityGates.length).toBeGreaterThan(0);
		expect(board.telegramProof.length).toBeGreaterThan(0);
		expect(board.registryDrift.length).toBeGreaterThan(0);
		expect(Array.isArray(board.rollbackNotes)).toBe(true);
		expect(Array.isArray(board.openBlockers)).toBe(true);
		expect(board.evidenceRefs.length).toBeGreaterThan(0);
		expect(board.privacy.omits).toEqual(
			expect.arrayContaining(['raw prompts', 'secrets', 'chat IDs', 'user IDs', 'provider output bodies'])
		);
	});

	it('keeps fixtures for healthy, degraded, and blocked downstream tests', () => {
		expect(watchdogProbeBoardFixtures.healthy.status).toBe('healthy');
		expect(watchdogProbeBoardFixtures.degraded.status).toBe('degraded');
		expect(watchdogProbeBoardFixtures.blocked.status).toBe('blocked');

		for (const fixture of Object.values(watchdogProbeBoardFixtures)) {
			expect(() => watchdogProbeBoardSchema.parse(fixture)).not.toThrow();
			expect(() => assertWatchdogPayloadRedacted(fixture)).not.toThrow();
		}
	});

	it('derives overall status from row severities and open blockers', () => {
		expect(deriveWatchdogStatus({ rows: [{ severity: 'healthy' }], blockers: [] })).toBe('healthy');
		expect(deriveWatchdogStatus({ rows: [{ severity: 'degraded' }], blockers: [] })).toBe('degraded');
		expect(deriveWatchdogStatus({ rows: [{ severity: 'stale' }], blockers: [] })).toBe('stale');
		expect(deriveWatchdogStatus({ rows: [{ severity: 'healthy' }], blockers: [{ status: 'blocked' }] })).toBe('blocked');
	});

	it('rejects raw private identifiers and provider body keys', () => {
		const findings = collectWatchdogPrivacyFindings({
			requestId: 'safe-request',
			relay: {
				chatId: '1234567890'
			},
			providerOutput: 'raw model response body'
		});

		expect(findings).toEqual(
			expect.arrayContaining(['sensitive key relay.chatId', 'sensitive key providerOutput'])
		);
	});

	it('creates a valid board while deriving status when omitted', () => {
		const board = createWatchdogProbeBoard({
			requestId: 'tg-build-safe-1780867252235',
			missionId: 'mission-1780867252235',
			traceRef: null,
			checkedAt: '2026-06-07T21:31:00.000Z',
			status: 'healthy',
			runtimeHealth: [
				{
					id: 'runtime.trace',
					label: 'Trace availability',
					status: 'degraded',
					severity: 'degraded',
					source: 'mission-control',
					checkedAt: '2026-06-07T21:31:00.000Z',
					summary: 'Trace ref is not available yet.',
					evidenceRef: 'trace-missing'
				}
			],
			authorityGates: [],
			telegramProof: [],
			registryDrift: [],
			rollbackNotes: [],
			openBlockers: [],
			evidenceRefs: [
				{
					id: 'trace-missing',
					source: 'mission-control',
					label: 'missing trace ref',
					kind: 'state_ref',
					redaction: 'not_available'
				}
			]
		});

		expect(board.status).toBe('degraded');
	});
});
