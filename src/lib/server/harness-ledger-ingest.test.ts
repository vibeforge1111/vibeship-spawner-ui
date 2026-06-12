import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	SPARK_SPAWNER_CANONICAL_LEDGER: '0',
	SPARK_SPAWNER_CANONICAL_LEDGER_STRICT: '',
	SPARK_GOVERNOR_HMAC_KEY: '',
	SPARK_GOVERNOR_HMAC_KEY_ID: ''
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { verifyHarnessCoreGovernorToolAuthority } from '@spark/harness-core';
import { buildServerGovernorDecisionAuthority } from './harness-authority';
import { buildSpawnerToolLedgerRow, emitSpawnerToolLedger } from './harness-ledger-ingest';

function verifiedDecision() {
	const governorDecision = buildServerGovernorDecisionAuthority({
		source: 'test.spawner.dispatch',
		reason: 'User explicitly requested a Spawner dispatch.',
		toolName: 'spawner.dispatch',
		mutationClass: 'launches_mission',
		requestId: 'request-ledger-ingest-test',
		target: 'mission'
	});
	const verification = verifyHarnessCoreGovernorToolAuthority({
		governor_decision: governorDecision,
		tool_name: 'spawner.dispatch',
		owner_system: 'spawner-ui',
		action_type: 'launch_mission'
	});
	expect(verification.allowed).toBe(true);
	return { governorDecision, verification };
}

describe('spawner harness ledger ingest', () => {
	afterEach(() => {
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER = '0';
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER_STRICT = '';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY = '';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY_ID = '';
	});

	it('builds the canonical bound ledger row expected by Builder ingest', () => {
		const { governorDecision, verification } = verifiedDecision();

		const row = buildSpawnerToolLedgerRow({
			governorDecision,
			verification,
			ownerSystem: 'spawner-ui',
			mutationClass: 'launches_mission',
			requestId: 'request-ledger-ingest-test',
			traceRef: 'trace:spawner-unit'
		});

		expect(row).toMatchObject({
			turn_id: governorDecision.turn_id,
			action_id: verification.action_id,
			capability_id: verification.capability_id,
			authorization_decision_id: verification.authorization_decision_id,
			ledger_id: verification.ledger_id,
			tool_name: 'spawner.dispatch',
			owner_system: 'spawner-ui',
			mutation_class: 'launches_mission',
			surface: 'spawner',
			request_id: 'request-ledger-ingest-test',
			trace_ref: 'trace:spawner-unit',
			ledger_json: governorDecision.tool_ledgers[0]
		});
	});

	it('keeps execution side-effect free when canonical ingest is disabled', () => {
		const { governorDecision, verification } = verifiedDecision();

		const result = emitSpawnerToolLedger({
			governorDecision,
			verification,
			ownerSystem: 'spawner-ui',
			mutationClass: 'launches_mission',
			requestId: 'request-ledger-ingest-test',
			traceRef: 'trace:spawner-unit'
		});

		expect(result).toMatchObject({
			attempted: false,
			persisted: false,
			strict: false,
			skippedReason: 'canonical_ledger_disabled'
		});
		expect(result.row?.surface).toBe('spawner');
	});
});
