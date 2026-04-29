import { describe, expect, it } from 'vitest';
import {
	canvasLoadToMissionGraph,
	inferProjectPathFromPrdLoad,
	shouldAutoDispatchPrdLoad,
	type PrdCanvasLoadForAutoDispatch
} from './prd-auto-dispatch';

const load: PrdCanvasLoadForAutoDispatch = {
	requestId: 'tg-build-1',
	missionId: 'mission-1',
	pipelineId: 'prd-tg-build-1',
	pipelineName: 'Spark Test',
	autoRun: true,
	executionPrompt: 'Build this at C:\\Users\\USER\\Desktop\\spark-test as a standalone project.',
	nodes: [
		{
			skill: {
				id: 'task-task-1',
				name: 'task-1: Create shell',
				description: 'Create C:\\Users\\USER\\Desktop\\spark-test\\index.html',
				category: 'development',
				tier: 'free',
				tags: ['frontend-engineer'],
				triggers: []
			},
			position: { x: 160, y: 140 }
		},
		{
			skill: {
				id: 'task-task-2',
				name: 'task-2: Verify shell',
				description: 'Run smoke checks.',
				category: 'development',
				tier: 'free',
				tags: ['test-architect'],
				triggers: []
			},
			position: { x: 480, y: 140 }
		}
	],
	connections: [{ sourceIndex: 0, targetIndex: 1 }]
};

describe('PRD auto-dispatch helpers', () => {
	it('converts PRD bridge node indexes into executable canvas node and connection ids', () => {
		const graph = canvasLoadToMissionGraph(load);

		expect(graph.nodes).toHaveLength(2);
		expect(graph.nodes[0]).toMatchObject({
			id: 'node-1-task-task-1',
			skillId: 'task-task-1',
			status: 'queued'
		});
		expect(graph.connections).toEqual([
			{
				id: 'conn-1-node-1-task-task-1-to-node-2-task-task-2',
				sourceNodeId: 'node-1-task-task-1',
				sourcePortId: 'output',
				targetNodeId: 'node-2-task-task-2',
				targetPortId: 'input'
			}
		]);
	});

	it('extracts the standalone target folder from PRD execution text', () => {
		expect(inferProjectPathFromPrdLoad(load)).toBe('C:\\Users\\USER\\Desktop\\spark-test');
	});

	it('stops Windows target folders before prose after a colon', () => {
		expect(
			inferProjectPathFromPrdLoad({
				...load,
				executionPrompt:
					'Build this at C:\\Users\\USER\\Desktop\\spark-progress-pause-probe: a vanilla-JS static app called Spark Progress Pause Probe.'
			})
		).toBe('C:\\Users\\USER\\Desktop\\spark-progress-pause-probe');
	});

	it('allows auto-dispatch only when the PRD load is runnable', () => {
		expect(shouldAutoDispatchPrdLoad(load).ok).toBe(true);
		expect(shouldAutoDispatchPrdLoad({ ...load, autoRun: false, relay: {} }).reason).toBe('autoRun disabled');
		expect(shouldAutoDispatchPrdLoad({ ...load, nodes: [] }).reason).toBe('no canvas nodes');
	});
});
