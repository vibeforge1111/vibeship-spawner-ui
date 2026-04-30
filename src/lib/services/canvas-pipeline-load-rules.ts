import type { PendingPipelineLoad } from './pipeline-loader';

type NodeLike = {
	skill?: {
		id?: string;
		name?: string;
	};
};

export interface AutoApplyLatestLoadInput {
	load: PendingPipelineLoad;
	disposed?: boolean;
	requestedPipelineId?: string | null;
	lastAppliedLatestLoadKey?: string | null;
	appliedPipelineLoadKey?: string | null;
	activePipelineId?: string | null;
	currentNodes: NodeLike[];
}

export function getPipelineLoadKey(load: PendingPipelineLoad): string {
	return `${load.pipelineId}:${load.timestamp || ''}`;
}

export function getPipelineLoadNodeSignature(load: PendingPipelineLoad): string {
	return getCanvasNodeSignature(load.nodes);
}

export function getCanvasNodeSignature(nodes: NodeLike[]): string {
	return nodes
		.map((node) => `${node.skill?.id || ''}:${node.skill?.name || ''}`)
		.join('|');
}

export function readablePipelineNameFromId(pipelineId: string): string {
	return (
		pipelineId
			.replace(/^prd-/, '')
			.replace(/^tg-build-[^-]+-\d+-/, '')
			.replace(/-\d{10,}$/, '')
			.replace(/[_-]+/g, ' ')
			.trim() || pipelineId
	);
}

export function shouldAutoApplyLatestLoad(input: AutoApplyLatestLoadInput): boolean {
	const {
		load,
		disposed = false,
		requestedPipelineId = null,
		lastAppliedLatestLoadKey = null,
		appliedPipelineLoadKey = null,
		activePipelineId = null,
		currentNodes
	} = input;

	if (disposed) return false;
	if (load.source !== 'prd-bridge' && load.source !== 'creator-mission') return false;
	if (!(load.autoRun || load.relay?.autoRun)) return false;
	if (!load.nodes?.length) return false;
	if (requestedPipelineId && load.pipelineId !== requestedPipelineId) return false;

	const loadKey = getPipelineLoadKey(load);
	if (loadKey === lastAppliedLatestLoadKey) return false;
	if (loadKey === appliedPipelineLoadKey) return false;

	if (activePipelineId !== load.pipelineId) return true;
	if (currentNodes.length === 0) return true;
	if (currentNodes.length !== load.nodes.length) return true;

	return getCanvasNodeSignature(currentNodes) !== getPipelineLoadNodeSignature(load);
}
