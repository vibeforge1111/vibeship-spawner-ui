import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildClientGovernorDecisionAuthority,
	buildClientTurnIntentVNextAuthority
} from './harness-authority-client';

describe('harness authority client', () => {
	afterEach(() => {
		vi.doUnmock('$app/environment');
		vi.unstubAllGlobals();
	});

	it('builds native TurnIntentEnvelopeVNext authority for Spawner UI actions', () => {
		const authority = buildClientTurnIntentVNextAuthority({
			source: 'mission-board.schedule.create',
			reason: 'User submitted a scheduled Spark action from Spawner.',
			toolName: 'spawner.schedule.create',
			mutationClass: 'creates_schedule',
			turnId: 'turn:spawner-client-edge',
			target: 'mission'
		});

		expect(authority.schema_version).toBe('turn-intent-envelope-vnext');
		expect(authority.turn_id).toBe('turn:spawner-client-edge');
		expect(authority.surface).toBe('spawner');
		expect(authority.selected_move).toBe('execute_action');
		expect(authority.action_authority).toMatchObject({
			state: 'executable',
			requires_human_confirmation: false
		});
		expect(authority.freshness).toMatchObject({
			fresh_user_intent_present: true,
			fresh_user_intent_ref: expect.objectContaining({
				kind: 'fresh_user_intent'
			}),
			stale_state_used_as_authority: false,
			memory_used_as_instruction: false,
			pending_state_used_as_authority: false
		});
		expect(authority.evidence).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: authority.freshness.fresh_user_intent_ref?.id,
					kind: authority.freshness.fresh_user_intent_ref?.kind,
					source: authority.freshness.fresh_user_intent_ref?.source
				})
			])
		);
		expect(authority.proposed_actions[0]).toMatchObject({
			capability_id: 'capability:spawner-ui:spawner.schedule.create',
			action_type: 'schedule',
			requires_confirmation: false
		});
	});

	it('builds native GovernorDecisionV1 authority for Spawner UI actions', () => {
		const authority = buildClientGovernorDecisionAuthority({
			source: 'execution-panel.dispatch',
			reason: 'User started provider dispatch from Spawner.',
			toolName: 'spawner.dispatch',
			mutationClass: 'launches_mission',
			turnId: 'turn:spawner-client-governor',
			target: 'mission-dispatch-governor'
		});

		expect(authority.schema_version).toBe('governor-decision-v1');
		expect(authority.outcome).toBe('execute');
		expect(authority.execution_boundary).toMatchObject({
			action_authorized: true,
			legacy_authority_demoted: true,
			authorized_action_count: 1
		});
		expect(authority.envelope).toMatchObject({
			schema_version: 'turn-intent-envelope-vnext',
			turn_id: 'turn:spawner-client-governor',
			selected_move: 'execute_action',
			surface: 'spawner'
		});
		expect(authority.turn_id).toBe('turn:spawner-client-governor');
		expect(authority.authorizations[0].turn_id).toBe('turn:spawner-client-governor');
		expect(authority.tool_ledgers[0].turn_id).toBe('turn:spawner-client-governor');
		expect(authority.authorizations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					schema_version: 'authorization-decision-v1',
					capability_id: 'capability:spawner-ui:spawner.dispatch',
					verdict: 'allow'
				})
			])
		);
		expect(authority.tool_ledgers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					schema_version: 'tool-call-ledger-v1',
					tool_name: 'spawner.dispatch'
				})
			])
		);
	});

	it('blocks browser-side GovernorDecisionV1 minting', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: true }));
		const { buildClientGovernorDecisionAuthority: buildBrowserGovernorDecisionAuthority } = await import('./harness-authority-client');

		expect(() =>
			buildBrowserGovernorDecisionAuthority({
				source: 'mission-board.schedule.create',
				reason: 'Browser-side authority minting regression.',
				toolName: 'spawner.schedule.create',
				mutationClass: 'creates_schedule',
				target: 'mission'
			})
		).toThrow('Browser clients must not mint GovernorDecisionV1 authority');
	});
});
