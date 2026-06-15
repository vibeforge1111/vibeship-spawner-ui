import type { MissionControlCompletionEvidence } from '$lib/types/mission-control';

export function summarizeCompletionEvidenceForDisplay(
	evidence: MissionControlCompletionEvidence | null | undefined
): string | null {
	if (!evidence || evidence.state === 'not_terminal') return null;
	const noun = evidence.terminalStatus === 'failed'
		? 'failure'
		: evidence.terminalStatus === 'cancelled'
			? 'cancellation'
			: 'completion';
	if (evidence.state === 'complete') return `${capitalize(noun)} proof complete`;
	return `Needs ${noun} proof`;
}

export function completionEvidenceTooltipForDisplay(
	evidence: MissionControlCompletionEvidence | null | undefined
): string | null {
	if (!evidence || evidence.state === 'not_terminal') return null;
	const noun = evidence.terminalStatus === 'failed'
		? 'failure'
		: evidence.terminalStatus === 'cancelled'
			? 'cancellation'
			: 'completion';
	if (evidence.state === 'complete') return `${capitalize(noun)} proof is present.`;
	return `${capitalize(noun)} proof is incomplete.`;
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
