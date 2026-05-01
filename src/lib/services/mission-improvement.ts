import type { MissionControlProjectLineage } from '$lib/types/mission-control';

export interface MissionImprovementSource {
	id: string;
	name: string;
	projectLineage?: MissionControlProjectLineage | null;
}

export interface MissionImprovementDraft {
	goal: string;
	payload: {
		projectId?: string;
		projectPath?: string;
		previewUrl?: string;
		parentMissionId: string;
		iterationNumber: number;
		improvementFeedback?: string;
	};
}

function cleanText(value: string | null | undefined): string | null {
	const cleaned = value?.replace(/\s+/g, ' ').trim();
	return cleaned || null;
}

function nextIterationNumber(lineage: MissionControlProjectLineage | null | undefined): number {
	return Math.max(2, (lineage?.iterationNumber ?? 1) + 1);
}

export function buildMissionImprovementDraft(
	source: MissionImprovementSource,
	feedback?: string | null
): MissionImprovementDraft {
	const lineage = source.projectLineage ?? null;
	const projectPath = lineage?.projectPath || '.';
	const cleanFeedback = cleanText(feedback) || cleanText(lineage?.improvementFeedback);
	const iterationNumber = nextIterationNumber(lineage);
	const goal = [
		`Improve the existing shipped project "${source.name}" at ${projectPath}.`,
		'',
		'This is an iteration on an already shipped app, not a new scaffold.',
		'',
		'User feedback:',
		cleanFeedback || '',
		'',
		'Rules:',
		'- Read the existing project files before editing.',
		'- Preserve the current core workflow unless the user explicitly asks to change it.',
		'- Update only the files needed for this polish pass.',
		'- Return a concise handoff with project_path, what changed, and verification.',
		'',
		'Project context:',
		`- Parent mission: ${source.id}`,
		lineage?.previewUrl ? `- Current preview: ${lineage.previewUrl}` : null
	]
		.filter((line): line is string => line !== null)
		.join('\n');

	return {
		goal,
		payload: {
			...(lineage?.projectId ? { projectId: lineage.projectId } : {}),
			...(lineage?.projectPath ? { projectPath: lineage.projectPath } : {}),
			...(lineage?.previewUrl ? { previewUrl: lineage.previewUrl } : {}),
			parentMissionId: source.id,
			iterationNumber,
			...(cleanFeedback ? { improvementFeedback: cleanFeedback } : {})
		}
	};
}

