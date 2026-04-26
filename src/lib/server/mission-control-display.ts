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
