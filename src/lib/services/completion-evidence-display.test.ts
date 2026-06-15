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
			terminalStatus: 'completed',
			missing: ['terminal_event', 'provider_result', 'provider_summary'],
			providerResultCount: 0,
			providerTerminal: false,
			hasTerminalEvent: false,
			hasProviderCompletionTime: false,
			hasProviderSummary: false,
			hasArtifactReference: false,
			tasksTerminal: true
		};

		expect(summarizeCompletionEvidenceForDisplay(evidence)).toBe('Needs completion proof');
		expect(completionEvidenceTooltipForDisplay(evidence)).toBe('Completion proof is incomplete.');
	});

	it('keeps complete and non-terminal evidence concise', () => {
		expect(summarizeCompletionEvidenceForDisplay({
			state: 'complete',
			summary: 'Completion evidence present.',
			terminalStatus: 'completed',
			missing: [],
			providerResultCount: 1,
			providerTerminal: true,
			hasTerminalEvent: true,
			hasProviderCompletionTime: true,
			hasProviderSummary: true,
			hasArtifactReference: false,
			tasksTerminal: true
		})).toBe('Completion proof complete');

		expect(summarizeCompletionEvidenceForDisplay({
			state: 'not_terminal',
			terminalStatus: null,
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

	it('does not label failed terminal evidence as completion proof', () => {
		const evidence: MissionControlCompletionEvidence = {
			state: 'complete',
			summary: 'Failure evidence present.',
			terminalStatus: 'failed',
			missing: [],
			providerResultCount: 1,
			providerTerminal: true,
			hasTerminalEvent: true,
			hasProviderCompletionTime: true,
			hasProviderSummary: true,
			hasArtifactReference: false,
			tasksTerminal: true
		};

		expect(summarizeCompletionEvidenceForDisplay(evidence)).toBe('Failure proof complete');
		expect(completionEvidenceTooltipForDisplay(evidence)).toBe('Failure proof is present.');
	});
});
