import { describe, expect, it } from 'vitest';
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
		requestId: 'governor-ledger-binding-test',
		target: 'mission'
	});
}

describe('server harness authority', () => {
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
});
