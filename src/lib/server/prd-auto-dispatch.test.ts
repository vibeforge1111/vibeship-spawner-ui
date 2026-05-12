import { describe, expect, it } from 'vitest';
import {
	buildAutoDispatchTaskSkillMap,
	canvasLoadToMissionGraph,
	_providerApiKeysFromEnv,
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

	it('stops Windows target folders before sentence prose after the folder name', () => {
		expect(
			inferProjectPathFromPrdLoad({
				...load,
				executionPrompt:
					'Create a local-only static proof in C:\\Users\\USER\\Desktop\\spark-os-proof-s. You must create exactly two files and no others.'
			})
		).toBe('C:\\Users\\USER\\Desktop\\spark-os-proof-s');
	});

	it('uses a hosted workspace folder when PRD text has no explicit path', () => {
		const projectPath = inferProjectPathFromPrdLoad(
			{
				...load,
				executionPrompt: 'Build a tiny static landing page for a cafe.',
				nodes: [{ skill: { name: 'task-1: Build page', description: 'Create the page.' } }]
			},
			{ SPARK_WORKSPACE_ROOT: '/data/workspaces' }
		);

		expect(projectPath).toMatch(/[\\/]data[\\/]workspaces[\\/]mission-1-spark-test$/);
	});

	it('keeps local auto-dispatch fallback unchanged without a hosted workspace', () => {
		expect(
			inferProjectPathFromPrdLoad(
				{
					...load,
					executionPrompt: 'Build a tiny static landing page for a cafe.',
					nodes: [{ skill: { name: 'task-1: Build page', description: 'Create the page.' } }]
				},
				{}
			)
		).toBe('.');
	});

	it('allows auto-dispatch only when the PRD load is runnable', () => {
		expect(shouldAutoDispatchPrdLoad(load).ok).toBe(true);
		expect(shouldAutoDispatchPrdLoad({ ...load, autoRun: false, relay: {} }).reason).toBe('autoRun disabled');
		expect(shouldAutoDispatchPrdLoad({ ...load, nodes: [] }).reason).toBe('no canvas nodes');
	});

	it('passes configured provider API keys into auto-dispatch runtime', () => {
		expect(_providerApiKeysFromEnv(
			[
				{ id: 'zai', label: 'Z.AI GLM', enabled: true, kind: 'openai_compat', eventSource: 'zai', model: 'glm-5.1', apiKeyEnv: 'ZAI_API_KEY', requiresApiKey: true },
				{ id: 'codex', label: 'Codex', enabled: false, kind: 'terminal_cli', eventSource: 'codex', model: 'gpt-5.5', requiresApiKey: false }
			],
			{ ZAI_API_KEY: 'zai-secret' }
		)).toEqual({ zai: 'zai-secret' });
	});

	it('enriches PRD auto-dispatch tasks with tier-allowed H70 skills', async () => {
		const skillMap = await buildAutoDispatchTaskSkillMap({ ...load, tier: 'pro' }, [
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

	it('keeps the sparse clarification fixture as a small DAG with allowlisted skills', async () => {
		const requestId = 'tg-build-8319079055-2607-1777608553410-clarified-1777608630635';
		const clarificationLoad: PrdCanvasLoadForAutoDispatch = {
			requestId,
			missionId: 'mission-clarification-fixture-test',
			pipelineId: `prd-${requestId}`,
			pipelineName: 'did you understand what i said',
			tier: 'pro',
			autoRun: true,
			buildMode: 'direct',
			executionPrompt:
				'Original user request: did you understand what i said\n\nAcknowledge understanding and ask for missing audience, core workflow, saved memory, and vibe details.',
			nodes: [
				{
					skill: {
						id: 'task-1-acknowledge-understanding',
						name: 'Acknowledge the understanding check',
						description: 'Confirm Spark understood the user is asking whether the previous message was understood.',
						tags: ['conversation-memory', 'ux-design']
					}
				},
				{
					skill: {
						id: 'task-2-ask-for-actionable-details',
						name: 'Ask for the missing build details',
						description: 'Prompt for audience, core workflow, saved memory, and vibe details.',
						tags: ['product-discovery', 'structured-output']
					}
				}
			],
			connections: []
		};
		const proIds = new Set((await getTierSkills('pro')).map((skill) => skill.id));
		const graph = canvasLoadToMissionGraph(clarificationLoad);
		const skillMap = await buildAutoDispatchTaskSkillMap(clarificationLoad, [
			{
				id: 'task-1',
				title: 'Acknowledge the understanding check',
				description: 'Confirm Spark understood the user is asking whether the previous message was understood.'
			},
			{
				id: 'task-2',
				title: 'Ask for the missing build details',
				description: 'Prompt for audience, core workflow, saved memory, and vibe details.'
			}
		]);

		expect(graph.nodes).toHaveLength(2);
		expect(graph.connections).toEqual([]);
		expect(shouldAutoDispatchPrdLoad(clarificationLoad).ok).toBe(true);
		for (const skills of skillMap.values()) {
			expect(skills.length).toBeGreaterThan(0);
			for (const skillId of skills) {
				expect(proIds.has(skillId)).toBe(true);
			}
		}
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

	it('can allow creator execution for missions that already exist on the board', () => {
		expect(
			shouldAutoDispatchPrdLoad(load, { allowExistingNonTerminalMission: true }).ok
		).toBe(true);
	});
});
