import { describe, expect, it } from 'vitest';
import { getCanvasExecutionAction } from './canvas-execution-action';

describe('canvas execution action', () => {
	it('opens regular canvases in run mode', () => {
		expect(
			getCanvasExecutionAction({
				nodeCount: 3,
				activePipelineId: 'pipeline-1',
				now: 123
			})
		).toEqual({
			disabled: false,
			label: 'Run',
			title: 'Open workflow execution',
			panelKey: 'manual:pipeline-1',
			autoRunToken: null
		});
	});

	it('opens mission-scoped canvases in inspect mode instead of a fresh manual run key', () => {
		expect(
			getCanvasExecutionAction({
				nodeCount: 4,
				activePipelineId: 'prd-tg-build-1',
				relay: { missionId: 'mission-123' },
				now: 123
			})
		).toEqual({
			disabled: false,
			label: 'Inspect',
			title: 'Open mission execution history',
			panelKey: 'prd-tg-build-1:mission-123:history',
			autoRunToken: null
		});
	});

	it('keeps empty canvases disabled for both run and inspect modes', () => {
		expect(getCanvasExecutionAction({ nodeCount: 0, now: 123 })).toMatchObject({
			disabled: true,
			label: 'Run'
		});
		expect(
			getCanvasExecutionAction({
				nodeCount: 0,
				relay: { missionId: 'mission-empty' },
				now: 123
			})
		).toMatchObject({
			disabled: true,
			label: 'Inspect'
		});
	});

	it('treats blank relay mission IDs as regular manual canvas runs', () => {
		expect(
			getCanvasExecutionAction({
				nodeCount: 2,
				activePipelineId: null,
				relay: { missionId: '   ' },
				now: 456
			})
		).toEqual({
			disabled: false,
			label: 'Run',
			title: 'Open workflow execution',
			panelKey: 'manual:456',
			autoRunToken: null
		});
	});
});
