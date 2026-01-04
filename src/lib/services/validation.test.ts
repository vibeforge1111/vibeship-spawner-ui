/**
 * Validation Service Tests
 */

import { describe, it, expect } from 'vitest';
import { validateCanvas } from './validation';
import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

// Helper to create test nodes
function createNode(id: string, name: string = 'Test Skill'): CanvasNode {
	return {
		id,
		skillId: `skill-${id}`,
		position: { x: 0, y: 0 },
		skill: {
			id: `skill-${id}`,
			name,
			description: 'Test description',
			category: 'development',
			tier: 'free',
			tags: [],
			triggers: []
		}
	};
}

// Helper to create test connections
function createConnection(sourceId: string, targetId: string): Connection {
	return {
		id: `${sourceId}-${targetId}`,
		sourceNodeId: sourceId,
		targetNodeId: targetId,
		sourcePortId: 'output-0',
		targetPortId: 'input-0'
	};
}

describe('validateCanvas', () => {
	it('should return invalid for empty canvas', () => {
		const result = validateCanvas([], []);
		// Empty canvas is considered invalid (needs at least one node to be useful)
		expect(result.valid).toBe(false);
	});

	it('should return valid for single node', () => {
		const nodes = [createNode('1')];
		const result = validateCanvas(nodes, []);
		expect(result.valid).toBe(true);
	});

	it('should return valid for simple linear workflow', () => {
		const nodes = [
			createNode('1', 'First'),
			createNode('2', 'Second'),
			createNode('3', 'Third')
		];
		const connections = [
			createConnection('1', '2'),
			createConnection('2', '3')
		];
		const result = validateCanvas(nodes, connections);
		expect(result.valid).toBe(true);
	});

	it('should detect circular dependencies', () => {
		const nodes = [
			createNode('1'),
			createNode('2'),
			createNode('3')
		];
		const connections = [
			createConnection('1', '2'),
			createConnection('2', '3'),
			createConnection('3', '1') // Creates cycle
		];
		const result = validateCanvas(nodes, connections);
		expect(result.valid).toBe(false);
	});

	it('should handle parallel branches', () => {
		const nodes = [
			createNode('1', 'Start'),
			createNode('2', 'Branch A'),
			createNode('3', 'Branch B'),
			createNode('4', 'End')
		];
		const connections = [
			createConnection('1', '2'),
			createConnection('1', '3'),
			createConnection('2', '4'),
			createConnection('3', '4')
		];
		const result = validateCanvas(nodes, connections);
		expect(result.valid).toBe(true);
	});

});
