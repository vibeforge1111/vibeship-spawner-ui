import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	SPARK_GOVERNOR_HMAC_KEY: '',
	SPARK_GOVERNOR_HMAC_KEY_ID: '',
	SPARK_GOVERNOR_REQUIRE_HMAC: '',
	SPARK_GOVERNOR_HMAC_REQUIRED: '',
	SPARK_SPAWNER_CANONICAL_LEDGER: '0',
	SPARK_SPAWNER_CANONICAL_LEDGER_STRICT: '',
	SPARK_BUILDER_REPO: ''
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import {
	HarnessAuthorityError,
	assertNativeGovernorHarnessAuthority,
	buildServerGovernorDecisionAuthority
} from './harness-authority';

function validGovernorAuthority() {
	return buildServerGovernorDecisionAuthority({
		source: 'test.spawner.dispatch',
		reason: 'User explicitly requested a Spawner dispatch.',
		toolName: 'spawner.dispatch',
		mutationClass: 'launches_mission',
		turnId: 'turn:spawner-server-edge',
		requestId: 'governor-ledger-binding-test',
		target: 'mission'
	});
}

describe('server harness authority', () => {
	afterEach(() => {
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY = '';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY_ID = '';
		PRIVATE_ENV.SPARK_GOVERNOR_REQUIRE_HMAC = '';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_REQUIRED = '';
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER = '0';
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER_STRICT = '';
		PRIVATE_ENV.SPARK_BUILDER_REPO = '';
	});

	it('allows native Governor authority only when the ledger matches the authorization', () => {
		const authority = validGovernorAuthority();

		const verdict = assertNativeGovernorHarnessAuthority({
			authority,
			toolName: 'spawner.dispatch',
			ownerSystem: 'spawner-ui',
			mutationClass: 'launches_mission'
		});

		expect(verdict.allowed).toBe(true);
		expect(verdict.source).toBe('governor_decision');
		expect(authority.turn_id).toBe('turn:spawner-server-edge');
		expect(authority.envelope.turn_id).toBe('turn:spawner-server-edge');
		expect(authority.authorizations[0].turn_id).toBe('turn:spawner-server-edge');
		expect(authority.tool_ledgers[0].turn_id).toBe('turn:spawner-server-edge');
	});

	it('blocks execute authority when the ledger is copied from another action', () => {
		const authority = validGovernorAuthority();
		const mismatchedAuthority = JSON.parse(JSON.stringify(authority));
		mismatchedAuthority.tool_ledgers[0].action_id = 'action:copied-stale-ledger';
		mismatchedAuthority.tool_ledgers[0].authorization.action_id = 'action:copied-stale-ledger';

		expect(() =>
			assertNativeGovernorHarnessAuthority({
				authority: mismatchedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			})
		).toThrow(HarnessAuthorityError);

		try {
			assertNativeGovernorHarnessAuthority({
				authority: mismatchedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			});
		} catch (error) {
			expect(error).toBeInstanceOf(HarnessAuthorityError);
			expect((error as HarnessAuthorityError).verdict.reasonCodes).toContain('governor_missing_matching_tool_ledger');
		}
	});

	it('requires a signed Governor decision when an HMAC key is configured', () => {
		const unsignedAuthority = validGovernorAuthority();
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY = 'test-governor-secret';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY_ID = 'spawner-unit-test';

		expect(() =>
			assertNativeGovernorHarnessAuthority({
				authority: unsignedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			})
		).toThrow(HarnessAuthorityError);

		try {
			assertNativeGovernorHarnessAuthority({
				authority: unsignedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			});
		} catch (error) {
			expect(error).toBeInstanceOf(HarnessAuthorityError);
			expect((error as HarnessAuthorityError).verdict.reasonCodes).toContain('governor_signature_missing');
		}
	});

	it('blocks unsigned Governor decisions when strict HMAC mode is enabled without a key', () => {
		const unsignedAuthority = validGovernorAuthority();
		PRIVATE_ENV.SPARK_GOVERNOR_REQUIRE_HMAC = '1';

		expect(() =>
			assertNativeGovernorHarnessAuthority({
				authority: unsignedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			})
		).toThrow(HarnessAuthorityError);

		try {
			assertNativeGovernorHarnessAuthority({
				authority: unsignedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			});
		} catch (error) {
			expect(error).toBeInstanceOf(HarnessAuthorityError);
			expect((error as HarnessAuthorityError).verdict.reasonCodes).toContain('governor_hmac_key_missing');
		}
	});

	it('signs server-minted Governor decisions when an HMAC key is configured', () => {
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY = 'test-governor-secret';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY_ID = 'spawner-unit-test';
		const authority = validGovernorAuthority();

		expect(authority.signature).toMatchObject({
			schema_version: 'governor-decision-signature-v1',
			alg: 'hmac-sha256',
			key_id: 'spawner-unit-test'
		});
		expect(authority.signature?.nonce).toEqual(expect.any(String));
		expect(authority.signature?.signature).toMatch(/^[0-9a-f]{64}$/);

		const verdict = assertNativeGovernorHarnessAuthority({
			authority,
			toolName: 'spawner.dispatch',
			ownerSystem: 'spawner-ui',
			mutationClass: 'launches_mission'
		});

		expect(verdict.allowed).toBe(true);
	});

	it('rejects tampered signed Governor decisions', () => {
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY = 'test-governor-secret';
		PRIVATE_ENV.SPARK_GOVERNOR_HMAC_KEY_ID = 'spawner-unit-test';
		const authority = validGovernorAuthority();
		const tamperedAuthority = JSON.parse(JSON.stringify(authority));
		tamperedAuthority.tool_ledgers[0].tool_name = 'spawner.copied';

		expect(() =>
			assertNativeGovernorHarnessAuthority({
				authority: tamperedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			})
		).toThrow(HarnessAuthorityError);

		try {
			assertNativeGovernorHarnessAuthority({
				authority: tamperedAuthority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			});
		} catch (error) {
			expect(error).toBeInstanceOf(HarnessAuthorityError);
			expect((error as HarnessAuthorityError).verdict.reasonCodes).toContain('governor_signature_invalid');
		}
	});

	it('can make canonical ledger ingestion a strict Governor gate', () => {
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER = '1';
		PRIVATE_ENV.SPARK_SPAWNER_CANONICAL_LEDGER_STRICT = '1';
		PRIVATE_ENV.SPARK_BUILDER_REPO = 'C:\\missing\\spark-intelligence-builder';
		const authority = validGovernorAuthority();

		expect(() =>
			assertNativeGovernorHarnessAuthority({
				authority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			})
		).toThrow(HarnessAuthorityError);

		try {
			assertNativeGovernorHarnessAuthority({
				authority,
				toolName: 'spawner.dispatch',
				ownerSystem: 'spawner-ui',
				mutationClass: 'launches_mission'
			});
		} catch (error) {
			expect(error).toBeInstanceOf(HarnessAuthorityError);
			expect((error as HarnessAuthorityError).verdict.reasonCodes).toContain('governor_ledger_ingest_failed');
			expect((error as HarnessAuthorityError).verdict.ledgerIngest).toMatchObject({
				attempted: false,
				persisted: false,
				skippedReason: 'builder_repo_missing'
			});
		}
	});
});
