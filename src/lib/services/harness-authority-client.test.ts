import { describe, expect, it } from 'vitest';
import { buildClientTurnIntentVNextAuthority } from './harness-authority-client';

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
		expect(authority.freshness).toEqual({
			fresh_user_intent_present: true,
			stale_state_used_as_authority: false,
			memory_used_as_instruction: false,
			pending_state_used_as_authority: false
		});
		expect(authority.proposed_actions[0]).toMatchObject({
			capability_id: 'capability:spawner-ui:spawner.schedule.create',
			action_type: 'schedule',
			requires_confirmation: false
		});
	});
});
