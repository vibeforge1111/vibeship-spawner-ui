import { describe, expect, it } from 'vitest';
import {
	buildClientGovernorDecisionAuthority,
	buildClientTurnIntentVNextAuthority
} from './harness-authority-client';

describe('harness authority client', () => {
	it('builds native TurnIntentEnvelopeVNext authority for Spawner UI actions', () => {
		const authority = buildClientTurnIntentVNextAuthority({
			source: 'mission-board.schedule.create',
			reason: 'User submitted a scheduled Spark action from Spawner.',
			toolName: 'spawner.schedule.create',
			mutationClass: 'creates_schedule',
			target: 'mission'
		});

		expect(authority.schema_version).toBe('turn-intent-envelope-vnext');
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
			selected_move: 'execute_action',
			surface: 'spawner'
		});
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
});
