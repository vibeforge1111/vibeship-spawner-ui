/**
 * Mission Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { buildMissionFromCanvas, validateForMission } from './mission-builder';
import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

// Helper to create test nodes
function createNode(id: string, skillName: string = 'Test Skill'): CanvasNode {
	return {
		id,
		skillId: `skill-${id}`,
		position: { x: 100, y: 100 },
		skill: {
			id: `skill-${id}`,
			name: skillName,
			description: 'Test description',
			category: 'development',
			tier: 'free',
			tags: [],
			triggers: []
		}
	};
}

function createConnection(sourceId: string, targetId: string): Connection {
	return {
		id: `${sourceId}-${targetId}`,
		sourceNodeId: sourceId,
		targetNodeId: targetId,
		sourcePortId: 'output-0',
		targetPortId: 'input-0'
	};
}

describe('validateForMission', () => {
	it('should fail with no nodes', () => {
		const result = validateForMission([], []);
		expect(result.valid).toBe(false);
		// Check that there's at least one issue about empty canvas
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it('should pass with single node', () => {
		const nodes = [createNode('1')];
		const result = validateForMission(nodes, []);
		expect(result.valid).toBe(true);
	});

	it('should pass with connected nodes', () => {
		const nodes = [
			createNode('1', 'Start'),
			createNode('2', 'End')
		];
		const connections = [createConnection('1', '2')];
		const result = validateForMission(nodes, connections);
		expect(result.valid).toBe(true);
	});

	it('should detect circular dependencies', () => {
		const nodes = [
			createNode('1'),
			createNode('2')
		];
		const connections = [
			createConnection('1', '2'),
			createConnection('2', '1')
		];
		const result = validateForMission(nodes, connections);
		expect(result.valid).toBe(false);
	});

	it('should pass complex DAG workflow', () => {
		// A -> B -> D
		//   \-> C -/
		const nodes = [
			createNode('A', 'Start'),
			createNode('B', 'Path 1'),
			createNode('C', 'Path 2'),
			createNode('D', 'End')
		];
		const connections = [
			createConnection('A', 'B'),
			createConnection('A', 'C'),
			createConnection('B', 'D'),
			createConnection('C', 'D')
		];
		const result = validateForMission(nodes, connections);
		expect(result.valid).toBe(true);
	});
});

describe('buildMissionFromCanvas', () => {
	it('does not inject framework build skills into no-build vanilla projects', async () => {
		const nodes = [
			createNode(
				'1',
				'task-1-foundation-layout: Create static app shell and responsive layout'
			)
		];
		nodes[0].skill.description = [
			'Build a vanilla-JS static app.',
			'Acceptance criteria:',
			'- No build step.',
			'- No package.json or dependency installation.',
			'- Opening index.html directly renders the app.'
		].join('\n');

		const result = await buildMissionFromCanvas(nodes, [], {
			name: 'Spark Static App',
			description: 'Build a vanilla-JS app with no build step and no dependencies.',
			projectPath: 'C:\\Users\\USER\\Desktop\\spark-static-app',
			loadH70Skills: true
		});

		expect(result.success).toBe(true);
		const skills = [...(result.taskSkillMap?.values() || [])].flat();
		expect(skills).not.toContain('react-patterns');
		expect(skills).not.toContain('tailwind-css');
		expect(skills).not.toContain('vite');
		expect(skills).not.toContain('typescript-strict');
	});
});
