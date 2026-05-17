import type { MissionLog } from './mcp-client';

export type DisplayLog = {
	message: string;
	tone: 'neutral' | 'success' | 'warning' | 'error' | 'start';
	label?: string;
};

export function humanizeTaskId(taskId: string): string {
	const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
	return taskId
		.replace(/^node-\d+-task-/, '')
		.replace(/-/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((word, index) => {
			const lower = word.toLowerCase();
			if (index > 0 && smallWords.has(lower)) return lower;
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join(' ');
}

function summarizeSkillList(rawSkills: string): string {
	const skills = rawSkills.split(',').map((skill) => skill.trim()).filter(Boolean);
	if (skills.length === 0) return 'Skills loaded.';
	if (skills.length <= 3) return `Skills loaded: ${skills.join(', ')}.`;
	return `Skills loaded: ${skills.slice(0, 3).join(', ')} +${skills.length - 3} more.`;
}

function skillContextFallbackMessage(taskName: string): string {
	return `${taskName}: using built-in task context.`;
}

export function normalizeExecutionLogMessage(message: string): string {
	const clean = message
		.replace(/\[MissionControl\]\s*/g, '')
		.replace(/\s*\((mission-[^)]+)\)\.?$/g, '')
		.replace(/^Progress:\s*/i, '')
		.trim();

	const skillSource = /^SKILL_SOURCE:([^:]+):(loaded|unavailable):(.+)$/i.exec(clean);
	if (skillSource) {
		const [, taskId, state, detail] = skillSource;
		const taskName = humanizeTaskId(taskId);
		if (state.toLowerCase() === 'loaded') {
			return `${taskName}: ${summarizeSkillList(detail)}`;
		}
		return skillContextFallbackMessage(taskName);
	}

	if (/^Absolute\s+\/[^ ]+\s+is unavailable.*read-only.*workspace/i.test(clean)) {
		const workspaceTarget = clean.match(/workspace\s+(.+)\.?$/i)?.[1]?.replace(/\.$/, '');
		return workspaceTarget
			? `Using workspace subfolder ${workspaceTarget}; the requested root path was read-only.`
			: 'Using a workspace subfolder because the requested root path was read-only.';
	}

	if (/^Codex:\s*completed without a text response/i.test(clean)) {
		return 'Provider completed; no additional summary was returned.';
	}

	return clean;
}

function isMissionCompletedLog(log: Pick<MissionLog, 'message' | 'type'>): boolean {
	return log.type === 'complete' && /^Mission completed\.?$/i.test(normalizeExecutionLogMessage(log.message));
}

function isGenericTaskCompletedLog(log: Pick<MissionLog, 'message' | 'type'>): boolean {
	return log.type === 'complete' && /^Task completed\.?$/i.test(normalizeExecutionLogMessage(log.message));
}

export function filterExecutionLogsForDisplay<T extends Pick<MissionLog, 'message' | 'type'>>(logs: T[]): T[] {
	if (!logs.some(isMissionCompletedLog)) return logs;
	return logs.filter((log) => !isGenericTaskCompletedLog(log));
}

export function formatExecutionLogForDisplay(log: Pick<MissionLog, 'message' | 'type'>): DisplayLog {
	const message = normalizeExecutionLogMessage(log.message);
	if (log.type === 'error') return { message, tone: 'error', label: 'Needs attention' };
	if (/read-only|unavailable|failed|error|missing/i.test(message)) return { message, tone: 'warning', label: 'Attention' };
	if (log.type === 'complete' || /\bis done\b|completed|Mission completed/i.test(message)) {
		return { message, tone: 'success', label: 'Done' };
	}
	if (log.type === 'start' || /\bis running\b|Mission started|Dispatch started/i.test(message)) {
		return { message, tone: 'start', label: 'Running' };
	}
	return { message, tone: 'neutral' };
}
