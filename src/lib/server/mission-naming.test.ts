import { describe, expect, it } from 'vitest';
import { formatMissionNamingGuidance, isWeakMissionName, resolveMissionName } from './mission-naming';

describe('mission naming', () => {
	it('preserves explicit product names from the build brief', () => {
		expect(
			resolveMissionName({
				content: 'Build a polished static browser game called Agent Evolution Arena.',
				suggestedName: 'Build A Polished Static Browser Game'
			})
		).toBe('Agent Evolution Arena');
	});

	it('repairs prompt fragments into product-shaped mission names', () => {
		expect(
			resolveMissionName({
				content: 'can we build a game that has the voxel esthetics, for Spark',
				suggestedName: 'game that has the voxel esthetics,'
			})
		).toBe('Spark Voxel Aesthetic Game');
	});

	it('keeps sparse understanding checks out of product naming', () => {
		expect(
			resolveMissionName({
				content: 'did you understand what i said',
				suggestedName: 'did you understand what i said'
			})
		).toBe('did you understand what i said');
	});

	it('flags raw clauses as weak mission names', () => {
		expect(isWeakMissionName('game that has the voxel esthetics,')).toBe(true);
		expect(isWeakMissionName('Mission Control Reliability Desk')).toBe(false);
	});

	it('documents the LLM naming contract for PRD analyzers', () => {
		expect(formatMissionNamingGuidance()).toContain('Project naming contract');
		expect(formatMissionNamingGuidance()).toContain('not a copied prompt fragment');
	});
});
