import { createHash } from 'node:crypto';
import { basename, resolve, win32 } from 'node:path';
import { extractExplicitProjectPath } from './project-path-extraction';
import { projectPreviewUrl } from './project-preview';
import type { MissionControlProjectLineage } from '$lib/types/mission-control';

type RecordLike = Record<string, unknown>;

const DEFAULT_PREVIEW_BASE_URL = 'http://127.0.0.1:3333';

function asRecord(value: unknown): RecordLike | null {
	return value && typeof value === 'object' ? (value as RecordLike) : null;
}

function stringField(record: RecordLike | null | undefined, ...keys: string[]): string | null {
	if (!record) return null;
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

function numberField(record: RecordLike | null | undefined, ...keys: string[]): number | null {
	if (!record) return null;
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
			return Math.trunc(value);
		}
		if (typeof value === 'string' && value.trim()) {
			const parsed = Number(value.trim());
			if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
		}
	}
	return null;
}

function compactFeedback(value: string | null): string | null {
	if (!value) return null;
	return value.replace(/\s+/g, ' ').trim().slice(0, 500) || null;
}

const STATUS_FEEDBACK_PATTERN =
	/\b(?:SKILL_LOADED|Preview URL|JS syntax|smoke path|verification|verified|task completed|syntax check passed|audit complete|responsive wrapping|visual token pass|progress:)\b/i;
const USER_FEEDBACK_PATTERN =
	/\b(?:same app|do not rebuild|from scratch|keep the|make the|feel more|more alive|user feedback)\b/i;

function feedbackQuality(value: string | null | undefined): number {
	if (!value) return 0;
	let score = Math.min(value.length, 500);
	if (USER_FEEDBACK_PATTERN.test(value)) score += 250;
	if (STATUS_FEEDBACK_PATTERN.test(value)) score -= 400;
	if (/[.:]\s*(?:passed|verified|complete|applied)\b/i.test(value)) score -= 150;
	return score;
}

function preferFeedbackText(current: string | null | undefined, incoming: string | null | undefined): string | null {
	if (!current) return incoming ?? null;
	if (!incoming) return current;
	const currentQuality = feedbackQuality(current);
	const incomingQuality = feedbackQuality(incoming);
	if (incomingQuality === currentQuality) {
		return incoming.length > current.length ? incoming : current;
	}
	return incomingQuality > currentQuality ? incoming : current;
}

