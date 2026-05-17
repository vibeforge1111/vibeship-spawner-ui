import { describe, expect, it } from 'vitest';
import {
	completionEvidenceTooltipForDisplay,
	summarizeCompletionEvidenceForDisplay
} from './completion-evidence-display';
import type { MissionControlCompletionEvidence } from '$lib/types/mission-control';

describe('completion evidence display', () => {
	it('summarizes missing completion evidence without exposing raw field names', () => {
		const evidence: MissionControlCompletionEvidence = {
			state: 'incomplete',
			summary: 'Completion evidence incomplete: missing terminal_event, provider_result, provider_summary.',
			missing: ['terminal_event', 'provider_result', 'provider_summary'],
			providerResultCount: 0,
			providerTerminal: false,
			hasTerminalEvent: false,
			hasProviderCompletionTime: false,
			hasProviderSummary: false,
			hasArtifactReference: false,
			tasksTerminal: true
		};

		expect(summarizeCompletionEvidenceForDisplay(evidence)).toBe('Missing 3 completion signals');
		expect(completionEvidenceTooltipForDisplay(evidence)).toBe('Completion evidence is missing 3 signals.');
	});

	it('keeps complete and non-terminal evidence concise', () => {
		expect(summarizeCompletionEvidenceForDisplay({
			state: 'complete',
			summary: 'Completion evidence present.',
			missing: [],
			providerResultCount: 1,
			providerTerminal: true,
			hasTerminalEvent: true,
			hasProviderCompletionTime: true,
			hasProviderSummary: true,
			hasArtifactReference: false,
			tasksTerminal: true
		})).toBe('Completion evidence present');

		expect(summarizeCompletionEvidenceForDisplay({
			state: 'not_terminal',
			summary: 'Provider is still running.',
			missing: [],
			providerResultCount: 0,
			providerTerminal: false,
			hasTerminalEvent: false,
			hasProviderCompletionTime: false,
			hasProviderSummary: false,
			hasArtifactReference: false,
			tasksTerminal: false
		})).toBeNull();
	});
});
