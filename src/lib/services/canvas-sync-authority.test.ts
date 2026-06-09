import { describe, expect, it } from 'vitest';
import {
	canvasSyncEventIsReadOnly,
	canvasSyncEventRequiresAuthority,
	canvasSyncMutationReason
} from './canvas-sync-authority';

describe('canvas-sync-authority', () => {
	it('allows only read-only canvas sync events without authority', () => {
		expect(canvasSyncEventIsReadOnly('canvas_get_state')).toBe(true);
		expect(canvasSyncEventIsReadOnly('canvas_validate')).toBe(true);
		expect(canvasSyncEventIsReadOnly('canvas_get_skill')).toBe(true);
		expect(canvasSyncEventIsReadOnly('canvas_export_prompt')).toBe(true);

		expect(canvasSyncEventIsReadOnly('canvas_execute')).toBe(false);
		expect(canvasSyncEventIsReadOnly('canvas_add_skill')).toBe(false);
	});

	it('marks legacy mutating canvas sync events as authority-requiring', () => {
		for (const eventType of [
			'canvas_add_skill',
			'canvas_add_skills',
			'canvas_remove_node',
			'canvas_clear',
			'canvas_connect',
			'canvas_update_position',
			'canvas_execute',
			'canvas_load_template'
		]) {
			expect(canvasSyncEventRequiresAuthority(eventType)).toBe(true);
		}
	});

	it('explains why legacy canvas execution is blocked', () => {
		expect(canvasSyncMutationReason('canvas_execute')).toContain('governed mission execution path');
		expect(canvasSyncMutationReason('canvas_clear')).toContain('Harness Core governed routes');
	});
});