function previewBaseUrl(): string {
	return (
		process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL?.trim() ||
		process.env.SPARK_PROJECT_PREVIEW_BASE_URL?.trim() ||
			process.env.SPAWNER_UI_PUBLIC_URL?.trim() ||
			process.env.PUBLIC_SPAWNER_UI_URL?.trim() ||
			process.env.SPAWNER_UI_URL?.trim() ||
			(process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim().replace(/^https?:\/\//i, '')}` : '') ||
		(process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL.trim().replace(/^https?:\/\//i, '')}` : '') ||
		DEFAULT_PREVIEW_BASE_URL
	);
}

function projectIdFromPath(projectPath: string | null): string | null {
	if (!projectPath) return null;
	const isWindowsPath = /^[A-Za-z]:[\\/]/.test(projectPath) || /^\\\\[^\\]+\\[^\\]+/.test(projectPath);
	const resolved = isWindowsPath ? win32.normalize(projectPath) : resolve(projectPath);
	const folder = (isWindowsPath ? win32.basename(resolved) : basename(resolved))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 48) || 'project';
	const hash = createHash('sha1').update(resolved.toLowerCase()).digest('hex').slice(0, 10);
	return `project-${folder}-${hash}`;
}

function firstTextBlock(data: RecordLike | null, missionName?: string | null, message?: string | null): string {
	return [
		stringField(data, 'goal', 'prompt', 'prd', 'brief', 'executionPrompt'),
		missionName,
		message
	]
		.filter((value): value is string => Boolean(value))
		.join('\n\n');
}

function extractProjectPath(text: string): string | null {
	return extractExplicitProjectPath(text);
}

function extractPreviewUrl(text: string): string | null {
	const match = text.match(/https?:\/\/[^\s)]+\/preview\/[A-Za-z0-9_-]+\/index\.html/i);
	return match?.[0] || null;
}

function extractParentMissionId(text: string): string | null {
	return text.match(/Parent mission:\s*([A-Za-z0-9_-]+)/i)?.[1] || null;
}

function extractIterationNumber(text: string): number | null {
	const match =
		text.match(/\biteration\s*#?\s*(\d+)\b/i) ||
		text.match(/\bpolish\s+(\d+)\b/i) ||
		text.match(/\bpass\s+(\d+)\b/i);
	const parsed = match ? Number(match[1]) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function extractImprovementFeedback(text: string): string | null {
	const block = text.match(/User feedback:\s*([\s\S]*?)(?:\s+Rules:|\s+Project context:|$)/i)?.[1];
	return compactFeedback(block || null);
}

export function mergeMissionControlProjectLineage(
	current: MissionControlProjectLineage | null | undefined,
	incoming: MissionControlProjectLineage | null | undefined
): MissionControlProjectLineage | null {
	if (!current && !incoming) return null;
	const merged: MissionControlProjectLineage = {
		projectId: current?.projectId ?? incoming?.projectId ?? null,
		projectPath: current?.projectPath ?? incoming?.projectPath ?? null,
		previewUrl: current?.previewUrl ?? incoming?.previewUrl ?? null,
		parentMissionId: current?.parentMissionId ?? incoming?.parentMissionId ?? null,
		iterationNumber: current?.iterationNumber ?? incoming?.iterationNumber ?? null,
		improvementFeedback: preferFeedbackText(current?.improvementFeedback, incoming?.improvementFeedback)
	};
	if (!merged.projectId) merged.projectId = projectIdFromPath(merged.projectPath);
	if (!merged.previewUrl && merged.projectPath) {
		merged.previewUrl = projectPreviewUrl(previewBaseUrl(), merged.projectPath);
	}
	return Object.values(merged).some((value) => value !== null) ? merged : null;
}

export function extractMissionControlProjectLineage(input: {
	data?: RecordLike | null;
	missionName?: string | null;
	message?: string | null;
}): MissionControlProjectLineage | null {
	const data = input.data ?? null;
	const nestedLineage = asRecord(data?.projectLineage) || asRecord(data?.lineage);
	const nestedProject = asRecord(data?.project);
	const records = [nestedLineage, nestedProject, data];
	const text = firstTextBlock(data, input.missionName, input.message);
	const projectPath =
		records.map((record) => stringField(record, 'projectPath', 'project_path')).find(Boolean) ||
		extractProjectPath(text);
	const explicitPreviewUrl =
		records.map((record) => stringField(record, 'previewUrl', 'preview_url', 'openUrl', 'open_url')).find(Boolean) ||
		extractPreviewUrl(text);
	const lineage: MissionControlProjectLineage = {
		projectId:
			records.map((record) => stringField(record, 'projectId', 'project_id')).find(Boolean) ||
			projectIdFromPath(projectPath),
		projectPath,
		previewUrl: explicitPreviewUrl || (projectPath ? projectPreviewUrl(previewBaseUrl(), projectPath) : null),
		parentMissionId:
			records.map((record) => stringField(record, 'parentMissionId', 'parent_mission_id')).find(Boolean) ||
			extractParentMissionId(text),
		iterationNumber:
			records.map((record) => numberField(record, 'iterationNumber', 'iteration_number', 'iteration')).find(Boolean) ||
			extractIterationNumber(text),
		improvementFeedback:
			records.map((record) => stringField(record, 'improvementFeedback', 'improvement_feedback', 'feedbackText', 'feedback', 'userFeedback')).find(Boolean) ||
			extractImprovementFeedback(text)
	};
	return Object.values(lineage).some((value) => value !== null) ? lineage : null;
}
