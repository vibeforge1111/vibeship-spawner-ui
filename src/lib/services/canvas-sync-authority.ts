export const READ_ONLY_CANVAS_SYNC_EVENTS = new Set([
	'canvas_get_state',
	'canvas_get_skill',
	'canvas_validate',
	'canvas_export_prompt'
]);

export const MUTATING_CANVAS_SYNC_EVENTS = new Set([
	'canvas_add_skill',
	'canvas_add_skills',
	'canvas_remove_node',
	'canvas_clear',
	'canvas_connect',
	'canvas_update_position',
	'canvas_execute',
	'canvas_load_template'
]);

export function canvasSyncEventIsReadOnly(eventType: string): boolean {
	return READ_ONLY_CANVAS_SYNC_EVENTS.has(eventType);
}

export function canvasSyncEventRequiresAuthority(eventType: string): boolean {
	return MUTATING_CANVAS_SYNC_EVENTS.has(eventType);
}

export function canvasSyncMutationReason(eventType: string): string {
	if (eventType === 'canvas_execute') {
		return 'CanvasSync workflow execution is disabled; use the governed mission execution path.';
	}
	if (eventType === 'canvas_load_template') {
		return 'CanvasSync template loading mutates canvas state and requires governed authority.';
	}
	return 'CanvasSync mutations are disabled; use Harness Core governed routes for canvas changes.';
}
