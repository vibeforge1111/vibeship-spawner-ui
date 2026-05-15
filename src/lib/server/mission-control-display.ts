const LOCAL_PATH_MARKER = '[local path]';

function sanitizeMarkdownLocalPathLinks(value: string): string {
	return value.replace(
		/\]\(((?:file:\/\/\/)?(?:[A-Za-z]:[\\/]|\/(?:Users|home|root)\/)[^)]+)\)/g,
		`](${LOCAL_PATH_MARKER})`
	);
}

function sanitizeBacktickedLocalPaths(value: string): string {
	return value.replace(
		/`((?:file:\/\/\/)?(?:[A-Za-z]:[\\/][^`\r\n]+|\/(?:Users|home|root)\/[^`\r\n]+))`/g,
		`\`${LOCAL_PATH_MARKER}\``
	);
}

function sanitizeBareWindowsPaths(value: string): string {
	return value.replace(/\b(?:file:\/\/\/)?[A-Za-z]:[\\/][^\s`'"<>()[\]{}|]+/g, LOCAL_PATH_MARKER);
}

function sanitizeBarePosixHomePaths(value: string): string {
	return value.replace(
		/(^|[^\w/])\/(?:Users|home|root)\/[^\s`'"<>()[\]{}|]+/g,
		(_match, prefix: string) => `${prefix}${LOCAL_PATH_MARKER}`
	);
}

export function sanitizeMissionControlDisplayText(value: string): string {
	return sanitizeBarePosixHomePaths(
		sanitizeBareWindowsPaths(sanitizeBacktickedLocalPaths(sanitizeMarkdownLocalPathLinks(value)))
	);
}

export function compactMissionControlDisplayText(
	value: string | null | undefined,
	maxLength = 360
): string | null {
	if (!value) return null;
	const compact = sanitizeMissionControlDisplayText(value)
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join(' ');
	if (!compact) return null;
	return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

function trimSentence(value: string): string {
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed) return trimmed;
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function taskSentence(taskName: string, verb: string, fallback: string): string {
	const cleanTask = taskName.trim();
	if (!cleanTask || /^task$/i.test(cleanTask)) return fallback;
	switch (verb) {
		case 'started':
			return trimSentence(`${cleanTask} is running`);
		case 'completed':
			return trimSentence(`${cleanTask} is done`);
		case 'cancelled':
			return trimSentence(`${cleanTask} was cancelled`);
		default:
			return trimSentence(`${cleanTask} ${verb}`);
	}
}

function readableTaskNameFromSlug(taskSlug: string): string {
	const cleanSlug = taskSlug
		.replace(/^node-\d+-task-/, '')
		.replace(/-/g, ' ')
		.trim();
	return cleanSlug ? `${cleanSlug.charAt(0).toUpperCase()}${cleanSlug.slice(1)}` : 'task';
}

function readableSkillSignalMessage(value: string): string | null {
	const skillLoadedMatch = value.match(/SKILL_LOADED:([^:]+):(.+)$/i);
	if (skillLoadedMatch) {
		return `Loaded skills for ${readableTaskNameFromSlug(skillLoadedMatch[1])}.`;
	}

	const skillSourceMatch = value.match(/SKILL_SOURCE:([^:]+):(loaded|unavailable):/i);
	if (!skillSourceMatch) return null;
	const [, taskSlug, state] = skillSourceMatch;
	const taskName = readableTaskNameFromSlug(taskSlug);
	if (state.toLowerCase() === 'loaded') {
		return `Loaded skills for ${taskName}.`;
	}
	return `${taskName}: using built-in task context.`;
}

export function readableMissionControlSummary(
	value: string | null | undefined,
	maxLength = 360
): string | null {
	const compact = compactMissionControlDisplayText(value, maxLength);
	if (!compact) return null;
	const withoutSurface = compact
		.replace(/\[MissionControl\]\s*/gi, '')
		.replace(/\s*\(mission-[^)]+\)\.?$/i, '')
		.trim();
	const skillSignal = readableSkillSignalMessage(withoutSurface.replace(/^Progress:\s*/i, '').trim());
	if (skillSignal) return skillSignal;

	const taskMatch = withoutSurface.match(/^Task\s+(started|completed|failed|cancelled):\s*(.+)$/i);
	if (taskMatch) {
		const verb = taskMatch[1].toLowerCase();
		const fallback = trimSentence(`Task ${verb}`);
		return taskSentence(taskMatch[2], verb, fallback);
	}

	return trimSentence(
		withoutSurface
			.replace(/^Queued:\s*/i, '')
			.replace(/^Progress:\s*/i, '')
			.replace(/^Provider feedback:\s*/i, '')
			.replace(/^Log update:\s*/i, '')
	);
}

function stripMarkdownLocalLinks(value: string): string {
	return value.replace(/\[([^\]]+)\]\(\[local path\]\)/g, '$1');
}

function stripInlineCode(value: string): string {
	return value.replace(/`([^`]+)`/g, '$1');
}

function isProviderNoiseLine(line: string): boolean {
	return (
		/^(?:OpenAI\s+)?(?:Codex|Claude|Z\.AI GLM) says:?$/i.test(line) ||
		/^Created exactly the requested files:?$/i.test(line) ||
		/^Created files:?$/i.test(line) ||
		/^Changed files:?$/i.test(line) ||
		/^Mission:\s*mission-[\w-]+$/i.test(line) ||
		/^Request:\s*[\w-]+$/i.test(line) ||
		/^-\s*[^:]+?\.(?:html|css|js|ts|svelte|md|json|py|txt)$/i.test(line)
	);
}

export function compactProviderHandoffText(
	value: string | null | undefined,
	maxLength = 420
): string | null {
	if (!value) return null;
	const compact = sanitizeMissionControlDisplayText(value)
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => stripInlineCode(stripMarkdownLocalLinks(line.trim())))
		.filter((line) => line.length > 0 && !isProviderNoiseLine(line))
		.join(' ')
		.replace(/\s+\[local path\]/g, ' local file')
		.replace(/\s{2,}/g, ' ')
		.trim();
	if (!compact) return null;
	return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}
