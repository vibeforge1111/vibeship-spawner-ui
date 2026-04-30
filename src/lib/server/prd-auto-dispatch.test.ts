import { describe, expect, it } from 'vitest';
import {
	buildAutoDispatchTaskSkillMap,
	canvasLoadToMissionGraph,
	inferProjectPathFromPrdLoad,
	shouldAutoDispatchPrdLoad,
	type PrdCanvasLoadForAutoDispatch
} from './prd-auto-dispatch';
import { getTierSkills } from './skill-tiers';

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

	it('enriches PRD auto-dispatch tasks with tier-allowed H70 skills', async () => {
		const skillMap = await buildAutoDispatchTaskSkillMap(load, [
			{
				id: 'task-1',
				title: 'Create shell',
				description: 'Create C:\\Users\\USER\\Desktop\\spark-test\\index.html'
			},
			{
				id: 'task-2',
				title: 'Verify shell',
				description: 'Run smoke checks.'
			}
		]);

		expect(skillMap.get('task-1')).toContain('frontend-engineer');
		expect(skillMap.get('task-1')).not.toContain('task-task-1');
		expect(skillMap.get('task-2')).toContain('test-architect');
	});

	it('infers pro skills for sparse Telegram PRD nodes', async () => {
		const skillMap = await buildAutoDispatchTaskSkillMap(
			{
				...load,
				tier: 'pro',
				nodes: [
					{
						skill: {
							id: 'task-task-1',
							name: 'task-1: Build Three.js sprite canvas',
							description: 'Implement a responsive WebGL game-dev editor with particles.',
							tags: []
						}
					}
				],
				connections: []
			},
			[
				{
					id: 'task-1',
					title: 'Build Three.js sprite canvas',
					description: 'Implement a responsive WebGL game-dev editor with particles.'
				}
			]
		);

		expect(skillMap.get('task-1')).toContain('threejs-3d-graphics');
	});

	it('limits free-tier PRD auto-dispatch skills to the base allowlist', async () => {
		const baseIds = new Set((await getTierSkills('base')).map((skill) => skill.id));
		const skillMap = await buildAutoDispatchTaskSkillMap(
			{
				...load,
				tier: 'free',
				nodes: [
					{
						skill: {
							id: 'task-task-1',
							name: 'task-1: Build frontend dashboard',
							description: 'Implement responsive UI, analytics charts, and accessibility checks.',
							tags: ['frontend-engineer']
						}
					}
				],
				connections: []
			},
			[
				{
					id: 'task-1',
					title: 'Build frontend dashboard',
					description: 'Implement responsive UI, analytics charts, and accessibility checks.'
				}
			]
		);

		const skills = skillMap.get('task-1') || [];
		expect(skills.length).toBeGreaterThan(0);
		expect(skills.length).toBeLessThanOrEqual(3);
		for (const skillId of skills) {
			expect(baseIds.has(skillId)).toBe(true);
		}
	});
});
