import type { MissionControlCompletionEvidence } from '$lib/types/mission-control';

export function summarizeCompletionEvidenceForDisplay(
	evidence: MissionControlCompletionEvidence | null | undefined
): string | null {
	if (!evidence || evidence.state === 'not_terminal') return null;
	if (evidence.state === 'complete') return 'Completion evidence present';
	if (evidence.missing.length === 0) return 'Completion evidence incomplete';
	const count = evidence.missing.length;
	return `Missing ${count} completion ${count === 1 ? 'signal' : 'signals'}`;
}

export function completionEvidenceTooltipForDisplay(
	evidence: MissionControlCompletionEvidence | null | undefined
): string | null {
	if (!evidence || evidence.state === 'not_terminal') return null;
	if (evidence.state === 'complete') return 'Completion evidence present.';
	if (evidence.missing.length === 0) return 'Completion evidence incomplete.';
	const count = evidence.missing.length;
	return `Completion evidence is missing ${count} ${count === 1 ? 'signal' : 'signals'}.`;
}
