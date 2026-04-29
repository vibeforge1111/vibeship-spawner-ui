export type CanvasExecutionRelay = {
	missionId?: string;
	autoRun?: boolean;
};

export type CanvasExecutionActionInput = {
	nodeCount: number;
	activePipelineId?: string | null;
	relay?: CanvasExecutionRelay | null;
	now?: number;
};

export type CanvasExecutionAction = {
	disabled: boolean;
	label: 'Run' | 'Inspect';
	title: string;
	panelKey: string;
	autoRunToken: number | null;
};

export function getCanvasExecutionAction(input: CanvasExecutionActionInput): CanvasExecutionAction {
	const missionId = input.relay?.missionId?.trim();
	const activePipelineId = input.activePipelineId?.trim() || null;

	if (missionId) {
		return {
			disabled: input.nodeCount === 0,
			label: 'Inspect',
			title: 'Open mission execution history',
			panelKey: `${activePipelineId || 'canvas'}:${missionId}:history`,
			autoRunToken: null
		};
	}

	return {
		disabled: input.nodeCount === 0,
		label: 'Run',
		title: input.nodeCount === 0 ? 'Add nodes before opening execution' : 'Open workflow execution',
		panelKey: `manual:${activePipelineId || input.now || 'canvas'}`,
		autoRunToken: null
	};
}
